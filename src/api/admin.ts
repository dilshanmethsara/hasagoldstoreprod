import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GameInput = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(100),
  currency: z.string().trim().min(1).max(40),
  tone: z.enum(["ice", "ember", "olive", "violet"]),
  icon: z.enum(["diamond", "coins"]),
  artworkKey: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000),
  serverOptions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

const ProductInput = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  gameSlug: z.string().trim().min(1).max(80),
  nexauraProductId: z.string().trim().max(100).optional(),
  category: z
    .enum(["diamonds", "memberships", "level-up-passes", "evo-access"])
    .default("diamonds"),
  amount: z.number().positive().finite(),
  unitLabel: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  priceUsd: z.number().min(0).finite(),
  pricePkr: z.number().min(0).finite(),
  bonus: z.number().min(0).finite(),
  isPopular: z.boolean(),
  isBestValue: z.boolean(),
  isVip: z.boolean(),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

const AccountInput = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  gameId: z.string().trim().min(1).max(80),
  gameName: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(120),
  tagline: z.string().trim().max(200),
  priceUsd: z.number().min(0).finite(),
  pricePkr: z.number().min(0).finite(),
  priceSample: z.string().trim().max(80),
  level: z.number().int().min(0).max(10000),
  rank: z.string().trim().max(80),
  server: z.string().trim().max(100),
  loginType: z.string().trim().max(100),
  artworkKey: z.string().trim().min(1).max(100),
  tone: z.enum(["ice", "ember", "olive", "violet"]),
  verified: z.literal(false),
  status: z.enum(["Available", "Reserved", "Sold"]),
  badges: z.array(z.string().trim().min(1).max(60)).max(20),
  inventoryHighlights: z.array(z.string().trim().min(1).max(100)).max(50),
  description: z.string().trim().max(2000),
  features: z
    .array(z.object({ label: z.string().trim().max(100), value: z.string().trim().max(200) }))
    .max(50),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

const PaymentMethodInput = z.object({
  id: z.enum(["wallet", "ezcash"]),
  name: z.string().trim().min(1).max(100),
  sub: z.string().trim().max(200),
  short: z.string().trim().max(10),
  active: z.boolean(),
});

const SettingsInput = z
  .object({
    storeName: z.string().trim().min(1).max(100),
    tagline: z.string().trim().max(200),
    supportEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
    supportWhatsapp: z.string().trim().max(40),
    paymentEzcashNumber: z.string().trim().max(40),
    paymentEzcashName: z.string().trim().max(100),
    currency: z.literal("LKR"),
    bannerEnabled: z.boolean(),
    maintenanceMode: z.boolean(),
    paymentMethods: z.array(PaymentMethodInput).optional(),
  })
  .refine(
    (settings) => Boolean(settings.paymentEzcashNumber) === Boolean(settings.paymentEzcashName),
    "Set both the eZ Cash number and account name, or leave both blank.",
  )
  .refine((settings) => {
    if (!settings.paymentMethods) return true;
    return (
      settings.paymentMethods.length === 2 &&
      new Set(settings.paymentMethods.map((method) => method.id)).size === 2
    );
  }, "Configure exactly one Wallet method and one eZ Cash method.");

const FaqInput = z.object({
  items: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(240),
        answer: z.string().trim().min(1).max(2000),
      }),
    )
    .max(100),
});

let adminPasswordFailures = 0;
let adminPasswordLockedUntil = 0;

type AdminCollection = "games" | "products" | "gameAccounts" | "orders" | "wallet_deposits";
export type AdminJson =
  string | number | boolean | null | AdminJson[] | { [key: string]: AdminJson };
export type AdminDocument = { id: string; [key: string]: AdminJson };

