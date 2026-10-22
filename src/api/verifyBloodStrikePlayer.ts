import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  idToken: z.string().min(1).max(5000),
  playerUid: z.string().trim().min(1).max(128),
  server: z.string().trim().max(100).optional(),
});

interface Shop2TopupValidationResponse {
  success?: boolean;
  data?: {
    player_id?: string;
    player_name?: string;
    region?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
  code?: string;
  message?: string;
}

export type BloodStrikePlayerLookup =
  | { status: "verified"; playerUid: string; name: string; region: string }
  | { status: "unavailable" };

export const verifyBloodStrikePlayer = createServerFn({ method: "POST" })
  .validator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }): Promise<BloodStrikePlayerLookup> => {
    const { assertCustomerProfileComplete, assertEmailVerified, getAdminAuth } =
      await import("@/server/firebase-admin");
    const decoded = await getAdminAuth().verifyIdToken(data.idToken, true);
    assertEmailVerified(decoded);
    await assertCustomerProfileComplete(decoded.uid);

    const apiKey = process.env["SHOP2TOPUP_API_KEY"];
    if (!apiKey) {
      throw new Error("Blood Strike player verification is not configured on the server.");
    }

    const baseUrl = (
      process.env["SHOP2TOPUP_API_BASE_URL"] ?? "https://portal.shop2topup.com"
    ).replace(/\/+$/, "");
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/endpoints/v1/player/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          sub_category_id: 1647,
          player_id: data.playerUid,
          ...(data.server ? { server: data.server } : {}),
        }),
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new Error("Could not reach the Blood Strike player lookup service. Try again.");
    }

    if (response.status === 503) return { status: "unavailable" };
    if (response.status === 429) {
      throw new Error("Shop2Topup player-check quota reached. Try again later.");
    }

    let body: Shop2TopupValidationResponse;
    try {
      body = (await response.json()) as Shop2TopupValidationResponse;
    } catch {
      throw new Error("Shop2Topup returned an invalid Blood Strike validation response.");
    }

    const errorCode = body.error?.code ?? body.code;
    if (errorCode === "PLAYER_CHECK_UNAVAILABLE") {
      return { status: "unavailable" };
    }
    if (errorCode === "PLAYER_NOT_FOUND") {
      throw new Error("Blood Strike Player ID was not found. Check the ID and try again.");
    }
    if (!response.ok || body.success !== true) {
      throw new Error(
        body.error?.message || body.message || "Blood Strike Player ID could not be verified.",
      );
    }

    const player = body.data;
    if (
      !player ||
      player.player_id !== data.playerUid ||
      typeof player.player_name !== "string" ||
      !player.player_name.trim()
    ) {
      throw new Error("Shop2Topup returned incomplete Blood Strike player details.");
    }

    return {
      status: "verified",
      playerUid: player.player_id,
      name: player.player_name.trim(),
      region: typeof player.region === "string" ? player.region : "",
    };
  });
