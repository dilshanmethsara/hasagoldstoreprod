import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  CreditCard,
  History,
  Info,
  Loader2,
  Lock,
  PlusCircle,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "./account-context";
import { useWallet } from "./wallet-context";
import { EzCashDepositDialog, type EzCashDepositStage } from "./ezcash-deposit-dialog";
import { fetchStoreSettings } from "@/lib/firestore";

type EzGuideLang = "en" | "si";

const EZ_GUIDE_COPY: Record<
  EzGuideLang,
  {
    title: string;
    amountLead: string;
    amountBody: string;
    steps: ReactNode[];
    avoidTitle: string;
    avoid: string[];
    warning: string;
  }
> = {
  en: {
    title: "Before you pay with eZ Cash",
    amountLead: "Any amount works.",
    amountBody: "Whatever you send is added to your wallet once the RN is verified.",
    steps: [
      "Get the RN number from the eZ Cash confirmation SMS, or the Dialog Genie app → eZ Cash history.",
      <>Every RN has exactly 14 digits. Do not use example or test numbers.</>,
      "At a communication centre? Ask first: “Will I get a 14-digit RN number?” If not, don’t send. You may lose your money.",
    ],
    avoidTitle: "Don’t send eZ Cash using",
    avoid: ["Bank apps", "Cargills / Food City", "Keells", "Pay & Go machines"],
    warning: "The RN is required to claim your payment. Without it we can’t verify or credit it.",
  },
  si: {
    title: "eZ Cash ගෙවීමට පෙර",
    amountLead: "ඕනෑම මුදලක් සාදරයෙන් පිළිගනිමු.",
    amountBody: "ඔබ යවන මුදල RN තහවුරු වූ පසු ඔබේ පසුම්ගෙට එකතු වේ.",
    steps: [
      "RN අංකය eZ Cash තහවුරු කිරීමේ SMS පණිවිඩයෙන්, නැතහොත් Dialog Genie යෙදුමේ → eZ Cash ඉතිහාසයෙන් ලබා ගන්න.",
      <>සෑම RN එකකම නිශ්චිතව අංක 14ක් ඇත. උදාහරණ හෝ පරීක්ෂණ අංක භාවිතා නොකරන්න.</>,
      "සන්නිවේදන මධ්‍යස්ථානයකද? පළමුව අසන්න: “මට අංක 14ක RN අංකයක් ලැබේද?” නොලැබේ නම්, යවන්න එපා. ඔබට මුදල් අහිමි විය හැක.",
    ],
    avoidTitle: "මේවා භාවිතයෙන් eZ Cash යවන්න එපා",
    avoid: ["බැංකු යෙදුම්", "Cargills / Food City", "Keells", "Pay & Go යන්ත්‍ර"],
    warning:
      "ඔබේ ගෙවීම ලබා ගැනීමට RN අවශ්‍ය වේ. එය නොමැතිව අපට තහවුරු කිරීමට හෝ ඔබේ ගිණුමට එකතු කිරීමට නොහැක.",
  },
};

type EzDepositFlow = {
  pollId: number;
  stage: EzCashDepositStage;
  referenceNumber: string;
  depositId: string;
  amountLkr: number;
  message: string;
  duplicate: boolean;
  startedAt: number;
};

const EZ_POLL_INTERVAL_MS = 1500;
const EZ_MAX_POLL_ATTEMPTS = 4;
const EZ_NOT_FOUND_MESSAGE =
  "We couldn't find an eZ Cash payment for this reference number. Check the 14 digits and try again.";
const EZ_UNREACHABLE_MESSAGE =
  "We couldn't reach eZ Cash to check this reference. Check your connection and try again.";

