import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Diamond,
  Gamepad2,
  Heart,
  Info,
  ShieldCheck,
  Sparkles,
  Package,
  Zap,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogGrid, Steps, SupportBand, FAQ, LatestTopups } from "@/components/store-ui";
import { pageHead } from "@/lib/store-data";
import { resolveArtwork, useGameAccounts, useGames } from "@/lib/firestore";
import { useQuery } from "@tanstack/react-query";
import { fetchApiCatalog } from "@/lib/api-client";
import hero from "@/assets/diamond-world.jpg";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "HASA GOLD STORE | Premium Game Top-Ups in Sri Lanka",
      "Browse premium game top-ups and current package availability in Sri Lanka.",
    ),
  component: Index,
});

const TONE_CLASS: Record<string, string> = {
  ice: "acc-tone-ice",
  ember: "acc-tone-ember",
  olive: "acc-tone-olive",
  violet: "acc-tone-violet",
};

function Index() {
  const {
    data: featured = [],
    isLoading: accountsLoading,
    error: accountsError,
    refetch: retryAccounts,
  } = useGameAccounts();
  // Game names and counts come from the live catalog, so the homepage can never
  // advertise a game that is not actually available.
  const { data: games = [] } = useGames();
  const activeGames = games.filter((game) => game.active);
  const { data: catalog } = useQuery({
    queryKey: ["publicCatalogStats"],
    queryFn: fetchApiCatalog,
    staleTime: 0,
  });
  const activePackageCount = catalog?.products.filter((product) => product.active).length;
  const gameNames = activeGames
    .map((game) => game.name.replace(/\s*\(.*?\)\s*$/, ""))
    .filter(Boolean);
  const gameCount = gameNames.length;
  const gameList =
    gameNames.length > 0
      ? gameNames.slice(0, 3).join(", ") + (gameNames.length > 3 ? " and more" : "")
      : "every game in the live catalog";
  // Never claim "0 games" when the catalog could not be read.
  const gameCountLabel = gameCount > 0 ? String(gameCount) : "Live";
  const gamesWord = gameCount > 0 ? "Games" : "Catalog";
  const gamesPill = gameCount > 0 ? `${gameCount} Games Active` : "Live Catalog";
  const supportedGamesTitle = gameCount > 0 ? `${gameCount} Supported Games` : "Live Catalog Games";
  return (
    <div className="container">
      {/* ── Desktop Cinematic Hero (>640 px) ─────────────────────────── */}
      <section className="hero">
        <img
          className="hero-image"
          src={hero}
          alt="Gaming diamonds and gold coins"
          width={1536}
          height={864}
        />
        {/* Deep cinematic gradient overlay */}
        <span className="hero-film" aria-hidden="true" />
        {/* Animated particle glow */}
        <span className="hero-glow-orb hero-glow-orb--gold" aria-hidden="true" />
        <span className="hero-glow-orb hero-glow-orb--blue" aria-hidden="true" />

        {/* Live pill – top-right */}
        <span className="hero-live-tag">
          <span className="hero-live-dot" aria-hidden="true" />
          Live catalog
        </span>

        {/* Floating game badges */}
        {games.slice(0, 3).map((game) => (
          <span key={game.id} className="hero-badge hero-badge--ff" aria-hidden="true">
            {game.icon === "diamond" ? <Diamond size={12} /> : <Zap size={12} />} {game.name}
          </span>
        ))}

        <div className="hero-content">
          {/* Eyebrow pill */}
          <span className="eyebrow hero-eyebrow">
            <span className="hero-eyebrow-icon" aria-hidden="true">
              <Sparkles size={12} />
            </span>
            YOUR NEXT LEVEL STARTS HERE
          </span>

          {/* Brand kicker */}
          <span className="hero-brandline">HASA GOLD &amp; TOP-UP STORE</span>

          {/* Main headline */}
          <h1>
            More play.
            <br />
            <span className="hero-title-accent">More possibilities.</span>
          </h1>

          <p>Direct game top-ups for {gameList}.</p>

          {/* Trust stats strip */}
          <div className="hero-stats">
            <span className="hero-stat">
              <Gamepad2 size={14} />
              <strong>{gameCountLabel}</strong> {gamesWord}
            </span>
            <span className="hero-stat-sep" aria-hidden="true" />
            <span className="hero-stat">
              <ShieldCheck size={14} />
              Player&nbsp;ID&nbsp;only
            </span>
            <span className="hero-stat-sep" aria-hidden="true" />
            <span className="hero-stat">
              <BadgeCheck size={14} />
              Manual&nbsp;review
            </span>
            <span className="hero-stat-sep" aria-hidden="true" />
            <span className="hero-stat">
              <Zap size={14} />
              eZ&nbsp;Cash&nbsp;ready
            </span>
          </div>

          {/* CTAs */}
          <div className="hero-actions">
            <Button asChild size="lg" className="hero-cta-primary">
              <Link to="/games">
                Explore top-ups <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="hero-cta-outline">
              <Link to="/accounts">
                Browse accounts <ArrowUpRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* ── Mobile Hero (≤640 px) ────────────────────────── */}
      <section className="hero-mobile">
        <div className="hero-mobile-bg-glow" aria-hidden="true" />
        <img
          className="hero-mobile-bg-image"
          src={hero}
          alt="Gaming diamonds and gold coins"
          width={800}
          height={600}
        />
        <div className="hero-mobile-overlay" aria-hidden="true" />

        <div className="hero-mobile-inner">
          {/* Top header row inside hero */}
          <div className="hero-mobile-top">
            <span className="hero-mobile-chip">
              <span className="hero-mobile-dot" aria-hidden="true" />
              Live catalog
            </span>
            <span className="hero-mobile-games-pill">
              <Gamepad2 size={12} /> {gamesPill}
            </span>
          </div>

          <div className="hero-mobile-badge-kicker">
            <Sparkles size={11} /> HASA GOLD STORE
          </div>

          {/* Headline */}
          <h1 className="hero-mobile-title">
            More play.
            <br />
            <span className="hero-mobile-title-accent">More possibilities.</span>
          </h1>

          <p className="hero-mobile-sub">
            Browse live game top-ups and follow payment review and order status updates.
          </p>

          {/* Quick game chips bar */}
          <div className="hero-mobile-game-chips">
            {games.slice(0, 3).map((game) => (
              <span key={game.id} className="hero-mobile-game-tag">
                {game.icon === "diamond" ? <Diamond size={11} /> : <Zap size={11} />} {game.name}
              </span>
            ))}
          </div>

          {/* Primary & Secondary Action CTAs side-by-side or stacked cleanly */}
          <div className="hero-mobile-actions">
            <Button asChild size="lg" className="hero-mobile-btn-primary">
              <Link to="/games">
                Explore top-ups <ArrowRight size={16} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="hero-mobile-btn-outline">
              <Link to="/accounts">
                Browse accounts <ArrowUpRight size={16} />
              </Link>
            </Button>
          </div>

          {/* Trust points grid */}
          <div className="hero-mobile-trust-grid">
            <div className="hero-mobile-trust-item">
              <ShieldCheck size={14} />
              <span>Player ID Only</span>
            </div>
            <div className="hero-mobile-trust-item">
              <BadgeCheck size={14} />
              <span>Manual payment review</span>
            </div>
            <div className="hero-mobile-trust-item">
              <Zap size={14} />
              <span>Secure eZ Cash</span>
            </div>
          </div>
        </div>
      </section>
      <div className="feature-row">
        <div className="feature-item">
          <div className="feature-item-icon">
            <Gamepad2 size={20} />
          </div>
          <div className="feature-item-text">
            <h3>{supportedGamesTitle}</h3>
            <p>{gameList}.</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-item-icon">
            <ShieldCheck size={20} />
          </div>
          <div className="feature-item-text">
            <h3>Player ID Top-ups</h3>
            <p>Top-ups use a Player ID; check order status to follow fulfillment.</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-item-icon">
            <BadgeCheck size={20} />
          </div>
          <div className="feature-item-text">
            <h3>Account purchases unavailable</h3>
            <p>Account listings and checkout are not available through this store.</p>
          </div>
        </div>
        <div className="feature-item">
          <div className="feature-item-icon">
            <Zap size={20} />
          </div>
          <div className="feature-item-text">
            <h3>Secure eZ Cash</h3>
            <p>Submit your receipt and track the review in your account.</p>
          </div>
        </div>
      </div>
      <section className="home-stats" aria-labelledby="home-stats-title">
        <div className="home-stats-heading">
          <span className="eyebrow">
            <Sparkles size={13} /> THE STORE, AT A GLANCE
          </span>
          <h2 id="home-stats-title">A better way to top up</h2>
          <p>Live catalog information and clear order support, all in one place.</p>
        </div>
        <div className="home-stats-grid">
          <article className="home-stat-card home-stat-card-primary">
            <span className="home-stat-icon">
              <Gamepad2 size={20} />
            </span>
            <strong>{games.length ? activeGames.length : "—"}</strong>
            <span>Active games</span>
            <small>Available in our live catalog</small>
          </article>
          <article className="home-stat-card">
            <span className="home-stat-icon">
              <Package size={20} />
            </span>
            <strong>{activePackageCount ?? "—"}</strong>
            <span>Active packages</span>
            <small>Current top-up options</small>
          </article>
          <article className="home-stat-card">
            <span className="home-stat-icon">
              <ShieldCheck size={20} />
            </span>
            <strong>100+</strong>
            <span>Customers</span>
            <small>Thank you for choosing HASA GOLD STORE</small>
          </article>
          <article className="home-stat-card">
            <span className="home-stat-icon">
              <BadgeCheck size={20} />
            </span>
            <strong>100%</strong>
            <span>Satisfaction</span>
            <small>Here to support your top-up experience</small>
          </article>
        </div>
      </section>
      <section className="home-section home-catalog-section">
        <div className="section-heading">
          <div>
            <h2>Choose your game</h2>
            <p>Browse available packages in the live catalog.</p>
          </div>
          <Button variant="link" asChild>
            <Link to="/games">
              View all games <ArrowRight />
            </Link>
          </Button>
        </div>
        <CatalogGrid />
        <p className="catalog-note">
          <Info size={12} /> eZ Cash receipts require review before payment confirmation. Eligible
          paid Free Fire orders are submitted to Nexaura; other games are fulfilled by our team.
        </p>
      </section>

      <LatestTopups />

      {/* === FEATURED ACCOUNTS SECTION === */}
      <section className="home-section home-accounts-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow home-acc-eyebrow">
              <BadgeCheck size={12} /> ACCOUNT LISTINGS
            </span>
            <h2>Game Account Listings</h2>
            <p>
              {featured.length
                ? "Browse current game account listings. Purchase checkout is not available yet."
                : "Account listings and purchases are unavailable. Browse the live top-up catalog."}
            </p>
          </div>
          {featured.length > 0 && (
            <Button variant="link" asChild>
              <Link to="/accounts">
                View all accounts <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
        {accountsLoading ? (
          <div className="empty-state" aria-busy="true">
            Loading account listings…
          </div>
        ) : accountsError ? (
          <div className="empty-state" role="alert">
            <Package />
            <p>Account listings could not be loaded.</p>
            <Button variant="outline" onClick={() => void retryAccounts()}>
              Try again
            </Button>
          </div>
        ) : featured.length ? (
          <div className="home-account-grid">
            {featured.slice(0, 3).map((acc) => (
              <article
                key={acc.id}
                className={`account-card home-acc-card ${TONE_CLASS[acc.tone] ?? ""}`}
              >
                <Link
                  to="/accounts/$account"
                  params={{ account: acc.id }}
                  className="account-card-img-wrap"
                  aria-label={`View ${acc.title}`}
                >
                  <img
                    src={resolveArtwork(acc.artworkKey)}
                    alt={`${acc.gameName} account`}
                    width={600}
                    height={400}
                    loading="lazy"
                    className="account-card-img"
                  />
                  <span className="account-card-price">{acc.priceSample}</span>
                </Link>
                <div className="account-card-body">
                  <div className="account-card-meta">
                    <span className="account-game-tag">{acc.gameName}</span>
                    <span className="account-level-pill">Lv {acc.level}</span>
                  </div>
                  <h3 className="account-card-title">
                    <Link to="/accounts/$account" params={{ account: acc.id }}>
                      {acc.title}
                    </Link>
                  </h3>
                  <Button
                    size="sm"
                    asChild
                    className="account-card-cta"
                    style={{ marginTop: "12px", width: "100%" }}
                  >
                    <Link to="/accounts/$account" params={{ account: acc.id }}>
                      View Details <ArrowRight size={13} />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="accounts-coming-soon">
            <span className="accounts-coming-soon-glow" aria-hidden="true" />
            <span className="accounts-coming-soon-icon" aria-hidden="true">
              <Sparkles size={22} />
            </span>
            <span className="accounts-coming-soon-tag">Top-ups are available now</span>
            <h3>Game account marketplace</h3>
            <p>
              Account listings and checkout are not available yet. Browse the live top-up catalog to
              place a game top-up order.
            </p>
            <ul className="accounts-coming-soon-points">
              <li>
                <ShieldCheck size={14} /> Game account purchase is unavailable
              </li>
              <li>
                <BadgeCheck size={14} /> Top-up order tracking available
              </li>
              <li>
                <Gamepad2 size={14} /> Live game top-up catalog
              </li>
            </ul>
            <Button asChild size="lg" className="accounts-coming-soon-cta">
              <Link to="/games">
                Browse top-up packages <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        )}
        {featured.length > 0 && (
          <div className="acc-view-all-wrap">
            <Button asChild variant="outline" size="lg">
              <Link to="/accounts">
                Browse all game accounts <ArrowUpRight />
              </Link>
            </Button>
          </div>
        )}
      </section>

      <section className="steps-section">
        <div className="section-heading">
          <div>
            <h2>From game to top-up. Simply.</h2>
            <p>Three small steps. Ready for your next session.</p>
          </div>
          <Button variant="link" asChild className="hide-mobile">
            <Link to="/how-it-works">
              How it works <ArrowRight />
            </Link>
          </Button>
        </div>
        <Steps />
      </section>
      <SupportBand />
      <section className="faq-section">
        <div>
          <span className="eyebrow">GOOD TO KNOW</span>
          <h2>
            Questions?
            <br />
            We've got you.
          </h2>
          <p>A few answers to help you get started.</p>
          <Button variant="link" asChild>
            <Link to="/support">
              Explore all FAQs <ArrowRight />
            </Link>
          </Button>
        </div>
        <FAQ compact />
      </section>
    </div>
  );
}
