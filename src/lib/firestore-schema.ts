/**
 * Firestore data model — HASA GOLD STORE
 *
 * Collections:
 *   games/{slug}          — top-up game catalog
 *   products/{id}         — purchasable top-up packages
 *   gameAccounts/{id}     — game account marketplace listings
 *   users/{uid}           — customer profile (keyed by Firebase Auth UID)
 *   orders/{orderId}      — server-created order records
 *   settings/store        — non-secret public store config
 */

export type GameTone = "ice" | "ember" | "olive" | "violet";
export type GameIcon = "diamond" | "coins";
export const PRODUCT_CATEGORIES = [
  { id: "diamonds", label: "Diamonds" },
  { id: "memberships", label: "Memberships" },
  { id: "level-up-passes", label: "Level Up Passes" },
  { id: "evo-access", label: "Evo Access" },
  { id: "gold", label: "Gold" },
  { id: "passes", label: "Passes" },
  { id: "uc", label: "UC" },
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]["id"];

export const GAME_CATEGORY_MAP: Record<string, readonly { id: ProductCategory; label: string }[]> =
  {
    "free-fire": [
      { id: "diamonds", label: "Diamonds" },
      { id: "memberships", label: "Memberships" },
      { id: "level-up-passes", label: "Level Up Passes" },
      { id: "evo-access", label: "Evo Access" },
    ],
    "blood-strike": [
      { id: "gold", label: "Gold" },
      { id: "passes", label: "Passes" },
    ],
    "pubg-mobile": [
      { id: "uc", label: "UC" },
      { id: "passes", label: "Passes" },
    ],
  };

export function getCategoriesForGame(
  gameSlug: string,
): readonly { id: ProductCategory; label: string }[] {
  if (GAME_CATEGORY_MAP[gameSlug]) {
    return GAME_CATEGORY_MAP[gameSlug];
  }
  return PRODUCT_CATEGORIES;
}
export type OrderStatus =
  | "pending"
  | "payment_review"
  | "paid"
  | "processing"
  | "completed"
  | "delivered"
  | "failed"
  | "cancelled"
  | "refunded";
export type PaymentStatus =
  "unpaid" | "pending" | "proof_submitted" | "paid" | "failed" | "proof_rejected" | "refunded";
/** Built-in wallet plus any admin-defined manual method id. */
export type PaymentMethod = string;
export type PaymentMethodKind = "wallet" | "manual";
export type UserRole = "customer" | "admin";
export type AccountStatus = "Available" | "Reserved" | "Sold";
export type ThemeChoice = "light" | "dark" | "system";

export interface GameDoc {
  slug: string;
  name: string;
  currency: string;
  tone: GameTone;
  icon: GameIcon;
  artworkKey: string;
  imageUrl?: string | null;
  description: string;
  serverOptions?: string[];
  active: boolean;
  displayOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface ProductDoc {
  id: string;
  gameSlug: string;
  nexauraProductId?: string;
  category?: ProductCategory;
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
  createdAt: number | null;
  updatedAt: number | null;
}

export interface GameAccountDoc {
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
  tone: GameTone;
  verified: boolean;
  status: AccountStatus;
  badges: string[];
  inventoryHighlights: string[];
  description: string;
  features: { label: string; value: string }[];
  active: boolean;
  displayOrder: number;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface UserDoc {
  uid: string;
  memberId?: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  profileComplete?: boolean;
  termsAcceptedAt?: number | null;
  role: UserRole;
  notificationPrefs: { updates: boolean; reminders: boolean };
  savedPlayerIds: Record<string, string>;
  recentViewedGames: string[];
  favorites: string[];
  theme: ThemeChoice;
  /** Wallet balance in Sri Lankan Rupees, managed server-side. */
  walletBalanceLkr?: number;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface OrderDoc {
  orderId: string;
  customerUid: string;
  customerEmail: string;
  gameSlug: string;
  gameName: string;
  productId: string;
  nexauraProductId?: string;
  nexauraOrderId?: string;
  nexauraStatus?: string;
  nexauraNote?: string | null;
  nexauraLastError?: string;
  packageName: string;
  amount: number;
  unitLabel: string;
  priceUsd: number;
  pricePkr: number;
  currency: string;
  playerId: string;
  playerName?: string | null;
  playerNameLookupStatus?: "verified" | "unavailable" | "not_supported";
  playerRegion?: string | null;
  playerNameSource?: "live" | "saved" | null;
  server: string;
  paymentMethod?: string;
  paymentRecipient?: string;
  paymentStatus: PaymentStatus;
  paymentProofStoragePath?: string;
  paymentProofStorageProvider?: "supabase";
  paymentProofContentType?: string;
  paymentProofFileName?: string;
  paymentProofSubmittedAt?: number | null;
  status: OrderStatus;
  createdAt: number | null;
  updatedAt: number | null;
}

export type WalletDepositStatus = "pending" | "credited" | "failed";

export interface WalletDepositDoc {
  depositId: string;
  uid: string;
  referenceNumber: string;
  method: string;
  status: WalletDepositStatus;
  creditedLkr: number;
  createdAt: number | null;
  updatedAt: number | null;
  creditedAt: number | null;
}

export interface WalletAdjustmentDoc {
  adjustmentId: string;
  uid: string;
  amountLkr: number;
  reason: string;
  adminUid: string;
  createdAt: number | null;
}

export interface PaymentMethodConfig {
  id: string;
  name: string;
  sub: string;
  short: string;
  active: boolean;
  /** "wallet" uses the in-app balance; "manual" requires payment proof review. */
  kind?: PaymentMethodKind;
  logoUrl?: string | null;
  /** Account holder name shown at checkout for manual methods. */
  accountName?: string | null;
  /** Account / wallet number customers send money to for manual methods. */
  accountNumber?: string | null;
  /** Manual methods only: require the customer to upload a payment receipt. */
  requiresProof?: boolean;
  /** Game slugs this method is restricted to. Empty / undefined = all games. */
  games?: string[];
  /** Show a warning banner at checkout for this method (e.g. extra fee notice). */
  warningEnabled?: boolean;
  /** Short heading for the warning banner. */
  warningTitle?: string | null;
  /** Body copy for the warning banner. */
  warningMessage?: string | null;
}

export interface SettingsDoc {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportWhatsapp: string;
  paymentEzcashNumber: string;
  paymentEzcashName: string;
  currency: string;
  bannerEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  /** Optional list of payment method configuration exposed in settings/store */
  paymentMethods?: PaymentMethodConfig[];
  updatedAt: number | null;
}

export interface CatalogGame {
  id: string;
  name: string;
  currency: string;
  tone: GameTone;
  icon: GameIcon;
  image: string;
  logo: string;
  artworkKey: string;
  imageUrl?: string | null;
  description: string;
  serverOptions: string[];
  active: boolean;
  displayOrder: number;
}
