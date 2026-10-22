/**
 * eZ Cash deposit server functions.
 *
 * Split into two fast endpoints so the customer gets an instant reply:
 *
 *   1. initiateEzCashDeposit — verifies the Firebase token, submits the RN to
 *      Nexaura and returns in ONE round trip (no polling).
 *   2. checkEzCashDeposit — does a single GET /deposits/{id} and, when
 *      credited, credits the wallet inside a Firestore transaction
 *      (idempotent — the same deposit can never be credited twice).
 *
 * The client shows a response as soon as (1) returns, then polls (2) every
 * couple of seconds. Previously (1) blocked for up to 30 s, which is what made
 * verification feel stuck.
 *
 * The API key is read from the server environment (never sent to the browser).
 * The amount is ALWAYS taken from the Nexaura response — the client never supplies it.
 */
import { createServerFn } from "@tanstack/react-start";

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

interface NexauraDeposit {
  deposit_id: string;
  status: "pending" | "credited" | "failed";
  method?: string;
  rn?: string;
  credited_lkr?: number;
}

interface NexauraDepositResponse {
  success: boolean;
  deposit?: NexauraDeposit;
  balance_lkr?: number;
  error?: { code: string; message: string };
}

async function nexauraRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const key = process.env["NEXAURA_API_KEY"];
  const base = process.env["NEXAURA_BASE_URL"] ?? "https://topup.nexauracore.com/api/v1/reseller";
  if (!key) throw new Error("NEXAURA_API_KEY is not configured on the server.");
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Nexaura API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

const PENDING_MESSAGE =
  "Reference submitted. eZ Cash verification is pending; no wallet credit has been recorded yet.";

async function getRnClaimId(referenceNumber: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(referenceNumber).digest("hex");
}

