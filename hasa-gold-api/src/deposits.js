/**
 * eZ Cash wallet deposit routes.
 *
 * POST /v1/deposits/ezcash          — initiate a new deposit with a 14-digit RN
 * GET  /v1/deposits/:depositId      — poll status of an existing deposit
 *
 * Wallet credits use an atomic SQL increment inside a transaction, replacing
 * the Firestore FieldValue.increment() pattern.
 */
import { createHash } from "node:crypto";
import { ApiError, asyncRoute } from "./errors.js";
import { db } from "./db.js";
import { toNum } from "./serialize.js";

function getNexaura() {
  const apiKey = process.env.NEXAURA_API_KEY?.trim();
  const baseUrl = (
    process.env.NEXAURA_BASE_URL || "https://topup.nexauracore.com/api/v1/reseller"
  ).replace(/\/+$/, "");
  if (!apiKey) {
    throw new ApiError(
      503,
      "eZ Cash deposits are not configured on the server.",
      "provider_unconfigured",
    );
  }
  return { apiKey, baseUrl };
}

async function nexauraRequest(url, init = {}) {
  const { apiKey } = getNexaura();
  const base = (
    process.env.NEXAURA_BASE_URL || "https://topup.nexauracore.com/api/v1/reseller"
  ).replace(/\/+$/, "");
  const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
  let response;
  try {
    response = await fetch(fullUrl, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      503,
      "The payment provider could not be reached. Try again.",
      "provider_unavailable",
    );
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      502,
      "The payment provider returned an invalid response.",
      "provider_invalid_response",
    );
  }
  if (!response.ok) {
    throw new ApiError(
      502,
      body?.error?.message || "Payment provider request failed.",
      "provider_request_failed",
    );
  }
  return body;
}

function rnClaimId(referenceNumber) {
  return createHash("sha256").update(referenceNumber).digest("hex");
}

async function creditVerifiedDeposit({ depositId, uid, referenceNumber, creditedLkr }) {
  return db.transaction(async (tx) => {
    const depositRes = await tx.query("SELECT * FROM wallet_deposits WHERE deposit_id = $1", [
      depositId,
    ]);
    const userRes = await tx.query("SELECT 1 FROM users WHERE uid = $1", [uid]);
    if (userRes.rows.length === 0) {
      throw new ApiError(404, "Account profile not found for this deposit.", "profile_missing");
    }
    const existing = depositRes.rows[0];
    if (
      existing &&
      (existing.uid !== uid ||
        existing.reference_number !== referenceNumber ||
        existing.method !== "ezcash")
    ) {
      throw new ApiError(
        409,
        "This payment reference is already associated with another account.",
        "reference_conflict",
      );
    }
    // Already credited — idempotent.
    if (existing && existing.status === "credited" && existing.credited_at != null) {
      const already = toNum(existing.credited_lkr);
      if (!Number.isFinite(already) || already <= 0) {
        throw new ApiError(
          500,
          "The existing deposit record has an invalid credited amount.",
          "invalid_deposit",
        );
      }
      return already;
    }
    await tx.query(
      `INSERT INTO wallet_deposits
         (deposit_id, uid, reference_number, method, status, credited_lkr, credited_at, updated_at)
       VALUES ($1,$2,$3,'ezcash','credited',$4,now(),now())
       ON CONFLICT (deposit_id) DO UPDATE
         SET status = 'credited', credited_lkr = EXCLUDED.credited_lkr,
             credited_at = now(), updated_at = now()`,
      [depositId, uid, referenceNumber, creditedLkr],
    );
    await tx.query(
      "UPDATE users SET wallet_balance_lkr = wallet_balance_lkr + $1, updated_at = now() WHERE uid = $2",
      [creditedLkr, uid],
    );
    return creditedLkr;
  });
}

