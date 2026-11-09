/**
 * Shared HTML building blocks for transactional emails.
 *
 * This is a faithful port of `src/server/email-templates.ts` in the storefront
 * app. Order emails are rendered by that TypeScript module on Vercel, while the
 * account verification email is rendered here on the Express API — keeping both
 * copies in sync means a customer sees the same branding in every message.
 *
 * Email clients only support a narrow CSS subset, so every block is built from
 * presentation tables with inline styles instead of classes, flexbox or grid.
 */

const COLORS = {
  ink: "#10151D",
  body: "#1A2230",
  muted: "#6F6A5F",
  faint: "#8A8172",
  gold: "#D5A83D",
  cream: "#F7ECD2",
  page: "#F4F1EA",
  card: "#FFFFFF",
  soft: "#FBF8F1",
  border: "#E7E0D2",
  divider: "#F1EBDF",
  headerMuted: "#93A0B4",
};

const FONT_BODY = "Arial,Helvetica,sans-serif";
const FONT_DISPLAY = "Georgia,'Times New Roman',serif";
const FONT_MONO = "Consolas,'Courier New',monospace";

const TONES = {
  info: { color: "#1D4ED8", background: "#EEF3FF", border: "#CBD9F7" },
  success: { color: "#1B7A4B", background: "#EAF6EF", border: "#BEE3CD" },
  warning: { color: "#8A5A00", background: "#FBF3E2", border: "#EBD7AC" },
  danger: { color: "#B42318", background: "#FDECEA", border: "#F3C6C1" },
};

export function escapeEmailHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

/** Small uppercase section label above a block of content. */
export function renderSectionLabel(text) {
  return `<p style="margin:26px 0 9px;font-family:${FONT_BODY};font-size:9.5px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;color:${COLORS.faint};">${escapeEmailHtml(text)}</p>`;
}

/** Gold call-to-action button. `href` must already be an absolute URL. */
export function renderEmailButton(label, href) {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;">` +
    `<tr><td style="border-radius:10px;background:${COLORS.gold};">` +
    `<a href="${escapeEmailHtml(href)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:13px 26px;font-family:${FONT_BODY};font-size:12.5px;font-weight:bold;letter-spacing:0.2px;color:${COLORS.ink};text-decoration:none;border-radius:10px;">${escapeEmailHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

/** Two-column label/value table used for order and account details. */
export function renderDetailTable(rows) {
  const cells = rows
    .map((row, index) => {
      const border = index === rows.length - 1 ? "" : `border-bottom:1px solid ${COLORS.divider};`;
      const value = row.mono
        ? `<span style="font-family:${FONT_MONO};font-size:12px;">${escapeEmailHtml(row.value)}</span>`
        : escapeEmailHtml(row.value);
      return (
        `<tr>` +
        `<td style="padding:11px 16px;${border}font-family:${FONT_BODY};font-size:11px;color:${COLORS.muted};">${escapeEmailHtml(row.label)}</td>` +
        `<td align="right" style="padding:11px 16px;${border}font-family:${FONT_BODY};font-size:13px;color:${COLORS.body};${row.strong ? "font-weight:bold;" : ""}">${value}</td>` +
        `</tr>`
      );
    })
    .join("");
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;border:1px solid ${COLORS.border};border-radius:12px;background:${COLORS.card};">` +
    cells +
    `</table>`
  );
}

/** Tinted callout box, for example a "next step" or warning notice. */
export function renderCallout(options) {
  const tone = TONES[options.tone] ?? TONES.info;
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border-collapse:separate;border-spacing:0;background:${tone.background};border:1px solid ${tone.border};border-radius:12px;">` +
    `<tr><td style="padding:14px 16px;">` +
    `<p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:9px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${tone.color};">${escapeEmailHtml(options.title)}</p>` +
    `<p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${COLORS.body};">${escapeEmailHtml(options.body)}</p>` +
    `</td></tr></table>`
  );
}

