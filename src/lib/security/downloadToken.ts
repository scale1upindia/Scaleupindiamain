// Scale-up India — Phase 8: Cryptographic Signed Download Token Helper
// Path: src/lib/security/downloadToken.ts

import crypto from "crypto";

const SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  process.env.APP_SECRET ||
  "scaleup-india-vault-tamper-proof-hmac-secret-key-2026";

/**
 * Generates an HMAC-SHA256 signature for a specific document download request
 */
export function generateDownloadSignature(
  documentId: string,
  dataRoomId: string,
  userId: string,
  expiresAt: number
): string {
  const payload = `${documentId}:${dataRoomId}:${userId}:${expiresAt}`;
  return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

/**
 * Generates a signed download token with specified TTL (default 300s = 5m)
 */
export function createSignedDownloadToken(
  documentId: string,
  dataRoomId: string,
  userId: string,
  expiresInSeconds = 300
): { token: string; expiresAt: number; expiresInSeconds: number } {
  const now = Date.now();
  const expiresAt = now + expiresInSeconds * 1000;
  const token = generateDownloadSignature(documentId, dataRoomId, userId, expiresAt);

  return {
    token,
    expiresAt,
    expiresInSeconds,
  };
}

/**
 * Validates a signed download token against expiration and cryptographic signature
 */
export function verifySignedDownloadToken(
  token: string,
  documentId: string,
  dataRoomId: string,
  userId: string,
  expiresAt: number
): boolean {
  // 1. Validate expiration
  if (Date.now() > expiresAt) {
    return false;
  }

  // 2. Validate token structure
  if (!token || typeof token !== "string" || token.length !== 64) {
    return false;
  }

  // 3. Recompute expected signature
  const expectedSignature = generateDownloadSignature(documentId, dataRoomId, userId, expiresAt);

  const tokenBuf = Buffer.from(token, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}
