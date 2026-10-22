import { useEffect, useState, type FormEvent } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GameGrid, EmptyState } from "./store-ui";
import { useStore } from "./store-context";
import { useAccount } from "./account-context";
import { FormField, PasswordField } from "./account-ui";
import { useGames, useUserOrders } from "@/lib/firestore";
import type { OrderDoc } from "@/lib/firestore-schema";
import { getFirebaseAuth } from "@/lib/firebase";
import {
  getOrderPaymentProofUploadToken,
  getOrderPaymentProofUrl,
  submitOrderPaymentProof,
} from "@/api/createOrder";
import { pollNexauraTopup } from "@/api/nexauraTopups";
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
  const { user } = useAccount();
  const { favorites } = useStore();
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
  const [selectedOrder, setSelectedOrder] = useState<OrderDoc | null>(null);
  const [proofSubmittedOrderIds, setProofSubmittedOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [replacementProof, setReplacementProof] = useState<File | null>(null);
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [proofViewLoading, setProofViewLoading] = useState(false);
  const {
    data: orderPages,
    isLoading: ordersLoading,
    error: ordersError,
    refetch: retryOrders,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    refetch,
  } = useUserOrders(uid);
  const firestoreOrders = orderPages?.pages.flatMap((page) => page.orders) ?? [];
  const [nexauraStatuses, setNexauraStatuses] = useState<
    Record<string, { status: string; note: string | null; error?: string }>
  >({});
  const activeNexauraOrderIds = firestoreOrders
    .filter(
      (order) =>
        order.gameSlug === "free-fire" &&
        order.paymentStatus === "paid" &&
        typeof order.nexauraOrderId === "string" &&
        !["completed", "failed", "refunded"].includes(
          nexauraStatuses[order.orderId]?.status ?? order.nexauraStatus ?? "",
        ),
    )
    .map((order) => order.orderId);
  const activeNexauraOrderIdsKey = activeNexauraOrderIds.join(",");

  useEffect(() => {
    if (!activeNexauraOrderIdsKey) return;
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) return;
    const orderIds = activeNexauraOrderIdsKey.split(",");
    let active = true;
    let timeout: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let idToken: string;
      try {
        idToken = await currentUser.getIdToken();
      } catch (cause) {
        if (!active) return;
        const message =
          cause instanceof Error ? cause.message : "Sign in again to check your Nexaura order.";
        setNexauraStatuses((current) => ({
          ...current,
          ...Object.fromEntries(
            orderIds.map((orderId) => [
              orderId,
              {
                status: current[orderId]?.status ?? "processing",
                note: current[orderId]?.note ?? null,
                error: message,
              },
            ]),
          ),
        }));
        timeout = setTimeout(() => void poll(), 4000);
        return;
      }
      const results = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const result = await pollNexauraTopup({ data: { idToken, orderId } });
            return { orderId, result };
          } catch (cause) {
            return {
              orderId,
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
              ? { status: result.status, note: result.note }
              : {
                  status: current[orderId]?.status ?? "processing",
                  note: current[orderId]?.note ?? null,
                  error,
                },
          ]),
        ),
      }));
      if (results.some(({ result }) => !result || !result.terminal)) {
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
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      toast.error("Sign in again before uploading payment proof.");
      return;
    }
    setProofSubmitting(true);
    try {
      const upload = await getOrderPaymentProofUploadToken({
        data: {
          idToken: await currentUser.getIdToken(),
          orderId: selectedOrder.orderId,
        },
      });
      await uploadPaymentProof(upload.signedUrl, replacementProof);
      await submitOrderPaymentProof({
        data: {
          idToken: await currentUser.getIdToken(),
          orderId: selectedOrder.orderId,
          fileName: replacementProof.name,
        },
      });
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
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      toast.error("Sign in again to view your payment proof.");
      return;
    }
    setProofViewLoading(true);
    try {
      const result = await getOrderPaymentProofUrl({
        data: {
          idToken: await currentUser.getIdToken(),
          orderId: selectedOrder.orderId,
        },
      });
      setProofViewUrl(result.url);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Could not open payment proof.");
    } finally {
      setProofViewLoading(false);
    }
  }
  return (
    <>
      <Heading
        title="Your orders."
        description="All your top-up orders placed through HASA GOLD STORE."
      />
      {ordersLoading ? (
        <div className="dashboard-skeleton" aria-busy="true">
          <div className="skeleton skeleton-block" style={{ height: 80 }} />
          <div className="skeleton skeleton-block" style={{ height: 80, marginTop: 12 }} />
        </div>
      ) : ordersError && !orderPages ? (
        <div className="dashboard-empty">
          <Receipt />
          <h2>Couldn't load orders</h2>
          <p>Please check your connection and try again.</p>
          <Button variant="outline" onClick={() => void retryOrders()}>
            Try again
          </Button>
        </div>
      ) : firestoreOrders && firestoreOrders.length > 0 ? (
        <div className="dashboard-order-list">
          {firestoreOrders.map((ord) => (
            <article className="dashboard-order-card" key={ord.orderId}>
              <div className="order-card-header">
                <div className="order-card-title">
                  <span className="order-package-name">{ord.packageName}</span>
                  <div className="order-status-badges">
                    <span
                      className={`order-status-badge ${statusTone(
                        getDisplayOrderStatus(ord, nexauraStatuses[ord.orderId]?.status),
                      )}`}
                    >
                      {statusLabel(
                        getDisplayOrderStatus(ord, nexauraStatuses[ord.orderId]?.status),
                      )}
                    </span>
                    <span className={`order-status-badge ${statusTone(ord.paymentStatus)}`}>
                      {statusLabel(ord.paymentStatus)}
                    </span>
                  </div>
                </div>
                <div className="order-card-price">
                  {ord.currency === "LKR" ? "LKR" : "Rs."} {ord.pricePkr.toLocaleString()}
                </div>
              </div>
              <div className="order-card-body">
                <div className="order-info-row">
                  <div className="order-info-item">
                    <span className="order-info-label">Game</span>
                    <span className="order-info-value">{ord.gameName}</span>
                  </div>
                  <div className="order-info-item">
                    <span className="order-info-label">Player ID</span>
                    <span className="order-info-value">{ord.playerId}</span>
                  </div>
                  <div className="order-info-item">
                    <span className="order-info-label">Order ID</span>
                    <span className="order-info-value order-id-text">{ord.orderId}</span>
                  </div>
                  <div className="order-info-item">
                    <span className="order-info-label">Date</span>
                    <span className="order-info-value">
                      {ord.createdAt
                        ? new Date(ord.createdAt).toLocaleDateString()
                        : "Date unavailable"}
                    </span>
                  </div>
                </div>
                {ord.gameSlug === "free-fire" && (
                  <div className="order-info-row">
                    <div className="order-info-item">
                      <span className="order-info-label">Nexaura top-up</span>
                      <span className="order-info-value">
                        {nexauraStatuses[ord.orderId]?.status ??
                          ord.nexauraStatus ??
                          "Awaiting payment"}
                        {nexauraStatuses[ord.orderId]?.note
                          ? ` · ${nexauraStatuses[ord.orderId]?.note ?? ""}`
                          : ord.nexauraNote
                            ? ` · ${ord.nexauraNote}`
                            : ""}
                        {nexauraStatuses[ord.orderId]?.error
                          ? ` · ${nexauraStatuses[ord.orderId]?.error ?? ""}`
                          : ""}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="order-card-footer">
                <div className="order-card-actions">
                  {ord.paymentMethod === "ezcash" &&
                    !proofSubmittedOrderIds.has(ord.orderId) &&
                    ["unpaid", "failed", "proof_rejected"].includes(ord.paymentStatus) && (
                      <Button
                        className="order-submit-proof-btn"
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedOrder(ord)}
                      >
                        Submit proof
                      </Button>
                    )}
                  <Button
                    className="order-view-btn"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedOrder(ord)}
                  >
                    <Eye size={15} /> View details
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {hasNextPage && (
            <Button
              variant="outline"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage
                ? "Loading orders…"
                : isFetchNextPageError
                  ? "Retry loading orders"
                  : "Load older orders"}
            </Button>
          )}
        </div>
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
        <DialogContent className="order-detail-dialog">
          {selectedOrder && (
            <>
              <div className="order-detail-heading">
                <span className="order-detail-icon">
                  <Receipt size={20} />
                </span>
                <div>
                  <span className="eyebrow">ORDER DETAILS</span>
                  <DialogTitle>{selectedOrder.packageName}</DialogTitle>
                  <DialogDescription>{selectedOrder.gameName} top-up order</DialogDescription>
                </div>
              </div>
              <div className="order-detail-status-row">
                <span
                  className={`dashboard-order-status ${statusTone(
                    getDisplayOrderStatus(
                      selectedOrder,
                      nexauraStatuses[selectedOrder.orderId]?.status,
                    ),
                  )}`}
                >
                  Order:{" "}
                  {statusLabel(
                    getDisplayOrderStatus(
                      selectedOrder,
                      nexauraStatuses[selectedOrder.orderId]?.status,
                    ),
                  )}
                </span>
                <span
                  className={`dashboard-order-status ${statusTone(selectedOrder.paymentStatus)}`}
                >
                  Payment: {statusLabel(selectedOrder.paymentStatus)}
                </span>
              </div>
              <section className="order-detail-section">
                <h3>Player information</h3>
                <dl className="order-detail-grid">
                  <div>
                    <dt>In-game name</dt>
                    <dd>{selectedOrder.playerName || "Not recorded for this order"}</dd>
                  </div>
                  <div>
                    <dt>Player ID</dt>
                    <dd className="order-detail-mono">{selectedOrder.playerId}</dd>
                  </div>
                  {selectedOrder.playerRegion && (
                    <div>
                      <dt>Region</dt>
                      <dd>{selectedOrder.playerRegion}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Server</dt>
                    <dd>{selectedOrder.server || "Not specified"}</dd>
                  </div>
                </dl>
                {!selectedOrder.playerName && (
                  <p className="order-detail-note">
                    {selectedOrder.playerNameLookupStatus === "unavailable"
                      ? "The player-name service was temporarily unavailable when this order was created."
                      : "Player ID is saved for manual fulfillment and has not been verified with the game publisher."}
                  </p>
                )}
              </section>
              <section className="order-detail-section">
                <h3>Purchase summary</h3>
                <dl className="order-detail-grid">
                  <div>
                    <dt>Package</dt>
                    <dd>{selectedOrder.packageName}</dd>
                  </div>
                  <div>
                    <dt>Quantity</dt>
                    <dd>
                      {selectedOrder.amount.toLocaleString()} {selectedOrder.unitLabel}
                    </dd>
                  </div>
                  <div>
                    <dt>Total</dt>
                    <dd className="order-detail-total">
                      {selectedOrder.currency === "LKR" ? "LKR" : "Rs."}{" "}
                      {selectedOrder.pricePkr.toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd className="order-detail-date">
                      <CalendarDays size={14} />
                      {selectedOrder.createdAt
                        ? new Date(selectedOrder.createdAt).toLocaleString()
                        : "Date unavailable"}
                    </dd>
                  </div>
                  <div className="order-detail-wide">
                    <dt>Order reference</dt>
                    <dd className="order-detail-mono">{selectedOrder.orderId}</dd>
                  </div>
                  <div>
                    <dt>Payment method</dt>
                    <dd>
                      {selectedOrder.paymentMethod ?? "Not recorded"}
                      {selectedOrder.paymentRecipient ? ` · ${selectedOrder.paymentRecipient}` : ""}
                    </dd>
                  </div>
                  {selectedOrder.paymentProofFileName && (
                    <div>
                      <dt>Payment proof</dt>
                      <dd>{selectedOrder.paymentProofFileName}</dd>
                    </div>
                  )}
                </dl>
                {selectedOrder.paymentProofStoragePath && (
                  <div className="order-detail-proof">
                    <Button
                      variant="outline"
                      disabled={proofViewLoading}
                      onClick={() => void viewPaymentProof()}
                    >
                      {proofViewLoading ? "Loading receipt…" : "View uploaded receipt"}
                    </Button>
                    {proofViewUrl &&
                      (selectedOrder.paymentProofContentType === "application/pdf" ? (
                        <iframe
                          src={proofViewUrl}
                          title="Your uploaded eZ Cash payment receipt PDF"
                          className="order-detail-proof-pdf"
                        />
                      ) : (
                        <img
                          src={proofViewUrl}
                          alt="Your uploaded eZ Cash payment receipt"
                          className="order-detail-proof-image"
                        />
                      ))}
                  </div>
                )}
              </section>
              {selectedOrder.paymentMethod === "ezcash" &&
                ["unpaid", "failed", "proof_rejected"].includes(selectedOrder.paymentStatus) && (
                  <section className="order-detail-section">
                    <h3>Submit or replace payment proof</h3>
                    <label className="admin-form-field">
                      <span className="admin-field-label">
                        eZ Cash receipt (JPEG, PNG, WebP, or PDF; up to 5 MB)
                      </span>
                      <input
                        className="admin-form-input"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
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
                            toast.error(
                              "Choose a non-empty JPEG, PNG, WebP, or PDF file under 5 MB.",
                            );
                            return;
                          }
                          setReplacementProof(file);
                        }}
                      />
                    </label>
                    {replacementProof && (
                      <p className="form-hint">Selected: {replacementProof.name}</p>
                    )}
                    <Button
                      variant="outline"
                      disabled={!replacementProof || proofSubmitting}
                      onClick={() => void resubmitPaymentProof()}
                    >
                      {proofSubmitting ? "Uploading proof…" : "Submit payment proof"}
                    </Button>
                  </section>
                )}
              <p className="order-detail-disclaimer">
                Payment status is {statusLabel(selectedOrder.paymentStatus)}. Proof submission is
                not payment confirmation. Statuses are manual records; the website does not transfer
                or refund money or automatically fulfill top-ups.
              </p>
            </>
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
