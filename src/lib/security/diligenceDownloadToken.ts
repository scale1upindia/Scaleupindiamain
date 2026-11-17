// Scale-up India — Phase 12: Cryptographic Signed Token Helper for Due Diligence Evidence
// Path: src/lib/security/diligenceDownloadToken.ts

import crypto from "crypto";

const SIGNING_SECRET =
  process.env.SESSION_SECRET ||
  process.env.APP_SECRET ||
  "scaleup-india-diligence-vault-tamper-proof-hmac-secret-key-2026";

/**
 * Generates an HMAC-SHA256 signature binding evidenceId, versionNumber, caseId, userId, and expiresAt
 */
export function generateDiligenceDownloadSignature(
  evidenceId: string,
  versionNumber: number,
  caseId: string,
  userId: string,
  expiresAt: number
): string {
  const payload = `${evidenceId}:${versionNumber}:${caseId}:${userId}:${expiresAt}`;
  return crypto.createHmac("sha256", SIGNING_SECRET).update(payload).digest("hex");
}

/**
 * Generates a signed diligence download token with specified TTL (default 300s = 5m)
 */
export function createSignedDiligenceToken(
  evidenceId: string,
  versionNumber: number,
  caseId: string,
  userId: string,
  expiresInSeconds = 300
): { token: string; expiresAt: number; expiresInSeconds: number } {
  const now = Date.now();
  const expiresAt = now + expiresInSeconds * 1000;
  const token = generateDiligenceDownloadSignature(
    evidenceId,
    versionNumber,
    caseId,
    userId,
    expiresAt
  );

  return {
    token,
    expiresAt,
    expiresInSeconds,
  };
}

/**
 * Convenient parameter-object wrapper for generating download tokens
 */
export function generateDiligenceDownloadToken(params: {
  evidenceId: string;
  versionNumber: number;
  caseId: string;
  userId: string;
  expiresAt: number;
}): string {
  return generateDiligenceDownloadSignature(
    params.evidenceId,
    params.versionNumber,
    params.caseId,
    params.userId,
    params.expiresAt
  );
}

/**
 * Validates a signed download token against expiration and cryptographic signature
 */
export function verifySignedDiligenceToken(
  token: string,
  evidenceId: string,
  versionNumber: number,
  caseId: string,
  userId: string,
  expiresAt: number
): boolean {
  // 1. Validate expiration (handles both epoch seconds and epoch milliseconds)
  const expiresAtMs = expiresAt < 10000000000 ? expiresAt * 1000 : expiresAt;
  if (Date.now() > expiresAtMs) {
    return false;
  }

  // 2. Validate token structure
  if (!token || typeof token !== "string" || token.length !== 64) {
    return false;
  }

  // 3. Recompute expected signature
  const expectedSignature = generateDiligenceDownloadSignature(
    evidenceId,
    versionNumber,
    caseId,
    userId,
    expiresAt
  );

  const tokenBuf = Buffer.from(token, "utf-8");
  const expectedBuf = Buffer.from(expectedSignature, "utf-8");

  if (tokenBuf.length !== expectedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(tokenBuf, expectedBuf);
}
