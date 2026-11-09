/**
 * Payment proof routes for customers.
 *
 * POST /v1/orders/:orderId/proof/token   — create a Supabase signed upload URL
 * POST /v1/orders/:orderId/proof/submit  — confirm the upload is complete
 * GET  /v1/orders/:orderId/proof/view    — get a temporary view URL
 */
import { ApiError, asyncRoute } from "./errors.js";
import { db } from "./db.js";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "payment-proofs";
  if (!url || !key) {
    throw new ApiError(503, "File storage is not configured.", "storage_unconfigured");
  }
  return { url, key, bucket };
}

async function supabasePost(endpoint, body) {
  const { url, key } = getSupabaseConfig();
  const res = await fetch(`${url}/storage/v1${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!res.ok) {
    throw new ApiError(502, `Storage error: ${json?.message || text}`, "storage_error");
  }
  return json;
}

async function createUploadToken(storagePath) {
  const { bucket } = getSupabaseConfig();
  const data = await supabasePost(`/object/upload/sign/${bucket}/${storagePath}`, {});
  const relUrl = data?.url ?? data?.signedURL;
  if (!relUrl) throw new ApiError(502, "Storage returned an empty upload URL.", "storage_error");
  const { url } = getSupabaseConfig();
  const signedUrl = relUrl.startsWith("http") ? relUrl : `${url}/storage/v1${relUrl}`;
  return { signedUrl, token: data?.token ?? "" };
}

async function createViewUrl(storagePath) {
  const { bucket } = getSupabaseConfig();
  const data = await supabasePost(`/object/sign/${bucket}/${storagePath}`, { expiresIn: 300 });
  const relUrl = data?.signedURL ?? data?.url;
  if (!relUrl) throw new ApiError(502, "Storage returned an empty signed URL.", "storage_error");
  const { url } = getSupabaseConfig();
  return relUrl.startsWith("http") ? relUrl : `${url}/storage/v1${relUrl}`;
}

async function validateUploadedProof(storagePath) {
  const { bucket } = getSupabaseConfig();
  const slashIdx = storagePath.lastIndexOf("/");
  const directory = storagePath.slice(0, slashIdx);
  const fileName = storagePath.slice(slashIdx + 1);
  const data = await supabasePost(`/object/list/${bucket}`, {
    prefix: directory,
    limit: 20,
    search: fileName,
  });
  const file = Array.isArray(data) ? data.find((f) => f.name === fileName) : null;
  const size = Number(file?.metadata?.size ?? file?.metadata?.["content-length"] ?? 0);
  const contentType =
    file?.metadata?.mimetype ??
    file?.metadata?.contentType ??
    file?.metadata?.["content-type"] ??
    "application/octet-stream";
  const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!file) {
    throw new ApiError(
      422,
      "No payment proof file was found. Upload the file first.",
      "proof_not_uploaded",
    );
  }
  if (!allowed.includes(contentType)) {
    throw new ApiError(
      422,
      "Only JPEG, PNG, WebP, or PDF files are accepted.",
      "invalid_file_type",
    );
  }
  if (size <= 0 || size > 5 * 1024 * 1024) {
    throw new ApiError(
      422,
      "The payment proof file is empty or exceeds 5 MB.",
      "invalid_file_size",
    );
  }
  return contentType;
}

function assertProofOrder(record, uid, configuredMethods) {
  if (!record || record.customer_uid !== uid) {
    throw new ApiError(404, "This order was not found in your account.", "order_not_found");
  }
  const methodId = String(record.payment_method ?? "");
  const methods = Array.isArray(configuredMethods) ? configuredMethods : [];
  const method = methods.find((entry) => entry && entry.id === methodId);
  // Admin-configured flag wins. The wallet never takes a receipt, and a method
  // missing from settings (or saved before the flag existed) keeps requiring
  // proof, so historical eZ Cash orders behave exactly as before.
  const requiresProof =
    methodId === "wallet" ? false : method ? method.requiresProof !== false : true;
  if (!requiresProof) {
    throw new ApiError(
      409,
      "This payment method does not require a payment receipt.",
      "proof_not_required",
    );
  }
  if (!["unpaid", "failed", "proof_rejected"].includes(String(record.payment_status))) {
    throw new ApiError(
      409,
      "This order is no longer accepting payment proof.",
      "proof_not_accepted",
    );
  }
}

async function loadConfiguredPaymentMethods() {
  const { rows } = await db.query("SELECT payment_methods FROM store_settings WHERE id = 1");
  const value = rows[0]?.payment_methods;
  return Array.isArray(value) ? value : [];
}

export { assertProofOrder, loadConfiguredPaymentMethods };

/**
 * POST /v1/orders/:orderId/proof/token
 */
export const getProofUploadToken = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  const uid = req.user.uid;
  const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  assertProofOrder(rows[0], uid, await loadConfiguredPaymentMethods());
  const path = `${uid}/${orderId}/proof`;
  const { signedUrl, token } = await createUploadToken(path);
  res.json({ path, signedUrl, token });
});

/**
 * POST /v1/orders/:orderId/proof/submit
 */
export const submitProof = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  const uid = req.user.uid;
  const fileName = String(req.body?.fileName ?? "")
    .replace(/[\\/]/g, "_")
    .trim();
  if (!fileName || fileName.length > 200) {
    throw new ApiError(400, "Choose a valid payment proof image.", "invalid_file_name");
  }
  const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  assertProofOrder(rows[0], uid, await loadConfiguredPaymentMethods());

  const storagePath = `${uid}/${orderId}/proof`;
  const contentType = await validateUploadedProof(storagePath);
  await db.query(
    `UPDATE orders
        SET payment_status = 'proof_submitted', status = 'payment_review',
            payment_proof_storage_path = $1, payment_proof_storage_provider = 'supabase',
            payment_proof_content_type = $2, payment_proof_file_name = $3,
            payment_proof_submitted_at = now(), updated_at = now()
      WHERE order_id = $4`,
    [storagePath, contentType, fileName, orderId],
  );
  res.json({ orderId, status: "payment_review", paymentStatus: "proof_submitted" });
});

/**
 * GET /v1/orders/:orderId/proof/view
 */
export const viewProof = asyncRoute(async (req, res) => {
  const orderId = req.params.orderId;
  const uid = req.user.uid;
  const { rows } = await db.query("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  const record = rows[0];
  if (!record || record.customer_uid !== uid) {
    throw new ApiError(404, "This order was not found in your account.", "order_not_found");
  }
  const storagePath = record.payment_proof_storage_path;
  if (typeof storagePath !== "string") {
    throw new ApiError(404, "No payment proof has been submitted.", "proof_not_found");
  }
  if (record.payment_proof_storage_provider === "supabase") {
    if (storagePath !== `${uid}/${orderId}/proof`) {
      throw new ApiError(404, "This order has no valid payment proof.", "proof_not_found");
    }
    return res.json({ url: await createViewUrl(storagePath) });
  }
  throw new ApiError(
    501,
    "Legacy payment proofs are not accessible through this API.",
    "legacy_storage",
  );
});
