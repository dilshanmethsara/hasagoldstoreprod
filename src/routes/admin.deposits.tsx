import { createFileRoute } from "@tanstack/react-router";
import { AdminDepositRecords } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/admin/deposits")({
  head: () => pageHead("Wallet deposits", "Review verified customer wallet deposits."),
  component: AdminDepositRecords,
});
