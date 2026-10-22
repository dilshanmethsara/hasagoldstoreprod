import { useState, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  Check,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  UserCheck,
  Loader2,
  Gem,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CatalogGame, ProductDoc } from "@/lib/firestore-schema";
import type { PaymentMethodConfig } from "@/lib/firestore-schema";
import { DEFAULT_PAYMENT_METHODS } from "@/lib/payment-methods";
import { useAccount } from "./account-context";
import { verifyFreeFirePlayer } from "@/api/verifyFreeFirePlayer";
import { verifyBloodStrikePlayer } from "@/api/verifyBloodStrikePlayer";
import { getFirebaseAuth } from "@/lib/firebase";
import { fetchStoreSettings } from "@/lib/firestore";
import { PRODUCT_CATEGORIES } from "@/lib/firestore-schema";
import ezcashLogo from "@/assets/ezcash.jfif";
import weeklyMembershipArtwork from "@/assets/Neon Free Fire Weekly Membership Crate.png";
import weeklyLiteMembershipArtwork from "@/assets/weeklylite.png";
import diamondPackageArtwork from "@/assets/diamondimg-transparent.png";
import monthlyMembershipArtwork from "@/assets/monthly-transparent.png";

interface GameTopUpOrderProps {
  game: CatalogGame;
  products: ProductDoc[] | undefined;
  productsLoading: boolean;
  productsError: boolean;
  retryProducts: () => void;
}

