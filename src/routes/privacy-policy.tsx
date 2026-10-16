import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Shield,
  ShieldCheck,
  Lock,
  EyeOff,
  Server,
  Cookie,
  HelpCircle,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Smartphone,
  ExternalLink,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pageHead } from '@/lib/store-data';

export const Route = createFileRoute('/privacy-policy')({
  head: () =>
    pageHead(
      'Privacy Policy',
      'Learn how HASA GOLD STORE protects your gaming profile, Player IDs, and data with zero password storage and encrypted connections.'
    ),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const sections = [
    { id: 'collection', num: '01', title: 'Information We Collect' },
    { id: 'use-of-data', num: '02', title: 'How We Use Information' },
    { id: 'zero-password', num: '03', title: 'Zero Password Storage & Player Safety' },
    { id: 'security', num: '04', title: 'Security & Encryption Standards' },
    { id: 'cookies', num: '05', title: 'Local Storage & Browser Cookies' },
    { id: 'third-parties', num: '06', title: 'Game Publishers & Third Parties' },
    { id: 'rights', num: '07', title: 'Your Rights & Contacting Us' },
  ];

  return (
    <div className="container page-content">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <span>Privacy Policy</span>
      </nav>

      <header className="policy-hero">
        <div className="policy-hero-top">
          <div>
            <span className="eyebrow">
              <Shield size={12} /> LEGAL & PLAYER SECURITY
            </span>
            <h1>Privacy Policy</h1>
            <p>
              At HASA GOLD STORE, we believe in transparent, privacy-first gaming services. We
              prioritize player safety with minimal data collection, zero password requests, and
              industry-standard encryption.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/support">
              Need assistance? <ArrowRight size={14} />
            </Link>
          </Button>
        </div>

        <div className="policy-meta-pills">
          <span className="policy-pill">
            <Clock /> Effective: October 2026
          </span>
          <span className="policy-pill">
            <ShieldCheck /> Version 1.2
          </span>
          <span className="policy-pill">
            <Sparkles /> Scope: All Supported Games
          </span>
        </div>
      </header>

      <section className="policy-highlights" aria-label="Privacy commitments">
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <EyeOff size={20} />
          </div>
          <strong>Zero Password Storage</strong>
          <p>
            We never request, store, or verify your game master account password or social login
            credentials.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <Lock size={20} />
          </div>
          <strong>Encrypted Delivery</strong>
          <p>
            All network requests and top-up communications use end-to-end TLS encryption to protect
            in-transit data.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <Smartphone size={20} />
          </div>
          <strong>On-Device Preferences</strong>
          <p>
            Favorites, active theme modes, and demo profiles remain strictly on your local browser
            cache.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>No Data Brokerage</strong>
          <p>
            We never sell, rent, or trade your player identifiers or personal information to third-party
            marketers.
          </p>
        </div>
      </section>

      <div className="policy-layout">
        <aside className="policy-sidebar">
          <div className="policy-toc">
            <div className="policy-toc-title">
              <FileText size={14} /> Table of Contents
            </div>
            <nav className="policy-toc-links" aria-label="Privacy sections">
              {sections.map((item) => (
                <a key={item.id} href={`#${item.id}`}>
                  <span>{item.num}.</span> {item.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="policy-sidebar-card">
            <strong>Have privacy questions?</strong>
            <p>
              If you have any questions regarding your player details or data usage, our team is ready
              to help.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to="/support">Contact Support</Link>
            </Button>
          </div>
        </aside>

        <main className="policy-content">
          <section id="collection" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">01</span>
              <h2>Information We Collect</h2>
            </div>
            <p>
              We collect only the essential details necessary to identify public game accounts for
              currency top-up fulfillment and maintain smooth platform operation:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Public Player Identifiers:</strong> Your in-game User ID (UID), Character ID,
                  or Zone ID (for example, Free Fire UID or PUBG Mobile ID) required by game publishers
                  to route top-ups.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Transaction Metadata:</strong> Order timestamps, game title, currency amount
                  requested, and reference status for fulfillment confirmation.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Device & Network Telemetry:</strong> Standard browser user-agent, IP address,
                  and error logs used exclusively for fraud mitigation, bot prevention, and system stability.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Support Inquiries:</strong> Any communication messages, error reports, or
                  receipt screenshots you voluntarily provide when asking for support assistance.
                </span>
              </li>
            </ul>
            <div className="policy-callout">
              <AlertCircle />
              <div>
                <strong>Important distinction:</strong> In this storefront demo preview, all top-up
                options are sample packages and no real monetary transactions or external payments are
                collected.
              </div>
            </div>
          </section>

          <section id="use-of-data" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">02</span>
              <h2>How We Use Information</h2>
            </div>
            <p>
              Any data collected is strictly utilized to fulfill top-up orders and guarantee customer
              satisfaction:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Fulfillment & Direct Top-Ups:</strong> Relaying player IDs to authorized
                  publisher gateways to credit in-game Diamonds, UC, Gold, or CP.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Customer Service & Dispute Resolution:</strong> Reviewing transaction logs
                  to investigate delayed deliveries, top-up verifications, or refund queries.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Platform Integrity & Anti-Fraud:</strong> Protecting against malicious
                  automated bots, unauthorized duplicate submissions, and payment disputes.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Experience Enhancements:</strong> Analyzing website performance and page speed
                  to ensure smooth navigation across all desktop and mobile devices.
                </span>
              </li>
            </ul>
          </section>

          <section id="zero-password" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">03</span>
              <h2>Zero Password Storage & Player Safety</h2>
            </div>
            <p>
              Your game account credentials are <strong>strictly your own</strong>. HASA GOLD STORE
              operates on a direct-to-ID model:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Never ask for passwords:</strong> We will never ask for your game password,
                  Google account, Facebook login, Apple ID, or secondary verification codes.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>No Account Takeovers:</strong> Delivery occurs through official publisher
                  recharge APIs that require only public numerical UIDs.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Phishing Warning:</strong> If anyone claiming to represent HASA GOLD STORE
                  requests your game password, please do not disclose it and immediately notify our
                  support staff.
                </span>
              </li>
            </ul>
            <div className="policy-callout">
              <ShieldCheck />
              <div>
                <strong>Golden Safety Rule:</strong> Never share your game password with anyone.
                Authorized gaming top-up delivery requires only your public Player ID.
              </div>
            </div>
          </section>

          <section id="security" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">04</span>
              <h2>Security & Encryption Standards</h2>
            </div>
            <p>
              We enforce multi-tiered defense mechanisms to safeguard all communications and player
              data:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>HTTPS / Transport Layer Security (TLS):</strong> Modern encryption protocols
                  protect all data traveling between your device and our servers.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Restricted Database Access:</strong> Internal administrative tools employ
                  strict role-based access control (RBAC) and audited session tracking.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Isolated Payment Processing:</strong> When live billing is enabled, sensitive
                  card and bank details are processed directly by certified PCI-DSS Level 1 payment
                  gateways and are never stored on our web servers.
                </span>
              </li>
            </ul>
          </section>

          <section id="cookies" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">05</span>
              <h2>Local Storage & Browser Cookies</h2>
            </div>
            <p>
              We use minimal, browser-safe web storage techniques to give you a responsive browsing
              experience:
            </p>
            <div className="policy-table-wrapper">
              <table className="policy-table">
                <thead>
                  <tr>
                    <th>Storage Type</th>
                    <th>Purpose</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Theme Preference</strong></td>
                    <td>Maintains your chosen Dark or Light color mode preference.</td>
                    <td>Persistent (Local Storage)</td>
                  </tr>
                  <tr>
                    <td><strong>Saved Favorites</strong></td>
                    <td>Holds your starred games list during browsing sessions.</td>
                    <td>Session-based</td>
                  </tr>
                  <tr>
                    <td><strong>Demo Profile Cache</strong></td>
                    <td>Stores local demo name and simulated account settings on your current device.</td>
                    <td>Local device only</td>
                  </tr>
                  <tr>
                    <td><strong>Session Security</strong></td>
                    <td>Protects against Cross-Site Request Forgery (CSRF) vulnerabilities.</td>
                    <td>Session duration</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              You can clear your browser storage or cookies at any time through your web browser
              settings without affecting your ability to browse the game catalog.
            </p>
          </section>

          <section id="third-parties" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">06</span>
              <h2>Game Publishers & Third Parties</h2>
            </div>
            <p>
              To complete digital top-up fulfillment, public player IDs are communicated with game
              publishers and official distribution networks:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Garena:</strong> Delivery of Free Fire Diamonds.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>NetEase Games:</strong> Delivery of Blood Strike Gold vouchers.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Tencent / Level Infinite:</strong> Delivery of PUBG Mobile Unknown Cash (UC).
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Activision:</strong> Delivery of Call of Duty: Mobile CP top-ups.
                </span>
              </li>
            </ul>
            <p>
              All game trademarks, logos, and character artworks belong to their respective owners.
              Third parties are authorized only to use transmitted IDs for product fulfillment.
            </p>
          </section>

          <section id="rights" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">07</span>
              <h2>Your Rights & Contacting Us</h2>
            </div>
            <p>
              You maintain rights over your personal data under applicable data privacy laws,
              including:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Access & Correction:</strong> Request details on transactions or player IDs
                  associated with your records.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Deletion & Erasure:</strong> Request the purging of support tickets, order
                  logs, or contact records from active systems.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Inquiries:</strong> If you have any inquiries or concerns regarding this policy,
                  visit our <Link to="/support">Support Center</Link> or view our <Link to="/refund-policy">Refund Policy</Link>.
                </span>
              </li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
