export const faqs = [
  {
    question: "Can I place a top-up order?",
    answer:
      "If a game and package are available in the live catalog, you can create an order. eZ Cash orders can include a payment receipt image for manual review; proof submission does not confirm payment.",
  },
  {
    question: "Will my top-up be delivered?",
    answer:
      "Paid Free Fire packages configured for Nexaura are submitted automatically after payment is confirmed, and their provider status is shown in your order history. Other games are fulfilled manually. eZ Cash proof must be approved before any paid order is submitted.",
  },
  {
    question: "Can I pay with my wallet at checkout?",
    answer:
      "Yes. Select HASA Gold Wallet at checkout to pay from your available LKR balance. The current catalog price is checked and the balance is deducted securely when the order is created. Configured Free Fire packages are submitted to Nexaura automatically after the deduction.",
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
      "Favorites are saved to your Firestore account when you are signed in. While signed out, they remain only for the current page session.",
  },
];

export function pageHead(title: string, description: string) {
  return {
    meta: [{ title: `${title} | HASA GOLD STORE` }, { name: "description", content: description }],
  };
}
