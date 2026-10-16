# HASA GOLD STORE

Build a website for HASA GOLD STORE, a gaming top-up store for Free Fire, Blood Strike, PUBG Mobile, and Call of Duty: Mobile.

Make it professional, modern, and easy for customers to use, so a visitor can quickly find their game and see the top-up options. It should feel fast and smooth on both phones and desktops.

Include a home page, a page for each game, search, and a support section. Add a clean FAQ and a "how it works" explanation. Add a few helpful extras that improve the experience, like favorites and quick search.

## Requirements

- Frontend only: no backend, database, login, or real payments.
- Don't invent prices, discounts, delivery times, policies, reviews, or contact details. Label any demo content as "Sample".
- Use placeholder game artwork for now. Don't copy official logos or characters. I'll upload real images later.
- Works well on every screen size, with no sideways scrolling or cut-off text.
- Easy to tap, easy to read, and usable with a keyboard.
- Before finishing, check every link and button and fix any errors.

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

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build (client + Nitro server bundle) |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run test` | Run the Vitest suite |
