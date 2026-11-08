import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_BASE_URL = (
  process.env["VITE_API_BASE_URL"] ||
  process.env["API_BASE_URL"] ||
  "https://api.hasagold.store"
).replace(/\/+$/, "");

async function callProtectedApi<T>(
  token: string,
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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
        : `The requested profile update could not be completed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

export const completeCustomerProfile = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        idToken: z.string().min(1).max(5000),
        displayName: z.string().trim().min(2).max(80),
        phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/),
        acceptedTerms: z.literal(true),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { assertEmailVerified, getAdminAuth } = await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    return callProtectedApi<{ success: true }>(data.idToken, "/v1/profile/complete", {
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      acceptedTerms: data.acceptedTerms,
    });
  });
