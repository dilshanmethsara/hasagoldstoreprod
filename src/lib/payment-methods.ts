import type { PaymentMethod, PaymentMethodConfig } from "@/lib/firestore-schema";

export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethodConfig[] = [
  {
    id: "wallet",
    name: "HASA Gold Wallet",
    sub: "Pay from your available wallet balance",
    short: "Wallet",
    active: true,
  },
  {
    id: "ezcash",
    name: "eZ Cash",
    sub: "Manual payment · proof required",
    short: "eZ",
    active: true,
  },
];

export function parsePaymentMethods(value: unknown): PaymentMethodConfig[] {
  if (value === undefined) return DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }));
  if (!Array.isArray(value) || value.length !== DEFAULT_PAYMENT_METHODS.length) {
    throw new Error("Payment method settings are invalid. Ask an administrator to review them.");
  }

  const methods: PaymentMethodConfig[] = [];
  const seen = new Set<PaymentMethod>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Payment method settings are invalid. Ask an administrator to review them.");
    }

    const record = entry as Record<string, unknown>;
    const id = record["id"];
    if (id !== "wallet" && id !== "ezcash") {
      throw new Error("Payment method settings are invalid. Ask an administrator to review them.");
    }
    if (
      seen.has(id) ||
      typeof record["name"] !== "string" ||
      typeof record["sub"] !== "string" ||
      typeof record["short"] !== "string" ||
      typeof record["active"] !== "boolean"
    ) {
      throw new Error("Payment method settings are invalid. Ask an administrator to review them.");
    }

    seen.add(id);
    methods.push({
      id,
      name: record["name"],
      sub: record["sub"],
      short: record["short"],
      active: record["active"],
    });
  }

  return methods;
}