async function requireAdmin(idToken: string) {
  if (!idToken) throw new Error("Sign in with an administrator account.");
  const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean);
  if (!allowedUids.length) throw new Error("Admin access is not configured on the server.");

  const { assertEmailVerified, getAdminAuth } = await import("@/server/firebase-admin");
  const decoded = await getAdminAuth().verifyIdToken(idToken, true);
  assertEmailVerified(decoded);
  if (!allowedUids.includes(decoded.uid)) {
    throw new Error("This Firebase account is not authorized to manage the store.");
  }
  return decoded;
}

export const signInWithAdminPassword = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { password?: unknown };
    if (
      typeof input?.password !== "string" ||
      input.password.length < 1 ||
      input.password.length > 256
    ) {
      throw new Error("Enter the admin password.");
    }
    return { password: input.password };
  })
  .handler(async ({ data }) => {
    if (process.env["NODE_ENV"] !== "development") {
      throw new Error(
        "Temporary password sign-in is available only on the local development server.",
      );
    }
    const now = Date.now();
    if (adminPasswordLockedUntil > now) {
      const waitSeconds = Math.ceil((adminPasswordLockedUntil - now) / 1000);
      throw new Error(`Too many incorrect attempts. Try again in ${waitSeconds} seconds.`);
    }
    const password = process.env["ADMIN_PANEL_PASSWORD"];
    if (!password || password.length < 16) {
      throw new Error(
        "Temporary admin password sign-in is not configured. Set a strong ADMIN_PANEL_PASSWORD (at least 16 characters) in the server environment.",
      );
    }
    const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean);
    const uid = allowedUids[0];
    if (!uid) throw new Error("Admin access is not configured on the server.");

    const encoder = new TextEncoder();
    const [expectedHash, providedHash] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(password)),
      crypto.subtle.digest("SHA-256", encoder.encode(data.password)),
    ]);
    const expected = new Uint8Array(expectedHash);
    const provided = new Uint8Array(providedHash);
    let difference = 0;
    for (let index = 0; index < expected.length; index += 1) {
      difference |= expected[index]! ^ provided[index]!;
    }
    if (difference !== 0) {
      adminPasswordFailures += 1;
      if (adminPasswordFailures >= 5) {
        adminPasswordFailures = 0;
        adminPasswordLockedUntil = now + 15 * 60_000;
      }
      throw new Error("Incorrect admin password.");
    }

    adminPasswordFailures = 0;
    adminPasswordLockedUntil = 0;
    const { getAdminAuth } = await import("@/server/firebase-admin");
    await getAdminAuth().getUser(uid);
    return { token: await getAdminAuth().createCustomToken(uid) };
  });

function serialize(value: unknown): AdminJson {
  if (value === undefined || value === null) return null;
  if (value && typeof value === "object" && "toMillis" in value) {
    const toMillis = (value as { toMillis?: () => number }).toMillis;
    if (typeof toMillis === "function") return toMillis.call(value);
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return String(value);
}

export const verifyAdminAccess = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.idToken);
    return { uid: admin.uid };
  });

function parseListInput(raw: unknown) {
  const input = raw as { idToken?: unknown; collection?: unknown; pageToken?: unknown };
  if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
  const collections: AdminCollection[] = [
    "games",
    "products",
    "gameAccounts",
    "orders",
    "wallet_deposits",
  ];
  if (
    typeof input.collection !== "string" ||
    !collections.includes(input.collection as AdminCollection)
  ) {
    throw new Error("Unsupported admin collection.");
  }
  if (
    input.pageToken !== undefined &&
    (typeof input.pageToken !== "string" || input.pageToken.length > 500)
  ) {
    throw new Error("Invalid page token.");
  }
  return {
    idToken: input.idToken,
    collection: input.collection as AdminCollection,
    pageToken: input.pageToken as string | undefined,
  };
}

