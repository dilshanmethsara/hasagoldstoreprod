import { randomBytes } from "node:crypto";

const ID_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a 20-char random ID (Firestore-auto-id compatible) for new rows
 *  whose IDs are referenced by storage paths / external systems. */
export function genId() {
  return Array.from(randomBytes(20), (b) => ID_ALPHABET[b % 62]).join("");
}
