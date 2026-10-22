import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_BUCKET = "payment-proofs";

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (client) return client;
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase receipt storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.",
    );
  }
  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function getSupabaseProofBucket(): string {
  return (
    process.env["SUPABASE_STORAGE_BUCKET"] ??
    process.env["VITE_SUPABASE_STORAGE_BUCKET"] ??
    DEFAULT_BUCKET
  );
}

export async function createProofUploadToken(path: string): Promise<{ signedUrl: string; token: string }> {
  const { data, error } = await getSupabaseClient()
    .storage.from(getSupabaseProofBucket())
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw new Error(`Could not authorize receipt upload: ${error.message}`);
  return { signedUrl: data.signedUrl, token: data.token };
}

export async function validateUploadedProof(path: string): Promise<string> {
  const slash = path.lastIndexOf("/");
  const directory = path.slice(0, slash);
  const fileName = path.slice(slash + 1);
  const { data, error } = await getSupabaseClient()
    .storage.from(getSupabaseProofBucket())
    .list(directory, { limit: 20, search: fileName });
  if (error) throw new Error(`Could not verify uploaded receipt: ${error.message}`);
  const file = data.find((entry) => entry.name === fileName);
  const size = Number(file?.metadata?.["size"]);
  const contentType =
    file?.metadata?.["mimetype"] ??
    file?.metadata?.["contentType"] ??
    file?.metadata?.["content-type"];
  if (
    !file ||
    !Number.isFinite(size) ||
    size <= 0 ||
    size > 5 * 1024 * 1024 ||
    typeof contentType !== "string" ||
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(contentType)
  ) {
    throw new Error("The uploaded proof must be a JPEG, PNG, WebP, or PDF file under 5 MB.");
  }
  return contentType;
}

export async function createProofViewUrl(path: string): Promise<string> {
  const { data, error } = await getSupabaseClient()
    .storage.from(getSupabaseProofBucket())
    .createSignedUrl(path, 5 * 60);
  if (error) throw new Error(`Could not open payment proof: ${error.message}`);
  return data.signedUrl;
}