export const listAdminRecords = createServerFn({ method: "POST" })
  .validator(parseListInput)
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const { FieldPath, Timestamp } = await import("firebase-admin/firestore");
    const db = getAdminDb();
    const collection = db.collection(data.collection);
    const orderField =
      data.collection === "orders" || data.collection === "wallet_deposits"
        ? "createdAt"
        : "displayOrder";
    const direction =
      data.collection === "orders" || data.collection === "wallet_deposits" ? "desc" : "asc";
    let cursor: { id: string; value: number } | undefined;
    if (data.pageToken) {
      try {
        cursor = JSON.parse(Buffer.from(data.pageToken, "base64url").toString("utf8")) as {
          id: string;
          value: number;
        };
        if (
          typeof cursor.id !== "string" ||
          typeof cursor.value !== "number" ||
          !Number.isFinite(cursor.value)
        ) {
          throw new Error("Invalid cursor.");
        }
      } catch {
        throw new Error("Invalid page token.");
      }
    }
    const query = collection
      .orderBy(orderField, direction)
      .orderBy(FieldPath.documentId(), direction);
    const orderedQuery =
      cursor && orderField === "createdAt"
        ? query.startAfter(Timestamp.fromMillis(cursor.value), cursor.id)
        : cursor
          ? query.startAfter(cursor.value, cursor.id)
          : query;
    const pageSize = 100;
    const snapshot = await orderedQuery.limit(pageSize).get();
    const last = snapshot.docs.at(-1);
    const lastSortValue = last?.get(orderField);
    const memberIdsByUid = new Map<string, string>();
    if (data.collection === "wallet_deposits") {
      const customerUids = [
        ...new Set(
          snapshot.docs
            .map((document) => document.get("uid"))
            .filter((uid): uid is string => typeof uid === "string" && uid.length > 0),
        ),
      ];
      if (customerUids.length) {
        const profiles = await db.getAll(...customerUids.map((uid) => db.doc(`users/${uid}`)));
        profiles.forEach((profile, index) => {
          const memberId = profile.get("memberId");
          const uid = customerUids[index];
          if (typeof memberId === "string" && uid) memberIdsByUid.set(uid, memberId);
        });
      }
    }
    const nextPageToken =
      snapshot.size === pageSize && last
        ? Buffer.from(
            JSON.stringify({
              id: last.id,
              value:
                typeof lastSortValue === "number" ? lastSortValue : lastSortValue?.toMillis?.(),
            }),
          ).toString("base64url")
        : null;
    return {
      items: snapshot.docs.map((document) => {
        const record: Record<string, unknown> = { id: document.id, ...document.data() };
        if (data.collection === "wallet_deposits") {
          const uid = document.get("uid");
          record["customerMemberId"] =
            typeof uid === "string" ? (memberIdsByUid.get(uid) ?? null) : null;
        }
        return serialize(record) as AdminDocument;
      }),
      nextPageToken,
    };
  });

const NEXAURA_FAILURE_STATUSES = ["failed", "submission_failed", "submission_unknown"] as const;

/** Free Fire orders whose automatic Nexaura top-up failed or needs review. */
export const listNexauraFailures = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Missing authentication token.");
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    // A single-field `in` filter is served by the automatic index on nexauraStatus,
    // so this page needs no new Firestore composite index deployment.
    const snapshot = await getAdminDb()
      .collection("orders")
      .where("nexauraStatus", "in", [...NEXAURA_FAILURE_STATUSES])
      .limit(300)
      .get();
    const items = snapshot.docs
      .filter((document) => document.get("gameSlug") === "free-fire")
      .map((document) => serialize({ id: document.id, ...document.data() }) as AdminDocument)
      .sort((a, b) => Number(b["createdAt"] ?? 0) - Number(a["createdAt"] ?? 0));
    return { items };
  });

