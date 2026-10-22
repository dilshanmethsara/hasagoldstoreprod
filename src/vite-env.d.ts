/// <reference types="vite/client" />

// Explicit declarations for the VITE_* variables this app consumes.
//
// `vite/client` types `ImportMetaEnv` with a catch-all index signature, and this
// repo enables `noPropertyAccessFromIndexSignature`, so every variable has to be
// named here before it can be read with dot access (`import.meta.env.VITE_...`).
// Dot access also matters at build time: Vite only statically replaces the exact
// `import.meta.env.VITE_FOO` expression, never `import.meta.env['VITE_FOO']`.
interface ImportMetaEnv {
  /** Firebase Web API key (public by design — restrict it in Google Cloud Console). */
  readonly VITE_FIREBASE_API_KEY: string;
  /** Firebase Auth domain, e.g. `your-project.firebaseapp.com`. */
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  /** Firebase project ID. */
  readonly VITE_FIREBASE_PROJECT_ID: string;
  /** Firebase Storage bucket, e.g. `your-project.appspot.com`. */
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  /** Firebase Cloud Messaging sender ID. */
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  /** Firebase Web app ID. */
  readonly VITE_FIREBASE_APP_ID: string;
  /** Optional Google Analytics measurement ID. */
  readonly VITE_FIREBASE_MEASUREMENT_ID: string;
  /** Supabase project URL, public by design. */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon/publishable key, public by design. */
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** Supabase Storage bucket name, e.g. `payment-proofs`. */
  readonly VITE_SUPABASE_STORAGE_BUCKET: string;
}
