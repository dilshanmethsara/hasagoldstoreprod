import { describe, expect, it } from "vitest";
import { DEFAULT_PAYMENT_METHODS, parsePaymentMethods } from "@/lib/payment-methods";

describe("payment method configuration", () => {
  it("defaults to only Wallet and eZ Cash", () => {
    expect(parsePaymentMethods(undefined)).toEqual(DEFAULT_PAYMENT_METHODS);
  });

  it("allows admin-edited method details and active states", () => {
    const methods = DEFAULT_PAYMENT_METHODS.map((method) => ({
      ...method,
      name: `${method.name} updated`,
      active: method.id === "ezcash",
    }));

    expect(parsePaymentMethods(methods)).toEqual(methods);
  });

  it("rejects unsupported or incomplete payment method settings", () => {
    expect(() => parsePaymentMethods([{ ...DEFAULT_PAYMENT_METHODS[0], id: "card" }])).toThrow(
      "Payment method settings are invalid.",
    );
    expect(() =>
      parsePaymentMethods([
        DEFAULT_PAYMENT_METHODS[0],
        { ...DEFAULT_PAYMENT_METHODS[1], id: "wallet" },
      ]),
    ).toThrow("Payment method settings are invalid.");
  });
});
