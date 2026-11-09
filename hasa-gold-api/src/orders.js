import { randomBytes } from "node:crypto";
import { ApiError, asyncRoute } from "./errors.js";
import { db } from "./db.js";
import {
  CreateOrderBody,
  PaymentDecisionBody,
  createIdempotencyDocumentId,
  createRequestFingerprint,
  parseBody,
  validateCatalogProduct,
} from "./validation.js";
import { mapOrder, mapProduct, mapGame, mapStoreSettings, toNum } from "./serialize.js";
import { submitFreeFireTopup } from "./topups.js";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function genOrderId() {
  return Array.from(randomBytes(20), (b) => ID_ALPHABET[b % 62]).join("");
}

function parseActivePaymentMethods(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [
      { id: "wallet", active: true },
      { id: "ezcash", active: true },
    ];
  }
  if (
    value.some(
      (method) =>
        !method ||
        typeof method.id !== "string" ||
        !method.id.trim() ||
        typeof method.active !== "boolean",
    )
  ) {
    throw new ApiError(503, "Payment method settings are invalid.", "invalid_payment_settings");
  }
  const seen = new Set();
  for (const method of value) {
    if (seen.has(method.id)) {
      throw new ApiError(503, "Payment method settings are invalid.", "invalid_payment_settings");
    }
    seen.add(method.id);
  }
  return value;
}

