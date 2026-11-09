/**
 * Firebase Admin — AUTHENTICATION ONLY.
 *
 * Firestore is no longer used by this API (data lives in PostgreSQL/Neon).
 * firebase-admin is kept solely to verify client ID tokens, look up users for
 * admin operations, and issue custom tokens. The Firestore Admin SDK is no longer
 * imported here.
 */
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

let adminApp;

function getAdminApp() {
  if (adminApp) return adminApp;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const serviceAccountText = process.env.FIREBASE_SERVICE_ACCOUNT;
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!projectId) {
    throw new Error("Set FIREBASE_PROJECT_ID in the API environment.");
  }
  if (!serviceAccountText && !credentialsPath) {
    throw new Error(
      "Configure FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS on the server.",
    );
  }

  const existing = getApps().find((candidate) => candidate.name === "[DEFAULT]");
  if (existing) {
    adminApp = existing;
    return existing;
  }

  let credential;
  if (serviceAccountText) {
    const serviceAccount = parseServiceAccount(serviceAccountText);
    if (serviceAccount.project_id !== projectId) {
      throw new Error("FIREBASE_PROJECT_ID does not match the service-account project.");
    }
    credential = cert(serviceAccount);
  } else {
    credential = applicationDefault();
  }
  adminApp = initializeApp({ credential, projectId });
  return adminApp;
}

function parseServiceAccount(value) {
  try {
    const account = JSON.parse(value);
    if (
      !account ||
      typeof account !== "object" ||
      typeof account.project_id !== "string" ||
      typeof account.client_email !== "string" ||
      typeof account.private_key !== "string"
    ) {
      throw new Error();
    }
    return account;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT must be valid service-account JSON.");
  }
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function verifyFirebaseToken(token) {
  return getAdminAuth().verifyIdToken(token, true);
}
