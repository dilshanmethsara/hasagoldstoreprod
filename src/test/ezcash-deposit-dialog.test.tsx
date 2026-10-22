import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EzCashDepositDialog } from "@/components/ezcash-deposit-dialog";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));

function renderDialog(overrides: Partial<Parameters<typeof EzCashDepositDialog>[0]> = {}) {
  const props = {
    open: true,
    stage: "waiting" as const,
    referenceNumber: "20261007123456",
    amountLabel: "Rs. 1,250",
    message: "",
    duplicate: false,
    elapsedSeconds: 12,
    pollError: null,
    onClose: vi.fn(),
    onTryAgain: vi.fn(),
    ...overrides,
  };
  render(<EzCashDepositDialog {...props} />);
  return props;
}

describe("eZ Cash verification dialog", () => {
  it("keeps a blocking spinner while the provider answer is pending", () => {
    renderDialog();

    expect(screen.getByText("Confirming with eZ Cash")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/auto-checking every 1.5s/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("shows a cross and a not-found message when verification times out", () => {
    renderDialog({
      stage: "failed",
      message:
        "We couldn't find an eZ Cash payment for this reference number. Check the 14 digits and try again.",
      elapsedSeconds: 6,
    });

    expect(screen.getAllByText("Reference not found").length).toBeGreaterThan(0);
    expect(screen.getByText(/couldn't find an eZ Cash payment/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("is-error");
    expect(screen.getByRole("button", { name: "Try another RN" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Done" })).not.toBeInTheDocument();
  });

  it("shows the credited amount and balance confirmation on success", () => {
    renderDialog({
      stage: "success",
      message: "Rs. 1,250 added to your wallet!",
      elapsedSeconds: 41,
    });

    expect(screen.getByText("Wallet credited")).toBeInTheDocument();
    expect(screen.getByText("Rs. 1,250 added to your wallet!")).toBeInTheDocument();
    expect(screen.getAllByText("Rs. 1,250").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });
});
