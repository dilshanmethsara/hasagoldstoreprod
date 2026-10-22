import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  escapeEmailHtml,
  renderDetailTable,
  renderEmailShell,
  statusTone,
} from "@/server/email-templates";
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } from "@/server/resend-email";

type EmailPayload = { subject: string; html: string; text: string };

function capturePayload(fetchMock: ReturnType<typeof vi.fn>): EmailPayload {
  const call = fetchMock.mock.calls[0];
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body)) as EmailPayload;
}

describe("email template building blocks", () => {
  it("escapes markup in dynamic values", () => {
    expect(escapeEmailHtml(`<script>alert("x")</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("maps order and payment statuses to callout tones", () => {
    expect(statusTone("completed")).toBe("success");
    expect(statusTone("paid")).toBe("success");
    expect(statusTone("failed")).toBe("danger");
    expect(statusTone("payment_review")).toBe("warning");
    expect(statusTone("processing")).toBe("info");
  });

  it("renders the branded shell with escaped headings and detail rows", () => {
    const html = renderEmailShell({
      title: "Test email",
      preheader: "Preview text",
      headerNote: "Order update",
      eyebrow: "Status",
      heading: "<b>Hello</b>",
      intro: "Hi <script>alert(1)</script>",
      body: renderDetailTable([{ label: "Order", value: "<img src=x onerror=alert(1)>" }]),
    });

    expect(html).toContain("HASA GOLD STORE");
    expect(html).toContain("&lt;b&gt;Hello&lt;/b&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<script>");
  });
});

describe("order emails", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("APP_BASE_URL", "https://hasagold.store");
    fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends a branded order receipt with tracking link", async () => {
    await sendOrderConfirmationEmail({
      to: "player@example.com",
      orderId: "HGS-1001",
      gameName: "Free Fire",
      packageName: "Weekly Lite",
      playerId: "123456789",
      server: "",
      totalLkr: 1250,
      paymentMethod: "wallet",
    });

    const payload = capturePayload(fetchMock);
    expect(payload.subject).toContain("HGS-1001");
    expect(payload.html).toContain("We received your order");
    expect(payload.html).toContain("Paid from wallet");
    expect(payload.html).toContain("https://hasagold.store/dashboard/orders");
    expect(payload.html).toContain("Not specified");
    expect(payload.text).toContain("LKR 1,250");
  });

  it("highlights the new status and escapes order details", async () => {
    await sendOrderStatusUpdateEmail({
      to: "player@example.com",
      orderId: "HGS-1002",
      gameSlug: "free-fire",
      gameName: "Free Fire",
      packageName: "Diamonds <500>",
      totalLkr: 2500,
      status: "completed",
      paymentStatus: "paid",
    });

    const payload = capturePayload(fetchMock);
    expect(payload.html).toContain("Your order is complete");
    expect(payload.html).toContain("Completed");
    expect(payload.html).toContain("Diamonds &lt;500&gt;");
    expect(payload.text).toContain("Order status: Completed");
  });
});
