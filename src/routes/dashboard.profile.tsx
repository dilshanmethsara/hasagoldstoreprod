import { createFileRoute } from "@tanstack/react-router";
import { DashboardProfile } from "@/components/dashboard-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/dashboard/profile")({
  head: () => pageHead("Your profile", "Manage your account name and password. HASA GOLD STORE."),
  component: DashboardProfile,
});
