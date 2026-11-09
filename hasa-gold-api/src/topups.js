import { ApiError } from "./errors.js";
import { db } from "./db.js";

function getNexauraConfig() {
  const apiKey = process.env.NEXAURA_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError(
      503,
      "Free Fire automatic top-up is not configured.",
      "provider_unconfigured",
    );
  }
  const baseUrl = (
    process.env.NEXAURA_BASE_URL || "https://topup.nexauracore.com/api/v1/reseller"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function getOrder(orderId) {
  const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  return rows[0] ?? null;
}

/**
 * Submit a Free Fire top-up to Nexaura.
 */
export async function submitFreeFireTopup(orderId) {
  const order = await getOrder(orderId);
  if (!order) {
    throw new ApiError(404, "The order could not be found.", "order_not_found");
  }
  if (order.game_slug !== "free-fire" || order.payment_status !== "paid") {
    return { status: "not_started" };
  }

  // Already accepted by Nexaura — return current status.
  if (typeof order.nexaura_order_id === "string" && order.nexaura_order_id) {
    return {
      status: order.nexaura_status || "processing",
      orderId: order.nexaura_order_id,
      duplicate: true,
    };
  }

  if (typeof order.nexaura_product_id !== "string" || !order.nexaura_product_id.trim()) {
    throw new ApiError(
      409,
      "This order has no configured provider product.",
      "provider_product_unconfigured",
    );
  }
  if (typeof order.player_id !== "string" || !/^\d{6,15}$/.test(order.player_id)) {
    throw new ApiError(409, "This order has an invalid Free Fire Player ID.", "invalid_player_id");
  }

  let config;
  try {
    config = getNexauraConfig();
  } catch (error) {
    await db.query(
      `UPDATE orders
          SET nexaura_status = 'pending', nexaura_last_error = 'provider_unconfigured',
              nexaura_note = 'Automatic top-up is not configured. Awaiting admin review.',
              status = 'pending', updated_at = now()
        WHERE order_id = $1`,
      [orderId],
    );
    return {
      status: "pending",
      message: "Automatic top-up is not configured. Awaiting admin review.",
    };
  }

  const { apiKey, baseUrl } = config;

  // Claim handling
  const claimRes = await db.query("SELECT * FROM topup_submissions WHERE order_id = $1", [orderId]);
  if (claimRes.rows.length > 0) {
    const claim = claimRes.rows[0];
    if (typeof claim.provider_order_id === "string" && claim.provider_order_id) {
      if (!order.nexaura_order_id) {
        await db.query(
          `UPDATE orders SET nexaura_order_id = $1, nexaura_status = $2, status = 'processing', updated_at = now()
            WHERE order_id = $3`,
          [claim.provider_order_id, claim.status || "processing", orderId],
        );
      }
      return {
        status: claim.status || "processing",
        orderId: claim.provider_order_id,
        duplicate: true,
      };
    }
    await db.query(
      "UPDATE topup_submissions SET status = 'submitting', updated_at = now() WHERE order_id = $1",
      [orderId],
    );
  } else {
    await db.query("INSERT INTO topup_submissions (order_id, status) VALUES ($1, 'submitting')", [
      orderId,
    ]);
  }

  await db.query(
    "UPDATE orders SET nexaura_status = 'submitting', updated_at = now() WHERE order_id = $1",
    [orderId],
  );

  const submitBody = JSON.stringify({
    player_uid: order.player_id,
    items: [{ product_id: order.nexaura_product_id.trim(), quantity: 1 }],
    reference: orderId,
  });

  try {
    const response = await fetch(`${baseUrl}/topups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": `hasa-${orderId}`,
        "Content-Length": String(Buffer.byteLength(submitBody)),
      },
      body: submitBody,
      signal: AbortSignal.timeout(20000),
    });

    let rawBody;
    try {
      rawBody = await response.json();
    } catch {
      throw new Error("The top-up provider returned an invalid response.");
    }

    if (!response.ok || rawBody?.success !== true) {
      const msg = rawBody?.error?.message || rawBody?.message || `Nexaura error ${response.status}`;
      console.error("Nexaura topup submit failed:", response.status, msg, "order:", orderId);
      throw new Error(msg);
    }

    const providerOrder = rawBody.order;
    if (
      !providerOrder ||
      typeof providerOrder.order_id !== "string" ||
      !providerOrder.order_id.trim() ||
      typeof providerOrder.status !== "string" ||
      !providerOrder.status.trim()
    ) {
      throw new Error("Provider returned incomplete order details.");
    }

    const status = providerOrder.status.trim().toLowerCase();
    await Promise.all([
      db.query(
        "UPDATE topup_submissions SET provider_order_id = $1, status = $2, updated_at = now() WHERE order_id = $3",
        [providerOrder.order_id, status, orderId],
      ),
      db.query(
        `UPDATE orders
            SET nexaura_order_id = $1, nexaura_status = $2,
                nexaura_note = $3, nexaura_last_error = NULL, status = 'pending', updated_at = now()
          WHERE order_id = $4`,
        [
          providerOrder.order_id,
          status,
          typeof providerOrder.note === "string" ? providerOrder.note : null,
          orderId,
        ],
      ),
    ]);

    return { status, orderId: providerOrder.order_id, duplicate: rawBody.duplicate === true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Provider could not be reached.";
    const isInsufficient = /insufficient|balance|credit|402/i.test(errorMsg);
    const sanitizedCustomerNote = isInsufficient
      ? "Stock temporarily queued. Automated delivery completing shortly."
      : "Game server connection delay. System is retrying delivery shortly.";

    await Promise.all([
      db.query(
        "UPDATE topup_submissions SET status = 'rejected', internal_error = $1, updated_at = now() WHERE order_id = $2",
        [errorMsg, orderId],
      ),
      db.query(
        `UPDATE orders
            SET nexaura_status = 'rejected', nexaura_last_error = 'provider_error',
                nexaura_internal_error = $1, nexaura_note = $2, status = 'processing', updated_at = now()
          WHERE order_id = $3`,
        [errorMsg, sanitizedCustomerNote, orderId],
      ),
    ]);
    console.error("Top-up rejected by provider, order stays processing:", {
      orderId,
      error: errorMsg,
    });
    return { status: "processing", message: sanitizedCustomerNote };
  }
}

/**
 * Poll Nexaura for the current status of an ACCEPTED top-up order.
 */
export async function pollFreeFireTopupStatus(orderId) {
  const order = await getOrder(orderId);
  if (!order || order.game_slug !== "free-fire" || order.payment_status !== "paid") {
    throw new ApiError(
      409,
      "This Free Fire order is not eligible for status checks.",
      "order_not_paid",
    );
  }

  const terminalStatuses = new Set(["completed", "failed", "refunded"]);

  const orderDocStatus = String(order.status || "").toLowerCase();
  if (terminalStatuses.has(orderDocStatus)) {
    return {
      orderId: order.nexaura_order_id || null,
      status: orderDocStatus,
      note: order.nexaura_note ?? null,
      issueType: null,
      terminal: true,
    };
  }

  if (typeof order.nexaura_order_id !== "string" || !order.nexaura_order_id) {
    const rawNote = String(order.nexaura_note || order.nexaura_last_error || "");
    const isInsufficientFunds = /insufficient|balance|credit|402/i.test(rawNote);
    const issueType = isInsufficientFunds ? "stock_issue" : "system_issue";
    const friendlyNote = isInsufficientFunds
      ? "Stock temporarily queued. Automated delivery completing shortly."
      : "Game server connection delay. System is retrying delivery shortly.";
    return {
      orderId: null,
      status: order.nexaura_status || "processing",
      issueType,
      note: friendlyNote,
      terminal: false,
    };
  }

  const statusNow = String(order.nexaura_status || "processing").toLowerCase();

  if (terminalStatuses.has(statusNow)) {
    if (order.status !== (statusNow === "completed" ? "completed" : "failed")) {
      await db.query("UPDATE orders SET status = $1, updated_at = now() WHERE order_id = $2", [
        statusNow === "completed" ? "completed" : "failed",
        orderId,
      ]);
    }
    return {
      orderId: order.nexaura_order_id,
      status: statusNow,
      note: order.nexaura_note ?? null,
      issueType: null,
      terminal: true,
    };
  }

  const { apiKey, baseUrl } = getNexauraConfig();
  let body;
  try {
    const response = await fetch(
      `${baseUrl}/topups/${encodeURIComponent(order.nexaura_order_id)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      },
    );
    body = await response.json();
    if (!response.ok || body?.success !== true) {
      throw new Error(body?.error?.message || "Provider status check failed.");
    }
  } catch (error) {
    return {
      orderId: order.nexaura_order_id,
      status: statusNow,
      note: order.nexaura_note ?? null,
      terminal: false,
    };
  }

  if (
    body.order?.order_id !== order.nexaura_order_id ||
    typeof body.order.status !== "string" ||
    !body.order.status.trim()
  ) {
    throw new ApiError(
      502,
      "The provider returned mismatched order details.",
      "provider_invalid_response",
    );
  }

  const status = body.order.status.trim().toLowerCase();
  const note = typeof body.order.note === "string" ? body.order.note : null;
  const terminal = terminalStatuses.has(status);

  await db.query(
    `UPDATE orders
        SET nexaura_status = $1, nexaura_note = $2,
            status = CASE WHEN $3 THEN (CASE WHEN $1 = 'completed' THEN 'completed' ELSE 'failed' END) ELSE status END,
            updated_at = now()
      WHERE order_id = $4`,
    [status, note, terminal, orderId],
  );

  await db.query(
    "UPDATE topup_submissions SET status = $1, updated_at = now() WHERE order_id = $2",
    [status, orderId],
  );

  return { orderId: order.nexaura_order_id, status, note, terminal };
}
