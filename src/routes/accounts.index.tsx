import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Filter, Loader2, Package, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";
import { useGameAccounts, resolveArtwork } from "@/lib/firestore";
import type { GameAccountDoc } from "@/lib/firestore-schema";

export const Route = createFileRoute("/accounts/")({
  head: () =>
    pageHead(
      "Game Accounts",
      "Review informational game account listings from the HASA GOLD STORE catalog. Verification, payment, and transfers are unavailable.",
    ),
  component: AccountsPage,
});

const GAME_FILTERS = [
  { id: "all", label: "All Games" },
  { id: "free-fire", label: "Free Fire" },
  { id: "pubg-mobile", label: "PUBG Mobile" },
  { id: "call-of-duty-mobile", label: "COD Mobile" },
  { id: "blood-strike", label: "Blood Strike" },
] as const;
type FilterId = (typeof GAME_FILTERS)[number]["id"];

const TONE_COLORS: Record<string, string> = {
  ice: "acc-tone-ice",
  ember: "acc-tone-ember",
  olive: "acc-tone-olive",
  violet: "acc-tone-violet",
};

function AccountCard({ account }: { account: GameAccountDoc }) {
  const image = resolveArtwork(account.artworkKey);
  return (
    <article className={`account-card ${TONE_COLORS[account.tone] ?? ""}`}>
      <Link
        to="/accounts/$account"
        params={{ account: account.id }}
        className="account-card-img-wrap"
        aria-label={`View ${account.title}`}
      >
        <img
          src={image}
          alt={`${account.gameName} account`}
          width={600}
          height={400}
          loading="lazy"
          className="account-card-img"
        />
        <span className="account-card-price">{account.priceSample}</span>
      </Link>
      <div className="account-card-body">
        <div className="account-card-meta">
          <span className="account-game-tag">{account.gameName}</span>
          <span className="account-level-pill">Lv {account.level}</span>
        </div>
        <h3 className="account-card-title">
          <Link to="/accounts/$account" params={{ account: account.id }}>
            {account.title}
          </Link>
        </h3>
        <p className="account-card-tagline">{account.tagline}</p>
        <div className="account-badges">
          {account.badges.slice(0, 3).map((b) => (
            <span key={b} className="account-badge">
              {b}
            </span>
          ))}
        </div>
        <div className="account-card-footer">
          <div className="account-meta-tags">
            <span className="account-meta-tag">
              <ShieldCheck size={11} /> {account.loginType.split(" ")[0] ?? account.loginType}
            </span>
            <span className="account-meta-tag">
              ⚡ {account.server.split("/")[0]?.trim() ?? account.server}
            </span>
          </div>
          <Button size="sm" asChild className="account-card-cta">
            <Link to="/accounts/$account" params={{ account: account.id }}>
              View Details <ArrowRight size={13} />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function AccountsPage() {
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const { data: firestoreAccounts, isLoading, error } = useGameAccounts();

  const allAccounts: GameAccountDoc[] = firestoreAccounts ?? [];
  const gamesCount = new Set(allAccounts.map((account) => account.gameId)).size;
  const displayedStat = (value: number) => (isLoading || error ? "—" : value);

  const filtered = allAccounts.filter((acc) => {
    const matchesGame = filter === "all" || acc.gameId === filter;
    const q = query.toLowerCase().trim();
    const matchesQuery =
      !q ||
      `${acc.title} ${acc.gameName} ${acc.rank} ${acc.badges.join(" ")}`.toLowerCase().includes(q);
    return matchesGame && matchesQuery;
  });

  return (
    <div className="container">
      <div className="accounts-hero">
        <div className="accounts-hero-content">
          <span className="eyebrow accounts-eyebrow">ACCOUNT CATALOG</span>
          <h1>Game Account Listings</h1>
          <p>
            Listings are informational only. This website cannot verify account ownership, accept
            payment, or transfer an account. Do not send payment for a listing.
          </p>
          <div className="accounts-trust-row">
            <span>Listing details are not independently verified</span>
            <span>Purchases and transfers unavailable</span>
          </div>
        </div>
        <div className="accounts-hero-stat-grid">
          <div className="acc-stat">
            <strong>{displayedStat(allAccounts.length)}</strong>
            <span>Active listings</span>
          </div>
          <div className="acc-stat">
            <strong>{displayedStat(gamesCount)}</strong>
            <span>Games represented</span>
          </div>
          <div className="acc-stat">
            <strong>No</strong>
            <span>Verification service</span>
          </div>
          <div className="acc-stat">
            <strong>No</strong>
            <span>Purchase workflow</span>
          </div>
        </div>
      </div>

      <div className="accounts-toolbar">
        <div className="accounts-filters" role="group" aria-label="Filter by game">
          <Filter size={14} className="filter-icon" />
          {GAME_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`acc-filter-btn ${filter === f.id ? "active" : ""}`}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="accounts-search-wrap">
          <Search size={15} className="acc-search-icon" />
          <input
            className="accounts-search"
            placeholder="Search by rank, skin, game…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search accounts"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">
          <Loader2 className="loading-spin" size={28} />
          <p>Loading accounts…</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <Package size={32} />
          <h2>Couldn't load accounts</h2>
          <p>Please try again.</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      ) : filtered.length > 0 ? (
        <div className="account-grid">
          {filtered.map((acc) => (
            <AccountCard key={acc.id} account={acc} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">
            <Package size={32} />
          </span>
          <h2>No accounts found</h2>
          <p>Try changing the filter or searching with different keywords.</p>
          <Button
            onClick={() => {
              setFilter("all");
              setQuery("");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}

      <section className="acc-trust-band">
        <div className="acc-trust-head">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>Account purchases</h2>
          <p>
            Account verification, payment, and credential transfer are unavailable through this
            website. Do not send payment.
          </p>
        </div>
        <div className="acc-trust-steps">
          <div className="acc-trust-step">
            <span className="acc-step-num">01</span>
            <h3>Review information</h3>
            <p>Catalog descriptions are not independently verified by this website.</p>
          </div>
          <span className="acc-step-arrow">
            <ArrowRight />
          </span>
          <div className="acc-trust-step">
            <span className="acc-step-num">02</span>
            <h3>Purchase unavailable</h3>
            <p>No purchase or support contact workflow is configured.</p>
          </div>
          <span className="acc-step-arrow">
            <ArrowRight />
          </span>
          <div className="acc-trust-step">
            <span className="acc-step-num">03</span>
            <h3>No payment</h3>
            <p>This website cannot accept payment or transfer account credentials.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
