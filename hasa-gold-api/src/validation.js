import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "./errors.js";

export const CreateOrderBody = z.strictObject({
  productId: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[a-zA-Z0-9_-]+$/),
  playerId: z.string().trim().min(1).max(128),
  server: z.string().trim().max(100),
  paymentMethod: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9_-]*$/),
});

export const PaymentDecisionBody = z.strictObject({
  decision: z.enum(["confirm", "reject"]),
});

export function parseBody(schema, value) {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "The request contains invalid or missing fields.", "invalid_input");
  }
  return parsed.data;
}

export function createIdempotencyDocumentId(uid, key) {
  return createHash("sha256").update(`${uid}:${key}`).digest("hex");
}

export function createRequestFingerprint(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateCatalogProduct(productId, product, game, playerId, server) {
  if (
    !product ||
    product.active !== true ||
    typeof product.gameSlug !== "string" ||
    typeof product.amount !== "number" ||
    !Number.isFinite(product.amount) ||
    typeof product.unitLabel !== "string" ||
    typeof product.priceUsd !== "number" ||
    !Number.isFinite(product.priceUsd) ||
    typeof product.pricePkr !== "number" ||
    !Number.isFinite(product.pricePkr) ||
    product.priceUsd < 0 ||
    product.pricePkr < 0 ||
    !game ||
    game.active !== true ||
    game.slug !== product.gameSlug ||
    typeof game.name !== "string" ||
    !game.name.trim()
  ) {
    throw new ApiError(409, "This product is no longer available.", "product_unavailable");
  }
  if (
    Array.isArray(game.serverOptions) &&
    game.serverOptions.length > 0 &&
    !game.serverOptions.includes(server)
  ) {
    throw new ApiError(400, "Choose a valid server for this game.", "invalid_server");
  }
  if (product.gameSlug === "free-fire" && !/^\d{6,15}$/.test(playerId)) {
    throw new ApiError(
      400,
      "Enter a Free Fire Player ID containing 6 to 15 digits.",
      "invalid_player_id",
    );
  }
  return {
    productId,
    gameSlug: product.gameSlug,
    gameName: game.name.trim(),
    packageName:
      typeof product.name === "string" && product.name.trim()
        ? product.name.trim()
        : `${product.amount.toLocaleString()} ${product.unitLabel}`,
    amount: product.amount,
    unitLabel: product.unitLabel,
    priceUsd: product.priceUsd,
    pricePkr: product.pricePkr,
    ...(product.gameSlug === "free-fire" ? { nexauraProductId: product.nexauraProductId } : {}),
  };
}
