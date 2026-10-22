import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronDown,
  Coins,
  Diamond,
  Gamepad2,
  Heart,
  HelpCircle,
  Home,
  Mail,
  Menu,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  X,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { faqs } from "@/lib/store-data";
import { useQuery } from "@tanstack/react-query";
import { fetchStoreFaqs, fetchStoreSettings } from "@/lib/firestore";
import { useGames } from "@/lib/firestore";
import type { CatalogGame } from "@/lib/firestore-schema";
import { useStore } from "./store-context";
import { AccountMenu, ThemeMenu } from "./account-menu";
import { useWallet } from "./wallet-context";
import { useAccount } from "./account-context";
import hasaLogo from "@/assets/newhasalogo.png";

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="HASA GOLD STORE home">
      <img className="brand-logo" src={hasaLogo} alt="" />
      <span>
        <strong>
          HASA<span className="text-primary"> GOLD</span>
        </strong>
        <small>GAMING TOP-UPS</small>
      </span>
    </Link>
  );
}

export function StoreHeader() {
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { favorites } = useStore();
  const { balance, formatAmount, isLoaded, error: walletError } = useWallet();
  const { uid, ready } = useAccount();
  const { data, isLoading } = useGames();
  const { data: storeSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 60_000,
  });
  const navGames: readonly CatalogGame[] = isLoading ? [] : (data ?? []);
  const results = navGames.filter((game) =>
    `${game.name} ${game.currency}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  function search(event: FormEvent) {
    event.preventDefault();
    setQuick(false);
    navigate({ to: "/search", search: { q: query } });
  }
  return (
    <>
      <div className="preview-strip">
        {storeSettings?.maintenanceMode
          ? "Store maintenance is in progress; new orders are temporarily disabled."
          : storeSettings?.bannerEnabled && storeSettings.tagline
            ? storeSettings.tagline
            : "Service notice · eZ Cash proof is reviewed manually; top-up fulfillment is not automated."}
      </div>
      <header className="store-header">
        <div className="container header-inner">
          <Brand />
          <nav className="desktop-nav" aria-label="Main navigation">
            <Link to="/" activeProps={{ className: "active" }} activeOptions={{ exact: true }}>
              Home
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="games-trigger">
                  Games <ChevronDown size={13} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" sideOffset={12} className="games-menu">
                <div className="games-menu-head">
                  <span>Game collection</span>
                  <Link to="/games">
                    View all <ArrowUpRight size={14} />
                  </Link>
                </div>
                {navGames.map((game) => (
                  <DropdownMenuItem key={game.id} asChild className="game-menu-item">
                    <Link to="/games/$game" params={{ game: game.id }}>
                      <img src={game.image} alt="" width={44} height={44} />
                      <span>
                        <strong>{game.name}</strong>
                        <small>{game.currency} top-up</small>
                      </span>
                      <ArrowRight size={15} />
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link
              to="/accounts"
              activeProps={{ className: "active" }}
              className="nav-accounts-link"
            >
              <BadgeCheck size={14} /> Accounts
            </Link>
            <Link to="/how-it-works" activeProps={{ className: "active" }}>
              How it works
            </Link>
            <Link to="/support" activeProps={{ className: "active" }}>
              Support
            </Link>
          </nav>
          <div className="header-tools">
            {ready && uid && (
              <Link
                to="/dashboard/wallet"
                className="wallet-header-pill"
                aria-label={
                  walletError
                    ? "Wallet balance unavailable"
                    : isLoaded
                      ? `Wallet balance: ${formatAmount(balance)}`
                      : "Wallet balance loading"
                }
                title="Open HASA Gold Wallet"
              >
                <span className="wallet-pill-icon">
                  <Wallet size={14} />
                </span>
                <span className="wallet-pill-val">
                  {walletError ? "—" : isLoaded ? formatAmount(balance) : "…"}
                </span>
              </Link>
            )}
            <Button variant="ghost" className="quick-search-button" onClick={() => setQuick(true)}>
              <Search />
              <span>Find your game</span>
            </Button>
            <ThemeMenu />
            <AccountMenu />
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu-button"
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </Button>
          </div>
        </div>
        {menu && (
          <nav className="mobile-nav container" aria-label="Mobile navigation">
            <Link to="/" onClick={() => setMenu(false)}>
              Home
            </Link>
            <Link to="/games" onClick={() => setMenu(false)}>
              Games
            </Link>
            <Link to="/accounts" onClick={() => setMenu(false)}>
              <BadgeCheck size={14} /> Game Accounts
            </Link>
            {ready && uid && (
              <Link to="/dashboard/wallet" onClick={() => setMenu(false)}>
                <Wallet size={14} /> Wallet ({isLoaded ? formatAmount(balance) : "…"})
              </Link>
            )}
            <Link to="/how-it-works" onClick={() => setMenu(false)}>
              How it works
            </Link>
            <Link to="/support" onClick={() => setMenu(false)}>
              Support
            </Link>
          </nav>
        )}
      </header>
      <Dialog open={quick} onOpenChange={setQuick}>
        <DialogContent>
          <DialogTitle>Find your next top-up</DialogTitle>
          <DialogDescription>Search games or in-game currency.</DialogDescription>
          <form className="search-field" onSubmit={search}>
            <Search size={20} />
            <input
              aria-label="Quick search games"
              placeholder="Search games, diamonds, UC…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
            />
            <Button type="submit" size="icon" aria-label="View search results">
              <ArrowRight />
            </Button>
          </form>
          <div className="quick-results">
            {results.map((game) => (
              <Link
                key={game.id}
                to="/games/$game"
                params={{ game: game.id }}
                onClick={() => {
                  setQuick(false);
                  setQuery("");
                }}
              >
                <img src={game.image} alt="" width={48} height={48} />
                <span>
                  <strong>{game.name}</strong>
                  <small>{game.currency}</small>
                </span>
                <ArrowUpRight size={18} />
              </Link>
            ))}
            {results.length === 0 && (
              <p className="text-muted-foreground">No games found. Try another name or currency.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function BottomNavigation() {
  const { pathname } = useLocation();
  const { favorites } = useStore();
  if (pathname.startsWith("/dashboard")) return null;
  const active = pathname.startsWith("/games")
    ? "games"
    : pathname.startsWith("/accounts")
      ? "accounts"
      : pathname.startsWith("/search")
        ? "search"
        : pathname.startsWith("/favorites")
          ? "favorites"
          : pathname.startsWith("/support") || pathname.startsWith("/how-it-works")
            ? "support"
            : pathname === "/"
              ? "home"
              : "none";
  return (
    <nav className="bottom-nav" aria-label="Bottom navigation" data-active={active}>
      <span className="bottom-nav-indicator" aria-hidden="true" />
      <Button asChild variant="ghost" className="bottom-nav-item">
        <Link to="/" aria-current={active === "home" ? "page" : undefined} viewTransition>
          <Home />
          <span>Home</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" className="bottom-nav-item">
        <Link to="/games" aria-current={active === "games" ? "page" : undefined} viewTransition>
          <Gamepad2 />
          <span>Games</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" className="bottom-nav-item">
        <Link
          to="/accounts"
          aria-current={active === "accounts" ? "page" : undefined}
          viewTransition
        >
          <ShoppingBag />
          <span>Accounts</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" className="bottom-nav-item">
        <Link
          to="/favorites"
          aria-current={active === "favorites" ? "page" : undefined}
          viewTransition
        >
          <span className="bottom-nav-icon">
            <Heart />
            {favorites.length > 0 && <span className="bottom-nav-count">{favorites.length}</span>}
          </span>
          <span>Favorites</span>
        </Link>
      </Button>
      <Button asChild variant="ghost" className="bottom-nav-item">
        <Link to="/support" aria-current={active === "support" ? "page" : undefined} viewTransition>
          <HelpCircle />
          <span>Support</span>
        </Link>
      </Button>
    </nav>
  );
}

export function StoreFooter() {
  const { data: storeSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 60_000,
  });
  return (
    <footer className="store-footer">
      <div className="container footer-content">
        <div className="footer-main">
          <div className="footer-brand-section">
            <div className="footer-brand">
              <Brand />
            </div>
            <p className="footer-tagline">
              {storeSettings?.tagline || "One place. Your favorite games."}
            </p>
            <div className="footer-trust">
              <span>
                <ShieldCheck size={12} /> Player ID only
              </span>
              <span>
                <BadgeCheck size={12} /> Verified listings
              </span>
              <span>
                <Heart size={12} /> Saved favorites
              </span>
            </div>
            <div className="footer-contact">
              {storeSettings?.supportEmail && (
                <a href={`mailto:${storeSettings.supportEmail}`} className="footer-contact-link">
                  <span className="footer-contact-icon">
                    <Mail size={13} />
                  </span>
                  {storeSettings.supportEmail}
                </a>
              )}
              {storeSettings?.supportWhatsapp && (
                <a
                  href={`https://wa.me/${storeSettings.supportWhatsapp.replace(/\D/g, "")}`}
                  className="footer-contact-link"
                >
                  <span className="footer-contact-icon">
                    <MessageCircle size={13} />
                  </span>
                  WhatsApp Support
                </a>
              )}
            </div>
          </div>
          <div className="footer-links-section">
            <div className="footer-link-group">
              <h4 className="footer-link-title">Explore</h4>
              <ul className="footer-link-list">
                <li>
                  <Link to="/games">All Games</Link>
                </li>
                <li>
                  <Link to="/accounts">Game Accounts</Link>
                </li>
                <li>
                  <Link to="/favorites">Favorites</Link>
                </li>
                <li>
                  <Link to="/search" search={{ q: "" }}>
                    Search Games
                  </Link>
                </li>
              </ul>
            </div>
            <div className="footer-link-group">
              <h4 className="footer-link-title">Help & Support</h4>
              <ul className="footer-link-list">
                <li>
                  <Link to="/how-it-works">How It Works</Link>
                </li>
                <li>
                  <Link to="/support">Support & FAQ</Link>
                </li>
                <li>
                  <Link to="/status">Service Status</Link>
                </li>
              </ul>
            </div>
            <div className="footer-link-group">
              <h4 className="footer-link-title">Legal</h4>
              <ul className="footer-link-list">
                <li>
                  <Link to="/privacy-policy">Privacy Policy</Link>
                </li>
                <li>
                  <Link to="/refund-policy">Refund Policy</Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-bottom-left">
            <span className="footer-copyright">
              &copy; {new Date().getFullYear()} HASA GOLD STORE
            </span>
            <span className="footer-disclaimer">
              eZ Cash proof review is manual; top-up fulfillment is not automated.
            </span>
          </div>
          <div className="footer-bottom-right">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span className="footer-separator">·</span>
            <Link to="/refund-policy">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export function FavoriteButton({ game }: { game: CatalogGame }) {
  const { favorites, toggleFavorite } = useStore();
  const saved = favorites.includes(game.id);
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`heart-button ${saved ? "is-saved" : ""}`}
      aria-label={`${saved ? "Remove" : "Add"} ${game.name} ${saved ? "from" : "to"} favorites`}
      aria-pressed={saved}
      title={saved ? "Remove favorite" : "Add favorite"}
      onClick={() => toggleFavorite(game.id)}
    >
      <Heart fill={saved ? "currentColor" : "none"} />
    </Button>
  );
}

