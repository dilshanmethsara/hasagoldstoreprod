# HASA GOLD STORE

Build a website for HASA GOLD STORE, a gaming top-up store for Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile.

Make it professional, modern, and easy for customers to use, so a visitor can quickly find their game and see the top-up options. It should feel fast and smooth on both phones and desktops.

Include a home page, a page for each game, search, and a support section. Add a clean FAQ and a "how it works" explanation. Add a few helpful extras that improve the experience, like favorites and quick search.

## Store operations

- Firebase Authentication and Firestore provide customer accounts, the live catalog, and order records.
- Orders are created by the trusted server operation using Firestore catalog prices. Customer clients cannot create or edit order/payment statuses.
- eZ Cash orders support manual payment proof. Receipt images are uploaded to a private Supabase Storage bucket and linked from the order in Firestore. Customers can view their own receipt and administrators can review it. An administrator must verify payment and update statuses in the admin panel.
- Paid Free Fire orders are submitted server-side to Nexaura using each package's configured Nexaura product ID. Wallet-paid orders submit after the wallet debit; eZ Cash orders submit only after an administrator confirms payment. Nexaura submission uses a stable per-order idempotency key. Checkout and order history poll `GET /topups/{order_id}` every four seconds until Nexaura reports `completed`, `failed`, or `refunded`. Other game top-ups remain manual. A receipt upload does not confirm payment or delivery.
- Other listed payment methods are not connected. Do not invent catalog products, prices, discounts, delivery times, policies, reviews, or contact details.

### Firebase setup

Configure the Firebase Web SDK values in `.env` (see `.env.example`), and configure the trusted server with `FIREBASE_SERVICE_ACCOUNT` or `GOOGLE_APPLICATION_CREDENTIALS` and `ADMIN_UIDS`. Configure the Supabase project URL and public anon/publishable key for the web app, and set `SUPABASE_SERVICE_ROLE_KEY` only in the server environment. Keep the `payment-proofs` Supabase Storage bucket private and set its maximum file size to 5 MB with JPEG, PNG, WebP, and PDF as allowed content types. The Firebase Storage configuration remains necessary only to view older receipts uploaded before the Supabase migration.

Enable both Email/Password and Google providers in Firebase Console → Authentication → Sign-in method, and allow the production site's domain and `localhost` under Authentication → Settings → Authorized domains. Email/password signups require email verification. Existing password users who choose Google with the same email must confirm their existing password once before Google is linked to that account. New Google accounts must complete their full name, phone number, and terms acknowledgement before they can access account services. Customers receive an order confirmation email after an order is created. Configure `RESEND_API_KEY` and `APP_BASE_URL` in the server environment, setting the latter to the production site's HTTPS origin (for example, `https://your-store-domain.example`). The Resend sending domain `hasagold.store` must be verified, with `no-reply@hasagold.store` authorized as the sender. Locally, the verification action returns to the active localhost origin; production uses `APP_BASE_URL`.

Blood Strike Player ID checks use Shop2Topup's player validation endpoint. Configure the server-only `SHOP2TOPUP_API_KEY`; `SHOP2TOPUP_API_BASE_URL` defaults to `https://portal.shop2topup.com`. The current Blood Strike subcategory ID is `1647`. If a server is configured for Blood Strike in the game catalog, it is included as the `server` validation requirement. A provider `PLAYER_CHECK_UNAVAILABLE` response allows the customer to continue with a warning; `PLAYER_NOT_FOUND` blocks continuation.

For automatic Free Fire orders, configure `NEXAURA_API_KEY` on the server and set the exact Nexaura `product_id` on every Free Fire package in Admin → Packages. Unconfigured packages cannot be ordered. No provider order is placed by tests or builds.

For temporary local admin access, set a strong `ADMIN_PANEL_PASSWORD` (at least 16 characters) in the server environment. The password creates a Firebase custom-token session for the first UID in `ADMIN_UIDS`; all existing server admin checks still apply. This is a shared, temporary sign-in method; use individual authenticated accounts and stronger protections before deploying it publicly.

Deploy Firestore security rules and indexes from this repository:

```sh
firebase deploy --project <firebase-project-id> --only firestore:rules,firestore:indexes
```

Before accepting eZ Cash orders, open **Admin → Settings**, verify the eZ Cash mobile number and account name, and save the settings to Firestore. The customer checkout reads its payment instructions from that public Firestore settings document.

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React 19 + TanStack Router)
- **Build Tool**: [Vite](https://vite.dev)
- **Server Bundle**: [Nitro](https://nitro.build) (Cloudflare module preset)
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
| `npm run test`    | Run the Vitest suite                            |
