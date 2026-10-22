import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
  runTransaction,
  updateDoc,
  getFirestore,
  onSnapshot,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { FirebaseSetupError, getFirebaseApp, isFirebaseConfigured } from "@/lib/firebase";
import type {
  CatalogGame,
  GameAccountDoc,
  GameDoc,
  OrderDoc,
  ProductDoc,
  SettingsDoc,
  ThemeChoice,
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

function toMs(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const v = value as { toMillis?: () => number };
  return typeof v.toMillis === "function" ? v.toMillis() : null;
}

function getDb() {
  return getFirestore(getFirebaseApp());
}

function getServerOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (option): option is string =>
      typeof option === "string" && option.trim().length > 0 && option.trim().length <= 80,
  );
}

// ─── Games ───────────────────────────────────────────────────────────────────

export async function fetchGames(): Promise<CatalogGame[]> {
  const snap = await getDocs(query(collection(getDb(), "games"), where("active", "==", true)));
  const docs = snap.docs.map((d) => {
    const data = d.data() as GameDoc;
    const image = resolveArtwork(data.artworkKey);
    return {
      id: data.slug,
      name: data.name,
      currency: data.currency,
      tone: data.tone,
      icon: data.icon,
      image,
      logo: image,
      artworkKey: data.artworkKey,
      description: data.description,
      serverOptions: getServerOptions(data.serverOptions),
      active: data.active,
      displayOrder: data.displayOrder,
    };
  });
  return docs.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function fetchGame(slug: string): Promise<CatalogGame | null> {
  const snap = await getDoc(doc(getDb(), "games", slug));
  if (!snap.exists()) return null;
  const data = snap.data() as GameDoc;
  if (!data.active) return null;
  const image = resolveArtwork(data.artworkKey);
  return {
    id: data.slug,
    name: data.name,
    currency: data.currency,
    tone: data.tone,
    icon: data.icon,
    image,
    logo: image,
    artworkKey: data.artworkKey,
    description: data.description,
    serverOptions: getServerOptions(data.serverOptions),
    active: data.active,
    displayOrder: data.displayOrder,
  };
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function fetchProducts(gameSlug: string): Promise<ProductDoc[]> {
  const snap = await getDocs(
    query(
      collection(getDb(), "products"),
      where("gameSlug", "==", gameSlug),
      where("active", "==", true),
    ),
  );
  const docs = snap.docs.map((d) => {
    const data = d.data() as ProductDoc;
    return { ...data, createdAt: toMs(data.createdAt), updatedAt: toMs(data.updatedAt) };
  });
  return docs.sort((a, b) => a.displayOrder - b.displayOrder);
}

// ─── Game Accounts ───────────────────────────────────────────────────────────

export async function fetchGameAccounts(gameId?: string): Promise<GameAccountDoc[]> {
  const constraints = gameId
    ? [where("gameId", "==", gameId), where("active", "==", true)]
    : [where("active", "==", true)];
  const snap = await getDocs(query(collection(getDb(), "gameAccounts"), ...constraints));
  const docs = snap.docs.map((d) => {
    const data = d.data() as GameAccountDoc;
    return { ...data, createdAt: toMs(data.createdAt), updatedAt: toMs(data.updatedAt) };
  });
  return docs.sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function fetchGameAccount(id: string): Promise<GameAccountDoc | null> {
  const snap = await getDoc(doc(getDb(), "gameAccounts", id));
  if (!snap.exists()) return null;
  const data = snap.data() as GameAccountDoc;
  if (!data.active) return null;
  return { ...data, createdAt: toMs(data.createdAt), updatedAt: toMs(data.updatedAt) };
}

export interface StoreFaq {
  question: string;
  answer: string;
}

export async function fetchStoreFaqs(): Promise<StoreFaq[] | null> {
  const snapshot = await getDoc(doc(getDb(), "settings", "faqs"));
  if (!snapshot.exists()) return null;
  const items = snapshot.data()["items"];
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is StoreFaq =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof item["question"] === "string" &&
      typeof item["answer"] === "string",
    ),
  );
}

export async function fetchStoreSettings(): Promise<SettingsDoc | null> {
  const snapshot = await getDoc(doc(getDb(), "settings", "store"));
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
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
    paymentMethods: parsePaymentMethods(data["paymentMethods"]),
    updatedAt: toMs(data["updatedAt"]),
  };
}

