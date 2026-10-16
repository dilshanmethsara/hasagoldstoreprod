import { createFileRoute, Link } from '@tanstack/react-router';
import {
  RotateCcw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  FileText,
  BadgeAlert,
  Coins,
  CreditCard,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/refund-policy')({
  head: () =>
    pageHead(
      'Refund Policy',
      'Read HASA GOLD STORE’s fair refund policy for game top-ups, delivery guarantees, dispute resolution, and payment reversals.'
    ),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
  const sections = [
    { id: 'overview', num: '01', title: 'Nature of Digital Top-Ups' },
    { id: 'eligible', num: '02', title: 'Eligible Refund Situations' },
    { id: 'ineligible', num: '03', title: 'Non-Refundable Circumstances' },
    { id: 'matrix', num: '04', title: 'Refund Eligibility Matrix' },
    { id: 'process', num: '05', title: 'How to Submit a Refund Claim' },
    { id: 'processing-time', num: '06', title: 'Refund Timeframes & Payouts' },
    { id: 'disputes', num: '07', title: 'Disputes & Chargeback Policy' },
  ];

  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <span>Refund Policy</span>
      </nav>

      <header className="policy-hero">
        <div className="policy-hero-top">
          <div>
            <span className="eyebrow">
              <RotateCcw size={12} /> BUYER PROTECTION & RECHARGE ASSURANCE
            </span>
            <h1>Refund & Cancellation Policy</h1>
            <p>
              We stand behind every game top-up. Because digital game currencies are credited
              instantly to live server accounts, our policy provides fair, transparent protections for
              failed fulfillments, duplicate billings, and technical discrepancies.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/support">
              Need Help? <ArrowRight size={14} />
            </Link>
          </Button>
        </div>

        <div className="policy-meta-pills">
          <span className="policy-pill">
            <Clock /> Effective: October 2026
          </span>
          <span className="policy-pill">
            <ShieldCheck /> 100% Delivery Guarantee
          </span>
          <span className="policy-pill">
            <Coins /> Covers: Diamonds, UC, Gold, CP
          </span>
        </div>
      </header>

      <section className="policy-highlights" aria-label="Refund highlights">
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>Delivery Guarantee</strong>
          <p>
            If your purchased currency fails to reach your game account due to server error, you are
            entitled to an immediate re-delivery or full refund.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <Clock size={20} />
          </div>
          <strong>24-48h Claim Review</strong>
          <p>
            Dispute and refund tickets are thoroughly investigated with game publisher API logs within
            24 to 48 business hours.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <CreditCard size={20} />
          </div>
          <strong>Original Payment Source</strong>
          <p>
            Approved refunds are credited directly back to the original funding account without
            hidden deduction fees.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <RotateCcw size={20} />
          </div>
          <strong>Duplicate Billing Protection</strong>
          <p>
            Accidental double charges caused by network drops or gateway delays are automatically
            refunded upon verification.
          </p>
        </div>
      </section>

      <div className="policy-layout">
        <aside className="policy-sidebar">
          <div className="policy-toc">
            <div className="policy-toc-title">
              <FileText size={14} /> Table of Contents
            </div>
            <nav className="policy-toc-links" aria-label="Refund sections">
              {sections.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  <span>{item.num}.</span> {item.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="policy-sidebar-card">
            <strong>Experiencing a delivery delay?</strong>
            <p>
              Before requesting a refund, check if the game server is undergoing maintenance or
              contact our support team for an instant status check.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to="/support">Contact Customer Support</Link>
            </Button>
          </div>
        </aside>

        <main className="policy-content">
          <section id="overview" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">01</span>
              <h2>Nature of Digital Top-Ups</h2>
            </div>
            <p>
              In-game currencies—such as <strong>Free Fire Diamonds</strong>, <strong>PUBG Mobile UC</strong>,{' '}
              <strong>Blood Strike Gold</strong>, and <strong>Call of Duty: Mobile CP</strong>—are digital goods
              delivered electronically and immediately tied to publisher account databases.
            </p>
            <p>
              Once in-game currencies have been successfully dispatched by our system and credited to
              the destination Player ID, they cannot be retracted, deactivated, or transferred back by
              our store. Therefore, standard physical goods return rules do not apply to delivered
              virtual items.
            </p>
            <div className="policy-callout">
              <AlertTriangle />
              <div>
                <strong>Storefront Preview Notice:</strong> This platform is currently operating in an
                interactive demo mode. All package tiers are Sample offerings, and no real currency or
                payments are processed.
              </div>
            </div>
          </section>

          <section id="eligible" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">02</span>
              <h2>Eligible Refund Situations</h2>
            </div>
            <p>
              You qualify for an automatic re-delivery or full monetary refund under any of the
              following technical conditions:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Non-Delivery / Gateway Outage:</strong> Payment was debited from your account,
                  but top-up currency was never credited to the provided Player ID due to a publisher
                  API timeout or gateway malfunction.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Duplicate Deductions:</strong> Network latency or double-clicking caused more
                  than one charge for a single top-up request.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Package Mismatch:</strong> In the rare event an incorrect package denomination
                  was credited due to a system lookup error, we will credit the missing balance or
                  provide appropriate compensation.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Prolonged Unavailability:</strong> If publisher maintenance prevents fulfillment
                  for longer than 24 hours, you may opt for a full refund cancellation upon request.
                </span>
              </li>
            </ul>
          </section>

          <section id="ineligible" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">03</span>
              <h2>Non-Refundable Circumstances</h2>
            </div>
            <p>
              Refunds cannot be granted under the following user-side situations:
            </p>
            <ul className="policy-list">
              <li>
                <XCircle style={{ color: 'var(--destructive)' }} />
                <span>
                  <strong>Successful & Verified Delivery:</strong> If game publisher verification logs
                  confirm that the requested Diamonds, UC, Gold, or CP were credited to the submitted Player ID.
                </span>
              </li>
              <li>
                <XCircle style={{ color: 'var(--destructive)' }} />
                <span>
                  <strong>Incorrect Player ID Entered:</strong> If an incorrect Player ID, Character ID,
                  or Zone ID was submitted during checkout and the order was already completed to that
                  account, we cannot reverse or recover the currency.
                </span>
              </li>
              <li>
                <XCircle style={{ color: 'var(--destructive)' }} />
                <span>
                  <strong>Buyer Remorse / Changed Mind:</strong> Once a purchase is fulfilled and the
                  currency appears in your game wallet, orders cannot be cancelled simply because you no
                  longer want the package.
                </span>
              </li>
              <li>
                <XCircle style={{ color: 'var(--destructive)' }} />
                <span>
                  <strong>Game Publisher Account Bans:</strong> If your game account is penalized, suspended,
                  or banned by the game publisher for cheating, third-party software, or toxicity, HASA GOLD
                  STORE is not liable for existing virtual balances.
                </span>
              </li>
            </ul>
            <div className="policy-callout">
              <BadgeAlert />
              <div>
                <strong>Player ID Tip:</strong> Always double-check your in-game UID in your player
                profile before finalizing a top-up selection.
              </div>
            </div>
          </section>

          <section id="matrix" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">04</span>
              <h2>Refund Eligibility Matrix</h2>
            </div>
            <p>Quick reference guide for common customer scenarios:</p>
            <div className="policy-table-wrapper">
              <table className="policy-table">
                <thead>
                  <tr>
                    <th>Customer Scenario</th>
                    <th>Refund Eligibility</th>
                    <th>Expected Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Failed Top-up (Server error)</strong></td>
                    <td><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Eligible (100%)</span></td>
                    <td>Immediate re-delivery or full refund</td>
                  </tr>
                  <tr>
                    <td><strong>Duplicate Billing</strong></td>
                    <td><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Eligible (100%)</span></td>
                    <td>Excess amount refunded within 3-5 days</td>
                  </tr>
                  <tr>
                    <td><strong>Wrong UID (Order completed)</strong></td>
                    <td><span style={{ color: 'var(--destructive)', fontWeight: 'bold' }}>Not Eligible</span></td>
                    <td>Assistance contacting publisher support</td>
                  </tr>
                  <tr>
                    <td><strong>Wrong UID (Reported before fulfillment)</strong></td>
                    <td><span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Eligible</span></td>
                    <td>Order paused and corrected to valid UID</td>
                  </tr>
                  <tr>
                    <td><strong>Game currency already credited</strong></td>
                    <td><span style={{ color: 'var(--destructive)', fontWeight: 'bold' }}>Not Eligible</span></td>
                    <td>Fulfillment confirmed; final sale</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="process" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">05</span>
              <h2>How to Submit a Refund Claim</h2>
            </div>
            <p>
              If your order encounters an issue, submitting a claim is straightforward:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Step 1: Gather your transaction details:</strong> Keep your Order Reference
                  Number, game title, submitted Player ID, and payment receipt handy.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Step 2: Submit a support ticket:</strong> Navigate to our{' '}
                  <Link to="/support">Support page</Link> and submit your inquiry with an explanation of
                  the delivery discrepancy.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Step 3: Verification with game logs:</strong> Our support engineers cross-reference
                  the transaction timestamp with publisher API delivery receipts.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Step 4: Resolution:</strong> If verified as unfulfilled, you can choose between
                  priority instant re-delivery or full monetary reversal.
                </span>
              </li>
            </ul>
          </section>

          <section id="processing-time" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">06</span>
              <h2>Refund Timeframes & Payouts</h2>
            </div>
            <p>
              Once a refund has been approved by our dispute team, processing speeds vary based on the
              original payment provider:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Credit & Debit Cards (Visa / Mastercard):</strong> 3 to 7 business days,
                  depending on your issuing bank.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>E-Wallets & Mobile Money:</strong> Usually completed within 24 hours of approval.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Bank Transfers:</strong> 2 to 5 business days for bank settlement.
                </span>
              </li>
            </ul>
            <p>
              All refunds are made in the original currency of payment and without cancellation penalty
              fees.
            </p>
          </section>

          <section id="disputes" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">07</span>
              <h2>Disputes & Chargeback Policy</h2>
            </div>
            <p>
              We urge all customers to contact us directly via our <Link to="/support">Support Center</Link>{' '}
              before initiating a payment chargeback with their bank.
            </p>
            <p>
              Filing an unauthorized chargeback on a legitimate, delivered top-up order is considered a
              breach of store terms and may result in the associated game Player ID being blacklisted
              from future top-up services across our platform and partnered publisher networks.
            </p>
            <div className="policy-callout">
              <HelpCircle />
              <div>
                <strong>Need more information?</strong> You can also review our{' '}
                <Link to="/privacy-policy">Privacy Policy</Link> or browse our{' '}
                <Link to="/how-it-works">How It Works guide</Link>.
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
