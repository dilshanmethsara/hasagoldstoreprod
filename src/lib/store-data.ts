export const faqs = [
  {
    question: "Can I place a top-up order?",
    answer:
      "Choose a game and package from the live catalog to create an order. eZ Cash orders can include a payment receipt for review; proof submission itself does not confirm payment.",
  },
  {
    question: "Will my top-up be delivered?",
    answer:
      "Eligible paid Free Fire orders are submitted to Nexaura, and provider status appears in your order history. Other games are fulfilled by our team. eZ Cash proof must be reviewed before payment confirmation. Provider acceptance is not delivery confirmation.",
  },
  {
    question: "Can I pay with my wallet at checkout?",
    answer:
      "Yes. Select HASA Gold Wallet at checkout to pay from your available LKR balance. The current catalog price is checked and the balance is deducted when the order is created. Eligible Free Fire orders are submitted to Nexaura; provider status appears in your order history.",
  },
  {
    question: "Can I buy a game account?",
    answer:
      "Listings may be shown from the store catalog, but purchase verification, payment, and credential delivery are not available through this website.",
  },
  {
    question: "Do I need to share my game password?",
    answer:
      "No. A top-up order asks only for a Player ID, not a game password. Free Fire IDs are checked through the configured provider lookup, but always confirm the ID carefully in the game.",
  },
  {
    question: "How are favorites saved?",
    answer:
      "Favorites are saved to your account when you are signed in. While signed out, they remain only for the current page session.",
  },
];

export function pageHead(
  title: string,
  description: string,
  options: { path?: string; noIndex?: boolean; image?: string } = {},
) {
  const cleanTitle = title.replace(/\s*\|\s*HASA GOLD STORE\s*$/i, "");
  const fullTitle = `${cleanTitle} | HASA GOLD STORE`;
  return {
    meta: [
      { title: fullTitle },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "HASA GOLD STORE" },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:image", content: options.image ?? "https://hasagold.store/brand-share.svg" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: options.image ?? "https://hasagold.store/brand-share.svg" },
      { property: "og:url", content: `https://hasagold.store${options.path ?? "/"}` },
      { name: "twitter:url", content: `https://hasagold.store${options.path ?? "/"}` },
      {
        name: "robots",
        content:
          options.noIndex || !options.path
            ? "noindex,follow"
            : "index,follow,max-image-preview:large",
      },
    ],
    links: [{ rel: "canonical", href: `https://hasagold.store${options.path ?? "/"}` }],
  };
}
