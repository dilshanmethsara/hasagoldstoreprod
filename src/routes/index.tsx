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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogGrid, Steps, SupportBand, FAQ } from "@/components/store-ui";
import { pageHead } from "@/lib/store-data";
import { resolveArtwork, useGameAccounts } from "@/lib/firestore";
import hero from "@/assets/diamond-world.jpg";

export const Route = createFileRoute("/")({
  head: () =>
    pageHead(
      "Gaming top-ups",
      "Browse the HASA GOLD STORE gaming catalog and current order availability.",
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
  return (
    <div className="container">
      <section className="hero">
        <img
          className="hero-image"
          src={hero}
          alt="Gaming diamonds and gold coins"
          width={1536}
          height={864}
        />
        <span className="hero-live-tag">Live catalog</span>
        <div className="hero-content">
          <span className="eyebrow hero-eyebrow">
            <span className="hero-eyebrow-icon" aria-hidden="true">
              <Sparkles size={12} />
            </span>
            YOUR NEXT LEVEL STARTS HERE
          </span>
          <h1>
            <span className="hero-brandline">HASA GOLD &amp; ACCOUNT STORE</span>
            More play.
            <br />
            <span className="hero-title-accent">More possibilities.</span>
          </h1>
          <p>Your favorite games, all in one place. Browse the catalog and track your orders.</p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/games">
                Explore top-ups <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/accounts">
                Browse accounts <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <span className="hero-note">
            <Info size={13} /> Payments and top-up fulfillment are not currently available.
          </span>
        </div>
      </section>
      <div className="feature-row">
        <div className="feature-item">
          <Gamepad2 />
          <div>
            <h3>Top-ups & accounts</h3>
            <p>Explore the store catalog.</p>
          </div>
        </div>
        <div className="feature-item">
          <BadgeCheck />
          <div>
            <h3>Account listings</h3>
            <p>Review listing details and availability.</p>
          </div>
        </div>
        <div className="feature-item">
          <Heart />
          <div>
            <h3>Keep your favorites close</h3>
            <p>Save games to your account.</p>
          </div>
        </div>
      </div>
      <section className="home-section">
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
          <Info size={12} /> eZ Cash receipts are reviewed manually; top-up fulfillment is not
          automated.
        </p>
      </section>

      {/* === FEATURED ACCOUNTS SECTION === */}
      <section className="home-section home-accounts-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow home-acc-eyebrow">
              <BadgeCheck size={12} /> ACCOUNT LISTINGS
            </span>
            <h2>Game Account Listings</h2>
            <p>Current listings from the store catalog. Purchases are not available yet.</p>
          </div>
          <Button variant="link" asChild>
            <Link to="/accounts">
              View all accounts <ArrowRight />
            </Link>
          </Button>
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
          <div className="empty-state">
            <Package />
            <p>No active account listings.</p>
          </div>
        )}
        <div className="acc-view-all-wrap">
          <Button asChild variant="outline" size="lg">
            <Link to="/accounts">
              Browse all game accounts <ArrowUpRight />
            </Link>
          </Button>
        </div>
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
