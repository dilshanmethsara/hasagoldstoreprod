import { createServerFn } from "@tanstack/react-start";

interface FreeFireLookupResponse {
  success?: boolean;
  player_uid?: string;
  name?: string;
  region?: string;
  source?: "live" | "saved";
  error?: { code?: string; message?: string };
}

export type FreeFirePlayerLookup =
  | {
      status: "verified";
      playerUid: string;
      name: string;
      region: string;
      source: "live" | "saved";
    }
  | { status: "unavailable" };

export const verifyFreeFirePlayer = createServerFn({ method: "POST" })
  .validator((raw: unknown) => {
    const input = raw as { idToken?: unknown; playerUid?: unknown };
    if (typeof input?.idToken !== "string" || !input.idToken.trim()) {
      throw new Error("Sign in to verify your Free Fire Player ID.");
    }
    if (typeof input.playerUid !== "string" || !/^\d{6,15}$/.test(input.playerUid)) {
      throw new Error("Enter a Free Fire Player ID containing 6 to 15 digits.");
    }
    return { idToken: input.idToken, playerUid: input.playerUid };
  })
  .handler(async ({ data }): Promise<FreeFirePlayerLookup> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);

    const key = process.env["NEXAURA_API_KEY"];
    const base = (
      process.env["NEXAURA_BASE_URL"] ?? "https://topup.nexauracore.com/api/v1/reseller"
    ).replace(/\/+$/, "");
    if (!key) throw new Error("Free Fire player verification is not configured on the server.");

    let response: Response;
    try {
      response = await fetch(`${base}/players/${encodeURIComponent(data.playerUid)}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error("Could not reach the Free Fire player lookup service. Try again.");
    }

    let body: FreeFireLookupResponse;
    try {
      body = (await response.json()) as FreeFireLookupResponse;
    } catch {
      throw new Error("The Free Fire player lookup service returned an invalid response.");
    }

    if (response.status === 503 && body.error?.code === "lookup_unavailable") {
      return { status: "unavailable" };
    }
    if (!response.ok || body.success !== true) {
      throw new Error(body.error?.message || "Free Fire Player ID could not be verified.");
    }
    if (
      body.player_uid !== data.playerUid ||
      typeof body.name !== "string" ||
      !body.name.trim() ||
      (body.source !== "live" && body.source !== "saved")
    ) {
      throw new Error("The lookup service returned incomplete player details.");
    }

    return {
      status: "verified",
      playerUid: body.player_uid,
      name: body.name,
      region: typeof body.region === "string" ? body.region : "",
      source: body.source,
    };
  });
