import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import { ApiError, asyncRoute } from "./errors.js";
import {
  authenticate,
  authenticateUnverified,
  requireAdmin,
  requireCompleteProfile,
} from "./auth.js";
import {
  createOrder,
  decideOrderPayment,
  getOwnOrder,
  listOwnOrders,
  validateOrderId,
} from "./orders.js";
import { verifyFreeFirePlayer, verifyBloodStrikePlayer } from "./players.js";
import { initiateEzCashDeposit, checkEzCashDeposit } from "./deposits.js";
import {
  completeProfile,
  ensureMemberId,
  getWallet,
  updateProfile,
  ensureProfile,
  sendVerificationEmail,
} from "./profile.js";
import { listGameAccounts, getGameAccount, listFaqs, listRecentTopups } from "./public-routes.js";
import { adminIpGate } from "./admin-access.js";
import { getProofUploadToken, submitProof, viewProof } from "./proofs.js";
import {
  getOverview,
  listCollection,
  saveRecord,
  archiveRecord,
  listUsers,
  searchUser,
  setUserDisabled,
  adjustUserWallet,
  searchOrder,
  updateOrderStatus,
  getOrderProofUrl,
  listTopupFailures,
  savePaymentMethods,
  pollTopupStatus,
  uploadImage,
} from "./admin.js";
import { db, pingDb } from "./db.js";
import { mapGame, mapProduct, mapOrder, mapStoreSettings, mapUser, toMs } from "./serialize.js";
import { pollFreeFireTopupStatus } from "./topups.js";

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
const sensitiveLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

