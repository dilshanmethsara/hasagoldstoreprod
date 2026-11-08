import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  idToken: z.string().min(1).max(5000),
  orderId: z.string().min(1).max(128),
  gameName: z.string().min(1).max(200),
  packageName: z.string().min(1).max(200),
  playerId: z.string().min(1).max(128),
  server: z.string().max(100),
  totalLkr: z.number().finite().nonnegative(),
  paymentMethod: z.string().min(1).max(50),
});

export const sendOrderConfirmationEmail = createServerFn({ method: "POST" })
  .validator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);

    const customerEmail = (decoded.email ?? "").trim();
    if (!customerEmail) {
      throw new Error("This account does not have an email address for order receipts.");
    }

    const { sendOrderConfirmationEmail: sendEmail } = await import("@/server/resend-email");
    await sendEmail({
      to: customerEmail,
      orderId: data.orderId,
      gameName: data.gameName,
      packageName: data.packageName,
      playerId: data.playerId,
      server: data.server,
      totalLkr: data.totalLkr,
      paymentMethod: data.paymentMethod,
    });

    return { success: true };
  });
