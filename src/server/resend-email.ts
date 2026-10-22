import {
  renderCallout,
  renderDetailTable,
  renderEmailButton,
  renderEmailShell,
  renderSectionLabel,
  renderStatusCards,
  renderSteps,
  statusTone,
} from "@/server/email-templates";

type OrderConfirmation = {
  to: string;
  orderId: string;
  gameName: string;
  packageName: string;
  playerId: string;
  server: string;
  totalLkr: number;
  paymentMethod: "wallet" | "ezcash";
};

type OrderStatusUpdate = {
  to: string;
  orderId: string;
  gameSlug: string;
  gameName: string;
  packageName: string;
  totalLkr: number;
  status: string;
  paymentStatus: string;
};

function appBaseUrl(): string | null {
  const configured = process.env["APP_BASE_URL"]?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

function formatStatusLabel(value: string): string {
  const label = value.replaceAll("_", " ").trim();
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export async function sendOrderConfirmationEmail(order: OrderConfirmation): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const total = `LKR ${order.totalLkr.toLocaleString()}`;
  const paidFromWallet = order.paymentMethod === "wallet";
  const paymentLabel = paidFromWallet ? "Paid from wallet" : "Awaiting payment review";
  const paymentSummary = paidFromWallet
    ? "The order total was deducted from your wallet balance."
    : "Your order stays unpaid until our team verifies the payment proof you submitted. Payment proof is not payment confirmation.";
  const supportUrl = appBaseUrl();
  const steps = [
    {
      title: "Payment",
      body: paidFromWallet
        ? "Your wallet has been charged in full. No further action is needed."
        : "We are reviewing the payment proof you submitted. You can resubmit proof from your Orders page if needed.",
    },
    {
      title: "Fulfillment",
      body: "Configured Free Fire top-ups are submitted to the provider automatically once payment is confirmed. Other games are fulfilled manually by our team.",
    },
    {
      title: "Tracking",
      body: "Follow live order and provider status any time from your account dashboard.",
    },
  ];
  const html = renderEmailShell({
    title: "HASA GOLD STORE order received",
    preheader: `Order ${order.orderId} received — ${order.packageName} for ${order.gameName}.`,
    headerNote: "Order receipt",
    eyebrow: "Order received",
    heading: "We received your order",
    intro:
      "Thanks for shopping with HASA GOLD STORE. Keep this receipt for your records — you can follow every update from your account.",
    body:
      renderStatusCards([
        { label: "Order status", value: "Received", tone: "info" },
        { label: "Payment", value: paymentLabel, tone: paidFromWallet ? "success" : "warning" },
      ]) +
      renderSectionLabel("Order details") +
      renderDetailTable([
        { label: "Order ID", value: order.orderId, strong: true, mono: true },
        { label: "Game", value: order.gameName },
        { label: "Package", value: order.packageName, strong: true },
        { label: "Player ID", value: order.playerId, mono: true },
        { label: "Server", value: order.server || "Not specified" },
        { label: "Total", value: total, strong: true },
      ]) +
      renderCallout({
        tone: paidFromWallet ? "success" : "warning",
        title: paidFromWallet ? "Payment confirmed" : "Payment not confirmed yet",
        body: paymentSummary,
      }) +
      renderSectionLabel("What happens next") +
      renderSteps(steps) +
      (supportUrl ? renderEmailButton("Track this order", `${supportUrl}/dashboard/orders`) : ""),
    supportUrl: supportUrl ? `${supportUrl}/support` : undefined,
    footerNote: supportUrl
      ? "You received this email because an order was created with this address on hasagold.store."
      : undefined,
  });
  const text =
    `Your HASA GOLD STORE order was created.\n\n` +
    `Order ID: ${order.orderId}\nGame: ${order.gameName}\nPackage: ${order.packageName}\n` +
    `Player ID: ${order.playerId}\nServer: ${order.server || "Not specified"}\n` +
    `Total: ${total}\nPayment: ${paymentLabel}. ${paymentSummary}\n\n` +
    `What happens next:\n` +
    steps.map((step, index) => `${index + 1}. ${step.title}: ${step.body}`).join("\n") +
    (supportUrl ? `\n\nTrack your order: ${supportUrl}/dashboard/orders` : "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "HASA GOLD STORE <no-reply@hasagold.store>",
      to: [order.to],
      subject: `Order received · ${order.orderId}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the order email with status ${response.status}.`);
  }
}

export async function sendOrderStatusUpdateEmail(order: OrderStatusUpdate): Promise<void> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");

  const total = `LKR ${order.totalLkr.toLocaleString()}`;
  const orderStatusLabel = formatStatusLabel(order.status);
  const paymentStatusLabel = formatStatusLabel(order.paymentStatus);
  const fulfillmentMessage =
    order.gameSlug === "free-fire"
      ? "Free Fire provider status is tracked in your account; this email alone does not confirm completion."
      : "Other game top-up fulfillment is manual; this email alone does not confirm delivery.";
  const supportUrl = appBaseUrl();
  const heading = (() => {
    switch (order.status) {
      case "completed":
      case "delivered":
        return "Your order is complete";
      case "failed":
      case "cancelled":
        return "Your order needs attention";
      case "refunded":
        return "Your order was refunded";
      case "processing":
        return "Your order is being processed";
      default:
        return "Your order was updated";
    }
  })();
  const html = renderEmailShell({
    title: `HASA GOLD STORE order ${orderStatusLabel.toLowerCase()}`,
    preheader: `Order ${order.orderId}: ${orderStatusLabel} · payment ${paymentStatusLabel.toLowerCase()}.`,
    headerNote: "Order update",
    eyebrow: "Status change",
    heading,
    intro: "There is a new update on your HASA GOLD STORE order. Here is the latest status.",
    body:
      renderStatusCards([
        { label: "Order status", value: orderStatusLabel, tone: statusTone(order.status) },
        {
          label: "Payment status",
          value: paymentStatusLabel,
          tone: statusTone(order.paymentStatus),
        },
      ]) +
      renderSectionLabel("Order details") +
      renderDetailTable([
        { label: "Order ID", value: order.orderId, strong: true, mono: true },
        { label: "Game", value: order.gameName },
        { label: "Package", value: order.packageName, strong: true },
        { label: "Total", value: total, strong: true },
      ]) +
      renderCallout({ tone: "info", title: "Fulfillment", body: fulfillmentMessage }) +
      (supportUrl ? renderEmailButton("View order details", `${supportUrl}/dashboard/orders`) : ""),
    supportUrl: supportUrl ? `${supportUrl}/support` : undefined,
    footerNote: "If you did not expect this change, contact support and quote your order ID.",
  });
  const text =
    `There is an update to your HASA GOLD STORE order.\n\n` +
    `Order ID: ${order.orderId}\nGame: ${order.gameName}\nPackage: ${order.packageName}\n` +
    `Total: ${total}\nOrder status: ${orderStatusLabel}\n` +
    `Payment status: ${paymentStatusLabel}\n\n` +
    fulfillmentMessage +
    (supportUrl ? `\n\nView order details: ${supportUrl}/dashboard/orders` : "");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "HASA GOLD STORE <no-reply@hasagold.store>",
      to: [order.to],
      subject: `Order update · ${order.orderId}`,
      text,
      html,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the order status email with status ${response.status}.`);
  }
}
