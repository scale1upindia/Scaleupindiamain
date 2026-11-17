import crypto from "crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const IP_SALT = process.env.AUTH_SECRET || "scaleup_default_ip_salt_change_in_prod";

/**
 * Hashes a plain password using bcrypt with 12 rounds
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verifies a plain password against a bcrypt hash in constant time
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generates a cryptographically secure random token (e.g. for sessions, email verification)
 */
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString("hex");
}

/**
 * Computes a SHA-256 hash of a string/token
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Computes a privacy-preserving hash of an IP address
 */
export function hashIp(ip: string | undefined | null): string {
  if (!ip) return "unknown";
  return crypto
    .createHash("sha256")
    .update(`${ip}:${IP_SALT}`)
    .digest("hex")
    .substring(0, 32);
}

