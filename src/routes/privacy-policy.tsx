import { createFileRoute, Link } from "@tanstack/react-router";
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
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { pageHead } from "@/lib/store-data";

export const Route = createFileRoute("/privacy-policy")({
  head: () =>
    pageHead(
      "Privacy Policy",
      "Learn what account, Player ID, order, and wallet information HASA GOLD STORE stores and how it is used.",
    ),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const sections = [
    { id: "collection", num: "01", title: "Information We Collect" },
    { id: "use-of-data", num: "02", title: "How We Use Information" },
    { id: "zero-password", num: "03", title: "Game Account Safety" },
    { id: "security", num: "04", title: "Security & Encryption Standards" },
    { id: "cookies", num: "05", title: "Browser Storage & Cookies" },
    { id: "third-parties", num: "06", title: "Service Providers" },
    { id: "rights", num: "07", title: "Your Rights & Contacting Us" },
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
              This policy describes the data handled by the current website. Firebase Authentication
              manages sign-in; customer profile and order data is stored in Cloud Firestore. Game
              passwords are not requested.
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
            <Clock /> Applies to current website
          </span>
          <span className="policy-pill">
            <ShieldCheck /> Firestore-backed account data
          </span>
          <span className="policy-pill">
            <Sparkles /> Account & order data
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
          <strong>Order delivery is unavailable</strong>
          <p>The website does not currently connect to game-provider fulfillment services.</p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <Smartphone size={20} />
          </div>
          <strong>Account preferences</strong>
          <p>
            Signed-in users' short HASA member IDs, themes, favorites, saved Player IDs, and
            notification preferences are stored in Firestore. The Firebase UID remains the internal
            account key.
          </p>
        </div>
        <div className="policy-highlight-card">
          <div className="policy-highlight-icon">
            <ShieldCheck size={20} />
          </div>
          <strong>UID-scoped account data</strong>
          <p>
            Firestore customer records and orders are associated with the signed-in Firebase UID.
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
              A staffed support contact channel has not been configured. The Support page currently
              provides informational FAQs only.
            </p>
            <Button asChild size="sm" className="w-full">
              <Link to="/support">View Support FAQs</Link>
            </Button>
          </div>
        </aside>

        <main className="policy-content">
          <section id="collection" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">01</span>
              <h2>Information We Collect</h2>
            </div>
            <p>Depending on the features you use, the website stores:</p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Account data:</strong> Firebase UID, short HASA member ID, email address,
                  display name, theme, notification preferences, favorites, recent game activity,
                  and saved Player IDs.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Order data:</strong> Game, selected product, Player ID, server, catalog
                  price snapshot, selected payment method, payment/order status, payment-proof
                  filename and timestamp, and the authenticated customer's UID. Submitted proof
                  images are stored privately in Firebase Storage and linked from the order record.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Wallet deposit data:</strong> If eZ Cash deposits are configured, the
                  submitted reference number, provider deposit ID, verification status, and credited
                  amount.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Authentication data:</strong> Firebase Authentication processes sign-in
                  credentials. The website does not store passwords itself.
                </span>
              </li>
            </ul>
            <div className="policy-callout">
              <AlertCircle />
              <div>
                <strong>Service limitation:</strong> eZ Cash proof is reviewed manually and is not
                payment verification. Game top-up fulfillment is not automated, and Player IDs are
                not verified with game publishers.
              </div>
            </div>
          </section>

          <section id="use-of-data" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">02</span>
              <h2>How We Use Information</h2>
            </div>
            <p>
              Data is used to authenticate your account, save your preferences, create and display
              orders, and allow authorized administrators to review submitted eZ Cash payment proof:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Account features:</strong> Displaying your profile and restoring your
                  saved preferences and Player IDs across signed-in sessions.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Order history:</strong> Showing the order records associated with your
                  UID.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Wallet deposits:</strong> Sending a submitted eZ Cash reference to the
                  configured deposit provider for verification and recording its result.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Service operation:</strong> Processing requests and displaying errors
                  needed to operate the website.
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
              does not request game passwords. Player IDs entered for orders are stored with the
              order record and are not verified against game servers:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Never ask for passwords:</strong> We will never ask for your game
                  password, Google account, Facebook login, Apple ID, or secondary verification
                  codes.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>No provider delivery:</strong> The website currently has no game-provider
                  fulfillment integration.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Phishing Warning:</strong> If anyone claiming to represent HASA GOLD STORE
                  requests your game password, do not disclose it. A staffed support contact is not
                  currently available on this website.
                </span>
              </li>
            </ul>
            <div className="policy-callout">
              <ShieldCheck />
              <div>
                <strong>Golden Safety Rule:</strong> Never share your game password with anyone. A
                Player ID is not proof of ownership and is not verified by this website.
              </div>
            </div>
          </section>

          <section id="security" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">04</span>
              <h2>Security & Encryption Standards</h2>
            </div>
            <p>
              Firebase Authentication and Firestore Security Rules provide the configured identity
              and data-access controls. No client-side admin management or payment-card handling is
              enabled.
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Transport security:</strong> Use the HTTPS website endpoint for traffic in
                  transit. The deployment's host and Firebase apply their own security controls.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Firestore rules:</strong> Customer documents are UID-scoped; clients
                  cannot write orders, wallet credits, catalog data, or administrative records.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Payment data:</strong> Card and bank checkout is not available. Do not
                  enter payment credentials on this website.
                </span>
              </li>
            </ul>
          </section>

          <section id="cookies" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">05</span>
              <h2>Browser Storage & Cookies</h2>
            </div>
            <p>
              The application does not use localStorage or sessionStorage for customer business
              data. Firebase Authentication manages its own session persistence. Signed-in account
              preferences are stored in Firestore.
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
                    <td>
                      <strong>Firebase Authentication session</strong>
                    </td>
                    <td>Maintains sign-in state according to the Remember me choice.</td>
                    <td>Managed by Firebase Authentication</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Account profile and preferences</strong>
                    </td>
                    <td>
                      Stores saved Player IDs, favorites, theme, notifications, and recent games.
                    </td>
                    <td>Firestore, associated with your Firebase UID</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Orders and wallet deposits</strong>
                    </td>
                    <td>
                      Stores orders and payment-proof images associated with your UID for authorized
                      administrators to review.
                    </td>
                    <td>Firestore and private Firebase Storage</td>
                  </tr>
                  <tr>
                    <td>
                      <strong>Temporary interface state</strong>
                    </td>
                    <td>Controls open dialogs, form edits, and other non-persistent page state.</td>
                    <td>Current page session</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              Clearing browser site data may sign you out. Firestore account records are not deleted
              when browser data is cleared.
            </p>
          </section>

          <section id="third-parties" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">06</span>
              <h2>Game Publishers & Third Parties</h2>
            </div>
            <p>
              The website uses Firebase Authentication, Cloud Firestore, and private Firebase
              Storage for accounts, orders, and payment-proof images. The optional Free Fire name
              lookup sends the entered Player ID to Nexaura; no Player ID is sent to game publishers
              for top-up fulfillment:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>Game-provider integrations: not configured.</span>
              </li>
              <li>
                <CheckCircle2 />
                <span>Card and bank payment processors: not configured.</span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  Firebase Authentication and Firestore: account identity and UID-owned application
                  data.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  Nexaura: eZ Cash deposit verification or optional Free Fire player-name lookup,
                  when the relevant server integration is configured.
                </span>
              </li>
            </ul>
            <p>
              Firebase and Nexaura process data according to their own terms and privacy policies.
              Firebase may also process technical data needed to provide its services. No game
              account credentials are collected.
            </p>
          </section>

          <section id="rights" className="policy-section">
            <div className="policy-section-header">
              <span className="policy-section-badge">07</span>
              <h2>Your Rights & Contacting Us</h2>
            </div>
            <p>
              Depending on applicable law, you may have rights regarding your personal information,
              including:
            </p>
            <ul className="policy-list">
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Access & Correction:</strong> The dashboard shows your saved profile
                  preferences, Player IDs, and order history. The website has no data-export tool.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Deletion & Erasure:</strong> Account deletion is not self-service on this
                  website. Order and financial records may be retained where required.
                </span>
              </li>
              <li>
                <CheckCircle2 />
                <span>
                  <strong>Inquiries:</strong> The Support page currently contains FAQs only; a
                  staffed privacy contact channel has not been configured.
                </span>
              </li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
