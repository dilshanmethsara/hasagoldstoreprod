import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  idToken: z.string().min(1).max(5000),
  appOrigin: z.string().url().max(500),
});

function getAllowedOrigin(appOrigin: string): string {
  const requested = new URL(appOrigin);
  if (
    requested.username ||
    requested.password ||
    requested.pathname !== "/" ||
    requested.search ||
    requested.hash
  ) {
    throw new Error("Invalid verification return address.");
  }

  const isLocalDevelopment =
    process.env["NODE_ENV"] === "development" &&
    requested.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(requested.hostname);
  if (isLocalDevelopment) return requested.origin;

  const configuredBaseUrl = process.env["APP_BASE_URL"]?.trim();
  if (configuredBaseUrl) {
    const configured = new URL(configuredBaseUrl);
    if (configured.protocol !== "https:" && process.env["NODE_ENV"] !== "development") {
      throw new Error("APP_BASE_URL must use HTTPS outside development.");
    }
    if (requested.origin !== configured.origin) {
      throw new Error("The verification return address is not allowed.");
    }
    return configured.origin;
  }

  throw new Error("Email verification is not configured. Set APP_BASE_URL on the server.");
}

export const sendVerificationEmail = createServerFn({ method: "POST" })
  .validator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }): Promise<{ sent: true }> => {
    const resendApiKey = process.env["RESEND_API_KEY"];
    if (!resendApiKey) {
      throw new Error("Email verification is not configured. Set RESEND_API_KEY on the server.");
    }
    const appOrigin = getAllowedOrigin(data.appOrigin);
    const { getAdminAuth } = await import("@/server/firebase-admin");
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(data.idToken, true);
    if (decoded.email_verified === true) return { sent: true };

    const user = await auth.getUser(decoded.uid);
    const email = user.email?.trim().toLowerCase();
    if (!email) throw new Error("This account does not have an email address to verify.");

    const actionLink = await auth.generateEmailVerificationLink(email, {
      url: new URL("/login?verified=1", appOrigin).toString(),
    });
    const { renderCallout, renderEmailButton, renderEmailShell, renderLinkFallback } =
      await import("@/server/email-templates");
    const displayName = user.displayName?.trim() || "there";
    const html = renderEmailShell({
      title: "Verify your HASA GOLD STORE email",
      preheader: "One tap to finish creating your HASA GOLD STORE account.",
      headerNote: "Account security",
      eyebrow: "Welcome to HASA GOLD",
      heading: "Verify your email address",
      intro: `Hi ${displayName}, confirm this email address to activate your HASA GOLD STORE account and keep order updates coming.`,
      body:
        renderEmailButton("Verify email address", actionLink) +
        `<p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11.5px;line-height:1.65;color:#6F6A5F;">If the button does not work, copy and paste this link into your browser:</p>` +
        renderLinkFallback(actionLink) +
        renderCallout({
          tone: "warning",
          title: "Security note",
          body: "This link is unique to your account. If you did not create a HASA GOLD STORE account, you can safely ignore this email.",
        }),
      supportUrl: new URL("/support", appOrigin).toString(),
      footerNote: "For your security, never share this verification link with anyone.",
    });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "HASA GOLD STORE <no-reply@hasagold.store>",
        to: [email],
        subject: "Verify your HASA GOLD STORE account",
        text:
          `Hi ${displayName},\n\n` +
          "Verify your email address to finish creating your HASA GOLD STORE account:\n" +
          `${actionLink}\n\n` +
          "This link is unique to your account. If you did not create this account, you can ignore this email.\n\n" +
          `Need help? ${new URL("/support", appOrigin).toString()}`,
        html,
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Resend verification email request failed:", response.status, details);
      throw new Error("We could not send the verification email. Please try again later.");
    }
    return { sent: true };
  });
