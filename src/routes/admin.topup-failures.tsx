import { createFileRoute } from "@tanstack/react-router";
import { AdminTopupFailures } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/topup-failures")({
  head: () =>
    pageHead(
      "Top-up failures",
      "Review automatic Free Fire top-ups that Nexaura reported as failed or unconfirmed.",
    ),
  component: AdminTopupFailures,
});
