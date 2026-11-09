/**
 * Admin routes — all require Bearer token + ADMIN_UIDS check.
 *
 * GET    /v1/admin/overview
 * GET    /v1/admin/:collection          (games, products, gameAccounts, orders, wallet_deposits)
 * POST   /v1/admin/:collection/:id      (upsert game/product/account/settings/faqs)
 * POST   /v1/admin/catalog/:id/archive  (set active=false)
 * GET    /v1/admin/users
 * GET    /v1/admin/users/search?q=
 * POST   /v1/admin/users/:uid/disabled
 * POST   /v1/admin/users/:uid/wallet
 * GET    /v1/admin/orders/search?q=
 * POST   /v1/admin/orders/:orderId/status
 * GET    /v1/admin/orders/:orderId/proof
 * POST   /v1/admin/topup-failures       (nexaura failure list)
 */
import { z } from "zod";
import { ApiError, asyncRoute } from "./errors.js";
import { getAdminAuth } from "./firebase.js";
import { db } from "./db.js";
import {
  mapGame,
  mapProduct,
  mapGameAccount,
  mapOrder,
  mapWalletDeposit,
  mapUser,
  mapStoreSettings,
  toNum,
  toMs,
} from "./serialize.js";
import { submitFreeFireTopup } from "./topups.js";
import { genId } from "./ids.js";
import { renderOrderStatusEmail } from "./email-templates.js";