function usePaymentMethods(): {
  methods: PaymentMethodConfig[];
  loading: boolean;
  error: string | null;
} {
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await fetchStoreSettings();
        if (!mounted) return;
        setMethods(s?.paymentMethods ?? DEFAULT_PAYMENT_METHODS.map((method) => ({ ...method })));
      } catch (cause) {
        if (!mounted) return;
        setError(cause instanceof Error ? cause.message : "Payment methods could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return { methods, loading, error };
}

export function GameTopUpOrder({
  game,
  products,
  productsLoading,
  productsError,
  retryProducts,
}: GameTopUpOrderProps) {
  const navigate = useNavigate();
  const { user } = useAccount();

  const servers = game.serverOptions;
  const [server, setServer] = useState<string>(servers[0] ?? "");

  const [playerId, setPlayerId] = useState("");
  const [validatedPlayerId, setValidatedPlayerId] = useState<string | null>(null);
  const [freeFireLookup, setFreeFireLookup] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "verified"; name: string; region: string; source: "live" | "saved" }
    | { status: "unavailable" }
    | { status: "error"; message: string }
  >({ status: "idle" });
  const lookupAttempt = useRef(0);
  const isFreeFire = game.id === "free-fire";
  const isBloodStrike = game.id === "blood-strike";
  const supportsPlayerLookup = isFreeFire || isBloodStrike;

  const [helpOpen, setHelpOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("wallet");

  // Prefer Firestore-configured payment methods when available (admin can pause/edit them).
  const {
    methods: paymentMethods,
    loading: paymentMethodsLoading,
    error: paymentMethodsError,
  } = usePaymentMethods();

  // Packages now come from Firestore (`products`). Default to the "popular"
  // tier (index 2) like the original UI, then the first available package.
  const selectedProduct =
    products?.find((p) => p.id === selectedProductId) ?? products?.[2] ?? products?.[0];
  const productCategoryGroups = PRODUCT_CATEGORIES.map((category) => ({
    ...category,
    products: products?.filter((product) => (product.category ?? "diamonds") === category.id) ?? [],
  })).filter((category) => category.products.length > 0);
  const pricePkrLabel = selectedProduct ? `Rs. ${selectedProduct.pricePkr.toLocaleString()}` : "—";

  useEffect(() => {
    lookupAttempt.current += 1;
    setPlayerId("");
    setValidatedPlayerId(null);
    setFreeFireLookup({ status: "idle" });
    setSelectedProductId(null);
    setServer(servers[0] ?? "");
  }, [game.id, servers]);

  async function handleVerify() {
    const trimmed = playerId.trim();
    if (!trimmed) {
      toast.error("Player ID required", {
        description: "Enter your UID first.",
      });
      return;
    }
    if (supportsPlayerLookup) {
      if (isFreeFire && !/^\d{6,15}$/.test(trimmed)) {
        setFreeFireLookup({
          status: "error",
          message: "Free Fire Player IDs must contain 6 to 15 digits.",
        });
        setValidatedPlayerId(null);
        return;
      }
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser) {
        setFreeFireLookup({
          status: "error",
          message: `Sign in before verifying a ${game.name} Player ID.`,
        });
        return;
      }
      setFreeFireLookup({ status: "loading" });
      setValidatedPlayerId(null);
      const attempt = ++lookupAttempt.current;
      try {
        const idToken = await currentUser.getIdToken();
        const result = isFreeFire
          ? await verifyFreeFirePlayer({ data: { idToken, playerUid: trimmed } })
          : await verifyBloodStrikePlayer({
              data: {
                idToken,
                playerUid: trimmed,
                ...(server ? { server } : {}),
              },
            });
        if (lookupAttempt.current !== attempt) return;
        if (result.status === "unavailable") {
          setFreeFireLookup({ status: "unavailable" });
          setValidatedPlayerId(trimmed);
          return;
        }
        // Only Free Fire reports where the name came from; Blood Strike does not.
        const sourceValue =
          "source" in result ? (result as { source?: unknown }).source : undefined;
        setFreeFireLookup({
          status: "verified",
          name: result.name,
          region: result.region,
          source: sourceValue === "saved" ? "saved" : "live",
        });
        setValidatedPlayerId(trimmed);
      } catch (cause) {
        if (lookupAttempt.current !== attempt) return;
        const message =
          cause instanceof Error ? cause.message : `${game.name} Player ID could not be verified.`;
        setFreeFireLookup({ status: "error", message });
        toast.error("Player ID verification failed", { description: message });
      }
      return;
    }
    if (trimmed.length < 5) {
      toast.error("Player ID too short", {
        description: "Use at least 5 characters, then try verify again.",
      });
      return;
    }

    setValidatedPlayerId(trimmed);
    toast.info("Format accepted only. This Player ID has not been verified with game servers.");
  }

  const activePaymentMethods = paymentMethods.filter((method) => method.active);
  const selectedPayment =
    activePaymentMethods.find((method) => method.id === paymentMethod) ?? activePaymentMethods[0];

  useEffect(() => {
    if (!paymentMethodsLoading && selectedPayment && selectedPayment.id !== paymentMethod) {
      setPaymentMethod(selectedPayment.id);
    }
  }, [paymentMethod, paymentMethodsLoading, selectedPayment]);

  function handlePlaceOrder() {
    if (paymentMethodsError) {
      toast.error("Payment methods unavailable", { description: paymentMethodsError });
      return;
    }
    if (paymentMethodsLoading || !selectedPayment) {
      toast.error("No payment method is currently available.");
      return;
    }
    if (!selectedProduct) {
      toast.error("Select a package", {
        description: "Choose a top-up package to continue.",
      });
      return;
    }
    const trimmed = playerId.trim();
    if (!trimmed || (isFreeFire ? !/^\d{6,15}$/.test(trimmed) : trimmed.length < 5)) {
      toast.error("Player ID required", {
        description: isFreeFire
          ? "Enter a 6 to 15 digit Free Fire Player ID."
          : "Enter a valid UID to create an unpaid order.",
      });
      const inputEl = document.getElementById("player-id-input");
      inputEl?.focus();
      inputEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (isBloodStrike && validatedPlayerId !== trimmed) {
      toast.error("Verify your Blood Strike Player ID first.");
      return;
    }
    navigate({
      to: "/checkout",
      search: {
        game: game.id,
        productId: selectedProduct.id,
        uid: trimmed,
        server,
        method: selectedPayment.id,
      },
    });
  }

  return (
    <div className="topup-order-container">
      <div className="topup-info-strip">
        <div className="topup-info-item">
          {freeFireLookup.status === "verified" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>
            {supportsPlayerLookup
              ? freeFireLookup.status === "verified"
                ? `${game.name} player verified`
                : freeFireLookup.status === "unavailable"
                  ? "Lookup temporarily unavailable"
                  : `Verify ${game.name} Player ID`
              : "Player ID is not verified"}
          </span>
        </div>
        <div className="topup-info-item">
          <CheckCircle2 size={16} />
          <span>Live catalog packages</span>
        </div>
        <div className="topup-info-item">
          <AlertCircle size={16} />
          <span>eZ Cash proof is reviewed manually</span>
        </div>
      </div>

      <div className="topup-grid-layout">
        <div className="topup-steps-flow">
          <section className="topup-step-box" aria-labelledby="step1-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">1</span>
                <div>
                  <h2 id="step1-title">Player ID</h2>
                  <p>
                    {isFreeFire
                      ? "Enter your Free Fire UID. Live name lookup is optional; double-check the ID before ordering."
                      : isBloodStrike
                        ? "Enter your Blood Strike Player ID and verify it with Shop2Topup before continuing."
                        : `Enter your ${game.name} UID. This game does not support live Player ID lookup yet.`}
                  </p>
                </div>
              </div>
              <button type="button" className="id-guide-btn" onClick={() => setHelpOpen(true)}>
                <HelpCircle size={14} /> Where is my ID?
              </button>
            </div>

            <div className="player-id-section">
              <div className="player-id-input-wrapper">
                <div
                  className={`id-input-group${
                    freeFireLookup.status === "loading" ? " is-loading" : ""
                  }${freeFireLookup.status === "error" ? " is-error" : ""}${
                    freeFireLookup.status === "verified" ? " is-verified" : ""
                  }`}
                >
                  <span className="id-icon-prefix">
                    {freeFireLookup.status === "loading" ? (
                      <Loader2 className="loading-spin" size={18} />
                    ) : validatedPlayerId ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <UserCheck size={18} />
                    )}
                  </span>
                  <input
                    id="player-id-input"
                    type="text"
                    placeholder={`${game.name} UID / Character ID`}
                    inputMode={isFreeFire ? "numeric" : undefined}
                    maxLength={isFreeFire ? 15 : undefined}
                    value={playerId}
                    onChange={(e) => {
                      lookupAttempt.current += 1;
                      setPlayerId(e.target.value);
                      setValidatedPlayerId(null);
                      setFreeFireLookup({ status: "idle" });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleVerify();
                      }
                    }}
                  />
                  <div className="id-verify-action">
                    <Button
                      size="sm"
                      onClick={() => void handleVerify()}
                      disabled={!playerId.trim() || freeFireLookup.status === "loading"}
                    >
                      {freeFireLookup.status === "loading" ? (
                        <>
                          <Loader2 className="loading-spin" size={14} /> Looking up…
                        </>
                      ) : supportsPlayerLookup ? (
                        <>
                          <Check size={14} /> Verify Player ID
                        </>
                      ) : validatedPlayerId ? (
                        <>
                          <Check size={14} /> Re-check format
                        </>
                      ) : (
                        <>
                          <Check size={14} /> Check format
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {servers.length > 0 ? (
                  <div className="server-select-wrapper">
                    <label className="server-select-label">Server</label>
                    <div className="server-select-box">
                      <select
                        value={server}
                        onChange={(e) => {
                          lookupAttempt.current += 1;
                          setServer(e.target.value);
                          if (isBloodStrike) {
                            setValidatedPlayerId(null);
                            setFreeFireLookup({ status: "idle" });
                          }
                        }}
                        aria-label="Select game server"
                      >
                        {servers.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="server-info-box">
                    <AlertCircle size={16} className="server-info-icon" />
                    <div className="server-info-content">
                      <span className="server-info-title">Server not required</span>
                      <span className="server-info-desc">
                        Server choices are not configured for this game. No server will be recorded.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {freeFireLookup.status === "verified" && (
                <div className="player-lookup-result is-success" role="status">
                  <div className="lookup-result-icon">
                    <CheckCircle2 size={20} />
                  </div>
                  <div className="lookup-result-content">
                    <span className="lookup-result-name">{freeFireLookup.name}</span>
                    <span className="lookup-result-meta">
                      {game.name} player verified
                      {freeFireLookup.region ? ` · Region ${freeFireLookup.region}` : ""}
                      {freeFireLookup.source === "saved" ? " · Name from saved records" : ""}
                    </span>
                  </div>
                </div>
              )}
              {freeFireLookup.status === "unavailable" && (
                <div className="player-lookup-result is-warning" role="status">
                  <div className="lookup-result-icon">
                    <AlertCircle size={20} />
                  </div>
                  <div className="lookup-result-content">
                    <span className="lookup-result-name">Lookup temporarily unavailable</span>
                    <span className="lookup-result-meta">
                      The player lookup service could not check this ID right now. You may continue,
                      but double-check your Player ID carefully.
                    </span>
                  </div>
                </div>
              )}
              {freeFireLookup.status === "error" && (
                <div className="player-lookup-error" role="alert">
                  <AlertCircle size={16} />
                  <span>{freeFireLookup.message}</span>
                </div>
              )}

              <div className="id-support-row">
                {user?.players?.[game.id] && (
                  <div className="id-demo-chips">
                    <span className="id-chip-label">Saved Player ID</span>
                    <button
                      type="button"
                      className="id-chip-btn"
                      onClick={() => {
                        const saved = user.players?.[game.id];
                        if (saved) {
                          setPlayerId(saved);
                          setValidatedPlayerId(null);
                          setFreeFireLookup({ status: "idle" });
                        }
                      }}
                    >
                      Saved · {user.players[game.id]}
                    </button>
                  </div>
                )}
              </div>

              {validatedPlayerId && !supportsPlayerLookup && (
                <p className="form-hint" role="status">
                  Format accepted only; the Player ID has not been checked with the game publisher.
                </p>
              )}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step2-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">2</span>
                <div>
                  <h2 id="step2-title">Choose your package</h2>
                  <p>Choose a package from the current store catalog.</p>
                </div>
              </div>
            </div>

            <div className="topup-package-content">
              {productsLoading ? (
                <p className="form-hint" style={{ gridColumn: "1 / -1" }}>
                  Loading packages…
                </p>
              ) : productsError ? (
                <div className="empty-state" role="alert" style={{ gridColumn: "1 / -1" }}>
                  <p>Packages could not be loaded.</p>
                  <Button variant="outline" onClick={retryProducts}>
                    Try again
                  </Button>
                </div>
              ) : !products || products.length === 0 ? (
                <p className="form-hint" style={{ gridColumn: "1 / -1" }}>
                  No packages available for this game yet.
                </p>
              ) : (
                <div className="topup-package-categories">
                  {productCategoryGroups.map((category) => (
                    <section className="topup-package-category" key={category.id}>
                      <header className="topup-package-category-head">
                        <h3>{category.label}</h3>
                        <span className="topup-package-category-count">
                          {category.products.length}{" "}
                          {category.products.length === 1 ? "package" : "packages"}
                        </span>
                      </header>
                      <div className="topup-package-grid">
                        {category.products.map((product) => {
                          const isSelected = selectedProduct?.id === product.id;
                          const isWeeklyMembership =
                            game.id === "free-fire" &&
                            category.id === "memberships" &&
                            /weekly/i.test(`${product.name} ${product.id}`) &&
                            !/lite/i.test(`${product.name} ${product.id}`);
                          const isWeeklyLiteMembership =
                            game.id === "free-fire" &&
                            category.id === "memberships" &&
                            /weekly[\s_-]*lite|lite[\s_-]*weekly/i.test(
                              `${product.name} ${product.id}`,
                            );
                          const isMonthlyMembership =
                            game.id === "free-fire" &&
                            category.id === "memberships" &&
                            /monthly|month/i.test(`${product.name} ${product.id}`);
                          const isDiamondPackage = category.id === "diamonds";
                          const hasArtwork =
                            isWeeklyMembership ||
                            isWeeklyLiteMembership ||
                            isMonthlyMembership ||
                            isDiamondPackage;
                          return (
                            <button
                              key={product.id}
                              type="button"
                              className={`topup-package-card ${isSelected ? "is-selected" : ""}`}
                              onClick={() => setSelectedProductId(product.id)}
                              aria-pressed={isSelected}
                            >
                              <span className="package-card-media">
                                <span className="package-card-badges">
                                  {product.isPopular && (
                                    <span className="package-badge-tag is-popular">Popular</span>
                                  )}
                                  {product.isBestValue && (
                                    <span className="package-badge-tag is-value">Best value</span>
                                  )}
                                  {product.isVip && (
                                    <span className="package-badge-tag is-vip">Mega pack</span>
                                  )}
                                </span>
                                {hasArtwork ? (
                                  <img
                                    className="topup-package-artwork"
                                    src={
                                      isWeeklyLiteMembership
                                        ? weeklyLiteMembershipArtwork
                                        : isWeeklyMembership
                                          ? weeklyMembershipArtwork
                                          : isMonthlyMembership
                                            ? monthlyMembershipArtwork
                                            : diamondPackageArtwork
                                    }
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                ) : (
                                  <Gem
                                    className="package-card-placeholder"
                                    size={30}
                                    aria-hidden="true"
                                  />
                                )}
                                <span className="package-select-indicator" aria-hidden="true">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              </span>
                              <span className="package-card-body">
                                <span className="package-amount-title">
                                  {product.name ||
                                    `${product.amount.toLocaleString()} ${product.unitLabel || game.currency}`}
                                </span>
                              </span>
                              <span className="package-price-row">
                                <span className="package-price-main">
                                  Rs. {product.pricePkr.toLocaleString()}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step3-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">3</span>
                <div>
                  <h2 id="step3-title">Payment method</h2>
                  <p>Select how you would like to continue at checkout.</p>
                </div>
              </div>
            </div>

            <div className="payment-selector-grid">
              {paymentMethodsLoading ? (
                <p role="status">Loading available payment methods…</p>
              ) : paymentMethodsError ? (
                <p className="admin-error-banner" role="alert">
                  {paymentMethodsError}
                </p>
              ) : activePaymentMethods.length === 0 ? (
                <p role="status">No payment methods are currently available.</p>
              ) : (
                activePaymentMethods.map((method) => {
                  const isSelected = paymentMethod === method.id;
                  return (
                    <button
                      key={method.id}
                      type="button"
                      className={`payment-method-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setPaymentMethod(method.id)}
                      aria-pressed={isSelected}
                    >
                      <div className="payment-card-left">
                        {method.id === "ezcash" ? (
                          <div className="payment-logo-wrapper">
                            <img src={ezcashLogo} alt="eZ Cash" className="payment-logo" />
                          </div>
                        ) : (
                          <div className="payment-brand-badge">{method.short}</div>
                        )}
                        <div>
                          <div className="payment-name">{method.name}</div>
                          <div className="payment-sub">{method.sub}</div>
                        </div>
                      </div>
                      <div className="payment-check-circle">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="topup-step-box" aria-labelledby="step4-title">
            <div className="topup-step-header">
              <div className="topup-step-title">
                <span className="topup-step-number">4</span>
                <div>
                  <h2 id="step4-title">Receipt contact</h2>
                  <p>Order updates are not sent by email or WhatsApp at this time.</p>
                </div>
              </div>
            </div>

            <div className="topup-receipt-note">
              <span className="topup-receipt-icon" aria-hidden="true">
                <CheckCircle2 size={17} />
              </span>
              <div className="topup-receipt-copy">
                <strong>No email or WhatsApp updates</strong>
                <span>
                  Track payment review and delivery from Dashboard → Orders after checkout.
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="topup-summary-sidebar">
          <div className="order-summary-card">
            <div className="summary-header">
              <h3>Order summary</h3>
              <p>Review details before checkout</p>
            </div>

            <div className="summary-items-list">
              <div className="summary-row">
                <span className="summary-row-label">Game</span>
                <span className="summary-row-val">{game.name}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Player ID</span>
                <span className="summary-row-val">
                  <span className="summary-muted">{playerId || "Not entered"}</span>
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Server</span>
                <span className="summary-row-val">{server}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Package</span>
                <span className="summary-row-val">
                  {selectedProduct
                    ? selectedProduct.name ||
                      `${selectedProduct.amount.toLocaleString()} ${selectedProduct.unitLabel || game.currency}`
                    : "—"}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row-label">Payment</span>
                <span className="summary-row-val">{selectedPayment?.name ?? "Unavailable"}</span>
              </div>
            </div>

            <div className="summary-total-divider">
              <div className="summary-total-row">
                <div>
                  <div className="summary-total-label">Total</div>
                  <div className="summary-total-note">Catalog price</div>
                </div>
                <div className="summary-total-amount">{pricePkrLabel}</div>
              </div>

              <Button
                className="instant-order-cta-btn"
                onClick={handlePlaceOrder}
                disabled={paymentMethodsLoading || Boolean(paymentMethodsError) || !selectedPayment}
              >
                Continue to checkout
                <ArrowRight size={16} />
              </Button>

              {(!validatedPlayerId || freeFireLookup.status === "error") &&
                freeFireLookup.status !== "unavailable" && (
                  <div className="id-required-warning">
                    <AlertCircle size={15} />
                    <span>
                      {isFreeFire
                        ? "This Player ID has not been verified. Double-check it carefully before continuing."
                        : isBloodStrike
                          ? "Verify the Blood Strike Player ID before continuing."
                          : "This game does not support live ID lookup. Check the Player ID in-game before continuing."}
                    </span>
                  </div>
                )}

              <div className="summary-assurance">
                <span>
                  <ShieldCheck size={13} /> Order remains unpaid
                </span>
                <span>
                  <AlertCircle size={13} /> Payment and delivery unavailable
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="topup-help-dialog">
          <DialogTitle>
            <HelpCircle size={18} />
            Finding your {game.name} Player ID
          </DialogTitle>
          <DialogDescription>Three quick steps inside the game app:</DialogDescription>

          <ol className="topup-help-steps">
            <li>
              <strong>Open your profile</strong>
              <p>Tap your avatar in the lobby to open the profile screen.</p>
            </li>
            <li>
              <strong>Locate the Player ID</strong>
              <p>Your Player ID is shown in your in-game profile. The exact steps vary by game.</p>
            </li>
            <li>
              <strong>Copy the ID</strong>
              <p>Use the copy icon next to the ID, then paste it into the field above.</p>
            </li>
          </ol>

          <div className="topup-help-note">
            <ShieldCheck size={16} />
            <span>Never share your password or OTP. Only your public Player ID is needed.</span>
          </div>

          <Button onClick={() => setHelpOpen(false)}>
            Got it <Check size={16} />
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