export const searchAdminOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Missing authentication token.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId.trim()))
      throw new Error("Enter a valid order number.");
    return { idToken: input.idToken, orderId: input.orderId.trim() };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const snapshot = await getAdminDb().doc(`orders/${data.orderId}`).get();
    return {
      order: snapshot.exists
        ? (serialize({ id: snapshot.id, ...snapshot.data() }) as AdminDocument)
        : null,
    };
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const db = getAdminDb();
    const [
      games,
      products,
      accounts,
      orders,
      awaitingPaymentOrReview,
      deposits,
      pendingDeposits,
      users,
    ] = await Promise.all([
      db.collection("games").count().get(),
      db.collection("products").count().get(),
      db.collection("gameAccounts").count().get(),
      db.collection("orders").count().get(),
      db
        .collection("orders")
        .where("paymentStatus", "in", ["unpaid", "proof_submitted"])
        .count()
        .get(),
      db.collection("wallet_deposits").count().get(),
      db.collection("wallet_deposits").where("status", "==", "pending").count().get(),
      db.collection("users").count().get(),
    ]);
    return {
      games: games.data().count,
      products: products.data().count,
      accounts: accounts.data().count,
      orders: orders.data().count,
      awaitingPaymentOrReview: awaitingPaymentOrReview.data().count,
      deposits: deposits.data().count,
      pendingDeposits: pendingDeposits.data().count,
      users: users.data().count,
    };
  });

export const saveAdminRecord = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; collection?: unknown; record?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    if (
      input.collection !== "games" &&
      input.collection !== "products" &&
      input.collection !== "gameAccounts" &&
      input.collection !== "settings" &&
      input.collection !== "faqs"
    ) {
      throw new Error("Unsupported admin operation.");
    }
    return {
      idToken: input.idToken,
      collection: input.collection,
      record: input.record,
    };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getAdminDb();
    let collection: string;
    let id: string;
    let record: Record<string, unknown>;

    if (data.collection === "games") {
      const value = GameInput.parse(data.record);
      collection = "games";
      id = value.slug;
      record = value;
    } else if (data.collection === "products") {
      const value = ProductInput.parse(data.record);
      const game = await db.doc(`games/${value.gameSlug}`).get();
      if (!game.exists) throw new Error("Select an existing game from the catalog.");
      collection = "products";
      id = value.id;
      record = value;
    } else if (data.collection === "gameAccounts") {
      const value = AccountInput.parse(data.record);
      const game = await db.doc(`games/${value.gameId}`).get();
      if (!game.exists) throw new Error("Select an existing game from the catalog.");
      collection = "gameAccounts";
      id = value.id;
      record = value;
    } else if (data.collection === "settings") {
      const value = SettingsInput.parse(data.record);
      collection = "settings";
      id = "store";
      record = value;
    } else {
      const value = FaqInput.parse(data.record);
      collection = "settings";
      id = "faqs";
      record = value;
    }

    const ref = db.doc(`${collection}/${id}`);
    const existing = await ref.get();
    await ref.set(
      {
        ...record,
        ...(existing.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { id };
  });

const AdminPaymentMethodsInput = z
  .array(PaymentMethodInput)
  .length(2)
  .refine(
    (methods) => new Set(methods.map((method) => method.id)).size === 2,
    "Configure exactly one Wallet method and one eZ Cash method.",
  );

export const saveAdminPaymentMethods = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; methods?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken) {
      throw new Error("Missing authentication token.");
    }
    return {
      idToken: input.idToken,
      methods: AdminPaymentMethodsInput.parse(input.methods),
    };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    await getAdminDb().doc("settings/store").set(
      {
        paymentMethods: data.methods,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { success: true };
  });

