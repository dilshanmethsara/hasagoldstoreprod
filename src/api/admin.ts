import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_BASE_URL = (
  process.env["VITE_API_BASE_URL"] ||
  process.env["API_BASE_URL"] ||
  "https://api.hasagold.store"
).replace(/\/+$/, "");

type AdminCollection = "games" | "products" | "gameAccounts" | "orders" | "wallet_deposits";
export type AdminJson =
  string | number | boolean | null | AdminJson[] | { [key: string]: AdminJson };
export type AdminDocument = { id: string; [key: string]: AdminJson };

async function verifyAdminToken(idToken: string): Promise<void> {
  const { assertEmailVerified, getAdminAuth } = await import("@/server/firebase-admin");
  const decoded = await getAdminAuth().verifyIdToken(idToken, true);
  assertEmailVerified(decoded);

  const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean);
  if (!allowedUids.length) throw new Error("Admin access is not configured on the server.");
  if (!allowedUids.includes(decoded.uid)) {
    throw new Error("This Firebase account is not authorized to manage the store.");
  }
}

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
      throw new Error("Incorrect admin password.");
    }

    const { getAdminAuth } = await import("@/server/firebase-admin");
    const adminAuth = getAdminAuth();
    const user = await adminAuth.getUser(uid);
    // A custom-token session does not carry the account's verification state:
    // Firebase issues the resulting ID token with email_verified=false even for
    // an already-verified user, so every authenticated API call (including the
    // admin routes) would fail with 403 "verify your email address". Re-assert
    // the claim, but only when the stored account really is verified.
    const claims: Record<string, unknown> = {};
    if (user.emailVerified === true) claims["email_verified"] = true;
    return { token: await adminAuth.createCustomToken(uid, claims) };
  });

export const verifyAdminAccess = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim()) {
      throw new Error("Sign in with an administrator account.");
    }
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return { ok: true };
  });

/**
 * Resolve whether the signed-in Firebase account is an administrator.
 *
 * `src/routes/__root.tsx` uses this to keep administrator accounts inside the
 * admin panel: when the current UID is in `ADMIN_UIDS`, the storefront is not
 * shown and navigation to a non-admin route redirects to `/admin`.
 */
export const checkAdminSession = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim()) {
      throw new Error("No authentication token was provided.");
    }
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    const { assertEmailVerified, getAdminAuth } = await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    const allowedUids = (process.env["ADMIN_UIDS"] ?? "")
      .split(",")
      .map((uid) => uid.trim())
      .filter(Boolean);
    if (!allowedUids.length) throw new Error("Admin access is not configured on the server.");
    if (!allowedUids.includes(decoded.uid)) return { isAdmin: false };
    assertEmailVerified(decoded);
    return { isAdmin: true };
  });

export const listAdminRecords = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; collection?: unknown; pageToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.collection !== "string" || !input.collection.trim())
      throw new Error("Choose a collection.");
    return { idToken: input.idToken, collection: input.collection, pageToken: input.pageToken };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    const qs =
      typeof data.pageToken === "string" && data.pageToken
        ? `?pageToken=${encodeURIComponent(data.pageToken)}`
        : "";
    return callProtectedApi<{ items: Record<string, unknown>[]; nextPageToken: string | null }>(
      data.idToken,
      `/v1/admin/collections/${encodeURIComponent(data.collection)}${qs}`,
    );
  });

export const listNexauraFailures = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ items: Record<string, unknown>[] }>(
      data.idToken,
      "/v1/admin/topup-failures",
    );
  });

export const searchAdminOrder = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; q?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.q !== "string") throw new Error("Search query is required.");
    return { idToken: input.idToken, q: input.q };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ order: Record<string, unknown> | null }>(
      data.idToken,
      `/v1/admin/orders/search?q=${encodeURIComponent(data.q)}`,
    );
  });

export const getAdminOverview = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    return { idToken: input.idToken };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<Record<string, unknown>>(data.idToken, "/v1/admin/overview");
  });