/** Numbered list of steps, used to explain what happens next. */
export function renderSteps(steps) {
  const rows = steps
    .map((step, index) => {
      const padding = index === steps.length - 1 ? "" : "padding-bottom:14px;";
      return (
        `<tr><td style="${padding}">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
        `<td width="34" valign="top" style="padding-right:10px;">` +
        `<div style="width:24px;height:24px;border-radius:50%;background:${COLORS.soft};border:1px solid ${COLORS.border};color:${COLORS.faint};font-family:${FONT_BODY};font-size:11px;font-weight:bold;text-align:center;line-height:24px;">${index + 1}</div>` +
        `</td>` +
        `<td valign="top">` +
        `<p style="margin:0 0 2px;font-family:${FONT_BODY};font-size:12.5px;font-weight:bold;color:${COLORS.body};">${escapeEmailHtml(step.title)}</p>` +
        `<p style="margin:0;font-family:${FONT_BODY};font-size:11.5px;line-height:1.6;color:${COLORS.muted};">${escapeEmailHtml(step.body)}</p>` +
        `</td></tr></table></td></tr>`
      );
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">${rows}</table>`;
}

/** Copy-paste fallback for clients that strip or break the button link. */
export function renderLinkFallback(url) {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-collapse:separate;border-spacing:0;background:${COLORS.soft};border:1px solid ${COLORS.border};border-radius:10px;">` +
    `<tr><td style="padding:11px 14px;font-family:${FONT_MONO};font-size:10.5px;line-height:1.6;color:${COLORS.muted};word-break:break-all;">` +
    `${escapeEmailHtml(url)}` +
    `</td></tr></table>`
  );
}

/**
 * Full email document: dark branded header, white content card, soft footer.
 * `body` must be trusted HTML assembled from the helpers above.
 */
export function renderEmailShell(options) {
  const support = options.supportUrl
    ? `Need help? <a href="${escapeEmailHtml(options.supportUrl)}" target="_blank" rel="noreferrer" style="color:${COLORS.muted};text-decoration:underline;">Visit our support page</a>.`
    : "Need help? Open the Support page in your account.";
  const footerNote = options.footerNote
    ? `<p style="margin:10px 0 0;font-family:${FONT_BODY};font-size:10.5px;line-height:1.65;color:${COLORS.faint};">${escapeEmailHtml(options.footerNote)}</p>`
    : "";

  return (
    `<!doctype html><html lang="en"><head>` +
    `<meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width,initial-scale=1" />` +
    `<meta name="color-scheme" content="light only" />` +
    `<title>${escapeEmailHtml(options.title)}</title>` +
    `</head>` +
    `<body style="margin:0;padding:0;background:${COLORS.page};">` +
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${COLORS.page};">${escapeEmailHtml(options.preheader)}</div>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page};">` +
    `<tr><td align="center" style="padding:30px 14px;">` +
    `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:separate;border-spacing:0;">` +
    `<tr><td style="background:${COLORS.ink};border-radius:18px 18px 0 0;padding:26px 30px 24px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="font-family:${FONT_DISPLAY};font-size:19px;font-weight:bold;letter-spacing:3px;color:${COLORS.cream};white-space:nowrap;">HASA <span style="color:${COLORS.gold};">GOLD</span></td>` +
    `<td align="right" style="font-family:${FONT_BODY};font-size:8.5px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COLORS.headerMuted};">${escapeEmailHtml(options.headerNote)}</td>` +
    `</tr></table>` +
    `<div style="width:54px;height:3px;background:${COLORS.gold};border-radius:2px;margin-top:16px;font-size:0;line-height:0;">&nbsp;</div>` +
    `</td></tr>` +
    `<tr><td style="background:${COLORS.card};padding:32px 30px 28px;">` +
    `<p style="margin:0 0 10px;font-family:${FONT_BODY};font-size:9.5px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:${COLORS.gold};">${escapeEmailHtml(options.eyebrow)}</p>` +
    `<h1 style="margin:0 0 12px;font-family:${FONT_DISPLAY};font-size:26px;line-height:1.28;font-weight:bold;color:${COLORS.ink};">${escapeEmailHtml(options.heading)}</h1>` +
    `<p style="margin:0 0 22px;font-family:${FONT_BODY};font-size:13.5px;line-height:1.7;color:${COLORS.muted};">${escapeEmailHtml(options.intro)}</p>` +
    options.body +
    `</td></tr>` +
    `<tr><td style="background:${COLORS.soft};border-top:1px solid ${COLORS.border};border-radius:0 0 18px 18px;padding:20px 30px 24px;">` +
    `<p style="margin:0 0 6px;font-family:${FONT_BODY};font-size:10px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${COLORS.faint};">HASA GOLD STORE <span style="color:${COLORS.gold};">·</span> Sri Lanka</p>` +
    `<p style="margin:0;font-family:${FONT_BODY};font-size:11px;line-height:1.65;color:${COLORS.muted};">${support}</p>` +
    footerNote +
    `<p style="margin:10px 0 0;font-family:${FONT_BODY};font-size:10px;line-height:1.65;color:${COLORS.faint};">This automated message is part of your HASA GOLD STORE order and account records.</p>` +
    `</td></tr>` +
    `</table></td></tr></table></body></html>`
  );
}

/**
 * Account verification email.
 *
 * Returns `{ subject, html, text }` so the caller only has to POST it to Resend.
 * The plain-text alternative mirrors the HTML content for clients that block
 * HTML email entirely.
 */
export function renderVerificationEmail(options) {
  const displayName = options.displayName || "there";
  const supportUrl = options.supportUrl;

  const body =
    renderEmailButton("Verify my email address", options.actionUrl) +
    renderLinkFallback(options.actionUrl) +
    renderSectionLabel("What happens next") +
    renderSteps([
      {
        title: "Confirm your email address",
        body: "Tap the button above. The link is unique to your account and expires automatically.",
      },
      {
        title: "Sign in to your account",
        body: "Once verified you can sign in, browse the catalog and place orders.",
      },
      {
        title: "Link not working?",
        body: "Sign in and choose \"Resend verification email\" to receive a fresh link.",
      },
    ]) +
    renderCallout({
      tone: "warning",
      title: "Didn't create this account?",
      body: "You can safely ignore this email. The account stays inactive until the address is verified.",
    });

  const html = renderEmailShell({
    title: "Verify your HASA GOLD STORE account",
    preheader: "Confirm your email address to finish creating your account.",
    headerNote: "Account security",
    eyebrow: "One step left",
    heading: `Welcome, ${displayName}`,
    intro:
      "Thanks for joining HASA GOLD STORE. Confirm your email address to finish creating your account.",
    body,
    supportUrl,
    footerNote:
      "If you did not request this email, no action is needed — your address will not be verified.",
  });

  const text = [
    `Hi ${displayName},`,
    "",
    "Thanks for joining HASA GOLD STORE. Verify your email address to finish creating your account:",
    "",
    options.actionUrl,
    "",
    "Once verified you can sign in, browse the catalog and place orders.",
    "If the link does not work, sign in and choose \"Resend verification email\".",
    "",
    supportUrl ? `Need help? ${supportUrl}` : "",
    "",
    "If you did not create this account, you can ignore this email.",
    "",
    "HASA GOLD STORE · Sri Lanka",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: "Verify your HASA GOLD STORE account",
    html,
    text,
  };
}

/** Maps order and payment statuses to a matching callout tone. */
export function statusTone(value) {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "completed":
    case "delivered":
    case "paid":
      return "success";
    case "failed":
    case "cancelled":
    case "proof_rejected":
      return "danger";
    case "pending":
    case "unpaid":
    case "payment_review":
    case "proof_submitted":
    case "refunded":
      return "warning";
    default:
      return "info";
  }
}

/** Two tinted status cards side by side. */
export function renderStatusCards(cards) {
  const cells = cards
    .slice(0, 2)
    .map((card, index) => {
      const tone = TONES[card.tone] ?? TONES.info;
      return (
        `<td width="50%" valign="top" style="padding-${index === 0 ? "right" : "left"}:5px;">` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border-spacing:0;background:${tone.background};border:1px solid ${tone.border};border-radius:12px;">` +
        `<tr><td style="padding:13px 15px;border-left:3px solid ${tone.color};border-radius:12px;">` +
        `<p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:9px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${tone.color};">${escapeEmailHtml(card.label)}</p>` +
        `<p style="margin:0;font-family:${FONT_BODY};font-size:14px;font-weight:bold;color:${COLORS.body};">${escapeEmailHtml(card.value)}</p>` +
        `</td></tr></table></td>`
      );
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>`;
}

function formatStatusLabel(value) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Order status update email.
 *
 * Mirrors `sendOrderStatusUpdateEmail` in `src/server/resend-email.ts` so an
 * admin changing an order in the panel produces the same branded message as
 * the Vercel-side sender.
 *
 * Returns `{ subject, html, text }`; the caller POSTs it to Resend.
 */
export function renderOrderStatusEmail(options) {
  const statusLabel = formatStatusLabel(options.status);
  const paymentLabel = formatStatusLabel(options.paymentStatus);
  const total = `LKR ${Number(options.totalLkr || 0).toLocaleString("en-US")}`;
  const supportUrl = options.supportUrl;

  const heading = (() => {
    switch (String(options.status || "").toLowerCase()) {
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

  const fulfillmentMessage =
    options.gameSlug === "free-fire"
      ? "Free Fire provider status is tracked in your account; this email alone does not confirm completion."
      : "Other game top-up fulfillment is manual; this email alone does not confirm delivery.";

  const body =
    renderStatusCards([
      { label: "Order status", value: statusLabel, tone: statusTone(options.status) },
      { label: "Payment status", value: paymentLabel, tone: statusTone(options.paymentStatus) },
    ]) +
    renderSectionLabel("Order details") +
    renderDetailTable([
      { label: "Order ID", value: options.orderId, strong: true, mono: true },
      { label: "Game", value: options.gameName },
      { label: "Package", value: options.packageName, strong: true },
      { label: "Total", value: total, strong: true },
    ]) +
    renderCallout({ tone: "info", title: "Fulfillment", body: fulfillmentMessage }) +
    (supportUrl ? renderEmailButton("View order details", `${supportUrl}/dashboard/orders`) : "");

  const html = renderEmailShell({
    title: `HASA GOLD STORE order ${statusLabel.toLowerCase()}`,
    preheader: `Order ${options.orderId}: ${statusLabel} · payment ${paymentLabel.toLowerCase()}.`,
    headerNote: "Order update",
    eyebrow: "Status change",
    heading,
    intro: "There is a new update on your HASA GOLD STORE order. Here is the latest status.",
    body,
    supportUrl: supportUrl ? `${supportUrl}/support` : undefined,
    footerNote: "If you did not expect this change, contact support and quote your order ID.",
  });

  const text = [
    "There is an update to your HASA GOLD STORE order.",
    "",
    `Order ID: ${options.orderId}`,
    `Game: ${options.gameName}`,
    `Package: ${options.packageName}`,
    `Total: ${total}`,
    `Order status: ${statusLabel}`,
    `Payment status: ${paymentLabel}`,
    "",
    fulfillmentMessage,
    supportUrl ? `\nView order details: ${supportUrl}/dashboard/orders` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    subject: `Order update · ${options.orderId}`,
    html,
    text,
  };
}