function EzCashGuide() {
  const [lang, setLang] = useState<EzGuideLang>("en");
  const copy = EZ_GUIDE_COPY[lang];

  return (
    <section id="ezcash-guide" className="ez-guide" aria-label={copy.title}>
      <div className="ez-guide-head">
        <div className="ez-guide-title">
          <span className="ez-guide-icon" aria-hidden="true">
            🛡️
          </span>
          <div>
            <h3>{copy.title}</h3>
            <p>
              <strong>{copy.amountLead}</strong> {copy.amountBody}
            </p>
          </div>
        </div>
        <div className="ez-guide-lang" role="radiogroup" aria-label="Language">
          <button
            type="button"
            className={lang === "en" ? "is-active" : ""}
            onClick={() => setLang("en")}
          >
            English
          </button>
          <button
            type="button"
            className={lang === "si" ? "is-active" : ""}
            onClick={() => setLang("si")}
          >
            සිංහල
          </button>
        </div>
      </div>

      <ol className="ez-guide-steps">
        {copy.steps.map((step, i) => (
          <li key={i} className="ez-guide-step">
            <span className="ez-guide-step-num">{i + 1}</span>
            <span className="ez-guide-step-text">{step}</span>
          </li>
        ))}
      </ol>

      <div className="ez-guide-avoid">
        <span className="ez-guide-avoid-title">{copy.avoidTitle}:</span>
        <div className="ez-guide-avoid-list">
          {copy.avoid.map((item) => (
            <span key={item} className="ez-guide-avoid-item">
              ✕ {item}
            </span>
          ))}
        </div>
      </div>

      <div className="ez-guide-note">
        <Info size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
        <span>{copy.warning}</span>
      </div>
    </section>
  );
}

function getTxTypeClass(type: string) {
  switch (type) {
    case "deposit":
      return "is-deposit";
    case "adjustment":
      return "is-adjustment";
    case "purchase":
      return "is-purchase";
    default:
      return "";
  }
}