// ─── User profile ─────────────────────────────────────────────────────────────

export async function ensureUserDoc(args: {
  uid: string;
  email: string;
  displayName: string;
  profileComplete?: boolean;
}): Promise<void> {
  if (!args.uid) throw new Error("Sign in to load your account profile.");
  const ref = doc(getDb(), "users", args.uid);
  await runTransaction(getDb(), async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      const data = existing.data() as Partial<UserDoc>;
      const notificationPrefs =
        data.notificationPrefs &&
        typeof data.notificationPrefs.updates === "boolean" &&
        typeof data.notificationPrefs.reminders === "boolean"
          ? data.notificationPrefs
          : { updates: false, reminders: false };
      const savedPlayerIds =
        data.savedPlayerIds &&
        typeof data.savedPlayerIds === "object" &&
        !Array.isArray(data.savedPlayerIds)
          ? data.savedPlayerIds
          : {};
      const recentViewedGames = Array.isArray(data.recentViewedGames)
        ? data.recentViewedGames
            .filter((game): game is string => typeof game === "string")
            .slice(0, 4)
        : [];
      const favorites = Array.isArray(data.favorites)
        ? data.favorites
            .filter((favorite): favorite is string => typeof favorite === "string")
            .slice(0, 100)
        : [];
      const theme =
        data.theme === "light" || data.theme === "dark" || data.theme === "system"
          ? data.theme
          : "system";
      const displayName =
        typeof data.displayName === "string" && data.displayName.trim().length <= 80
          ? data.displayName
          : args.displayName.slice(0, 80);

      const repair = {
        ...(data.displayName === displayName ? {} : { displayName }),
        ...(JSON.stringify(data.notificationPrefs) === JSON.stringify(notificationPrefs)
          ? {}
          : { notificationPrefs }),
        ...(JSON.stringify(data.savedPlayerIds) === JSON.stringify(savedPlayerIds)
          ? {}
          : { savedPlayerIds }),
        ...(JSON.stringify(data.recentViewedGames) === JSON.stringify(recentViewedGames)
          ? {}
          : { recentViewedGames }),
        ...(JSON.stringify(data.favorites) === JSON.stringify(favorites) ? {} : { favorites }),
        ...(data.theme === theme ? {} : { theme }),
      };
      if (Object.keys(repair).length) transaction.update(ref, { ...repair, updatedAt: Date.now() });
      return;
    }
    const newDoc: UserDoc = {
      uid: args.uid,
      email: args.email,
      displayName: args.displayName,
      role: "customer",
      notificationPrefs: { updates: false, reminders: false },
      savedPlayerIds: {},
      recentViewedGames: [],
      favorites: [],
      theme: "system",
      profileComplete: args.profileComplete ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    transaction.set(ref, newDoc);
  });
}

export async function fetchUserDoc(uid: string): Promise<UserDoc | null> {
  if (!uid) throw new Error("Sign in to load your account profile.");
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserDoc;
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
  if (!uid) throw new Error("Sign in to update your account preferences.");
  await updateDoc(doc(getDb(), "users", uid), { ...values, updatedAt: Date.now() });
}

// ─── Orders (user) ────────────────────────────────────────────────────────────

const USER_ORDERS_PAGE_SIZE = 25;

export interface UserOrdersPage {
  orders: OrderDoc[];
  nextCursor: QueryDocumentSnapshot<DocumentData> | null;
}

