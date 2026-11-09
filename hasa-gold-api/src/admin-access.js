/**
 * Administrative route IP gate for the Express API.
 *
 * The admin panel lives on the frontend host, but every operation it performs
 * calls `https://api.hasagold.store/v1/admin/*`. Those routes are additionally
 * restricted here so that knowing the API alone is not enough: the caller's IP
 * must appear in ADMIN_IP_ALLOWLIST.
 *
 * ADMIN_IP_ALLOWLIST is a comma-separated list of IPv4 addresses and/or CIDR
 * blocks (e.g. `203.0.113.10,198.51.100.0/24`). When it is unset the gate is
 * disabled and a warning is logged at startup — the operator always keeps
 * access to their own API. */

import { ApiError } from "./errors.js";

const LOCAL_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);

function ipv4ToInt(address) {
  if (typeof address !== "string") return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(address.trim());
  const value = mapped ? mapped[1] : address.trim().replace(/^\[|\]$/g, "");
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number.parseInt(part, 10);
    if (octet > 255) return null;
    result = result * 256 + octet;
  }
  return result >>> 0;
}

function maskToBits(ip, bits) {
  if (bits <= 0) return 0;
  const shift = 32 - bits;
  return (ip >>> shift) << shift;
}

function parseAllowlist(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const networks = [];
  for (const entry of raw.split(",")) {
    const value = entry.trim();
    if (!value) continue;
    const [address, prefix] = value.split("/");
    const ip = ipv4ToInt(address);
    if (ip === null) continue;
    const bits =
      prefix === undefined ? 32 : Math.min(32, Math.max(0, Number.parseInt(prefix, 10) || 0));
    networks.push({ ip: maskToBits(ip, bits), bits });
  }
  return networks;
}

let cachedAllowlist = null;
let cachedAllowlistSource = null;
let warnedUnset = false;

/**
 * Resolve the caller's real IP. nginx overwrites `X-Real-IP` with the socket
 * peer address, so it cannot be spoofed; `X-Forwarded-For` is trusted only for
 * its right-most entry (the hop appended by nginx), because a client can
 * prepend anything to that header.
 */
export function resolveRequestIp(req) {
  const realIp = req.get?.("x-real-ip") || req.headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();

  const forwarded = req.get?.("x-forwarded-for") || req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const parts = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }

  return req.ip || req.socket?.remoteAddress || null;
}

function ipAllowed(ip, networks) {
  const value = ipv4ToInt(ip);
  if (value === null) return false;
  return networks.some((network) => maskToBits(value, network.bits) === network.ip);
}

/** Express middleware — mount before any /v1/admin route. */
export function adminIpGate(req, _res, next) {
  const source = process.env.ADMIN_IP_ALLOWLIST;
  if (cachedAllowlistSource !== source) {
    cachedAllowlistSource = source;
    cachedAllowlist = parseAllowlist(source);
    if (!cachedAllowlist.length && !warnedUnset) {
      warnedUnset = true;
      console.warn(
        "[admin-ip] ADMIN_IP_ALLOWLIST is not set - /v1/admin/* is reachable from any IP. " +
          "Set an IPv4/CIDR allowlist to turn the gate on.",
      );
    }
  }

  if (!cachedAllowlist.length) return next();

  const clientIp = resolveRequestIp(req);
  if (!clientIp || LOCAL_IPS.has(clientIp) || ipAllowed(clientIp, cachedAllowlist)) {
    return next();
  }

  console.warn(`[admin-ip] rejected admin API call from ${clientIp} for ${req.originalUrl}`);
  next(new ApiError(404, "This endpoint was not found.", "not_found"));
}

export { parseAllowlist as _parseAllowlist, ipAllowed as _ipAllowed };