// ─── Supabase helpers (optional — only used for proof URLs) ──────────────────
async function createProofViewUrl(storagePath) {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "payment-proofs";
  if (!url || !key)
    throw new ApiError(503, "File storage is not configured.", "storage_unconfigured");
  const res = await fetch(`${url}/storage/v1/object/sign/${bucket}/${storagePath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok)
    throw new ApiError(
      502,
      "Could not create a signed URL for the payment proof.",
      "storage_error",
    );
  const body = await res.json();
  const relUrl = body.signedURL ?? body.url;
  if (!relUrl) throw new ApiError(502, "Storage returned an empty signed URL.", "storage_error");
  return relUrl.startsWith("http") ? relUrl : `${url}/storage/v1${relUrl}`;
}

// ─── Resend email ────────────────────────────────────────────────────────────
async function sendOrderStatusUpdateEmail({
  to,
  orderId,
  gameSlug,
  gameName,
  packageName,
  totalLkr,
  status,
  paymentStatus,
}) {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return; // email optional — don't block admin operations

  // Render the same branded shell the Vercel-side order emails use. Sending
  // bare text here is what made admin-driven status updates look plain while
  // checkout emails looked styled.
  const message = renderOrderStatusEmail({
    to,
    orderId,
    gameSlug,
    gameName,
    packageName,
    totalLkr,
    status,
    paymentStatus,
    supportUrl: "https://hasagold.store",
  });

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "HASA GOLD STORE <no-reply@hasagold.store>",
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch (error) {
    // Transport failure (DNS, timeout, TLS). Surface it instead of treating the
    // send as successful.
    console.error("Order status email transport failed:", orderId, error?.message || error);
    throw error;
  }

  if (!response.ok) {
    // A 4xx/5xx from Resend resolves the promise, so `.catch()` never fires.
    // Without this check a rejected send was silently counted as delivered.
    const details = await response.text().catch(() => "");
    console.error(
      "Order status email rejected:",
      orderId,
      response.status,
      details.slice(0, 500),
    );
    throw new Error(`Resend rejected the order status email with status ${response.status}.`);
  }

  console.log("Order status email sent:", orderId, "resend_id=" + ((await response.json().catch(() => ({}))).id ?? "unknown"));
}

// ─── Schemas ─────────────────────────────────────────────────────────────────
const GameInput = z.strictObject({
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
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  description: z.string().trim().max(1000),
  serverOptions: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

const ProductInput = z.strictObject({
  id: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  gameSlug: z.string().trim().min(1).max(80),
  nexauraProductId: z.string().trim().max(100).optional(),
  category: z
    .enum(["diamonds", "memberships", "level-up-passes", "evo-access", "gold", "passes", "uc"])
    .default("diamonds"),
  amount: z.number().positive().finite(),
  unitLabel: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(100),
  imageUrl: z.string().trim().max(1000).optional().nullable(),
  priceUsd: z.number().min(0).finite(),
  pricePkr: z.number().min(0).finite(),
  bonus: z.number().min(0).finite(),
  isPopular: z.boolean(),
  isBestValue: z.boolean(),
  isVip: z.boolean(),
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100000),
});

const AccountInput = z.strictObject({
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
  id: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Use lowercase letters, numbers, dashes or underscores."),
  name: z.string().trim().min(1).max(100),
  sub: z.string().trim().max(200),
  short: z.string().trim().max(10),
  active: z.boolean(),
  kind: z.enum(["wallet", "manual"]).optional(),
  logoUrl: z.string().url().max(1000).optional().nullable(),
  accountName: z.string().trim().max(100).optional().nullable(),
  accountNumber: z.string().trim().max(100).optional().nullable(),
  requiresProof: z.boolean().optional(),
  games: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  // Optional per-method warning banner shown at checkout (e.g. "add LKR 20 fee").
  warningEnabled: z.boolean().optional(),
  warningTitle: z.string().trim().max(120).optional().nullable(),
  warningMessage: z.string().trim().max(600).optional().nullable(),
});

function normalizePaymentMethods(methods) {
  return methods.map((method) => ({
    ...method,
    // Only the built-in wallet id may act as a wallet; everything else is manual.
    kind: method.id === "wallet" ? "wallet" : "manual",
    // Wallet never needs a receipt. Manual methods default to requiring one so
    // rows saved before this flag existed keep their current behaviour.
    requiresProof: method.id === "wallet" ? false : method.requiresProof !== false,
    // Wallet never shows a warning banner; other methods only when enabled.
    warningEnabled: method.id === "wallet" ? false : method.warningEnabled === true,
    warningTitle: method.id === "wallet" ? null : method.warningTitle ?? null,
    warningMessage: method.id === "wallet" ? null : method.warningMessage ?? null,
  }));
}

const SettingsInput = z.object({
  storeName: z.string().trim().min(1).max(100),
  tagline: z.string().trim().max(200),
  supportEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
  supportWhatsapp: z.string().trim().max(40),
  paymentEzcashNumber: z.string().trim().max(40),
  paymentEzcashName: z.string().trim().max(100),
  currency: z.literal("LKR"),
  bannerEnabled: z.boolean(),
  maintenanceMode: z.boolean(),
  maintenanceTitle: z.string().trim().max(120).optional(),
  maintenanceMessage: z.string().trim().max(1000).optional(),
  paymentMethods: z.array(PaymentMethodInput).optional(),
});

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

const WalletAdjustmentInput = z.object({
  direction: z.enum(["credit", "deduct"]),
  amountLkr: z.number().int().min(1).max(10_000_000),
  reason: z.string().trim().min(3).max(500),
});

// ─── Overview ────────────────────────────────────────────────────────────────
export const getOverview = asyncRoute(async (_req, res) => {
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
    db.query("SELECT count(*) AS cnt FROM games"),
    db.query("SELECT count(*) AS cnt FROM products"),
    db.query("SELECT count(*) AS cnt FROM game_accounts"),
    db.query("SELECT count(*) AS cnt FROM orders"),
    db.query(
      "SELECT count(*) AS cnt FROM orders WHERE payment_status IN ('unpaid', 'proof_submitted')",
    ),
    db.query("SELECT count(*) AS cnt FROM wallet_deposits"),
    db.query("SELECT count(*) AS cnt FROM wallet_deposits WHERE status = 'pending'"),
    db.query("SELECT count(*) AS cnt FROM users"),
  ]);
  const toCount = (r) => Number(r.rows[0]?.cnt);
  res.json({
    games: toCount(games),
    products: toCount(products),
    accounts: toCount(accounts),
    orders: toCount(orders),
    awaitingPaymentOrReview: toCount(awaitingPaymentOrReview),
    deposits: toCount(deposits),
    pendingDeposits: toCount(pendingDeposits),
    users: toCount(users),
  });
});

// ─── List collection ─────────────────────────────────────────────────────────
const VALID_ADMIN_COLLECTIONS = new Set([
  "games",
  "products",
  "gameAccounts",
  "orders",
  "wallet_deposits",
]);

const COLLECTION_TABLE = {
  games: "games",
  products: "products",
  gameAccounts: "game_accounts",
  orders: "orders",
  wallet_deposits: "wallet_deposits",
};

const COLLECTION_ID_COLUMN = {
  games: "slug",
  products: "id",
  gameAccounts: "id",
  orders: "order_id",
  wallet_deposits: "deposit_id",
};

export const listCollection = asyncRoute(async (req, res) => {
  const collectionName = req.params.collection;
  if (!VALID_ADMIN_COLLECTIONS.has(collectionName)) {
    throw new ApiError(400, "Unsupported admin collection.", "invalid_collection");
  }
  const table = COLLECTION_TABLE[collectionName];
  const idColumn = COLLECTION_ID_COLUMN[collectionName];
  const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;
  const isDesc = ["orders", "wallet_deposits"].includes(collectionName);

  let cursor;
  if (pageToken) {
    try {
      cursor = JSON.parse(Buffer.from(pageToken, "base64url").toString("utf8"));
      if (
        typeof cursor.id !== "string" ||
        typeof cursor.value !== "number" ||
        !Number.isFinite(cursor.value)
      ) {
        throw new Error("bad cursor");
      }
    } catch {
      throw new ApiError(400, "Invalid page token.", "invalid_page_token");
    }
  }

  const pageSize = 100;
  let rows;
  if (isDesc) {
    if (cursor) {
      const result = await db.query(
        `SELECT * FROM ${table}
         WHERE (created_at < to_timestamp($1 / 1000.0))
            OR (created_at = to_timestamp($1 / 1000.0) AND ${idColumn} < $2)
         ORDER BY created_at DESC, ${idColumn} DESC
         LIMIT $3`,
        [cursor.value, cursor.id, pageSize],
      );
      rows = result.rows;
    } else {
      const result = await db.query(
        `SELECT * FROM ${table}
         ORDER BY created_at DESC, ${idColumn} DESC
         LIMIT $1`,
        [pageSize],
      );
      rows = result.rows;
    }
  } else {
    if (cursor) {
      const result = await db.query(
        `SELECT * FROM ${table}
         WHERE (display_order > $1)
            OR (display_order = $1 AND ${idColumn} > $2)
         ORDER BY display_order ASC, ${idColumn} ASC
         LIMIT $3`,
        [cursor.value, cursor.id, pageSize],
      );
      rows = result.rows;
    } else {
      const result = await db.query(
        `SELECT * FROM ${table}
         ORDER BY display_order ASC, ${idColumn} ASC
         LIMIT $1`,
        [pageSize],
      );
      rows = result.rows;
    }
  }

  const last = rows[rows.length - 1];
  let lastSortValue = 0;
  let lastId = "";
  if (last) {
    lastSortValue = isDesc ? toMs(last.created_at) : Number(last.display_order);
    lastId = last[idColumn];
  }

  // Enrich wallet_deposits with customer member IDs
  const memberIdsByUid = new Map();
  if (collectionName === "wallet_deposits" && rows.length) {
    const customerUids = [
      ...new Set(rows.map((r) => r.uid).filter((uid) => typeof uid === "string" && uid.length > 0)),
    ];
    if (customerUids.length) {
      const profiles = await db.query(`SELECT uid, member_id FROM users WHERE uid = ANY($1)`, [
        customerUids,
      ]);
      for (const profile of profiles.rows) {
        if (typeof profile.member_id === "string") {
          memberIdsByUid.set(profile.uid, profile.member_id);
        }
      }
    }
  }

  const nextPageToken =
    rows.length === pageSize && last
      ? Buffer.from(
          JSON.stringify({
            id: lastId,
            value: lastSortValue,
          }),
        ).toString("base64url")
      : null;

  res.json({
    items: rows.map((row) => {
      let record;
      if (collectionName === "games") {
        record = mapGame(row);
      } else if (collectionName === "products") {
        record = mapProduct(row);
      } else if (collectionName === "gameAccounts") {
        record = mapGameAccount(row);
      } else if (collectionName === "orders") {
        record = mapOrder(row);
      } else {
        record = mapWalletDeposit(row);
      }
      if (collectionName === "wallet_deposits") {
        const uid = row.uid;
        record.customerMemberId =
          typeof uid === "string" ? (memberIdsByUid.get(uid) ?? null) : null;
      }
      return record;
    }),
    nextPageToken,
  });
});

// ─── Save catalog/settings record ────────────────────────────────────────────
export const saveRecord = asyncRoute(async (req, res) => {
  const collection = req.params.collection;
  if (!["games", "products", "gameAccounts", "settings", "faqs"].includes(collection)) {
    throw new ApiError(400, "Unsupported admin operation.", "invalid_collection");
  }

  if (collection === "games") {
    const value = GameInput.safeParse(req.body);
    if (!value.success) throw new ApiError(400, "Game record is invalid.", "invalid_input");
    const d = value.data;
    await db.query(
      `INSERT INTO games (slug, name, currency, tone, icon, artwork_key, image_url, description, server_options, active, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name, currency = EXCLUDED.currency, tone = EXCLUDED.tone,
         icon = EXCLUDED.icon, artwork_key = EXCLUDED.artwork_key, image_url = EXCLUDED.image_url,
         description = EXCLUDED.description, server_options = EXCLUDED.server_options,
         active = EXCLUDED.active, display_order = EXCLUDED.display_order, updated_at = now()`,
      [
        d.slug,
        d.name,
        d.currency,
        d.tone,
        d.icon,
        d.artworkKey,
        d.imageUrl ?? null,
        d.description,
        d.serverOptions,
        d.active,
        d.displayOrder,
      ],
    );
    res.json({ id: d.slug });
    return;
  }

  if (collection === "products") {
    const value = ProductInput.safeParse(req.body);
    if (!value.success) throw new ApiError(400, "Product record is invalid.", "invalid_input");
    const d = value.data;
    const game = await db.query("SELECT 1 FROM games WHERE slug = $1", [d.gameSlug]);
    if (game.rows.length === 0)
      throw new ApiError(400, "Select an existing game from the catalog.", "game_not_found");
    await db.query(
      `INSERT INTO products (id, game_slug, nexaura_product_id, category, amount, unit_label, name, image_url, price_usd, price_pkr, bonus, is_popular, is_best_value, is_vip, active, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16, now())
       ON CONFLICT (id) DO UPDATE SET
         game_slug = EXCLUDED.game_slug, nexaura_product_id = EXCLUDED.nexaura_product_id, category = EXCLUDED.category,
         amount = EXCLUDED.amount, unit_label = EXCLUDED.unit_label, name = EXCLUDED.name, image_url = EXCLUDED.image_url,
         price_usd = EXCLUDED.price_usd, price_pkr = EXCLUDED.price_pkr, bonus = EXCLUDED.bonus,
         is_popular = EXCLUDED.is_popular, is_best_value = EXCLUDED.is_best_value, is_vip = EXCLUDED.is_vip,
         active = EXCLUDED.active, display_order = EXCLUDED.display_order, updated_at = now()`,
      [
        d.id,
        d.gameSlug,
        d.nexauraProductId ?? null,
        d.category,
        d.amount,
        d.unitLabel,
        d.name,
        d.imageUrl ?? null,
        d.priceUsd,
        d.pricePkr,
        d.bonus,
        d.isPopular,
        d.isBestValue,
        d.isVip,
        d.active,
        d.displayOrder,
      ],
    );
    res.json({ id: d.id });
    return;
  }

  if (collection === "gameAccounts") {
    const value = AccountInput.safeParse(req.body);
    if (!value.success) throw new ApiError(400, "Account record is invalid.", "invalid_input");
    const d = value.data;
    const game = await db.query("SELECT 1 FROM games WHERE slug = $1", [d.gameId]);
    if (game.rows.length === 0)
      throw new ApiError(400, "Select an existing game from the catalog.", "game_not_found");
    await db.query(
      `INSERT INTO game_accounts (id, game_id, game_name, title, tagline, price_usd, price_pkr, price_sample, level, rank, server, login_type, artwork_key, tone, verified, status, badges, inventory_highlights, description, features, active, display_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,now())
       ON CONFLICT (id) DO UPDATE SET
         game_id = EXCLUDED.game_id, game_name = EXCLUDED.game_name, title = EXCLUDED.title, tagline = EXCLUDED.tagline,
         price_usd = EXCLUDED.price_usd, price_pkr = EXCLUDED.price_pkr, price_sample = EXCLUDED.price_sample,
         level = EXCLUDED.level, rank = EXCLUDED.rank, server = EXCLUDED.server, login_type = EXCLUDED.login_type,
         artwork_key = EXCLUDED.artwork_key, tone = EXCLUDED.tone, verified = EXCLUDED.verified, status = EXCLUDED.status,
         badges = EXCLUDED.badges, inventory_highlights = EXCLUDED.inventory_highlights, description = EXCLUDED.description,
         features = EXCLUDED.features, active = EXCLUDED.active, display_order = EXCLUDED.display_order, updated_at = now()`,
      [
        d.id,
        d.gameId,
        d.gameName,
        d.title,
        d.tagline,
        d.priceUsd,
        d.pricePkr,
        d.priceSample,
        d.level,
        d.rank,
        d.server,
        d.loginType,
        d.artworkKey,
        d.tone,
        d.verified,
        d.status,
        d.badges,
        d.inventoryHighlights,
        d.description,
        d.features,
        d.active,
        d.displayOrder,
      ],
    );
    res.json({ id: d.id });
    return;
  }

  if (collection === "settings") {
    const value = SettingsInput.safeParse(req.body);
    if (!value.success) throw new ApiError(400, "Store settings are invalid.", "invalid_input");
    const d = value.data;
    if (Boolean(d.paymentEzcashNumber) !== Boolean(d.paymentEzcashName)) {
      throw new ApiError(
        400,
        "Set both the eZ Cash number and account name, or leave both blank.",
        "invalid_input",
      );
    }
    if (
      d.paymentMethods &&
      (d.paymentMethods.length < 1 ||
        new Set(d.paymentMethods.map((m) => m.id)).size !== d.paymentMethods.length)
    ) {
      throw new ApiError(400, "Payment method IDs must be unique and non-empty.", "invalid_input");
    }
    await db.query(
      `INSERT INTO store_settings (id, store_name, tagline, support_email, support_whatsapp, payment_ezcash_number, payment_ezcash_name, currency, banner_enabled, maintenance_mode, maintenance_title, maintenance_message, payment_methods, updated_at)
       VALUES (1,$1,$2,$3,$4,$5,$6,'LKR',$7,$8,$9,$10,COALESCE($11::jsonb,'[]'::jsonb),now())
       ON CONFLICT (id) DO UPDATE SET
         store_name = EXCLUDED.store_name, tagline = EXCLUDED.tagline, support_email = EXCLUDED.support_email,
         support_whatsapp = EXCLUDED.support_whatsapp, payment_ezcash_number = EXCLUDED.payment_ezcash_number,
         payment_ezcash_name = EXCLUDED.payment_ezcash_name, banner_enabled = EXCLUDED.banner_enabled,
         maintenance_mode = EXCLUDED.maintenance_mode, maintenance_title = EXCLUDED.maintenance_title,
         maintenance_message = EXCLUDED.maintenance_message,
         payment_methods = COALESCE($11::jsonb, store_settings.payment_methods), updated_at = now()`,
      [
        d.storeName,
        d.tagline,
        d.supportEmail ?? null,
        d.supportWhatsapp ?? null,
        d.paymentEzcashNumber ?? null,
        d.paymentEzcashName ?? null,
        d.bannerEnabled,
        d.maintenanceMode,
        d.maintenanceTitle ?? null,
        d.maintenanceMessage ?? null,
        d.paymentMethods ? JSON.stringify(normalizePaymentMethods(d.paymentMethods)) : null,
      ],
    );
    res.json({ id: 1 });
    return;
  }

  // faqs
  const value = FaqInput.safeParse(req.body);
  if (!value.success) throw new ApiError(400, "FAQ record is invalid.", "invalid_input");
  const d = value.data;
  await db.query(
    `INSERT INTO faqs (id, items, updated_at)
     VALUES (1,$1,now())
     ON CONFLICT (id) DO UPDATE SET items = EXCLUDED.items, updated_at = now()`,
    [JSON.stringify(d.items)],
  );
  res.json({ id: 1 });
});

// ─── Archive catalog record ───────────────────────────────────────────────────
const ARCHIVE_TABLE = {
  games: "games",
  products: "products",
  gameAccounts: "game_accounts",
};

export const archiveRecord = asyncRoute(async (req, res) => {
  const collection = req.params.collection;
  const id = req.params.id;
  if (!["games", "products", "gameAccounts"].includes(collection)) {
    throw new ApiError(400, "Only catalog records can be archived.", "invalid_collection");
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(id))
    throw new ApiError(400, "Invalid catalog record ID.", "invalid_id");
  const table = ARCHIVE_TABLE[collection];
  const idColumn = collection === "games" ? "slug" : "id";
  const result = await db.query(
    `UPDATE ${table} SET active = false, updated_at = now() WHERE ${idColumn} = $1`,
    [id],
  );
  if (result.rowCount === 0)
    throw new ApiError(404, "This catalog record no longer exists.", "not_found");
  res.json({ id, active: false });
});

// ─── Users ───────────────────────────────────────────────────────────────────
export const listUsers = asyncRoute(async (req, res) => {
  const pageToken = typeof req.query.pageToken === "string" ? req.query.pageToken : undefined;
  const auth = getAdminAuth();
  const allowedUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const authUsers = await auth.listUsers(50, pageToken); // reduced from 100

  const profileMap = new Map();
  if (authUsers.users.length) {
    const uids = authUsers.users.map((u) => u.uid);
    const profiles = await db.query(
      `SELECT uid, member_id, wallet_balance_lkr, display_name FROM users WHERE uid = ANY($1)`,
      [uids],
    );
    for (const p of profiles.rows) {
      profileMap.set(p.uid, {
        memberId: p.member_id ?? null,
        walletBalanceLkr: toNum(p.wallet_balance_lkr) ?? 0,
        displayName: p.display_name ?? null,
      });
    }
  }

  res.json({
    users: authUsers.users.map((user) => {
      const profile = profileMap.get(user.uid);
      return {
        uid: user.uid,
        memberId: profile?.memberId ?? null,
        walletBalanceLkr: profile?.walletBalanceLkr ?? 0,
        email: user.email ?? "",
        displayName: profile?.displayName ?? user.displayName ?? "",
        disabled: user.disabled,
        createdAt: Date.parse(user.metadata.creationTime),
        isAdmin: allowedUids.includes(user.uid),
        isCurrentAdmin: user.uid === req.user.uid,
        providers: [...new Set(user.providerData.map((p) => p.providerId))],
        photoUrl:
          user.providerData.find((p) => p.providerId === "google.com")?.photoURL ??
          user.photoURL ??
          null,
      };
    }),
    nextPageToken: authUsers.pageToken ?? null,
  });
});

export const searchUser = asyncRoute(async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q || q.length > 128)
    throw new ApiError(400, "Enter a valid customer UID or HASA member ID.", "invalid_query");
  const auth = getAdminAuth();
  const allowedUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);

  let uid = q;
  const memberRow = await db.query("SELECT uid FROM member_ids WHERE member_id = $1", [
    q.toUpperCase(),
  ]);
  if (memberRow.rows.length > 0) {
    uid = memberRow.rows[0].uid;
  } else {
    const profileRow = await db.query("SELECT uid FROM users WHERE member_id = $1 LIMIT 1", [
      q.toUpperCase(),
    ]);
    if (profileRow.rows.length > 0) uid = profileRow.rows[0].uid;
  }

  let authUser;
  try {
    authUser = await auth.getUser(uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return res.json({ user: null });
    throw error;
  }
  const profileRow = await db.query(
    "SELECT member_id, wallet_balance_lkr, display_name FROM users WHERE uid = $1",
    [uid],
  );
  const profile = profileRow.rows[0];
  res.json({
    user: {
      uid: authUser.uid,
      memberId: typeof profile?.member_id === "string" ? profile.member_id : null,
      walletBalanceLkr: toNum(profile?.wallet_balance_lkr) ?? 0,
      email: authUser.email ?? "",
      displayName:
        typeof profile?.display_name === "string"
          ? profile.display_name
          : (authUser.displayName ?? ""),
      disabled: authUser.disabled,
      createdAt: Date.parse(authUser.metadata.creationTime),
      isAdmin: allowedUids.includes(authUser.uid),
      isCurrentAdmin: authUser.uid === req.user.uid,
      providers: [...new Set(authUser.providerData.map((p) => p.providerId))],
      photoUrl:
        authUser.providerData.find((p) => p.providerId === "google.com")?.photoURL ??
        authUser.photoURL ??
        null,
    },
  });
});

export const setUserDisabled = asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    throw new ApiError(400, "Invalid user ID.", "invalid_uid");
  const body = req.body;
  if (typeof body?.disabled !== "boolean")
    throw new ApiError(400, "Choose an account status.", "invalid_input");
  if (uid === req.user.uid)
    throw new ApiError(409, "You cannot disable your own administrator account.", "self_disable");
  const allowedUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (allowedUids.includes(uid))
    throw new ApiError(
      409,
      "Administrator accounts cannot be disabled from user management.",
      "admin_disable",
    );
  const auth = getAdminAuth();
  await auth.updateUser(uid, { disabled: body.disabled });
  if (body.disabled) await auth.revokeRefreshTokens(uid);
  res.json({ uid, disabled: body.disabled });
});

export const adjustUserWallet = asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))
    throw new ApiError(400, "Invalid user ID.", "invalid_uid");
  const parsed = WalletAdjustmentInput.safeParse(req.body);
  if (!parsed.success)
    throw new ApiError(400, "Wallet adjustment data is invalid.", "invalid_input");
  const { direction, amountLkr, reason } = parsed.data;

  const auth = getAdminAuth();
  await auth.getUser(uid);

  const adjustmentId = genId();
  const delta = direction === "credit" ? amountLkr : -amountLkr;

  const balanceAfter = await db.transaction(async (tx) => {
    const userRes = await tx.query(
      "SELECT wallet_balance_lkr FROM users WHERE uid = $1 FOR UPDATE",
      [uid],
    );
    if (userRes.rows.length === 0)
      throw new ApiError(
        404,
        "This customer does not have a wallet profile yet.",
        "profile_missing",
      );
    const currentBalance = toNum(userRes.rows[0].wallet_balance_lkr) ?? 0;
    if (!Number.isFinite(currentBalance) || currentBalance < 0) {
      throw new ApiError(500, "The customer's wallet balance is invalid.", "invalid_balance");
    }
    const nextBalance = currentBalance + delta;
    if (nextBalance < 0)
      throw new ApiError(
        409,
        "The deduction exceeds the customer's available balance.",
        "insufficient_funds",
      );
    await tx.query("UPDATE users SET wallet_balance_lkr = $1, updated_at = now() WHERE uid = $2", [
      nextBalance,
      uid,
    ]);
    await tx.query(
      `INSERT INTO wallet_adjustments (adjustment_id, uid, amount_lkr, reason, admin_uid, created_at)
       VALUES ($1,$2,$3,$4,$5,now())`,
      [adjustmentId, uid, delta, reason, req.user.uid],
    );
    return nextBalance;
  });
  res.json({ uid, adjustmentId, balanceLkr: balanceAfter });
});

// ─── Orders (admin) ───────────────────────────────────────────────────────────
export const searchOrder = asyncRoute(async (req, res) => {
  const orderId = String(req.query.q ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(orderId))
    throw new ApiError(400, "Enter a valid order number.", "invalid_order_id");
  const result = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (result.rows.length === 0) return res.json({ order: null });
  res.json({ order: mapOrder(result.rows[0]) });
});

export const updateOrderStatus = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(orderId))
    throw new ApiError(400, "Invalid order reference.", "invalid_order_id");

  const statusParsed = OrderStatusInput.safeParse(req.body?.status);
  const paymentStatusParsed = PaymentStatusInput.safeParse(req.body?.paymentStatus);
  if (!statusParsed.success || !paymentStatusParsed.success) {
    throw new ApiError(400, "Choose matching order and payment statuses.", "invalid_input");
  }
  const status = statusParsed.data;
  const paymentStatus = paymentStatusParsed.data;

  const result = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (result.rows.length === 0)
    throw new ApiError(404, "This order no longer exists.", "order_not_found");
  const record = result.rows[0];

  await db.query(
    "UPDATE orders SET status = $1, payment_status = $2, updated_at = now() WHERE order_id = $3",
    [status, paymentStatus, orderId],
  );

  const statusChanged = record.status !== status || record.payment_status !== paymentStatus;
  let emailNotificationSent = false;
  if (statusChanged) {
    try {
      let customerEmail =
        typeof record.customer_email === "string" ? record.customer_email.trim() : "";
      if (!customerEmail && typeof record.customer_uid === "string") {
        customerEmail = (await getAdminAuth().getUser(record.customer_uid)).email ?? "";
      }
      if (customerEmail) {
        await sendOrderStatusUpdateEmail({
          to: customerEmail,
          orderId,
          gameSlug: record.game_slug ?? "",
          gameName: record.game_name ?? "Game order",
          packageName: record.package_name ?? "Package",
          totalLkr: toNum(record.price_pkr) ?? 0,
          status,
          paymentStatus,
        });
        emailNotificationSent = true;
      }
    } catch (error) {
      console.error("Order status update email failed:", { orderId, error });
    }
  }
  res.json({
    orderId,
    status,
    paymentStatus,
    emailNotificationSent,
    emailNotificationAttempted: statusChanged,
  });
});

export const getOrderProofUrl = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(orderId))
    throw new ApiError(400, "Invalid order reference.", "invalid_order_id");
  const result = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (result.rows.length === 0)
    throw new ApiError(404, "This order has no payment proof.", "proof_not_found");
  const record = result.rows[0];
  // Any manual payment method may attach a receipt; only the stored proof matters.
  const uid = record.customer_uid;
  const storagePath = record.payment_proof_storage_path;
  if (typeof uid !== "string" || typeof storagePath !== "string") {
    throw new ApiError(404, "This order has no valid payment proof.", "proof_not_found");
  }

  if (record.payment_proof_storage_provider === "supabase") {
    if (storagePath !== `${uid}/${orderId}/proof`)
      throw new ApiError(404, "This order has no valid payment proof.", "proof_not_found");
    const url = await createProofViewUrl(storagePath);
    return res.json({ url });
  }
  // Legacy Firebase Storage path — not supported in standalone Express; redirect to Supabase
  throw new ApiError(
    501,
    "Legacy Firebase Storage proofs are not retrievable from the standalone API.",
    "legacy_storage",
  );
});

// ─── Nexaura failures ─────────────────────────────────────────────────────────
const NEXAURA_FAILURE_STATUSES = ["failed", "submission_failed", "submission_unknown"];

export const listTopupFailures = asyncRoute(async (_req, res) => {
  const result = await db.query(
    `SELECT * FROM orders
     WHERE nexaura_status = ANY($1::text[])
       AND game_slug = 'free-fire'
     ORDER BY created_at DESC
     LIMIT 300`,
    [NEXAURA_FAILURE_STATUSES],
  );
  const items = result.rows.map((row) => mapOrder(row));
  res.json({ items });
});

// ─── Payment methods ─────────────────────────────────────────────────────────
export const savePaymentMethods = asyncRoute(async (req, res) => {
  const parsed = z.array(PaymentMethodInput).min(1).safeParse(req.body?.methods);
  if (!parsed.success || new Set(parsed.data.map((m) => m.id)).size !== parsed.data.length) {
    throw new ApiError(400, "Payment method IDs must be unique and valid.", "invalid_input");
  }
  await db.query(
    `INSERT INTO store_settings (id, payment_methods, updated_at)
     VALUES (1,$1,now())
     ON CONFLICT (id) DO UPDATE SET payment_methods = EXCLUDED.payment_methods, updated_at = now()`,
    [JSON.stringify(normalizePaymentMethods(parsed.data))],
  );
  res.json({ success: true });
});

// ─── Topup poll (admin) ────────────────────────────────────────────────────────
export const pollTopupStatus = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(orderId))
    throw new ApiError(400, "Invalid order reference.", "invalid_order_id");
  const { pollFreeFireTopupStatus } = await import("./topups.js");
  const result = await pollFreeFireTopupStatus(orderId);
  res.json(result);
});

// ─── Upload image (admin) ───────────────────────────────────────────────────
// Raster formats only. SVG is deliberately rejected: it can carry inline
// <script> and these files land in a PUBLIC bucket, so an SVG would be a
// stored-XSS / phishing vector on the storage origin.
const ALLOWED_UPLOAD_TYPES = [
  {
    contentType: "image/jpeg",
    ext: "jpg",
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    contentType: "image/png",
    ext: "png",
    magic: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    contentType: "image/webp",
    ext: "webp",
    magic: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    contentType: "image/gif",
    ext: "gif",
    magic: (b) => b.toString("ascii", 0, 6) === "GIF87a" || b.toString("ascii", 0, 6) === "GIF89a",
  },
];

export const uploadImage = asyncRoute(async (req, res) => {
  const { folder, fileName, contentType, dataBase64 } = req.body || {};
  if (!folder || !["games", "packages", "payments"].includes(folder)) {
    throw new ApiError(400, "Folder must be 'games', 'packages', or 'payments'.", "invalid_folder");
  }
  const allowedType = ALLOWED_UPLOAD_TYPES.find((entry) => entry.contentType === contentType);
  if (!allowedType) {
    throw new ApiError(400, "Supported image types: PNG, JPEG, WEBP, GIF.", "invalid_content_type");
  }
  if (typeof dataBase64 !== "string" || !dataBase64) {
    throw new ApiError(400, "Image data is missing.", "invalid_data");
  }
  const buffer = Buffer.from(dataBase64, "base64");
  if (!buffer.length) {
    throw new ApiError(400, "Image data is empty.", "invalid_data");
  }
  if (buffer.length > 5 * 1024 * 1024) {
    throw new ApiError(400, "Image size exceeds 5MB limit.", "file_too_large");
  }
  // The declared content type is not trusted: confirm the bytes really are an
  // image of that type before anything is written to the public bucket.
  if (!allowedType.magic(buffer)) {
    throw new ApiError(
      400,
      "The uploaded file does not match the selected image type.",
      "file_content_mismatch",
    );
  }

  const cleanName = (typeof fileName === "string" ? fileName : "image")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const finalPath = `${folder}/${Date.now()}-${cleanName.replace(/\.[a-zA-Z0-9]+$/, "")}.${allowedType.ext}`;

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !supabaseKey) {
    throw new ApiError(503, "Storage is not configured.", "storage_unconfigured");
  }

  const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/public-assets/${finalPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": allowedType.contentType,
      "x-upsert": "true",
    },
    body: buffer,
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    console.error("Supabase image upload failed:", uploadRes.status, errText);
    throw new ApiError(502, "Failed to upload image to storage.", "storage_upload_failed");
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/public-assets/${finalPath}`;
  res.json({ url: publicUrl, path: finalPath });
});
