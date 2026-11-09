import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import pg from "pg";

const { Pool } = pg;
const APPLY = process.argv.includes("--apply");
const SYNC = process.argv.includes("--sync");
const PRIMARY_KEYS = {
  games: "slug",
  products: "id",
  game_accounts: "id",
  store_settings: "id",
  faqs: "id",
  users: "uid",
  orders: "order_id",
  order_idempotency: "key_id",
  wallet_deposits: "deposit_id",
  wallet_deposit_rns: "claim_id",
  wallet_adjustments: "adjustment_id",
  member_ids: "member_id",
  topup_submissions: "order_id",
};
const EXPECTED_COLLECTIONS = new Set([
  "gameAccounts",
  "games",
  "member_ids",
  "order_idempotency",
  "orders",
  "products",
  "settings",
  "topup_submissions",
  "users",
  "wallet_adjustments",
  "wallet_deposit_rns",
  "wallet_deposits",
]);
const TABLES = [
  "games",
  "products",
  "game_accounts",
  "store_settings",
  "faqs",
  "users",
  "orders",
  "order_idempotency",
  "wallet_deposits",
  "wallet_deposit_rns",
  "wallet_adjustments",
  "member_ids",
  "topup_submissions",
];

function fail(message) {
  throw new Error(message);
}

function string(value, label, fallback) {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== "string") fail(`${label} must be a string.`);
  return value;
}

function number(value, label, fallback) {
  if (value == null && fallback !== undefined) return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) fail(`${label} must be a finite number.`);
  return parsed;
}

function boolean(value, label, fallback) {
  if (value == null && fallback !== undefined) return fallback;
  if (typeof value !== "boolean") fail(`${label} must be a boolean.`);
  return value;
}

function array(value, label, fallback = []) {
  if (value == null) return fallback;
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  return value;
}

