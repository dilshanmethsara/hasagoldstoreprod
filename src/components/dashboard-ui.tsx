import { useEffect, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutGrid,
  Receipt,
  IdCard,
  Heart,
  UserRound,
  Settings,
  ArrowUpRight,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  Wallet,
  ChevronDown,
  Eye,
  CalendarDays,
  Link2,
  Mail,
  BadgeCheck,
  MailWarning,
  Diamond,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Gamepad2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GameGrid, EmptyState } from "./store-ui";
import { useStore } from "./store-context";
import { useAccount } from "./account-context";
import { useAdminSession } from "@/lib/admin-session";
import { FormField, PasswordField } from "./account-ui";
import { fetchStoreSettings, useGames, useUserOrders } from "@/lib/firestore";
import { methodRequiresProof } from "@/lib/payment-methods";
import type { OrderDoc } from "@/lib/firestore-schema";
import {
  getApiProofUploadToken,
  viewApiProof,
  submitApiProof,
  fetchApiTopupStatus,
} from "@/lib/api-client";
import { uploadPaymentProof } from "@/lib/supabase-storage";

const links = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/orders", label: "Orders", icon: Receipt },
  { to: "/dashboard/players", label: "Player IDs", icon: IdCard },
  { to: "/dashboard/favorites", label: "Favorites", icon: Heart },
  { to: "/dashboard/profile", label: "Profile", icon: UserRound },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

const mobileLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutGrid },
  { to: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { to: "/dashboard/orders", label: "Orders", icon: Receipt },
  { to: "/dashboard/players", label: "Player IDs", icon: IdCard },
  { to: "/dashboard/settings", label: "More", icon: Settings },
] as const;

export function DashboardSkeleton() {
  return (
    <div className="container dashboard-skeleton" aria-label="Loading dashboard" aria-busy="true">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-block" />
    </div>
  );
}

