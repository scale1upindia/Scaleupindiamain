// Scale-up India — Phase 16: Multi-Factor Authentication (MFA) Readiness
// Path: src/domains/auth/mfa.ts

import crypto from "crypto";
import { query } from "@/lib/db";
import { auditLog } from "@/domains/audit/logger";
import { ValidationError, ForbiddenError } from "@/lib/errors";

const ENCRYPTION_ALGO = "aes-256-gcm";
const AUTH_SECRET = process.env.AUTH_SECRET || "scaleup_enterprise_session_secret_change_in_production_min32chars";
// Derive a 32-byte key from AUTH_SECRET
const DERIVED_KEY = crypto.createHash("sha256").update(AUTH_SECRET).digest();

/**
 * Encrypts a sensitive string (e.g. raw TOTP secret) using AES-256-GCM
 */
export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGO, DERIVED_KEY, iv);
  let encrypted = cipher.update(plainText, "utf-8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  // Format: iv:authTag:encrypted
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string
 */
export function decryptSecret(encryptedPayload: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedPayload.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new ValidationError("Invalid encrypted payload format.");
  }
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGO, DERIVED_KEY, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedHex, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}

/**
 * Generates an RFC 6238 compliant 6-digit TOTP code for a given timestamp
 */
export function generateTotpCode(secretHex: string, timeStepSeconds = 30, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / timeStepSeconds);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const secretBuffer = Buffer.from(secretHex, "hex");
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();

  // Dynamic truncation (RFC 4226)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binaryCode % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verifies a 6-digit TOTP code against a secret with +/- 1 window tolerance
 */
export function verifyTotpCode(
  secretHex: string,
  candidateCode: string,
  timeStepSeconds = 30
): boolean {
  if (!candidateCode || candidateCode.length !== 6 || !/^\d{6}$/.test(candidateCode)) {
    return false;
  }

  const now = Date.now();
  const windows = [-1, 0, 1]; // +/- 30 seconds drift allowance

  for (const w of windows) {
    const validCode = generateTotpCode(secretHex, timeStepSeconds, now + w * timeStepSeconds * 1000);
    const bufExpected = Buffer.from(validCode);
    const bufCandidate = Buffer.from(candidateCode);

    if (bufExpected.length === bufCandidate.length && crypto.timingSafeEqual(bufExpected, bufCandidate)) {
      return true;
    }
  }

  return false;
}

export interface MfaEnrollmentSetup {
  secretHex: string;
  encryptedSecret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
  hashedRecoveryCodes: string[];
}

/**
 * Generates an enrollment bundle for a user with encrypted secret and hashed recovery codes
 */
export function setupMfaEnrollment(userEmail: string): MfaEnrollmentSetup {
  const rawSecret = crypto.randomBytes(20).toString("hex");
  const encryptedSecret = encryptSecret(rawSecret);

  // Generate 8 alphanumeric recovery codes: XXXX-XXXX
  const recoveryCodes: string[] = [];
  const hashedRecoveryCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const code = `${crypto.randomBytes(2).toString("hex").toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    recoveryCodes.push(code);
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    hashedRecoveryCodes.push(hash);
  }

  const otpauthUrl = `otpauth://totp/ScaleupIndia:${encodeURIComponent(userEmail)}?secret=${rawSecret}&issuer=ScaleupIndia`;

  return {
    secretHex: rawSecret,
    encryptedSecret,
    otpauthUrl,
    recoveryCodes,
    hashedRecoveryCodes,
  };
}

/**
 * Verifies and activates MFA on a user account
 */
export async function confirmMfaActivation(
  userId: string,
  encryptedSecret: string,
  hashedRecoveryCodes: string[],
  firstCode: string
): Promise<boolean> {
  const secretHex = decryptSecret(encryptedSecret);
  const isValid = verifyTotpCode(secretHex, firstCode);

  if (!isValid) {
    throw new ValidationError("Invalid verification code. MFA cannot be activated.");
  }

  await query(
    `UPDATE users 
     SET mfa_enabled = TRUE, 
         mfa_secret_encrypted = $1, 
         mfa_recovery_codes_hash = $2, 
         mfa_enrolled_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [encryptedSecret, JSON.stringify(hashedRecoveryCodes), userId]
  );

  await auditLog({
    actorId: userId,
    action: "MFA_ENABLED",
    resourceType: "users",
    resourceId: userId,
  });

  return true;
}

/**
 * Verifies an MFA challenge during authentication via either TOTP code or Recovery Code
 */
export async function verifyMfaChallenge(
  userId: string,
  code: string
): Promise<{ verified: boolean; usedRecoveryCode: boolean }> {
  const userRes = await query<{
    mfa_enabled: boolean;
    mfa_secret_encrypted: string | null;
    mfa_recovery_codes_hash: string | null;
  }>(
    `SELECT mfa_enabled, mfa_secret_encrypted, mfa_recovery_codes_hash 
     FROM users WHERE id = $1`,
    [userId]
  );

  if (userRes.rows.length === 0 || !userRes.rows[0].mfa_enabled) {
    return { verified: false, usedRecoveryCode: false };
  }

  const user = userRes.rows[0];

  // 1. Check if it's a valid 6-digit TOTP code
  if (/^\d{6}$/.test(code) && user.mfa_secret_encrypted) {
    const secretHex = decryptSecret(user.mfa_secret_encrypted);
    if (verifyTotpCode(secretHex, code)) {
      return { verified: true, usedRecoveryCode: false };
    }
  }

  // 2. Check if it's a recovery code
  if (user.mfa_recovery_codes_hash) {
    const storedHashes: string[] = JSON.parse(user.mfa_recovery_codes_hash);
    const candidateHash = crypto.createHash("sha256").update(code.trim().toUpperCase()).digest("hex");

    const matchIndex = storedHashes.findIndex((h) => {
      const b1 = Buffer.from(h, "hex");
      const b2 = Buffer.from(candidateHash, "hex");
      return b1.length === b2.length && crypto.timingSafeEqual(b1, b2);
    });

    if (matchIndex !== -1) {
      // Consume the recovery code so it cannot be reused
      storedHashes.splice(matchIndex, 1);
      await query(
        `UPDATE users SET mfa_recovery_codes_hash = $1 WHERE id = $2`,
        [JSON.stringify(storedHashes), userId]
      );

      await auditLog({
        actorId: userId,
        action: "MFA_RECOVERY_CODE_CONSUMED",
        resourceType: "users",
        resourceId: userId,
      });

      return { verified: true, usedRecoveryCode: true };
    }
  }

  return { verified: false, usedRecoveryCode: false };
}
