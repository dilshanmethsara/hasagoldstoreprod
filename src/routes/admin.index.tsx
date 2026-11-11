import { createFileRoute } from "@tanstack/react-router";
import { AdminOverview } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/")({
  head: () =>
    pageHead(
      "Admin overview",
      "HASA GOLD STORE administration dashboard backed by the store API.",
      { noIndex: true },
    ),
  component: AdminOverview,
});
