import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
    const { assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);

    const userRef = getAdminDb().doc(`users/${decoded.uid}`);
    const user = await userRef.get();
    if (!user.exists) throw new Error("Your customer profile could not be found. Sign in again.");
    if (user.get("profileComplete") !== false) {
      throw new Error("This account does not require profile completion.");
    }

    await getAdminAuth().updateUser(decoded.uid, { displayName: data.displayName });
    await userRef.update({
      displayName: data.displayName,
      phoneNumber: data.phoneNumber,
      profileComplete: true,
      termsAcceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
  });
