-- ============================================================================
-- HASA GOLD STORE — Neon PostgreSQL schema (Firestore migration target)
-- ----------------------------------------------------------------------------
-- Generated from the Stage 1 read-only audit. This file is idempotent: every
-- object uses IF NOT EXISTS so it can be re-run safely on a fresh database.
--
-- Conventions:
--   * All Firestore auto/string IDs are preserved as text primary keys so
--     storage paths (${uid}/${orderId}/proof), idempotency keys, provider
--     deposit IDs and ledger references stay valid.
--   * Firebase Auth UIDs are the universal customer key (kept on Firebase).
--   * price_pkr columns hold LKR values (legacy field name preserved for a
--     safe 1:1 value migration). Do NOT rename without an explicit change.
--   * Currency/amount columns use numeric(18,2) (lossless for 2-decimal LKR).
--   * Timestamps use timestamptz; DEFAULT now() replaces FieldValue.serverTimestamp().
--   * JSONB is used only where structure is genuinely dynamic (payment methods,
--     faq items, saved_player_ids map, account features). Simple string
--     arrays use text[].
--   * CHECK constraints (not enums) so unknown legacy values fail loudly.
-- ============================================================================

-- ---------- games ----------
CREATE TABLE IF NOT EXISTS games (
  slug            text PRIMARY KEY,
  name            text NOT NULL,
  currency        text NOT NULL DEFAULT 'LKR',
  tone            text NOT NULL DEFAULT 'ice' CHECK (tone IN ('ice','ember','olive','violet')),
  icon            text NOT NULL DEFAULT 'diamond' CHECK (icon IN ('diamond','coins')),
  artwork_key     text NOT NULL,
  image_url       text,
  description     text NOT NULL DEFAULT '',
  server_options  text[] NOT NULL DEFAULT '{}',
  active          boolean NOT NULL DEFAULT true,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS games_catalog_idx ON games (active, display_order);

-- ---------- products ----------
CREATE TABLE IF NOT EXISTS products (
  id                 text PRIMARY KEY,
  game_slug          text NOT NULL REFERENCES games(slug),
  nexaura_product_id text,
  category           text CHECK (category IN
                       ('diamonds','memberships','level-up-passes',
                        'evo-access','gold','passes','uc')),
  amount             numeric(18,2) NOT NULL,
  unit_label         text NOT NULL,
  name               text NOT NULL,
  image_url          text,
  price_usd          numeric(18,2) NOT NULL,
  price_pkr          numeric(18,2) NOT NULL,   -- holds LKR (legacy name preserved)
  bonus              numeric(18,2) NOT NULL DEFAULT 0,
  is_popular         boolean NOT NULL DEFAULT false,
  is_best_value      boolean NOT NULL DEFAULT false,
  is_vip             boolean NOT NULL DEFAULT false,
  active             boolean NOT NULL DEFAULT true,
  display_order      integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_catalog_idx ON products (game_slug, active, display_order);

-- ---------- game_accounts ----------
CREATE TABLE IF NOT EXISTS game_accounts (
  id                   text PRIMARY KEY,
  game_id              text NOT NULL REFERENCES games(slug),
  game_name            text NOT NULL,
  title                text NOT NULL,
  tagline              text NOT NULL DEFAULT '',
  price_usd            numeric(18,2) NOT NULL,
  price_pkr            numeric(18,2) NOT NULL,   -- holds LKR
  price_sample         text NOT NULL DEFAULT '',
  level                integer NOT NULL DEFAULT 0,
  rank                 text NOT NULL DEFAULT '',
  server               text NOT NULL DEFAULT '',
  login_type           text NOT NULL DEFAULT '',
  artwork_key          text NOT NULL,
  tone                 text NOT NULL DEFAULT 'ice' CHECK (tone IN ('ice','ember','olive','violet')),
  verified             boolean NOT NULL DEFAULT false,
  status               text NOT NULL DEFAULT 'Available' CHECK (status IN ('Available','Reserved','Sold')),
  badges               text[] NOT NULL DEFAULT '{}',
  inventory_highlights text[] NOT NULL DEFAULT '{}',
  description          text NOT NULL DEFAULT '',
  features             jsonb NOT NULL DEFAULT '[]',
  active               boolean NOT NULL DEFAULT true,
  display_order        integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS game_accounts_catalog_idx ON game_accounts (game_id, active, display_order);

-- ---------- store_settings (settings/store) — single row ----------
CREATE TABLE IF NOT EXISTS store_settings (
  id                   smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_name           text NOT NULL DEFAULT '',
  tagline              text NOT NULL DEFAULT '',
  support_email        text NOT NULL DEFAULT '',
  support_whatsapp     text NOT NULL DEFAULT '',
  payment_ezcash_number text NOT NULL DEFAULT '',
  payment_ezcash_name  text NOT NULL DEFAULT '',
  currency             text NOT NULL DEFAULT 'LKR',
  banner_enabled       boolean NOT NULL DEFAULT false,
  maintenance_mode     boolean NOT NULL DEFAULT false,
  maintenance_title    text,
  maintenance_message  text,
  payment_methods      jsonb NOT NULL DEFAULT '[]',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------- faqs (settings/faqs) — single row ----------
CREATE TABLE IF NOT EXISTS faqs (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  items       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- users (keyed by Firebase Auth UID) ----------
CREATE TABLE IF NOT EXISTS users (
  uid                   text PRIMARY KEY,
  member_id             text UNIQUE,
  email                 text NOT NULL DEFAULT '',
  display_name          text NOT NULL DEFAULT '',
  phone_number          text,
  profile_complete      boolean NOT NULL DEFAULT false,
  terms_accepted_at     timestamptz,
  role                  text NOT NULL DEFAULT 'customer',
  notification_updates  boolean NOT NULL DEFAULT false,
  notification_reminders boolean NOT NULL DEFAULT false,
  saved_player_ids      jsonb NOT NULL DEFAULT '{}',
  recent_viewed_games   text[] NOT NULL DEFAULT '{}',
  favorites             text[] NOT NULL DEFAULT '{}',
  theme                 text NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  wallet_balance_lkr    numeric(18,2) NOT NULL DEFAULT 0,   -- absent in legacy -> 0
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS users_member_id_idx ON users (member_id) WHERE member_id IS NOT NULL;

-- ---------- orders (snapshot of product at order time) ----------
CREATE TABLE IF NOT EXISTS orders (
  order_id              text PRIMARY KEY,
  customer_uid          text NOT NULL REFERENCES users(uid),
  customer_email        text NOT NULL DEFAULT '',
  game_slug             text NOT NULL REFERENCES games(slug),
  game_name             text NOT NULL,
  product_id            text,                  -- snapshot ref, no hard FK (product may be archived)
  nexaura_product_id    text,
  nexaura_order_id      text,
  nexaura_status        text,
  nexaura_note          text,
  nexaura_last_error    text,                  -- FieldValue.delete() -> NULL
  nexaura_internal_error text,
  package_name          text NOT NULL,
  amount                numeric(18,2) NOT NULL,
  unit_label            text NOT NULL,
  price_usd             numeric(18,2) NOT NULL,
  price_pkr             numeric(18,2) NOT NULL, -- LKR
  currency              text NOT NULL DEFAULT 'LKR',
  player_id             text NOT NULL,
  player_name           text,
  player_name_lookup_status text CHECK (player_name_lookup_status IN
                          ('verified','unavailable','not_supported')),
  player_region         text,
  player_name_source    text CHECK (player_name_source IN ('live','saved')),
  server                text NOT NULL DEFAULT '',
  payment_method        text,
  payment_recipient     text,
  payment_status        text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN
                        ('unpaid','pending','proof_submitted','paid',
                         'failed','proof_rejected','refunded')),
  payment_proof_storage_path text,
  payment_proof_storage_provider text,
  payment_proof_content_type text,
  payment_proof_file_name text,
  payment_proof_submitted_at timestamptz,
  payment_reviewed_by   text REFERENCES users(uid),
  payment_reviewed_at   timestamptz,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending','payment_review','paid','processing',
                         'completed','delivered','failed','cancelled','refunded')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_customer_idx        ON orders (customer_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx  ON orders (payment_status);
CREATE INDEX IF NOT EXISTS orders_nexaura_status_idx  ON orders (nexaura_status);
CREATE INDEX IF NOT EXISTS orders_admin_list_idx      ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_product_id_idx      ON orders (product_id) WHERE product_id IS NOT NULL;

-- ---------- order_idempotency ----------
CREATE TABLE IF NOT EXISTS order_idempotency (
  key_id      text PRIMARY KEY,              -- sha256(uid:key)
  uid         text NOT NULL REFERENCES users(uid),
  order_id    text REFERENCES orders(order_id),
  fingerprint text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_idempotency_uid_idx ON order_idempotency (uid);

-- ---------- wallet_deposits ----------
CREATE TABLE IF NOT EXISTS wallet_deposits (
  deposit_id       text PRIMARY KEY,         -- provider-issued
  uid              text NOT NULL REFERENCES users(uid),
  reference_number text NOT NULL,           -- 14-digit eZ Cash RN
  method           text NOT NULL DEFAULT 'ezcash',
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN
                     ('pending','submitting','credited','failed')),
  credited_lkr     numeric(18,2) NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  credited_at      timestamptz
);
CREATE INDEX IF NOT EXISTS wallet_deposits_uid_idx ON wallet_deposits (uid, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_deposits_rn_uniq ON wallet_deposits (reference_number);

-- ---------- wallet_deposit_rns (RN uniqueness gate) ----------
CREATE TABLE IF NOT EXISTS wallet_deposit_rns (
  claim_id         text PRIMARY KEY,         -- sha256(reference_number)
  uid              text NOT NULL REFERENCES users(uid),
  reference_number text NOT NULL,
  deposit_id       text REFERENCES wallet_deposits(deposit_id),
  status           text NOT NULL DEFAULT 'submitting',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_deposit_rns_rn_uniq ON wallet_deposit_rns (reference_number);

-- ---------- wallet_adjustments (signed amount; ledger) ----------
CREATE TABLE IF NOT EXISTS wallet_adjustments (
  adjustment_id text PRIMARY KEY,           -- preserve Firestore auto-id
  uid           text NOT NULL REFERENCES users(uid),
  amount_lkr    numeric(18,2) NOT NULL,     -- signed: + credit / - deduct
  reason        text NOT NULL,
  admin_uid     text NOT NULL REFERENCES users(uid),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_adjustments_uid_idx ON wallet_adjustments (uid, created_at DESC);

-- ---------- member_ids (reverse index; one per user) ----------
CREATE TABLE IF NOT EXISTS member_ids (
  member_id   text PRIMARY KEY,              -- HG-XXXXXXXX
  uid         text NOT NULL UNIQUE REFERENCES users(uid),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- topup_submissions ----------
CREATE TABLE IF NOT EXISTS topup_submissions (
  order_id          text PRIMARY KEY REFERENCES orders(order_id),
  status            text NOT NULL DEFAULT 'submitting',
  provider_order_id text,
  internal_error    text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
