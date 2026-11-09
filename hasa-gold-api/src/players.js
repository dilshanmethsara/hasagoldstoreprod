/**
 * Player ID verification routes.
 *
 * GET /v1/players/free-fire/:playerUid   — Nexaura lookup (authenticated)
 * GET /v1/players/blood-strike/:playerUid — Shop2Topup lookup (authenticated)
 */
import { ApiError, asyncRoute } from "./errors.js";

function getNexaura() {
  const apiKey = process.env.NEXAURA_API_KEY?.trim();
  const baseUrl = (
    process.env.NEXAURA_BASE_URL || "https://topup.nexauracore.com/api/v1/reseller"
  ).replace(/\/+$/, "");
  if (!apiKey) {
    throw new ApiError(
      503,
      "Free Fire player verification is not configured.",
      "provider_unconfigured",
    );
  }
  return { apiKey, baseUrl };
}

function getShop2Topup() {
  const apiKey = process.env.SHOP2TOPUP_API_KEY?.trim();
  const baseUrl = (process.env.SHOP2TOPUP_API_BASE_URL || "https://portal.shop2topup.com").replace(
    /\/+$/,
    "",
  );
  if (!apiKey) {
    throw new ApiError(
      503,
      "Blood Strike player verification is not configured.",
      "provider_unconfigured",
    );
  }
  return { apiKey, baseUrl };
}

export const verifyFreeFirePlayer = asyncRoute(async (req, res) => {
  const playerUid = req.params.playerUid?.trim() ?? "";
  if (!/^\d{6,15}$/.test(playerUid)) {
    throw new ApiError(
      400,
      "Enter a Free Fire Player ID containing 6 to 15 digits.",
      "invalid_player_id",
    );
  }

  let config;
  try {
    config = getNexaura();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Free Fire player verification is not configured.",
      "provider_unconfigured",
    );
  }
  const { apiKey, baseUrl } = config;

  let response;
  try {
    response = await fetch(`${baseUrl}/players/${encodeURIComponent(playerUid)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      503,
      "Could not reach the Free Fire player lookup service. Try again.",
      "provider_unavailable",
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      502,
      "The Free Fire player lookup service returned an invalid response.",
      "provider_invalid_response",
    );
  }

  if (response.status === 503 && body?.error?.code === "lookup_unavailable") {
    return res.json({ status: "unavailable" });
  }
  if (!response.ok || body?.success !== true) {
    throw new ApiError(
      400,
      body?.error?.message || "Free Fire Player ID could not be verified.",
      "player_not_found",
    );
  }
  if (
    body.player_uid !== playerUid ||
    typeof body.name !== "string" ||
    !body.name.trim() ||
    (body.source !== "live" && body.source !== "saved")
  ) {
    throw new ApiError(
      502,
      "The lookup service returned incomplete player details.",
      "provider_invalid_response",
    );
  }

  res.json({
    status: "verified",
    playerUid: body.player_uid,
    name: body.name,
    region: typeof body.region === "string" ? body.region : "",
    source: body.source,
  });
});

export const verifyBloodStrikePlayer = asyncRoute(async (req, res) => {
  const playerUid = req.params.playerUid?.trim() ?? "";
  if (!playerUid || playerUid.length > 128) {
    throw new ApiError(400, "Enter a valid Blood Strike Player ID.", "invalid_player_id");
  }
  const server =
    typeof req.query.server === "string" ? req.query.server.trim().slice(0, 100) : undefined;

  let config;
  try {
    config = getShop2Topup();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "Blood Strike player verification is not configured.",
      "provider_unconfigured",
    );
  }
  const { apiKey, baseUrl } = config;

  let response;
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
        player_id: playerUid,
        ...(server ? { server } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new ApiError(
      503,
      "Could not reach the Blood Strike player lookup service. Try again.",
      "provider_unavailable",
    );
  }

  if (response.status === 503) return res.json({ status: "unavailable" });
  if (response.status === 429) {
    throw new ApiError(
      429,
      "Shop2Topup player-check quota reached. Try again later.",
      "rate_limited",
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new ApiError(
      502,
      "Shop2Topup returned an invalid Blood Strike validation response.",
      "provider_invalid_response",
    );
  }

  const errorCode = body?.error?.code ?? body?.code;
  if (errorCode === "PLAYER_CHECK_UNAVAILABLE") return res.json({ status: "unavailable" });
  if (errorCode === "PLAYER_NOT_FOUND") {
    throw new ApiError(
      400,
      "Blood Strike Player ID was not found. Check the ID and try again.",
      "player_not_found",
    );
  }
  if (!response.ok || body?.success !== true) {
    throw new ApiError(
      400,
      body?.error?.message || body?.message || "Blood Strike Player ID could not be verified.",
      "player_not_found",
    );
  }

  const player = body?.data;
  if (
    !player ||
    player.player_id !== playerUid ||
    typeof player.player_name !== "string" ||
    !player.player_name.trim()
  ) {
    throw new ApiError(
      502,
      "Shop2Topup returned incomplete Blood Strike player details.",
      "provider_invalid_response",
    );
  }

  res.json({
    status: "verified",
    playerUid: player.player_id,
    name: player.player_name.trim(),
    region: typeof player.region === "string" ? player.region : "",
  });
});