export async function fetchUserOrders(
  uid: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
): Promise<UserOrdersPage> {
  if (!uid) throw new Error("Sign in to load your orders.");
  const ordersCollection = collection(getDb(), "orders");
  const snap = await getDocs(
    cursor
      ? query(
          ordersCollection,
          where("customerUid", "==", uid),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(USER_ORDERS_PAGE_SIZE),
        )
      : query(
          ordersCollection,
          where("customerUid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(USER_ORDERS_PAGE_SIZE),
        ),
  );
  return {
    orders: snap.docs.map((d) => {
      const data = d.data() as OrderDoc;
      return {
        ...data,
        orderId: d.id,
        createdAt: toMs(data.createdAt),
        updatedAt: toMs(data.updatedAt),
      };
    }),
    nextCursor: snap.size === USER_ORDERS_PAGE_SIZE ? (snap.docs.at(-1) ?? null) : null,
  };
}

// ─── React Query hooks ────────────────────────────────────────────────────────

export function useGames() {
  return useQuery({ queryKey: ["games"], queryFn: fetchGames, staleTime: 5 * 60_000 });
}
export function useGame(slug: string | undefined) {
  return useQuery({
    queryKey: ["game", slug],
    queryFn: () => (slug ? fetchGame(slug) : Promise.resolve(null)),
    enabled: Boolean(slug),
    staleTime: 5 * 60_000,
  });
}
export function useProducts(gameSlug: string | undefined) {
  return useQuery({
    queryKey: ["products", gameSlug],
    queryFn: () => (gameSlug ? fetchProducts(gameSlug) : Promise.resolve([])),
    enabled: Boolean(gameSlug),
    staleTime: 30_000,
  });
}
export function useGameAccounts(gameId?: string) {
  return useQuery({
    queryKey: ["gameAccounts", gameId ?? "all"],
    queryFn: () => fetchGameAccounts(gameId),
    staleTime: 5 * 60_000,
  });
}
export function useGameAccount(id: string | undefined) {
  return useQuery({
    queryKey: ["gameAccount", id],
    queryFn: () => (id ? fetchGameAccount(id) : Promise.resolve(null)),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  });
}
export function useUserOrders(uid: string | null | undefined) {
  return useInfiniteQuery({
    queryKey: ["userOrders", uid],
    queryFn: ({ pageParam }) =>
      uid ? fetchUserOrders(uid, pageParam) : Promise.resolve({ orders: [], nextCursor: null }),
    enabled: Boolean(uid),
    initialPageParam: null as QueryDocumentSnapshot<DocumentData> | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchInterval: 10_000,
  });
}
// ─── Wallet ───────────────────────────────────────────────────────────────────

/**
 * Subscribe to real-time balance updates via Firestore onSnapshot.
 * Returns an unsubscribe function. Calls onBalance with the latest value
 * whenever Firestore pushes an update.
 */
export function subscribeWalletBalance(
  uid: string,
  onBalance: (lkr: number) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!uid) return () => {};
  if (!isFirebaseConfigured) {
    onError?.(new FirebaseSetupError());
    return () => {};
  }
  const ref = doc(getDb(), "users", uid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onBalance(0);
        return;
      }
      const data = snap.data() as UserDoc;
      onBalance(typeof data.walletBalanceLkr === "number" ? data.walletBalanceLkr : 0);
    },
    onError,
  );
}

/**
 * Subscribe to real-time deposit list updates via Firestore onSnapshot.
 */
export function subscribeWalletDeposits(
  uid: string,
  onDeposits: (deposits: WalletDepositDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!uid) return () => {};
  if (!isFirebaseConfigured) {
    onError?.(new FirebaseSetupError());
    return () => {};
  }
  const q = query(
    collection(getDb(), "wallet_deposits"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data() as WalletDepositDoc;
        return {
          ...data,
          createdAt: toMs(data.createdAt),
          updatedAt: toMs(data.updatedAt),
          creditedAt: toMs(data.creditedAt),
        };
      });
      onDeposits(docs);
    },
    onError,
  );
}

/**
 * Subscribe to administrator wallet adjustments for the signed-in customer.
 */
export function subscribeWalletAdjustments(
  uid: string,
  onAdjustments: (adjustments: WalletAdjustmentDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!uid) return () => {};
  if (!isFirebaseConfigured) {
    onError?.(new FirebaseSetupError());
    return () => {};
  }
  const q = query(
    collection(getDb(), "wallet_adjustments"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data() as WalletAdjustmentDoc;
        return { ...data, createdAt: toMs(data.createdAt) };
      });
      onAdjustments(docs);
    },
    onError,
  );
}

/**
 * Subscribe to recent customer orders so wallet-paid purchases appear in the
 * wallet ledger alongside deposits and administrator adjustments.
 */
export function subscribeWalletOrders(
  uid: string,
  onOrders: (orders: OrderDoc[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!uid) return () => {};
  if (!isFirebaseConfigured) {
    onError?.(new FirebaseSetupError());
    return () => {};
  }
  const q = query(
    collection(getDb(), "orders"),
    where("customerUid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(USER_ORDERS_PAGE_SIZE),
  );
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data() as OrderDoc;
        return {
          ...data,
          orderId: d.id,
          createdAt: toMs(data.createdAt),
          updatedAt: toMs(data.updatedAt),
        };
      });
      onOrders(docs);
    },
    onError,
  );
}
