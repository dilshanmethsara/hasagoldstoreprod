import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Copy,
  Loader2,
  AlertTriangle,
  Package,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { pageHead } from "@/lib/store-data";
import { useGameAccount, useGameAccounts, resolveArtwork } from "@/lib/firestore";

export const Route = createFileRoute("/accounts/$account")({
  head: ({ params }) => {
    return pageHead(
      "Game account listing",
      `Review current game account listing ${params.account} from the HASA GOLD STORE catalog.`,
    );
  },
  component: AccountDetailPage,
});

const TONE_CLASS: Record<string, string> = {
  ice: "acc-tone-ice",
  ember: "acc-tone-ember",
  olive: "acc-tone-olive",
  violet: "acc-tone-violet",
};

function AccountDetailPage() {
  const { account: accountId } = Route.useParams();
  const { data: acc, isLoading, error, refetch } = useGameAccount(accountId);
  const { data: allAccounts } = useGameAccounts();
  const [inquireOpen, setInquireOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <div className="container" style={{ paddingTop: 80, textAlign: "center" }}>
        <Loader2 className="loading-spin" size={32} />
      </div>
    );
  }
  if (error) {
    return (
      <div className="container page-content">
        <div className="empty-state" role="alert">
          <h1>Listing could not be loaded</h1>
          <p>Please check your connection and retry.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }
  if (!acc) throw notFound();

  const image = resolveArtwork(acc.artworkKey);
  const {
    tone,
    title,
    tagline,
    gameName,
    gameId,
    priceSample: price,
    badges,
    features,
    inventoryHighlights: inventory,
    description: desc,
    loginType,
    server,
    level,
    rank,
  } = acc;

  const related = (allAccounts ?? [])
    .filter((a) => a.gameId === gameId && a.id !== accountId)
    .slice(0, 2);

  function copyId() {
    navigator.clipboard.writeText(accountId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="container">
      <nav className="acc-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to="/accounts">Accounts</Link>
        <ChevronRight size={13} />
        <span aria-current="page">{gameName}</span>
      </nav>

      <div className={`account-detail-layout ${TONE_CLASS[tone] ?? ""}`}>
        <div className="account-detail-main">
          <div className="account-gallery">
            <img
              src={image}
              alt={`${gameName} account — ${title}`}
              width={900}
              height={560}
              className="account-gallery-img"
            />
          </div>

          <div className="account-inventory">
            <h2 className="inv-heading">
              <Package size={18} /> Inventory Highlights
            </h2>
            <ul className="inv-list">
              {inventory.map((item) => (
                <li key={item}>
                  <Star size={12} className="inv-star" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="account-description-block">
            <h2>About This Account</h2>
            <p>{desc}</p>
          </div>

          <div className="account-guarantee">
            <div className="guarantee-head">
              <ShieldCheck size={22} />
              <div>
                <h3>Purchase unavailable</h3>
                <p>
                  This site does not currently provide account verification, payment, or credential
                  delivery. Listing details are not independently verified. Do not send payment for
                  this listing.
                </p>
              </div>
            </div>
          </div>
        </div>

        <aside className="account-spec-card">
          <div className="spec-card-inner">
            <div className="spec-card-head">
              <span className="spec-game-tag">{gameName}</span>
            </div>
            <h1 className="spec-title">{title}</h1>
            <p className="spec-tagline">{tagline}</p>
            <div className="spec-price-row">
              <span className="spec-price">{price}</span>
              {acc && (
                <span className="spec-price-note">Rs. {acc.pricePkr.toLocaleString()} PKR</span>
              )}
            </div>
            <div className="spec-badges">
              {badges.map((b) => (
                <span key={b} className="spec-badge">
                  {b}
                </span>
              ))}
            </div>
            <div className="spec-features">
              {features.map((f) => (
                <div key={f.label} className="spec-feature-row">
                  <span className="spec-feature-label">{f.label}</span>
                  <span className="spec-feature-value">{f.value}</span>
                </div>
              ))}
            </div>
            <div className="spec-meta">
              <div className="spec-meta-item">
                <ShieldCheck size={13} />
                <span>{loginType}</span>
              </div>
              <div className="spec-meta-item">
                <Zap size={13} />
                <span>Server: {server}</span>
              </div>
            </div>
            <div className="spec-actions">
              <Button size="lg" className="w-full" onClick={() => setInquireOpen(true)}>
                <AlertTriangle size={16} /> Purchase unavailable
              </Button>
              <Button variant="outline" size="sm" className="w-full spec-copy-btn" onClick={copyId}>
                <Copy size={13} />
                {copied ? "Listing ID Copied!" : "Copy Listing ID"}
              </Button>
            </div>
            <p className="spec-disclaimer">
              Listing only. Purchase processing and support contact are not configured.
            </p>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="related-accounts">
          <div className="section-heading">
            <div>
              <h2>More {gameName} Accounts</h2>
              <p>Explore other listings in the same game.</p>
            </div>
            <Button variant="link" asChild>
              <Link to="/accounts">
                View all <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
          <div className="related-account-grid">
            {related.map((rel) => {
              const relImg = resolveArtwork(rel.artworkKey);
              return (
                <article key={rel.id} className={`account-card ${TONE_CLASS[rel.tone] ?? ""}`}>
                  <Link
                    to="/accounts/$account"
                    params={{ account: rel.id }}
                    className="account-card-img-wrap"
                  >
                    <img
                      src={relImg}
                      alt={rel.title}
                      width={600}
                      height={400}
                      loading="lazy"
                      className="account-card-img"
                    />
                    <span className="account-card-price">{rel.priceSample}</span>
                  </Link>
                  <div className="account-card-body">
                    <div className="account-card-meta">
                      <span className="account-game-tag">{rel.gameName}</span>
                      <span className="account-level-pill">Lv {rel.level}</span>
                    </div>
                    <h3 className="account-card-title">
                      <Link to="/accounts/$account" params={{ account: rel.id }}>
                        {rel.title}
                      </Link>
                    </h3>
                    <Button
                      size="sm"
                      asChild
                      className="account-card-cta"
                      style={{ marginTop: 12 }}
                    >
                      <Link to="/accounts/$account" params={{ account: rel.id }}>
                        View Details <ArrowRight size={13} />
                      </Link>
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <div className="acc-back-row">
        <Button variant="outline" asChild>
          <Link to="/accounts">
            <ArrowLeft size={14} /> Back to Accounts
          </Link>
        </Button>
      </div>

      <Dialog open={inquireOpen} onOpenChange={setInquireOpen}>
        <DialogContent className="inquire-modal">
          <DialogTitle>Account purchase unavailable</DialogTitle>
          <DialogDescription>
            This website is not currently able to accept account purchase inquiries or payments.
          </DialogDescription>
          <div className="inquire-account-info">
            <img src={image} alt="" width={80} height={50} />
            <div>
              <strong>{gameName}</strong>
              <p>{title}</p>
              <span className="inquire-price">{price}</span>
            </div>
          </div>
          <div className="inquire-actions">
            <Button variant="outline" className="w-full" asChild>
              <Link to="/accounts" onClick={() => setInquireOpen(false)}>
                Back to listings
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
