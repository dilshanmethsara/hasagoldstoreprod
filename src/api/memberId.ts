import { createServerFn } from "@tanstack/react-start";

const MEMBER_ID_PATTERN = /^HG-[A-HJ-NP-Z2-9]{8}$/;
const MEMBER_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createMemberId(randomBytes: Uint8Array): string {
  const suffix = Array.from(randomBytes.slice(0, 8), (byte) => MEMBER_ID_ALPHABET[byte & 31]).join(
    "",
  );
  return `HG-${suffix}`;
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
    const { assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");
    const { randomBytes } = await import("node:crypto");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    const db = getAdminDb();
    const userRef = db.doc(`users/${decoded.uid}`);

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const transactionResult = await db.runTransaction(async (transaction) => {
        const userSnapshot = await transaction.get(userRef);
        if (!userSnapshot.exists) {
          throw new Error("Your account profile could not be found.");
        }
        const existingMemberId = userSnapshot.get("memberId");
        const memberId =
          typeof existingMemberId === "string" && MEMBER_ID_PATTERN.test(existingMemberId)
            ? existingMemberId
            : createMemberId(randomBytes(8));
        const memberRef = db.doc(`member_ids/${memberId}`);
        const memberSnapshot = await transaction.get(memberRef);

        if (memberSnapshot.exists && memberSnapshot.get("uid") !== decoded.uid) {
          return null;
        }
        if (!memberSnapshot.exists) {
          transaction.create(memberRef, {
            uid: decoded.uid,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        if (existingMemberId !== memberId) {
          transaction.update(userRef, { memberId, updatedAt: FieldValue.serverTimestamp() });
        }
        return memberId;
      });

      if (transactionResult) return { memberId: transactionResult };
    }

    throw new Error("Could not assign a customer ID right now. Please retry.");
  });
