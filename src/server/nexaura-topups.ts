import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/server/firebase-admin";

interface NexauraOrderResponse {
  success?: boolean;
  duplicate?: boolean;
  order?: {
    order_id?: string;
    status?: string;
    note?: string | null;
  };
  error?: { message?: string };
  message?: string;
}

export interface NexauraSubmissionResult {
  status: string;
  orderId?: string;
  duplicate?: boolean;
  message?: string;
}

export interface NexauraPollResult {
  orderId: string;
  status: string;
  note: string | null;
  terminal: boolean;
}

const terminalStatuses = new Set(["completed", "failed", "refunded"]);

function normalizeProviderStatus(status: string): string {
  return status.trim().toLowerCase();
}

function getNexauraConfig() {
  const apiKey = process.env["NEXAURA_API_KEY"];
  if (!apiKey) throw new Error("Nexaura top-up is not configured on the server.");
  const baseUrl = (
    process.env["NEXAURA_BASE_URL"] ?? "https://topup.nexauracore.com/api/v1/reseller"
  ).replace(/\/+$/, "");
  return { apiKey, baseUrl };
}

async function readProviderResponse(response: Response): Promise<NexauraOrderResponse> {
  try {
    return (await response.json()) as NexauraOrderResponse;
  } catch {
    throw new Error("Nexaura returned an invalid response.");
  }
}

