import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Copy, Loader2, Smartphone, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type EzCashDepositStage = "submitting" | "waiting" | "success" | "failed";

type StepState = "done" | "active" | "pending" | "failed";
type DialogTone = "busy" | "success" | "error";

interface EzCashDepositDialogProps {
  open: boolean;
  stage: EzCashDepositStage;
  referenceNumber: string;
  /** Formatted credited amount, e.g. "Rs. 1,250". */
  amountLabel: string;
  message: string;
  duplicate: boolean;
  elapsedSeconds: number;
  pollError: string | null;
  onClose: () => void;
  onTryAgain: () => void;
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function stageTone(stage: EzCashDepositStage): DialogTone {
  switch (stage) {
    case "success":
      return "success";
    case "failed":
      return "error";
    default:
      return "busy";
  }
}

function stageCopy(stage: EzCashDepositStage, message: string) {
  switch (stage) {
    case "submitting":
      return {
        eyebrow: "eZ Cash verification",
        title: "Submitting your reference",
        lead: "We are sending your 14-digit RN to eZ Cash. Keep this window open — confirmation usually arrives in a few seconds.",
        chip: "Submitting reference",
      };
    case "waiting":
      return {
        eyebrow: "eZ Cash verification",
        title: "Confirming with eZ Cash",
        lead: "eZ Cash is checking your payment now. This normally takes a few seconds — if it isn't confirmed within 6 seconds, the reference is treated as invalid.",
        chip: "Awaiting confirmation",
      };
    case "success":
      return {
        eyebrow: "Deposit confirmed",
        title: "Wallet credited",
        lead: message || "The payment was verified and the amount is now available in your wallet.",
        chip: "Deposit confirmed",
      };
    case "failed":
      return {
        eyebrow: "Verification failed",
        title: "Reference not found",
        lead:
          message ||
          "We couldn't find an eZ Cash payment for this reference number. Check the 14 digits and try again.",
        chip: "Reference not found",
      };
  }
}

function buildSteps(
  stage: EzCashDepositStage,
  referenceNumber: string,
  amountLabel: string,
): Array<{ label: string; detail: string; state: StepState }> {
  const referenceStep: StepState = stage === "submitting" ? "active" : "done";
  const providerStep: StepState =
    stage === "success"
      ? "done"
      : stage === "failed"
        ? "failed"
        : stage === "waiting"
          ? "active"
          : "pending";
  const creditStep: StepState = stage === "success" ? "done" : "pending";

  return [
    {
      label: "Reference received",
      detail: stage === "submitting" ? "Sending your 14-digit RN" : `RN ${referenceNumber}`,
      state: referenceStep,
    },
    {
      label: "eZ Cash confirmation",
      detail:
        stage === "success"
          ? "Payment verified"
          : stage === "failed"
            ? "Reference not found"
            : stage === "waiting"
              ? "Checking for the final answer"
              : "Starts after the reference is accepted",
      state: providerStep,
    },
    {
      label: "Wallet credit",
      detail:
        stage === "success"
          ? `${amountLabel} added to your wallet`
          : stage === "failed"
            ? "No amount was credited"
            : "Credits automatically after verification",
      state: creditStep,
    },
  ];
}

/** Full-screen verification sheet for an eZ Cash reference number. */
export function EzCashDepositDialog({
  open,
  stage,
  referenceNumber,
  amountLabel,
  message,
  duplicate,
  elapsedSeconds,
  pollError,
  onClose,
  onTryAgain,
}: EzCashDepositDialogProps) {
  const busy = stage === "submitting" || stage === "waiting";
  const tone = stageTone(stage);
  const copy = stageCopy(stage, message);
  const steps = buildSteps(stage, referenceNumber, amountLabel);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [open, referenceNumber]);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(referenceNumber);
      setCopied(true);
      toast.success("Reference number copied", { description: referenceNumber });
    } catch {
      toast.error("Could not copy — select the reference number manually.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent
        className={`ez-verify-dialog is-${tone}${busy ? " is-busy" : ""}`}
        aria-busy={busy || undefined}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <span className="ez-verify-topbar" aria-hidden="true" />

        <div className="ez-verify-head">
          <div className={`ez-verify-emblem is-${tone}`} aria-hidden="true">
            {busy ? (
              <Loader2 size={30} className="loading-spin" />
            ) : stage === "success" ? (
              <Check size={30} strokeWidth={2.8} />
            ) : (
              <X size={28} strokeWidth={2.8} />
            )}
          </div>
          <span className="eyebrow">{copy.eyebrow}</span>
          <DialogTitle className="receipt-title">{copy.title}</DialogTitle>
          <DialogDescription className="receipt-lead">{copy.lead}</DialogDescription>
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {copy.title}. {copy.chip}.
        </p>

        <ol className="ez-verify-steps">
          {steps.map((step) => (
            <li key={step.label} className={`ez-verify-step is-${step.state}`}>
              <span className="ez-verify-step-marker" aria-hidden="true">
                {step.state === "done" ? (
                  <Check size={13} strokeWidth={3} />
                ) : step.state === "active" ? (
                  <Loader2 size={13} className="loading-spin" />
                ) : step.state === "failed" ? (
                  <X size={13} strokeWidth={3} />
                ) : null}
              </span>
              <span className="ez-verify-step-copy">
                <strong>{step.label}</strong>
                <span>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="ez-verify-summary">
          <span className="ez-verify-summary-icon" aria-hidden="true">
            <Smartphone size={19} />
          </span>
          <div className="ez-verify-summary-copy">
            <span>eZ Cash reference</span>
            <button
              type="button"
              className="ez-verify-copy"
              onClick={() => void copyReference()}
              aria-label={`Copy reference number ${referenceNumber}`}
            >
              {referenceNumber}
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
          </div>
          <span className={`ez-verify-summary-amount is-${tone}`}>
            <small>{stage === "success" ? "Credited" : "Amount"}</small>
            <strong>
              {stage === "success" ? amountLabel : stage === "failed" ? "—" : "Pending"}
            </strong>
          </span>
        </div>

        {duplicate && (
          <p className="ez-verify-note">
            This reference was already on file, so we checked its latest status instead of
            submitting it again.
          </p>
        )}

        {pollError && busy && (
          <p className="ez-verify-error">
            <AlertTriangle size={13} />A status check failed. Retrying automatically — your deposit
            is not affected.
          </p>
        )}

        <div className="ez-verify-foot">
          <span className={`ez-verify-chip is-${tone}`}>
            <i className={busy ? "is-live" : ""} aria-hidden="true" />
            {copy.chip}
          </span>
          <span className="ez-verify-meta">
            {busy
              ? `Elapsed ${formatElapsed(elapsedSeconds)} · auto-checking every 1.5s`
              : stage === "success"
                ? "Provider confirmed · balance updated"
                : "No wallet credit was recorded"}
          </span>
        </div>

        <div className="ez-verify-actions">
          {stage === "success" && (
            <Button className="ez-verify-primary" onClick={onClose}>
              Done
            </Button>
          )}
          {stage === "failed" && (
            <>
              <Button className="ez-verify-primary" onClick={onTryAgain}>
                Try another RN
              </Button>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </div>

        {stage === "failed" && (
          <p className="ez-verify-help">
            Still need help? <Link to="/support">Contact support</Link> with your reference number.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
