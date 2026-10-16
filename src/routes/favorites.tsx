import { createFileRoute } from '@tanstack/react-router';
import { GameGrid, PageIntro, EmptyState } from '@/components/store-ui';
import { useStore } from '@/components/store-context';
import { games, pageHead } from '@/lib/store-data';
export const Route = createFileRoute('/favorites')({ head: () => pageHead('Your favorites', 'Keep your favorite games together while browsing HASA GOLD STORE.'), component: FavoritesPage });
function FavoritesPage() { const { favorites } = useStore(); const items = games.filter(game => favorites.includes(game.id)); return <div className="container page-content"><PageIntro eyebrow="YOUR COLLECTION" title="Your favorites, a little closer." description="The games you love, all in one place. Saved for this browsing session."/>{items.length ? <><GameGrid items={items}/><p className="catalog-note">Favorites reset when you reload the page.</p></> : <EmptyState favorite/>}</div>; }