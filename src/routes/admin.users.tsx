import { createFileRoute } from "@tanstack/react-router";
import { AdminUsers } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/admin/users")({
  head: () => pageHead("Customer accounts", "Manage HASA GOLD STORE customer sign-in."),
  component: AdminUsers,
});
