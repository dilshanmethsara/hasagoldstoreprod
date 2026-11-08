/**
 * Data access layer — ALL reads now go through the Express API.
 * No direct Firestore client access remains in this module.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  fetchApiCatalog,
  fetchApiAccounts,
  fetchApiAccount,
  fetchApiFaqs,
  getApiWallet,
  ensureApiProfile,
  updateApiProfile,
} from "@/lib/api-client";

import type {
  CatalogGame,
  GameAccountDoc,
  OrderDoc,
  ProductDoc,
  SettingsDoc,
  UserDoc,
  WalletAdjustmentDoc,
  WalletDepositDoc,
} from "@/lib/firestore-schema";
import { parsePaymentMethods } from "@/lib/payment-methods";

import freefireLogo from "@/assets/freefire.jfif";
import bloodStrikeLogo from "@/assets/blood-strike.jpg";
import pubgLogo from "@/assets/pubgmobilelogo.jpg";
import codmLogo from "@/assets/call-of-duty-mobile-logo.jpg";
import ffAcc from "@/assets/ff-account.jpg";
import pubgAcc from "@/assets/pubg-account.jpg";
import codmAcc from "@/assets/codm-account.jpg";
import bsAcc from "@/assets/bs-account.jpg";
import diamonds from "@/assets/diamond-world.jpg";
import battle from "@/assets/battle-world.jpg";

const artworkMap: Record<string, string> = {
  "free-fire": freefireLogo,
  "blood-strike": bloodStrikeLogo,
  "pubg-mobile": pubgLogo,
  "call-of-duty-mobile": codmLogo,
  "ff-account": ffAcc,
  "pubg-account": pubgAcc,
  "codm-account": codmAcc,
  "bs-account": bsAcc,
  "diamond-world": diamonds,
  "battle-world": battle,
};

export function resolveArtwork(key: string): string {
  return artworkMap[key] ?? "";
}

function getServerOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (option): option is string =>
      typeof option === "string" && option.trim().length > 0 && option.trim().length <= 80,
  );
}

function getProductCategory(value: unknown): ProductDoc["category"] {
  return value === "diamonds" ||
    value === "memberships" ||
    value === "level-up-passes" ||
    value === "evo-access" ||
    value === "gold" ||
    value === "passes" ||
    value === "uc"
    ? value
    : undefined;
}

// ─── Games ───────────────────────────────────────────────────────────────────

export async function fetchGames(): Promise<CatalogGame[]> {
  const catalog = await fetchApiCatalog();
  const docs = catalog.games.map((data) => {
    const image = data.imageUrl?.trim() || resolveArtwork(data.artworkKey);
    return {
      id: data.slug,
      name: data.name,
      currency: data.currency,
      tone: data.tone,
      icon: data.icon,
      image,
      logo: image,
      artworkKey: data.artworkKey,
      imageUrl: data.imageUrl ?? null,
      description: data.description,
      serverOptions: getServerOptions(data.serverOptions),
      active: data.active,
      displayOrder: data.displayOrder,
    };
  });
  return docs.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function fetchGame(slug: string): Promise<CatalogGame | null> {
  const catalog = await fetchApiCatalog();
  const data = catalog.games.find((game) => game.slug === slug);
  if (!data) return null;
  const image = data.imageUrl?.trim() || resolveArtwork(data.artworkKey);
  return {
    id: data.slug,
    name: data.name,
    currency: data.currency,
    tone: data.tone,
    icon: data.icon,
    image,
    logo: image,
    artworkKey: data.artworkKey,
    imageUrl: data.imageUrl ?? null,
    description: data.description,
    serverOptions: getServerOptions(data.serverOptions),
    active: data.active,
    displayOrder: data.displayOrder,
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function fetchProducts(gameSlug: string): Promise<ProductDoc[]> {
  const catalog = await fetchApiCatalog();
  const docs = catalog.products
    .filter((product) => product.gameSlug === gameSlug)
    .map((data) => {
      const category = getProductCategory(data.category);
      return {
        ...data,
        ...(category ? { category } : {}),
        createdAt: typeof data.createdAt === "number" ? data.createdAt : null,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : null,
      } as ProductDoc;
    });
  return docs.sort((a, b) => a.displayOrder - b.displayOrder);
}

// ─── Game Accounts (via API) ───────────────────────────────────────────────────

export async function fetchGameAccounts(gameId?: string): Promise<GameAccountDoc[]> {
  const { accounts } = await fetchApiAccounts(gameId);
  return accounts as unknown as GameAccountDoc[];
}

export async function fetchGameAccount(id: string): Promise<GameAccountDoc | null> {
  try {
    const { account } = await fetchApiAccount(id);
    return account as unknown as GameAccountDoc;
  } catch {
    return null;
  }
}

// ─── FAQs (via API) ────────────────────────────────────────────────────────────

export interface StoreFaq {
  question: string;
  answer: string;
}

export async function fetchStoreFaqs(): Promise<StoreFaq[] | null> {
  const { items } = await fetchApiFaqs();
  return items;
}

// ─── Store settings ────────────────────────────────────────────────────────────

export async function fetchStoreSettings(): Promise<SettingsDoc | null> {
  const { settings: data } = await fetchApiCatalog();
  if (!data) return null;
  return {
    storeName: typeof data["storeName"] === "string" ? data["storeName"] : "HASA GOLD STORE",
    tagline: typeof data["tagline"] === "string" ? data["tagline"] : "",
    supportEmail: typeof data["supportEmail"] === "string" ? data["supportEmail"] : "",
    supportWhatsapp: typeof data["supportWhatsapp"] === "string" ? data["supportWhatsapp"] : "",
    paymentEzcashNumber:
      typeof data["paymentEzcashNumber"] === "string" ? data["paymentEzcashNumber"] : "",
    paymentEzcashName:
      typeof data["paymentEzcashName"] === "string" ? data["paymentEzcashName"] : "",
    currency: typeof data["currency"] === "string" ? data["currency"] : "LKR",
    bannerEnabled: data["bannerEnabled"] === true,
    maintenanceMode: data["maintenanceMode"] === true,
    maintenanceTitle:
      typeof data["maintenanceTitle"] === "string" ? data["maintenanceTitle"] : undefined,
    maintenanceMessage:
      typeof data["maintenanceMessage"] === "string" ? data["maintenanceMessage"] : undefined,
    paymentMethods: parsePaymentMethods(data["paymentMethods"]),
    updatedAt: typeof data["updatedAt"] === "number" ? data["updatedAt"] : null,
  };
}

// ─── User profile (via API) ────────────────────────────────────────────────────

export async function ensureUserDoc(args: {
  uid: string;
  email: string;
  displayName: string;
  profileComplete?: boolean;
}): Promise<void> {
  await ensureApiProfile();
}

export async function fetchUserDoc(uid: string): Promise<UserDoc | null> {
  const result = await ensureApiProfile();
  return result.profile as unknown as UserDoc;
}

export async function updateUserDoc(
  uid: string,
  values: Partial<
    Pick<
      UserDoc,
      | "displayName"
      | "notificationPrefs"
      | "savedPlayerIds"
      | "recentViewedGames"
      | "favorites"
      | "theme"
    >
  >,
): Promise<void> {
  await updateApiProfile(values);
}

// ─── Orders (via API) ──────────────────────────────────────────────────────────

export interface UserOrdersPage {
  orders: OrderDoc[];
  nextCursor: string | null;
}

export async function fetchUserOrders(uid: string, cursor: string | null): Promise<UserOrdersPage> {
  const { fetchApiOrders } = await import("@/lib/api-client");
  const result = await fetchApiOrders(25);
  const orders = result.orders.map((order) => ({
    ...order,
    orderId: order.id,
    createdAt: typeof order.createdAt === "number" ? order.createdAt : null,
    updatedAt: typeof order.updatedAt === "number" ? order.updatedAt : null,
  })) as unknown as OrderDoc[];
  return { orders, nextCursor: null };
}

// ─── Wallet (via API, polling) ─────────────────────────────────────────────────

export async function fetchWalletData(uid: string): Promise<{
  balance: number;
  deposits: WalletDepositDoc[];
  adjustments: WalletAdjustmentDoc[];
  orders: OrderDoc[];
}> {
  const data = await getApiWallet();
  const orders = ((data.orders as unknown as Array<Record<string, unknown>>) || []).map(
    (order) => ({
      ...order,
      orderId: (order.id as string) || (order.orderId as string) || "",
    }),
  ) as unknown as OrderDoc[];
  return {
    balance: data.balance,
    deposits: data.deposits as unknown as WalletDepositDoc[],
    adjustments: data.adjustments as unknown as WalletAdjustmentDoc[],
    orders,
  };
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export function useGames() {
  // Catalog data is small and admin edits must appear immediately.
  return useQuery({ queryKey: ["games"], queryFn: fetchGames, staleTime: 0 });
}
export function useGame(slug: string | undefined) {
  return useQuery({
    queryKey: ["game", slug],
    queryFn: () => (slug ? fetchGame(slug) : Promise.resolve(null)),
    enabled: Boolean(slug),
    staleTime: 0,
  });
}
export function useProducts(gameSlug: string | undefined) {
  return useQuery({
    queryKey: ["products", gameSlug],
    queryFn: () => (gameSlug ? fetchProducts(gameSlug) : Promise.resolve([])),
    enabled: Boolean(gameSlug),
    staleTime: 0,
  });
}
export function useGameAccounts(gameId?: string) {
  return useQuery({
    queryKey: ["gameAccounts", gameId ?? "all"],
    queryFn: () => fetchGameAccounts(gameId),
    staleTime: 0,
  });
}
export function useGameAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["gameAccount", id],
    queryFn: () => (id ? fetchGameAccount(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    staleTime: 0,
  });
}
export function useUserOrders(uid: string | null | undefined) {
  return useQuery({
    queryKey: ["userOrders", uid],
    queryFn: () =>
      uid ? fetchUserOrders(uid, null) : Promise.resolve({ orders: [], nextCursor: null }),
    enabled: Boolean(uid),
    staleTime: 60_000,
    refetchInterval: 30_000,
  });
}

// ─── Wallet data polling hook ──────────────────────────────────────────────────

export function useWalletData(uid: string | null | undefined) {
  return useQuery({
    queryKey: ["wallet", uid],
    queryFn: () =>
      uid
        ? fetchWalletData(uid)
        : Promise.resolve({ balance: 0, deposits: [], adjustments: [], orders: [] }),
    enabled: Boolean(uid),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