export const archiveAdminRecord = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; collection?: unknown; id?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    if (
      input.collection !== "games" &&
      input.collection !== "products" &&
      input.collection !== "gameAccounts"
    ) {
      throw new Error("Only catalog records can be archived.");
    }
    if (typeof input.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(input.id)) {
      throw new Error("Invalid catalog record ID.");
    }
    return { idToken: input.idToken, collection: input.collection, id: input.id };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb } = await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const ref = getAdminDb().doc(`${data.collection}/${data.id}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("This catalog record no longer exists.");
    await ref.update({ active: false, updatedAt: FieldValue.serverTimestamp() });
    return { id: data.id, active: false };
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; pageToken?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    if (
      input.pageToken !== undefined &&
      (typeof input.pageToken !== "string" || input.pageToken.length > 1000)
    ) {
      throw new Error("Invalid page token.");
    }
    return { idToken: input.idToken, pageToken: input.pageToken as string | undefined };
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.idToken);
    const { getAdminAuth, getAdminDb } = await import("@/server/firebase-admin");
    const [authUsers, allowedUids] = await Promise.all([
      getAdminAuth().listUsers(100, data.pageToken),
      Promise.resolve(
        (process.env["ADMIN_UIDS"] ?? "")
          .split(",")
          .map((uid) => uid.trim())
          .filter(Boolean),
      ),
    ]);
    const profileRefs = authUsers.users.map((user) => getAdminDb().doc(`users/${user.uid}`));
    const profiles = profileRefs.length ? await getAdminDb().getAll(...profileRefs) : [];
    return {
      users: authUsers.users.map((user, index) => {
        const profile = profiles[index]?.data();
        const walletBalanceLkr =
          typeof profile?.["walletBalanceLkr"] === "number" ? profile["walletBalanceLkr"] : 0;
        return {
          uid: user.uid,
          memberId: profile?.["memberId"] ?? null,
          walletBalanceLkr,
          email: user.email ?? "",
          displayName: profile?.["displayName"] ?? user.displayName ?? "",
          disabled: user.disabled,
          createdAt: Date.parse(user.metadata.creationTime),
          isAdmin: allowedUids.includes(user.uid),
          isCurrentAdmin: user.uid === admin.uid,
          providers: [...new Set(user.providerData.map((provider) => provider.providerId))],
          photoUrl:
            user.providerData.find((provider) => provider.providerId === "google.com")?.photoURL ??
            user.photoURL ??
            null,
        };
      }),
      nextPageToken: authUsers.pageToken ?? null,
    };
  });

export const searchAdminUser = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; userId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Missing authentication token.");
    if (
      typeof input.userId !== "string" ||
      !input.userId.trim() ||
      input.userId.trim().length > 128
    )
      throw new Error("Enter a valid customer UID or HASA member ID.");
    return { idToken: input.idToken, userId: input.userId.trim() };
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.idToken);
    const { getAdminAuth, getAdminDb } = await import("@/server/firebase-admin");
    const auth = getAdminAuth();
    const db = getAdminDb();
    let uid = data.userId;

    const memberIdSnapshot = await db.doc(`member_ids/${data.userId.toUpperCase()}`).get();
    if (memberIdSnapshot.exists) {
      const memberUid = memberIdSnapshot.get("uid");
      if (typeof memberUid === "string") uid = memberUid;
    } else {
      const profileMatch = await db
        .collection("users")
        .where("memberId", "==", data.userId.toUpperCase())
        .limit(1)
        .get();
      if (!profileMatch.empty) uid = profileMatch.docs[0]!.id;
    }

    let authUser;
    try {
      authUser = await auth.getUser(uid);
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "auth/user-not-found"
      ) {
        return { user: null };
      }
      throw error;
    }
    const profile = (await db.doc(`users/${uid}`).get()).data();
    const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return {
      user: {
        uid: authUser.uid,
        memberId: typeof profile?.["memberId"] === "string" ? profile["memberId"] : null,
        walletBalanceLkr:
          typeof profile?.["walletBalanceLkr"] === "number" ? profile["walletBalanceLkr"] : 0,
        email: authUser.email ?? "",
        displayName:
          typeof profile?.["displayName"] === "string"
            ? profile["displayName"]
            : (authUser.displayName ?? ""),
        disabled: authUser.disabled,
        createdAt: Date.parse(authUser.metadata.creationTime),
        isAdmin: allowedUids.includes(authUser.uid),
        isCurrentAdmin: authUser.uid === admin.uid,
        providers: [...new Set(authUser.providerData.map((provider) => provider.providerId))],
        photoUrl:
          authUser.providerData.find((provider) => provider.providerId === "google.com")
            ?.photoURL ??
          authUser.photoURL ??
          null,
      },
    };
  });

export const setAdminUserDisabled = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; uid?: unknown; disabled?: unknown };
    if (typeof input?.idToken !== "string") throw new Error("Missing authentication token.");
    if (typeof input.uid !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.uid))
      throw new Error("Invalid user ID.");
    if (typeof input.disabled !== "boolean") throw new Error("Choose an account status.");
    return { idToken: input.idToken, uid: input.uid, disabled: input.disabled };
  })
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.idToken);
    if (data.uid === admin.uid)
      throw new Error("You cannot disable your own administrator account.");
    const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean);
    if (allowedUids.includes(data.uid))
      throw new Error("Administrator accounts cannot be disabled from user management.");
    const { getAdminAuth } = await import("@/server/firebase-admin");
    const auth = getAdminAuth();
    await auth.updateUser(data.uid, { disabled: data.disabled });
    if (data.disabled) await auth.revokeRefreshTokens(data.uid);
    return { uid: data.uid, disabled: data.disabled };
  });

const AdminWalletAdjustmentInput = z.object({
  idToken: z.string().min(1),
  uid: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
  direction: z.enum(["credit", "deduct"]),
  amountLkr: z.number().int().min(1).max(10_000_000),
  reason: z.string().trim().min(3).max(500),
});

export const adjustAdminUserWallet = createServerFn({ method: "POST" })
  .validator((raw: unknown) => AdminWalletAdjustmentInput.parse(raw))
  .handler(async ({ data }) => {
    const admin = await requireAdmin(data.idToken);
    const { getAdminAuth, getAdminDb } = await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const db = getAdminDb();
    await getAdminAuth().getUser(data.uid);

    const userRef = db.doc(`users/${data.uid}`);
    const adjustmentRef = db.collection("wallet_adjustments").doc();
    const amountLkr = data.direction === "credit" ? data.amountLkr : -data.amountLkr;

    const balanceAfter = await db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) {
        throw new Error("This customer does not have a wallet profile yet.");
      }

      const currentBalance = userSnapshot.data()?.["walletBalanceLkr"] ?? 0;
      if (
        typeof currentBalance !== "number" ||
        !Number.isFinite(currentBalance) ||
        currentBalance < 0
      ) {
        throw new Error("The customer's wallet balance is invalid.");
      }

      const nextBalance = currentBalance + amountLkr;
      if (nextBalance < 0) {
        throw new Error("The deduction exceeds the customer's available balance.");
      }

      transaction.update(userRef, {
        walletBalanceLkr: nextBalance,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(adjustmentRef, {
        adjustmentId: adjustmentRef.id,
        uid: data.uid,
        amountLkr,
        reason: data.reason,
        adminUid: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      return nextBalance;
    });

    return { uid: data.uid, adjustmentId: adjustmentRef.id, balanceLkr: balanceAfter };
  });

const OrderStatusInput = z.enum([
  "pending",
  "payment_review",
  "paid",
  "processing",
  "completed",
  "delivered",
  "failed",
  "cancelled",
  "refunded",
]);
const PaymentStatusInput = z.enum([
  "unpaid",
  "proof_submitted",
  "paid",
  "failed",
  "proof_rejected",
  "refunded",
]);

export const updateAdminOrderStatus = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        idToken: z.string().min(1),
        orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
        status: OrderStatusInput,
        paymentStatus: PaymentStatusInput,
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    if (
      (["paid", "processing", "completed", "delivered"].includes(data.status) &&
        data.paymentStatus !== "paid") ||
      (data.status === "refunded") !== (data.paymentStatus === "refunded") ||
      (data.status === "payment_review") !== (data.paymentStatus === "proof_submitted")
    ) {
      throw new Error("Choose matching order and payment statuses.");
    }
    const { getAdminDb } = await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const orderRef = getAdminDb().doc(`orders/${data.orderId}`);
    const order = await orderRef.get();
    const record = order.data();
    if (!order.exists || !record) throw new Error("This order no longer exists.");
    await orderRef.update({
      status: data.status,
      paymentStatus: data.paymentStatus,
      updatedAt: FieldValue.serverTimestamp(),
    });
    let nexauraSubmission: { status: string; orderId?: string; message?: string } | undefined;
    if (
      record["gameSlug"] === "free-fire" &&
      data.paymentStatus === "paid" &&
      ["paid", "processing", "completed", "delivered"].includes(data.status)
    ) {
      const { submitFreeFireTopup } = await import("@/server/nexaura-topups");
      nexauraSubmission = await submitFreeFireTopup(data.orderId);
    }
    const statusChanged =
      record["status"] !== data.status || record["paymentStatus"] !== data.paymentStatus;
    let emailNotificationSent = false;
    if (statusChanged) {
      try {
        let customerEmail =
          typeof record["customerEmail"] === "string" ? record["customerEmail"].trim() : "";
        if (!customerEmail && typeof record["customerUid"] === "string") {
          const { getAdminAuth } = await import("@/server/firebase-admin");
          customerEmail = (await getAdminAuth().getUser(record["customerUid"])).email ?? "";
        }
        if (!customerEmail) throw new Error("The customer email address is unavailable.");
        const { sendOrderStatusUpdateEmail } = await import("@/server/resend-email");
        await sendOrderStatusUpdateEmail({
          to: customerEmail,
          orderId: data.orderId,
          gameSlug: typeof record["gameSlug"] === "string" ? record["gameSlug"] : "",
          gameName: typeof record["gameName"] === "string" ? record["gameName"] : "Game order",
          packageName:
            typeof record["packageName"] === "string" ? record["packageName"] : "Package",
          totalLkr: typeof record["pricePkr"] === "number" ? record["pricePkr"] : 0,
          status: data.status,
          paymentStatus: data.paymentStatus,
        });
        emailNotificationSent = true;
      } catch (error) {
        console.error("Order status was updated, but its customer email could not be sent:", {
          orderId: data.orderId,
          error,
        });
      }
    }
    return {
      orderId: data.orderId,
      status: data.status,
      paymentStatus: data.paymentStatus,
      emailNotificationSent,
      emailNotificationAttempted: statusChanged,
      nexauraSubmission,
    };
  });

export const getAdminOrderProofUrl = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in with an administrator account.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    await requireAdmin(data.idToken);
    const { getAdminDb, getAdminStorage } = await import("@/server/firebase-admin");
    const order = await getAdminDb().doc(`orders/${data.orderId}`).get();
    const record = order.data();
    if (!order.exists || !record || record["paymentMethod"] !== "ezcash")
      throw new Error("This order has no eZ Cash payment proof.");
    const uid = record["customerUid"];
    const storagePath = record["paymentProofStoragePath"];
    if (typeof uid !== "string" || typeof storagePath !== "string") {
      throw new Error("This order has no valid payment proof.");
    }
    if (record["paymentProofStorageProvider"] === "supabase") {
      if (storagePath !== `${uid}/${data.orderId}/proof`)
        throw new Error("This order has no valid payment proof.");
      const { createProofViewUrl } = await import("@/server/supabase-storage");
      return { url: await createProofViewUrl(storagePath) };
    }
    if (storagePath !== `payment-proofs/${uid}/${data.orderId}/proof`)
      throw new Error("This order has no valid payment proof.");
    const [url] = await getAdminStorage()
      .bucket()
      .file(storagePath)
      .getSignedUrl({ action: "read", expires: Date.now() + 5 * 60_000 });
    return { url };
  });
