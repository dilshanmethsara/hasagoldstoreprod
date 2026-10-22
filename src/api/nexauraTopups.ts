import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const order = await getAdminDb().doc(`orders/${data.orderId}`).get();
    if (!order.exists || order.data()?.["customerUid"] !== decoded.uid) {
      throw new Error("This order was not found in your account.");
    }
    const { pollFreeFireTopupStatus } = await import("@/server/nexaura-topups");
    return pollFreeFireTopupStatus(data.orderId);
  });
