import { createFileRoute } from "@tanstack/react-router";
import { AdminPackages } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/packages")({
  head: () => pageHead("Top-up Packages", "Manage top-up package catalog records and prices."),
  component: AdminPackages,
});
