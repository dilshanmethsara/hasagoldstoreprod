import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  GameGrid,
  GameGridSkeleton,
  PageIntro,
  SupportBand,
  EmptyState,
} from "@/components/store-ui";
import { pageHead } from "@/lib/store-data";
import { useGames } from "@/lib/firestore";
export const Route = createFileRoute("/games/")({
  head: () =>
    pageHead(
      "All games",
      "Browse gaming top-ups for Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile at HASA GOLD STORE.",
    ),
  component: GamesPage,
});
function GamesPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading, error, refetch } = useGames();
  const games = data ?? [];
  const items = games.filter((game) =>
    `${game.name} ${game.currency}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <div className="container page-content">
      <PageIntro
        eyebrow="THE GAME COLLECTION"
        title="Your game. Your next level."
        description="Explore your favorite games and find their top-up options."
      />
      <div className="catalog-controls">
        <div className="search-field">
          <Search size={20} />
          <input
            aria-label="Filter games"
            placeholder="Find a game or currency…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Clear game filter"
              onClick={() => setQuery("")}
            >
              <X />
            </Button>
          )}
        </div>
        <span className="catalog-count" aria-live="polite">
          {items.length} {items.length === 1 ? "game" : "games"}
        </span>
      </div>
      {isLoading ? (
        <GameGridSkeleton />
      ) : error ? (
        <div className="empty-state">
          <h2>Couldn't load games</h2>
          <p>The catalog couldn't be loaded right now. Please try again.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length ? (
        <GameGrid items={items} />
      ) : (
        <EmptyState />
      )}
      <p className="catalog-note">Top-up packages loaded from the live store catalog.</p>
      <SupportBand />
    </div>
  );
}
