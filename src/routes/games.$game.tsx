import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";
import { FavoriteButton, SupportBand } from "@/components/store-ui";
import { useAccount } from "@/components/account-context";
import { GameTopUpOrder } from "@/components/game-topup-order";
import { useGame, useProducts } from "@/lib/firestore";

export const Route = createFileRoute("/games/$game")({
  loader: ({ params }) => params.game,
  head: ({ loaderData }) =>
    pageHead(
      "Game top-up",
      `Browse current game top-up packages for ${loaderData ?? "this game"} in the HASA GOLD STORE catalog.`,
    ),
  component: GamePage,
  notFoundComponent: () => (
    <div className="container page-content">
      <h1 className="text-3xl font-display mb-4">Game not found</h1>
      <p className="mb-6 text-muted-foreground">This game is not in our collection.</p>
      <Button asChild>
        <Link to="/games">
          Explore games <ArrowRight />
        </Link>
      </Button>
    </div>
  ),
});

function GamePage() {
  const gameSlug = Route.useLoaderData();
  const { viewGame } = useAccount();
  const {
    data: game,
    isLoading: gameLoading,
    error: gameError,
    refetch: retryGame,
  } = useGame(gameSlug);
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
    refetch: retryProducts,
  } = useProducts(gameSlug);

  useEffect(() => {
    if (game) void viewGame(game.id);
  }, [game, viewGame]);

  if (gameLoading)
    return (
      <div className="container page-content">
        <div className="empty-state" aria-busy="true">
          <p>Loading game catalog…</p>
        </div>
      </div>
    );
  if (gameError)
    return (
      <div className="container page-content">
        <div className="empty-state" role="alert">
          <h1>Game catalog could not be loaded</h1>
          <p>Please check your connection and retry.</p>
          <Button variant="outline" onClick={() => void retryGame()}>
            Try again
          </Button>
        </div>
      </div>
    );
  if (!game)
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h1>Game is unavailable</h1>
          <p>This game is not currently available in the live store catalog.</p>
          <Button asChild>
            <Link to="/games">Browse available games</Link>
          </Button>
        </div>
      </div>
    );

  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <Link to="/games">Games</Link>
        <ChevronRight size={12} />
        <span>{game.name}</span>
      </nav>

      <section className="game-detail-banner">
        <div className={`detail-art art-${game.tone}`}>
          <img src={game.image} alt={`${game.name} logo`} width={1024} height={768} />
        </div>
        <div>
          <span className="eyebrow">Game top-up</span>
          <h1>{game.name}</h1>
          <p>
            Choose a {game.currency} package and enter your Player ID.{" "}
            {game.id === "blood-strike"
              ? "Blood Strike IDs are checked through Shop2Topup."
              : game.id === "free-fire"
                ? "Free Fire IDs can be checked through the available player lookup."
                : "Player IDs for this game are not checked with game servers."}{" "}
            eZ Cash receipts are reviewed manually, and top-ups are not automatically fulfilled.
          </p>
          <div className="detail-favorite">
            <FavoriteButton game={game} />
            <span>Save to favorites</span>
          </div>
        </div>
      </section>

      <GameTopUpOrder
        game={game}
        products={products}
        productsLoading={productsLoading}
        productsError={Boolean(productsError)}
        retryProducts={() => void retryProducts()}
      />

      <SupportBand />
    </div>
  );
}
