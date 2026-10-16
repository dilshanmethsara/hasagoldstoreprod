import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, BadgeCheck, Diamond, Gamepad2, Heart, Info, ShieldCheck, Sparkles, MousePointer2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GameGrid, Steps, SupportBand, FAQ } from '@/components/store-ui';
import { gameAccounts, pageHead } from '@/lib/store-data';
import hero from '@/assets/diamond-world.jpg';

export const Route = createFileRoute('/')({ head: () => pageHead('Gaming top-ups', 'Discover Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile sample top-up options at HASA GOLD STORE.'), component: Index });

const TONE_CLASS: Record<string, string> = {
  ice: 'acc-tone-ice', ember: 'acc-tone-ember', olive: 'acc-tone-olive', violet: 'acc-tone-violet',
};

function Index() {
  const featured = gameAccounts.slice(0, 3);
  return <div className="container"><section className="hero"><img className="hero-image" src={hero} alt="Sample artwork of blue diamonds and gold gaming coins" width={1536} height={864}/><div className="hero-content"><span className="eyebrow hero-eyebrow"><Sparkles size={12}/> YOUR NEXT LEVEL STARTS HERE</span><h1>HASA GOLD STORE<span>More play.<br/>More possibilities.</span></h1><p>Your favorite games, all in one place.<br/>Top-ups, verified accounts, and more.</p><div className="hero-actions"><Button asChild size="lg"><Link to="/games">Explore top-ups <ArrowRight /></Link></Button><Button asChild variant="outline" size="lg"><Link to="/accounts">Browse accounts <ArrowUpRight /></Link></Button></div><span className="hero-note"><Info size={13}/> Preview only · No real orders or payments</span></div><span className="hero-art-label">Sample artwork</span></section>
    <div className="feature-row"><div className="feature-item"><Gamepad2/><div><h3>Top-ups & accounts</h3><p>Two services. One destination.</p></div></div><div className="feature-item"><BadgeCheck/><div><h3>Verified accounts</h3><p>Clean bindings, safe transfers.</p></div></div><div className="feature-item"><Heart/><div><h3>Keep your favorites close</h3><p>Less searching. More gaming.</p></div></div></div>
    <section className="home-section"><div className="section-heading"><div><h2>Choose your game</h2><p>A little boost for your next big moment.</p></div><Button variant="link" asChild><Link to="/games">View all games <ArrowRight /></Link></Button></div><GameGrid/><p className="catalog-note"><Info size={12}/> All top-up packages are Sample. Confirmed prices will be added later.</p></section>

    {/* === FEATURED ACCOUNTS SECTION === */}
    <section className="home-section home-accounts-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow home-acc-eyebrow"><BadgeCheck size={12}/> VERIFIED MARKETPLACE</span>
          <h2>Game Accounts for Sale</h2>
          <p>High-tier accounts with clean bindings and instant credential handover.</p>
        </div>
        <Button variant="link" asChild><Link to="/accounts">View all accounts <ArrowRight /></Link></Button>
      </div>
      <div className="home-acc-trust-row">
        <span><ShieldCheck size={13}/> Clean Email Transfer</span>
        <span><Zap size={13}/> Instant Delivery</span>
        <span><BadgeCheck size={13}/> Verified Listings</span>
      </div>
      <div className="home-account-grid">
        {featured.map(acc => (
          <article key={acc.id} className={`account-card home-acc-card ${TONE_CLASS[acc.tone] ?? ''}`}>
            <Link to="/accounts/$account" params={{ account: acc.id }} className="account-card-img-wrap" aria-label={`View ${acc.title}`}>
              <img src={acc.image} alt={`${acc.gameName} account`} width={600} height={400} loading="lazy" className="account-card-img" />
              {acc.verified && <span className="account-card-verified"><BadgeCheck size={12}/> Verified</span>}
              <span className="account-card-price">{acc.priceSample}</span>
            </Link>
            <div className="account-card-body">
              <div className="account-card-meta">
                <span className="account-game-tag">{acc.gameName}</span>
                <span className="account-level-pill">Lv {acc.level}</span>
              </div>
              <h3 className="account-card-title"><Link to="/accounts/$account" params={{ account: acc.id }}>{acc.title}</Link></h3>
              <div className="account-badges">{acc.badges.slice(0, 2).map(b => <span key={b} className="account-badge">{b}</span>)}</div>
              <Button size="sm" asChild className="account-card-cta" style={{ marginTop: '12px', width: '100%' }}>
                <Link to="/accounts/$account" params={{ account: acc.id }}>View Details <ArrowRight size={13}/></Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="acc-view-all-wrap">
        <Button asChild variant="outline" size="lg">
          <Link to="/accounts">Browse all game accounts <ArrowUpRight /></Link>
        </Button>
      </div>
    </section>

    <section className="steps-section"><div className="section-heading"><div><h2>From game to top-up. Simply.</h2><p>Three small steps. Ready for your next session.</p></div><Button variant="link" asChild className="hide-mobile"><Link to="/how-it-works">How it works <ArrowRight /></Link></Button></div><Steps/></section>
    <SupportBand/>
    <section className="faq-section"><div><span className="eyebrow">GOOD TO KNOW</span><h2>Questions?<br/>We've got you.</h2><p>A few answers to help you get started.</p><Button variant="link" asChild><Link to="/support">Explore all FAQs <ArrowRight /></Link></Button></div><FAQ compact/></section>
  </div>;
}
