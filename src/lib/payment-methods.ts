import type { PaymentMethodConfig } from "@/lib/firestore-schema";

export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethodConfig[] = [
  {
    id: "wallet",
    name: "HASA Gold Wallet",
    sub: "Pay from your available wallet balance",
    short: "Wallet",
    active: true,
    kind: "wallet",
    requiresProof: false,
    games: [],
  },
  {
    id: "ezcash",
    name: "eZ Cash",
    sub: "Manual payment · proof required",
    short: "eZ",
    active: true,
    kind: "manual",
    requiresProof: true,
    games: [],
  },
];

/** Stable, URL-safe method ids. Used as the stored payment_method value. */
export const PAYMENT_METHOD_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,49}$/;

export function isWalletMethod(method: PaymentMethodConfig | null | undefined): boolean {
  return method?.id === "wallet" || method?.kind === "wallet";
}

export function isManualMethod(method: PaymentMethodConfig | null | undefined): boolean {
  return Boolean(method) && !isWalletMethod(method);
}

/**
 * Whether the customer must upload a payment receipt for this method.
 *
 * Wallet never needs one. Rows saved before this flag existed (and any row
 * where the flag is missing) keep requiring a receipt, so existing eZ Cash
 * and manual methods behave exactly as they did.
 */
export function methodRequiresProof(method: PaymentMethodConfig | null | undefined): boolean {
  if (!method || isWalletMethod(method)) return false;
  return method.requiresProof !== false;
}

/** Turn a display name into a usable method id (e.g. "Bank Transfer" → "bank-transfer"). */
export function slugifyPaymentMethodId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function invalidSettings(): Error {
  return new Error("Payment method settings are invalid. Ask an administrator to review them.");
}

function readOptionalString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

export function parsePaymentMethods(value: unknown): PaymentMethodConfig[] {
  if (value === undefined) return DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }));
  if (!Array.isArray(value) || value.length === 0) {
    return DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }));
  }

  const methods: PaymentMethodConfig[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw invalidSettings();

    const record = entry as Record<string, unknown>;
    const id = record["id"];
    if (typeof id !== "string" || !PAYMENT_METHOD_ID_PATTERN.test(id) || seen.has(id)) {
      throw invalidSettings();
    }
    if (
      typeof record["name"] !== "string" ||
      typeof record["sub"] !== "string" ||
      typeof record["short"] !== "string" ||
      typeof record["active"] !== "boolean"
    ) {
      throw invalidSettings();
    }

    const kind =
      id === "wallet"
        ? "wallet"
        : record["kind"] === "wallet" || record["kind"] === "manual"
          ? record["kind"]
          : "manual";

    const result: PaymentMethodConfig = {
      id,
      name: record["name"] as string,
      sub: record["sub"] as string,
      short: record["short"] as string,
      active: record["active"] as boolean,
      kind,
      // Missing flag keeps the historical behaviour: receipts required.
      requiresProof: id === "wallet" ? false : record["requiresProof"] !== false,
    };

    const logoUrl = readOptionalString(record, "logoUrl");
    if (logoUrl !== null) result.logoUrl = logoUrl;
    const accountName = readOptionalString(record, "accountName");
    if (accountName !== null) result.accountName = accountName;
    const accountNumber = readOptionalString(record, "accountNumber");
    if (accountNumber !== null) result.accountNumber = accountNumber;

    if (record["games"] !== undefined) {
      result.games = Array.isArray(record["games"])
        ? Array.from(
            new Set(
              record["games"].filter(
                (game): game is string => typeof game === "string" && game.trim().length > 0,
              ),
            ),
          )
        : [];
    }

    seen.add(id);
    methods.push(result);
  }

  return methods;
}

/** Payment methods that are active and usable for a specific game slug. */
export function paymentMethodsForGame(
  methods: PaymentMethodConfig[],
  gameSlug: string | undefined,
): PaymentMethodConfig[] {
  return methods
    .filter((method) => method.active)
    .filter(
      (method) =>
        !method.games ||
        method.games.length === 0 ||
        (gameSlug ? method.games.includes(gameSlug) : false),
    );
}
