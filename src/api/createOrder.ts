import { createServerFn } from "@tanstack/react-start";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/firestore-schema";

const API_BASE_URL = (
  process.env["VITE_API_BASE_URL"] ||
  process.env["API_BASE_URL"] ||
  "https://api.hasagold.store"
).replace(/\/+$/, "");

async function callProtectedApi<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : `The request could not be completed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

export interface CreateOrderInput {
  idToken: string;
  productId: string;
  playerId: string;
  server: string;
  paymentMethod: PaymentMethod;
}

export interface CreatedOrder {
  orderId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  gameSlug: string;
  gameName: string;
  packageName: string;
  amount: number;
  unitLabel: string;
  priceUsd: number;
  pricePkr: number;
  currency: string;
  playerId: string;
  playerName: string | null;
  playerNameLookupStatus: "verified" | "unavailable" | "not_supported";
  playerRegion: string | null;
  playerNameSource: "live" | "saved" | null;
  server: string;
  paymentMethod: PaymentMethod;
  paymentRecipient: string | null;
  emailNotificationSent: boolean;
  nexauraSubmission?: { status: string; orderId?: string; message?: string };
}

export const createOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown): CreateOrderInput => {
    const input = raw as Partial<CreateOrderInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid order request.");
    if (typeof input.idToken !== "string" || !input.idToken)
      throw new Error("Missing authentication token.");
    if (typeof input.productId !== "string" || !input.productId)
      throw new Error("Missing product.");
    if (
      typeof input.playerId !== "string" ||
      !input.playerId.trim() ||
      input.playerId.trim().length > 128
    ) {
      throw new Error("Enter a valid Player ID (up to 128 characters).");
    }
    if (typeof input.server !== "string" || input.server.trim().length > 100)
      throw new Error("Invalid game server.");
    if (
      typeof input.paymentMethod !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(input.paymentMethod)
    ) {
      throw new Error("Choose a supported payment method.");
    }
    return {
      idToken: input.idToken,
      productId: input.productId,
      playerId: input.playerId.trim(),
      server: input.server,
      paymentMethod: input.paymentMethod as PaymentMethod,
    };
  })
  .handler(async ({ data }): Promise<CreatedOrder> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);

    const response = await callProtectedApi<{
      order: Record<string, unknown>;
      duplicate?: boolean;
    }>(data.idToken, "/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: data.productId,
        playerId: data.playerId,
        server: data.server,
        paymentMethod: data.paymentMethod,
      }),
    });

    const order = response.order ?? {};
    return {
      orderId: String(order.id ?? order.orderId ?? ""),
      status: String(order.status ?? "pending") as OrderStatus,
      paymentStatus: String(order.paymentStatus ?? "unpaid") as PaymentStatus,
      gameSlug: String(order.gameSlug ?? ""),
      gameName: String(order.gameName ?? ""),
      packageName: String(order.packageName ?? ""),
      amount: Number(order.amount ?? 0),
      unitLabel: String(order.unitLabel ?? ""),
      priceUsd: Number(order.priceUsd ?? 0),
      pricePkr: Number(order.pricePkr ?? 0),
      currency: String(order.currency ?? "LKR"),
      playerId: String(order.playerId ?? data.playerId),
      playerName: typeof order.playerName === "string" ? order.playerName : null,
      playerNameLookupStatus:
        (order.playerNameLookupStatus as "verified" | "unavailable" | "not_supported") ??
        "not_supported",
      playerRegion: typeof order.playerRegion === "string" ? order.playerRegion : null,
      playerNameSource:
        order.playerNameSource === "live" || order.playerNameSource === "saved"
          ? order.playerNameSource
          : null,
      server: String(order.server ?? data.server),
      paymentMethod: (order.paymentMethod as PaymentMethod) ?? data.paymentMethod,
      paymentRecipient: typeof order.paymentRecipient === "string" ? order.paymentRecipient : null,
      emailNotificationSent: Boolean(order.emailNotificationSent),
      ...(typeof order.nexauraSubmission === "object"
        ? {
            nexauraSubmission: order.nexauraSubmission as {
              status: string;
              orderId?: string;
              message?: string;
            },
          }
        : {}),
    };
  });

export const submitOrderPaymentProof = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown; fileName?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in before submitting payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    if (
      typeof input.fileName !== "string" ||
      !input.fileName.trim() ||
      input.fileName.length > 200
    ) {
      throw new Error("Choose a valid payment proof image.");
    }
    return {
      idToken: input.idToken,
      orderId: input.orderId,
      fileName: input.fileName.replace(/[\\/]/g, "_").trim(),
    };
  })
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    return callProtectedApi<{ orderId: string; status: string; paymentStatus: string }>(
      data.idToken,
      `/v1/orders/${encodeURIComponent(data.orderId)}/proof/submit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: data.fileName }),
      },
    );
  });

export const getOrderPaymentProofUploadToken = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in before uploading payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    return callProtectedApi<{ path: string; signedUrl: string; token: string }>(
      data.idToken,
      `/v1/orders/${encodeURIComponent(data.orderId)}/proof/token`,
      { method: "POST" },
    );
  });

export const getOrderPaymentProofUrl = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken)
      throw new Error("Sign in to view your payment proof.");
    if (typeof input.orderId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(input.orderId))
      throw new Error("Invalid order reference.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    return callProtectedApi<{ url: string }>(
      data.idToken,
      `/v1/orders/${encodeURIComponent(data.orderId)}/proof/view`,
    );
  });
