import { createFileRoute } from "@tanstack/react-router";
import { AdminSettings } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/settings")({
  head: () => pageHead("Settings", "Manage public store configuration."),
  component: AdminSettings,
});
