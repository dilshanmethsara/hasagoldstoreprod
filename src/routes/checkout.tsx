import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck,
  Check,
  Copy,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Loader2,
  Upload,
  X,
  Wallet,
  UserRound,
  Globe2,
  CreditCard,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { pageHead } from "@/lib/store-data";
import { useGame, useProducts } from "@/lib/firestore";
import {
  createOrder,
  getOrderPaymentProofUploadToken,
  submitOrderPaymentProof,
} from "@/api/createOrder";
import { pollNexauraTopup } from "@/api/nexauraTopups";
import { fetchStoreSettings } from "@/lib/firestore";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";
import { getFirebaseApp, getFirebaseAuth } from "@/lib/firebase";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { useAccount } from "@/components/account-context";
import { uploadPaymentProof } from "@/lib/supabase-storage";
import ezcashLogo from "@/assets/ezcash.jfif";

const terminalNexauraStatuses = new Set(["completed", "failed", "refunded"]);

type NexauraWaitStage = "paying" | "processing";
type ReceiptTone = "success" | "error" | "refund" | "warning" | "info";

/** Friendly provider wording so customers never see raw API statuses. */
function nexauraStatusLabel(status?: string): string {
  const value = (status ?? "").trim().toLowerCase();
  switch (value) {
    case "":
      return "Waiting for provider";
    case "submitting":
    case "submission_pending":
      return "Sending to provider";
    case "pending":
    case "queued":
    case "waiting":
      return "Queued with provider";
    case "processing":
    case "in_progress":
    case "in-progress":
      return "Provider processing";
    case "completed":
    case "success":
      return "Delivered";
    case "failed":
      return "Delivery failed";
    case "refunded":
      return "Refunded by provider";
    case "submission_failed":
      return "Submission failed";
    case "submission_unknown":
      return "Submission needs review";
    default:
      return value.replace(/[_-]+/g, " ").replace(/^\w/, (char) => char.toUpperCase());
  }
}

function receiptToneFor(status?: string): ReceiptTone {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "refunded":
      return "refund";
    case "submission_failed":
    case "submission_unknown":
      return "warning";
    default:
      return "info";
  }
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

interface NexauraWaitSummary {
  gameImage: string;
  packName: string;
  playerId: string;
  amount: string;
  orderId?: string;
}

