# HASA GOLD STORE API

Production Express API for HASA GOLD STORE, live at `https://api.hasagold.store`.

- **Database:** Neon PostgreSQL is the only application datastore.
- **Identity:** Firebase Authentication is used **only** to verify ID tokens and
  manage accounts. Firestore is no longer read or written by this API.
- **Browser access:** the frontend never talks to Neon directly. Every customer
  and admin operation goes through this API over HTTPS.
- **Runtime:** Node.js 20+, Express 5, PM2 on the VPS, nginx in front.

> The frontend is not deployed yet. Everything in this README describes the
> backend as it runs on the VPS today.

---

## Routes

All responses are JSON. Protected routes require
`Authorization: Bearer <Firebase ID token>`. Customer routes additionally
require a verified email address and a completed profile.

### Public

| Method | Path                    | Purpose                                             |
| ------ | ----------------------- | --------------------------------------------------- |
| `GET`  | `/health`               | API + PostgreSQL readiness check                    |
| `GET`  | `/v1/catalog`           | Active games, products and public store settings    |
| `GET`  | `/v1/accounts`          | Active account listings (currently empty)           |
| `GET`  | `/v1/accounts/:id`      | Single account listing                              |
| `GET`  | `/v1/faqs`              | Active FAQs                                         |

### Customer (Firebase token)

| Method | Path                                  | Purpose                                       |
| ------ | ------------------------------------- | --------------------------------------------- |
| `POST` | `/v1/auth/ensure-profile`             | Create the profile row for a signed-in user   |
| `POST` | `/v1/auth/send-verification-email`    | Send the address-verification email          |
| `POST` | `/v1/profile/complete`                | Complete profile (name, phone, terms)         |
| `POST` | `/v1/profile/member-id`               | Issue the stable `HG-…` member ID            |
| `GET`  | `/v1/me`                              | Own profile                                   |
| `PUT`  | `/v1/me/profile`                      | Update own profile                            |
| `GET`  | `/v1/me/wallet`                       | Own wallet balance and history                |
| `GET`  | `/v1/orders`                          | Own orders                                    |
| `GET`  | `/v1/orders/:orderId`                 | One own order                                 |
| `POST` | `/v1/orders`                          | Create an order from live Neon catalog prices |
| `POST` | `/v1/orders/:orderId/proof/token`     | Signed upload URL for a payment receipt       |
| `POST` | `/v1/orders/:orderId/proof/submit`    | Confirm the receipt upload                    |
| `GET`  | `/v1/orders/:orderId/proof/view`      | Temporary view URL for own receipt            |
| `GET`  | `/v1/orders/:orderId/topup`           | Top-up fulfillment status                     |
| `POST` | `/v1/deposits/ezcash`                 | Start an eZ Cash wallet deposit               |
| `GET`  | `/v1/deposits/:depositId`             | Poll a deposit status                         |

### Admin (`ADMIN_UIDS` only)

| Method | Path                                          | Purpose                              |
| ------ | --------------------------------------------- | ------------------------------------ |
| `GET`  | `/v1/admin/overview`                          | Dashboard counters                   |
| `GET`  | `/v1/admin/collections/:collection`           | Paginated list of a collection       |
| `POST` | `/v1/admin/catalog/:collection`               | Upsert a catalog record              |
| `POST` | `/v1/admin/catalog/:collection/:id/archive`   | Archive (deactivate) a record        |
| `POST` | `/v1/admin/upload-image`                      | Upload a catalog image               |
| `POST` | `/v1/admin/settings`                          | Save store settings                  |
| `POST` | `/v1/admin/settings/payment-methods`          | Save payment methods                 |
| `POST` | `/v1/admin/faqs`                              | Save FAQs                            |
| `GET`  | `/v1/admin/users`                             | List users                           |
| `GET`  | `/v1/admin/users/search`                      | Search users                         |
| `POST` | `/v1/admin/users/:uid/disabled`               | Enable/disable an account            |
| `POST` | `/v1/admin/users/:uid/wallet`                 | Adjust a wallet balance              |
| `GET`  | `/v1/admin/orders/search`                     | Search orders                        |
| `POST` | `/v1/admin/orders/:orderId/status`            | Update order/payment status          |
| `GET`  | `/v1/admin/orders/:orderId/proof`             | Temporary receipt view URL            |
| `GET`  | `/v1/admin/orders/:orderId/topup`             | Top-up status                        |
| `GET`  | `/v1/admin/topup-failures`                    | Orders needing manual attention      |
| `POST` | `/v1/admin/orders/:orderId/payment-decision`  | Confirm/reject a submitted receipt   |