export async function submitFreeFireTopup(orderId: string): Promise<NexauraSubmissionResult> {
  const db = getAdminDb();
  const orderRef = db.doc(`orders/${orderId}`);
  const snapshot = await orderRef.get();
  const order = snapshot.data();
  if (!snapshot.exists || !order) throw new Error("The order could not be found.");
  if (order["gameSlug"] !== "free-fire" || order["paymentStatus"] !== "paid") {
    return { status: "not_started" };
  }
  if (typeof order["nexauraOrderId"] === "string" && order["nexauraOrderId"]) {
    return {
      status: typeof order["nexauraStatus"] === "string" ? order["nexauraStatus"] : "processing",
      orderId: order["nexauraOrderId"],
      duplicate: true,
    };
  }

  const fail = async (
    status: "submission_failed" | "submission_unknown",
    message: string,
  ): Promise<NexauraSubmissionResult> => {
    await orderRef.update({
      nexauraStatus: status,
      nexauraLastError: message.slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.error("Nexaura Free Fire top-up submission did not complete:", {
      orderId,
      status,
      message,
    });
    return { status, message };
  };

  const productId = order["nexauraProductId"];
  const playerUid = order["playerId"];
  if (
    typeof productId !== "string" ||
    !productId.trim() ||
    typeof playerUid !== "string" ||
    !/^\d{6,15}$/.test(playerUid)
  ) {
    return fail(
      "submission_failed",
      "The Free Fire package or Player ID is not configured correctly.",
    );
  }

  let config: ReturnType<typeof getNexauraConfig>;
  try {
    config = getNexauraConfig();
  } catch (error) {
    return fail(
      "submission_failed",
      error instanceof Error ? error.message : "Nexaura top-up is not configured on the server.",
    );
  }

  await orderRef.update({
    nexauraStatus: "submitting",
    nexauraLastError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}/topups`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Idempotency-Key": `hasa-${orderId}`,
      },
      body: JSON.stringify({
        player_uid: playerUid,
        items: [{ product_id: productId.trim(), quantity: 1 }],
        reference: orderId,
      }),
      // The wallet is already charged at this point, so give the provider enough
      // time to accept the order instead of falling back to review too early.
      signal: AbortSignal.timeout(30000),
    });
  } catch (error) {
    return fail(
      "submission_unknown",
      error instanceof Error
        ? `Could not confirm Nexaura submission: ${error.message}`
        : "Could not confirm Nexaura submission.",
    );
  }

  let body: NexauraOrderResponse;
  try {
    body = await readProviderResponse(response);
  } catch (error) {
    return fail(
      "submission_unknown",
      error instanceof Error ? error.message : "Nexaura returned an invalid response.",
    );
  }

  if (!response.ok || body.success !== true) {
    const message =
      body.error?.message ||
      body.message ||
      `Nexaura rejected the request (HTTP ${response.status}).`;
    return fail(response.status >= 500 ? "submission_unknown" : "submission_failed", message);
  }
  const providerOrder = body.order;
  const providerOrderId = providerOrder?.order_id;
  const rawProviderStatus = providerOrder?.status;
  if (
    !providerOrder ||
    typeof providerOrderId !== "string" ||
    !providerOrderId.trim() ||
    typeof rawProviderStatus !== "string" ||
    !rawProviderStatus.trim()
  ) {
    return fail(
      "submission_unknown",
      "Nexaura accepted the request but returned incomplete order details.",
    );
  }

  const providerStatus = normalizeProviderStatus(rawProviderStatus);
  await orderRef.update({
    nexauraOrderId: providerOrderId,
    nexauraStatus: providerStatus,
    nexauraNote: typeof providerOrder.note === "string" ? providerOrder.note : null,
    nexauraLastError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return {
    status: providerStatus,
    orderId: providerOrderId,
    duplicate: body.duplicate === true,
  };
}

export async function pollFreeFireTopupStatus(orderId: string): Promise<NexauraPollResult> {
  const db = getAdminDb();
  const orderRef = db.doc(`orders/${orderId}`);
  const snapshot = await orderRef.get();
  const order = snapshot.data();
  if (!snapshot.exists || !order) throw new Error("The order could not be found.");
  if (order["gameSlug"] !== "free-fire" || order["paymentStatus"] !== "paid") {
    throw new Error("This Free Fire order is not yet eligible for provider status checks.");
  }
  const providerOrderId = order["nexauraOrderId"];
  if (typeof providerOrderId !== "string" || !providerOrderId) {
    throw new Error("Nexaura has not returned a provider order ID for this order yet.");
  }

  const currentStatus =
    typeof order["nexauraStatus"] === "string"
      ? normalizeProviderStatus(order["nexauraStatus"])
      : "processing";
  const currentNote = typeof order["nexauraNote"] === "string" ? order["nexauraNote"] : null;
  if (terminalStatuses.has(currentStatus)) {
    const expectedOrderStatus = currentStatus === "completed" ? "completed" : "failed";
    if (order["status"] !== expectedOrderStatus) {
      await orderRef.update({
        status: expectedOrderStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return { orderId: providerOrderId, status: currentStatus, note: currentNote, terminal: true };
  }

  const { apiKey, baseUrl } = getNexauraConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/topups/${encodeURIComponent(providerOrderId)}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Could not reach Nexaura to check order status: ${error.message}`
        : "Could not reach Nexaura to check order status.",
    );
  }

  const body = await readProviderResponse(response);
  if (!response.ok || body.success !== true) {
    throw new Error(
      body.error?.message ||
        body.message ||
        `Nexaura order status could not be read (HTTP ${response.status}).`,
    );
  }
  if (
    body.order?.order_id !== providerOrderId ||
    typeof body.order.status !== "string" ||
    !body.order.status.trim()
  ) {
    throw new Error("Nexaura returned incomplete or mismatched order status details.");
  }

  const status = normalizeProviderStatus(body.order.status);
  const note = typeof body.order.note === "string" ? body.order.note : null;
  if (status !== currentStatus || note !== currentNote) {
    const updates: Record<string, unknown> = {
      nexauraStatus: status,
      nexauraNote: note,
      nexauraLastError: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (terminalStatuses.has(status)) {
      updates["status"] = status === "completed" ? "completed" : "failed";
    }
    await orderRef.update(updates);
  }
  return {
    orderId: providerOrderId,
    status,
    note,
    terminal: terminalStatuses.has(status),
  };
}
