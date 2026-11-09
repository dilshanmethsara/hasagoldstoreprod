/**
 * Centralized Express API client.
 *
 * All calls to https://api.hasagold.store go through here.
 * Firebase Authentication tokens are attached automatically on authenticated
 * requests. Token refresh is handled by Firebase SDK before each call.
 *
 * The base URL is read from VITE_API_BASE_URL (defaults to the production API).
 */
import { getFirebaseAuth } from "@/lib/firebase";
import type { PaymentMethodConfig } from "@/lib/firestore-schema";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "https://api.hasagold.store").replace(
  /\/+$/,
  "",
);

// ─── Error class ──────────────────────────────────────────────────────────────

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

// ─── Core fetch helper ────────────────────────────────────────────────────────

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT";
    body?: unknown;
    authenticated?: boolean;
    idempotencyKey?: string;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  if (options.authenticated) {
    const user = getFirebaseAuth().currentUser;
    if (!user) throw new ApiRequestError("Sign in to continue.", 401, "authentication_required");
    // Force refresh if the token is about to expire (Firebase handles the actual expiry check)
    headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    // Always hit the network: admin edits must be visible immediately.
    cache: "no-store",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as ApiErrorBody | null;
    throw new ApiRequestError(
      error?.error?.message || `The store API request failed (${response.status}).`,
      response.status,
      error?.error?.code || "request_failed",
    );
  }
  return payload as T;
}

// ─── Type definitions ─────────────────────────────────────────────────────────

export type CatalogGameTone = "ice" | "ember" | "olive" | "violet";
export type CatalogGameIcon = "diamond" | "coins";

