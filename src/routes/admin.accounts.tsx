import { createFileRoute } from "@tanstack/react-router";
import { AdminAccounts } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/accounts")({
  head: () =>
    pageHead("Marketplace Accounts", "Manage informational marketplace account listings."),
  component: AdminAccounts,
});
