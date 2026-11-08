import { createServerFn } from "@tanstack/react-start";

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

export interface EzCashDepositInput {
  idToken: string;
  referenceNumber: string;
}

export interface EzCashStatusInput {
  idToken: string;
  depositId: string;
}

export interface EzCashDepositResult {
  depositId: string;
  creditedLkr: number;
  status: "credited" | "failed" | "pending";
  message: string;
  duplicate?: boolean;
}

export const initiateEzCashDeposit = createServerFn({ method: "POST" })
  .validator((raw: unknown): EzCashDepositInput => {
    const input = raw as Partial<EzCashDepositInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid deposit request.");
    if (typeof input.idToken !== "string" || !input.idToken)
      throw new Error("Sign in before submitting your deposit.");
    if (typeof input.referenceNumber !== "string" || !input.referenceNumber.trim())
      throw new Error("Enter your eZ Cash reference number.");
    return { idToken: input.idToken, referenceNumber: input.referenceNumber.trim() };
  })
  .handler(async ({ data }): Promise<EzCashDepositResult> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    return callProtectedApi<EzCashDepositResult>(data.idToken, "/v1/deposits/ezcash", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ referenceNumber: data.referenceNumber }),
    });
  });

export const checkEzCashDeposit = createServerFn({ method: "POST" })
  .validator((raw: unknown): EzCashStatusInput => {
    const input = raw as Partial<EzCashStatusInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid deposit status request.");
    if (typeof input.idToken !== "string" || !input.idToken)
      throw new Error("Sign in to check your deposit.");
    if (typeof input.depositId !== "string" || !input.depositId.trim())
      throw new Error("Invalid deposit reference.");
    return { idToken: input.idToken, depositId: input.depositId.trim() };
  })
  .handler(async ({ data }): Promise<EzCashDepositResult> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    return callProtectedApi<EzCashDepositResult>(
      data.idToken,
      `/v1/deposits/${encodeURIComponent(data.depositId)}`,
    );
  });
