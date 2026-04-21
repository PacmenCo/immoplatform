import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { requireEncryptionKey } from "./config";

/**
 * AES-256-GCM envelope for calendar tokens. Output format:
 *   base64(iv) + ":" + base64(authTag) + ":" + base64(ciphertext)
 *
 * IVs are 12 bytes, single-use (generated per call). Rotating the key
 * means every existing `CalendarAccount` row becomes undecryptable — users
 * will need to reconnect. Acceptable for this domain.
 */

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

export function encryptToken(plain: string): string {
  const key = requireEncryptionKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

export function decryptToken(cipherText: string): string {
  const key = requireEncryptionKey();
  const [ivB64, tagB64, ctB64] = cipherText.split(":");
  if (!ivB64 || !tagB64 || !ctB64) {
    throw new Error("Malformed calendar ciphertext.");
  }
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
