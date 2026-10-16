import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, ChevronRight,
  Copy, MessageCircle, Package, ShieldCheck, Star, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { gameAccounts, pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/accounts/$account')({
  head: ({ params }) => {
    const acc = gameAccounts.find(a => a.id === params.account);
    return acc
      ? pageHead(acc.title, acc.description)
      : pageHead('Account Not Found', 'This account listing could not be found.');
  },
  component: AccountDetailPage,
});

const TONE_CLASS: Record<string, string> = {
  ice: 'acc-tone-ice',
  ember: 'acc-tone-ember',
  olive: 'acc-tone-olive',
  violet: 'acc-tone-violet',
};

function AccountDetailPage() {
  const { account: accountId } = Route.useParams();
  const acc = gameAccounts.find(a => a.id === accountId);
  const [inquireOpen, setInquireOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!acc) throw notFound();

  function copyId() {
    navigator.clipboard.writeText(acc!.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const related = gameAccounts.filter(a => a.gameId === acc.gameId && a.id !== acc.id).slice(0, 2);

  return (
    <div className="container">
      {/* Breadcrumbs */}
      <nav className="acc-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={13} />
        <Link to="/accounts">Accounts</Link>
        <ChevronRight size={13} />
        <span aria-current="page">{acc.gameName}</span>
      </nav>

      <div className={`account-detail-layout ${TONE_CLASS[acc.tone] ?? ''}`}>
        {/* Left: Showcase */}
        <div className="account-detail-main">
          {/* Image Gallery */}
          <div className="account-gallery">
            <img
              src={acc.image}
              alt={`${acc.gameName} account showcase — ${acc.title}`}
              width={900}
              height={560}
              className="account-gallery-img"
            />
            {acc.verified && (
              <span className="acc-verified-badge">
                <BadgeCheck size={14} /> Verified Listing
              </span>
            )}
            <span className="acc-status-badge" data-status={acc.status}>{acc.status}</span>
          </div>

          {/* Inventory highlights */}
          <div className="account-inventory">
            <h2 className="inv-heading">
              <Package size={18} /> Inventory Highlights
            </h2>
            <ul className="inv-list">
              {acc.inventoryHighlights.map(item => (
                <li key={item}>
                  <Star size={12} className="inv-star" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Description */}
          <div className="account-description-block">
            <h2>About This Account</h2>
            <p>{acc.description}</p>
          </div>

          {/* Transfer Guarantee */}
          <div className="account-guarantee">
            <div className="guarantee-head">
              <ShieldCheck size={22} />
              <div>
                <h3>Full Email Transfer Guarantee</h3>
                <p>You receive 100% ownership — login, recovery email, password, and 2FA reset guidance included.</p>
              </div>
            </div>
            <div className="guarantee-steps">
              <div><span>01</span><p>Receive encrypted credential package</p></div>
              <div><span>02</span><p>Change login email to your own</p></div>
              <div><span>03</span><p>Reset password & enable 2FA</p></div>
            </div>
          </div>
        </div>

        {/* Right: Sticky spec card */}
        <aside className="account-spec-card">
          <div className="spec-card-inner">
            <div className="spec-card-head">
              <span className="spec-game-tag">{acc.gameName}</span>
              {acc.verified && <span className="spec-verified"><BadgeCheck size={12} /> Verified</span>}
            </div>

            <h1 className="spec-title">{acc.title}</h1>
            <p className="spec-tagline">{acc.tagline}</p>

            <div className="spec-price-row">
              <span className="spec-price">{acc.priceSample}</span>
              <span className="spec-price-note">Sample price · No real purchase</span>
            </div>

            <div className="spec-badges">
              {acc.badges.map(badge => (
                <span key={badge} className="spec-badge">{badge}</span>
              ))}
            </div>

            <div className="spec-features">
              {acc.features.map(feat => (
                <div key={feat.label} className="spec-feature-row">
                  <span className="spec-feature-label">{feat.label}</span>
                  <span className="spec-feature-value">{feat.value}</span>
                </div>
              ))}
            </div>

            <div className="spec-meta">
              <div className="spec-meta-item">
                <ShieldCheck size={13} />
                <span>{acc.loginType}</span>
              </div>
              <div className="spec-meta-item">
                <Zap size={13} />
                <span>Server: {acc.server}</span>
              </div>
            </div>

            <div className="spec-actions">
              <Button size="lg" className="w-full" onClick={() => setInquireOpen(true)}>
                <MessageCircle size={16} /> Inquire / Buy Now
              </Button>
              <Button variant="outline" size="sm" className="w-full spec-copy-btn" onClick={copyId}>
                <Copy size={13} />
                {copied ? 'Listing ID Copied!' : 'Copy Listing ID'}
              </Button>
            </div>

            <p className="spec-disclaimer">
              ⚠️ Sample listing preview. No real payments processed in this demo.
            </p>
          </div>
        </aside>
      </div>

      {/* Related accounts */}
      {related.length > 0 && (
        <section className="related-accounts">
          <div className="section-heading">
            <div>
              <h2>More {acc.gameName} Accounts</h2>
              <p>Explore other listings in the same game.</p>
            </div>
            <Button variant="link" asChild>
              <Link to="/accounts">View all <ArrowRight size={14} /></Link>
            </Button>
          </div>
          <div className="related-account-grid">
            {related.map(rel => (
              <article key={rel.id} className={`account-card ${TONE_CLASS[rel.tone] ?? ''}`}>
                <Link to="/accounts/$account" params={{ account: rel.id }} className="account-card-img-wrap">
                  <img src={rel.image} alt={rel.title} width={600} height={400} loading="lazy" className="account-card-img" />
                  <span className="account-card-price">{rel.priceSample}</span>
                </Link>
                <div className="account-card-body">
                  <div className="account-card-meta">
                    <span className="account-game-tag">{rel.gameName}</span>
                    <span className="account-level-pill">Lv {rel.level}</span>
                  </div>
                  <h3 className="account-card-title">
                    <Link to="/accounts/$account" params={{ account: rel.id }}>{rel.title}</Link>
                  </h3>
                  <Button size="sm" asChild className="account-card-cta" style={{ marginTop: '12px' }}>
                    <Link to="/accounts/$account" params={{ account: rel.id }}>
                      View Details <ArrowRight size={13} />
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Back to catalog */}
      <div className="acc-back-row">
        <Button variant="outline" asChild>
          <Link to="/accounts"><ArrowLeft size={14} /> Back to Accounts</Link>
        </Button>
      </div>

      {/* Inquiry Modal */}
      <Dialog open={inquireOpen} onOpenChange={setInquireOpen}>
        <DialogContent className="inquire-modal">
          <DialogTitle>Inquire About This Account</DialogTitle>
          <DialogDescription>
            This is a demo preview. In the live store, submit your inquiry and our team will respond within 24 hours.
          </DialogDescription>

          <div className="inquire-account-info">
            <img src={acc.image} alt="" width={80} height={50} />
            <div>
              <strong>{acc.gameName}</strong>
              <p>{acc.title}</p>
              <span className="inquire-price">{acc.priceSample}</span>
            </div>
          </div>

          <div className="inquire-steps">
            <h4>How purchase works</h4>
            <div className="inquire-step"><span>1</span><p>Submit inquiry via WhatsApp or email</p></div>
            <div className="inquire-step"><span>2</span><p>Team verifies account and confirms price</p></div>
            <div className="inquire-step"><span>3</span><p>Payment confirmed → credentials delivered within 1 hour</p></div>
          </div>

          <div className="inquire-actions">
            <Button className="w-full" onClick={() => setInquireOpen(false)}>
              <MessageCircle size={15} /> Contact via WhatsApp (Demo)
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/support" onClick={() => setInquireOpen(false)}>
                Visit Support
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
