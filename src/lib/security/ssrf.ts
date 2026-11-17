// Scale-up India — Phase 16: SSRF Protection Utility
// Path: src/lib/security/ssrf.ts

import { SECURITY_CONFIG } from "./config";
import { ValidationError } from "@/lib/errors";

export interface SafeUrlValidationResult {
  isValid: boolean;
  error?: string;
  url?: URL;
}

/**
 * Checks if a numeric string is a decimal/dword or hex IP address representation of loopback/private IP
 */
function isEncodedLoopbackOrPrivate(hostname: string): boolean {
  // Check for decimal IP (e.g., 2130706433 = 127.0.0.1)
  if (/^\d+$/.test(hostname)) {
    const num = parseInt(hostname, 10);
    // 127.0.0.0/8 range: 2130706432 - 2147483647
    if (num >= 2130706432 && num <= 2147483647) return true;
    // 10.0.0.0/8 range: 167772160 - 184549375
    if (num >= 167772160 && num <= 184549375) return true;
    // 169.254.0.0/16 range: 2851995648 - 2852061183
    if (num >= 2851995648 && num <= 2852061183) return true;
  }

  // Check for hex representation (e.g. 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const num = parseInt(hostname, 16);
    if (num >= 2130706432 && num <= 2147483647) return true;
  }

  // Check for octal representations (e.g. 0177.0.0.1)
  if (/^0[0-7]+/.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF threats, disallowing private, loopback,
 * and link-local cloud metadata addresses.
 */
export function validateSafeUrl(urlString: string | null | undefined): SafeUrlValidationResult {
  if (!urlString || typeof urlString !== "string") {
    return { isValid: false, error: "URL string is missing or empty." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { isValid: false, error: "Malformed URL syntax." };
  }

  // 1. Protocol check
  if (!SECURITY_CONFIG.SSRF.ALLOWED_PROTOCOLS.includes(parsed.protocol as any)) {
    return {
      isValid: false,
      error: `Protocol '${parsed.protocol}' is prohibited. Only HTTP and HTTPS are permitted.`,
    };
  }

  const rawHostname = parsed.hostname.toLowerCase();
  const hostname = rawHostname.replace(/^\[|\]$/g, "");

  // 2. Explicit Blocked Hostnames (checked with both raw and bracket-stripped versions)
  if (
    (SECURITY_CONFIG.SSRF.BLOCKED_HOSTNAMES as readonly string[]).includes(hostname) ||
    (SECURITY_CONFIG.SSRF.BLOCKED_HOSTNAMES as readonly string[]).includes(rawHostname)
  ) {
    return {
      isValid: false,
      error: `Access to internal host '${rawHostname}' is prohibited (SSRF Defense).`,
    };
  }

  // 2b. IPv6 Loopback / Link-Local / ULA detection
  if (
    hostname === "::1" ||
    hostname.startsWith("fe80:") ||
    hostname.startsWith("fc00:") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("::ffff:127.") ||
    hostname.startsWith("::ffff:10.") ||
    hostname.startsWith("::ffff:192.168.")
  ) {
    return {
      isValid: false,
      error: `Access to internal/private IPv6 destination '${rawHostname}' is prohibited (SSRF Defense).`,
    };
  }

  // 3. Blocked Subnet Prefixes
  for (const prefix of SECURITY_CONFIG.SSRF.BLOCKED_PREFIXES) {
    if (hostname.startsWith(prefix)) {
      return {
        isValid: false,
        error: `Access to private IP space '${hostname}' is prohibited (SSRF Defense).`,
      };
    }
  }

  // 4. Encoded / Dword / Octal / Hex check
  if (isEncodedLoopbackOrPrivate(hostname)) {
    return {
      isValid: false,
      error: "Access to encoded private IP address is prohibited (SSRF Defense).",
    };
  }

  // 5. Port restriction (optional: restrict to standard web ports 80, 443, 8080, 8443)
  if (parsed.port && !["80", "443", "8080", "8443", "3000"].includes(parsed.port)) {
    return {
      isValid: false,
      error: `Target port ${parsed.port} is not in the allowed outbound web ports.`,
    };
  }

  return { isValid: true, url: parsed };
}

/**
 * Asserts that a target URL is safe for outbound HTTP requests
 * Throws ValidationError if the target violates SSRF policies
 */
export function assertSafeUrl(urlString: string | null | undefined): URL {
  const result = validateSafeUrl(urlString);
  if (!result.isValid || !result.url) {
    throw new ValidationError(result.error || "Prohibited internal or private destination URL.");
  }
  return result.url;
}
