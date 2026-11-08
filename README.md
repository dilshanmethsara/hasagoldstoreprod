# HASA GOLD STORE

A modern, responsive gaming top-up store for HASA GOLD STORE. The site covers
Free Fire, Blood Strike, and any other games added to the live catalog, with a
home page, per-game pages, search, favorites, support, FAQ, and a "how it
works" explanation.

> The store currently sells **direct game top-ups by Player ID**. Account
> listings are archived and the `/accounts` page states that they are coming
> soon — no page advertises purchasable verified accounts.

## Store operations

- **Identity:** Firebase Authentication provides customer accounts (email +
> password, Google). It is the only identity provider.
- **Data:** Neon PostgreSQL, reached exclusively through the Express API at
  `https://api.hasagold.store`. The browser never connects to Neon directly.
  See [`hasa-gold-api/README.md`](./hasa-gold-api/README.md).
- **Orders:** created by the trusted server operation using live Neon catalog
  prices. Customer clients cannot create or edit order/payment statuses.
- **Payments:** wallet (instant, server-side debit), eZ Cash and Bank Transfer
  (manual proof). Receipt images are uploaded to a private Supabase Storage
  bucket and linked from the order. Customers can view their own receipt and
  administrators can review it. An administrator must independently verify
  payment before any manual method is approved — a receipt upload does not
  confirm payment or delivery.
- **Fulfillment:** paid Free Fire orders are submitted server-side to Nexaura
  using each package's configured Nexaura product ID, with a stable per-order
  idempotency key. Wallet-paid orders submit after the debit; manual-payment
  orders submit only after an administrator confirms payment. Checkout and
  order history poll the top-up status until the provider reports a terminal
  state. Other game top-ups remain manual.
- Do not invent catalog products, prices, discounts, delivery times, policies,
  reviews, or contact details.

### Configuration

- **Firebase Web SDK** values go in `.env` as `VITE_*` (see `.env.example`).
- **Trusted server** values (`FIREBASE_SERVICE_ACCOUNT` or
  `GOOGLE_APPLICATION_CREDENTIALS`, `ADMIN_UIDS`, `SUPABASE_SERVICE_ROLE_KEY`,
  `RESEND_API_KEY`, `APP_BASE_URL`, `NEXAURA_API_KEY`, `SHOP2TOPUP_API_KEY`)
  stay server-side. Never prefix them with `VITE_` and never commit them.
- Keep the `payment-proofs` Supabase Storage bucket **private**, with a 5 MB
  maximum file size and JPEG, PNG, WebP, GIF and PDF allowed as content types.
  The admin image upload accepts PNG, JPEG, WebP and GIF only and validates
  magic bytes before writing.
- Enable Email/Password and Google in Firebase Console → Authentication, and
  allow the production domain and `localhost` under Authorized domains.
  Email/password signups require email verification. New Google accounts must
  complete name, phone number and terms before using account services.
- Configure `RESEND_API_KEY` and `APP_BASE_URL`; the Resend sending domain
  `hasagold.store` must be verified with `no-reply@hasagold.store` authorized.
- Blood Strike Player-ID checks use Shop2Topup. Configure `SHOP2TOPUP_API_KEY`
  server-side; `SHOP2TOPUP_API_BASE_URL` defaults to
  `https://portal.shop2topup.com`. `PLAYER_CHECK_UNAVAILABLE` lets the customer
  continue with a warning; `PLAYER_NOT_FOUND` blocks continuation.
- For automatic Free Fire orders, configure `NEXAURA_API_KEY` server-side and
  set the exact Nexaura `product_id` on every Free Fire package in
  Admin → Packages. Unconfigured packages cannot be ordered.
- `ADMIN_PANEL_PASSWORD` (at least 16 characters) enables a temporary shared
  admin sign-in for the first UID in `ADMIN_UIDS`. It is a temporary mechanism —
  prefer individual authenticated accounts before exposing it publicly.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router)
- **Build Tool**: [Vite](https://vite.dev)
- **Server Bundle**: [Nitro](https://nitro.build) (Cloudflare module preset, Vercel preset in CI)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) v4 with [Radix UI](https://www.radix-ui.com) primitives
- **Language**: TypeScript

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

The dev server runs at http://localhost:8080.

## Scripts

| Script            | Description                                     |
| ----------------- | ----------------------------------------------- |
| `npm run dev`     | Start the Vite dev server                       |
| `npm run build`   | Production build (client + Nitro server bundle) |
| `npm run preview` | Preview the production build                    |
| `npm run lint`    | Run ESLint                                      |
| `npm run format`  | Format with Prettier                            |

There is no automated test suite in this repository; the Vitest tooling was
removed for the production release. Verify changes with `npm run build`,
`npm run lint` and `npx tsc --noEmit`.

## Security

- **Response headers** (CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy`) are applied to every response via
  Nitro `routeRules` in `vite.config.ts`.
- **No caching.** The API sends `Cache-Control: no-store` and the client uses
  `cache: "no-store"` with `staleTime: 0`, so catalog, wallet and order changes
  appear immediately.
- **Secrets** live only in server environments. `npm audit` reports zero
  vulnerabilities for both production and dev dependencies.
