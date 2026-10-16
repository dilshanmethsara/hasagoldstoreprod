import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { games, pageHead } from '@/lib/store-data';
import { FavoriteButton, SupportBand } from '@/components/store-ui';
import { useDemoAccount } from '@/components/demo-account';
import { GameTopUpOrder } from '@/components/game-topup-order';

export const Route = createFileRoute('/games/$game')({
  loader: ({ params }) => {
    const game = games.find(item => item.id === params.game);
    if (!game) throw notFound();
    return game;
  },
  head: ({ loaderData }) =>
    pageHead(
      loaderData ? `${loaderData.name} Top-Up` : 'Game not found',
      loaderData
        ? `Browse sample ${loaderData.currency} packages for ${loaderData.name}, verify a Player ID, and preview the HASA GOLD STORE checkout flow.`
        : 'This game is not available in the HASA GOLD STORE collection.'
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
  const game = Route.useLoaderData();
  const { viewGame } = useDemoAccount();

  useEffect(() => {
    viewGame(game.id);
  }, [game.id, viewGame]);

  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <Link to="/games">Games</Link>
        <ChevronRight size={12} />
        <span>{game.name}</span>
      </nav>

      {/* Game Detail Hero Banner */}
      <section className="game-detail-banner">
        <div className={`detail-art art-${game.tone}`}>
          <img
            src={game.image}
            alt={`${game.name} logo`}
            width={1024}
            height={768}
          />
          <span className="sample-art">Game Logo</span>
        </div>
        <div>
          <span className="eyebrow">Game top-up</span>
          <h1>{game.name}</h1>
          <p>
            Choose a sample {game.currency} package, verify your Player ID, and continue through the HASA GOLD STORE checkout preview.
          </p>
          <div className="detail-favorite">
            <FavoriteButton game={game} />
            <span>Save to favorites</span>
          </div>
        </div>
      </section>

      {/* Interactive Player ID Verification & Package Ordering System */}
      <GameTopUpOrder game={game} />

      <SupportBand />
    </div>
  );
}