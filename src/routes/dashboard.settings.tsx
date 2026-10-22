import { createFileRoute } from "@tanstack/react-router";
import { DashboardSettings } from "@/components/dashboard-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/dashboard/settings")({
  head: () =>
    pageHead("Your settings", "Choose your theme and notification preferences. HASA GOLD STORE."),
  component: DashboardSettings,
});
