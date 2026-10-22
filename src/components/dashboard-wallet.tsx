import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAccount } from "./account-context";
import { useWallet } from "./wallet-context";
import { EzCashDepositDialog, type EzCashDepositStage } from "./ezcash-deposit-dialog";

/** Store eZ Cash number that customers must send their payment to. */
const STORE_EZCASH_NUMBER = "0741635465";
const STORE_EZCASH_NUMBER_DISPLAY = "074 163 5465";

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

/** Poll cadence and deadline for the final eZ Cash answer. */
const EZ_POLL_INTERVAL_MS = 1500;
/** Four checks at 1.5s intervals — still pending after ~6s means the RN is invalid. */
const EZ_MAX_POLL_ATTEMPTS = 4;
const EZ_NOT_FOUND_MESSAGE =
  "We couldn't find an eZ Cash payment for this reference number. Check the 14 digits and try again.";
const EZ_UNREACHABLE_MESSAGE =
  "We couldn't reach eZ Cash to check this reference. Check your connection and try again.";

/** Bilingual pre-payment guidance for eZ Cash auto-verified deposits. */
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
        <div className="ez-guide-lang" role="group" aria-label="Guide language">
          <button
            type="button"
            className={lang === "en" ? "is-active" : ""}
            aria-pressed={lang === "en"}
            onClick={() => setLang("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={lang === "si" ? "is-active" : ""}
            aria-pressed={lang === "si"}
            onClick={() => setLang("si")}
          >
            සිං
          </button>
        </div>
      </div>

      <ol className="ez-guide-steps">
        {copy.steps.map((step, i) => (
          <li key={i} className="ez-guide-step">
            <span className="ez-guide-step-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="ez-guide-step-text">{step}</span>
          </li>
        ))}
      </ol>

      <div className="ez-guide-avoid">
        <span className="ez-guide-avoid-title">🚫 {copy.avoidTitle}</span>
        <div className="ez-guide-avoid-list">
          {copy.avoid.map((item) => (
            <span key={item} className="ez-guide-avoid-item">
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="ez-guide-note">
        <span aria-hidden="true">⚠️</span>
        <span>{copy.warning}</span>
      </div>
    </section>
  );
}

export function DashboardWallet() {
  const {
    balance,
    formatAmount,
    transactions,
    error: walletError,
    historyError: walletHistoryError,
    isLoaded,
  } = useWallet();
  const { user } = useAccount();

  // eZ Cash — RN verification through the Nexaura deposit API.
  const [ezRn, setEzRn] = useState("");
  const [ezFieldError, setEzFieldError] = useState<string | null>(null);
  const [ezFlow, setEzFlow] = useState<EzDepositFlow | null>(null);
  const [ezElapsed, setEzElapsed] = useState(0);
  const [ezPollError, setEzPollError] = useState<string | null>(null);
  const [ezNumberCopied, setEzNumberCopied] = useState(false);
  const ezRnInputRef = useRef<HTMLInputElement>(null);

  // Every confirmation gets its own token and they live in a set, so an
  // in-flight check is never abandoned when the component re-renders.
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
      await navigator.clipboard.writeText(STORE_EZCASH_NUMBER);
      setEzNumberCopied(true);
      toast.success("Store number copied", { description: STORE_EZCASH_NUMBER_DISPLAY });
      setTimeout(() => setEzNumberCopied(false), 2000);
    } catch {
      toast.error("Could not copy — please copy the number manually.");
    }
  }

  const otherMethods = [
    { id: "easypaisa", name: "Easypaisa", sub: "Unavailable", icon: <Smartphone size={24} /> },
    { id: "jazzcash", name: "JazzCash", sub: "Unavailable", icon: <Smartphone size={24} /> },
    { id: "card", name: "Visa / Mastercard", sub: "Unavailable", icon: <CreditCard size={24} /> },
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

    // Each submission gets its own token so a stale response can never
    // overwrite the result of a newer reference number.
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
      const idToken = await fbUser.getIdToken();
      const { initiateEzCashDeposit, checkEzCashDeposit } = await import("@/api/ezCashDeposit");

      // One round trip — the server submits the RN without waiting for the answer.
      const result = await initiateEzCashDeposit({ data: { idToken, referenceNumber: rn } });
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

      // The dialog waits with a spinner for at most ~6 seconds. If eZ Cash has
      // not confirmed by then, the reference is treated as invalid.
      patchFlow({
        stage: "waiting",
        depositId: result.depositId,
        message: result.message,
        duplicate: Boolean(result.duplicate),
      });
      setEzRn("");

      let sawPendingReply = false;
      for (let attempt = 0; attempt < EZ_MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, EZ_POLL_INTERVAL_MS));
        if (!isAlive()) return;

        let latest: Awaited<ReturnType<typeof checkEzCashDeposit>>;
        try {
          const freshToken = await fbUser.getIdToken();
          latest = await checkEzCashDeposit({
            data: { idToken: freshToken, depositId: result.depositId },
          });
          if (isLatest()) setEzPollError(null);
          sawPendingReply = true;
        } catch (error) {
          // Transient network/provider hiccups keep the dialog waiting until the deadline.
          if (isLatest()) {
            setEzPollError(
              error instanceof Error ? error.message : "The status check did not complete.",
            );
          }
          continue;
        }
        if (!isAlive()) return;

        if (latest.status === "credited" && latest.creditedLkr > 0) {
          patchFlow({
            stage: "success",
            amountLkr: latest.creditedLkr,
            message: latest.message,
            duplicate: Boolean(latest.duplicate),
          });
          toast.success("eZ Cash credited!", { description: latest.message });
          return;
        }

        if (latest.status === "failed") {
          patchFlow({ stage: "failed", message: latest.message });
          toast.error("Verification failed", { description: latest.message });
          return;
        }
      }

      // Six seconds without a final answer: show the cross mark instead of
      // spinning longer, because a valid RN is confirmed almost immediately.
      const timeoutMessage = sawPendingReply ? EZ_NOT_FOUND_MESSAGE : EZ_UNREACHABLE_MESSAGE;
      patchFlow({ stage: "failed", message: timeoutMessage });
      toast.error(sawPendingReply ? "Reference not found" : "Verification unavailable", {
        description: timeoutMessage,
      });
    } catch (error) {
      if (!isAlive()) return;
      const msg = error instanceof Error ? error.message : "Something went wrong. Try again.";
      patchFlow({ stage: "failed", message: msg });
      toast.error("Verification failed", { description: msg });
    } finally {
      activePollsRef.current.delete(pollId);
    }
  }

  function getTxTypeClass(type: string) {
    switch (type) {
      case "deposit":
        return "is-deposit";
      case "purchase":
        return "is-purchase";
      case "cashback":
        return "is-cashback";
      case "refund":
        return "is-refund";
      case "adjustment":
        return "is-adjustment";
      default:
        return "is-deposit";
    }
  }

  return (
    <>
      <div className="dashboard-heading">
        <span className="eyebrow">YOUR ACCOUNT</span>
        <h1>HASA Gold Wallet.</h1>
        <p>
          eZ Cash deposits are added after provider verification. Admin credits and deductions
          appear in your transaction history with a reason. Wallet spending is unavailable.
        </p>
      </div>

      {/* Wallet balance */}
      <div className="wallet-card-container">
        <div className="wallet-vip-card">
          <div className="wallet-card-header">
            <div>
              <div className="wallet-badges">
                <span className="wallet-vip-badge">HASA GOLD WALLET</span>
              </div>
              <h2 className="wallet-balance-label">CURRENT BALANCE</h2>
              <div className="wallet-balance-amount">
                {walletError ? "Unavailable" : isLoaded ? formatAmount(balance) : "…"}
              </div>
            </div>
            <div
              style={{
                textAlign: "right",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: "10px",
              }}
            >
              <div className="wallet-card-chip">
                <div className="chip-line" />
                <div className="chip-line" />
                <div className="chip-line" />
              </div>
              <span className="wallet-brand">HASA GOLD</span>
            </div>
          </div>
          <div className="wallet-card-footer">
            <div>
              <div className="wallet-cardholder-label">Cardholder</div>
              <div className="wallet-cardholder-name">
                {user?.name?.toUpperCase() || "YOUR WALLET"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="wallet-id-label">Currency</div>
              <div className="wallet-id-number">LKR</div>
            </div>
          </div>
        </div>
      </div>

      <div className="wallet-info-row">
        <div className="wallet-info-text">
          <ShieldCheck size={16} style={{ color: "var(--gold)" }} />
          <span>
            Deposits are verified before credit. Admin balance changes include a reason in your
            history. Wallet-paid top-ups appear as debits in your transaction history.
          </span>
        </div>
      </div>
      {walletError && (
        <p role="alert" className="field-error">
          {walletError}
        </p>
      )}
      {walletHistoryError && (
        <p role="alert" className="field-error">
          {walletHistoryError}
        </p>
      )}
      {!isLoaded && <p className="form-hint">Loading wallet data…</p>}
      {/* ── eZ Cash Deposit ───────────────────────────────────── */}
      <section className="dashboard-section" style={{ marginTop: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              background: "rgba(16,185,129,.12)",
              color: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "22px",
            }}
          >
            📱
          </div>
          <div>
            <h2 style={{ fontSize: "17px", margin: 0, fontWeight: 800 }}>Deposit via eZ Cash</h2>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--muted-foreground)",
                marginTop: "3px",
              }}
            >
              Send payment to the store eZ Cash number, then paste your reference number below. The
              credited amount is verified automatically.
            </p>
          </div>
        </div>

        <EzCashGuide />

        <form
          onSubmit={handleEzCashDeposit}
          style={{
            background: "var(--card)",
            border: "2px solid #10b981",
            borderRadius: "16px",
            padding: "24px",
            marginTop: "20px",
          }}
        >
          {/* Store eZ Cash number — where to send the payment */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
              flexWrap: "wrap",
              padding: "14px 16px",
              borderRadius: "12px",
              background: "rgba(16,185,129,.1)",
              border: "1px dashed #10b981",
              marginBottom: "18px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              <span style={{ fontSize: "20px" }} aria-hidden="true">
                📲
              </span>
              <div style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "var(--muted-foreground)",
                  }}
                >
                  Store eZ Cash Number
                </span>
                <strong
                  style={{
                    display: "block",
                    fontSize: "20px",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    letterSpacing: "0.06em",
                    color: "var(--foreground)",
                  }}
                >
                  {STORE_EZCASH_NUMBER_DISPLAY}
                </strong>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyStoreNumber}
              aria-label="Copy store eZ Cash number"
              style={{ whiteSpace: "nowrap", fontWeight: 700 }}
            >
              {ezNumberCopied ? (
                <>
                  <CheckCircle2 size={14} style={{ marginRight: "6px" }} />
                  Copied
                </>
              ) : (
                <>Copy number</>
              )}
            </Button>
          </div>

          <label
            htmlFor="ez-rn"
            style={{ display: "block", fontSize: "13px", fontWeight: 700, marginBottom: "8px" }}
          >
            eZ Cash Reference Number (RN)
          </label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
              <input
                ref={ezRnInputRef}
                id="ez-rn"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 20261007123456"
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
                aria-invalid={ezFieldError ? true : undefined}
                aria-describedby={ezFieldError ? "ez-rn-error" : "ez-rn-help"}
                style={{
                  width: "100%",
                  padding: "12px 64px 12px 16px",
                  borderRadius: "10px",
                  border: `1px solid ${ezFieldError ? "var(--destructive)" : "var(--border)"}`,
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "15px",
                  fontWeight: 600,
                  fontFamily: "monospace",
                  letterSpacing: "0.05em",
                }}
              />
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "10.5px",
                  color: "var(--muted-foreground)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {ezRn.length}/14
              </span>
            </div>
            <Button
              type="submit"
              disabled={ezFormBusy || !ezRn.trim()}
              style={{
                height: "46px",
                padding: "0 24px",
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: 800,
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                color: "#fff",
                whiteSpace: "nowrap",
                border: "none",
                cursor: "pointer",
              }}
            >
              {ezFormBusy ? (
                <>
                  <Loader2 className="loading-spin" size={15} style={{ marginRight: "8px" }} />
                  Verifying…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} style={{ marginRight: "8px" }} />
                  Verify & Credit
                </>
              )}
            </Button>
          </div>
          {ezFieldError && (
            <p
              id="ez-rn-error"
              role="alert"
              style={{ margin: "0 0 10px", fontSize: "11.5px", color: "var(--destructive)" }}
            >
              {ezFieldError}
            </p>
          )}
          <p
            id="ez-rn-help"
            style={{ margin: 0, fontSize: "11px", color: "var(--muted-foreground)" }}
          >
            Send the payment amount to <strong>{STORE_EZCASH_NUMBER_DISPLAY}</strong> from your eZ
            Cash wallet, then paste the reference number (RN) from your eZ Cash SMS confirmation
            above. We check automatically and confirm most payments within 6 seconds.
          </p>
        </form>
      </section>

      {/* ── Other methods (coming soon) ── */}
      <section className="dashboard-section" style={{ marginTop: "16px" }}>
        <h3
          style={{
            fontSize: "13px",
            fontWeight: 700,
            marginBottom: "10px",
            color: "var(--muted-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Other deposit methods unavailable
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "10px",
          }}
        >
          {otherMethods.map((m) => (
            <div
              key={m.id}
              style={{
                padding: "14px",
                borderRadius: "12px",
                border: "1px dashed var(--border)",
                background: "var(--background)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                opacity: 0.55,
              }}
            >
              <span style={{ color: "var(--muted-foreground)" }}>{m.icon}</span>
              <div>
                <strong style={{ fontSize: "13px", display: "block" }}>{m.name}</strong>
                <span style={{ fontSize: "11px", color: "var(--muted-foreground)" }}>{m.sub}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Transaction Ledger ── */}
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

      {/* ── Transaction Ledger ── */}
      <section className="dashboard-section" style={{ marginTop: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "18px",
          }}
        >
          <h2 style={{ fontSize: "17px", fontWeight: 800, margin: 0 }}>Transaction Ledger</h2>
          <span style={{ fontSize: "12px", color: "var(--muted-foreground)", fontWeight: 600 }}>
            {transactions.length} entries
          </span>
        </div>

        {transactions.length ? (
          <div className="wallet-tx-grid">
            {transactions.map((tx) => {
              const isPositive = tx.amount > 0;
              const cls = getTxTypeClass(tx.type);
              return (
                <div key={tx.id} className="wallet-tx-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div className={`wallet-tx-icon ${cls}`}>
                      <ArrowDownLeft size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          flexWrap: "wrap",
                        }}
                      >
                        <strong className="wallet-tx-title">{tx.title}</strong>
                        <span className={`wallet-tx-badge ${cls}`}>{tx.type}</span>
                      </div>
                      <div className="wallet-tx-meta">
                        <code>{tx.id}</code> · {tx.method} · {tx.date}
                      </div>
                      {tx.reason && (
                        <div className="wallet-tx-reference wallet-tx-reason">
                          <strong>{tx.type === "adjustment" ? "Reason" : "Package"}</strong>
                          <span>{tx.reason}</span>
                        </div>
                      )}
                      {tx.type !== "adjustment" && (
                        <div className="wallet-tx-reference">
                          <span>
                            {tx.type === "purchase" ? "Order number" : "Reference number"}
                          </span>
                          <code>{tx.referenceNumber || "Not available"}</code>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", minWidth: "110px" }}>
                    <div
                      className={`wallet-tx-amount ${isPositive ? "is-positive" : "is-negative"}`}
                    >
                      {isPositive ? `+${formatAmount(tx.amount)}` : formatAmount(tx.amount)}
                    </div>
                    <div className="wallet-tx-status">● {tx.status}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty">
            <Wallet />
            <h2>No transactions yet</h2>
            <p>Deposit via eZ Cash to get started.</p>
          </div>
        )}
      </section>
    </>
  );
}