function NexauraWaitSheet({
  stage,
  summary,
  status,
  note,
  providerOrderId,
  pollError,
  elapsedSeconds,
  copied,
  onCopyOrderId,
}: {
  stage: NexauraWaitStage;
  summary: NexauraWaitSummary;
  status?: string | undefined;
  note?: string | null | undefined;
  providerOrderId?: string | undefined;
  pollError?: string | undefined;
  elapsedSeconds: number;
  copied: boolean;
  onCopyOrderId: () => void;
}) {
  const paying = stage === "paying";
  const statusText = nexauraStatusLabel(status);
  const steps: Array<{ label: string; detail: string; state: "done" | "active" | "pending" }> = [
    {
      label: "Wallet payment",
      detail: paying ? "Charging your wallet securely" : `${summary.amount} paid`,
      state: paying ? "active" : "done",
    },
    {
      label: "Sent to Nexaura",
      detail: paying
        ? "Starts as soon as payment clears"
        : providerOrderId
          ? `Provider order ${providerOrderId}`
          : "Waiting for provider confirmation",
      state: paying ? "pending" : providerOrderId ? "done" : "active",
    },
    {
      label: "Top-up delivered",
      detail: paying ? "Waiting for earlier steps" : statusText,
      state: paying ? "pending" : "active",
    },
  ];

  return (
    <div className="nexaura-wait">
      <span className="nexaura-topbar" aria-hidden="true" />
      <div className="nexaura-wait-head">
        <div className="nexaura-loader" aria-hidden="true">
          <span className="nexaura-loader-core">
            <Loader2 size={26} className="nexaura-spin" />
          </span>
        </div>
        <span className="eyebrow">
          {paying ? "Processing wallet payment" : "Wallet payment received"}
        </span>
        <DialogTitle className="receipt-title">
          {paying ? "Completing your order" : "Top-up in progress"}
        </DialogTitle>
        <DialogDescription className="receipt-lead">
          {paying
            ? "We are confirming your wallet payment and sending this top-up to Nexaura. This normally takes a few seconds and can take up to 30 — keep this window open for the result."
            : "Nexaura is delivering your top-up now. This window updates automatically — there is nothing else you need to do."}
        </DialogDescription>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        Nexaura status: {paying ? "confirming wallet payment" : statusText}.
      </p>

      <ol className="nexaura-steps">
        {steps.map((step) => (
          <li key={step.label} className={`nexaura-step is-${step.state}`}>
            <span className="nexaura-step-marker" aria-hidden="true">
              {step.state === "done" ? (
                <Check size={13} strokeWidth={3} />
              ) : step.state === "active" ? (
                <Loader2 size={13} className="nexaura-spin" />
              ) : null}
            </span>
            <span className="nexaura-step-copy">
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="nexaura-summary">
        <img src={summary.gameImage} alt="" />
        <div className="nexaura-summary-copy">
          <strong>{summary.packName}</strong>
          <span>
            UID {summary.playerId}
            {summary.orderId && (
              <button
                type="button"
                className="nexaura-copy"
                onClick={onCopyOrderId}
                aria-label={`Copy order ID ${summary.orderId}`}
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {summary.orderId}
              </button>
            )}
          </span>
        </div>
        <span className="nexaura-summary-amount">
          <small>Total</small>
          <strong>{summary.amount}</strong>
        </span>
      </div>

      {note && !paying && <p className="nexaura-wait-note">{note}</p>}

      {pollError && (
        <p className="nexaura-wait-error">
          <AlertTriangle size={13} />A status check failed. Retrying automatically — your order is
          not affected.
        </p>
      )}

      <div className="nexaura-wait-foot">
        <span key={`${stage}-${status ?? "pending"}`} className="nexaura-status-chip">
          <span className="nexaura-live-dot" aria-hidden="true" />
          {paying ? "Confirming payment" : statusText}
        </span>
        <span className="nexaura-wait-meta" aria-hidden="true">
          {paying
            ? `Elapsed ${formatElapsed(elapsedSeconds)} · waiting for provider reply`
            : `Elapsed ${formatElapsed(elapsedSeconds)} · auto-checking every 4s`}
        </span>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    game: (search["game"] as string) || "free-fire",
    productId: (search["productId"] as string) || "",
    uid: (search["uid"] as string) || "",
    server: (search["server"] as string) || "",
    method: (search["method"] as string) || "wallet",
  }),
  head: () => pageHead("Checkout", "Review your top-up and confirm your HASA GOLD STORE order."),
  component: CheckoutPage,
});

function CheckoutPage() {
  const searchParams = Route.useSearch();
  const navigate = useNavigate();
  const { uid, ready } = useAccount();
  const {
    data: storeSettings,
    isLoading: settingsLoading,
    isError: settingsError,
  } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 60_000,
  });

  const {
    data: selectedGame,
    isLoading: gameLoading,
    error: gameError,
  } = useGame(searchParams.game);
  const playerId = searchParams.uid;
  const server = searchParams.server;
  const paymentMethod = searchParams.method || "wallet";
  const isEzcash = paymentMethod === "ezcash";
  const paymentMethods =
    storeSettings?.paymentMethods ?? DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method }));
  const selectedPayment = paymentMethods.find((method) => method.id === paymentMethod);
  const paymentMethodActive = selectedPayment?.active === true;
  const walletBalanceQuery = useQuery({
    queryKey: ["walletBalance", uid],
    queryFn: async () => {
      if (!uid || getFirebaseAuth().currentUser?.uid !== uid) {
        throw new Error("Sign in to check your wallet balance.");
      }
      const snapshot = await getDoc(doc(getFirestore(getFirebaseApp()), "users", uid));
      const balance = snapshot.data()?.["walletBalanceLkr"];
      if (typeof balance !== "number" || !Number.isFinite(balance) || balance < 0) return 0;
      return balance;
    },
    enabled: Boolean(uid && paymentMethod === "wallet"),
    staleTime: 10_000,
  });

  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
  } = useProducts(searchParams.game);
  const product = products?.find((p) => p.id === searchParams.productId);

  // Prices come from the trusted Firestore product snapshot
  const pricePkr = product?.pricePkr ?? 0;
  const priceLabel = product ? `LKR ${pricePkr.toLocaleString()}` : "—";
  const packageLabel = product
    ? product.name?.trim() || `${product.amount.toLocaleString()} ${product.unitLabel}`
    : "No package selected";

  const [processingOrder, setProcessingOrder] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploadError, setProofUploadError] = useState<string | null>(null);
  const [proofUploadProgress, setProofUploadProgress] = useState<number>(0);
  const [copiedId, setCopiedId] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{
    orderId: string;
    gameName: string;
    gameImage: string;
    packName: string;
    playerId: string;
    amount: string;
    paymentMethod: string;
    paymentStatus: string;
    emailNotificationSent: boolean;
    nexauraStatus?: string | undefined;
    nexauraProviderOrderId?: string | undefined;
    nexauraNote?: string | null | undefined;
    nexauraMessage?: string | undefined;
    nexauraPollError?: string | undefined;
  } | null>(null);
  const isNexauraCheckout = paymentMethod === "wallet" && searchParams.game === "free-fire";
  const isAwaitingNexaura =
    isNexauraCheckout &&
    (processingOrder ||
      Boolean(
        completedOrder?.paymentStatus === "paid" &&
        completedOrder.nexauraProviderOrderId &&
        !terminalNexauraStatuses.has(completedOrder.nexauraStatus ?? ""),
      ));

  useEffect(() => {
    const localOrderId = completedOrder?.orderId;
    const providerOrderId = completedOrder?.nexauraProviderOrderId;
    const providerStatus = completedOrder?.nexauraStatus;
    const user = getFirebaseAuth().currentUser;
    if (
      !localOrderId ||
      !providerOrderId ||
      !user ||
      (providerStatus && terminalNexauraStatuses.has(providerStatus))
    ) {
      return;
    }

    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await pollNexauraTopup({
          data: { idToken: await user.getIdToken(), orderId: localOrderId },
        });
        if (!active) return;
        setCompletedOrder((current) =>
          current?.orderId === localOrderId
            ? {
                ...current,
                nexauraStatus: result.status,
                nexauraNote: result.note,
                nexauraPollError: undefined,
              }
            : current,
        );
        if (!result.terminal) timeout = setTimeout(() => void poll(), 4000);
      } catch (cause) {
        if (!active) return;
        setCompletedOrder((current) =>
          current?.orderId === localOrderId
            ? {
                ...current,
                nexauraPollError:
                  cause instanceof Error ? cause.message : "Nexaura status could not be checked.",
              }
            : current,
        );
        timeout = setTimeout(() => void poll(), 4000);
      }
    };
    timeout = setTimeout(() => void poll(), 4000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [
    completedOrder?.orderId,
    completedOrder?.nexauraProviderOrderId,
    completedOrder?.nexauraStatus,
  ]);

  // Elapsed time only ticks while the Nexaura dialog is waiting on a result.
  const [nexauraWaitSeconds, setNexauraWaitSeconds] = useState(0);
  useEffect(() => {
    if (!isAwaitingNexaura) return;
    const startedAt = Date.now();
    setNexauraWaitSeconds(0);
    const timer = setInterval(() => {
      setNexauraWaitSeconds(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [isAwaitingNexaura]);

  const finalPayableLabel = priceLabel;
  const missingDetails = !playerId || !product;
  const paymentConfigured = Boolean(
    storeSettings?.paymentEzcashNumber?.trim() && storeSettings?.paymentEzcashName?.trim(),
  );

  if (gameLoading || productsLoading || settingsLoading) {
    return (
      <div className="container page-content">
        <div className="empty-state" aria-busy="true">
          <Loader2 className="loading-spin" size={28} />
          <p>Loading live game and package details…</p>
        </div>
      </div>
    );
  }
  if (gameError || productsError || settingsError || !selectedGame) {
    return (
      <div className="container page-content">
        <div className="empty-state" role="alert">
          <h1>Checkout is unavailable</h1>
          <p>
            Checkout details could not be confirmed. Please refresh or return to the games page and
            try again.
          </p>
          <Button asChild variant="outline">
            <Link to="/games">Browse games</Link>
          </Button>
        </div>
      </div>
    );
  }

  async function handleCompleteCheckout() {
    if (!selectedGame) {
      toast.error("This game is no longer available.");
      return;
    }
    if (settingsLoading || settingsError) {
      toast.error("Payment settings unavailable", {
        description: "Refresh checkout and try again after the store settings load.",
      });
      return;
    }
    if (!playerId) {
      toast.error("Details incomplete", { description: "Go back and enter a Player ID first." });
      return;
    }
    if (!product) {
      toast.error("No package selected", { description: "Go back and choose a top-up package." });
      return;
    }
    if (!paymentMethodActive || !selectedPayment) {
      toast.error("Payment method unavailable", {
        description: "Choose an active payment method and try again.",
      });
      return;
    }
    if (
      paymentMethod === "wallet" &&
      (walletBalanceQuery.isError ||
        walletBalanceQuery.data === undefined ||
        walletBalanceQuery.data < pricePkr)
    ) {
      toast.error(
        walletBalanceQuery.isError
          ? "Wallet balance could not be checked"
          : "Insufficient wallet balance",
        {
          description: walletBalanceQuery.isError
            ? "Refresh checkout and check your balance before placing the order."
            : `Your wallet needs LKR ${pricePkr.toLocaleString()} for this order.`,
        },
      );
      return;
    }
    if (isEzcash && (!paymentConfigured || !proofFile)) {
      toast.error(
        !paymentConfigured ? "eZ Cash details are not configured" : "Payment proof required",
        {
          description: !paymentConfigured
            ? "Please contact the store before making a payment."
            : "Choose a screenshot or receipt image before creating the order.",
        },
      );
      return;
    }
    setProcessingOrder(true);
    try {
      // Get a fresh ID token so the server function can verify the caller.
      const auth = getFirebaseAuth();
      const fbUser = auth.currentUser;
      const idToken = fbUser ? await fbUser.getIdToken() : null;

      if (!idToken || !fbUser) {
        toast.error("Please sign in to place an order.");
        setProcessingOrder(false);
        return;
      }

      const result = await createOrder({
        data: { idToken, productId: product.id, playerId, server, paymentMethod },
      });

      setCompletedOrder({
        orderId: result.orderId,
        gameName: result.gameName,
        gameImage: selectedGame.image,
        packName: result.packageName,
        playerId,
        amount: finalPayableLabel,
        paymentMethod,
        paymentStatus: result.paymentStatus,
        emailNotificationSent: result.emailNotificationSent,
        nexauraStatus: result.nexauraSubmission?.status,
        nexauraProviderOrderId: result.nexauraSubmission?.orderId,
        nexauraMessage: result.nexauraSubmission?.message,
      });
      if (!result.emailNotificationSent) {
        toast.error("Order created, but confirmation email was not sent", {
          description: "Check your account email or contact the store for help.",
        });
      }
      if (result.nexauraSubmission?.status === "submission_failed") {
        toast.error("Order created, but automatic top-up could not be submitted", {
          description: result.nexauraSubmission.message,
        });
      } else if (result.nexauraSubmission?.status === "submission_unknown") {
        toast.error("Order created, but top-up submission needs review", {
          description: result.nexauraSubmission.message,
        });
      }
      if (isEzcash && proofFile) {
        await uploadProof(result.orderId, proofFile);
      } else if (!isNexauraCheckout) {
        toast.success(
          paymentMethod === "wallet" ? "Wallet payment successful" : "Unpaid order created",
          {
            description:
              paymentMethod === "wallet"
                ? `LKR ${pricePkr.toLocaleString()} was deducted. Order ${result.orderId} is processing.`
                : `Order ${result.orderId} is pending payment review.`,
          },
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not create order. Please try again.";
      toast.error("Order failed", { description: msg });
    } finally {
      setProcessingOrder(false);
    }
  }

  async function uploadProof(orderId: string, file: File) {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      setProofUploadError("Sign in again before uploading your payment proof.");
      return;
    }
    setProofUploading(true);
    setProofUploadError(null);
    setProofUploadProgress(0);
    try {
      const upload = await getOrderPaymentProofUploadToken({
        data: {
          idToken: await currentUser.getIdToken(),
          orderId,
        },
      });
      await uploadPaymentProof(upload.signedUrl, file, (progress) => {
        setProofUploadProgress(progress);
      });
      await submitOrderPaymentProof({
        data: {
          idToken: await currentUser.getIdToken(),
          orderId,
          fileName: file.name,
        },
      });
      setCompletedOrder((current) =>
        current?.orderId === orderId ? { ...current, paymentStatus: "proof_submitted" } : current,
      );
      toast.success("Payment proof submitted", {
        description: "Your order is waiting for an administrator to review the proof.",
      });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Payment proof could not be uploaded.";
      setProofUploadError(message);
      toast.error("Payment proof upload failed", { description: message });
    } finally {
      setProofUploading(false);
      setProofUploadProgress(0);
    }
  }

  async function handleCopyOrderId() {
    if (!completedOrder) return;
    try {
      await navigator.clipboard.writeText(completedOrder.orderId);
      setCopiedId(true);
      toast.success("Order ID copied");
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      toast.error("Could not copy the order ID. Please copy it manually.");
    }
  }

  async function handleCopyReceipt() {
    if (!completedOrder) return;
    try {
      await navigator.clipboard.writeText(
        `HASA GOLD STORE — ORDER RECEIPT\n` +
          `Order  : ${completedOrder.orderId}\n` +
          `Game   : ${completedOrder.gameName}\n` +
          `UID    : ${completedOrder.playerId}\n` +
          `Item   : ${completedOrder.packName}\n` +
          `Payment: ${completedOrder.paymentMethod}\n` +
          `Status : ${completedOrder.paymentStatus === "paid" ? "Paid from wallet / processing" : completedOrder.paymentStatus === "proof_submitted" ? "Proof submitted / awaiting review" : "Pending / unpaid"}\n` +
          `Total  : ${completedOrder.amount}\n`,
      );
      toast.success("Order details copied");
    } catch {
      toast.error("Could not copy order details. Please copy them manually.");
    }
  }

  function handleFileSelect(file: File | null) {
    if (!file) {
      setProofFile(null);
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) ||
      file.size <= 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setProofFile(null);
      toast.error("Choose a non-empty JPEG, PNG, WebP, or PDF file under 5 MB.");
      return;
    }
    setProofFile(file);
    setProofUploadError(null);
  }

  const waitSummary: NexauraWaitSummary = completedOrder
    ? {
        gameImage: completedOrder.gameImage,
        packName: completedOrder.packName,
        playerId: completedOrder.playerId,
        amount: completedOrder.amount,
        orderId: completedOrder.orderId,
      }
    : {
        gameImage: selectedGame.image,
        packName: packageLabel,
        playerId,
        amount: finalPayableLabel,
      };

  const receiptTone = receiptToneFor(completedOrder?.nexauraStatus);
  const receiptLabel = nexauraStatusLabel(completedOrder?.nexauraStatus);
  const receiptTitle =
    receiptTone === "success"
      ? "Top-up complete"
      : receiptTone === "error"
        ? "Top-up failed"
        : receiptTone === "refund"
          ? "Top-up refunded"
          : receiptTone === "warning"
            ? "Top-up needs review"
            : "Order created";
  const receiptEyebrow =
    receiptTone === "success"
      ? "Delivery confirmed"
      : receiptTone === "error" || receiptTone === "warning"
        ? "Action needed"
        : receiptTone === "refund"
          ? "Provider update"
          : completedOrder?.paymentStatus === "paid"
            ? "Wallet payment received"
            : "Order receipt";

  return (
    <div className="container page-content checkout-page-wrapper">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <ChevronRight size={12} />
        <Link to="/games">Games</Link>
        <ChevronRight size={12} />
        <Link to="/games/$game" params={{ game: selectedGame.id }}>
          {selectedGame.name}
        </Link>
        <ChevronRight size={12} />
        <span>Checkout</span>
      </nav>

      <div className="page-intro checkout-intro">
        <span className="eyebrow">Secure checkout</span>
        <h1>Review your order</h1>
        <p>
          Confirm your package and player details, then complete payment. You can change the package
          before paying.
        </p>
      </div>

      <ol className="checkout-progress" aria-label="Checkout progress">
        <li className={product ? "is-done" : ""}>
          <span className="checkout-progress-dot">
            {product ? <Check size={11} strokeWidth={3} /> : "1"}
          </span>
          <span>Package selected</span>
        </li>
        <li className={playerId ? "is-done" : ""}>
          <span className="checkout-progress-dot">
            {playerId ? <Check size={11} strokeWidth={3} /> : "2"}
          </span>
          <span>Player details</span>
        </li>
        <li className="is-current" aria-current="step">
          <span className="checkout-progress-dot">3</span>
          <span>Review & pay</span>
        </li>
      </ol>

      {productsLoading ? (
        <div className="empty-state">
          <Loader2 className="loading-spin" size={28} />
          <p>Loading package details…</p>
        </div>
      ) : (
        <div className="checkout-grid">
          {/* ── Left column ── */}
          <div className="checkout-main-col">
            <section className="checkout-card" aria-labelledby="checkout-summary-title">
              <div className="checkout-card-header">
                <div className="checkout-card-title">
                  <span className="checkout-step-badge">1</span>
                  <div>
                    <h2 id="checkout-summary-title">Package & player</h2>
                    <p>Check your selected package and the account that will receive it.</p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="checkout-edit-btn">
                  <Link to="/games/$game" params={{ game: selectedGame.id }}>
                    <Pencil size={13} /> Change package
                  </Link>
                </Button>
              </div>

              <div className="checkout-package-spotlight">
                <div className="checkout-package-media">
                  <img src={selectedGame.image} alt="" />
                  <span className="checkout-package-selected" aria-hidden="true">
                    <Check size={11} strokeWidth={3} />
                  </span>
                </div>
                <div className="checkout-package-copy">
                  <span className="checkout-package-eyebrow">{selectedGame.name}</span>
                  <strong>{packageLabel}</strong>
                  <span className="checkout-package-meta">You can change this before paying.</span>
                </div>
                <div className="checkout-package-price">
                  <span>Package price</span>
                  <strong>{priceLabel}</strong>
                </div>
              </div>

              <ul className="checkout-facts">
                <li className="checkout-fact">
                  <span className="checkout-fact-icon" aria-hidden="true">
                    <UserRound size={15} />
                  </span>
                  <span className="checkout-fact-label">Player ID</span>
                  <span className="checkout-fact-value">{playerId || "Not provided"}</span>
                </li>
                <li className="checkout-fact">
                  <span className="checkout-fact-icon" aria-hidden="true">
                    <Globe2 size={15} />
                  </span>
                  <span className="checkout-fact-label">Server</span>
                  <span className="checkout-fact-value">{server || "Not required"}</span>
                </li>
                <li className="checkout-fact">
                  <span className="checkout-fact-icon" aria-hidden="true">
                    <CreditCard size={15} />
                  </span>
                  <span className="checkout-fact-label">Payment method</span>
                  <span className="checkout-fact-value">
                    {selectedPayment?.name ?? "Unavailable"}
                  </span>
                </li>
              </ul>
            </section>

            <section className="checkout-card">
              <div className="checkout-card-header">
                <div className="checkout-card-title">
                  <span className="checkout-step-badge">2</span>
                  <div>
                    <h2>
                      {isEzcash
                        ? "Pay by eZ Cash"
                        : selectedPayment?.id === "wallet"
                          ? "Pay from wallet"
                          : "Payment unavailable"}
                    </h2>
                    <p>
                      {isEzcash
                        ? "Send the exact total, then attach your payment receipt."
                        : selectedPayment?.id === "wallet"
                          ? "Review your balance, then confirm to pay instantly."
                          : "This payment method is unavailable."}
                    </p>
                  </div>
                </div>
              </div>
              {isEzcash ? (
                <div className="checkout-payment-proof">
                  {paymentConfigured ? (
                    <>
                      <div className="ezcash-payment-instructions">
                        <div className="ezcash-instruction-header">
                          <div className="ezcash-logo-wrapper">
                            <img src={ezcashLogo} alt="eZ Cash" className="ezcash-logo" />
                          </div>
                          <div className="ezcash-instruction-title">
                            <span className="eyebrow">Payment Details</span>
                            <h3>Send the exact amount</h3>
                          </div>
                        </div>
                        <div className="ezcash-payment-details">
                          <div className="ezcash-detail-item">
                            <span className="ezcash-detail-label">Amount to send</span>
                            <span className="ezcash-detail-value">{priceLabel}</span>
                          </div>
                          <div className="ezcash-detail-item">
                            <span className="ezcash-detail-label">eZ Cash Number</span>
                            <span className="ezcash-detail-value">
                              {storeSettings?.paymentEzcashNumber}
                            </span>
                          </div>
                          <div className="ezcash-detail-item">
                            <span className="ezcash-detail-label">Account Name</span>
                            <span className="ezcash-detail-value">
                              {storeSettings?.paymentEzcashName}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ezcash-upload-section">
                        <div className="ezcash-upload-header">
                          <span className="eyebrow">Payment Proof</span>
                          <h4>Upload your receipt</h4>
                          <p className="ezcash-upload-hint">
                            Upload a screenshot or receipt. Your order remains unpaid until an
                            administrator verifies the transfer. A proof image alone does not
                            confirm payment or trigger delivery.
                          </p>
                        </div>
                        <div
                          className={`ezcash-upload-zone ${isDragging ? "dragging" : ""} ${proofFile ? "has-file" : ""}`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const file = e.dataTransfer.files?.[0] ?? null;
                            handleFileSelect(file);
                          }}
                        >
                          {proofFile ? (
                            <div className="ezcash-file-preview">
                              <div className="ezcash-file-info">
                                <Upload size={24} className="ezcash-file-icon" />
                                <div className="ezcash-file-details">
                                  <span className="ezcash-file-name">{proofFile.name}</span>
                                  <span className="ezcash-file-size">
                                    {(proofFile.size / 1024 / 1024).toFixed(2)} MB
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                className="ezcash-remove-file"
                                onClick={() => {
                                  setProofFile(null);
                                  setProofUploadError(null);
                                }}
                                aria-label="Remove file"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="ezcash-upload-content">
                              <Upload size={32} className="ezcash-upload-icon" />
                              <div className="ezcash-upload-text">
                                <span className="ezcash-upload-primary">
                                  Drag & drop your receipt here
                                </span>
                                <span className="ezcash-upload-secondary">or click to browse</span>
                              </div>
                              <span className="ezcash-upload-formats">
                                JPEG, PNG, WebP, or PDF (max 5 MB)
                              </span>
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="ezcash-hidden-input"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0] ?? null;
                              handleFileSelect(file);
                            }}
                            disabled={proofUploading}
                          />
                        </div>
                        {proofUploadError && (
                          <p className="ezcash-upload-error" role="alert">
                            {proofUploadError}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="form-hint" role="alert">
                      eZ Cash payment instructions are not configured yet. Please contact the store
                      before sending money.
                    </p>
                  )}
                </div>
              ) : selectedPayment?.id === "wallet" ? (
                <div
                  className="checkout-wallet-panel"
                  role={walletBalanceQuery.isError ? "alert" : "status"}
                >
                  <div className="checkout-wallet-main">
                    <span className="checkout-wallet-icon" aria-hidden="true">
                      <Wallet size={18} />
                    </span>
                    <div>
                      <span className="checkout-wallet-label">Wallet balance</span>
                      <strong>
                        {!ready
                          ? "Checking…"
                          : !uid
                            ? "Sign in required"
                            : walletBalanceQuery.isError
                              ? "Unavailable"
                              : typeof walletBalanceQuery.data === "number"
                                ? `LKR ${walletBalanceQuery.data.toLocaleString()}`
                                : "Checking…"}
                      </strong>
                    </div>
                    {typeof walletBalanceQuery.data === "number" && (
                      <span
                        className={`checkout-wallet-tag ${
                          walletBalanceQuery.data < pricePkr ? "is-low" : "is-ok"
                        }`}
                      >
                        {walletBalanceQuery.data < pricePkr ? "Not enough" : "Enough"}
                      </span>
                    )}
                  </div>
                  <div className="checkout-wallet-rows">
                    <div>
                      <span>Order total</span>
                      <strong>{priceLabel}</strong>
                    </div>
                    {typeof walletBalanceQuery.data === "number" &&
                      walletBalanceQuery.data >= pricePkr && (
                        <div>
                          <span>Balance after payment</span>
                          <strong>
                            LKR {(walletBalanceQuery.data - pricePkr).toLocaleString()}
                          </strong>
                        </div>
                      )}
                  </div>
                  {!ready ? (
                    <p className="checkout-wallet-note">Checking your account status…</p>
                  ) : !uid ? (
                    <p className="checkout-wallet-note is-error">
                      Sign in to your account to check your wallet balance before placing this
                      order.
                    </p>
                  ) : walletBalanceQuery.isError ? (
                    <p className="checkout-wallet-note is-error">
                      Refresh checkout and try again to check your wallet balance.
                    </p>
                  ) : typeof walletBalanceQuery.data === "number" &&
                    walletBalanceQuery.data < pricePkr ? (
                    <p className="checkout-wallet-note is-error">
                      Add LKR {(pricePkr - walletBalanceQuery.data).toLocaleString()} more to your
                      wallet before placing this order.{" "}
                      <Link to="/dashboard/wallet">Add funds</Link>
                    </p>
                  ) : (
                    <p className="checkout-wallet-note">
                      The order total is deducted from your wallet when you confirm this order.
                    </p>
                  )}
                </div>
              ) : (
                <p className="form-hint">
                  This payment method is unavailable. Please select an active method on the game
                  page.
                </p>
              )}
            </section>
          </div>

          {/* ── Right sidebar ── */}
          <aside className="checkout-sidebar-col">
            <div className="checkout-summary-card">
              <div className="checkout-summary-head">
                <h3>Order summary</h3>
                <p>One last check before you pay.</p>
              </div>

              <div className="checkout-summary-game">
                <img src={selectedGame.image} alt="" />
                <div className="checkout-summary-game-copy">
                  <span className="checkout-summary-game-label">{selectedGame.name}</span>
                  <strong>{packageLabel}</strong>
                  <small>Player ID · {playerId || "Not provided"}</small>
                </div>
              </div>

              <div className="checkout-breakdown">
                <div>
                  <span>Package price</span>
                  <span>{priceLabel}</span>
                </div>
                <div>
                  <span>Payment method</span>
                  <span>{selectedPayment?.name ?? "Unavailable"}</span>
                </div>
              </div>

              <div className="checkout-total">
                <div>
                  <span>Total</span>
                  <small>No hidden charges</small>
                </div>
                <strong>{finalPayableLabel}</strong>
              </div>

              <Button
                className="checkout-summary-cta"
                onClick={handleCompleteCheckout}
                disabled={
                  processingOrder ||
                  completedOrder !== null ||
                  missingDetails ||
                  !uid ||
                  !paymentMethodActive ||
                  (paymentMethod === "wallet" &&
                    (walletBalanceQuery.isLoading ||
                      walletBalanceQuery.isError ||
                      walletBalanceQuery.data === undefined ||
                      walletBalanceQuery.data < pricePkr)) ||
                  (isEzcash && (!paymentConfigured || !proofFile))
                }
              >
                {processingOrder ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" /> Processing
                  </>
                ) : (
                  <>
                    {!ready
                      ? "Checking account…"
                      : !uid
                        ? "Sign in to continue"
                        : isEzcash
                          ? "Create order & submit proof"
                          : `Pay ${priceLabel} from wallet`}{" "}
                    <ArrowRight size={16} />
                  </>
                )}
              </Button>

              {missingDetails && (
                <p className="checkout-missing">
                  {!playerId
                    ? "Go back and enter a Player ID first."
                    : "No package selected — go back and choose one."}
                </p>
              )}

              {ready && !uid && !missingDetails && (
                <p className="checkout-signin-hint">
                  Sign in from the header to complete this order.
                </p>
              )}

              <div className="checkout-assurance">
                <span>
                  <ShieldCheck size={13} /> Order status is tracked in your account
                </span>
                <span>
                  <CheckCircle2 size={13} /> Price read from live catalog
                </span>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Receipt dialog ── */}
      <Dialog
        open={Boolean(completedOrder) || (isNexauraCheckout && processingOrder)}
        onOpenChange={(open) => {
          if (!open && !proofUploading && !isAwaitingNexaura) setCompletedOrder(null);
        }}
      >
        <DialogContent
          className={`checkout-receipt-dialog${isAwaitingNexaura ? " is-waiting" : ""}`}
          aria-busy={isAwaitingNexaura || undefined}
          onEscapeKeyDown={(event) => {
            if (isAwaitingNexaura) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isAwaitingNexaura) event.preventDefault();
          }}
        >
          {isAwaitingNexaura ? (
            <NexauraWaitSheet
              stage={completedOrder ? "processing" : "paying"}
              summary={waitSummary}
              status={completedOrder?.nexauraStatus}
              note={completedOrder?.nexauraNote}
              providerOrderId={completedOrder?.nexauraProviderOrderId}
              pollError={completedOrder?.nexauraPollError}
              elapsedSeconds={nexauraWaitSeconds}
              copied={copiedId}
              onCopyOrderId={() => void handleCopyOrderId()}
            />
          ) : completedOrder ? (
            <div className="receipt-sheet">
              <div className="receipt-sheet-top">
                <div className={`receipt-check is-${receiptTone}`} aria-hidden="true">
                  {receiptTone === "error" ? (
                    <X size={26} strokeWidth={2.6} />
                  ) : receiptTone === "refund" ? (
                    <RotateCcw size={24} strokeWidth={2.4} />
                  ) : receiptTone === "warning" ? (
                    <AlertTriangle size={24} strokeWidth={2.4} />
                  ) : (
                    <Check size={28} strokeWidth={2.6} />
                  )}
                </div>
                <span className="eyebrow">{receiptEyebrow}</span>
                <DialogTitle className="receipt-title">{receiptTitle}</DialogTitle>
                <DialogDescription className="receipt-lead">
                  {completedOrder.paymentStatus === "proof_submitted"
                    ? "Payment proof was submitted and is awaiting administrator review."
                    : proofUploadError
                      ? "Your order was created, but payment proof was not saved. Retry the upload to submit it."
                      : completedOrder.paymentStatus === "paid"
                        ? receiptTone === "success"
                          ? "Nexaura confirms that your top-up is complete."
                          : receiptTone === "error"
                            ? "Nexaura could not complete this top-up. Contact support with your order number."
                            : receiptTone === "refund"
                              ? "Nexaura reports that this provider order was refunded. Contact support about your store payment."
                              : completedOrder.nexauraMessage
                                ? `Your payment was received, but automatic top-up needs attention: ${completedOrder.nexauraMessage}`
                                : "Your wallet payment was received. Your order is now processing."
                        : "Your order was created. Payment is not confirmed until an administrator reviews your proof."}
                </DialogDescription>
                <p className="form-hint">
                  Confirmation email: {completedOrder.emailNotificationSent ? "sent" : "not sent"}
                </p>
                {completedOrder.nexauraStatus && (
                  <p className="form-hint">
                    Nexaura: {receiptLabel}
                    {completedOrder.nexauraNote ? ` · ${completedOrder.nexauraNote}` : ""}
                  </p>
                )}
              </div>

              <div className="receipt-ticket">
                <div className="receipt-ticket-credit">
                  <img src={completedOrder.gameImage} alt="" />
                  <div>
                    <span className="receipt-game-name">{completedOrder.gameName}</span>
                    <strong>{completedOrder.packName}</strong>
                  </div>
                  <span className={`receipt-status is-${receiptTone}`}>
                    {completedOrder.paymentStatus === "paid"
                      ? receiptTone === "success"
                        ? "Complete"
                        : receiptTone === "error"
                          ? "Failed"
                          : receiptTone === "refund"
                            ? "Refunded"
                            : "Paid"
                      : completedOrder.paymentStatus === "proof_submitted"
                        ? "Review"
                        : "Pending"}
                  </span>
                </div>
                <div className="receipt-perforation" aria-hidden="true">
                  <span />
                  <span />
                </div>
                <dl className="receipt-meta">
                  <div>
                    <dt>Player ID</dt>
                    <dd>{completedOrder.playerId}</dd>
                  </div>
                  <div>
                    <dt>Payment</dt>
                    <dd>
                      {completedOrder.paymentMethod === "ezcash"
                        ? completedOrder.paymentStatus === "proof_submitted"
                          ? "Proof submitted · awaiting review"
                          : "Proof not submitted"
                        : completedOrder.paymentStatus === "paid"
                          ? receiptTone === "success"
                            ? "Paid from wallet · top-up complete"
                            : receiptTone === "error"
                              ? "Paid from wallet · top-up failed"
                              : receiptTone === "refund"
                                ? "Paid from wallet · provider refunded"
                                : "Paid from wallet · check order status"
                          : "Unpaid"}
                    </dd>
                  </div>
                  <div>
                    <dt>Order ID</dt>
                    <dd>
                      {completedOrder.orderId}
                      <button type="button" onClick={handleCopyOrderId} aria-label="Copy order ID">
                        {copiedId ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                    </dd>
                  </div>
                </dl>
                <div className="receipt-total-bar">
                  <span>Order total</span>
                  <strong>{completedOrder.amount}</strong>
                </div>
              </div>

              {proofUploadError && (
                <p className="admin-error-banner" role="alert">
                  {proofUploadError}
                </p>
              )}
              {proofUploading && (
                <div className="receipt-upload-progress">
                  <div className="receipt-upload-progress-header">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Uploading payment proof…</span>
                  </div>
                  <Progress value={proofUploadProgress} className="receipt-progress-bar" />
                  <span className="receipt-progress-text">{proofUploadProgress}%</span>
                </div>
              )}
              <div className="receipt-actions">
                {(receiptTone === "error" ||
                  receiptTone === "refund" ||
                  receiptTone === "warning") && (
                  <Button variant="outline" asChild>
                    <Link to="/support">Contact support</Link>
                  </Button>
                )}
                {proofUploadError && proofFile && (
                  <Button
                    variant="outline"
                    disabled={proofUploading}
                    onClick={() => void uploadProof(completedOrder.orderId, proofFile)}
                  >
                    {proofUploading ? "Uploading proof…" : "Retry proof upload"}
                  </Button>
                )}
                <Button
                  className="receipt-done"
                  disabled={proofUploading}
                  onClick={() => {
                    setCompletedOrder(null);
                    navigate({ to: "/dashboard/orders" });
                  }}
                >
                  View orders <ArrowRight size={16} />
                </Button>
                <div className="receipt-secondary">
                  <Button variant="outline" size="sm" onClick={handleCopyReceipt}>
                    <Copy size={13} /> Copy receipt
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
