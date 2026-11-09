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
              Clear guidance for eZ Cash receipt review, provider-based Free Fire top-ups, order
              status, cancellations, and refunds.
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
          <strong>Payment confirmation</strong>
          <p>
            eZ Cash payment is confirmed only after its reference or receipt is verified. Wallet
            orders currently debit the balance at creation; this is not independent provider payment
            verification.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <RotateCcw size={20} />
          </div>
          <strong>Refunds require review</strong>
          <p>
            Refund requests are reviewed by the store team; submitting a request does not guarantee
            a refund.
          </p>
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
              Orders begin pending. eZ Cash receipts require review before payment is confirmed. The
              current wallet checkout debits your balance when the order is created. Eligible paid
              Free Fire orders are submitted to Nexaura only after payment confirmation; provider
              status does not confirm in-game receipt. Other games are fulfilled by our team.
              Refunds and cancellations are handled according to the order status and support
              review. An eZ Cash receipt alone is not payment confirmation.
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
              eZ Cash deposit references are checked through the configured provider before credit
              is applied. Wallet withdrawals and deposit reversals are not available through
              checkout. Do not submit the same payment reference repeatedly if its status is
              pending.
            </p>
            <p>
              If money was sent but a deposit was not credited, contact us with the payment
              reference and your account email so the transaction can be checked.
            </p>
          </section>

          <section id="contact" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">03</span>
              <h2>Support availability</h2>
            </div>
            <p>
              Use the Support page for the available contact and FAQ options. Include your order
              reference when asking about a payment, cancellation, refund, or fulfillment status.
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
