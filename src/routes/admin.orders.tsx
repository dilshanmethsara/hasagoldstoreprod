import { createFileRoute } from "@tanstack/react-router";
import { AdminOrders } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/orders")({
  head: () =>
    pageHead(
      "Orders",
      "Review customer payment proofs and update tracked order and payment statuses.",
    ),
  component: AdminOrders,
});
