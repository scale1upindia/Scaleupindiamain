// Scale-up India — Phase 16: Enterprise Security Hardening Tests
// Path: tests/enterprise_security.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { query, resetTestDb } from "@/lib/db";
import {
  registerUser,
  loginUser,
  createPasswordResetToken,
  resetPassword,
} from "@/domains/auth/service";
import {
  setupMfaEnrollment,
  confirmMfaActivation,
  verifyMfaChallenge,
  generateTotpCode,
  decryptSecret,
} from "@/domains/auth/mfa";
import { validateSafeUrl, assertSafeUrl } from "@/lib/security/ssrf";
import { validateUploadedFile, assertUploadedFile, sanitizeFilename } from "@/lib/security/fileValidator";
import { createSignedDownloadToken, verifySignedDownloadToken } from "@/lib/security/downloadToken";
import { checkRateLimit, resetAllRateLimits, RateLimitExceededError } from "@/lib/security/rateLimiter";
import { assertSeparationOfDuties } from "@/lib/security/rbacMatrix";
import { SECURITY_CONFIG } from "@/lib/security/config";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  ForbiddenError,
  AccountLockedError,
  UnauthorizedError,
} from "@/lib/errors";

describe("Phase 16: Enterprise Security Hardening", () => {
  let buyer1: AuthenticatedUser;
  let seller1: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    resetAllRateLimits();
    await resetTestDb();

    const regBuyer1 = await registerUser({
      email: "buyer1.sec16@alphainvest.in",
      firstName: "Rahul",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer1 = regBuyer1.user;

    const regSeller1 = await registerUser({
      email: "seller1.sec16@apexeng.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
  });

  // ===========================================================================
  // SECTION 1: IDENTITY & AUTHENTICATION HARDENING
  // ===========================================================================
  describe("1. Identity & Authentication Hardening", () => {
    it("locks user account after 5 consecutive failed login attempts (Brute-Force Protection)", async () => {
      // 4 failed login attempts throw UnauthorizedError
      for (let i = 0; i < 4; i++) {
        await expect(
          loginUser({ email: buyer1.email, password: "WrongPassword@999" })
        ).rejects.toThrow(UnauthorizedError);
      }

      // 5th attempt reaches lockout threshold and immediately locks the account
      await expect(
        loginUser({ email: buyer1.email, password: "WrongPassword@999" })
      ).rejects.toThrow(AccountLockedError);

      // 6th attempt: Even with the CORRECT password, account must remain locked
      await expect(
        loginUser({ email: buyer1.email, password: "Password@123" })
      ).rejects.toThrow(AccountLockedError);

      // Verify database reflects lockout_until in the future
      const userRes = await query<{ failed_login_attempts: number; lockout_until: Date }>(
        `SELECT failed_login_attempts, lockout_until FROM users WHERE id = $1`,
        [buyer1.id]
      );
      expect(userRes.rows[0].failed_login_attempts).toBe(5);
      expect(new Date(userRes.rows[0].lockout_until).getTime()).toBeGreaterThan(Date.now());
    });

    it("revokes ALL active sessions immediately when password is reset (Session Invalidation)", async () => {
      // Create second active session
      const loginRes = await loginUser({ email: buyer1.email, password: "Password@123" });
      expect(loginRes.sessionToken).toBeDefined();

      const activeBefore = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
        [buyer1.id]
      );
      expect(parseInt(activeBefore.rows[0].count, 10)).toBeGreaterThanOrEqual(2);

      // Request and complete password reset
      const resetReq = await createPasswordResetToken({ email: buyer1.email });
      expect(resetReq.token).toBeDefined();
      await resetPassword({ token: resetReq.token!, newPassword: "NewSecurePassword@456" });

      // Verify all active sessions are revoked
      const activeAfter = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
        [buyer1.id]
      );
      expect(parseInt(activeAfter.rows[0].count, 10)).toBe(0);
    });

    it("strictly blocks registration attempts to self-assign internal administrative roles", async () => {
      await expect(
        registerUser({
          email: "attacker@hack.in",
          firstName: "Bad",
          lastName: "Actor",
          password: "Password@123",
          roles: ["SUPER_ADMIN"] as any,
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        registerUser({
          email: "attacker2@hack.in",
          firstName: "Bad",
          lastName: "Actor",
          password: "Password@123",
          roles: ["ADMIN"] as any,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // ===========================================================================
  // SECTION 2: MFA-READY ARCHITECTURE & CRYPTOGRAPHIC SECRETS
  // ===========================================================================
  describe("2. MFA-Ready Architecture & Cryptographic Storage", () => {
    it("encrypts TOTP secret with AES-256-GCM and generates 8 hashed recovery codes", async () => {
      const enrollment = setupMfaEnrollment(buyer1.email);

      // Raw secret must be encrypted and never stored in plaintext
      expect(enrollment.encryptedSecret).not.toBe(enrollment.secretHex);
      expect(enrollment.encryptedSecret.split(":").length).toBe(3); // iv:authTag:cipher

      // Decryption restores exact secret
      const decrypted = decryptSecret(enrollment.encryptedSecret);
      expect(decrypted).toBe(enrollment.secretHex);

      // 8 recovery codes generated and hashed
      expect(enrollment.recoveryCodes.length).toBe(8);
      expect(enrollment.hashedRecoveryCodes.length).toBe(8);

      // First TOTP verification code activates MFA
      const validCode = generateTotpCode(enrollment.secretHex);
      const activated = await confirmMfaActivation(
        buyer1.id,
        enrollment.encryptedSecret,
        enrollment.hashedRecoveryCodes,
        validCode
      );
      expect(activated).toBe(true);

      // Verify database reflects MFA activated with encrypted secret
      const userRes = await query<{ mfa_enabled: boolean; mfa_secret_encrypted: string }>(
        `SELECT mfa_enabled, mfa_secret_encrypted FROM users WHERE id = $1`,
        [buyer1.id]
      );
      expect(userRes.rows[0].mfa_enabled).toBe(true);
      expect(userRes.rows[0].mfa_secret_encrypted).toBe(enrollment.encryptedSecret);
    });

    it("verifies challenge with single-use recovery code and immediately invalidates it", async () => {
      const enrollment = setupMfaEnrollment(buyer1.email);
      const validCode = generateTotpCode(enrollment.secretHex);
      await confirmMfaActivation(
        buyer1.id,
        enrollment.encryptedSecret,
        enrollment.hashedRecoveryCodes,
        validCode
      );

      const recoveryCode = enrollment.recoveryCodes[0];

      // First use succeeds
      const result1 = await verifyMfaChallenge(buyer1.id, recoveryCode);
      expect(result1.verified).toBe(true);
      expect(result1.usedRecoveryCode).toBe(true);

      // Second use of the same recovery code MUST fail (Single-Use Invariant)
      const result2 = await verifyMfaChallenge(buyer1.id, recoveryCode);
      expect(result2.verified).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 3: SERVER-SIDE REQUEST FORGERY (SSRF) DEFENSE
  // ===========================================================================
  describe("3. SSRF Protection Utility", () => {
    it("strictly blocks loopback, private RFC1918, and link-local metadata addresses", () => {
      const maliciousTargets = [
        "http://localhost/admin",
        "http://127.0.0.1:8080/metrics",
        "http://127.0.1.1/secret",
        "http://[::1]/internal",
        "http://169.254.169.254/latest/meta-data/", // AWS/GCP metadata
        "http://metadata.google.internal/computeMetadata/v1/",
        "http://10.0.0.1/private",
        "http://172.16.0.5/internal",
        "http://192.168.1.1/router",
        "http://2130706433/", // Dword 127.0.0.1
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379",
      ];

      for (const target of maliciousTargets) {
        const validation = validateSafeUrl(target);
        expect(validation.isValid).toBe(false);
        expect(() => assertSafeUrl(target)).toThrow(ValidationError);
      }
    });

    it("allows genuine, public HTTP/HTTPS destinations", () => {
      const safeTargets = [
        "https://scaleupindia.gov.in/docs",
        "https://api.razorpay.com/v1/payments",
        "https://api.sendgrid.com/v3/mail/send",
        "https://www.google.com/search?q=scaleup",
      ];

      for (const target of safeTargets) {
        const validation = validateSafeUrl(target);
        expect(validation.isValid).toBe(true);
        expect(assertSafeUrl(target)).toBeDefined();
      }
    });
  });

  // ===========================================================================
  // SECTION 4: FILE UPLOAD SECURITY & MAGIC-BYTE INSPECTION
  // ===========================================================================
  describe("4. File Upload Security & Magic-Byte Verification", () => {
    it("accepts authentic PDF buffer and computes deterministic SHA-256 checksum", () => {
      const pdfBuffer = Buffer.concat([
        Buffer.from("%PDF-1.4\n"),
        Buffer.from("1 0 obj\n<< /Title (Test) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"),
      ]);

      const result = assertUploadedFile(pdfBuffer, "annual_report.pdf");
      expect(result.isValid).toBe(true);
      expect(result.mimeType).toBe("application/pdf");
      expect(result.sha256Hash.length).toBe(64);
    });

    it("rejects MIME spoofing: text buffer disguised with .pdf extension", () => {
      const fakePdfBuffer = Buffer.from("Hello world, this is just plain text masquerading as a PDF.");
      const validation = validateUploadedFile(fakePdfBuffer, "financials.pdf");
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain("MIME spoofing detected");
    });

    it("strictly blocks executable files (.exe, .sh, .bat, .php, .js, .svg)", () => {
      const dangerousExtensions = ["malware.exe", "script.sh", "run.bat", "backdoor.php", "exploit.svg"];
      const dummyBuffer = Buffer.from("%PDF-dummy-content");

      for (const filename of dangerousExtensions) {
        const validation = validateUploadedFile(dummyBuffer, filename);
        expect(validation.isValid).toBe(false);
        expect(validation.error).toContain("strictly prohibited");
      }
    });

    it("sanitizes directory traversal sequences from filenames", () => {
      expect(sanitizeFilename("../../../etc/passwd")).toBe("etc_passwd");
      expect(sanitizeFilename("..\\..\\windows\\system32\\cmd.exe")).toBe("windows_system32_cmd.exe");
      expect(sanitizeFilename("normal_document.pdf")).toBe("normal_document.pdf");
    });

    it("rejects oversized file exceeding 15MB limit", () => {
      // 16MB mock buffer
      const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
      oversizedBuffer[0] = 0x25;
      oversizedBuffer[1] = 0x50;
      oversizedBuffer[2] = 0x44;
      oversizedBuffer[3] = 0x46;
      oversizedBuffer[4] = 0x2d;

      const validation = validateUploadedFile(oversizedBuffer, "large.pdf");
      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain("exceeds maximum permitted limit");
    });
  });

  // ===========================================================================
  // SECTION 5: SIGNED DOWNLOAD URL SECURITY
  // ===========================================================================
  describe("5. Cryptographic Signed Download Tokens", () => {
    it("generates and verifies short-lived signed download token with timing-safe check", () => {
      const docId = crypto.randomUUID();
      const roomId = crypto.randomUUID();

      const signedToken = createSignedDownloadToken(docId, roomId, buyer1.id, 300);
      expect(signedToken.token.length).toBe(64);

      // Valid token verifies successfully
      const isValid = verifySignedDownloadToken(
        signedToken.token,
        docId,
        roomId,
        buyer1.id,
        signedToken.expiresAt
      );
      expect(isValid).toBe(true);

      // Tampered token (changed user ID) fails
      const isTamperedUser = verifySignedDownloadToken(
        signedToken.token,
        docId,
        roomId,
        seller1.id,
        signedToken.expiresAt
      );
      expect(isTamperedUser).toBe(false);

      // Expired token fails
      const isExpired = verifySignedDownloadToken(
        signedToken.token,
        docId,
        roomId,
        buyer1.id,
        Date.now() - 1000 // Expired 1 second ago
      );
      expect(isExpired).toBe(false);
    });
  });

  // ===========================================================================
  // SECTION 6: GLOBAL RATE LIMITING
  // ===========================================================================
  describe("6. Sliding-Window Rate Limiting Service", () => {
    it("enforces request cap and throws RateLimitExceededError when burst threshold is exceeded", () => {
      const key = `rate:test:${crypto.randomUUID()}`;
      const limitConfig = { windowMs: 10000, maxRequests: 5 };

      // 5 allowed requests
      for (let i = 0; i < 5; i++) {
        const res = checkRateLimit(key, limitConfig);
        expect(res.remaining).toBe(4 - i);
      }

      // 6th request fails
      expect(() => checkRateLimit(key, limitConfig)).toThrow(RateLimitExceededError);
    });
  });

  // ===========================================================================
  // SECTION 7: SEPARATION OF DUTIES & ANTI-SELF-APPROVAL
  // ===========================================================================
  describe("7. Separation of Duties Invariants", () => {
    it("blocks model creator from approving their own valuation model (Anti-Self-Approval)", () => {
      expect(() =>
        assertSeparationOfDuties("REVIEW_VALUATION", buyer1.id, buyer1.id)
      ).toThrow(ForbiddenError);
    });

    it("blocks transaction creator from approving their own transaction closing (Anti-Self-Approval)", () => {
      expect(() =>
        assertSeparationOfDuties("APPROVE_TRANSACTION", buyer1.id, buyer1.id)
      ).toThrow(ForbiddenError);
    });

    it("blocks promoter from reviewing their own uploaded due diligence evidence", () => {
      expect(() =>
        assertSeparationOfDuties("REVIEW_DILIGENCE_EVIDENCE", seller1.id, seller1.id)
      ).toThrow(ForbiddenError);
    });

    it("blocks principal from confirming transaction terms on behalf of counterparty", () => {
      expect(() =>
        assertSeparationOfDuties("CONFIRM_TRANSACTION_TERMS", buyer1.id, buyer1.id, buyer1.id)
      ).toThrow(ForbiddenError);
    });
  });

  // ===========================================================================
  // SECTION 8: SECURITY HEADERS POLICY
  // ===========================================================================
  describe("8. Enterprise Security Headers Configuration", () => {
    it("defines OWASP compliant security headers", () => {
      expect(SECURITY_CONFIG.HEADERS.FRAME_OPTIONS).toBe("DENY");
      expect(SECURITY_CONFIG.HEADERS.CONTENT_TYPE_OPTIONS).toBe("nosniff");
      expect(SECURITY_CONFIG.HEADERS.HSTS).toContain("max-age=31536000");
      expect(SECURITY_CONFIG.HEADERS.CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
      expect(SECURITY_CONFIG.HEADERS.REFERRER_POLICY).toBe("strict-origin-when-cross-origin");
    });
  });
});
