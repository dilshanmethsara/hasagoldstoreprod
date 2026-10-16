import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameGrid, PageIntro, SupportBand, EmptyState } from '@/components/store-ui';
import { games, pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/games/')({ head: () => pageHead('All games', 'Browse sample gaming top-ups for Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile.'), component: GamesPage });
function GamesPage() {
  const [query, setQuery] = useState('');
  const items = games.filter(game => `${game.name} ${game.currency}`.toLowerCase().includes(query.toLowerCase().trim()));
  return <div className="container page-content"><PageIntro eyebrow="THE GAME COLLECTION" title="Your game. Your next level." description="Explore your favorite games and find their sample top-up options."/><div className="catalog-controls"><div className="search-field"><Search size={20}/><input aria-label="Filter games" placeholder="Find a game or currency…" value={query} onChange={event => setQuery(event.target.value)}/>{query && <Button variant="ghost" size="icon" aria-label="Clear game filter" onClick={() => setQuery('')}><X/></Button>}</div><span className="catalog-count" aria-live="polite">{items.length} {items.length === 1 ? 'game' : 'games'}</span></div>{items.length ? <GameGrid items={items}/> : <EmptyState/>}<p className="catalog-note">Sample artwork and packages · Prices not yet available</p><SupportBand/></div>;
}