async function resolveDeposit({ uid, referenceNumber, deposit }) {
  const depositId = deposit.deposit_id;
  if (deposit.status === "failed") {
    try {
      await db.query(
        "UPDATE wallet_deposits SET status = 'failed', updated_at = now() WHERE deposit_id = $1",
        [depositId],
      );
    } catch (error) {
      console.error("Could not record failed eZ Cash deposit:", error);
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
    return {
      depositId,
      creditedLkr: 0,
      status: "pending",
      message:
        "Reference submitted. eZ Cash verification is pending; no wallet credit has been recorded yet.",
    };
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
 * POST /v1/deposits/ezcash
 */
export const initiateEzCashDeposit = asyncRoute(async (req, res) => {
  const rn = String(req.body?.referenceNumber ?? "").trim();
  if (!/^\d{14}$/.test(rn)) {
    throw new ApiError(
      400,
      "Enter the 14-digit eZ Cash reference number from your confirmation SMS.",
      "invalid_reference",
    );
  }
  const uid = req.user.uid;
  const claimRefId = rnClaimId(rn);

  const claim = await db.transaction(async (tx) => {
    const claimRes = await tx.query("SELECT * FROM wallet_deposit_rns WHERE claim_id = $1", [
      claimRefId,
    ]);
    if (claimRes.rows.length > 0) {
      const existing = claimRes.rows[0];
      if (existing.uid !== uid || existing.reference_number !== rn) {
        throw new ApiError(
          409,
          "This eZ Cash reference has already been submitted.",
          "reference_conflict",
        );
      }
      return {
        duplicate: true,
        depositId: typeof existing.deposit_id === "string" ? existing.deposit_id : "",
        status: existing.status,
      };
    }

    // Adopt an existing deposit written before RN claims existed.
    const priorRes = await tx.query(
      "SELECT * FROM wallet_deposits WHERE reference_number = $1 LIMIT 1",
      [rn],
    );
    const prior = priorRes.rows[0];
    if (prior) {
      if (prior.uid !== uid || prior.method !== "ezcash") {
        throw new ApiError(
          409,
          "This eZ Cash reference has already been submitted.",
          "reference_conflict",
        );
      }
      await tx.query(
        `INSERT INTO wallet_deposit_rns (claim_id, uid, reference_number, deposit_id, status, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,now(),now())`,
        [claimRefId, uid, rn, prior.deposit_id, prior.status ?? "pending"],
      );
      return { duplicate: true, depositId: prior.deposit_id, status: prior.status ?? "pending" };
    }

    await tx.query(
      `INSERT INTO wallet_deposit_rns (claim_id, uid, reference_number, deposit_id, status)
       VALUES ($1,$2,$3,NULL,'submitting')`,
      [claimRefId, uid, rn],
    );
    return { duplicate: false, depositId: "", status: "submitting" };
  });

  if (claim.duplicate) {
    if (!claim.depositId) {
      if (claim.status === "failed") {
        throw new ApiError(
          409,
          "This RN was already rejected. Do not submit it again.",
          "reference_rejected",
        );
      }
      throw new ApiError(
        409,
        "This RN is already being submitted. Wait a moment and check your wallet.",
        "reference_in_progress",
      );
    }
    const existingRes = await db.query("SELECT * FROM wallet_deposits WHERE deposit_id = $1", [
      claim.depositId,
    ]);
    const existing = existingRes.rows[0];
    if (!existing || existing.uid !== uid || existing.reference_number !== rn) {
      throw new ApiError(
        409,
        "This eZ Cash reference has already been submitted.",
        "reference_conflict",
      );
    }
    if (existing.status === "credited") {
      const finalAmount = await creditVerifiedDeposit({
        depositId: claim.depositId,
        uid,
        referenceNumber: rn,
        creditedLkr: toNum(existing.credited_lkr) ?? 0,
      });
      return res.json({
        depositId: claim.depositId,
        creditedLkr: finalAmount,
        status: "credited",
        duplicate: true,
        message: `This RN was already verified. Rs. ${finalAmount.toLocaleString()} was added to your wallet.`,
      });
    }
    if (existing.status === "failed") {
      return res.json({
        depositId: claim.depositId,
        creditedLkr: 0,
        status: "failed",
        duplicate: true,
        message: "This RN was already checked and was not verified. Do not submit it again.",
      });
    }
    const { baseUrl } = getNexaura();
    const statusBody = await nexauraRequest(`${baseUrl}/deposits/${claim.depositId}`);
    if (!statusBody.success || !statusBody.deposit) {
      throw new ApiError(
        502,
        statusBody.error?.message ?? "Deposit lookup failed.",
        "provider_request_failed",
      );
    }
    const dupResult = await resolveDeposit({
      uid,
      referenceNumber: rn,
      deposit: statusBody.deposit,
    });
    try {
      await db.query(
        "UPDATE wallet_deposit_rns SET status = $1, updated_at = now() WHERE claim_id = $2",
        [dupResult.status, claimRefId],
      );
    } catch {
      /* best effort */
    }
    return res.json({ ...dupResult, duplicate: true });
  }

  const { baseUrl } = getNexaura();
  const submitBody = await nexauraRequest(`${baseUrl}/deposits/ezcash`, {
    method: "POST",
    body: JSON.stringify({ rn }),
  });

  if (!submitBody.success || !submitBody.deposit) {
    await db
      .query(
        "UPDATE wallet_deposit_rns SET status = 'failed', updated_at = now() WHERE claim_id = $1",
        [claimRefId],
      )
      .catch(() => {});
    throw new ApiError(
      502,
      submitBody.error?.message ?? "eZ Cash deposit submission failed.",
      "provider_request_failed",
    );
  }

  const deposit = submitBody.deposit;
  const depositId = deposit.deposit_id;
  if (
    typeof depositId !== "string" ||
    !depositId.trim() ||
    depositId.includes("/") ||
    depositId.length > 150 ||
    (deposit.rn !== undefined && deposit.rn !== rn) ||
    !["pending", "credited", "failed"].includes(deposit.status)
  ) {
    throw new ApiError(
      502,
      "The payment provider returned an invalid deposit response.",
      "provider_invalid_response",
    );
  }

  await db.transaction(async (tx) => {
    const existingRes = await tx.query("SELECT * FROM wallet_deposits WHERE deposit_id = $1", [
      depositId,
    ]);
    const existing = existingRes.rows[0];
    if (
      existing &&
      (existing.uid !== uid || existing.reference_number !== rn || existing.method !== "ezcash")
    ) {
      throw new ApiError(
        409,
        "This payment reference is already associated with another account.",
        "reference_conflict",
      );
    }
    if (existing && existing.status === "credited") return;
    const status = deposit.status === "credited" ? "pending" : deposit.status;
    const creditedLkr = deposit.status === "credited" ? 0 : (deposit.credited_lkr ?? 0);
    await tx.query(
      `INSERT INTO wallet_deposits
         (deposit_id, uid, reference_number, method, status, credited_lkr, created_at, updated_at)
       VALUES ($1,$2,$3,'ezcash',$4,$5,now(),now())
       ON CONFLICT (deposit_id) DO UPDATE
         SET status = EXCLUDED.status, credited_lkr = EXCLUDED.credited_lkr, updated_at = now()`,
      [depositId, uid, rn, status, creditedLkr],
    );
    await tx.query(
      "UPDATE wallet_deposit_rns SET deposit_id = $1, status = $2, updated_at = now() WHERE claim_id = $3",
      [depositId, status, claimRefId],
    );
  });

  const result = await resolveDeposit({ uid, referenceNumber: rn, deposit });
  try {
    await db.query(
      "UPDATE wallet_deposit_rns SET status = $1, updated_at = now() WHERE claim_id = $2",
      [result.status, claimRefId],
    );
  } catch {
    /* best effort */
  }
  res.json(result);
});

/**
 * GET /v1/deposits/:depositId
 */
export const checkEzCashDeposit = asyncRoute(async (req, res) => {
  const depositId = req.params.depositId?.trim() ?? "";
  if (!depositId || depositId.includes("/") || depositId.length > 150) {
    throw new ApiError(400, "Invalid deposit ID.", "invalid_deposit_id");
  }
  const uid = req.user.uid;
  const depositRes = await db.query("SELECT * FROM wallet_deposits WHERE deposit_id = $1", [
    depositId,
  ]);
  if (depositRes.rows.length === 0 || depositRes.rows[0].uid !== uid) {
    throw new ApiError(404, "Deposit not found for this account.", "deposit_not_found");
  }
  const record = depositRes.rows[0];

  if (record.status === "credited" && toNum(record.credited_lkr) > 0) {
    if (!record.reference_number) {
      throw new ApiError(
        500,
        "The existing deposit record is missing its payment reference.",
        "invalid_deposit",
      );
    }
    const amount = await creditVerifiedDeposit({
      depositId,
      uid,
      referenceNumber: record.reference_number,
      creditedLkr: toNum(record.credited_lkr) ?? 0,
    });
    return res.json({
      depositId,
      creditedLkr: amount,
      status: "credited",
      message: `Rs. ${amount.toLocaleString()} added to your wallet!`,
    });
  }

  const { baseUrl } = getNexaura();
  const body = await nexauraRequest(`${baseUrl}/deposits/${depositId}`);
  if (!body.success || !body.deposit) {
    throw new ApiError(
      502,
      body.error?.message ?? "Deposit lookup failed.",
      "provider_request_failed",
    );
  }
  if (body.deposit.deposit_id !== depositId) {
    throw new ApiError(
      502,
      "The payment provider returned a different deposit than requested.",
      "provider_invalid_response",
    );
  }
  if (body.deposit.rn !== undefined && body.deposit.rn !== record.reference_number) {
    throw new ApiError(
      502,
      "The payment provider returned a different reference than submitted.",
      "provider_invalid_response",
    );
  }

  const result = await resolveDeposit({
    uid,
    referenceNumber: record.reference_number ?? "",
    deposit: body.deposit,
  });

  if (record.reference_number) {
    try {
      const claimRefId = rnClaimId(record.reference_number);
      await db.query(
        "UPDATE wallet_deposit_rns SET status = $1, updated_at = now() WHERE claim_id = $2",
        [result.status, claimRefId],
      );
    } catch {
      /* best effort */
    }
  }
  res.json(result);
});