export function GameCard({ game }: { game: CatalogGame }) {
  return (
    <article className="game-card">
      <div className={`game-art art-${game.tone}`}>
        <Link
          to="/games/$game"
          params={{ game: game.id }}
          aria-label={`Browse ${game.name} top-ups`}
        >
          <img
            src={game.image}
            alt={`${game.name} logo`}
            width={1024}
            height={768}
            loading="lazy"
          />
        </Link>
        <FavoriteButton game={game} />
        {game.active && (
          <div className="game-active-badge">
            <span className="game-active-badge-text">Active</span>
          </div>
        )}
        <div className="art-game-name" aria-hidden="true">
          {game.id === "call-of-duty-mobile" ? (
            <>
              CALL OF DUTY<small>MOBILE</small>
            </>
          ) : (
            game.name.toUpperCase()
          )}
        </div>
      </div>
      <div className="game-card-body">
        <div className="game-name-row">
          <h3>
            <Link to="/games/$game" params={{ game: game.id }}>
              {game.name}
            </Link>
          </h3>
          <ArrowUpRight size={18} />
        </div>
        <p>
          {game.icon === "diamond" ? <Diamond size={14} /> : <Coins size={14} />} {game.currency}{" "}
          top-up
        </p>
        <Button variant="outline" asChild className="w-full">
          <Link to="/games/$game" params={{ game: game.id }}>
            View top-ups <ArrowRight />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function GameGrid({ items = [] }: { items?: readonly CatalogGame[] }) {
  return (
    <div className="game-grid">
      {items.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}

export function GameGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="game-grid" aria-label="Loading games" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="game-card">
          <div className="skeleton skeleton-block" style={{ aspectRatio: "4 / 3" }} />
          <div className="skeleton skeleton-line" style={{ marginTop: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
        </div>
      ))}
    </div>
  );
}

/** Firestore-backed catalog grid with loading, empty, and error states. */
export function CatalogGrid({ items }: { items?: readonly CatalogGame[] }) {
  const { data, isLoading, error, refetch } = useGames();
  if (isLoading) return <GameGridSkeleton />;
  if (error)
    return (
      <div className="empty-state">
        <span className="empty-icon">
          <Search size={30} />
        </span>
        <h2>Couldn't load games</h2>
        <p>The catalog couldn't be loaded right now. Please check your connection and try again.</p>
        <Button onClick={() => void refetch()}>
          Try again <ArrowRight />
        </Button>
      </div>
    );
  const list = items ?? data ?? [];
  if (list.length === 0) return <EmptyState />;
  return <GameGrid items={list} />;
}

export function Steps({ full = false }: { full?: boolean }) {
  const items = [
    {
      icon: Gamepad2,
      title: "Pick your game",
      description: "Find the game you play and explore its top-up options.",
    },
    {
      icon: Diamond,
      title: "Choose your top-up",
      description: "Select a package from the current catalog.",
    },
    {
      icon: Check,
      title: "Submit payment proof",
      description: "eZ Cash receipts are reviewed manually; top-ups are not automated.",
    },
  ];
  return (
    <div className={`steps-grid ${full ? "full-steps" : ""}`}>
      {items.map((item, index) => (
        <div className="step" key={item.title}>
          <div className="step-icon">
            <item.icon size={23} />
            <span>0{index + 1}</span>
          </div>
          <div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </div>
          {index < 2 && <ArrowRight className="step-arrow" size={18} />}
        </div>
      ))}
    </div>
  );
}

export function FAQ({ compact = false, query = "" }: { compact?: boolean; query?: string }) {
  const { data: firestoreFaqs } = useQuery({
    queryKey: ["storeFaqs"],
    queryFn: fetchStoreFaqs,
    staleTime: 60_000,
  });
  const currentFaqs = firestoreFaqs ?? faqs;
  const items = (compact ? currentFaqs.slice(0, 4) : currentFaqs).filter((item) =>
    `${item.question} ${item.answer}`.toLowerCase().includes(query.toLowerCase().trim()),
  );
  return (
    <div className="faq-list">
      {items.map((item) => (
        <details key={item.question}>
          <summary>
            {item.question}
            <ChevronDown size={18} />
          </summary>
          <p>{item.answer}</p>
        </details>
      ))}
      {items.length === 0 && (
        <p className="empty-state">No matching answers. Try a different search.</p>
      )}
    </div>
  );
}

export function SupportBand() {
  return (
    <section className="support-band">
      <div className="support-band-title">
        <span className="support-icon">
          <HelpCircle size={25} />
        </span>
        <div>
          <h2>A little help goes a long way.</h2>
          <p>Find answers before you top up.</p>
        </div>
      </div>
      <Button variant="outline" asChild>
        <Link to="/support">
          Visit support <ArrowUpRight />
        </Link>
      </Button>
    </section>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function EmptyState({ favorite = false }: { favorite?: boolean }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{favorite ? <Heart size={30} /> : <Search size={30} />}</span>
      <h2>{favorite ? "Your favorites start here" : "No games found"}</h2>
      <p>
        {favorite
          ? "Save a game with the heart. Sign in to sync favorites to your account."
          : "Try a different game name, or search for Diamonds, Gold, UC, or CP."}
      </p>
      <Button asChild>
        <Link to="/games">
          Explore games <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}
