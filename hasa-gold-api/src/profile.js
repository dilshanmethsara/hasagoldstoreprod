/**
 * Customer profile routes.
 *
 * POST /v1/profile/complete          — complete profile after OAuth sign-up
 * POST /v1/profile/member-id          — assign / return the customer's member ID
 * GET  /v1/me/wallet                  — balance + ledger (deposits, adjustments, wallet orders)
 * PUT  /v1/me/profile                 — update editable profile fields
 * POST /v1/auth/ensure-profile        — create or repair the user row on first login
 * POST /v1/auth/send-verification-email — Firebase verification link via Resend
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError, asyncRoute } from "./errors.js";
import { getAdminAuth } from "./firebase.js";
import { db } from "./db.js";
import { parseBody } from "./validation.js";
import { mapUser, mapWalletDeposit, mapWalletAdjustment, mapOrder, toNum } from "./serialize.js";
import { renderVerificationEmail } from "./email-templates.js";

const MEMBER_ID_PATTERN = /^HG-[A-HJ-NP-Z2-9]{8}$/;
const MEMBER_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function createMemberId(bytes) {
  const suffix = Array.from(bytes.slice(0, 8), (byte) => MEMBER_ID_ALPHABET[byte & 31]).join("");
  return `HG-${suffix}`;
}

const CompleteProfileBody = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  phoneNumber: z.string().regex(/^\+?[1-9]\d{7,14}$/),
  acceptedTerms: z.literal(true),
});

/**
 * POST /v1/profile/complete
 */
export const completeProfile = asyncRoute(async (req, res) => {
  const data = parseBody(CompleteProfileBody, req.body);
  const uid = req.user.uid;
  const auth = getAdminAuth();
  const { rows } = await db.query("SELECT profile_complete FROM users WHERE uid = $1", [uid]);
  if (rows.length === 0) {
    throw new ApiError(404, "Your customer profile could not be found.", "profile_missing");
  }
  if (rows[0].profile_complete !== false) {
    throw new ApiError(
      409,
      "This account does not require profile completion.",
      "profile_already_complete",
    );
  }
  await auth.updateUser(uid, { displayName: data.displayName });
  await db.query(
    `UPDATE users
       SET display_name = $1, phone_number = $2, profile_complete = true,
           terms_accepted_at = now(), updated_at = now()
     WHERE uid = $3`,
    [data.displayName, data.phoneNumber, uid],
  );
  res.json({ success: true });
});

/**
 * POST /v1/profile/member-id
 * Idempotent: assigns and returns the unique HASA member ID.
 */
export const ensureMemberId = asyncRoute(async (req, res) => {
  const uid = req.user.uid;

  for (let attempt = 0; attempt < 8; attempt++) {
    const result = await db.transaction(async (tx) => {
      const userRes = await tx.query("SELECT member_id FROM users WHERE uid = $1", [uid]);
      if (userRes.rows.length === 0) {
        throw new ApiError(404, "Your account profile could not be found.", "profile_missing");
      }
      const existing = userRes.rows[0].member_id;

      // Prefer an existing member_ids row for this user (idempotent, avoids UNIQUE(uid)).
      const byUid = await tx.query("SELECT member_id FROM member_ids WHERE uid = $1", [uid]);
      let memberId;
      if (byUid.rows.length > 0) {
        memberId = byUid.rows[0].member_id;
      } else if (typeof existing === "string" && MEMBER_ID_PATTERN.test(existing)) {
        memberId = existing;
      } else {
        memberId = createMemberId(randomBytes(8));
      }

      const byId = await tx.query("SELECT uid FROM member_ids WHERE member_id = $1", [memberId]);
      if (byId.rows.length > 0 && byId.rows[0].uid !== uid) return null; // collision -> retry

      if (byId.rows.length === 0) {
        await tx.query("INSERT INTO member_ids (member_id, uid) VALUES ($1, $2)", [memberId, uid]);
      }
      if (existing !== memberId) {
        await tx.query("UPDATE users SET member_id = $1, updated_at = now() WHERE uid = $2", [
          memberId,
          uid,
        ]);
      }
      return memberId;
    });
    if (result) return res.json({ memberId: result });
  }
  throw new ApiError(
    500,
    "Could not assign a customer ID right now. Please retry.",
    "member_id_assignment_failed",
  );
});

// ─── Wallet ──────────────────────────────────────────────────────────────────

/**
 * GET /v1/me/wallet
 */
export const getWallet = asyncRoute(async (req, res) => {
  const uid = req.user.uid;
  const [userRes, depositsRes, adjustmentsRes, ordersRes] = await Promise.all([
    db.query("SELECT wallet_balance_lkr FROM users WHERE uid = $1", [uid]),
    db.query("SELECT * FROM wallet_deposits WHERE uid = $1 ORDER BY created_at DESC LIMIT 100", [
      uid,
    ]),
    db.query("SELECT * FROM wallet_adjustments WHERE uid = $1 ORDER BY created_at DESC LIMIT 100", [
      uid,
    ]),
    db.query(
      `SELECT * FROM orders WHERE customer_uid = $1 AND payment_method = 'wallet'
       ORDER BY created_at DESC LIMIT 50`,
      [uid],
    ),
  ]);

  const balance = userRes.rows.length > 0 ? (toNum(userRes.rows[0].wallet_balance_lkr) ?? 0) : 0;

  res.json({
    balance,
    deposits: depositsRes.rows.map(mapWalletDeposit),
    adjustments: adjustmentsRes.rows.map(mapWalletAdjustment),
    orders: ordersRes.rows.map(mapOrder),
  });
});

