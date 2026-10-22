/**
 * Shared HTML building blocks for transactional emails.
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
} as const;

const FONT_BODY = "Arial,Helvetica,sans-serif";
const FONT_DISPLAY = "Georgia,'Times New Roman',serif";
const FONT_MONO = "Consolas,'Courier New',monospace";

export type EmailTone = "info" | "success" | "warning" | "danger";

const TONES: Record<EmailTone, { color: string; background: string; border: string }> = {
  info: { color: "#1D4ED8", background: "#EEF3FF", border: "#CBD9F7" },
  success: { color: "#1B7A4B", background: "#EAF6EF", border: "#BEE3CD" },
  warning: { color: "#8A5A00", background: "#FBF3E2", border: "#EBD7AC" },
  danger: { color: "#B42318", background: "#FDECEA", border: "#F3C6C1" },
};

export function escapeEmailHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

/** Maps order and payment statuses to a matching callout tone. */
export function statusTone(value: string): EmailTone {
  switch (value.trim().toLowerCase()) {
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

export function renderSectionLabel(text: string): string {
  return `<p style="margin:26px 0 9px;font-family:${FONT_BODY};font-size:9.5px;font-weight:bold;letter-spacing:1.8px;text-transform:uppercase;color:${COLORS.faint};">${escapeEmailHtml(text)}</p>`;
}

export function renderEmailButton(label: string, href: string): string {
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px;">` +
    `<tr><td style="border-radius:10px;background:${COLORS.gold};">` +
    `<a href="${escapeEmailHtml(href)}" target="_blank" rel="noreferrer" style="display:inline-block;padding:13px 26px;font-family:${FONT_BODY};font-size:12.5px;font-weight:bold;letter-spacing:0.2px;color:${COLORS.ink};text-decoration:none;border-radius:10px;">${escapeEmailHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

export function renderDetailTable(
  rows: ReadonlyArray<{ label: string; value: string; strong?: boolean; mono?: boolean }>,
): string {
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

export function renderStatusCards(
  cards: ReadonlyArray<{ label: string; value: string; tone: EmailTone }>,
): string {
  const cells = cards
    .slice(0, 2)
    .map((card, index) => {
      const tone = TONES[card.tone];
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

export function renderCallout(options: { tone: EmailTone; title: string; body: string }): string {
  const tone = TONES[options.tone];
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border-collapse:separate;border-spacing:0;background:${tone.background};border:1px solid ${tone.border};border-radius:12px;">` +
    `<tr><td style="padding:14px 16px;">` +
    `<p style="margin:0 0 4px;font-family:${FONT_BODY};font-size:9px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:${tone.color};">${escapeEmailHtml(options.title)}</p>` +
    `<p style="margin:0;font-family:${FONT_BODY};font-size:12px;line-height:1.65;color:${COLORS.body};">${escapeEmailHtml(options.body)}</p>` +
    `</td></tr></table>`
  );
}

export function renderSteps(steps: ReadonlyArray<{ title: string; body: string }>): string {
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

export function renderLinkFallback(url: string): string {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-collapse:separate;border-spacing:0;background:${COLORS.soft};border:1px solid ${COLORS.border};border-radius:10px;">` +
    `<tr><td style="padding:11px 14px;font-family:${FONT_MONO};font-size:10.5px;line-height:1.6;color:${COLORS.muted};word-break:break-all;">` +
    `${escapeEmailHtml(url)}` +
    `</td></tr></table>`
  );
}

export interface EmailShellOptions {
  /** Document title; also used by some clients in the inbox preview. */
  title: string;
  /** Hidden preview line shown next to the subject in most inboxes. */
  preheader: string;
  /** Small uppercase label on the right side of the dark header. */
  headerNote: string;
  eyebrow: string;
  heading: string;
  intro: string;
  /** Trusted HTML assembled from the helpers above. */
  body: string;
  supportUrl?: string | undefined;
  footerNote?: string | undefined;
}

export function renderEmailShell(options: EmailShellOptions): string {
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
