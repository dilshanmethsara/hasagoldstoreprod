import { createFileRoute } from "@tanstack/react-router";
import { AdminPaymentMethods } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/admin/payment-methods")({
  head: () => pageHead("Payment methods", "Manage checkout payment methods."),
  component: AdminPaymentMethods,
});