// ─── Profile management ────────────────────────────────────────────────────────

const UpdateProfileBody = z.strictObject({
  displayName: z.string().trim().min(1).max(80).optional(),
  savedPlayerIds: z.record(z.string(), z.string().max(64)).optional(),
  recentViewedGames: z.array(z.string().max(80)).max(4).optional(),
  favorites: z.array(z.string().max(80)).max(100).optional(),
  notificationPrefs: z.object({ updates: z.boolean(), reminders: z.boolean() }).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
});

/**
 * PUT /v1/me/profile
 */
export const updateProfile = asyncRoute(async (req, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid profile update.", "invalid_input");
  }
  const uid = req.user.uid;
  const exists = await db.query("SELECT 1 FROM users WHERE uid = $1", [uid]);
  if (exists.rows.length === 0) {
    throw new ApiError(404, "Your customer profile could not be found.", "profile_missing");
  }

  const data = parsed.data;
  const sets = [];
  const params = [];
  if (data.displayName !== undefined) {
    params.push(data.displayName);
    sets.push(`display_name = $${params.length}`);
  }
  if (data.savedPlayerIds !== undefined) {
    params.push(JSON.stringify(data.savedPlayerIds));
    sets.push(`saved_player_ids = $${params.length}::jsonb`);
  }
  if (data.recentViewedGames !== undefined) {
    params.push(data.recentViewedGames);
    sets.push(`recent_viewed_games = $${params.length}::text[]`);
  }
  if (data.favorites !== undefined) {
    params.push(data.favorites);
    sets.push(`favorites = $${params.length}::text[]`);
  }
  if (data.notificationPrefs !== undefined) {
    params.push(data.notificationPrefs.updates);
    sets.push(`notification_updates = $${params.length}`);
    params.push(data.notificationPrefs.reminders);
    sets.push(`notification_reminders = $${params.length}`);
  }
  if (data.theme !== undefined) {
    params.push(data.theme);
    sets.push(`theme = $${params.length}`);
  }

  if (sets.length === 0) {
    return res.json({ success: true, updated: false });
  }
  sets.push("updated_at = now()");
  params.push(uid);
  await db.query(`UPDATE users SET ${sets.join(", ")} WHERE uid = $${params.length}`, params);
  res.json({ success: true, updated: true });
});

/**
 * POST /v1/auth/ensure-profile
 * Creates or repairs the user row on first login.
 */
export const ensureProfile = asyncRoute(async (req, res) => {
  const uid = req.user.uid;
  const email = typeof req.user.email === "string" ? req.user.email : "";
  const displayName =
    typeof req.user.name === "string" ? req.user.name : email.split("@")[0] || "Player";
  const googleLinked = req.user.firebase?.sign_in_provider === "google.com";

  const existing = await db.query("SELECT * FROM users WHERE uid = $1", [uid]);

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const repair = [];
    const params = [];
    const add = (col, val, cast) => {
      params.push(cast ? val : val);
      repair.push(`${col} = $${params.length}${cast || ""}`);
    };
    if (typeof row.display_name !== "string" || !row.display_name.trim())
      add("display_name", displayName.slice(0, 80));
    if (typeof row.notification_updates !== "boolean") add("notification_updates", false);
    if (typeof row.notification_reminders !== "boolean") add("notification_reminders", false);
    if (
      typeof row.saved_player_ids !== "object" ||
      row.saved_player_ids === null ||
      Array.isArray(row.saved_player_ids)
    )
      add("saved_player_ids", "{}", "::jsonb");
    if (!Array.isArray(row.recent_viewed_games)) add("recent_viewed_games", "{}", "::text[]");
    if (!Array.isArray(row.favorites)) add("favorites", "{}", "::text[]");
    if (!["light", "dark", "system"].includes(row.theme)) add("theme", "system");
    if (typeof row.profile_complete !== "boolean") add("profile_complete", Boolean(googleLinked));

    if (repair.length > 0) {
      repair.push("updated_at = now()");
      params.push(uid);
      await db.query(`UPDATE users SET ${repair.join(", ")} WHERE uid = $${params.length}`, params);
    }
    const fresh = await db.query("SELECT * FROM users WHERE uid = $1", [uid]);
    return res.json({ success: true, created: false, profile: mapUser(fresh.rows[0]) });
  }

  await db.query(
    `INSERT INTO users
       (uid, email, display_name, role, notification_updates, notification_reminders,
        saved_player_ids, recent_viewed_games, favorites, theme, profile_complete)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::text[],$9::text[],$10,$11)`,
    [
      uid,
      email,
      displayName.slice(0, 80),
      "customer",
      false,
      false,
      "{}",
      [],
      [],
      "system",
      Boolean(googleLinked),
    ],
  );
  const fresh = await db.query("SELECT * FROM users WHERE uid = $1", [uid]);
  res.json({ success: true, created: true, profile: mapUser(fresh.rows[0]) });
});

