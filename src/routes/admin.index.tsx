import { createFileRoute } from "@tanstack/react-router";
import { AdminOverview } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/")({
  head: () =>
    pageHead("Admin overview", "Live store administration dashboard backed by Firestore."),
  component: AdminOverview,
});
