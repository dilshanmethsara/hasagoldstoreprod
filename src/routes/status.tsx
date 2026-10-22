import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  Gamepad2,
  Search,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/status")({
  head: () =>
    pageHead(
      "Service Status",
      "Current service availability and integration status for HASA GOLD STORE.",
    ),
  component: StatusPage,
});

const services = [
  {
    name: "Website monitoring",
    description: "No live uptime or incident-monitoring feed is configured for this page.",
    Icon: Clock,
  },
  {
    name: "Firebase account and catalog data",
    description:
      "Firebase Authentication and Firestore are configured; this page does not report their live health.",
    Icon: Database,
  },
  {
    name: "Free Fire Player ID verification",
    description:
      "Live, request-based lookup is enabled. The server fetches the player record from Nexaura and returns the in-game name when available. Provider outages may temporarily prevent verification.",
    Icon: Search,
  },
  {
    name: "Top-up checkout payments",
    description:
      "eZ Cash supports manual transfers with proof upload and administrator review. Other checkout methods are not connected.",
    Icon: CreditCard,
  },
  {
    name: "Game-provider fulfillment",
    description:
      "Not automated. Orders require manual administrator review and any top-up fulfillment is handled manually.",
    Icon: Gamepad2,
  },
  {
    name: "eZ Cash wallet deposits",
    description: "Requires the Nexaura server credential and a successful provider verification.",
    Icon: Wallet,
  },
];

function StatusPage() {
  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <span>Service Status</span>
      </nav>

      <header className="policy-hero">
        <div className="policy-hero-top">
          <div>
            <span className="eyebrow">
              <AlertTriangle size={12} /> SERVICE AVAILABILITY
            </span>
            <h1>Live status is unavailable</h1>
            <p>
              This website has no live monitoring or incident-reporting integration. We cannot
              provide uptime percentages or claim that external services are currently operational.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Return to the store</Link>
          </Button>
        </div>
        <div className="policy-meta-pills">
          <span className="policy-pill">
            <Clock /> No live monitoring feed
          </span>
          <span className="policy-pill">
            <CreditCard /> eZ Cash review is manual
          </span>
          <span className="policy-pill">
            <Search /> Free Fire lookup enabled
          </span>
        </div>
      </header>

      <section className="policy-highlights" aria-label="Known service availability">
        {services.map(({ name, description, Icon }) => (
          <article key={name} className="policy-highlight-card">
            <div className="policy-highlight-icon">
              <Icon size={20} />
            </div>
            <strong>{name}</strong>
            <p>{description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