async function updateRnClaim(params: {
  uid: string;
  referenceNumber: string;
  depositId: string;
  status: "pending" | "credited" | "failed";
}): Promise<void> {
  const { getAdminDb } = await import("@/server/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const claimRef = getAdminDb().doc(
    `wallet_deposit_rns/${await getRnClaimId(params.referenceNumber)}`,
  );

  await getAdminDb().runTransaction(async (transaction) => {
    const claimSnap = await transaction.get(claimRef);
    const claim = claimSnap.data();
    if (
      !claimSnap.exists ||
      claim?.["uid"] !== params.uid ||
      claim["depositId"] !== params.depositId
    ) {
      throw new Error("This eZ Cash reference is not associated with this deposit.");
    }
    transaction.update(claimRef, {
      status: params.status,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

/**
 * Credit the wallet for a verified deposit.
 *
 * Runs in a transaction and checks the deposit document first, so two
 * concurrent status checks (double-click / two tabs) can never credit twice.
 * Returns the amount that is credited in total.
 */
async function creditVerifiedDeposit(params: {
  depositId: string;
  uid: string;
  referenceNumber: string;
  creditedLkr: number;
}): Promise<number> {
  const { depositId, uid, referenceNumber, creditedLkr } = params;
  const { getAdminDb } = await import("@/server/firebase-admin");
  const { FieldValue } = await import("firebase-admin/firestore");
  const db = getAdminDb();

  return db.runTransaction(async (tx) => {
    const depositRef = db.doc(`wallet_deposits/${depositId}`);
    const userRef = db.doc(`users/${uid}`);

    const [depositSnap, userSnap] = await Promise.all([tx.get(depositRef), tx.get(userRef)]);
    if (!userSnap.exists) {
      throw new Error("The account profile could not be found for this deposit.");
    }
    const existing = depositSnap.data();
    if (
      depositSnap.exists &&
      (existing?.["uid"] !== uid ||
        existing["referenceNumber"] !== referenceNumber ||
        existing["method"] !== "ezcash")
    ) {
      throw new Error("This payment reference is already associated with another account.");
    }

    // creditedAt is written in the same transaction as the wallet increment.
    // Older records without it may have been marked credited before the wallet
    // transaction ran, so allow one safe recovery increment for those records.
    if (depositSnap.exists && depositSnap.data()?.["status"] === "credited") {
      const already = Number(depositSnap.data()?.["creditedLkr"]);
      if (!Number.isFinite(already) || already <= 0) {
        throw new Error("The existing deposit record has an invalid credited amount.");
      }
      if (depositSnap.data()?.["creditedAt"] != null) return already;
    }

    tx.set(
      depositRef,
      {
        depositId,
        uid,
        referenceNumber,
        method: "ezcash",
        status: "credited",
        creditedLkr,
        creditedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // Wallet balance lives on the user document. Create it if it is missing.
    tx.set(
      userRef,
      {
        walletBalanceLkr: FieldValue.increment(creditedLkr),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return creditedLkr;
  });
}

/** Turn a Nexaura deposit state into the client-facing result (crediting when needed). */
async function resolveDeposit(params: {
  uid: string;
  referenceNumber: string;
  deposit: NexauraDeposit;
}): Promise<EzCashDepositResult> {
  const { uid, referenceNumber, deposit } = params;
  const depositId = deposit.deposit_id;

  if (deposit.status === "failed") {
    // Best-effort bookkeeping; never hide the real API answer from the customer.
    try {
      const { getAdminDb } = await import("@/server/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      await getAdminDb()
        .doc(`wallet_deposits/${depositId}`)
        .set({ status: "failed", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error("Could not record failed eZ Cash deposit status:", error);
    }
    return {
      depositId,
      creditedLkr: 0,
      status: "failed",
      message:
        "eZ Cash payment could not be verified. Please check your reference number and try again.",
    };
  }

  if (deposit.status !== "credited") {
    return { depositId, creditedLkr: 0, status: "pending", message: PENDING_MESSAGE };
  }

  const creditedLkr = Number(deposit.credited_lkr ?? 0);
  if (!Number.isFinite(creditedLkr) || creditedLkr <= 0) {
    return {
      depositId,
      creditedLkr: 0,
      status: "failed",
      message: "Payment was verified but the amount could not be read. Please contact support.",
    };
  }

  const finalAmount = await creditVerifiedDeposit({
    depositId,
    uid,
    referenceNumber: referenceNumber || deposit.rn || "",
    creditedLkr,
  });

  return {
    depositId,
    creditedLkr: finalAmount,
    status: "credited",
    message: `Rs. ${finalAmount.toLocaleString()} added to your wallet!`,
  };
}

/**
 * Submit the reference number. Returns as soon as Nexaura acknowledges the
 * deposit — no polling — so the customer sees a response in ~1 network trip.
 */
export const initiateEzCashDeposit = createServerFn({ method: "POST" })
  .validator((raw: unknown): EzCashDepositInput => {
    const input = raw as Partial<EzCashDepositInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid request.");
    if (typeof input.idToken !== "string" || !input.idToken.trim())
      throw new Error("Missing authentication token.");
    const rn = (input.referenceNumber ?? "").trim();
    if (!/^\d{14}$/.test(rn))
      throw new Error("Enter the 14-digit eZ Cash reference number from your confirmation SMS.");
    return { idToken: input.idToken, referenceNumber: rn };
  })
  .handler(async ({ data }): Promise<EzCashDepositResult> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");
    const { FieldValue } = await import("firebase-admin/firestore");

    // 1. Verify caller
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;

    // Claim the RN before contacting Nexaura so concurrent submissions cannot
    // submit the same payment reference more than once.
    const db = getAdminDb();
    const claimRef = db.doc(`wallet_deposit_rns/${await getRnClaimId(data.referenceNumber)}`);
    const claim = await db.runTransaction(async (transaction) => {
      const claimSnap = await transaction.get(claimRef);
      if (claimSnap.exists) {
        const existing = claimSnap.data();
        if (existing?.["uid"] !== uid || existing["referenceNumber"] !== data.referenceNumber) {
          throw new Error("This eZ Cash reference has already been submitted.");
        }
        return {
          duplicate: true,
          depositId: typeof existing["depositId"] === "string" ? existing["depositId"] : "",
          status: existing["status"] as string | undefined,
        };
      }

      // Adopt an existing deposit written before RN claims were introduced.
      const priorDeposits = await transaction.get(
        db.collection("wallet_deposits").where("referenceNumber", "==", data.referenceNumber),
      );
      const prior = priorDeposits.docs[0];
      if (prior) {
        const priorData = prior.data();
        if (priorData["uid"] !== uid || priorData["method"] !== "ezcash") {
          throw new Error("This eZ Cash reference has already been submitted.");
        }
        transaction.create(claimRef, {
          uid,
          referenceNumber: data.referenceNumber,
          depositId: prior.id,
          status: priorData["status"] ?? "pending",
          createdAt: priorData["createdAt"] ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return {
          duplicate: true,
          depositId: prior.id,
          status: typeof priorData["status"] === "string" ? priorData["status"] : "pending",
        };
      }

      transaction.create(claimRef, {
        uid,
        referenceNumber: data.referenceNumber,
        depositId: "",
        status: "submitting",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { duplicate: false, depositId: "", status: "submitting" };
    });

    if (claim.duplicate) {
      if (!claim.depositId) {
        if (claim.status === "failed") {
          throw new Error("This RN was already rejected. Do not submit it again.");
        }
        throw new Error("This RN is already being submitted. Wait a moment and check your wallet.");
      }
      const existingSnap = await db.doc(`wallet_deposits/${claim.depositId}`).get();
      const existing = existingSnap.data();
      if (existing?.["uid"] !== uid || existing["referenceNumber"] !== data.referenceNumber) {
        throw new Error("This eZ Cash reference has already been submitted.");
      }
      if (existing["status"] === "credited") {
        const amount = Number(existing["creditedLkr"]);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("The existing deposit has an invalid credited amount.");
        }
        const finalAmount = await creditVerifiedDeposit({
          depositId: claim.depositId,
          uid,
          referenceNumber: data.referenceNumber,
          creditedLkr: amount,
        });
        return {
          depositId: claim.depositId,
          creditedLkr: finalAmount,
          status: "credited",
          duplicate: true,
          message: `This RN was already verified. Rs. ${finalAmount.toLocaleString()} was added to your wallet.`,
        };
      }
      if (existing["status"] === "failed") {
        return {
          depositId: claim.depositId,
          creditedLkr: 0,
          status: "failed",
          duplicate: true,
          message: "This RN was already checked and was not verified. Do not submit it again.",
        };
      }

      const statusRes = await nexauraRequest<NexauraDepositResponse>(
        `/deposits/${claim.depositId}`,
      );
      if (!statusRes.success || !statusRes.deposit) {
        throw new Error(statusRes.error?.message ?? "Deposit lookup failed.");
      }
      if (
        statusRes.deposit.deposit_id !== claim.depositId ||
        (statusRes.deposit.rn !== undefined && statusRes.deposit.rn !== data.referenceNumber)
      ) {
        throw new Error("The payment provider returned a different deposit than expected.");
      }
      const duplicateResult = await resolveDeposit({
        uid,
        referenceNumber: data.referenceNumber,
        deposit: statusRes.deposit,
      });
      await updateRnClaim({
        uid,
        referenceNumber: data.referenceNumber,
        depositId: claim.depositId,
        status: duplicateResult.status,
      });
      return {
        ...duplicateResult,
        duplicate: true,
        message:
          duplicateResult.status === "pending"
            ? "This RN was already submitted. Its existing deposit is still being verified."
            : duplicateResult.message,
      };
    }

    // Submit a newly claimed RN to Nexaura exactly once.
    const submitRes = await nexauraRequest<NexauraDepositResponse>("/deposits/ezcash", {
      method: "POST",
      body: JSON.stringify({ rn: data.referenceNumber }),
    });

    if (!submitRes.success || !submitRes.deposit) {
      await db.doc(claimRef.path).update({
        status: "failed",
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw new Error(submitRes.error?.message ?? "eZ Cash deposit submission failed.");
    }

    const deposit = submitRes.deposit;
    const depositId = deposit.deposit_id;
    if (
      typeof depositId !== "string" ||
      !depositId.trim() ||
      depositId.includes("/") ||
      depositId.length > 150 ||
      (deposit.rn !== undefined &&
        (typeof deposit.rn !== "string" || deposit.rn.trim() !== data.referenceNumber)) ||
      !["pending", "credited", "failed"].includes(deposit.status)
    ) {
      throw new Error("The payment provider returned an invalid deposit response.");
    }

    // 3. Record ownership immediately so status checks can be authorised and
    //    the deposit stays traceable while it is still pending.
    const depositRef = getAdminDb().doc(`wallet_deposits/${depositId}`);
    const initialStatus = deposit.status === "credited" ? "pending" : deposit.status;
    await getAdminDb().runTransaction(async (transaction) => {
      const existingSnap = await transaction.get(depositRef);
      const existing = existingSnap.data();
      if (
        existingSnap.exists &&
        (existing?.["uid"] !== uid ||
          existing["referenceNumber"] !== data.referenceNumber ||
          existing["method"] !== "ezcash")
      ) {
        throw new Error("This payment reference is already associated with another account.");
      }
      if (existingSnap.exists && existing?.["status"] === "credited") return;
      transaction.set(
        depositRef,
        {
          depositId,
          uid,
          referenceNumber: data.referenceNumber,
          method: "ezcash",
          // Only creditVerifiedDeposit may mark a deposit credited; it updates
          // the wallet and creditedAt atomically with that status change.
          status: initialStatus,
          creditedLkr: deposit.status === "credited" ? 0 : (deposit.credited_lkr ?? 0),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      transaction.update(claimRef, {
        depositId,
        status: initialStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // 4. If Nexaura already resolved it, answer directly (usually 'pending').
    const result = await resolveDeposit({
      uid,
      referenceNumber: data.referenceNumber,
      deposit,
    });
    await updateRnClaim({
      uid,
      referenceNumber: data.referenceNumber,
      depositId,
      status: result.status,
    });
    return result;
  });

/**
 * Single status lookup for one deposit. Safe to call repeatedly — crediting is
 * idempotent and the deposit must belong to the signed-in user.
 */
export const checkEzCashDeposit = createServerFn({ method: "POST" })
  .validator((raw: unknown): EzCashStatusInput => {
    const input = raw as Partial<EzCashStatusInput>;
    if (!input || typeof input !== "object") throw new Error("Invalid request.");
    if (typeof input.idToken !== "string" || !input.idToken.trim())
      throw new Error("Missing authentication token.");
    if (
      typeof input.depositId !== "string" ||
      !input.depositId.trim() ||
      input.depositId.includes("/") ||
      input.depositId.length > 150
    )
      throw new Error("Missing deposit id.");
    return { idToken: input.idToken, depositId: input.depositId.trim() };
  })
  .handler(async ({ data }): Promise<EzCashDepositResult> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth, getAdminDb } =
      await import("@/server/firebase-admin");

    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);
    const uid = decoded.uid;

    // 1. Only the owner may look up (and therefore credit) this deposit.
    const depositSnap = await getAdminDb().doc(`wallet_deposits/${data.depositId}`).get();
    if (!depositSnap.exists || depositSnap.data()?.["uid"] !== uid) {
      throw new Error("Deposit not found for this account.");
    }
    const record = depositSnap.data() as {
      referenceNumber?: string;
      status?: string;
      creditedLkr?: number;
    };

    // 2. Already credited in an earlier poll — reply immediately, no API call.
    if (record.status === "credited" && Number(record.creditedLkr ?? 0) > 0) {
      const referenceNumber = record.referenceNumber;
      if (!referenceNumber) {
        throw new Error("The existing deposit record is missing its payment reference.");
      }
      const amount = await creditVerifiedDeposit({
        depositId: data.depositId,
        uid,
        referenceNumber,
        creditedLkr: Number(record.creditedLkr),
      });
      return {
        depositId: data.depositId,
        creditedLkr: amount,
        status: "credited",
        message: `Rs. ${amount.toLocaleString()} added to your wallet!`,
      };
    }

    // 3. Exactly one upstream lookup — never loop on the server.
    const res = await nexauraRequest<NexauraDepositResponse>(`/deposits/${data.depositId}`);
    if (!res.success || !res.deposit) {
      throw new Error(res.error?.message ?? "Deposit lookup failed.");
    }
    if (res.deposit.deposit_id !== data.depositId) {
      throw new Error("The payment provider returned a different deposit than requested.");
    }
    if (res.deposit.rn !== undefined && res.deposit.rn !== record.referenceNumber) {
      throw new Error("The payment provider returned a different reference than submitted.");
    }

    const result = await resolveDeposit({
      uid,
      referenceNumber: record.referenceNumber ?? "",
      deposit: res.deposit,
    });
    if (record.referenceNumber) {
      await updateRnClaim({
        uid,
        referenceNumber: record.referenceNumber,
        depositId: data.depositId,
        status: result.status,
      });
    }
    return result;
  });
