import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { getClientIpFromHeaders, isIpAllowed, parseIpAllowlist } from "./lib/admin-ip";
import { renderChromeUnreachablePage } from "./lib/error-page";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

/**
 * Admin area IP gate.
 *
 * `/admin*` and `/admin-login` are only served to addresses listed in
 * ADMIN_IP_ALLOWLIST (a comma-separated list of IPv4 addresses and/or CIDR
 * blocks). Every other caller gets Google Chrome's "site can't be reached"
 * page, so the protected area never reveals that it exists.
 *
 * Because this is a *request* middleware it runs before any route or server
 * function code in both production (Nitro server bundle) and development
 * (Vite SSR).
 *
 * When ADMIN_IP_ALLOWLIST is unset the gate fails open and logs a warning, so
 * a missing variable can never lock you out of your own panel.
 */
const ADMIN_PATH_PREFIX = "/admin";
const ADMIN_LOGIN_PATH = "/admin-login";

/** True for /admin, /admin-login and anything beneath them. */
export function isAdminPath(pathname: string): boolean {
  return (
    pathname === ADMIN_PATH_PREFIX ||
    pathname === ADMIN_LOGIN_PATH ||
    pathname.startsWith(`${ADMIN_PATH_PREFIX}/`) ||
    pathname.startsWith(`${ADMIN_LOGIN_PATH}/`)
  );
}

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "::1", "localhost", "[::1]"]);

function adminBlockedResponse(request: Request): Response {
  const host = request.headers.get("host") ?? new URL(request.url).hostname;
  return new Response(renderChromeUnreachablePage(host), {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, private",
    },
  });
}

const adminIpMiddleware = createMiddleware({ type: "request" }).server(
  async ({ request, next }) => {
    const { pathname } = new URL(request.url);
    if (!isAdminPath(pathname)) return next();

    const allowlist = parseIpAllowlist(process.env["ADMIN_IP_ALLOWLIST"]);
    if (!allowlist.length) {
      console.warn(
        "[admin-ip] ADMIN_IP_ALLOWLIST is not set - /admin is reachable from any IP. " +
          "Set a comma-separated IPv4/CIDR allowlist to turn the gate on.",
      );
      return next();
    }

    const clientIp = getClientIpFromHeaders(request);
    if (!clientIp || LOCAL_HOSTNAMES.has(clientIp) || isIpAllowed(clientIp, allowlist)) {
      return next();
    }

    console.warn(`[admin-ip] blocked ${pathname} for ${clientIp} (not allowlisted)`);
    return adminBlockedResponse(request);
  },
);

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  // adminIpMiddleware runs first: /admin is only reachable from the configured
  // IP allowlist, and every other caller gets a "site can't be reached" page.
  requestMiddleware: [adminIpMiddleware, errorMiddleware, csrfMiddleware],
}));
