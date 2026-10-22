import { createFileRoute } from "@tanstack/react-router";
import { CatalogGrid, PageIntro, EmptyState } from "@/components/store-ui";
import { useStore } from "@/components/store-context";
import { useGames } from "@/lib/firestore";
import { pageHead } from "@/lib/store-data";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/favorites")({
  head: () =>
    pageHead("Your favorites", "Keep your favorite games together while browsing HASA GOLD STORE."),
  component: FavoritesPage,
});
function FavoritesPage() {
  const { favorites } = useStore();
  const { data, isLoading, error, refetch } = useGames();
  const items = (data ?? []).filter((game) => favorites.includes(game.id));
  return (
    <div className="container page-content">
      <PageIntro
        eyebrow="YOUR COLLECTION"
        title="Your favorites, a little closer."
        description="The games you love, all in one place."
      />
      {isLoading ? (
        <div className="empty-state" aria-busy="true">
          <p>Loading games…</p>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <p>Games could not be loaded.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length ? (
        <CatalogGrid items={items} />
      ) : (
        <EmptyState favorite />
      )}
    </div>
  );
}