## Order and payment rules

- Order creation requires an `Idempotency-Key` header (16–128 characters).
  Prices are always read server-side from Neon — a client cannot set a price.
- Wallet balance check, debit, order insert and the idempotency claim are
  committed in a single PostgreSQL transaction.
- Manual payment methods (eZ Cash, Bank Transfer, …) stay `payment_review` /
  `proof_submitted` until an administrator issues a payment decision. The
  decision route works for **any** manual method, not only eZ Cash.
- A receipt image is **not** payment verification. An admin must independently
  confirm the money arrived with the provider before choosing `confirm`.
- Wallet-paid orders submit to Nexaura automatically after the debit, using a
  stable per-order provider idempotency key. Ambiguous provider outcomes are
  recorded as needing review rather than reported as success.
- No customer-facing route can set payment or fulfillment status.

## Environment variables

Server-only. Never place any of these in a `VITE_*` variable, in the browser
bundle, or in a commit. See `.env.example` for a template.

| Variable | Required | Purpose |
| -------- | -------- | ------- |
| `NODE_ENV` | yes | `production` in the VPS. Also enables the startup guard that refuses to boot without `API_ALLOWED_ORIGINS`. |
| `PORT` | yes | API port. The VPS listens on `127.0.0.1:3000` only. |
| `DATABASE_URL` | yes | Neon PostgreSQL connection string (server-only). |
| `DATABASE_SSL` / `DATABASE_SSL_STRICT` | yes | TLS to Neon. Keep both `true`. |
| `DATABASE_POOL_MAX` | no | Pool size, default 10. |
| `FIREBASE_PROJECT_ID` | yes | Firebase project used to verify ID tokens. |
| `FIREBASE_SERVICE_ACCOUNT` **or** `GOOGLE_APPLICATION_CREDENTIALS` | yes | Exactly one Admin credential method. Prefer the file path on the VPS. |
| `ADMIN_UIDS` | yes | Comma-separated Firebase UIDs allowed to use admin routes. |
| `API_ALLOWED_ORIGINS` | yes | Comma-separated CORS allow-list. An entry may contain a **single** `*` wildcard segment, e.g. `https://*.vercel.app`. |
| `SUPABASE_URL` | for receipts | Supabase project URL for private payment-proof storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | for receipts | Server-only storage key. Never expose it to the browser. |
| `SUPABASE_STORAGE_BUCKET` | no | Bucket name, default `payment-proofs`. Must be **private**. |
| `NEXAURA_API_KEY` | for auto top-ups | Nexaura reseller key. Unset disables automatic fulfillment. |
| `NEXAURA_BASE_URL` | no | Default `https://topup.nexauracore.com/api/v1/reseller`. |
| `SHOP2TOPUP_API_KEY` | for Blood Strike | Player-ID validation key. |
| `SHOP2TOPUP_API_BASE_URL` | no | Default `https://portal.shop2topup.com`. |
| `RESEND_API_KEY` | for emails | Transactional email key. |
| `APP_BASE_URL` | for emails | Production site origin used in email links, e.g. `https://hasagold.store`. |

> **Encoding note:** Node's `--env-file` silently ignores the first key when the
> file starts with a UTF-8 BOM. The VPS `.env` was saved as BOM-free for this
> reason — `NODE_ENV` was being dropped before this was found.

## Run locally

Node.js 20 or newer.