function object(value, label, fallback = {}) {
  if (value == null) return fallback;
  if (typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
  return value;
}

function timestamp(value, label, fallback) {
  if (value == null && fallback !== undefined) return timestamp(fallback, label);
  if (value == null) fail(`${label} is missing.`);
  let date;
  if (typeof value?.toDate === "function") date = value.toDate();
  else if (value instanceof Date) date = value;
  else if (typeof value === "number") date = new Date(value);
  else if (typeof value === "string") date = new Date(value);
  else fail(`${label} is not a supported timestamp.`);
  if (!Number.isFinite(date.getTime())) fail(`${label} is invalid.`);
  return date;
}

function optionalTimestamp(value, label) {
  return value == null ? null : timestamp(value, label);
}

function recordId(snapshot, field) {
  const value = snapshot.data()[field];
  if (value != null && value !== snapshot.id) {
    fail(`${snapshot.ref.path} has a mismatched ${field} and document ID.`);
  }
  return snapshot.id;
}

async function loadCollection(firestore, name) {
  const snapshot = await firestore.collection(name).get();
  for (const document of snapshot.docs) {
    const subcollections = await document.ref.listCollections();
    if (subcollections.length) {
      fail(
        `Nested Firestore data exists under ${document.ref.path}; migration stopped to avoid skipping it.`,
      );
    }
  }
  return snapshot.docs;
}

async function loadAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function buildRows(collections, authUsers, adminUids) {
  const games = collections.games.map((doc) => {
    const d = doc.data();
    const slug = string(d.slug ?? doc.id, `${doc.ref.path}.slug`);
    if (slug !== doc.id) fail(`${doc.ref.path} has a mismatched slug and document ID.`);
    return {
      slug,
      name: string(d.name, `${doc.ref.path}.name`),
      currency: string(d.currency, `${doc.ref.path}.currency`, "LKR"),
      tone: string(d.tone, `${doc.ref.path}.tone`, "ice"),
      icon: string(d.icon, `${doc.ref.path}.icon`, "diamond"),
      artwork_key: string(d.artworkKey, `${doc.ref.path}.artworkKey`),
      image_url: d.imageUrl ?? null,
      description: string(d.description, `${doc.ref.path}.description`, ""),
      server_options: array(d.serverOptions, `${doc.ref.path}.serverOptions`),
      active: boolean(d.active, `${doc.ref.path}.active`, true),
      display_order: number(d.displayOrder, `${doc.ref.path}.displayOrder`, 0),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });

  const products = collections.products.map((doc) => {
    const d = doc.data();
    const id = string(d.id ?? doc.id, `${doc.ref.path}.id`);
    if (id !== doc.id) fail(`${doc.ref.path} has a mismatched id and document ID.`);
    return {
      id,
      game_slug: string(d.gameSlug, `${doc.ref.path}.gameSlug`),
      nexaura_product_id: d.nexauraProductId ?? null,
      category: d.category ?? null,
      amount: number(d.amount, `${doc.ref.path}.amount`),
      unit_label: string(d.unitLabel, `${doc.ref.path}.unitLabel`),
      name: string(d.name, `${doc.ref.path}.name`),
      image_url: d.imageUrl ?? null,
      price_usd: number(d.priceUsd, `${doc.ref.path}.priceUsd`),
      price_pkr: number(d.pricePkr, `${doc.ref.path}.pricePkr`),
      bonus: number(d.bonus, `${doc.ref.path}.bonus`, 0),
      is_popular: boolean(d.isPopular, `${doc.ref.path}.isPopular`, false),
      is_best_value: boolean(d.isBestValue, `${doc.ref.path}.isBestValue`, false),
      is_vip: boolean(d.isVip, `${doc.ref.path}.isVip`, false),
      active: boolean(d.active, `${doc.ref.path}.active`, true),
      display_order: number(d.displayOrder, `${doc.ref.path}.displayOrder`, 0),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });

  const accounts = collections.gameAccounts.map((doc) => {
    const d = doc.data();
    const id = string(d.id ?? doc.id, `${doc.ref.path}.id`);
    if (id !== doc.id) fail(`${doc.ref.path} has a mismatched id and document ID.`);
    return {
      id,
      game_id: string(d.gameId, `${doc.ref.path}.gameId`),
      game_name: string(d.gameName, `${doc.ref.path}.gameName`),
      title: string(d.title, `${doc.ref.path}.title`),
      tagline: string(d.tagline, `${doc.ref.path}.tagline`, ""),
      price_usd: number(d.priceUsd, `${doc.ref.path}.priceUsd`),
      price_pkr: number(d.pricePkr, `${doc.ref.path}.pricePkr`),
      price_sample: string(d.priceSample, `${doc.ref.path}.priceSample`, ""),
      level: number(d.level, `${doc.ref.path}.level`, 0),
      rank: string(d.rank, `${doc.ref.path}.rank`, ""),
      server: string(d.server, `${doc.ref.path}.server`, ""),
      login_type: string(d.loginType, `${doc.ref.path}.loginType`, ""),
      artwork_key: string(d.artworkKey, `${doc.ref.path}.artworkKey`),
      tone: string(d.tone, `${doc.ref.path}.tone`, "ice"),
      verified: boolean(d.verified, `${doc.ref.path}.verified`, false),
      status: string(d.status, `${doc.ref.path}.status`, "Available"),
      badges: array(d.badges, `${doc.ref.path}.badges`),
      inventory_highlights: array(d.inventoryHighlights, `${doc.ref.path}.inventoryHighlights`),
      description: string(d.description, `${doc.ref.path}.description`, ""),
      features: JSON.stringify(array(d.features, `${doc.ref.path}.features`)),
      active: boolean(d.active, `${doc.ref.path}.active`, true),
      display_order: number(d.displayOrder, `${doc.ref.path}.displayOrder`, 0),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });

  const settingsDocs = collections.settings;
  if (settingsDocs.length > 1 || settingsDocs.some((doc) => doc.id !== "store")) {
    fail("The settings collection contains unsupported documents; migration stopped.");
  }
  const settings = settingsDocs.map((doc) => {
    const d = doc.data();
    return {
      id: 1,
      store_name: string(d.storeName, "settings/store.storeName", ""),
      tagline: string(d.tagline, "settings/store.tagline", ""),
      support_email: string(d.supportEmail, "settings/store.supportEmail", ""),
      support_whatsapp: string(d.supportWhatsapp, "settings/store.supportWhatsapp", ""),
      payment_ezcash_number: string(
        d.paymentEzcashNumber,
        "settings/store.paymentEzcashNumber",
        "",
      ),
      payment_ezcash_name: string(d.paymentEzcashName, "settings/store.paymentEzcashName", ""),
      currency: string(d.currency, "settings/store.currency", "LKR"),
      banner_enabled: boolean(d.bannerEnabled, "settings/store.bannerEnabled", false),
      maintenance_mode: boolean(d.maintenanceMode, "settings/store.maintenanceMode", false),
      maintenance_title: d.maintenanceTitle ?? null,
      maintenance_message: d.maintenanceMessage ?? null,
      payment_methods: JSON.stringify(array(d.paymentMethods, "settings/store.paymentMethods")),
      created_at: timestamp(d.createdAt, "settings/store.createdAt", d.updatedAt),
      updated_at: timestamp(d.updatedAt, "settings/store.updatedAt", d.createdAt),
    };
  });

  const authByUid = new Map(authUsers.map((user) => [user.uid, user]));
  const firestoreUsers = collections.users.map((doc) => {
    const d = doc.data();
    const uid = string(d.uid ?? doc.id, `${doc.ref.path}.uid`);
    if (uid !== doc.id) fail(`${doc.ref.path} has a mismatched uid and document ID.`);
    return { uid, d, authUser: authByUid.get(uid) };
  });
  const usersByUid = new Map(firestoreUsers.map((entry) => [entry.uid, entry]));

  const balanceAffectingUids = new Set([
    ...collections.wallet_deposits
      .filter((doc) => doc.data().status === "credited")
      .map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
    ...collections.wallet_adjustments.map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
    ...collections.orders
      .filter((doc) => doc.data().paymentMethod === "wallet")
      .map((doc) => string(doc.data().customerUid, `${doc.ref.path}.customerUid`)),
  ]);
  const referencedUids = new Set([
    ...authUsers.map((user) => user.uid),
    ...firestoreUsers.map((user) => user.uid),
    ...collections.orders.map((doc) =>
      string(doc.data().customerUid, `${doc.ref.path}.customerUid`),
    ),
    ...collections.wallet_deposits.map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
    ...collections.wallet_adjustments.flatMap((doc) => [
      string(doc.data().uid, `${doc.ref.path}.uid`),
      string(doc.data().adminUid, `${doc.ref.path}.adminUid`),
    ]),
    ...collections.member_ids.map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
    ...collections.wallet_deposit_rns.map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
    ...collections.order_idempotency.map((doc) => string(doc.data().uid, `${doc.ref.path}.uid`)),
  ]);

  const userRows = [];
  const missingBalances = [];
  const appendUser = (uid, d = {}, authUser = null, isFirestoreProfile = false) => {
    const legacyBalance = d.walletBalanceLkr;
    if (legacyBalance == null && balanceAffectingUids.has(uid)) missingBalances.push(uid);
    const prefs = object(d.notificationPrefs, `users/${uid}.notificationPrefs`);
    const theme = string(d.theme, `users/${uid}.theme`, "system");
    if (!["light", "dark", "system"].includes(theme)) fail(`users/${uid}.theme is unsupported.`);
    const authCreatedAt = authUser?.metadata?.creationTime;
    const createdAt = d.createdAt ?? authCreatedAt;
    userRows.push({
      uid,
      member_id: d.memberId ?? null,
      email: string(d.email, `users/${uid}.email`, authUser?.email ?? ""),
      display_name: string(d.displayName, `users/${uid}.displayName`, authUser?.displayName ?? ""),
      phone_number: d.phoneNumber ?? authUser?.phoneNumber ?? null,
      profile_complete: boolean(d.profileComplete, `users/${uid}.profileComplete`, false),
      terms_accepted_at: optionalTimestamp(d.termsAcceptedAt, `users/${uid}.termsAcceptedAt`),
      role: string(d.role, `users/${uid}.role`, adminUids.has(uid) ? "admin" : "customer"),
      notification_updates: boolean(prefs.updates, `users/${uid}.notificationPrefs.updates`, false),
      notification_reminders: boolean(
        prefs.reminders,
        `users/${uid}.notificationPrefs.reminders`,
        false,
      ),
      saved_player_ids: JSON.stringify(object(d.savedPlayerIds, `users/${uid}.savedPlayerIds`)),
      recent_viewed_games: array(d.recentViewedGames, `users/${uid}.recentViewedGames`),
      favorites: array(d.favorites, `users/${uid}.favorites`),
      theme,
      wallet_balance_lkr: number(legacyBalance, `users/${uid}.walletBalanceLkr`, 0),
      created_at: timestamp(createdAt, `users/${uid}.createdAt`),
      updated_at: timestamp(d.updatedAt, `users/${uid}.updatedAt`, createdAt),
    });
    if (!isFirestoreProfile && authUser == null) {
      fail(`Referenced UID ${uid} has no Firestore profile or Firebase Auth identity.`);
    }
  };

  for (const entry of firestoreUsers) {
    appendUser(entry.uid, entry.d, entry.authUser, true);
  }
  for (const user of authUsers) {
    if (!usersByUid.has(user.uid)) appendUser(user.uid, {}, user, false);
  }
  for (const uid of referencedUids) {
    if (!usersByUid.has(uid) && !authByUid.has(uid)) {
      fail(`Referenced UID ${uid} has neither a Firestore profile nor a Firebase Auth identity.`);
    }
  }

  const orders = collections.orders.map((doc) => {
    const d = doc.data();
    const orderId = recordId(doc, "orderId");
    return {
      order_id: orderId,
      customer_uid: string(d.customerUid, `${doc.ref.path}.customerUid`),
      customer_email: string(d.customerEmail, `${doc.ref.path}.customerEmail`, ""),
      game_slug: string(d.gameSlug, `${doc.ref.path}.gameSlug`),
      game_name: string(d.gameName, `${doc.ref.path}.gameName`),
      product_id: d.productId ?? null,
      nexaura_product_id: d.nexauraProductId ?? null,
      nexaura_order_id: d.nexauraOrderId ?? null,
      nexaura_status: d.nexauraStatus ?? null,
      nexaura_note: d.nexauraNote ?? null,
      nexaura_last_error: d.nexauraLastError ?? null,
      nexaura_internal_error: d.nexauraInternalError ?? null,
      package_name: string(d.packageName, `${doc.ref.path}.packageName`),
      amount: number(d.amount, `${doc.ref.path}.amount`),
      unit_label: string(d.unitLabel, `${doc.ref.path}.unitLabel`, ""),
      price_usd: number(d.priceUsd, `${doc.ref.path}.priceUsd`),
      price_pkr: number(d.pricePkr, `${doc.ref.path}.pricePkr`),
      currency: string(d.currency, `${doc.ref.path}.currency`, "LKR"),
      player_id: string(d.playerId, `${doc.ref.path}.playerId`),
      player_name: d.playerName ?? null,
      player_name_lookup_status: d.playerNameLookupStatus ?? null,
      player_region: d.playerRegion ?? null,
      player_name_source: d.playerNameSource ?? null,
      server: string(d.server, `${doc.ref.path}.server`, ""),
      payment_method: d.paymentMethod ?? null,
      payment_recipient: d.paymentRecipient ?? null,
      payment_status: string(d.paymentStatus, `${doc.ref.path}.paymentStatus`, "unpaid"),
      payment_proof_storage_path: d.paymentProofStoragePath ?? null,
      payment_proof_storage_provider: d.paymentProofStorageProvider ?? null,
      payment_proof_content_type: d.paymentProofContentType ?? null,
      payment_proof_file_name: d.paymentProofFileName ?? null,
      payment_proof_submitted_at: optionalTimestamp(
        d.paymentProofSubmittedAt,
        `${doc.ref.path}.paymentProofSubmittedAt`,
      ),
      payment_reviewed_by: d.paymentReviewedBy ?? null,
      payment_reviewed_at: optionalTimestamp(
        d.paymentReviewedAt,
        `${doc.ref.path}.paymentReviewedAt`,
      ),
      status: string(d.status, `${doc.ref.path}.status`, "pending"),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });

  const deposits = collections.wallet_deposits.map((doc) => {
    const d = doc.data();
    const depositId = string(d.depositId ?? doc.id, `${doc.ref.path}.depositId`);
    if (depositId !== doc.id) fail(`${doc.ref.path} has a mismatched depositId and document ID.`);
    return {
      deposit_id: depositId,
      uid: string(d.uid, `${doc.ref.path}.uid`),
      reference_number: string(d.referenceNumber, `${doc.ref.path}.referenceNumber`),
      method: string(d.method, `${doc.ref.path}.method`, "ezcash"),
      status: string(d.status, `${doc.ref.path}.status`),
      credited_lkr: number(d.creditedLkr, `${doc.ref.path}.creditedLkr`, 0),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
      credited_at: optionalTimestamp(d.creditedAt, `${doc.ref.path}.creditedAt`),
    };
  });

  const adjustments = collections.wallet_adjustments.map((doc) => {
    const d = doc.data();
    const adjustmentId = string(d.adjustmentId ?? doc.id, `${doc.ref.path}.adjustmentId`);
    if (adjustmentId !== doc.id)
      fail(`${doc.ref.path} has a mismatched adjustmentId and document ID.`);
    return {
      adjustment_id: adjustmentId,
      uid: string(d.uid, `${doc.ref.path}.uid`),
      amount_lkr: number(d.amountLkr, `${doc.ref.path}.amountLkr`),
      reason: string(d.reason, `${doc.ref.path}.reason`),
      admin_uid: string(d.adminUid, `${doc.ref.path}.adminUid`),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
    };
  });

  const memberIds = collections.member_ids.map((doc) => ({
    member_id: doc.id,
    uid: string(doc.data().uid, `${doc.ref.path}.uid`),
    created_at: timestamp(doc.data().createdAt, `${doc.ref.path}.createdAt`),
  }));
  const idempotency = collections.order_idempotency.map((doc) => {
    const d = doc.data();
    return {
      key_id: doc.id,
      uid: string(d.uid, `${doc.ref.path}.uid`),
      order_id: d.orderId || null,
      fingerprint: string(d.fingerprint, `${doc.ref.path}.fingerprint`),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
    };
  });
  const depositRns = collections.wallet_deposit_rns.map((doc) => {
    const d = doc.data();
    return {
      claim_id: doc.id,
      uid: string(d.uid, `${doc.ref.path}.uid`),
      reference_number: string(d.referenceNumber, `${doc.ref.path}.referenceNumber`),
      deposit_id: d.depositId || null,
      status: string(d.status, `${doc.ref.path}.status`, "submitting"),
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });
  const topupSubmissions = collections.topup_submissions.map((doc) => {
    const d = doc.data();
    return {
      order_id: string(d.orderId ?? doc.id, `${doc.ref.path}.orderId`),
      status: string(d.status, `${doc.ref.path}.status`, "submitting"),
      provider_order_id: d.providerOrderId ?? null,
      internal_error: d.internalError ?? null,
      created_at: timestamp(d.createdAt, `${doc.ref.path}.createdAt`),
      updated_at: timestamp(d.updatedAt, `${doc.ref.path}.updatedAt`, d.createdAt),
    };
  });

  const gameSlugs = new Set(games.map((row) => row.slug));
  const userUids = new Set(userRows.map((row) => row.uid));
  const orderIds = new Set(orders.map((row) => row.order_id));
  const depositIds = new Set(deposits.map((row) => row.deposit_id));
  const memberIdsByUid = new Map();
  for (const item of memberIds) {
    if (!userUids.has(item.uid)) fail(`Member ID ${item.member_id} references a missing user.`);
    if (memberIdsByUid.has(item.uid)) fail(`User ${item.uid} has duplicate member ID records.`);
    memberIdsByUid.set(item.uid, item.member_id);
  }
  for (const user of userRows) {
    if (
      user.member_id &&
      memberIdsByUid.get(user.uid) &&
      user.member_id !== memberIdsByUid.get(user.uid)
    ) {
      fail(`User ${user.uid} has inconsistent member IDs between profile and member_ids.`);
    }
  }
  for (const row of products)
    if (!gameSlugs.has(row.game_slug)) fail(`Product ${row.id} references a missing game.`);
  for (const row of accounts)
    if (!gameSlugs.has(row.game_id)) fail(`Game account ${row.id} references a missing game.`);
  for (const row of orders) {
    if (!userUids.has(row.customer_uid))
      fail(`Order ${row.order_id} references a missing customer.`);
    if (!gameSlugs.has(row.game_slug)) fail(`Order ${row.order_id} references a missing game.`);
    if (row.payment_reviewed_by && !userUids.has(row.payment_reviewed_by)) {
      fail(`Order ${row.order_id} references a missing payment reviewer.`);
    }
  }
  for (const row of deposits)
    if (!userUids.has(row.uid)) fail(`Deposit ${row.deposit_id} references a missing user.`);
  for (const row of adjustments) {
    if (!userUids.has(row.uid) || !userUids.has(row.admin_uid))
      fail(`Wallet adjustment ${row.adjustment_id} references a missing user.`);
  }
  for (const row of idempotency) {
    if (!userUids.has(row.uid))
      fail(`Order idempotency record ${row.key_id} references a missing user.`);
    if (row.order_id && !orderIds.has(row.order_id))
      fail(`Order idempotency record ${row.key_id} references a missing order.`);
  }
  for (const row of depositRns) {
    if (!userUids.has(row.uid))
      fail(`Deposit reference ${row.claim_id} references a missing user.`);
    if (row.deposit_id && !depositIds.has(row.deposit_id))
      fail(`Deposit reference ${row.claim_id} references a missing deposit.`);
  }
  for (const row of topupSubmissions) {
    if (!orderIds.has(row.order_id))
      fail(`Top-up submission ${row.order_id} references a missing order.`);
  }

  const ledgerNetCents = new Map();
  const addCents = (uid, cents) => ledgerNetCents.set(uid, (ledgerNetCents.get(uid) ?? 0) + cents);
  for (const row of deposits) {
    if (row.status === "credited") addCents(row.uid, Math.round(row.credited_lkr * 100));
  }
  for (const row of adjustments) addCents(row.uid, Math.round(row.amount_lkr * 100));
  for (const row of orders) {
    if (row.payment_method === "wallet")
      addCents(row.customer_uid, -Math.round(row.price_pkr * 100));
  }
  const usersWithOpeningBalance = userRows.filter((row) => {
    const balanceCents = Math.round(row.wallet_balance_lkr * 100);
    return balanceCents !== (ledgerNetCents.get(row.uid) ?? 0);
  }).length;

  return {
    rows: {
      games,
      products,
      game_accounts: accounts,
      store_settings: settings,
      users: userRows,
      orders,
      order_idempotency: idempotency,
      wallet_deposits: deposits,
      wallet_deposit_rns: depositRns,
      wallet_adjustments: adjustments,
      member_ids: memberIds,
      topup_submissions: topupSubmissions,
    },
    missingBalances,
    usersWithOpeningBalance,
    firestoreUserCount: firestoreUsers.length,
    authUserCount: authUsers.length,
    authOnlyUserCount: authUsers.filter((user) => !usersByUid.has(user.uid)).length,
  };
}

async function insertRows(client, table, rows, upsert = false) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  for (const row of rows) {
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const values = columns.map((column) => row[column]);
    const conflict = upsert
      ? ` ON CONFLICT (${PRIMARY_KEYS[table]}) DO UPDATE SET ${columns
          .filter((column) => column !== PRIMARY_KEYS[table])
          .map((column) => `${column} = EXCLUDED.${column}`)
          .join(", ")}`
      : "";
    await client.query(
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})${conflict}`,
      values,
    );
  }
}

async function main() {
  const modes = ["--dry-run", "--apply", "--sync"].filter((mode) => process.argv.includes(mode));
  if (modes.length !== 1) fail("Choose exactly one mode: --dry-run, --apply, or --sync.");
  if (process.argv.some((arg) => arg.startsWith("--") && !modes.includes(arg))) {
    fail("Unknown migration option.");
  }
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const connectionString = process.env.DATABASE_URL;
  if (!credentialPath || !connectionString) {
    fail("Set GOOGLE_APPLICATION_CREDENTIALS and DATABASE_URL in the environment.");
  }
  const credential = JSON.parse(await readFile(resolve(credentialPath), "utf8"));
  if (!credential.project_id) fail("The Firebase service-account file has no project ID.");
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PROJECT_ID !== credential.project_id
  ) {
    fail("FIREBASE_PROJECT_ID does not match the service-account project.");
  }

  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert(credential),
      projectId: credential.project_id,
    });
  const firestore = getFirestore(app);
  const auth = getAuth(app);
  const rootCollections = await firestore.listCollections();
  const rootNames = new Set(rootCollections.map((collection) => collection.id));
  for (const name of rootNames)
    if (!EXPECTED_COLLECTIONS.has(name)) fail(`Unmapped Firestore collection found: ${name}.`);
  for (const name of EXPECTED_COLLECTIONS)
    if (!rootNames.has(name)) {
      fail(`Expected Firestore collection is missing: ${name}.`);
    }

  const collections = {};
  for (const name of EXPECTED_COLLECTIONS) {
    collections[name] = await loadCollection(firestore, name);
  }
  const authUsers = await loadAuthUsers(auth);
  const adminUids = new Set(
    (process.env.ADMIN_UIDS ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean),
  );
  const migration = buildRows(collections, authUsers, adminUids);
  if (migration.missingBalances.length) {
    fail(
      `${migration.missingBalances.length} user(s) have financial history but no stored wallet balance. ` +
        "Reconcile those source wallets before importing; no destination rows were written.",
    );
  }

  const pool = new Pool({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "false"
        ? false
        : { rejectUnauthorized: process.env.DATABASE_SSL_STRICT === "false" ? false : true },
    connectionTimeoutMillis: 10_000,
  });
  const client = await pool.connect();
  try {
    const counts = {};
    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
      counts[table] = rows[0].count;
    }
    const occupied = Object.entries(counts).filter(([, count]) => count !== 0);
    if (APPLY && occupied.length) {
      fail(
        `Neon is not empty (${occupied.map(([table]) => table).join(", ")}); refusing to overwrite or merge records.`,
      );
    }

    console.log(`Firebase project: ${credential.project_id}`);
    console.log(`Firestore profile documents: ${migration.firestoreUserCount}`);
    console.log(`Firebase Auth users: ${migration.authUserCount}`);
    console.log(`Additional Auth-only user profiles to create: ${migration.authOnlyUserCount}`);
    for (const [table, rows] of Object.entries(migration.rows)) {
      console.log(`${table}: ${rows.length}`);
    }
    console.log(
      `Wallets whose balance differs from recorded ledger net (opening/legacy balance to preserve): ${migration.usersWithOpeningBalance}`,
    );
    if (!APPLY && !SYNC) {
      console.log(
        "Dry run only. No Neon records were written. Re-run with --apply for an empty database or --sync to reconcile an existing import.",
      );
      return;
    }

    await client.query("BEGIN");
    try {
      for (const [table, rows] of Object.entries(migration.rows)) {
        await insertRows(client, table, rows, SYNC);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    for (const table of TABLES) {
      const { rows } = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
      const expected = migration.rows[table]?.length ?? 0;
      if (SYNC ? rows[0].count < expected : rows[0].count !== expected) {
        fail(`Post-import reconciliation failed for ${table}.`);
      }
      const primaryKey = PRIMARY_KEYS[table];
      if (expected > 0) {
        const sourceIds = (migration.rows[table] ?? []).map((row) => row[primaryKey]);
        const present = await client.query(
          `SELECT count(*)::int AS count FROM ${table} WHERE ${primaryKey} = ANY($1)`,
          [sourceIds],
        );
        if (present.rows[0].count !== expected) {
          fail(`Record ID reconciliation failed for ${table}.`);
        }
      }
    }
    const migratedUsers = await client.query(
      "SELECT uid, wallet_balance_lkr FROM users ORDER BY uid",
    );
    const sourceBalances = new Map(
      migration.rows.users.map((user) => [user.uid, user.wallet_balance_lkr]),
    );
    for (const user of migratedUsers.rows) {
      if (Number(user.wallet_balance_lkr) !== sourceBalances.get(user.uid)) {
        fail(`Wallet balance reconciliation failed for user ${user.uid}.`);
      }
    }
    console.log(
      `${SYNC ? "Sync" : "Import"} committed and reconciled: ${migratedUsers.rowCount} user wallet balances match the source snapshot.`,
    );
    console.log(
      "Historical wallet flows imported from deposits, adjustments, and wallet-paid orders.",
    );
    console.log("Firestore was read only. The production API and Firebase Auth were not changed.");
  } finally {
    client.release();
    await pool.end();
    await app.delete();
  }
}

main().catch((error) => {
  console.error("Firestore-to-Neon migration stopped:", error.message);
  process.exitCode = 1;
});
