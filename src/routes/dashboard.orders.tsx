import { createFileRoute } from "@tanstack/react-router";
import { DashboardOrders } from "@/components/dashboard-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/dashboard/orders")({
  head: () => pageHead("Your orders", "Your HASA GOLD STORE order history. HASA GOLD STORE."),
  component: DashboardOrders,
});