```powershell
Set-Location 'E:\Hasa Gold Store\hasastore\hasa-gold-api'
Copy-Item .env.example .env      # then fill in the real values
npm install
npm start
```

The health endpoint is `http://127.0.0.1:3000/health`.

There is **no automated test suite** in this package. The former `node --test`
suite and its PGlite harness were removed for the production release, so
`npm test` no longer exists. Verify changes with `node --check src/<file>.js`,
a local `npm start`, and the live smoke checks below.

## Deploying to the VPS

The VPS host is `ubuntu@137.23.42.221`, the app lives in
`/var/www/hasa-gold-api`, and PM2 manages it as `hasa-gold-api`. The SSH key is
`~/.ssh/pathum-topup-vps`.

**Do not run `deploy-neon-vps.ps1`.** It re-syncs the frozen legacy Firestore
catalog into Neon and overwrites live store settings (payment methods, eZ Cash
details, FAQs). The script now aborts immediately with that explanation. The
legacy migration utility is quarantined in [`legacy/`](./legacy) for reference
only.

Deploy only the files that changed, then restart PM2:

```powershell
$key = "$env:USERPROFILE\.ssh\pathum-topup-vps"
scp -i $key '.\src\app.js' ubuntu@137.23.42.221:/var/www/hasa-gold-api/src/
ssh  -i $key ubuntu@137.23.42.221 'cd /var/www/hasa-gold-api && node --check src/app.js && pm2 restart hasa-gold-api --update-env && pm2 save'
```

If `package.json` or `package-lock.json` changed, copy them too and run
`npm ci --omit=dev` on the VPS before restarting.

Schema changes are applied separately with `psql` against Neon using the
migrations in [`sql/migrations/`](./sql/migrations). Never re-run the legacy
Firestore import.

Verify after every deploy:

```sh
curl -s https://api.hasagold.store/health
curl -s -o /dev/null -w '%{http_code}\n' https://api.hasagold.store/v1/catalog
```

## Security posture

Applied on the server (VPS) and in the code:

- **No caching anywhere.** Every API response sends
  `Cache-Control: no-store, no-cache, must-revalidate, private` plus
  `Pragma: no-cache`, so admin edits, wallet balances and order state are
  visible on the next read. The frontend also fetches with `cache: "no-store"`
  and uses `staleTime: 0`.
- **Helmet** with `frameguard: deny`, HSTS (`includeSubDomains`), and
  `X-Powered-By` disabled.
- **CORS is an explicit allow-list.** Unknown origins get no
  `Access-Control-Allow-Origin` header. A single `*` wildcard segment is
  supported for preview deployments.
- **Rate limiting** on all routes, with a tighter limit on order creation,
  deposits, profile completion and admin wallet adjustments.
- **Image uploads** accept PNG, JPEG, WEBP and GIF only, up to 5 MB, and the
  magic bytes must match the declared type. SVG is rejected because it can
  carry inline script and lands in a public bucket.
- **Method-agnostic payment review.** The admin decision route no longer
  hard-codes one payment method, so Bank Transfer receipts can be approved.
- **nginx**: `server_tokens off`, security headers, no default site, TLS from
  Let's Encrypt, and the API proxied from `127.0.0.1:3000` only.
- **sshd**: root login disabled, password and keyboard-interactive
  authentication disabled, `MaxAuthTries 3`, no X11/TCP forwarding.
- **`rpcbind` disabled and masked** — it was listening on `0.0.0.0:111`.
- Only ports 22, 80 and 443 are reachable; the firewall rules persist.
- `npm audit` is clean for this package (prod and dev).

Residual items are tracked in the project report; the main ones are that
fail2ban is not installed, `http://localhost:8080` is still in the production
CORS list, and PM2 runs as the `ubuntu` user rather than a dedicated service
account.

## Layout

```
src/          Express app: routes, auth, Neon access, providers
sql/          schema.sql and migrations/ (apply with psql)
legacy/       quarantined Firestore migration — reference only, do not run
```
