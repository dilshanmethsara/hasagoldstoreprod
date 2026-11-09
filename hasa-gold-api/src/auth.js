import { ApiError, asyncRoute } from "./errors.js";
import { verifyFirebaseToken } from "./firebase.js";
import { db } from "./db.js";

/**
 * Verify the bearer token and attach the identity to the request.
 *
 * Shared by `authenticate` and `authenticateUnverified`; the only difference is
 * whether an address that has not been verified yet is accepted.
 */
async function verifyIdentity(req, allowUnverified) {
  const authorization = req.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match) {
    throw new ApiError(401, "Sign in to continue.", "authentication_required");
  }
  let decoded;
  try {
    decoded = await verifyFirebaseToken(match[1]);
  } catch (error) {
    if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
      throw new ApiError(401, "Your sign-in session is invalid or expired.", "invalid_token");
    }
    throw error;
  }
  if (decoded.email_verified !== true && !allowUnverified) {
    throw new ApiError(403, "Verify your email address before continuing.", "email_unverified");
  }
  req.user = decoded;
  if (decoded.email_verified !== true) req.emailUnverified = true;
}

export const authenticate = asyncRoute(async (req, _res, next) => {
  await verifyIdentity(req, false);
  next();
});

/**
 * Middleware for the two bootstrap routes a brand-new account needs *before*
 * its email is verified: creating the profile row and resending the
 * verification link.
 *
 * `authenticate` rejects an unverified caller with 403 `email_unverified`, so
 * using it on those routes made signup unable to send its verification email —
 * the user was signed out and never received the link. Only the auth bootstrap
 * routes may use this variant.
 */
export const authenticateUnverified = asyncRoute(async (req, _res, next) => {
  await verifyIdentity(req, true);
  next();
});

export const requireCompleteProfile = asyncRoute(async (req, _res, next) => {
  const { rows } = await db.query("SELECT profile_complete FROM users WHERE uid = $1", [
    req.user.uid,
  ]);
  if (rows.length === 0) {
    throw new ApiError(403, "Your customer profile could not be found.", "profile_missing");
  }
  if (rows[0].profile_complete === false) {
    throw new ApiError(
      403,
      "Complete your customer profile before continuing.",
      "profile_incomplete",
    );
  }
  next();
});

export function requireAdmin(req, _res, next) {
  const allowedUids = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((uid) => uid.trim())
    .filter(Boolean);
  if (!allowedUids.length) {
    return next(new ApiError(503, "Administrator access is not configured.", "admin_unconfigured"));
  }
  if (!allowedUids.includes(req.user.uid)) {
    return next(
      new ApiError(403, "This account is not authorized to manage the store.", "admin_required"),
    );
  }
  next();
}