// ─── Email verification ──────────────────────────────────────────────────────

/**
 * POST /v1/auth/send-verification-email
 */
export const sendVerificationEmail = asyncRoute(async (req, res) => {
  const uid = req.user.uid;
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) {
    throw new ApiError(503, "Email verification is not configured.", "email_unconfigured");
  }

  const appOrigin = req.body?.appOrigin;
  if (typeof appOrigin !== "string" || !appOrigin) {
    throw new ApiError(400, "Missing app origin.", "invalid_input");
  }

  let origin;
  try {
    origin = new URL(appOrigin);
    if (origin.pathname !== "/" || origin.search || origin.hash) {
      throw new ApiError(400, "Invalid verification return address.", "invalid_origin");
    }
  } catch {
    throw new ApiError(400, "Invalid verification return address.", "invalid_origin");
  }

  const isLocalDev =
    process.env.NODE_ENV === "development" &&
    origin.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(origin.hostname);
  if (!isLocalDev) {
    const configured = process.env.APP_BASE_URL?.trim();
    if (configured) {
      const configUrl = new URL(configured);
      if (configUrl.protocol !== "https:" && process.env.NODE_ENV !== "development") {
        throw new ApiError(
          400,
          "APP_BASE_URL must use HTTPS outside development.",
          "invalid_origin",
        );
      }
      // Accept the configured origin and its `www` counterpart. Vercel serves
      // both apex and www with a 200 (no redirect), so a user who typed
      // `www.hasagold.store` otherwise hits an origin mismatch even though it is
      // the same deployment.
      const allowedOrigins = new Set([configUrl.origin]);
      if (configUrl.hostname.startsWith("www.")) {
        const bare = new URL(configUrl.origin);
        bare.hostname = configUrl.hostname.slice(4);
        allowedOrigins.add(bare.origin);
      } else {
        const withWww = new URL(configUrl.origin);
        withWww.hostname = `www.${configUrl.hostname}`;
        allowedOrigins.add(withWww.origin);
      }
      if (!allowedOrigins.has(origin.origin)) {
        throw new ApiError(
          400,
          "The verification return address is not allowed.",
          "invalid_origin",
        );
      }
    } else {
      throw new ApiError(
        503,
        "Email verification is not configured. Set APP_BASE_URL on the server.",
        "email_unconfigured",
      );
    }
  }

  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  if (user.emailVerified) return res.json({ sent: true, alreadyVerified: true });

  const email = user.email?.trim().toLowerCase();
  if (!email)
    throw new ApiError(400, "This account does not have an email address to verify.", "no_email");

  let actionLink;
  try {
    actionLink = await auth.generateEmailVerificationLink(email, {
      url: new URL("/login?verified=1", origin.origin).toString(),
    });
  } catch (error) {
    // Firebase refuses to mint a verification link for a continue-URL host that
    // is missing from Authentication → Settings → Authorized domains. That is a
    // configuration problem, not a transient failure, so name the exact fix
    // instead of letting the FirebaseAuthError surface as an opaque 500.
    const message = error?.message || String(error);
    console.error("Firebase verification link failed:", message.slice(0, 500));
    if (/not allowlisted|unauthorized continue uri/i.test(message)) {
      throw new ApiError(
        503,
        `Email verification is not available for ${origin.host} yet. ` +
          "Add this domain to Firebase Authentication → Settings → Authorized domains.",
        "origin_not_authorized",
      );
    }
    throw new ApiError(
      502,
      "We could not create a verification link. Please try again later.",
      "verification_link_failed",
    );
  }

  // Render the same branded shell the order emails use, so every message the
  // customer receives carries identical HASA GOLD STORE styling.
  const message = renderVerificationEmail({
    displayName: user.displayName?.trim() || "",
    actionUrl: actionLink,
    supportUrl: new URL("/support", origin.origin).toString(),
  });

  let response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "HASA GOLD STORE <no-reply@hasagold.store>",
        to: [email],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
  } catch (error) {
    // A transport failure must not escape as an opaque 500.
    console.error("Resend verification email request failed:", error?.message || error);
    throw new ApiError(
      502,
      "We could not send the verification email. Please try again later.",
      "email_send_failed",
    );
  }

  if (!response.ok) {
    // Surface the provider's own reason (for example `domain_not_verified` or
    // `invalid_api_key`) so a delivery failure is diagnosable from the logs
    // instead of only showing an opaque status code.
    const details = await response.text().catch(() => "");
    console.error("Resend verification email failed:", response.status, details.slice(0, 500));
    throw new ApiError(
      502,
      "We could not send the verification email. Please try again later.",
      "email_send_failed",
    );
  }
  res.json({ sent: true });
});
