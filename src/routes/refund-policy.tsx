import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/refund-policy")({
  head: () =>
    pageHead(
      "Refund Policy",
      "Current payment, wallet deposit, and order refund availability for HASA GOLD STORE.",
    ),
  component: RefundPolicyPage,
});

function RefundPolicyPage() {
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
              <RotateCcw size={12} /> PAYMENT & ORDER STATUS
            </span>
            <h1>Refund & Cancellation Policy</h1>
            <p>
              eZ Cash payments use manual proof review. This page explains what order statuses mean;
              the website does not automatically process transfers or refunds.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/support">
              View support information <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
        <div className="policy-meta-pills">
          <span className="policy-pill">
            <Clock /> Manual payment review
          </span>
          <span className="policy-pill">
            <CreditCard /> eZ Cash proof upload available
          </span>
          <span className="policy-pill">
            <RotateCcw /> No automated refund workflow
          </span>
        </div>
      </header>

      <section className="policy-highlights" aria-label="Current service availability">
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <AlertTriangle size={20} />
          </div>
          <strong>Payment review</strong>
          <p>
            An eZ Cash order remains unconfirmed until an administrator checks its submitted proof
            and updates the order.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <CreditCard size={20} />
          </div>
          <strong>No automatic payment</strong>
          <p>
            eZ Cash transfers are manual. Card, bank, and other wallet methods are not connected.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <RotateCcw size={20} />
          </div>
          <strong>No refund processing</strong>
          <p>The website cannot currently issue or reverse a payment.</p>
        </div>
      </section>

      <div className="policy-layout">
        <aside className="policy-sidebar">
          <div className="policy-sidebar-card">
            <strong>Before sending money</strong>
            <p>
              Use only the eZ Cash destination shown at checkout. Keep your receipt; proof upload
              does not itself confirm payment or guarantee fulfillment.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to="/games">Browse the catalog</Link>
            </Button>
          </div>
        </aside>

        <main className="policy-content">
          <section id="orders" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">01</span>
              <h2>Top-up orders</h2>
            </div>
            <p>
              Orders are created pending. For eZ Cash, customers may submit a receipt image; an
              administrator must verify the transfer and update the payment status. The website
              cannot automatically issue a refund or deliver an in-game top-up.
            </p>
            <div className="policy-callout">
              <AlertTriangle />
              <div>
                <strong>Check the order status.</strong> A submitted receipt is not payment
                confirmation or a delivery promise. Contact support about payment or refund issues.
              </div>
            </div>
          </section>

          <section id="wallet" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">02</span>
              <h2>Wallet deposits</h2>
            </div>
            <p>
              eZ Cash deposits can be credited only when the server-side Nexaura integration is
              configured and verifies the reference. The website does not currently offer wallet
              withdrawals, checkout spending, or deposit reversals. Do not submit the same payment
              reference repeatedly if its status is pending.
            </p>
            <p>
              If money was sent but a deposit was not credited, contact the payment provider using
              the details on your payment confirmation. A staffed store support channel is not
              currently configured.
            </p>
          </section>

          <section id="contact" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">03</span>
              <h2>Support availability</h2>
            </div>
            <p>
              The Support page currently provides FAQs only. No ticket submission, refund review,
              manual fulfillment, or payment dispute workflow is connected.
            </p>
            <Button asChild variant="outline">
              <Link to="/support">
                <FileText size={14} /> View FAQs
              </Link>
            </Button>
          </section>
        </main>
      </div>
    </div>
  );
}