export function createApp() {
  const app = express();
  // API_ALLOWED_ORIGINS is a comma-separated list of exact origins. An entry
  // may use a single "*" wildcard segment, e.g. "https://*.vercel.app", which
  // is handy for preview deployments without allowing every origin.
  const allowedOriginPatterns = (process.env.API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (!origin.includes("*")) return null;
      const escaped = origin.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^./]+");
      try {
        return new RegExp(`^${escaped}$`);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const allowedOrigins = (process.env.API_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      // The API only ever returns JSON; never let it be framed.
      frameguard: { action: "deny" },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        if (allowedOriginPatterns.some((pattern) => pattern.test(origin))) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      methods: ["GET", "POST", "PUT", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: "10mb", strict: true }));
  app.use(limiter);
  // Nothing this API returns may be cached by a browser, proxy or CDN. Admin
  // edits, wallet balances and order state must be visible on the next read.
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    next();
  });

  // ── Health ──────────────────────────────────────────────────────────────────
  app.get(
    "/health",
    asyncRoute(async (_req, res) => {
      if (!(await pingDb())) {
        throw new ApiError(503, "The database is not ready.", "database_unavailable");
      }
      res.json({ status: "ok", service: "hasa-gold-api" });
    }),
  );

  // ── Public catalog ──────────────────────────────────────────────────────────
  // Always read live rows: admin changes must show up on the very next request.
  app.get(
    "/v1/catalog",
    asyncRoute(async (_req, res) => {
      const [gamesResult, productsResult, settingsResult] = await Promise.all([
        db.query("SELECT * FROM games WHERE active = true ORDER BY display_order ASC, slug ASC"),
        db.query(
          "SELECT * FROM products WHERE active = true ORDER BY game_slug ASC, display_order ASC, id ASC",
        ),
        db.query("SELECT * FROM store_settings WHERE id = 1"),
      ]);
      const games = gamesResult.rows.map(mapGame);
      const activeGameSlugs = new Set(games.map((g) => g.id));
      const products = productsResult.rows
        .filter((row) => activeGameSlugs.has(row.game_slug))
        .map(mapProduct);
      const settings = settingsResult.rows[0] ? mapStoreSettings(settingsResult.rows[0]) : null;
      res.json({
        games,
        products,
        settings: settings ?? null,
      });
    }),
  );

  // ── Authenticated user ──────────────────────────────────────────────────────
  app.get(
    "/v1/me",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, res) => {
      const profileRes = await db.query("SELECT * FROM users WHERE uid = $1", [req.user.uid]);
      if (profileRes.rows.length === 0) {
        throw new ApiError(404, "Your customer profile could not be found.", "profile_missing");
      }
      const profile = mapUser(profileRes.rows[0]);
      res.json({ user: { uid: req.user.uid, ...profile } });
    }),
  );

  // ── Player verification ─────────────────────────────────────────────────────
  app.get(
    "/v1/players/free-fire/:playerUid",
    authenticate,
    requireCompleteProfile,
    verifyFreeFirePlayer,
  );
  app.get(
    "/v1/players/blood-strike/:playerUid",
    authenticate,
    requireCompleteProfile,
    verifyBloodStrikePlayer,
  );

  // ── Orders (customer) ───────────────────────────────────────────────────────
  app.get("/v1/orders", authenticate, requireCompleteProfile, listOwnOrders);
  app.get(
    "/v1/orders/:orderId",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    getOwnOrder,
  );
  app.post("/v1/orders", sensitiveLimiter, authenticate, requireCompleteProfile, createOrder);

  // ── Payment proof (customer) ────────────────────────────────────────────────
  app.post(
    "/v1/orders/:orderId/proof/token",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    getProofUploadToken,
  );
  app.post(
    "/v1/orders/:orderId/proof/submit",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    submitProof,
  );
  app.get(
    "/v1/orders/:orderId/proof/view",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    viewProof,
  );

  // ── Topup poll (customer) ────────────────────────────────────────────────────
  app.get(
    "/v1/orders/:orderId/topup",
    authenticate,
    requireCompleteProfile,
    asyncRoute(async (req, res, next) => {
      validateOrderId(req.params.orderId);
      const orderRes = await db.query("SELECT * FROM orders WHERE order_id = $1", [
        req.params.orderId,
      ]);
      if (orderRes.rows.length === 0 || orderRes.rows[0].customer_uid !== req.user.uid) {
        return next(
          new ApiError(404, "This order was not found in your account.", "order_not_found"),
        );
      }
      next();
    }),
    asyncRoute(async (req, res) => {
      const result = await pollFreeFireTopupStatus(req.params.orderId);
      res.json(result);
    }),
  );

  // ── eZ Cash deposits ────────────────────────────────────────────────────────
  app.post(
    "/v1/deposits/ezcash",
    sensitiveLimiter,
    authenticate,
    requireCompleteProfile,
    initiateEzCashDeposit,
  );
  app.get("/v1/deposits/:depositId", authenticate, requireCompleteProfile, checkEzCashDeposit);

  // ── Profile ─────────────────────────────────────────────────────────────────
  // Note: profile/complete does NOT require requireCompleteProfile since the
  // user IS completing their profile in this call.
  app.post("/v1/profile/complete", sensitiveLimiter, authenticate, completeProfile);
  app.post("/v1/profile/member-id", authenticate, ensureMemberId);

  // ── Auth (email verification, ensure profile) ──────────────────────────────
  // These two routes deliberately accept an *unverified* caller: they are how
  // a new account gets its profile row and its verification link. Every other
  // route keeps requiring a verified address.
  app.post("/v1/auth/ensure-profile", authenticateUnverified, ensureProfile);
  app.post(
    "/v1/auth/send-verification-email",
    sensitiveLimiter,
    authenticateUnverified,
    sendVerificationEmail,
  );

  // ── Wallet ─────────────────────────────────────────────────────────────────
  app.get("/v1/me/wallet", authenticate, requireCompleteProfile, getWallet);

  // ── Profile update ──────────────────────────────────────────────────────────
  app.put("/v1/me/profile", authenticate, requireCompleteProfile, updateProfile);

  // ── Public catalog extras (accounts, FAQs) ──────────────────────────────────
  app.get("/v1/accounts", listGameAccounts);
  app.get("/v1/accounts/:id", getGameAccount);
  app.get("/v1/faqs", listFaqs);
  app.get("/v1/recent-topups", listRecentTopups);

  // ── Admin payment decision ──────────────────────────────────────────────────
  // Every /v1/admin route is additionally IP-gated: knowing the API host is not
  // enough, the caller must also be on the allowlist. Mounted once here so a
  // future admin route is protected by default.
  app.use("/v1/admin", adminIpGate);

  app.post(
    "/v1/admin/orders/:orderId/payment-decision",
    sensitiveLimiter,
    authenticate,
    requireCompleteProfile,
    requireAdmin,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    decideOrderPayment,
  );

  // ── Admin overview ──────────────────────────────────────────────────────────
  app.get("/v1/admin/overview", authenticate, requireAdmin, getOverview);

  // ── Admin collections ────────────────────────────────────────────────────────
  app.get("/v1/admin/collections/:collection", authenticate, requireAdmin, listCollection);

  // ── Admin catalog upsert ─────────────────────────────────────────────────────
  app.post("/v1/admin/catalog/:collection", authenticate, requireAdmin, saveRecord);
  app.post("/v1/admin/catalog/:collection/:id/archive", authenticate, requireAdmin, archiveRecord);
  app.post("/v1/admin/upload-image", authenticate, requireAdmin, uploadImage);

  // ── Admin settings / payment methods ────────────────────────────────────────
  app.post(
    "/v1/admin/settings",
    authenticate,
    requireAdmin,
    asyncRoute(async (req, res) => {
      // Delegate to saveRecord with the collection forced to "settings"
      const fakeReq = Object.create(req);
      fakeReq.params = { collection: "settings" };
      fakeReq.body = req.body;
      return saveRecord(fakeReq, res);
    }),
  );
  app.post("/v1/admin/settings/payment-methods", authenticate, requireAdmin, savePaymentMethods);
  app.post(
    "/v1/admin/faqs",
    authenticate,
    requireAdmin,
    asyncRoute(async (req, res) => {
      const fakeReq = Object.create(req);
      fakeReq.params = { collection: "faqs" };
      fakeReq.body = req.body;
      return saveRecord(fakeReq, res);
    }),
  );

  // ── Admin users ──────────────────────────────────────────────────────────────
  app.get("/v1/admin/users", authenticate, requireAdmin, listUsers);
  app.get("/v1/admin/users/search", authenticate, requireAdmin, searchUser);
  app.post("/v1/admin/users/:uid/disabled", authenticate, requireAdmin, setUserDisabled);
  app.post(
    "/v1/admin/users/:uid/wallet",
    sensitiveLimiter,
    authenticate,
    requireAdmin,
    adjustUserWallet,
  );

  // ── Admin orders ─────────────────────────────────────────────────────────────
  app.get("/v1/admin/orders/search", authenticate, requireAdmin, searchOrder);
  app.post(
    "/v1/admin/orders/:orderId/status",
    authenticate,
    requireAdmin,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    updateOrderStatus,
  );
  app.get(
    "/v1/admin/orders/:orderId/proof",
    authenticate,
    requireAdmin,
    asyncRoute(async (req, _res, next) => {
      validateOrderId(req.params.orderId);
      next();
    }),
    getOrderProofUrl,
  );
  app.get(
    "/v1/admin/orders/:orderId/topup",
    authenticate,
    requireAdmin,
    asyncRoute(async (req, res) => {
      validateOrderId(req.params.orderId);
      const result = await pollFreeFireTopupStatus(req.params.orderId);
      res.json(result);
    }),
  );

  // ── Admin topup failures ─────────────────────────────────────────────────────
  app.get("/v1/admin/topup-failures", authenticate, requireAdmin, listTopupFailures);

  // ── 404 & error handler ──────────────────────────────────────────────────────
  app.use((req, _res, next) => {
    next(new ApiError(404, "The requested API route was not found.", "not_found"));
  });
  app.use((error, _req, res, _next) => {
    if (error instanceof ApiError) {
      return res.status(error.status).json({ error: { code: error.code, message: error.message } });
    }
    if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
      return res
        .status(400)
        .json({ error: { code: "invalid_json", message: "The request body must be valid JSON." } });
    }
    if (error?.type === "entity.too.large") {
      return res
        .status(413)
        .json({ error: { code: "request_too_large", message: "The request body is too large." } });
    }
    console.error("Unhandled API error:", error);
    return res
      .status(500)
      .json({ error: { code: "internal_error", message: "An unexpected server error occurred." } });
  });

  return app;
}
