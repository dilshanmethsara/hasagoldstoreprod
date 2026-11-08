import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const API_BASE_URL = (
  process.env["VITE_API_BASE_URL"] ||
  process.env["API_BASE_URL"] ||
  "https://api.hasagold.store"
).replace(/\/+$/, "");

export const pollNexauraTopup = createServerFn({ method: "POST" })
  .validator((raw: unknown) =>
    z
      .object({
        idToken: z.string().min(1),
        orderId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);

    const response = await fetch(
      `${API_BASE_URL}/v1/orders/${encodeURIComponent(data.orderId)}/topup`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.idToken}`,
          Accept: "application/json",
        },
      },
    );

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
          : `The top-up status request could not be completed (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  });
