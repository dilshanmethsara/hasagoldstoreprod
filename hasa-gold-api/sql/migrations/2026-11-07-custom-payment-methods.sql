-- Allow admin-defined payment method ids (previously limited to wallet/ezcash).
-- Safe to run more than once.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_format_check
  CHECK (payment_method IS NULL OR payment_method ~ '^[a-z0-9][a-z0-9_-]{0,49}$');

-- Existing rows keep working; no data rewrite is required.
