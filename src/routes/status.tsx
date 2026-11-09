import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Database,
  Gamepad2,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Wallet,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";
import { fetchStoreSettings, useGames } from "@/lib/firestore";

export const Route = createFileRoute("/status")({
  head: () =>
    pageHead(
      "Service Status",
      "Live API availability and current payment, catalog, and fulfillment disclosures for HASA GOLD STORE.",
    ),
  component: StatusPage,
});

async function checkApiHealth(): Promise<{
  online: boolean;
  service: string;
  latencyMs: number;
}> {
  const start = performance.now();
  try {
    const res = await fetch("https://api.hasagold.store/health", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      online: data.status === "ok",
      service: data.service || "hasa-gold-api",
      latencyMs,
    };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return {
      online: false,
      service: "hasa-gold-api",
      latencyMs,
    };
  }
}

function StatusPage() {
  const {
    data: apiHealth,
    isLoading: healthLoading,
    refetch: refetchHealth,
    dataUpdatedAt: healthUpdatedAt,
  } = useQuery({
    queryKey: ["serviceHealth"],
    queryFn: checkApiHealth,
    refetchInterval: 30_000,
  });

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 0,
  });

  const { data: games = [], refetch: refetchGames } = useGames();

  const isMaintenance = Boolean(settings?.maintenanceMode);
  const isApiOnline = Boolean(apiHealth?.online);
  const activeGamesCount = games.filter((g) => g.active).length;
  const ezCashConfigured = Boolean(
    settings?.paymentEzcashNumber?.trim() && settings?.paymentEzcashName?.trim(),
  );

  const overallOperational = isApiOnline && !isMaintenance;

  const handleRefreshAll = () => {
    void refetchHealth();
    void refetchSettings();
    void refetchGames();
  };

  const systems = [
    {
      id: "api",
      name: "Core Cloud API & Database",
      category: "Infrastructure",
      status: isApiOnline ? "Operational" : "Degraded",
      badgeClass: isApiOnline ? "is-operational" : "is-degraded",
      details: isApiOnline
        ? `Node.js cluster online · Latency: ${apiHealth?.latencyMs ?? 0}ms · Express v1`
        : "Unreachable or connection timeout. Standby servers retrying.",
      icon: Database,
    },
    {
      id: "catalog",
      name: "Live Game Top-up Catalog",
      category: "Storefront",
      status: isMaintenance ? "Maintenance" : activeGamesCount > 0 ? "Operational" : "Paused",
      badgeClass: isMaintenance
        ? "is-maintenance"
        : activeGamesCount > 0
          ? "is-operational"
          : "is-degraded",
      details: isMaintenance
        ? "Storefront is under routine maintenance. Checkouts temporarily held."
        : `${activeGamesCount} games active with live catalog pricing. Fulfillment status depends on the game and provider.`,
      icon: Gamepad2,
    },
    {
      id: "wallet",
      name: "HASA Gold Wallet System",
      category: "Wallet",
      status: isApiOnline ? "Operational" : "Degraded",
      badgeClass: isApiOnline ? "is-operational" : "is-degraded",
      details:
        "Live wallet balance and transaction history. Wallet debits are recorded when orders are created.",
      icon: Wallet,
    },
    {
      id: "ezcash",
      name: "eZ Cash Receipt Review",
      category: "Payment Processing",
      status: ezCashConfigured ? "Manual review" : "Pending Setup",
      badgeClass: "is-degraded",
      details: ezCashConfigured
        ? `eZ Cash details are available at checkout (${settings?.paymentEzcashNumber}); submitted receipts await administrator review.`
        : "Store payment details are not currently configured.",
      icon: Smartphone,
    },
    {
      id: "player-lookup",
      name: "Live Player ID Verification",
      category: "Integration",
      status: isApiOnline ? "Provider-dependent" : "Degraded",
      badgeClass: "is-degraded",
      details:
        "Player ID lookup is available for supported Free Fire and Blood Strike accounts when the provider responds.",
      icon: Search,
    },
    {
      id: "account-escrow",
      name: "Game Account Listings & Escrow",
      category: "Marketplace",
      status: "Unavailable",
      badgeClass: "is-degraded",
      details: "Account purchase and escrow checkout are not currently available.",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <span>Service Status</span>
      </nav>

      {/* Main Status Hero */}
      <header className={`status-hero ${overallOperational ? "is-all-good" : "is-has-issues"}`}>
        <div className="status-hero-inner">
          <div className="status-pulse-badge">
            <span className="status-hero-dot" />
            <span>
              {isMaintenance
                ? "SCHEDULED MAINTENANCE"
                : overallOperational
                  ? "API AND STOREFRONT AVAILABLE"
                  : "SYSTEM INCIDENT DETECTED"}
            </span>
          </div>

          <h1 className="status-hero-title">
            {isMaintenance
              ? "System Upgrade in Progress"
              : overallOperational
                ? "Store API Available"
                : "Experiencing Connection Delays"}
          </h1>

          <p className="status-hero-desc">
            {isMaintenance
              ? "The storefront is currently paused for routine optimization and upgrades. Customer balances and existing orders are safe."
              : overallOperational
                ? "The store API is responding. Payment verification, player lookup and fulfillment depend on their configured providers; check each service below for details."
                : "Our cloud operations monitor has detected a slowdown or connectivity issue. Our engineers are actively monitoring recovery."}
          </p>

          <div className="status-meta-bar">
            <div className="status-meta-item">
              <Zap size={14} />
              <span>
                API Latency: <strong>{apiHealth?.latencyMs ?? 0} ms</strong>
              </span>
            </div>
            <div className="status-meta-item">
              <Activity size={14} />
              <span>
                Checked:{" "}
                <strong>
                  {healthUpdatedAt ? new Date(healthUpdatedAt).toLocaleTimeString() : "Just now"}
                </strong>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="status-refresh-btn"
            >
              <RefreshCw size={13} className={healthLoading ? "animate-spin" : ""} />
              Refresh Status
            </Button>
          </div>
        </div>
      </header>

      {/* Grid of System Components */}
      <section className="status-grid-section" aria-label="Individual component statuses">
        <div className="status-grid-header">
          <h2>Core Services &amp; Gateways</h2>
          <span className="status-grid-count">6 monitored services</span>
        </div>

        <div className="status-components-grid">
          {systems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.id} className="status-card">
                <div className="status-card-top">
                  <div className="status-card-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <span className={`status-badge ${item.badgeClass}`}>
                    <span className="status-badge-dot" />
                    {item.status}
                  </span>
                </div>

                <div className="status-card-body">
                  <span className="status-card-category">{item.category}</span>
                  <h3 className="status-card-name">{item.name}</h3>
                  <p className="status-card-details">{item.details}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Uptime and Security Guarantee banner */}
      <section className="status-guarantee-panel">
        <div className="status-guarantee-icon">
          <CheckCircle2 size={24} />
        </div>
        <div className="status-guarantee-copy">
          <strong>API Health Check</strong>
          <p>
            The API health endpoint is checked every 30 seconds. This check does not independently
            verify payment providers, game-player lookups, order fulfillment, or account transfers.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/">
            Return to Store <ArrowRight size={13} />
          </Link>
        </Button>
      </section>
    </div>
  );
}
