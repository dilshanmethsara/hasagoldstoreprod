import { createFileRoute } from "@tanstack/react-router";
import { AdminGames } from "@/components/admin-ui";
import { pageHead } from "@/lib/store-data";
export const Route = createFileRoute("/admin/games")({
  head: () => pageHead("Games", "Manage the live Firestore game catalog."),
  component: AdminGames,
});
