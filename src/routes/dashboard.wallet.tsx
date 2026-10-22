import { createFileRoute } from "@tanstack/react-router";
import { DashboardWallet } from "@/components/dashboard-wallet";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/dashboard/wallet")({
  head: () =>
    pageHead(
      "HASA Gold Wallet",
      "Review verified eZ Cash deposits and administrator wallet adjustments with their reasons. Wallet spending and withdrawals are unavailable.",
    ),
  component: DashboardWallet,
});