export function DashboardLayout() {
  const { ready, user, photoUrl } = useAccount();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (ready && !user && pathname.startsWith("/dashboard"))
      navigate({ to: "/login", search: { redirect: pathname, verified: false }, replace: true });
  }, [ready, user, pathname, navigate]);
  if (!ready || !user) return <DashboardSkeleton />;
  return (
    <div className="container dashboard-layout">
      <aside className="dashboard-sidebar">
        <span className="eyebrow">YOUR SPACE</span>
        <div className="sidebar-profile">
          {photoUrl ? (
            <img
              className="user-avatar user-avatar-photo"
              src={photoUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
            <code className="dashboard-member-id">{user.memberId ?? "Assigning member ID…"}</code>
          </div>
        </div>
        <nav aria-label="Dashboard navigation">
          {links.map((item) => (
            <Button key={item.to} asChild variant="ghost">
              <Link
                to={item.to}
                activeOptions={{ exact: true }}
                activeProps={{ className: "is-active", "aria-current": "page" }}
                viewTransition
              >
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </Button>
          ))}
          <Button asChild variant="ghost">
            <Link to="/support">
              <ArrowUpRight />
              <span>Support</span>
            </Link>
          </Button>
        </nav>
      </aside>
      <section className="dashboard-main">
        <Outlet />
      </section>
      <nav className="dashboard-tabs" aria-label="Dashboard tabs">
        {mobileLinks.map((item) => (
          <Button key={item.to} asChild variant="ghost">
            <Link
              to={item.to}
              activeOptions={{ exact: true }}
              activeProps={{ className: "is-active", "aria-current": "page" }}
              viewTransition
            >
              <item.icon />
              <span>{item.label}</span>
            </Link>
          </Button>
        ))}
      </nav>
    </div>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div className="dashboard-heading">
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

export function DashboardOverview() {
  const { user, uid } = useAccount();
  const { favorites } = useStore();
  // Resolved server-side from ADMIN_UIDS, so the button only renders for
  // accounts that actually hold admin rights.
  const { data: adminSession } = useAdminSession(uid);
  const isAdminAccount = Boolean(adminSession?.isAdmin);
  const {
    data: catalog = [],
    isLoading: catalogLoading,
    error: catalogError,
    refetch: retryCatalog,
  } = useGames();
  const favoriteGames = catalog.filter((game) => favorites.includes(game.id));
  const recent = (user?.recent || []).flatMap((id) => {
    const game = catalog.find((item) => item.id === id);
    return game ? [game] : [];
  });
  return (
    <>
      <Heading
        title={`Welcome, ${user?.name || "player"}.`}
        description="A little space for the games you love."
      />
      <div className="quick-actions">
        <Button asChild>
          <Link to="/games">
            Explore games <ArrowUpRight />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard/players">
            <IdCard />
            Player IDs
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/support">
            Support <ArrowUpRight />
          </Link>
        </Button>
        {isAdminAccount && (
          <Button asChild variant="outline" className="admin-panel-entry">
            <a href="/admin">
              <ShieldCheck />
              Admin panel
              <ArrowUpRight />
            </a>
          </Button>
        )}
      </div>
      <section className="dashboard-section">
        <h2>Favorite games</h2>
        {catalogLoading ? (
          <div aria-busy="true">Loading games…</div>
        ) : catalogError ? (
          <div className="dashboard-empty" role="alert">
            <p>Games could not be loaded.</p>
            <Button variant="outline" onClick={() => void retryCatalog()}>
              Try again
            </Button>
          </div>
        ) : favoriteGames.length ? (
          <GameGrid items={favoriteGames} />
        ) : (
          <EmptyState favorite />
        )}
      </section>
      <section className="dashboard-section">
        <h2>Recently viewed</h2>
        {catalogLoading ? (
          <div aria-busy="true">Loading games…</div>
        ) : catalogError ? (
          <div className="dashboard-empty" role="alert">
            <p>Recently viewed games could not be loaded.</p>
            <Button variant="outline" onClick={() => void retryCatalog()}>
              Try again
            </Button>
          </div>
        ) : recent.length ? (
          <GameGrid items={recent} />
        ) : (
          <div className="dashboard-empty">
            <LayoutGrid />
            <h3>No games viewed yet</h3>
            <p>Your recently visited game pages will appear here.</p>
            <Button asChild variant="outline">
              <Link to="/games">
                Browse games <ArrowUpRight />
              </Link>
            </Button>
          </div>
        )}
      </section>
    </>
  );
}

export function DashboardOrders() {
  const { uid } = useAccount();
  const { data: storeSettings } = useQuery({
    queryKey: ["storeSettings"],
    queryFn: fetchStoreSettings,
    staleTime: 0,
  });
  const paymentMethods = storeSettings?.paymentMethods ?? [];
  /**
   * Whether an order's payment method asks the customer for a receipt.
   * Uses the admin's per-method flag; a method that is missing from settings
   * (or still loading) keeps the historical behaviour of expecting a receipt.
   */
  function methodNeedsProof(methodId?: string | null): boolean {
    if (!methodId || methodId === "wallet") return false;
    const configured = paymentMethods.find((method) => method.id === methodId);
    return configured ? methodRequiresProof(configured) : true;
  }
  const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);
  const [orderFilter, setOrderFilter] = useState<
    "all" | "completed" | "processing" | "action_needed"
  >("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [proofSubmittedOrderIds, setProofSubmittedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [replacementProof, setReplacementProof] = useState<File | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [proofViewLoading, setProofViewLoading] = useState(false);
  const {
    data: ordersData,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: retryOrders,
    refetch,
  } = useUserOrders(uid);
  const firestoreOrders = ordersData?.orders ?? [];
  const [nexauraStatuses, setNexauraStatuses] = useState<
    Record<
      string,
      {
        status: string;
        note: string | null;
        issueType?: "stock_issue" | "system_issue" | null | undefined;
        providerOrderId?: string | null | undefined;
        error?: string | undefined;
      }
    >
  >({});
  const activeNexauraOrderIds = firestoreOrders
    .filter((order) => {
      if (order.gameSlug !== "free-fire" || order.paymentStatus !== "paid") return false;
      const currentLive = nexauraStatuses[order.orderId]?.status ?? order.status ?? "";
      return !["completed", "failed", "refunded"].includes(currentLive.toLowerCase());
    })
    .map((order) => order.orderId);
  const activeNexauraOrderIdsKey = activeNexauraOrderIds.join(",");

  useEffect(() => {
    if (!activeNexauraOrderIdsKey) return;
    const orderIds = activeNexauraOrderIdsKey.split(",");
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const results = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const { fetchApiTopupStatus } = await import("@/lib/api-client");
            const result = await fetchApiTopupStatus(orderId);
            return { orderId, result };
          } catch (cause) {
            return {
              orderId,
              result: null as null,
              error:
                cause instanceof Error
                  ? cause.message
                  : "Nexaura order status could not be checked.",
            };
          }
        }),
      );
      if (!active) return;
      setNexauraStatuses((current) => ({
        ...current,
        ...Object.fromEntries(
          results.map(({ orderId, result, error }) => [
            orderId,
            result
              ? {
                  status: result.status,
                  note: result.note,
                  issueType: result.issueType ?? null,
                  providerOrderId: result.orderId ?? null,
                }
              : {
                  status: current[orderId]?.status ?? "processing",
                  note: current[orderId]?.note ?? null,
                  issueType: current[orderId]?.issueType ?? null,
                  ...(error ? { error } : {}),
                },
          ]),
        ),
      }));
      // If any order reached a terminal status or completed, refetch the orders list
      // so the order card shows the updated status from Firestore.
      const anyTerminal = results.some(
        ({ result }) => result?.terminal === true || result?.status === "completed",
      );
      if (anyTerminal) void refetch();
      if (
        results.some(({ result }) => !result || (!result.terminal && result.status !== "completed"))
      ) {
        timeout = setTimeout(() => void poll(), 4000);
      }
    };
    timeout = setTimeout(() => void poll(), 4000);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [activeNexauraOrderIdsKey]);

  const statusTone = (status: string) => {
    const s = status.toLowerCase();
    if (s === "completed" || s === "delivered" || s === "paid" || s === "proof_submitted") {
      return "is-success";
    }
    if (s === "failed" || s === "cancelled" || s === "refunded") {
      return "is-danger";
    }
    return "is-pending";
  };
  const statusLabel = (status: string) =>
    status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const getDisplayOrderStatus = (order: OrderDoc, providerStatus?: string) => {
    const nexauraStatus = providerStatus ?? order.nexauraStatus;
    if (order.gameSlug === "free-fire") {
      if (nexauraStatus === "completed") return "completed";
      if (nexauraStatus === "failed" || nexauraStatus === "refunded") return "failed";
    }
    return order.status;
  };

  async function resubmitPaymentProof() {
    if (!selectedOrder || !replacementProof) return;
    setProofSubmitting(true);
    try {
      const upload = await getApiProofUploadToken(selectedOrder.orderId);
      await uploadPaymentProof(upload.signedUrl, replacementProof);
      await submitApiProof(selectedOrder.orderId, replacementProof.name);
      setProofSubmittedOrderIds((current) => new Set(current).add(selectedOrder.orderId));
      setSelectedOrder((current) =>
        current
          ? {
              ...current,
              status: "payment_review",
              paymentStatus: "proof_submitted",
              paymentProofContentType: replacementProof.type,
              paymentProofFileName: replacementProof.name,
            }
          : current,
      );
      setReplacementProof(null);
      setProofViewUrl(null);
      await refetch();
      toast.success("Payment proof submitted for review.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Payment proof could not be uploaded.");
    } finally {
      setProofSubmitting(false);
    }
  }

  async function viewPaymentProof() {
    if (!selectedOrder) return;
    setProofViewLoading(true);
    try {
      const result = await viewApiProof(selectedOrder.orderId);
      setProofViewUrl(result.url);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open payment proof.");
    } finally {
      setProofViewLoading(false);
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => {
      setCopiedId((prev) => (prev === text ? null : prev));
    }, 2000);
  };

  const filteredOrders = firestoreOrders.filter((ord) => {
    if (orderFilter === "all") return true;
    const displayStatus = getDisplayOrderStatus(ord, nexauraStatuses[ord.orderId]?.status);
    if (orderFilter === "completed") {
      return displayStatus === "completed" || ord.paymentStatus === "paid";
    }
    if (orderFilter === "processing") {
      return displayStatus === "processing" || displayStatus === "pending";
    }
    if (orderFilter === "action_needed") {
      return (
        methodNeedsProof(ord.paymentMethod) &&
        !proofSubmittedOrderIds.has(ord.orderId) &&
        ["unpaid", "failed", "proof_rejected"].includes(ord.paymentStatus)
      );
    }
    return true;
  });

  const actionNeededCount = firestoreOrders.filter(
    (ord) =>
      methodNeedsProof(ord.paymentMethod) &&
      !proofSubmittedOrderIds.has(ord.orderId) &&
      ["unpaid", "failed", "proof_rejected"].includes(ord.paymentStatus),
  ).length;

  return (
    <>
      <div className="dashboard-orders-header">
        <Heading
          title="Order History"
          description="Track, monitor top-up status, and manage proof submissions in real-time."
        />
        {firestoreOrders.length > 0 && (
          <div className="dashboard-orders-filter-bar">
            <div className="dashboard-filter-tabs">
              <button
                type="button"
                className={`dashboard-filter-tab ${orderFilter === "all" ? "is-active" : ""}`}
                onClick={() => setOrderFilter("all")}
              >
                All Orders
                <span className="tab-count">{firestoreOrders.length}</span>
              </button>
              <button
                type="button"
                className={`dashboard-filter-tab ${orderFilter === "completed" ? "is-active" : ""}`}
                onClick={() => setOrderFilter("completed")}
              >
                Completed
              </button>
              <button
                type="button"
                className={`dashboard-filter-tab ${orderFilter === "processing" ? "is-active" : ""}`}
                onClick={() => setOrderFilter("processing")}
              >
                In Progress
              </button>
              {actionNeededCount > 0 && (
                <button
                  type="button"
                  className={`dashboard-filter-tab is-alert ${orderFilter === "action_needed" ? "is-active" : ""}`}
                  onClick={() => setOrderFilter("action_needed")}
                >
                  Action Required
                  <span className="tab-count tab-alert-count">{actionNeededCount}</span>
                </button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="dashboard-refresh-btn"
              onClick={() => void retryOrders()}
            >
              <RefreshCw size={13} className={ordersLoading ? "animate-spin" : ""} />
              Refresh
            </Button>
          </div>
        )}
      </div>
      {ordersLoading ? (
        <div className="dashboard-skeleton" aria-busy="true">
          <div className="skeleton skeleton-block" style={{ height: 110, borderRadius: 14 }} />
          <div
            className="skeleton skeleton-block"
            style={{ height: 110, marginTop: 14, borderRadius: 14 }}
          />
        </div>
      ) : ordersError && !ordersData ? (
        <div className="dashboard-empty">
          <Receipt />
          <h2>Couldn't load orders</h2>
          <p>Please check your connection and try again.</p>
          <Button variant="outline" onClick={() => void retryOrders()}>
            Try again
          </Button>
        </div>
      ) : firestoreOrders && firestoreOrders.length > 0 ? (
        filteredOrders.length === 0 ? (
          <div className="dashboard-empty" style={{ padding: "40px 20px" }}>
            <Receipt />
            <h2>No orders match this filter</h2>
            <p>Try switching filter tabs or check back later.</p>
            <Button variant="outline" size="sm" onClick={() => setOrderFilter("all")}>
              Show all orders
            </Button>
          </div>
        ) : (
          <div className="dashboard-order-list">
            {filteredOrders.map((ord) => {
              const liveStatus = (
                nexauraStatuses[ord.orderId]?.status ??
                ord.status ??
                ""
              ).toLowerCase();
              const isTerminal = ["completed", "failed", "refunded"].includes(liveStatus);
              const isPolling =
                ord.gameSlug === "free-fire" && ord.paymentStatus === "paid" && !isTerminal;

              const rawNote = String(
                nexauraStatuses[ord.orderId]?.note || ord.nexauraNote || ord.nexauraLastError || "",
              );
              const isInsufficient = /insufficient|balance|credit|402/i.test(rawNote);
              const issueType =
                nexauraStatuses[ord.orderId]?.issueType ??
                (liveStatus === "completed"
                  ? null
                  : !ord.nexauraOrderId && !nexauraStatuses[ord.orderId]?.providerOrderId
                    ? isInsufficient
                      ? "stock_issue"
                      : "system_issue"
                    : null);

              const displayStatus =
                liveStatus === "completed" ? "completed" : getDisplayOrderStatus(ord, liveStatus);

              const formattedDate = ord.createdAt
                ? new Date(ord.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recent";

              const needsProof =
                methodNeedsProof(ord.paymentMethod) &&
                !proofSubmittedOrderIds.has(ord.orderId) &&
                ["unpaid", "failed", "proof_rejected"].includes(ord.paymentStatus);

              return (
                <article
                  className={`dashboard-order-card modern-order-card ${isPolling ? "is-polling" : ""} ${needsProof ? "needs-attention" : ""}`}
                  key={ord.orderId}
                >
                  <div className="modern-order-header">
                    <div className="modern-order-game">
                      <div className="modern-game-avatar">
                        {ord.gameSlug === "free-fire" ? (
                          <Diamond size={18} className="game-avatar-icon text-amber-400" />
                        ) : (
                          <Gamepad2 size={18} className="game-avatar-icon text-amber-400" />
                        )}
                      </div>
                      <div className="modern-game-meta">
                        <div className="modern-package-name-row">
                          <h4 className="modern-package-name">{ord.packageName}</h4>
                          <span className="modern-game-name">{ord.gameName}</span>
                        </div>
                        <div className="modern-order-submeta">
                          <span className="modern-date-badge">
                            <Clock size={12} />
                            {formattedDate}
                          </span>
                          <button
                            type="button"
                            className="modern-copy-badge"
                            title="Click to copy Order ID"
                            onClick={() => copyToClipboard(ord.orderId, "Order ID")}
                          >
                            <span className="id-label">ID:</span>
                            <span className="id-val">{ord.orderId.slice(0, 10)}...</span>
                            {copiedId === ord.orderId ? (
                              <Check size={11} className="copy-icon-done text-emerald-400" />
                            ) : (
                              <Copy size={11} className="copy-icon" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="modern-order-status-box">
                      <div className="modern-order-price">
                        <span className="price-curr">{ord.currency === "LKR" ? "LKR" : "Rs."}</span>
                        <span className="price-num">{ord.pricePkr.toLocaleString()}</span>
                      </div>
                      <div className="order-status-badges">
                        {liveStatus === "completed" ? (
                          <span className="order-status-badge modern-pill is-success">
                            <CheckCircle2 size={11} />
                            Top-Up Completed
                          </span>
                        ) : isPolling ? (
                          issueType === "stock_issue" ? (
                            <span className="order-polling-badge modern-pill is-stock-badge">
                              <AlertTriangle size={11} className="text-amber-400 animate-pulse" />
                              Stock Delay · Queued
                            </span>
                          ) : issueType === "system_issue" ? (
                            <span className="order-polling-badge modern-pill is-system-badge">
                              <AlertTriangle size={11} className="text-amber-400 animate-pulse" />
                              Server Delay · Queued
                            </span>
                          ) : (
                            <span className="order-polling-badge modern-pill">
                              <span className="order-polling-spinner" />
                              Top-Up In Progress
                            </span>
                          )
                        ) : (
                          <span
                            className={`order-status-badge modern-pill ${statusTone(displayStatus)}`}
                          >
                            <span className="status-indicator-dot" />
                            {statusLabel(displayStatus)}
                          </span>
                        )}
                        <span
                          className={`order-status-badge modern-pill ${statusTone(ord.paymentStatus)}`}
                        >
                          {ord.paymentStatus === "paid" ? (
                            <CheckCircle2 size={11} />
                          ) : (
                            <Clock size={11} />
                          )}
                          {statusLabel(ord.paymentStatus)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock queue / server delay notice banner */}
                  {isPolling && issueType === "stock_issue" && (
                    <div className="modern-order-alert-strip stock-alert">
                      <AlertTriangle
                        size={14}
                        className="text-amber-400 flex-shrink-0 animate-pulse"
                      />
                      <span>
                        Game diamond stock is temporarily queued · Automated delivery completing
                        shortly
                      </span>
                      <span className="live-poll-indicator" title="Live checking every 4s" />
                    </div>
                  )}
                  {isPolling && issueType === "system_issue" && (
                    <div className="modern-order-alert-strip system-alert">
                      <AlertTriangle
                        size={14}
                        className="text-amber-400 flex-shrink-0 animate-pulse"
                      />
                      <span>
                        Game server connection delay · System retrying delivery automatically
                      </span>
                      <span className="live-poll-indicator" title="Live checking every 4s" />
                    </div>
                  )}

                  <div className="modern-order-body">
                    <div className="modern-details-grid">
                      <div className="modern-detail-chip">
                        <span className="chip-label">Player ID / Account</span>
                        <div className="chip-content">
                          <span className="chip-val font-mono">{ord.playerId}</span>
                          <button
                            type="button"
                            className="chip-copy-btn"
                            title="Copy Player ID"
                            onClick={() => copyToClipboard(ord.playerId, "Player ID")}
                          >
                            {copiedId === ord.playerId ? (
                              <Check size={12} className="text-emerald-400" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="modern-detail-chip">
                        <span className="chip-label">Payment Method</span>
                        <div className="chip-content">
                          <span className="chip-val capitalize">
                            {paymentMethods.find((m) => m.id === ord.paymentMethod)?.name ||
                              (ord.paymentMethod === "ezcash"
                                ? "eZ Cash / Bank Transfer"
                                : ord.paymentMethod)}
                          </span>
                        </div>
                      </div>

                      {ord.gameSlug === "free-fire" && (
                        <div className="modern-detail-chip modern-detail-chip-full">
                          <span className="chip-label">Automated Delivery Status</span>
                          <div className="chip-content">
                            <span className="chip-val">
                              {liveStatus === "completed"
                                ? "Delivered successfully to game account"
                                : issueType === "stock_issue"
                                  ? "Stock temporarily queued · Delivery in progress"
                                  : issueType === "system_issue"
                                    ? "Game server connection delay · Delivery in progress"
                                    : isPolling
                                      ? "Dispatched to game server · Delivery in progress"
                                      : statusLabel(liveStatus)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="modern-order-footer">
                    <div className="modern-footer-left">
                      {needsProof && (
                        <div className="modern-proof-warning">
                          <AlertCircle size={14} className="text-amber-400" />
                          <span>Slip proof awaiting submission</span>
                        </div>
                      )}
                    </div>
                    <div className="modern-footer-right">
                      {needsProof && (
                        <Button
                          className="modern-submit-proof-btn"
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedOrder(ord)}
                        >
                          Submit Proof
                        </Button>
                      )}
                      <Button
                        className="modern-view-btn"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(ord)}
                      >
                        <Eye size={14} /> View Details
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <div className="dashboard-empty">
          <Receipt />
          <h2>No orders yet</h2>
          <p>You haven't placed any top-up orders yet. Choose a game to get started!</p>
          <Button asChild variant="outline">
            <Link to="/games">
              Explore game top-ups <ArrowUpRight />
            </Link>
          </Button>
        </div>
      )}
      <Dialog
        open={selectedOrder !== null}
        onOpenChange={(open) => {
          if (!open && !proofSubmitting) {
            setSelectedOrder(null);
            setReplacementProof(null);
            setProofViewUrl(null);
          }
        }}
      >
        <DialogContent className="order-detail-dialog modern-detail-dialog">
          {selectedOrder && (
            <div className="order-detail-sheet modern-detail-sheet">
              {/* ── Premium Modal Header ── */}
              <div className="modern-modal-header">
                <div className="modern-modal-header-top">
                  <div className="modern-modal-game-pill">
                    <span className="modern-modal-game-icon">
                      {selectedOrder.gameSlug === "free-fire" ? (
                        <Diamond size={13} className="text-amber-400" />
                      ) : (
                        <Gamepad2 size={13} className="text-amber-400" />
                      )}
                    </span>
                    <span>{selectedOrder.gameName}</span>
                  </div>
                  <div className="modern-modal-ref-pill">
                    <span className="ref-prefix">REF:</span>
                    <span className="ref-val font-mono">{selectedOrder.orderId}</span>
                    <button
                      type="button"
                      className="ref-copy-btn"
                      title="Copy Reference ID"
                      onClick={() => copyToClipboard(selectedOrder.orderId, "Order Reference")}
                    >
                      {copiedId === selectedOrder.orderId ? (
                        <Check size={11} className="text-emerald-400" />
                      ) : (
                        <Copy size={11} />
                      )}
                    </button>
                  </div>
                </div>

                <DialogTitle className="modern-modal-title">
                  {selectedOrder.packageName}
                </DialogTitle>
                <DialogDescription className="modern-modal-subtitle">
                  Order placed on{" "}
                  {selectedOrder.createdAt
                    ? new Date(selectedOrder.createdAt).toLocaleString([], {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "recent date"}
                </DialogDescription>

                {/* Status Badges */}
                <div className="modern-modal-badges">
                  <div
                    className={`modern-status-tag ${statusTone(getDisplayOrderStatus(selectedOrder, nexauraStatuses[selectedOrder.orderId]?.status))}`}
                  >
                    <span className="tag-dot" />
                    <span className="tag-text">
                      Delivery:{" "}
                      {statusLabel(
                        getDisplayOrderStatus(
                          selectedOrder,
                          nexauraStatuses[selectedOrder.orderId]?.status,
                        ),
                      )}
                    </span>
                  </div>
                  <div className={`modern-status-tag ${statusTone(selectedOrder.paymentStatus)}`}>
                    <span className="tag-dot" />
                    <span className="tag-text">
                      Payment: {statusLabel(selectedOrder.paymentStatus)}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Highlighted Price & Overview Card ── */}
              <div className="modern-overview-card">
                <div className="overview-metric">
                  <span className="overview-label">Amount Payable</span>
                  <div className="overview-price-wrapper">
                    <span className="overview-currency">LKR</span>
                    <span className="overview-amount">
                      {selectedOrder.pricePkr.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="overview-divider" />
                <div className="overview-metric">
                  <span className="overview-label">Package Quantity</span>
                  <span className="overview-value-highlight">
                    {selectedOrder.amount.toLocaleString()}{" "}
                    <span className="overview-unit">{selectedOrder.unitLabel}</span>
                  </span>
                </div>
                <div className="overview-divider" />
                <div className="overview-metric">
                  <span className="overview-label">Payment Method</span>
                  <span className="overview-value capitalize">
                    {paymentMethods.find((m) => m.id === selectedOrder.paymentMethod)?.name ||
                      (selectedOrder.paymentMethod === "ezcash"
                        ? "eZ Cash / Bank"
                        : (selectedOrder.paymentMethod ?? "Online"))}
                  </span>
                </div>
              </div>

              {/* ── Recipient / Player Details Card ── */}
              <div className="modern-info-card">
                <div className="modern-info-card-header">
                  <IdCard size={15} className="text-amber-400" />
                  <h4>Target Game Account</h4>
                </div>
                <div className="modern-keyval-grid">
                  <div className="modern-keyval-item">
                    <span className="keyval-label">Player ID / User ID</span>
                    <div className="keyval-value-row">
                      <span className="keyval-value font-mono font-bold text-amber-300">
                        {selectedOrder.playerId}
                      </span>
                      <button
                        type="button"
                        className="keyval-copy-btn"
                        title="Copy Player ID"
                        onClick={() => copyToClipboard(selectedOrder.playerId, "Player ID")}
                      >
                        {copiedId === selectedOrder.playerId ? (
                          <Check size={12} className="text-emerald-400" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>

                  {selectedOrder.playerName && (
                    <div className="modern-keyval-item">
                      <span className="keyval-label">In-Game Name</span>
                      <span className="keyval-value">{selectedOrder.playerName}</span>
                    </div>
                  )}
                  {selectedOrder.playerRegion && (
                    <div className="modern-keyval-item">
                      <span className="keyval-label">Account Region</span>
                      <span className="keyval-value">{selectedOrder.playerRegion}</span>
                    </div>
                  )}
                  {selectedOrder.server && (
                    <div className="modern-keyval-item">
                      <span className="keyval-label">Server / Zone</span>
                      <span className="keyval-value">{selectedOrder.server}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Nexaura Automated Top-Up Pipeline (Free Fire only) ── */}
              {selectedOrder.gameSlug === "free-fire" &&
                (() => {
                  const liveStatus = (
                    nexauraStatuses[selectedOrder.orderId]?.status ??
                    selectedOrder.status ??
                    ""
                  ).toLowerCase();
                  const rawNote = String(
                    nexauraStatuses[selectedOrder.orderId]?.note ||
                      selectedOrder.nexauraNote ||
                      selectedOrder.nexauraLastError ||
                      "",
                  );
                  const isInsufficient = /insufficient|balance|credit|402/i.test(rawNote);
                  const issueType =
                    nexauraStatuses[selectedOrder.orderId]?.issueType ??
                    (liveStatus === "completed"
                      ? null
                      : !selectedOrder.nexauraOrderId &&
                          !nexauraStatuses[selectedOrder.orderId]?.providerOrderId
                        ? isInsufficient
                          ? "stock_issue"
                          : "system_issue"
                        : null);

                  return (
                    <div className="modern-info-card">
                      <div className="modern-info-card-header">
                        {liveStatus === "completed" ? (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        ) : issueType ? (
                          <AlertTriangle size={16} className="text-amber-400 animate-pulse" />
                        ) : (
                          <RefreshCw size={16} className="text-amber-400 animate-spin" />
                        )}
                        <h4>Automated Delivery Pipeline</h4>
                      </div>

                      {issueType === "stock_issue" && (
                        <div className="modern-status-alert-box stock-box">
                          <div className="status-alert-header">
                            <AlertTriangle size={16} className="text-amber-400" />
                            <span className="status-alert-title">Game Stock Allocation Queue</span>
                          </div>
                          <p className="status-alert-desc">
                            Your wallet payment is safely verified! High volume on the game server
                            has placed this top-up in the replenishment queue. Our automated
                            dispatch will deliver your diamonds shortly — no action is required on
                            your part.
                          </p>
                          <div className="status-alert-footer">
                            <span className="live-poll-indicator" />
                            <span className="live-poll-text">
                              Auto-refreshing status live every 4 seconds
                            </span>
                          </div>
                        </div>
                      )}

                      {issueType === "system_issue" && (
                        <div className="modern-status-alert-box system-box">
                          <div className="status-alert-header">
                            <AlertTriangle size={16} className="text-amber-400" />
                            <span className="status-alert-title">Game Server Connection Delay</span>
                          </div>
                          <p className="status-alert-desc">
                            Your payment is safely confirmed! The game server is currently
                            experiencing a connection delay. Our system is continuously retrying and
                            will credit your diamonds shortly.
                          </p>
                          <div className="status-alert-footer">
                            <span className="live-poll-indicator" />
                            <span className="live-poll-text">
                              Auto-refreshing status live every 4 seconds
                            </span>
                          </div>
                        </div>
                      )}

                      {liveStatus === "completed" && (
                        <div className="modern-status-alert-box success-box">
                          <div className="status-alert-header">
                            <CheckCircle2 size={16} className="text-emerald-400" />
                            <span className="status-alert-title">Delivery Confirmed</span>
                          </div>
                          <p className="status-alert-desc">
                            Your top-up has been completed and credited directly to Player ID{" "}
                            <strong className="font-mono text-amber-300">
                              {selectedOrder.playerId}
                            </strong>
                            .
                          </p>
                        </div>
                      )}

                      <div className="modern-keyval-grid">
                        <div className="modern-keyval-item">
                          <span className="keyval-label">Fulfillment Status</span>
                          <span
                            className={`keyval-status-pill ${statusTone(liveStatus === "completed" ? "completed" : issueType ? "pending" : "processing")}`}
                          >
                            {liveStatus === "completed"
                              ? "Delivered Successfully"
                              : issueType === "stock_issue"
                                ? "Stock Queued · Resolving"
                                : issueType === "system_issue"
                                  ? "Server Delay · Retrying"
                                  : "Top-Up In Progress"}
                          </span>
                        </div>
                        <div className="modern-keyval-item">
                          <span className="keyval-label">Live Dispatch Mode</span>
                          <span className="keyval-value text-muted-foreground">
                            {selectedOrder.nexauraOrderId ||
                            nexauraStatuses[selectedOrder.orderId]?.providerOrderId
                              ? `Ref: #${selectedOrder.nexauraOrderId || nexauraStatuses[selectedOrder.orderId]?.providerOrderId}`
                              : "Direct Game Server API Connection"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* ── Payment Proof & Verification ── */}
              {methodNeedsProof(selectedOrder.paymentMethod) && (
                <div className="modern-info-card">
                  <div className="modern-info-card-header">
                    <ShieldCheck size={15} className="text-amber-400" />
                    <h4>Payment Verification Slip</h4>
                  </div>

                  {selectedOrder.paymentProofFileName ? (
                    <div className="modern-proof-status-card">
                      <div className="modern-proof-meta">
                        <Link2 size={14} className="text-amber-400 flex-shrink-0" />
                        <span
                          className="modern-proof-name"
                          title={selectedOrder.paymentProofFileName}
                        >
                          {selectedOrder.paymentProofFileName}
                        </span>
                      </div>
                      {selectedOrder.paymentProofStoragePath && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={proofViewLoading}
                          onClick={() => void viewPaymentProof()}
                          className="modern-receipt-btn"
                        >
                          <Eye size={13} />
                          {proofViewLoading ? "Loading Receipt…" : "Inspect Receipt"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="modern-no-proof-box">
                      <AlertCircle size={15} className="text-amber-400" />
                      <span>No bank slip or eZ Cash receipt uploaded yet.</span>
                    </div>
                  )}

                  {proofViewUrl && (
                    <div className="modern-proof-display-frame">
                      {selectedOrder.paymentProofContentType === "application/pdf" ? (
                        <iframe
                          src={proofViewUrl}
                          title="Uploaded eZ Cash payment receipt PDF"
                          className="modern-proof-iframe"
                        />
                      ) : (
                        <img
                          src={proofViewUrl}
                          alt="Uploaded payment receipt slip"
                          className="modern-proof-img"
                        />
                      )}
                    </div>
                  )}

                  {/* Upload or Re-upload Section */}
                  {["unpaid", "failed", "proof_rejected"].includes(selectedOrder.paymentStatus) && (
                    <div className="modern-upload-dropzone">
                      <div className="dropzone-header">
                        <h5>
                          {selectedOrder.paymentProofFileName
                            ? "Replace Payment Slip"
                            : "Upload Payment Slip"}
                        </h5>
                        <p>Accepted formats: JPG, PNG, WebP, or PDF (Max 5 MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        style={{ display: "none" }}
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0] ?? null;
                          if (
                            file &&
                            (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
                              file.type,
                            ) ||
                              file.size <= 0 ||
                              file.size > 5 * 1024 * 1024)
                          ) {
                            setReplacementProof(null);
                            event.currentTarget.value = "";
                            toast.error("Choose a valid JPEG, PNG, WebP, or PDF file under 5 MB.");
                            return;
                          }
                          setReplacementProof(file);
                        }}
                        id="proof-file-input"
                      />
                      <div className="dropzone-actions">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="dropzone-select-btn"
                          onClick={() => document.getElementById("proof-file-input")?.click()}
                        >
                          {replacementProof ? `Selected: ${replacementProof.name}` : "Browse File"}
                        </Button>
                        <Button
                          disabled={!replacementProof || proofSubmitting}
                          onClick={() => void resubmitPaymentProof()}
                          className="dropzone-upload-btn"
                        >
                          {proofSubmitting ? (
                            <>
                              <Loader2 className="animate-spin" size={14} /> Uploading…
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={14} /> Confirm & Submit Slip
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Footer / Trust Note ── */}
              <div className="modern-modal-footer">
                <p className="modern-modal-disclaimer">
                  Payments made via eZ Cash or Bank Slip are verified manually by the HASA GOLD
                  STORE staff before automated game top-ups are credited.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardFavorites() {
  const { favorites } = useStore();
  const { data: catalog = [], isLoading, error, refetch } = useGames();
  const items = catalog.filter((game) => favorites.includes(game.id));
  return (
    <>
      <Heading title="Your favorites." description="Games saved to your account." />
      {isLoading ? (
        <div className="dashboard-skeleton" aria-busy="true">
          <div className="skeleton skeleton-block" />
        </div>
      ) : error ? (
        <div className="dashboard-empty" role="alert">
          <p>Games could not be loaded.</p>
          <Button variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length ? (
        <GameGrid items={items} />
      ) : (
        <EmptyState favorite />
      )}
    </>
  );
}

export function DashboardPlayers() {
  const { user, update } = useAccount();
  const {
    data: catalog = [],
    isLoading: gamesLoading,
    error: gamesError,
    refetch: retryGames,
  } = useGames();
  const isLoading = !user || gamesLoading;
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const playerIds: Record<string, string> = user?.players ?? {};

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const result = z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9 _#.-]+$/)
      .safeParse(value);
    if (!result.success) {
      setError("Use 1–64 letters, numbers, spaces, or _ # . -");
      return;
    }
    if (!editing) return;
    setSaving(true);
    try {
      await update({ players: { ...playerIds, [editing]: result.data } });
      setEditing(null);
      toast.success("Player ID saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Player ID.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const next = { ...playerIds };
      delete next[deleting];
      await update({ players: next });
      setDeleting(null);
      toast.success("Player ID deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete Player ID.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Heading
        title="Saved Player IDs."
        description="Keep your Player IDs handy. Synced to your account."
      />
      {isLoading ? (
        <div className="dashboard-skeleton">
          <div className="skeleton skeleton-block" style={{ height: 60 }} />
        </div>
      ) : gamesError ? (
        <div className="dashboard-empty" role="alert">
          <p>The game catalog could not be loaded.</p>
          <Button variant="outline" onClick={() => void retryGames()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="player-list">
          {catalog.map((game) => (
            <article className="player-row" key={game.id}>
              <img src={game.image} alt={`${game.name} artwork`} />
              <div>
                <h2>{game.name}</h2>
                <p>{playerIds[game.id] ? `Saved · ${playerIds[game.id]}` : "No Player ID saved"}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                aria-label={`${playerIds[game.id] ? "Edit" : "Add"} ${game.name} Player ID`}
                onClick={() => {
                  setEditing(game.id);
                  setValue(playerIds[game.id] || "");
                  setError("");
                }}
              >
                {playerIds[game.id] ? <Pencil /> : <Plus />}
              </Button>
              {playerIds[game.id] && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${game.name} Player ID`}
                  onClick={() => setDeleting(game.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Player ID</DialogTitle>
          <DialogDescription>
            {catalog.find((g) => g.id === editing)?.name} · Saved to your account.
          </DialogDescription>
          <form className="account-form" onSubmit={handleSave}>
            <div className="form-field">
              <label htmlFor="player-id">Player ID</label>
              <input
                id="player-id"
                maxLength={64}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={Boolean(error)}
                autoFocus
              />
              {error && <p className="field-error">{error}</p>}
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="loading-spin" /> : <Save />}Save ID
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Delete saved ID?</DialogTitle>
          <DialogDescription>This removes the Player ID from your account.</DialogDescription>
          <Button variant="destructive" onClick={handleDelete} disabled={saving}>
            Delete ID <Trash2 />
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DashboardProfile() {
  const { user, update, changePassword, linkedProviders, linkGoogle, photoUrl } = useAccount();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const currentName = user?.name || "";
  const userInitial = (user?.name || user?.email || "H").slice(0, 1).toUpperCase();
  const googleLinked = linkedProviders.includes("google.com");
  const passwordLinked = linkedProviders.includes("password");

  async function handleLinkGoogle() {
    setLinkingGoogle(true);
    try {
      const linked = await linkGoogle();
      if (linked) {
        toast.success("Google account linked", {
          description: "You can now sign in with Google in one tap.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not link Google.");
    } finally {
      setLinkingGoogle(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "").trim();
    if (!name) {
      setErrors({ name: "Enter your name." });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await update({ name });
      toast.success("Profile updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function password(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const current = String(data.get("current-password") || "");
    const value = String(data.get("new-password") || "");
    if (!current) {
      setErrors({ "current-password": "Enter your current password." });
      return;
    }
    if (value.length < 8) {
      setErrors({ "new-password": "Use at least 8 characters." });
      return;
    }
    if (value !== data.get("confirm-new")) {
      setErrors({ "confirm-new": "The passwords do not match." });
      return;
    }
    setErrors({});
    setPasswordBusy(true);
    try {
      await changePassword(current, value);
      form.reset();
      toast.success("Password updated");
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential" ||
        code === "auth/missing-password"
      )
        setErrors({ "current-password": "Your current password is incorrect." });
      else if (code === "auth/weak-password")
        setErrors({ "new-password": "Choose a stronger password." });
      else if (code === "auth/requires-recent-login")
        setErrors({ "current-password": "Log out and back in, then try again." });
      else
        setErrors({
          form: error instanceof Error ? error.message : "Could not change your password.",
        });
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <Heading title="Your profile." description="Your account name and security." />
      <div className="profile-hero">
        {photoUrl ? (
          <img
            className="profile-hero-avatar"
            src={photoUrl}
            alt="Profile photo"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="profile-hero-avatar is-initial" aria-hidden="true">
            {userInitial}
          </span>
        )}
        <div className="profile-hero-copy">
          <strong>{user?.name ?? "HASA customer"}</strong>
          <span>{user?.email}</span>
        </div>
        {googleLinked && (
          <span className="admin-provider-badge is-google profile-hero-badge">
            <span className="google-g-mark" aria-hidden="true">
              G
            </span>
            Google linked
          </span>
        )}
      </div>
      <section className="member-id-card" aria-label="Your customer ID">
        <span className="member-id-card-icon">
          <IdCard size={20} />
        </span>
        <div>
          <span className="member-id-label">YOUR HASA MEMBER ID</span>
          <strong>{user?.memberId ?? "Assigning your member ID…"}</strong>
          <small>Use this shorter ID when contacting customer support.</small>
        </div>
      </section>
      <section className="connected-accounts-card" aria-label="Connected sign-in methods">
        <header className="connected-accounts-head">
          <span className="connected-accounts-icon">
            <Link2 size={18} />
          </span>
          <div>
            <h2>Connected accounts</h2>
            <p>Ways you can sign in to HASA GOLD STORE.</p>
          </div>
        </header>
        <div className="connected-account-row">
          <span className="connected-account-mark is-google" aria-hidden="true">
            {googleLinked && photoUrl ? (
              <img
                className="connected-account-photo"
                src={photoUrl}
                alt=""
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="google-g-mark">G</span>
            )}
          </span>
          <div className="connected-account-meta">
            <strong>Google</strong>
            <span>
              {googleLinked
                ? "Linked — you can sign in with Google in one tap."
                : "Not linked. Link Google to sign in without typing your password."}
            </span>
          </div>
          {googleLinked ? (
            <span className="admin-pill pill-success" role="status">
              Connected
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleLinkGoogle()}
              disabled={linkingGoogle}
            >
              {linkingGoogle && <Loader2 className="loading-spin" size={14} />}Link Google
            </Button>
          )}
        </div>
        <div className="connected-account-row">
          <span className="connected-account-mark is-email" aria-hidden="true">
            <Mail size={15} />
          </span>
          <div className="connected-account-meta">
            <strong>Email &amp; password</strong>
            <span>
              {passwordLinked
                ? "You can sign in with your email and password."
                : "This account signs in with Google only."}
            </span>
          </div>
          <span
            className={`admin-pill ${passwordLinked ? "pill-success" : "pill-warning"}`}
            role="status"
          >
            {passwordLinked ? "Connected" : "Not set"}
          </span>
        </div>
      </section>
      <form className="settings-form" onSubmit={save} noValidate>
        <FormField label="Name" name="name" value={currentName} error={errors["name"]} />
        <div className="form-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            defaultValue={user?.email ?? ""}
            readOnly
            autoComplete="email"
          />
          <p className="form-hint">Email is managed by Firebase Auth and cannot be changed here.</p>
          <div
            className={`email-verification ${user?.emailVerified ? "is-verified" : "is-unverified"}`}
            role="status"
          >
            <span className="email-verification-icon" aria-hidden="true">
              {user?.emailVerified ? <BadgeCheck size={16} /> : <MailWarning size={16} />}
            </span>
            <span className="email-verification-copy">
              <strong>{user?.emailVerified ? "Email verified" : "Verification pending"}</strong>
              <small>
                {user?.emailVerified
                  ? "Your address is confirmed — the account is fully secured."
                  : "Open the link we emailed you to verify this address."}
              </small>
            </span>
            <span className={`admin-pill ${user?.emailVerified ? "pill-success" : "pill-warning"}`}>
              {user?.emailVerified ? "Verified" : "Not verified"}
            </span>
          </div>
        </div>
        <Button disabled={busy} type="submit">
          {busy ? <Loader2 className="loading-spin" /> : <Save />}Save profile
        </Button>
      </form>
      <section className="dashboard-section">
        <h2>Change password</h2>
        <p className="form-hint">Enter your current password, then choose a new one.</p>
        <form className="settings-form" onSubmit={password} noValidate>
          <div className="form-field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              name="current-password"
              type="password"
              maxLength={128}
              autoComplete="current-password"
              required
            />
            {errors["current-password"] && (
              <p className="field-error">{errors["current-password"]}</p>
            )}
          </div>
          <PasswordField
            label="New password"
            name="new-password"
            hint
            error={errors["new-password"]}
          />
          <PasswordField
            label="Confirm new password"
            name="confirm-new"
            error={errors["confirm-new"]}
          />
          {errors["form"] && (
            <p role="alert" className="field-error">
              {errors["form"]}
            </p>
          )}
          <Button type="submit" variant="outline" disabled={passwordBusy}>
            {passwordBusy && <Loader2 className="loading-spin" />}Update password
          </Button>
        </form>
      </section>
    </>
  );
}

export function DashboardSettings() {
  const { user, update, theme, setTheme } = useAccount();
  const notifs = user?.notifications ?? { updates: false, reminders: false };

  async function toggleNotif(key: "updates" | "reminders", checked: boolean) {
    try {
      await update({ notifications: { ...notifs, [key]: checked } });
      toast.success("Preference saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preference.");
    }
  }

  return (
    <>
      <Heading title="Just your style." description="Make this space feel like you." />
      <section className="dashboard-section">
        <h2>Appearance</h2>
        <div className="theme-segment" role="group" aria-label="Theme preference">
          {(["light", "dark", "system"] as const).map((value) => (
            <Button
              key={value}
              variant={theme === value ? "default" : "ghost"}
              aria-pressed={theme === value}
              onClick={() => {
                void setTheme(value)
                  .then(() => toast.success("Theme updated"))
                  .catch((error: unknown) =>
                    toast.error(
                      error instanceof Error ? error.message : "Could not save theme preference.",
                    ),
                  );
              }}
            >
              {value.charAt(0).toUpperCase() + value.slice(1)}
            </Button>
          ))}
        </div>
        <p className="form-hint">System follows your device. Your choice is remembered.</p>
      </section>
      <section className="dashboard-section">
        <h2>Notifications</h2>
        <p className="form-hint">Preferences synced to your account.</p>
        {[
          { key: "updates" as const, title: "Store updates" },
          { key: "reminders" as const, title: "Game reminders" },
        ].map((item) => (
          <label className="setting-row" key={item.key}>
            <span>{item.title}</span>
            <input
              type="checkbox"
              role="switch"
              checked={notifs[item.key]}
              onChange={(e) => toggleNotif(item.key, e.target.checked)}
            />
          </label>
        ))}
      </section>
    </>
  );
}
