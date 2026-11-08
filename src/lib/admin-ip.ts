/**
 * Client-IP matching for the admin access allowlist.
 *
 * The allowlist is a comma-separated list of IPv4 addresses and/or CIDR blocks,
 * e.g. `203.0.113.10,198.51.100.0/24`. IPv6 and IPv4-mapped IPv6 forms are
 * handled so `::ffff:203.0.113.10` matches `203.0.113.10`.
 *
 * The same module is imported by the frontend (request middleware in
 * `src/start.ts`) and by the backend (`hasa-gold-api/src/admin-access.js`),
 * so both layers agree on exactly which addresses may reach `/admin`.
 */

/** Parse the configured allowlist into a list of { ip, bits } networks. */
export function parseIpAllowlist(raw: string | undefined | null): Array<{
  ip: number;
  bits: number;
}> {
  if (typeof raw !== "string" || !raw.trim()) return [];

  const networks: Array<{ ip: number; bits: number }> = [];
  for (const entry of raw.split(",")) {
    const value = entry.trim();
    if (!value) continue;
    const [address, prefix] = value.split("/");
    const parsed = ipv4ToInt(address);
    if (parsed === null) continue; // IPv6 entries are ignored (VPS traffic is IPv4).
    const bits =
      prefix === undefined ? 32 : Math.min(32, Math.max(0, Number.parseInt(prefix, 10) || 0));
    networks.push({ ip: maskToBits(parsed, bits), bits });
  }
  return networks;
}

/** IPv4 dotted-quad (or IPv4-mapped IPv6) to a 32-bit integer, or null. */
export function ipv4ToInt(address: string | undefined | null): number | null {
  if (typeof address !== "string") return null;
  let value = address.trim();
  if (!value) return null;
  // Strip an IPv4-mapped IPv6 prefix: ::ffff:203.0.113.10 -> 203.0.113.10
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  if (mapped?.[1]) value = mapped[1];
  const withoutBrackets = value.replace(/^\[|\]$/g, "");
  const parts = withoutBrackets.split(".");
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

function maskToBits(ip: number, bits: number): number {
  if (bits <= 0) return 0;
  // Zero the host bits outside the prefix so exact and CIDR entries compare
  // on the same normalised value.
  const shift = 32 - bits;
  return (ip >>> shift) << shift;
}

/** True when the given client IP is inside the allowlist. */
export function isIpAllowed(
  clientIp: string | null | undefined,
  networks: Array<{
    ip: number;
    bits: number;
  }>,
): boolean {
  if (!networks.length) return false;
  const value = ipv4ToInt(clientIp);
  if (value === null) return false;
  return networks.some((network) => maskToBits(value, network.bits) === network.ip);
}

/**
 * Resolve the caller's public IP from a request's forwarded headers.
 * `x-forwarded-for` may be a chain; the left-most entry is the original client.
 */
export function getClientIpFromHeaders(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}
