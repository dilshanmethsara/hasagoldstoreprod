/**
 * Public catalog routes — no authentication required.
 *
 * GET /v1/accounts        — active game accounts
 * GET /v1/accounts/:id     — single active game account
 * GET /v1/faqs             — store FAQs
 */
import { ApiError, asyncRoute } from "./errors.js";
import { db } from "./db.js";
import { mapGameAccount } from "./serialize.js";

export const listGameAccounts = asyncRoute(async (req, res) => {
  const gameId = typeof req.query.gameId === "string" ? req.query.gameId.trim() : undefined;
  const params = [];
  let where = "active = true";
  if (gameId) {
    params.push(gameId);
    where += ` AND game_id = $${params.length}`;
  }
  const { rows } = await db.query(
    `SELECT * FROM game_accounts WHERE ${where} ORDER BY display_order ASC, id ASC`,
    params,
  );
  res.json({ accounts: rows.map(mapGameAccount) });
});

export const getGameAccount = asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    throw new ApiError(400, "Invalid account ID.", "invalid_id");
  }
  const { rows } = await db.query("SELECT * FROM game_accounts WHERE id = $1", [id]);
  if (rows.length === 0) {
    throw new ApiError(404, "This account listing was not found.", "not_found");
  }
  if (rows[0].active !== true) {
    throw new ApiError(404, "This account listing is not available.", "not_found");
  }
  res.json({ account: mapGameAccount(rows[0]) });
});

export const listFaqs = asyncRoute(async (_req, res) => {
  const { rows } = await db.query("SELECT items FROM faqs WHERE id = 1");
  const items = rows[0]?.items;
  if (!Array.isArray(items)) return res.json({ items: [] });
  const faqs = items
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.question === "string" &&
        typeof item.answer === "string",
    )
    .map((item) => ({ question: item.question, answer: item.answer }));
  res.json({ items: faqs });
});

// Public storefront activity feed. Return only completed, paid orders and only
// non-identifying fields; never expose customer IDs, player IDs, or payment data.
export const listRecentTopups = asyncRoute(async (_req, res) => {
  const { rows } = await db.query(
    `SELECT game_name, package_name, status, nexaura_status, created_at, updated_at
       FROM orders
      WHERE payment_status = 'paid'
        AND status IN ('completed', 'delivered')
        AND COALESCE(lower(nexaura_status), '') NOT IN (
          'failed', 'rejected', 'submission_failed', 'submission_unknown'
        )
      ORDER BY updated_at DESC, created_at DESC
      LIMIT 8`,
  );
  res.json({
    orders: rows.map((row) => ({
      gameName: row.game_name,
      packageName: row.package_name,
      status: row.status,
      providerStatus: row.nexaura_status ?? null,
      updatedAt: row.updated_at instanceof Date
        ? row.updated_at.getTime()
        : Date.parse(row.updated_at),
    })),
  });
});
