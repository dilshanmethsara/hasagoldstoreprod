import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase Web configuration, read from Vite environment variables.
 *
 * These values are public by design (they ship in the browser bundle). They are
 * kept in `.env` anyway so that each deployment can point at its own Firebase
 * project. Real protection lives in Firebase Security Rules and the authorized
 * domains list, never in these strings.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as const;

/** Config keys that are empty or still hold an `.env.example` placeholder. */
export const missingFirebaseConfigKeys: readonly string[] = (
  Object.entries(firebaseConfig) as [string, string | undefined][]
)
  .filter(
    ([, value]) =>
      typeof value !== "string" || value.trim() === "" || /^your[-_]/i.test(value.trim()),
  )
  .map(([key]) => `VITE_FIREBASE_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`);

export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

/**
 * Raised when Firebase is used before it has been configured. Callers surface
 * `message` to the user, so it explains the fix instead of leaking internals.
 */
export class FirebaseSetupError extends Error {
  readonly missingKeys: readonly string[];
  constructor(missingKeys: readonly string[] = missingFirebaseConfigKeys) {
    super(
      "Firebase is not configured yet. Add your Firebase Web credentials to the .env file " +
        `(see .env.example). Missing: ${missingKeys.join(", ") || "unknown"}.`,
    );
    this.name = "FirebaseSetupError";
    this.missingKeys = missingKeys;
  }
}

function assertConfigured() {
  if (!isFirebaseConfigured) throw new FirebaseSetupError();
}

/** Returns the shared Firebase app, creating it on first use. */
export function getFirebaseApp(): FirebaseApp {
  assertConfigured();
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

/**
 * Returns the shared Firebase Auth instance, creating it on first use.
 *
 * Authentication is initialised lazily rather than at module scope so the app
 * still renders (with a clear setup message on the auth pages) when the
 * environment variables are missing, and so nothing touches browser storage
 * during server rendering.
 */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}
