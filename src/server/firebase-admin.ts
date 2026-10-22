/**
 * Firebase Admin SDK initialization — TRUSTED SERVER-SIDE ONLY.
 *
 * This file lives under `src/server/`, which the TanStack Start `importProtection`
 * config excludes from the client bundle, so it never ships to the browser and
 * no service-account credentials are exposed to users.
 *
 * Credentials (choose one; never commit the key, never paste it into chat):
 *   - FIREBASE_SERVICE_ACCOUNT   service account JSON string (CI / Vercel)
 *   - GOOGLE_APPLICATION_CREDENTIALS   path to a service account JSON file (local)
 *
 * The Admin SDK bypasses Firestore Security Rules, which is how the trusted
 * order-creation flow writes `orders` documents (clients are denied all order
 * writes by the rules).
 */
import { initializeApp, applicationDefault, cert, getApps, type App } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

let app: App | null = null;

class AdminNotConfiguredError extends Error {
  constructor() {
    super(
      "Trusted server-side operations are not configured. Set FIREBASE_SERVICE_ACCOUNT " +
        "(JSON string) or GOOGLE_APPLICATION_CREDENTIALS (file path) in the server " +
        "environment. Until then, order creation stays disabled for safety.",
    );
    this.name = "AdminNotConfiguredError";
  }
}

function initAdmin(): App {
  if (app) return app;
  const storageBucket =
    process.env["FIREBASE_STORAGE_BUCKET"] ?? process.env["VITE_FIREBASE_STORAGE_BUCKET"];
  const appOptions = storageBucket ? { storageBucket } : {};
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
    app = initializeApp({
      credential: cert(parsed as Parameters<typeof cert>[0]),
      ...appOptions,
    });
    return app;
  }
  if (process.env["GOOGLE_APPLICATION_CREDENTIALS"]) {
    app = initializeApp({ credential: applicationDefault(), ...appOptions });
    return app;
  }
  throw new AdminNotConfiguredError();
}

/** Returns the Admin Auth instance. Throws a clear error if not configured. */
export function getAdminAuth(): Auth {
  return getAuth(initAdmin());
}

export function assertEmailVerified(decoded: DecodedIdToken): void {
  if (decoded.email_verified !== true) {
    throw new Error("Verify your email address before using your account.");
  }
}

export async function assertCustomerProfileComplete(uid: string): Promise<void> {
  const profile = await getAdminDb().doc(`users/${uid}`).get();
  if (!profile.exists) throw new Error("Your customer profile could not be found. Sign in again.");
  if (profile.get("profileComplete") === false) {
    throw new Error("Complete your name and phone number before using customer services.");
  }
}

/** Returns the Admin Firestore instance. Throws a clear error if not configured. */
export function getAdminDb(): Firestore {
  return getFirestore(initAdmin());
}

/** Returns the Admin Storage instance for private payment-proof files. */
export function getAdminStorage(): Storage {
  return getStorage(initAdmin());
}

export { AdminNotConfiguredError };