export const saveAdminRecord = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; collection?: unknown; record?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.collection !== "string" || !input.collection.trim())
      throw new Error("Choose a collection.");
    if (typeof input.record !== "object" || input.record === null)
      throw new Error("The record payload is invalid.");
    return { idToken: input.idToken, collection: input.collection, record: input.record };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ id: string }>(
      data.idToken,
      `/v1/admin/catalog/${encodeURIComponent(data.collection)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.record),
      },
    );
  });

export const saveAdminPaymentMethods = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; methods?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    return { idToken: input.idToken, methods: Array.isArray(input.methods) ? input.methods : [] };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ success: true }>(data.idToken, "/v1/admin/settings/payment-methods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methods: data.methods }),
    });
  });

export const archiveAdminRecord = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; collection?: unknown; id?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.collection !== "string" || !input.collection.trim())
      throw new Error("Choose a collection.");
    if (typeof input.id !== "string" || !input.id.trim())
      throw new Error("Choose a record to archive.");
    return { idToken: input.idToken, collection: input.collection, id: input.id };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ id: string; active: false }>(
      data.idToken,
      `/v1/admin/catalog/${encodeURIComponent(data.collection)}/${encodeURIComponent(data.id)}/archive`,
      { method: "POST" },
    );
  });

export const listAdminUsers = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; pageToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    return { idToken: input.idToken, pageToken: input.pageToken };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    const qs =
      typeof data.pageToken === "string" && data.pageToken
        ? `?pageToken=${encodeURIComponent(data.pageToken)}`
        : "";
    return callProtectedApi<{ users: Record<string, unknown>[]; nextPageToken: string | null }>(
      data.idToken,
      `/v1/admin/users${qs}`,
    );
  });

export const searchAdminUser = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; q?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.q !== "string") throw new Error("Search query is required.");
    return { idToken: input.idToken, q: input.q };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ user: Record<string, unknown> | null }>(
      data.idToken,
      `/v1/admin/users/search?q=${encodeURIComponent(data.q)}`,
    );
  });

export const setAdminUserDisabled = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; uid?: unknown; disabled?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.uid !== "string" || !input.uid.trim()) throw new Error("Choose a user.");
    if (typeof input.disabled !== "boolean") throw new Error("Select a valid disabled state.");
    return { idToken: input.idToken, uid: input.uid, disabled: input.disabled };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ uid: string; disabled: boolean }>(
      data.idToken,
      `/v1/admin/users/${encodeURIComponent(data.uid)}/disabled`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled: data.disabled }),
      },
    );
  });

export const adjustAdminUserWallet = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as {
      idToken?: unknown;
      uid?: unknown;
      direction?: unknown;
      amountLkr?: unknown;
      reason?: unknown;
    };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.uid !== "string" || !input.uid.trim()) throw new Error("Choose a user.");
    if (input.direction !== "credit" && input.direction !== "deduct")
      throw new Error("Choose a valid wallet action.");
    if (typeof input.amountLkr !== "number" || !Number.isFinite(input.amountLkr))
      throw new Error("Enter a valid amount.");
    if (typeof input.reason !== "string" || !input.reason.trim())
      throw new Error("Add a reason for the wallet adjustment.");
    return {
      idToken: input.idToken,
      uid: input.uid,
      direction: input.direction,
      amountLkr: input.amountLkr,
      reason: input.reason,
    };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ uid: string; adjustmentId: string; balanceLkr: number }>(
      data.idToken,
      `/v1/admin/users/${encodeURIComponent(data.uid)}/wallet`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: data.direction,
          amountLkr: data.amountLkr,
          reason: data.reason,
        }),
      },
    );
  });

export const updateAdminOrderStatus = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as {
      idToken?: unknown;
      orderId?: unknown;
      status?: unknown;
      paymentStatus?: unknown;
    };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.orderId !== "string" || !input.orderId.trim())
      throw new Error("Choose an order.");
    if (typeof input.status !== "string" || !input.status.trim())
      throw new Error("Select a valid order status.");
    if (typeof input.paymentStatus !== "string" || !input.paymentStatus.trim())
      throw new Error("Select a valid payment status.");
    return {
      idToken: input.idToken,
      orderId: input.orderId,
      status: input.status,
      paymentStatus: input.paymentStatus,
    };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{
      orderId: string;
      status: string;
      paymentStatus: string;
      emailNotificationSent: boolean;
      nexauraSubmission?: unknown;
    }>(data.idToken, `/v1/admin/orders/${encodeURIComponent(data.orderId)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: data.status, paymentStatus: data.paymentStatus }),
    });
  });

export const getAdminOrderProofUrl = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; orderId?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim())
      throw new Error("Sign in with an administrator account.");
    if (typeof input.orderId !== "string" || !input.orderId.trim())
      throw new Error("Choose an order.");
    return { idToken: input.idToken, orderId: input.orderId };
  })
  .handler(async ({ data }) => {
    await verifyAdminToken(data.idToken);
    return callProtectedApi<{ url: string }>(
      data.idToken,
      `/v1/admin/orders/${encodeURIComponent(data.orderId)}/proof`,
    );
  });
