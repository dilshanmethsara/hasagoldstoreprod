import { createFileRoute } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameGrid, GameGridSkeleton, PageIntro, EmptyState } from "@/components/store-ui";
import { pageHead } from "@/lib/store-data";
import { useGames } from "@/lib/firestore";
export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () =>
    pageHead("Search games", "Find a game or currency in the HASA GOLD STORE top-up collection."),
  component: SearchPage,
});
function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading, error, refetch } = useGames();
  const games = data ?? [];
  const items = games.filter((game) =>
    `${game.name} ${game.currency}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  function update(value: string) {
    navigate({ search: { q: value }, replace: true });
  }
  return (
    <div className="container page-content">
      <PageIntro
        eyebrow="FIND YOUR GAME"
        title="A quick search. More time to play."
        description="Search by game name or currency to find your next top-up."
      />
      <div className="search-field">
        <Search size={20} />
        <input
          aria-label="Search games and currency"
          placeholder="Search games, diamonds, UC…"
          value={q}
          onChange={(event) => update(event.target.value)}
        />
        {q && (
          <Button variant="ghost" size="icon" aria-label="Clear search" onClick={() => update("")}>
            <X />
          </Button>
        )}
      </div>
      <div className="search-suggestions">
        <span>Quick picks</span>
        {["Free Fire", "Blood Strike", "PUBG", "Call of Duty"].map((term) => (
          <Button variant="ghost" key={term} onClick={() => update(term)}>
            {term}
          </Button>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>{q ? "Search results" : "All games"}</h2>
          <p aria-live="polite">
            {isLoading
              ? "Loading…"
              : `${items.length} ${items.length === 1 ? "game" : "games"} found${q ? ` for “${q}”` : ""}`}
          </p>
        </div>
      </div>
      {isLoading ? (
        <GameGridSkeleton />
      ) : error ? (
        <div className="empty-state" role="alert">
          <p>Games could not be loaded.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length ? (
        <GameGrid items={items} />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}
