import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Filter,
  Package, Search, ShieldCheck, Star, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { gameAccounts, pageHead, type GameAccount } from '@/lib/store-data';

export const Route = createFileRoute('/accounts/')({
  head: () =>
    pageHead(
      'Game Accounts',
      'Browse verified high-tier game accounts for Free Fire, PUBG Mobile, Call of Duty Mobile, and Blood Strike at HASA GOLD STORE.'
    ),
  component: AccountsPage,
});

const GAME_FILTERS = [
  { id: 'all', label: 'All Games' },
  { id: 'free-fire', label: 'Free Fire' },
  { id: 'pubg-mobile', label: 'PUBG Mobile' },
  { id: 'call-of-duty-mobile', label: 'COD Mobile' },
  { id: 'blood-strike', label: 'Blood Strike' },
] as const;

type FilterId = (typeof GAME_FILTERS)[number]['id'];

const TONE_COLORS: Record<string, string> = {
  ice: 'acc-tone-ice',
  ember: 'acc-tone-ember',
  olive: 'acc-tone-olive',
  violet: 'acc-tone-violet',
};

function AccountCard({ account }: { account: GameAccount }) {
  return (
    <article className={`account-card ${TONE_COLORS[account.tone] ?? ''}`}>
      <Link to="/accounts/$account" params={{ account: account.id }} className="account-card-img-wrap" aria-label={`View ${account.title}`}>
        <img src={account.image} alt={`${account.gameName} account showcase`} width={600} height={400} loading="lazy" className="account-card-img" />
        <span className="account-card-status" data-status={account.status}>{account.status}</span>
        {account.verified && (
          <span className="account-card-verified" title="Verified listing">
            <BadgeCheck size={13} /> Verified
          </span>
        )}
        <span className="account-card-price">{account.priceSample}</span>
      </Link>

      <div className="account-card-body">
        <div className="account-card-meta">
          <span className="account-game-tag">{account.gameName}</span>
          <span className="account-level-pill">Lv {account.level}</span>
        </div>

        <h3 className="account-card-title">
          <Link to="/accounts/$account" params={{ account: account.id }}>{account.title}</Link>
        </h3>
        <p className="account-card-tagline">{account.tagline}</p>

        <div className="account-badges">
          {account.badges.slice(0, 3).map(badge => (
            <span key={badge} className="account-badge">{badge}</span>
          ))}
        </div>

        <div className="account-card-footer">
          <div className="account-meta-tags">
            <span className="account-meta-tag"><ShieldCheck size={11} /> {account.loginType.split(' ')[0] ?? account.loginType}</span>
            <span className="account-meta-tag">⚡ {account.server.split('/')[0]?.trim() ?? account.server}</span>
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
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');

  const filtered = gameAccounts.filter(acc => {
    const matchesGame = filter === 'all' || acc.gameId === filter;
    const q = query.toLowerCase().trim();
    const matchesQuery = !q || `${acc.title} ${acc.gameName} ${acc.rank} ${acc.badges.join(' ')}`.toLowerCase().includes(q);
    return matchesGame && matchesQuery;
  });

  return (
    <div className="container">
      {/* Page hero */}
      <div className="accounts-hero">
        <div className="accounts-hero-content">
          <span className="eyebrow accounts-eyebrow"><Star size={12} /> VERIFIED MARKETPLACE</span>
          <h1>Game Accounts<span className="accounts-hero-accent"> for Sale</span></h1>
          <p>Handpicked high-tier accounts with clean bindings, complete inventory details, and secure credential transfer. All listings are sample previews.</p>
          <div className="accounts-trust-row">
            <span><BadgeCheck size={14} /> Verified Listings</span>
            <span><ShieldCheck size={14} /> Clean Transfer</span>
            <span><Zap size={14} /> Instant Handover</span>
          </div>
        </div>
        <div className="accounts-hero-stat-grid">
          <div className="acc-stat"><strong>6+</strong><span>Accounts Listed</span></div>
          <div className="acc-stat"><strong>4</strong><span>Games Available</span></div>
          <div className="acc-stat"><strong>100%</strong><span>Verified</span></div>
          <div className="acc-stat"><strong>Safe</strong><span>Clean Transfers</span></div>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="accounts-toolbar">
        <div className="accounts-filters" role="group" aria-label="Filter by game">
          <Filter size={14} className="filter-icon" />
          {GAME_FILTERS.map(f => (
            <button
              key={f.id}
              className={`acc-filter-btn ${filter === f.id ? 'active' : ''}`}
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
            onChange={e => setQuery(e.target.value)}
            aria-label="Search accounts"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="account-grid">
          {filtered.map(acc => <AccountCard key={acc.id} account={acc} />)}
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon"><Package size={32} /></span>
          <h2>No accounts found</h2>
          <p>Try changing the filter or searching with different keywords.</p>
          <Button onClick={() => { setFilter('all'); setQuery(''); }}>Clear filters</Button>
        </div>
      )}

      {/* Handover Trust Band */}
      <section className="acc-trust-band">
        <div className="acc-trust-head">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>Safe & Verified Account Handover</h2>
          <p>Our 3-step process ensures secure ownership transfer with zero risk of recovery.</p>
        </div>
        <div className="acc-trust-steps">
          <div className="acc-trust-step">
            <span className="acc-step-num">01</span>
            <h3>Select & Verify</h3>
            <p>Browse verified listings. Each account is manually inspected for clean binding, no linked phone numbers, and zero recovery risks.</p>
          </div>
          <span className="acc-step-arrow"><ArrowRight /></span>
          <div className="acc-trust-step">
            <span className="acc-step-num">02</span>
            <h3>Confirm & Pay</h3>
            <p>Complete your order. Our team prepares the full credential package — login email, password, and 2FA setup guide.</p>
          </div>
          <span className="acc-step-arrow"><ArrowRight /></span>
          <div className="acc-trust-step">
            <span className="acc-step-num">03</span>
            <h3>Instant Delivery</h3>
            <p>Receive credentials instantly via secured channel. Change email and password immediately. Account is fully yours.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
