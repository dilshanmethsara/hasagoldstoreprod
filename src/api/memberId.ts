import { createServerFn } from "@tanstack/react-start";

const API_BASE_URL = (
  process.env["VITE_API_BASE_URL"] ||
  process.env["API_BASE_URL"] ||
  "https://api.hasagold.store"
).replace(/\/+$/, "");

async function callProtectedApi<T>(
  token: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
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
        : `The member ID request could not be completed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

export const ensureMemberId = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim()) {
      throw new Error("Sign in to load your customer ID.");
    }
    return { idToken: input.idToken };
  })
  .handler(async ({ data }): Promise<{ memberId: string }> => {
    const { assertEmailVerified, getAdminAuth } = await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    return callProtectedApi<{ memberId: string }>(data.idToken, "/v1/profile/member-id");
  });
