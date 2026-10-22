import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlayers } from "@/components/dashboard-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/dashboard/players")({
  head: () =>
    pageHead("Saved Player IDs", "Manage Player IDs saved to your HASA GOLD STORE account."),
  component: DashboardPlayers,
});