export interface ApiCatalogGame {
  id: string;
  slug: string;
  name: string;
  currency: string;
  tone: CatalogGameTone;
  icon: CatalogGameIcon;
  artworkKey: string;
  imageUrl?: string | null;
  description: string;
  serverOptions?: unknown;
  active: boolean;
  displayOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApiCatalogProduct {
  id: string;
  gameSlug: string;
  nexauraProductId?: string;
  category?: string;
  amount: number;
  unitLabel: string;
  name: string;
  imageUrl?: string | null;
  priceUsd: number;
  pricePkr: number;
  bonus: number;
  isPopular: boolean;
  isBestValue: boolean;
  isVip: boolean;
  active: boolean;
  displayOrder: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ApiCatalogSettings {
  [key: string]: unknown;
}

export interface ApiCatalogResponse {
  games: ApiCatalogGame[];
  products: ApiCatalogProduct[];
  settings: ApiCatalogSettings | null;
}

export interface ApiOrder {
  id: string;
  customerUid: string;
  customerEmail: string;
  gameSlug: string;
  gameName: string;
  productId: string;
  packageName: string;
  amount: number;
  unitLabel: string;
  priceUsd: number;
  pricePkr: number;
  currency: string;
  playerId: string;
  playerName: string | null;
  server: string;
  paymentMethod: string;
  paymentRecipient: string | null;
  status: string;
  paymentStatus: string;
  nexauraOrderId?: string;
  nexauraStatus?: string;
  nexauraNote?: string;
  paymentProofStoragePath?: string;
  paymentProofStorageProvider?: string;
  paymentProofContentType?: string;
  paymentProofFileName?: string;
  createdAt: number | null;
  updatedAt: number | null;
  [key: string]: unknown;
}

export interface ApiOrdersResponse {
  orders: ApiOrder[];
}

export interface PublicRecentTopup {
  gameName: string;
  packageName: string;
  status: "completed" | "delivered";
  providerStatus: string | null;
  updatedAt: number;
}

export function fetchRecentTopups(): Promise<{ orders: PublicRecentTopup[] }> {
  return apiRequest<{ orders: PublicRecentTopup[] }>("/v1/recent-topups");
}

export interface ApiCreateOrderResponse {
  order: ApiOrder;
  duplicate: boolean;
  topup?: { status: string; orderId?: string; message?: string };
}

export interface ApiPlayerVerification {
  status: "verified" | "unavailable";
  playerUid?: string;
  name?: string;
  region?: string;
  source?: "live" | "saved";
}

export interface ApiEzCashDepositResult {
  depositId: string;
  creditedLkr: number;
  status: "credited" | "failed" | "pending";
  message: string;
  duplicate?: boolean;
}

export interface ApiTopupStatus {
  orderId: string | null;
  status: string;
  note: string | null;
  issueType?: "stock_issue" | "system_issue" | null;
  terminal: boolean;
}

export interface ApiAdminOverview {
  games: number;
  products: number;
  accounts: number;
  orders: number;
  awaitingPaymentOrReview: number;
  deposits: number;
  pendingDeposits: number;
  users: number;
}

export interface ApiAdminUser {
  uid: string;
  memberId: string | null;
  walletBalanceLkr: number;
  email: string;
  displayName: string;
  disabled: boolean;
  createdAt: number;
  isAdmin: boolean;
  isCurrentAdmin: boolean;
  providers: string[];
  photoUrl: string | null;
}

// ─── Public catalog ───────────────────────────────────────────────────────────

export function fetchApiCatalog(): Promise<ApiCatalogResponse> {
  return apiRequest<ApiCatalogResponse>("/v1/catalog");
}

// ─── Player verification ─────────────────────────────────────────────────────

export function verifyFreeFirePlayerApi(playerUid: string): Promise<ApiPlayerVerification> {
  return apiRequest<ApiPlayerVerification>(
    `/v1/players/free-fire/${encodeURIComponent(playerUid)}`,
    { authenticated: true },
  );
}

export function verifyBloodStrikePlayerApi(
  playerUid: string,
  server?: string,
): Promise<ApiPlayerVerification> {
  const params = server ? `?server=${encodeURIComponent(server)}` : "";
  return apiRequest<ApiPlayerVerification>(
    `/v1/players/blood-strike/${encodeURIComponent(playerUid)}${params}`,
    { authenticated: true },
  );
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export function fetchApiOrders(limit = 20): Promise<ApiOrdersResponse> {
  return apiRequest<ApiOrdersResponse>(`/v1/orders?limit=${limit}`, { authenticated: true });
}

export function fetchApiOrder(orderId: string): Promise<{ order: ApiOrder }> {
  return apiRequest<{ order: ApiOrder }>(`/v1/orders/${orderId}`, { authenticated: true });
}

export function createApiOrder(
  body: {
    productId: string;
    playerId: string;
    server: string;
    paymentMethod: string;
  },
  idempotencyKey: string,
): Promise<ApiCreateOrderResponse> {
  return apiRequest<ApiCreateOrderResponse>("/v1/orders", {
    method: "POST",
    authenticated: true,
    body,
    idempotencyKey,
  });
}

export function fetchApiTopupStatus(orderId: string): Promise<ApiTopupStatus> {
  return apiRequest<ApiTopupStatus>(`/v1/orders/${orderId}/topup`, { authenticated: true });
}

// ─── Payment proofs ───────────────────────────────────────────────────────────

export function getApiProofUploadToken(
  orderId: string,
): Promise<{ path: string; signedUrl: string; token: string }> {
  return apiRequest(`/v1/orders/${orderId}/proof/token`, { method: "POST", authenticated: true });
}

export function submitApiProof(
  orderId: string,
  fileName: string,
): Promise<{ orderId: string; status: string; paymentStatus: string }> {
  return apiRequest(`/v1/orders/${orderId}/proof/submit`, {
    method: "POST",
    authenticated: true,
    body: { fileName },
  });
}

export function viewApiProof(orderId: string): Promise<{ url: string }> {
  return apiRequest(`/v1/orders/${orderId}/proof/view`, { authenticated: true });
}

// ─── eZ Cash deposits ─────────────────────────────────────────────────────────

export function initiateApiEzCashDeposit(referenceNumber: string): Promise<ApiEzCashDepositResult> {
  return apiRequest<ApiEzCashDepositResult>("/v1/deposits/ezcash", {
    method: "POST",
    authenticated: true,
    body: { referenceNumber },
  });
}

export function checkApiEzCashDeposit(depositId: string): Promise<ApiEzCashDepositResult> {
  return apiRequest<ApiEzCashDepositResult>(`/v1/deposits/${encodeURIComponent(depositId)}`, {
    authenticated: true,
  });
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function completeApiProfile(data: {
  displayName: string;
  phoneNumber: string;
  acceptedTerms: true;
}): Promise<{ success: true }> {
  return apiRequest("/v1/profile/complete", {
    method: "POST",
    authenticated: true,
    body: data,
  });
}

export function ensureApiMemberId(): Promise<{ memberId: string }> {
  return apiRequest("/v1/profile/member-id", { method: "POST", authenticated: true });
}

export function ensureApiProfile(): Promise<{
  success: true;
  created: boolean;
  profile: Record<string, unknown>;
}> {
  return apiRequest("/v1/auth/ensure-profile", { method: "POST", authenticated: true });
}

export function sendApiVerificationEmail(
  appOrigin: string,
): Promise<{ sent: true; alreadyVerified?: boolean }> {
  return apiRequest("/v1/auth/send-verification-email", {
    method: "POST",
    authenticated: true,
    body: { appOrigin },
  });
}

export function getApiWallet(): Promise<{
  balance: number;
  deposits: ApiWalletTransaction[];
  adjustments: ApiWalletTransaction[];
  orders: ApiWalletTransaction[];
}> {
  return apiRequest("/v1/me/wallet", { authenticated: true });
}

export function updateApiProfile(data: {
  displayName?: string;
  savedPlayerIds?: Record<string, string>;
  recentViewedGames?: string[];
  favorites?: string[];
  notificationPrefs?: { updates: boolean; reminders: boolean };
  theme?: "light" | "dark" | "system";
}): Promise<{ success: true; updated: boolean }> {
  return apiRequest("/v1/me/profile", {
    method: "PUT",
    authenticated: true,
    body: data,
  });
}

export function fetchApiAccounts(gameId?: string): Promise<{ accounts: ApiGameAccount[] }> {
  const qs = gameId ? `?gameId=${encodeURIComponent(gameId)}` : "";
  return apiRequest(`/v1/accounts${qs}`);
}

export function fetchApiAccount(id: string): Promise<{ account: ApiGameAccount }> {
  return apiRequest(`/v1/accounts/${encodeURIComponent(id)}`);
}

export function fetchApiFaqs(): Promise<{ items: Array<{ question: string; answer: string }> }> {
  return apiRequest("/v1/faqs");
}

// ─── Type additions ───────────────────────────────────────────────────────────

export interface ApiWalletTransaction {
  id: string;
  uid?: string;
  referenceNumber?: string;
  method?: string;
  status?: string;
  creditedLkr?: number;
  amountLkr?: number;
  reason?: string;
  depositId?: string;
  adjustmentId?: string;
  orderId?: string;
  customerUid?: string;
  gameName?: string;
  packageName?: string;
  pricePkr?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  createdAt?: number | null;
  updatedAt?: number | null;
  [key: string]: unknown;
}

export interface ApiGameAccount {
  id: string;
  gameId: string;
  gameName: string;
  title: string;
  tagline: string;
  priceUsd: number;
  pricePkr: number;
  priceSample: string;
  level: number;
  rank: string;
  server: string;
  loginType: string;
  artworkKey: string;
  tone: string;
  verified: boolean;
  status: string;
  badges: string[];
  inventoryHighlights: string[];
  description: string;
  features: Array<{ label: string; value: string }>;
  active: boolean;
  displayOrder: number;
  createdAt?: number | null;
  updatedAt?: number | null;
  [key: string]: unknown;
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function fetchAdminOverview(): Promise<ApiAdminOverview> {
  return apiRequest("/v1/admin/overview", { authenticated: true });
}

export function fetchAdminCollection(
  collection: "games" | "products" | "gameAccounts" | "orders" | "wallet_deposits",
  pageToken?: string,
): Promise<{ items: Record<string, unknown>[]; nextPageToken: string | null }> {
  const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
  return apiRequest(`/v1/admin/collections/${collection}${qs}`, { authenticated: true });
}

export function saveAdminCatalogRecord(
  collection: "games" | "products" | "gameAccounts" | "settings" | "faqs",
  record: Record<string, unknown>,
): Promise<{ id: string }> {
  return apiRequest(`/v1/admin/catalog/${collection}`, {
    method: "POST",
    authenticated: true,
    body: record,
  });
}

export function archiveAdminCatalogRecord(
  collection: "games" | "products" | "gameAccounts",
  id: string,
): Promise<{ id: string; active: false }> {
  return apiRequest(`/v1/admin/catalog/${collection}/${id}/archive`, {
    method: "POST",
    authenticated: true,
  });
}

export function saveAdminSettings(record: Record<string, unknown>): Promise<{ id: string }> {
  return apiRequest("/v1/admin/settings", { method: "POST", authenticated: true, body: record });
}

export function saveAdminPaymentMethods(
  methods: PaymentMethodConfig[],
): Promise<{ success: true }> {
  return apiRequest("/v1/admin/settings/payment-methods", {
    method: "POST",
    authenticated: true,
    body: { methods },
  });
}

export function saveAdminFaqs(
  items: Array<{ question: string; answer: string }>,
): Promise<{ id: string }> {
  return apiRequest("/v1/admin/faqs", { method: "POST", authenticated: true, body: { items } });
}

export function fetchAdminUsers(
  pageToken?: string,
): Promise<{ users: ApiAdminUser[]; nextPageToken: string | null }> {
  const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "";
  return apiRequest(`/v1/admin/users${qs}`, { authenticated: true });
}

export function searchAdminUserApi(q: string): Promise<{ user: ApiAdminUser | null }> {
  return apiRequest(`/v1/admin/users/search?q=${encodeURIComponent(q)}`, { authenticated: true });
}

export function setAdminUserDisabledApi(
  uid: string,
  disabled: boolean,
): Promise<{ uid: string; disabled: boolean }> {
  return apiRequest(`/v1/admin/users/${uid}/disabled`, {
    method: "POST",
    authenticated: true,
    body: { disabled },
  });
}

export function adjustAdminWalletApi(
  uid: string,
  data: { direction: "credit" | "deduct"; amountLkr: number; reason: string },
): Promise<{ uid: string; adjustmentId: string; balanceLkr: number }> {
  return apiRequest(`/v1/admin/users/${uid}/wallet`, {
    method: "POST",
    authenticated: true,
    body: data,
  });
}

export function searchAdminOrderApi(q: string): Promise<{ order: Record<string, unknown> | null }> {
  return apiRequest(`/v1/admin/orders/search?q=${encodeURIComponent(q)}`, { authenticated: true });
}

export function updateAdminOrderStatusApi(
  orderId: string,
  data: { status: string; paymentStatus: string },
): Promise<{
  orderId: string;
  status: string;
  paymentStatus: string;
  emailNotificationSent: boolean;
  nexauraSubmission?: unknown;
}> {
  return apiRequest(`/v1/admin/orders/${orderId}/status`, {
    method: "POST",
    authenticated: true,
    body: data,
  });
}

export function fetchAdminOrderProofUrl(orderId: string): Promise<{ url: string }> {
  return apiRequest(`/v1/admin/orders/${orderId}/proof`, { authenticated: true });
}

export function adminDecidePayment(
  orderId: string,
  decision: "confirm" | "reject",
): Promise<{ order: Record<string, unknown>; topup?: unknown }> {
  return apiRequest(`/v1/admin/orders/${orderId}/payment-decision`, {
    method: "POST",
    authenticated: true,
    body: { decision },
  });
}

export function fetchAdminTopupFailures(): Promise<{ items: Record<string, unknown>[] }> {
  return apiRequest("/v1/admin/topup-failures", { authenticated: true });
}

export function pollAdminTopupStatus(orderId: string): Promise<ApiTopupStatus> {
  return apiRequest(`/v1/admin/orders/${orderId}/topup`, { authenticated: true });
}

export function uploadAdminImageApi(data: {
  folder: "games" | "packages" | "payments";
  fileName: string;
  contentType: string;
  dataBase64: string;
}): Promise<{ url: string; path: string }> {
  return apiRequest("/v1/admin/upload-image", {
    method: "POST",
    authenticated: true,
    body: data,
  });
}
