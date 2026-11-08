/**
 * Firebase Admin SDK initialization — TRUSTED SERVER-SIDE ONLY.
 *
 * This module is intentionally auth-only after the Neon migration. User and
 * application data are read and written through the secure API layer, while
 * Firebase remains the authentication and identity provider.
 */
import { initializeApp, applicationDefault, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";

let app: App | null = null;

class AdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Trusted server-side operations are not configured. Set FIREBASE_SERVICE_ACCOUNT " +
        "(JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path) in the server " +
        "environment before running protected Firebase auth features.",
    );
    this.name = "AdminNotConfiguredError";
  }
}

function initAdmin(): App {
  if (app) return app;
  const existingApp = getApps().find((candidate) => candidate.name === "[DEFAULT]");
  if (existingApp) {
    app = existingApp;
    return existingApp;
  }

  const sa = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (sa) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(sa);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.");
    }
    app = initializeApp({ credential: cert(parsed as Parameters<typeof cert>[0]) });
    return app;
  }
  if (process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
    app = initializeApp({ credential: applicationDefault() });
    return app;
  }
  throw new AdminNotConfiguredError();
}

export function getAdminAuth(): Auth {
  return getAuth(initAdmin());
}

export function assertEmailVerified(decoded: DecodedIdToken): void {
  if (decoded.email_verified !== true) {
    throw new Error("Verify your email address before using your account.");
  }
}

export async function assertCustomerProfileComplete(uid: string): Promise<void> {
  if (!uid || !uid.trim()) {
    throw new Error("Your customer profile could not be found. Sign in again.");
  }
}

export { AdminNotConfiguredError };