export function createOrderHandler() {
  return asyncRoute(async (req, res) => {
    const data = parseBody(CreateOrderBody, req.body);
    const idempotencyKey = req.get("idempotency-key") || "";
    if (!/^[\w.-]{16,128}$/.test(idempotencyKey)) {
      throw new ApiError(
        400,
        "Provide a unique Idempotency-Key (16 to 128 letters, digits, dots, underscores or hyphens).",
        "idempotency_key_required",
      );
    }

    const settingsRow = await db.query("SELECT * FROM store_settings WHERE id = 1");
    const settings = settingsRow.rows[0] ? mapStoreSettings(settingsRow.rows[0]) : {};
    if (settings.maintenanceMode === true) {
      throw new ApiError(503, "The store is in maintenance mode. Try again later.", "maintenance");
    }

    const methods = parseActivePaymentMethods(settings.paymentMethods);
    const paymentMethodConfig = methods.find(
      (method) => method.id === data.paymentMethod && method.active === true,
    );
    if (!paymentMethodConfig) {
      throw new ApiError(
        409,
        "This payment method is not available.",
        "payment_method_unavailable",
      );
    }

    const uid = req.user.uid;
    const keyId = createIdempotencyDocumentId(uid, idempotencyKey);
    const fingerprint = createRequestFingerprint(data);

    let orderId;
    let duplicate = false;
    let catalog;
    let nexauraProductId;

    await db.transaction(async (tx) => {
      const productRes = await tx.query("SELECT * FROM products WHERE id = $1", [data.productId]);
      const product = productRes.rows[0] ? mapProduct(productRes.rows[0]) : null;
      const gameSlug = product?.gameSlug;
      const gameRes = gameSlug
        ? await tx.query("SELECT * FROM games WHERE slug = $1", [gameSlug])
        : { rows: [] };
      const game = gameRes.rows[0] ? mapGame(gameRes.rows[0]) : null;
      catalog = validateCatalogProduct(data.productId, product, game, data.playerId, data.server);

      const scopedGames = Array.isArray(paymentMethodConfig.games)
        ? paymentMethodConfig.games.filter(
            (slug) => typeof slug === "string" && slug.trim().length > 0,
          )
        : [];
      if (scopedGames.length > 0 && !scopedGames.includes(catalog.gameSlug)) {
        throw new ApiError(
          409,
          "This payment method is not available for this game.",
          "payment_method_unavailable",
        );
      }

      nexauraProductId =
        typeof catalog.nexauraProductId === "string" ? catalog.nexauraProductId.trim() : "";
      if (catalog.gameSlug === "free-fire" && !nexauraProductId) {
        throw new ApiError(
          409,
          "This Free Fire package is not configured for automatic top-up.",
          "provider_product_unconfigured",
        );
      }
      if (catalog.gameSlug === "free-fire" && !process.env.NEXAURA_API_KEY?.trim()) {
        throw new ApiError(
          503,
          "Free Fire automatic top-up is not configured.",
          "provider_unconfigured",
        );
      }

      const isWalletPayment = data.paymentMethod === "wallet";
      let paymentRecipient = null;
      if (!isWalletPayment) {
        const configuredNumber =
          typeof paymentMethodConfig.accountNumber === "string"
            ? paymentMethodConfig.accountNumber.trim()
            : "";
        const configuredName =
          typeof paymentMethodConfig.accountName === "string"
            ? paymentMethodConfig.accountName.trim()
            : "";
        // Legacy eZ Cash rows keep using the store-level account details.
        const fallbackNumber =
          data.paymentMethod === "ezcash" ? settings.paymentEzcashNumber?.trim() : "";
        const fallbackName =
          data.paymentMethod === "ezcash" ? settings.paymentEzcashName?.trim() : "";
        const recipientNumber = configuredNumber || fallbackNumber;
        const recipientName = configuredName || fallbackName;
        paymentRecipient =
          recipientNumber && recipientName ? `${recipientNumber} — ${recipientName}` : null;
        if (!paymentRecipient) {
          throw new ApiError(
            503,
            "Payment details are not configured for this method.",
            "payment_details_unconfigured",
          );
        }
      }

      const [claimRes, userRes] = await Promise.all([
        tx.query("SELECT * FROM order_idempotency WHERE key_id = $1", [keyId]),
        tx.query("SELECT 1 FROM users WHERE uid = $1", [uid]),
      ]);
      if (userRes.rows.length === 0) {
        throw new ApiError(403, "Your customer profile could not be found.", "profile_missing");
      }
      if (claimRes.rows.length > 0) {
        const claim = claimRes.rows[0];
        if (claim.fingerprint !== fingerprint) {
          throw new ApiError(
            409,
            "This Idempotency-Key was already used for a different order.",
            "idempotency_conflict",
          );
        }
        if (typeof claim.order_id !== "string" || !claim.order_id) {
          throw new ApiError(
            409,
            "The previous order request is still being processed.",
            "order_in_progress",
          );
        }
        orderId = claim.order_id;
        duplicate = true;
        return;
      }

      if (data.paymentMethod === "wallet") {
        // Atomic conditional debit: only deduct if the balance still covers the price.
        const debit = await tx.query(
          `UPDATE users SET wallet_balance_lkr = wallet_balance_lkr - $1, updated_at = now()
            WHERE uid = $2 AND wallet_balance_lkr >= $1
            RETURNING wallet_balance_lkr`,
          [catalog.pricePkr, uid],
        );
        if (debit.rowCount === 0) {
          throw new ApiError(
            409,
            "Your wallet balance is too low for this order.",
            "insufficient_funds",
          );
        }
      }

      // Generate a unique order id (retry on the astronomically unlikely PK collision).
      let candidate = genOrderId();
      for (;;) {
        const clash = await tx.query("SELECT 1 FROM orders WHERE order_id = $1", [candidate]);
        if (clash.rows.length === 0) break;
        candidate = genOrderId();
      }
      orderId = candidate;

      await tx.query(
        `INSERT INTO orders
           (order_id, customer_uid, customer_email, game_slug, game_name, product_id,
            nexaura_product_id, package_name, amount, unit_label, price_usd, price_pkr,
            currency, player_id, player_name, player_name_lookup_status, player_region,
            player_name_source, server, payment_method, payment_recipient, status, payment_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
        [
          orderId,
          uid,
          typeof req.user.email === "string" ? req.user.email : "",
          catalog.gameSlug,
          catalog.gameName,
          catalog.productId,
          catalog.gameSlug === "free-fire" ? nexauraProductId : null,
          catalog.packageName,
          catalog.amount,
          catalog.unitLabel,
          catalog.priceUsd,
          catalog.pricePkr,
          "LKR",
          data.playerId,
          null,
          "not_supported",
          null,
          null,
          data.server,
          data.paymentMethod,
          paymentRecipient,
          data.paymentMethod === "wallet" ? "processing" : "pending",
          data.paymentMethod === "wallet" ? "paid" : "unpaid",
        ],
      );

      await tx.query(
        "INSERT INTO order_idempotency (key_id, uid, order_id, fingerprint) VALUES ($1,$2,$3,$4)",
        [keyId, uid, orderId, fingerprint],
      );
    });

    let topup;
    if (catalog.gameSlug === "free-fire" && data.paymentMethod === "wallet") {
      topup = await submitFreeFireTopup(orderId);
    }
    const saved = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
    res.status(duplicate ? 200 : 201).json({
      order: mapOrder(saved.rows[0]),
      duplicate,
      ...(topup ? { topup } : {}),
    });
  });
}

export const createOrder = createOrderHandler();

export const listOwnOrders = asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 50);
  const { rows } = await db.query(
    "SELECT * FROM orders WHERE customer_uid = $1 ORDER BY created_at DESC LIMIT $2",
    [req.user.uid, limit],
  );
  res.json({ orders: rows.map(mapOrder) });
});

export const getOwnOrder = asyncRoute(async (req, res) => {
  const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [req.params.orderId]);
  if (rows.length === 0 || rows[0].customer_uid !== req.user.uid) {
    throw new ApiError(404, "This order was not found in your account.", "order_not_found");
  }
  const order = mapOrder(rows[0]);
  if (order.gameSlug === "free-fire" && order.paymentStatus === "paid" && order.nexauraOrderId) {
    const { pollFreeFireTopupStatus } = await import("./topups.js");
    order.topup = await pollFreeFireTopupStatus(rows[0].order_id);
  }
  res.json({ order });
});

export const decideOrderPayment = asyncRoute(async (req, res) => {
  const { decision } = parseBody(PaymentDecisionBody, req.body);
  const paymentStatus = decision === "confirm" ? "paid" : "proof_rejected";
  const status = decision === "confirm" ? "processing" : "pending";

  const order = await db.transaction(async (tx) => {
    const res = await tx.query("SELECT * FROM orders WHERE order_id = $1", [req.params.orderId]);
    const current = res.rows[0];
    if (!current) {
      throw new ApiError(404, "Order not found.", "order_not_found");
    }
    // Any manual payment method (eZ Cash, Bank Transfer, or a custom method)
    // can submit a receipt, so the review decision must not be tied to one
    // method id. The proof state itself is what makes an order reviewable.
    if (
      current.payment_status !== "proof_submitted" ||
      current.status !== "payment_review" ||
      current.payment_method === "wallet"
    ) {
      throw new ApiError(
        409,
        "Only orders awaiting payment review can be decided.",
        "order_not_awaiting_review",
      );
    }
    if (
      typeof current.payment_proof_storage_path !== "string" ||
      !current.payment_proof_storage_path.trim()
    ) {
      throw new ApiError(409, "The order has no submitted payment proof.", "proof_missing");
    }
    await tx.query(
      `UPDATE orders
          SET payment_status = $1, status = $2, payment_reviewed_by = $3,
              payment_reviewed_at = now(), updated_at = now()
        WHERE order_id = $4`,
      [paymentStatus, status, req.user.uid, req.params.orderId],
    );
    return current;
  });

  let topup;
  if (decision === "confirm" && order.game_slug === "free-fire") {
    topup = await submitFreeFireTopup(req.params.orderId);
  }
  const updated = await db.query("SELECT * FROM orders WHERE order_id = $1", [req.params.orderId]);
  res.json({
    order: mapOrder(updated.rows[0]),
    ...(topup ? { topup } : {}),
  });
});

export function validateOrderId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    throw new ApiError(400, "Invalid order reference.", "invalid_order_id");
  }
  return value;
}
