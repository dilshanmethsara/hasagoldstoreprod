# Legacy — do not run in production

## `migrate-firestore-to-neon.js`

This was the one-off migration that copied the **legacy Firestore catalog** into
Neon/PostgreSQL. It was used while the store was moving off Firestore.

> **DO NOT RUN THIS AGAINST THE LIVE DATABASE.**
>
> The Firestore copy is frozen and older than the live Neon data. Running this
> script re-writes `store_settings` (payment methods, eZ Cash account details,
> FAQs, store settings) from that stale snapshot and can silently delete or
> revert production configuration — it is exactly what deleted the
> **Bank Transfer** payment method once already.

The live API is Neon-only and reads/writes the current rows directly. The
schema lives in `sql/schema.sql` and `sql/migrations/`; apply those with
`psql` when a migration is genuinely needed.
