import { createFileRoute } from "@tanstack/react-router";
import { DashboardFavorites } from "@/components/dashboard-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/dashboard/favorites")({
  head: () => pageHead("Dashboard favorites", "Your games saved to your HASA GOLD STORE account."),
  component: DashboardFavorites,
});
