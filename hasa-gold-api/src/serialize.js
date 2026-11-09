/**
 * Row → API response mappers.
 *
 * The frontend contract is Firestore-shaped (camelCase field names, epoch-ms
 * timestamps). The PostgreSQL schema uses snake_case columns. These mappers
 * convert Postgres rows back into the exact JSON shapes the frontend already
 * consumes, so no frontend field-name changes are required.
 *
 * `toMs`/`toNum` are driver-agnostic: they accept Date, number or string so the
 * same code works against `pg` (Neon) and PGlite (tests).
 */

/** Convert a timestamp value (Date | number | ISO string) to epoch-ms number. */
export function toMs(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return Number(value);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Convert a numeric value (number | string) to a JS number, or null. */
export function toNum(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function arr(value) {
  return Array.isArray(value) ? value : value == null ? null : [];
}

export function mapGame(row) {
  if (!row) return null;
  return {
    id: row.slug,
    slug: row.slug,
    name: row.name,
    currency: row.currency,
    tone: row.tone,
    icon: row.icon,
    artworkKey: row.artwork_key,
    imageUrl: row.image_url ?? null,
    description: row.description,
    serverOptions: arr(row.server_options) ?? [],
    active: row.active,
    displayOrder: toNum(row.display_order) ?? 0,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

export function mapProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    gameSlug: row.game_slug,
    nexauraProductId: row.nexaura_product_id ?? undefined,
    category: row.category ?? undefined,
    amount: toNum(row.amount) ?? 0,
    unitLabel: row.unit_label,
    name: row.name,
    imageUrl: row.image_url ?? null,
    priceUsd: toNum(row.price_usd) ?? 0,
    pricePkr: toNum(row.price_pkr) ?? 0,
    bonus: toNum(row.bonus) ?? 0,
    isPopular: row.is_popular,
    isBestValue: row.is_best_value,
    isVip: row.is_vip,
    active: row.active,
    displayOrder: toNum(row.display_order) ?? 0,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

export function mapGameAccount(row) {
  if (!row) return null;
  return {
    id: row.id,
    gameId: row.game_id,
    gameName: row.game_name,
    title: row.title,
    tagline: row.tagline,
    priceUsd: toNum(row.price_usd) ?? 0,
    pricePkr: toNum(row.price_pkr) ?? 0,
    priceSample: row.price_sample,
    level: toNum(row.level) ?? 0,
    rank: row.rank,
    server: row.server,
    loginType: row.login_type,
    artworkKey: row.artwork_key,
    tone: row.tone,
    verified: row.verified,
    status: row.status,
    badges: arr(row.badges) ?? [],
    inventoryHighlights: arr(row.inventory_highlights) ?? [],
    description: row.description,
    features: Array.isArray(row.features) ? row.features : [],
    active: row.active,
    displayOrder: toNum(row.display_order) ?? 0,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

export function mapUser(row) {
  if (!row) return null;
  return {
    uid: row.uid,
    memberId: row.member_id ?? undefined,
    email: row.email,
    displayName: row.display_name,
    phoneNumber: row.phone_number ?? undefined,
    profileComplete: row.profile_complete,
    termsAcceptedAt: toMs(row.terms_accepted_at),
    role: row.role,
    notificationPrefs: {
      updates: row.notification_updates,
      reminders: row.notification_reminders,
    },
    savedPlayerIds:
      row.saved_player_ids &&
      typeof row.saved_player_ids === "object" &&
      !Array.isArray(row.saved_player_ids)
        ? row.saved_player_ids
        : {},
    recentViewedGames: arr(row.recent_viewed_games) ?? [],
    favorites: arr(row.favorites) ?? [],
    theme: row.theme,
    walletBalanceLkr: toNum(row.wallet_balance_lkr) ?? 0,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

export function mapOrder(row) {
  if (!row) return null;
  return {
    id: row.order_id,
    customerUid: row.customer_uid,
    customerEmail: row.customer_email,
    gameSlug: row.game_slug,
    gameName: row.game_name,
    productId: row.product_id ?? undefined,
    nexauraProductId: row.nexaura_product_id ?? undefined,
    nexauraOrderId: row.nexaura_order_id ?? undefined,
    nexauraStatus: row.nexaura_status ?? undefined,
    nexauraNote: row.nexaura_note ?? null,
    nexauraLastError: row.nexaura_last_error ?? undefined,
    nexauraInternalError: row.nexaura_internal_error ?? undefined,
    packageName: row.package_name,
    amount: toNum(row.amount) ?? 0,
    unitLabel: row.unit_label,
    priceUsd: toNum(row.price_usd) ?? 0,
    pricePkr: toNum(row.price_pkr) ?? 0,
    currency: row.currency,
    playerId: row.player_id,
    playerName: row.player_name ?? null,
    playerNameLookupStatus: row.player_name_lookup_status ?? undefined,
    playerRegion: row.player_region ?? null,
    playerNameSource: row.player_name_source ?? null,
    server: row.server,
    paymentMethod: row.payment_method ?? undefined,
    paymentRecipient: row.payment_recipient ?? undefined,
    paymentStatus: row.payment_status,
    paymentProofStoragePath: row.payment_proof_storage_path ?? undefined,
    paymentProofStorageProvider: row.payment_proof_storage_provider ?? undefined,
    paymentProofContentType: row.payment_proof_content_type ?? undefined,
    paymentProofFileName: row.payment_proof_file_name ?? undefined,
    paymentProofSubmittedAt: toMs(row.payment_proof_submitted_at),
    paymentReviewedBy: row.payment_reviewed_by ?? undefined,
    paymentReviewedAt: toMs(row.payment_reviewed_at),
    status: row.status,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}

export function mapWalletDeposit(row) {
  if (!row) return null;
  return {
    id: row.deposit_id,
    depositId: row.deposit_id,
    uid: row.uid,
    referenceNumber: row.reference_number,
    method: row.method,
    status: row.status,
    creditedLkr: toNum(row.credited_lkr) ?? 0,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
    creditedAt: toMs(row.credited_at),
  };
}

export function mapWalletAdjustment(row) {
  if (!row) return null;
  return {
    id: row.adjustment_id,
    adjustmentId: row.adjustment_id,
    uid: row.uid,
    amountLkr: toNum(row.amount_lkr) ?? 0,
    reason: row.reason,
    adminUid: row.admin_uid,
    createdAt: toMs(row.created_at),
  };
}

export function mapStoreSettings(row) {
  if (!row) return null;
  return {
    storeName: row.store_name,
    tagline: row.tagline,
    supportEmail: row.support_email,
    supportWhatsapp: row.support_whatsapp,
    paymentEzcashNumber: row.payment_ezcash_number,
    paymentEzcashName: row.payment_ezcash_name,
    currency: row.currency,
    bannerEnabled: row.banner_enabled,
    maintenanceMode: row.maintenance_mode,
    maintenanceTitle: row.maintenance_title ?? undefined,
    maintenanceMessage: row.maintenance_message ?? undefined,
    paymentMethods: Array.isArray(row.payment_methods) ? row.payment_methods : [],
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
  };
}