export function DashboardWallet() {
  const { user } = useAccount();
  const {
    balance,
    transactions,
    formatAmount,
    isLoaded,
    error: walletError,
    historyError: walletHistoryError,
  } = useWallet();

  const { data: storeSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 0,
  });

  const ezStoreNumber = storeSettings?.paymentEzcashNumber?.trim() || "0741635465";
  const ezStoreName = storeSettings?.paymentEzcashName?.trim() || "HASA Gold";

  const [ezRn, setEzRn] = useState("");
  const [ezFieldError, setEzFieldError] = useState<string | null>(null);
  const [ezFlow, setEzFlow] = useState<EzDepositFlow | null>(null);
  const [ezPollError, setEzPollError] = useState<string | null>(null);
  const [ezElapsed, setEzElapsed] = useState(0);
  const [ezNumberCopied, setEzNumberCopied] = useState(false);
  const ezRnInputRef = useRef<HTMLInputElement>(null);

  const activePollsRef = useRef(new Set<number>());
  const nextPollIdRef = useRef(0);
  useEffect(
    () => () => {
      activePollsRef.current.clear();
    },
    [],
  );

  async function copyStoreNumber() {
    try {
      await navigator.clipboard.writeText(ezStoreNumber);
      setEzNumberCopied(true);
      toast.success("Store number copied to clipboard", { description: ezStoreNumber });
      setTimeout(() => setEzNumberCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy the number manually.");
    }
  }

  const otherMethods = [
    { id: "bank", name: "Bank Transfer", sub: "Coming soon", icon: <CreditCard size={20} /> },
    { id: "card", name: "Visa / Mastercard", sub: "Coming soon", icon: <CreditCard size={20} /> },
    { id: "crypto", name: "USDT / Crypto", sub: "Coming soon", icon: <Smartphone size={20} /> },
  ];

  const ezDialogBusy = ezFlow?.stage === "submitting" || ezFlow?.stage === "waiting";
  const ezFormBusy = Boolean(ezDialogBusy);
  const ezDialogOpen = Boolean(ezFlow);
  const ezWaitStartedAt = ezDialogBusy && ezFlow ? ezFlow.startedAt : null;

  useEffect(() => {
    if (ezWaitStartedAt === null) return;
    const tick = () => setEzElapsed(Math.floor((Date.now() - ezWaitStartedAt) / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [ezWaitStartedAt]);

  async function handleEzCashDeposit(e: FormEvent) {
    e.preventDefault();
    const rn = ezRn.trim();
    if (!/^\d{14}$/.test(rn)) {
      setEzFieldError("Enter the 14-digit eZ Cash reference number from your confirmation SMS.");
      ezRnInputRef.current?.focus();
      return;
    }
    setEzFieldError(null);
    setEzPollError(null);
    setEzElapsed(0);

    const pollId = ++nextPollIdRef.current;
    activePollsRef.current.add(pollId);
    const isAlive = () => activePollsRef.current.has(pollId);
    const isLatest = () => pollId === nextPollIdRef.current;
    const startedAt = Date.now();

    setEzFlow({
      pollId,
      stage: "submitting",
      referenceNumber: rn,
      depositId: "",
      amountLkr: 0,
      message: "",
      duplicate: false,
      startedAt,
    });

    const patchFlow = (values: Partial<EzDepositFlow>) => {
      if (!isLatest()) return;
      setEzFlow((flow) => (flow && flow.pollId === pollId ? { ...flow, ...values } : flow));
    };

    try {
      const { getFirebaseAuth } = await import("@/lib/firebase");
      const fbUser = getFirebaseAuth().currentUser;
      if (!fbUser) {
        patchFlow({ stage: "failed", message: "Please sign in to deposit." });
        toast.error("Please sign in to deposit.");
        return;
      }
      const { initiateApiEzCashDeposit, checkApiEzCashDeposit } = await import("@/lib/api-client");

      const result = await initiateApiEzCashDeposit(rn);
      if (!isAlive()) return;

      if (result.status === "credited" && result.creditedLkr > 0) {
        patchFlow({
          stage: "success",
          depositId: result.depositId,
          amountLkr: result.creditedLkr,
          message: result.message,
          duplicate: Boolean(result.duplicate),
        });
        setEzRn("");
        toast.success("eZ Cash credited!", { description: result.message });
        return;
      }

      if (result.status === "failed") {
        patchFlow({
          stage: "failed",
          depositId: result.depositId,
          message: result.message,
          duplicate: Boolean(result.duplicate),
        });
        toast.error("Deposit failed", { description: result.message });
        return;
      }

      if (!result.depositId) {
        patchFlow({
          stage: "failed",
          message: "The provider did not return a deposit reference. Please contact support.",
        });
        return;
      }

      patchFlow({
        stage: "waiting",
        depositId: result.depositId,
        message: result.message || "Checking eZ Cash reference…",
      });

      let attempts = 0;
      while (isAlive() && attempts < EZ_MAX_POLL_ATTEMPTS) {
        attempts += 1;
        await new Promise((r) => setTimeout(r, EZ_POLL_INTERVAL_MS));
        if (!isAlive()) return;

        try {
          const poll = await checkApiEzCashDeposit(result.depositId);
          if (!isAlive()) return;

          if (poll.status === "credited" && poll.creditedLkr > 0) {
            patchFlow({
              stage: "success",
              amountLkr: poll.creditedLkr,
              message: poll.message,
              duplicate: Boolean(poll.duplicate),
            });
            setEzRn("");
            toast.success("eZ Cash credited!", { description: poll.message });
            return;
          }

          if (poll.status === "failed") {
            patchFlow({
              stage: "failed",
              message: poll.message,
              duplicate: Boolean(poll.duplicate),
            });
            toast.error("Deposit failed", { description: poll.message });
            return;
          }
        } catch {
          // Keep polling until max attempts
        }
      }

      if (!isAlive()) return;
      patchFlow({
        stage: "failed",
        message: EZ_NOT_FOUND_MESSAGE,
        duplicate: false,
      });
      toast.error("Deposit not verified", { description: EZ_NOT_FOUND_MESSAGE });
    } catch (cause) {
      if (!isAlive()) return;
      const msg = cause instanceof Error ? cause.message : EZ_UNREACHABLE_MESSAGE;
      patchFlow({ stage: "failed", message: msg, duplicate: false });
      toast.error("Deposit error", { description: msg });
    } finally {
      activePollsRef.current.delete(pollId);
    }
  }

  return (
    <div className="wallet-page-wrapper">
      {/* Redesigned Premium Header & Quick Stats */}
      <div className="wallet-header-hero">
        <div className="wallet-hero-content">
          <span className="wallet-eyebrow">
            <Sparkles size={13} /> SECURE STORE BALANCE
          </span>
          <h1>HASA Gold Wallet</h1>
          <p>
            Instant top-ups with zero checkout friction. Deposit anytime via eZ Cash and checkout
            directly on any game.
          </p>
        </div>
      </div>

      {/* Modern High-End Virtual VIP Card */}
      <div className="wallet-card-showcase">
        <div className="wallet-modern-card">
          <div className="wallet-modern-card-glow" />
          <div className="wallet-modern-card-pattern" />

          <div className="wallet-modern-card-top">
            <div className="wallet-modern-chip-box">
              <div className="wallet-modern-chip">
                <span className="chip-facet" />
                <span className="chip-facet" />
              </div>
              <span className="wallet-contactless">
                <Lock size={15} />
              </span>
            </div>

            <div className="wallet-modern-brand-tag">
              <span className="wallet-tag-dot" />
              <span>HASA GOLD STORE</span>
            </div>
          </div>

          <div className="wallet-modern-card-middle">
            <span className="wallet-modern-balance-label">AVAILABLE BALANCE</span>
            <div className="wallet-modern-balance-val">
              {walletError ? "Unavailable" : isLoaded ? formatAmount(balance) : "…"}
            </div>
          </div>

          <div className="wallet-modern-card-bottom">
            <div className="wallet-modern-user-info">
              <span className="wallet-meta-label">MEMBER</span>
              <strong className="wallet-meta-val">
                {user?.name?.toUpperCase() || "VERIFIED CUSTOMER"}
              </strong>
            </div>

            <div className="wallet-modern-curr-info">
              <span className="wallet-meta-label">CURRENCY</span>
              <strong className="wallet-meta-val">LKR (Rs.)</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Security Reassurance Strip */}
      <div className="wallet-security-banner">
        <div className="wallet-sec-icon">
          <ShieldCheck size={18} />
        </div>
        <div className="wallet-sec-copy">
          <strong>Protected &amp; Audited Wallet</strong>
          <span>
            Every deposit and checkout debit is cryptographically verified and recorded in your
            ledger.
          </span>
        </div>
      </div>

      {walletError && (
        <div className="admin-error-banner" role="alert">
          {walletError}
        </div>
      )}
      {walletHistoryError && (
        <div className="admin-error-banner" role="alert">
          {walletHistoryError}
        </div>
      )}

      {/* Main Deposit Box */}
      <section className="wallet-deposit-section">
        <div className="wallet-deposit-card">
          <div className="wallet-deposit-header">
            <div className="wallet-dep-title-row">
              <div className="wallet-dep-icon-wrap">
                <Smartphone size={22} />
              </div>
              <div>
                <h2>Direct eZ Cash Deposit</h2>
                <p>Transfer funds to our verified business number and paste the 14-digit RN.</p>
              </div>
            </div>
            <span className="wallet-instant-pill">
              <Sparkles size={12} /> Instant Auto-Credit
            </span>
          </div>

          {/* Business Account Pay-To Info Card */}
          <div className="wallet-payto-box">
            <div className="wallet-payto-details">
              <span className="wallet-payto-tag">TRANSFER PAYMENT TO</span>
              <strong className="wallet-payto-num">{ezStoreNumber}</strong>
              <span className="wallet-payto-name">Account Name: {ezStoreName}</span>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyStoreNumber}
              className="wallet-copy-btn"
            >
              {ezNumberCopied ? (
                <>
                  <CheckCircle2 size={14} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy Number
                </>
              )}
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleEzCashDeposit} className="wallet-rn-form">
            <label htmlFor="ez-rn" className="wallet-rn-label">
              14-Digit eZ Cash Reference Number (RN)
            </label>

            <div className="wallet-input-row">
              <div className="wallet-input-wrap">
                <input
                  ref={ezRnInputRef}
                  id="ez-rn"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="e.g. 20261107123456"
                  value={ezRn}
                  maxLength={14}
                  onChange={(e) => {
                    setEzRn(e.target.value.replace(/\D/g, "").slice(0, 14));
                    setEzFieldError(null);
                  }}
                  onBlur={() => {
                    if (ezRn && ezRn.length !== 14) {
                      setEzFieldError("The eZ Cash RN must be exactly 14 digits.");
                    }
                  }}
                  disabled={ezFormBusy}
                  className={`wallet-rn-field ${ezFieldError ? "is-invalid" : ""}`}
                />
                <span className="wallet-input-counter">{ezRn.length}/14</span>
              </div>

              <Button
                type="submit"
                disabled={ezFormBusy || !ezRn.trim()}
                className="wallet-submit-btn"
              >
                {ezFormBusy ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <PlusCircle size={15} />
                    Verify &amp; Add Funds
                  </>
                )}
              </Button>
            </div>

            {ezFieldError && (
              <p className="wallet-field-err" role="alert">
                {ezFieldError}
              </p>
            )}

            <p className="wallet-helper-hint">
              Send the amount from your eZ Cash wallet/app to the number above, then enter the
              14-digit RN from your confirmation SMS.
            </p>
          </form>

          {/* Pre-deposit guidelines */}
          <div className="wallet-guide-dropdown">
            <EzCashGuide />
          </div>
        </div>
      </section>

      {/* Coming Soon Alternative Gateways */}
      <section className="wallet-methods-row">
        <span className="wallet-methods-title">Upcoming Deposit Methods</span>
        <div className="wallet-methods-grid">
          {otherMethods.map((m) => (
            <div key={m.id} className="wallet-method-card">
              <span className="wallet-method-icon">{m.icon}</span>
              <div>
                <strong>{m.name}</strong>
                <small>{m.sub}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real-time Ledger */}
      <section className="wallet-ledger-section">
        <div className="wallet-ledger-head">
          <div className="wallet-ledger-title">
            <History size={18} />
            <h2>Transaction Ledger</h2>
          </div>
          <span className="wallet-ledger-count">{transactions.length} records</span>
        </div>

        {transactions.length ? (
          <div className="wallet-ledger-list">
            {transactions.map((tx, idx) => {
              const isPositive = tx.amount > 0;
              const cls = getTxTypeClass(tx.type);
              return (
                <div key={tx.id ? `${tx.id}-${idx}` : `tx-${idx}`} className="wallet-ledger-item">
                  <div className="wallet-ledger-left">
                    <div className={`wallet-ledger-icon-bubble ${cls}`}>
                      {isPositive ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    </div>

                    <div className="wallet-ledger-info">
                      <div className="wallet-ledger-top-line">
                        <strong className="wallet-ledger-tx-name">{tx.title}</strong>
                        <span className={`wallet-ledger-pill ${cls}`}>{tx.type}</span>
                      </div>

                      <div className="wallet-ledger-meta-line">
                        {tx.type === "purchase" ? (
                          <>
                            <span className="wallet-order-tag">
                              Order #{tx.referenceNumber || tx.id}
                            </span>{" "}
                            · {tx.method} · {tx.date}
                          </>
                        ) : (
                          <>
                            <code>{tx.id}</code> · {tx.method} · {tx.date}
                          </>
                        )}
                      </div>

                      {tx.reason && (
                        <div className="wallet-ledger-note">
                          <span>{tx.type === "adjustment" ? "Reason:" : "Package:"}</span>
                          <strong>{tx.reason}</strong>
                        </div>
                      )}

                      {tx.type !== "purchase" && tx.referenceNumber && (
                        <div className="wallet-ledger-note">
                          <span>RN:</span>
                          <code>{tx.referenceNumber}</code>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="wallet-ledger-right">
                    <span
                      className={`wallet-ledger-amount ${isPositive ? "is-credit" : "is-debit"}`}
                    >
                      {isPositive ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount)}
                    </span>
                    <span className="wallet-ledger-status">● {tx.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="wallet-empty-ledger">
            <Wallet size={36} />
            <h3>No transactions recorded yet</h3>
            <p>Once you make a deposit or pay for top-ups, detailed records will appear here.</p>
          </div>
        )}
      </section>

      {/* Dialog for eZ Cash progress */}
      <EzCashDepositDialog
        open={ezDialogOpen}
        stage={ezFlow?.stage ?? "submitting"}
        referenceNumber={ezFlow?.referenceNumber ?? ""}
        amountLabel={formatAmount(ezFlow?.amountLkr ?? 0)}
        message={ezFlow?.message ?? ""}
        duplicate={ezFlow?.duplicate ?? false}
        elapsedSeconds={ezElapsed}
        pollError={ezPollError}
        onClose={() => {
          setEzFlow(null);
          setEzPollError(null);
        }}
        onTryAgain={() => {
          setEzFlow(null);
          setEzPollError(null);
          requestAnimationFrame(() => ezRnInputRef.current?.focus());
        }}
      />
    </div>
  );
}
