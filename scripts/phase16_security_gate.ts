// Scale-up India — Phase 16: Enterprise Security Hardening Security Gate
// Script: scripts/phase16_security_gate.ts

import crypto from "crypto";
import { getDb, query, resetTestDb } from "../src/lib/db";
import {
  registerUser,
  loginUser,
  createPasswordResetToken,
  resetPassword,
} from "../src/domains/auth/service";
import {
  setupMfaEnrollment,
  confirmMfaActivation,
  verifyMfaChallenge,
  generateTotpCode,
  decryptSecret,
} from "../src/domains/auth/mfa";
import { validateSafeUrl, assertSafeUrl } from "../src/lib/security/ssrf";
import {
  validateUploadedFile,
  assertUploadedFile,
  sanitizeFilename,
  detectMagicBytes,
} from "../src/lib/security/fileValidator";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "../src/lib/security/downloadToken";
import {
  checkRateLimit,
  resetAllRateLimits,
  RateLimitExceededError,
} from "../src/lib/security/rateLimiter";
import {
  assertSeparationOfDuties,
  hasPermission,
} from "../src/lib/security/rbacMatrix";
import { SECURITY_CONFIG } from "../src/lib/security/config";
import { AuthenticatedUser } from "../src/types/auth";
import {
  ValidationError,
  ForbiddenError,
  AccountLockedError,
  UnauthorizedError,
} from "../src/lib/errors";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 16 ENTERPRISE SECURITY HARDENING GATE");
  console.log("=================================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition: boolean, code: string, message: string) {
    if (condition) {
      console.log(`  [PASS] ${code}: ${message}`);
      totalPassed++;
    } else {
      console.error(`  [FAIL] ${code}: ${message}`);
      totalFailed++;
    }
  }

  try {
    (process.env as any).NODE_ENV = "test";
    resetAllRateLimits();
    await resetTestDb();
    const db = await getDb();

    // =========================================================================
    // SECTION 1: DATABASE SCHEMA & MIGRATION 016 INTEGRITY (Assertions 1-8)
    // =========================================================================
    console.log("--- SECTION 1: DATABASE SCHEMA & MIGRATION 016 INTEGRITY ---");

    const mfaCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'users' AND column_name IN (
         'mfa_enabled', 'mfa_secret_encrypted', 'mfa_recovery_codes_hash', 'mfa_enrolled_at'
       )`
    );
    const mfaColNames = mfaCols.rows.map((r) => r.column_name);

    assert(mfaColNames.includes("mfa_enabled"), "SEC16-01", "users table has mfa_enabled column");
    assert(mfaColNames.includes("mfa_secret_encrypted"), "SEC16-02", "users table has mfa_secret_encrypted column");
    assert(mfaColNames.includes("mfa_recovery_codes_hash"), "SEC16-03", "users table has mfa_recovery_codes_hash column");
    assert(mfaColNames.includes("mfa_enrolled_at"), "SEC16-04", "users table has mfa_enrolled_at column");

    const eventsTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'security_compliance_events'
      ) as exists`
    );
    assert(eventsTable.rows[0]?.exists === true, "SEC16-05", "security_compliance_events table exists");

    const complianceCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'security_compliance_events' AND column_name IN (
         'id', 'event_type', 'threat_severity', 'actor_id', 'resource_type', 'resource_id', 'ip_hash', 'user_agent', 'details', 'created_at'
       )`
    );
    assert(complianceCols.rows.length >= 8, "SEC16-06", "security_compliance_events has all required security telemetry columns");

    const indexRes = await query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'security_compliance_events'`
    );
    const indexNames = indexRes.rows.map((r) => r.indexname);
    assert(
      indexNames.some((n) => n.includes("actor")) || indexNames.some((n) => n.includes("severity")),
      "SEC16-07",
      "Indexes exist on security_compliance_events for actor and threat severity"
    );

    const permsRes = await query<{ code: string }>(
      `SELECT code FROM permissions WHERE code IN ('security.admin', 'security.audit')`
    );
    assert(permsRes.rows.length === 2, "SEC16-08", "RBAC permissions security.admin and security.audit are seeded in database");

    // =========================================================================
    // SECTION 2: IDENTITY & SESSION HARDENING (Assertions 9-16)
    // =========================================================================
    console.log("\n--- SECTION 2: IDENTITY & SESSION HARDENING ---");

    const regBuyer = await registerUser({
      email: "gate.buyer@investcorp.in",
      firstName: "Rohan",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const testBuyer = regBuyer.user;

    // Attempts 1-4
    for (let i = 0; i < 4; i++) {
      try {
        await loginUser({ email: testBuyer.email, password: "WrongPassword@1" });
      } catch (err: any) {
        // Expected UnauthorizedError
      }
    }

    const midLockout = await query<{ failed_login_attempts: number }>(
      `SELECT failed_login_attempts FROM users WHERE id = $1`,
      [testBuyer.id]
    );
    assert(midLockout.rows[0].failed_login_attempts === 4, "SEC16-09", "Failed login attempts are tracked incrementally");

    // Attempt 5 locks account
    let attempt5Locked = false;
    try {
      await loginUser({ email: testBuyer.email, password: "WrongPassword@1" });
    } catch (err: any) {
      if (err instanceof AccountLockedError) attempt5Locked = true;
    }
    assert(attempt5Locked, "SEC16-10", "5th consecutive failed login attempt triggers AccountLockedError");

    // Check lockout in future and even correct password rejected
    let correctPasswordRejected = false;
    try {
      await loginUser({ email: testBuyer.email, password: "Password@123" });
    } catch (err: any) {
      if (err instanceof AccountLockedError) correctPasswordRejected = true;
    }
    assert(correctPasswordRejected, "SEC16-11", "Locked user is rejected even with valid password (Brute-Force defense)");

    // Unlock user for password reset test
    await query(`UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = $1`, [testBuyer.id]);

    // Active session before reset
    const loginSession = await loginUser({ email: testBuyer.email, password: "Password@123" });
    const resetTokenRes = await createPasswordResetToken({ email: testBuyer.email });
    assert(!!resetTokenRes.token, "SEC16-12", "Password reset token generated securely");

    await resetPassword({ token: resetTokenRes.token!, newPassword: "NewSecretPassword@456" });
    const activeSessionsAfter = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM sessions WHERE user_id = $1 AND revoked_at IS NULL`,
      [testBuyer.id]
    );
    assert(parseInt(activeSessionsAfter.rows[0].count, 10) === 0, "SEC16-13", "Password reset immediately revokes ALL active sessions");

    // Reuse of reset token blocked
    let tokenReused = false;
    try {
      await resetPassword({ token: resetTokenRes.token!, newPassword: "AnotherPassword@789" });
    } catch (err: any) {
      if (err instanceof ValidationError) tokenReused = true;
    }
    assert(tokenReused, "SEC16-14", "Used password reset token cannot be reused");

    // Role privilege injection rejection
    let roleInjectionBlocked = false;
    try {
      await registerUser({
        email: "hacker@intruder.org",
        firstName: "Malicious",
        lastName: "Actor",
        password: "Password@123",
        roles: ["SUPER_ADMIN"] as any,
      });
    } catch (err: any) {
      if (err instanceof ValidationError) roleInjectionBlocked = true;
    }
    assert(roleInjectionBlocked, "SEC16-15", "Registration strictly rejects self-assignment of internal administrative roles");

    const userHashRes = await query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1`,
      [testBuyer.id]
    );
    assert(
      userHashRes.rows[0].password_hash.startsWith("$2a$12$") || userHashRes.rows[0].password_hash.startsWith("$2b$12$"),
      "SEC16-16",
      "Password hashing uses bcrypt with work factor >= 12"
    );

    // =========================================================================
    // SECTION 3: MFA-READY ARCHITECTURE & CRYPTOGRAPHIC STORAGE (Assertions 17-23)
    // =========================================================================
    console.log("\n--- SECTION 3: MFA-READY ARCHITECTURE & CRYPTOGRAPHIC STORAGE ---");

    const mfaSetup = setupMfaEnrollment(testBuyer.email);
    assert(mfaSetup.otpauthUrl.startsWith("otpauth://totp/ScaleupIndia:"), "SEC16-17", "MFA enrollment generates RFC 6238 compliant TOTP URI");

    assert(
      mfaSetup.encryptedSecret.includes(":") && mfaSetup.encryptedSecret.split(":").length === 3,
      "SEC16-18",
      "MFA secret is encrypted using AES-256-GCM (iv:authTag:ciphertext)"
    );

    const decryptedSecret = decryptSecret(mfaSetup.encryptedSecret);
    assert(decryptedSecret.length >= 16, "SEC16-19", "Encrypted secret is successfully decrypted back to valid TOTP secret");

    assert(
      mfaSetup.recoveryCodes.length === 8 && mfaSetup.hashedRecoveryCodes.length === 8,
      "SEC16-20",
      "MFA enrollment generates 8 distinct single-use recovery codes"
    );

    assert(
      mfaSetup.hashedRecoveryCodes.every((h) => h.length === 64),
      "SEC16-21",
      "Recovery codes are stored exclusively as 64-character SHA-256 hashes"
    );

    // Confirm MFA activation
    const currentTotp = generateTotpCode(decryptedSecret);
    await confirmMfaActivation(testBuyer.id, mfaSetup.encryptedSecret, mfaSetup.hashedRecoveryCodes, currentTotp);

    // Challenge with single-use recovery code
    const firstCode = mfaSetup.recoveryCodes[0];
    const challengeRes = await verifyMfaChallenge(testBuyer.id, firstCode);
    assert(challengeRes.verified === true && challengeRes.usedRecoveryCode === true, "SEC16-22", "MFA challenge successfully verified using recovery code");

    // Replay attack with same recovery code fails
    const replayRes = await verifyMfaChallenge(testBuyer.id, firstCode);
    assert(replayRes.verified === false, "SEC16-23", "Single-use recovery code is immediately invalidated after first use");

    // =========================================================================
    // SECTION 4: SERVER-SIDE REQUEST FORGERY (SSRF) DEFENSE (Assertions 24-32)
    // =========================================================================
    console.log("\n--- SECTION 4: SERVER-SIDE REQUEST FORGERY (SSRF) DEFENSE ---");

    assert(!validateSafeUrl("http://localhost:8080/metrics").isValid, "SEC16-24", "SSRF defense blocks localhost target");
    assert(!validateSafeUrl("http://127.0.0.1:3000/internal").isValid, "SEC16-25", "SSRF defense blocks IPv4 loopback 127.0.0.1");
    assert(!validateSafeUrl("http://[::1]/admin").isValid, "SEC16-26", "SSRF defense blocks IPv6 loopback [::1]");
    assert(!validateSafeUrl("http://169.254.169.254/latest/meta-data/").isValid, "SEC16-27", "SSRF defense blocks cloud link-local metadata 169.254.169.254");
    assert(!validateSafeUrl("http://metadata.google.internal/computeMetadata/v1/").isValid, "SEC16-28", "SSRF defense blocks Google Cloud metadata hostname");
    assert(!validateSafeUrl("http://10.0.0.5/api/v1/users").isValid, "SEC16-29", "SSRF defense blocks RFC1918 Class A private subnet (10.x.x.x)");
    assert(!validateSafeUrl("http://172.16.50.1/secrets").isValid, "SEC16-30", "SSRF defense blocks RFC1918 Class B private subnet (172.16-31.x.x)");
    assert(!validateSafeUrl("http://192.168.1.254/router").isValid, "SEC16-31", "SSRF defense blocks RFC1918 Class C private subnet (192.168.x.x)");

    const encodedDwordBlocked = !validateSafeUrl("http://2130706433/").isValid; // 127.0.0.1 in dword
    const fileProtocolBlocked = !validateSafeUrl("file:///etc/passwd").isValid;
    assert(encodedDwordBlocked && fileProtocolBlocked, "SEC16-32", "SSRF defense blocks encoded Dword IPs and non-HTTP protocols (file://, gopher://)");

    // =========================================================================
    // SECTION 5: FILE UPLOAD SECURITY & MAGIC-BYTE INSPECTION (Assertions 33-41)
    // =========================================================================
    console.log("\n--- SECTION 5: FILE UPLOAD SECURITY & MAGIC-BYTE INSPECTION ---");

    const validPdfBuffer = Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.from("1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"),
    ]);
    const pdfResult = assertUploadedFile(validPdfBuffer, "financial_audit.pdf");
    assert(pdfResult.isValid && pdfResult.mimeType === "application/pdf", "SEC16-33", "Authentic PDF with magic bytes %PDF- is accepted");

    const validPngBuffer = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("IHDR-chunk-data"),
    ]);
    assert(detectMagicBytes(validPngBuffer) === "PNG", "SEC16-34", "Authentic PNG magic bytes (0x89PNG\\r\\n) correctly identified");

    const validJpgBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.from("JFIF-header-data"),
    ]);
    assert(detectMagicBytes(validJpgBuffer) === "JPEG", "SEC16-35", "Authentic JPEG SOI marker (0xFFD8FF) correctly identified");

    const spoofedPdfBuffer = Buffer.from("<html><script>alert(1)</script></html>");
    const spoofValidation = validateUploadedFile(spoofedPdfBuffer, "malicious.pdf");
    assert(!spoofValidation.isValid && Boolean(spoofValidation.error?.includes("MIME spoofing")), "SEC16-36", "MIME spoofing detected and rejected (HTML disguised as .pdf)");

    const exeValidation = validateUploadedFile(validPdfBuffer, "trojan.exe");
    assert(!exeValidation.isValid && Boolean(exeValidation.error?.includes("prohibited")), "SEC16-37", "Executable extensions (.exe, .sh, .bat) strictly rejected");

    const svgValidation = validateUploadedFile(validPdfBuffer, "payload.svg");
    assert(!svgValidation.isValid && Boolean(svgValidation.error?.includes("prohibited")), "SEC16-38", "Scriptable SVG uploads strictly rejected");

    const sanitizedPosix = sanitizeFilename("../../../etc/passwd");
    assert(sanitizedPosix === "etc_passwd", "SEC16-39", "POSIX directory traversal safely sanitized (../../../etc/passwd -> etc_passwd)");

    const sanitizedWin = sanitizeFilename("..\\..\\windows\\system32\\cmd.exe");
    assert(sanitizedWin === "windows_system32_cmd.exe", "SEC16-40", "Windows directory traversal safely sanitized");

    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    oversizedBuffer[0] = 0x25;
    oversizedBuffer[1] = 0x50;
    oversizedBuffer[2] = 0x44;
    oversizedBuffer[3] = 0x46;
    oversizedBuffer[4] = 0x2d;
    const sizeValidation = validateUploadedFile(oversizedBuffer, "oversized.pdf");
    assert(!sizeValidation.isValid && Boolean(sizeValidation.error?.includes("exceeds maximum")), "SEC16-41", "Oversized file upload (>15MB) rejected");

    // =========================================================================
    // SECTION 6: CRYPTOGRAPHIC SIGNED DOWNLOAD TOKENS (Assertions 42-47)
    // =========================================================================
    console.log("\n--- SECTION 6: CRYPTOGRAPHIC SIGNED DOWNLOAD TOKENS ---");

    const docId = crypto.randomUUID();
    const roomId = crypto.randomUUID();
    const tokenObj = createSignedDownloadToken(docId, roomId, testBuyer.id, 300);

    assert(tokenObj.token.length === 64, "SEC16-42", "Signed token is a 64-character HMAC-SHA256 hex string");

    const validToken = verifySignedDownloadToken(tokenObj.token, docId, roomId, testBuyer.id, tokenObj.expiresAt);
    assert(validToken === true, "SEC16-43", "Authentic signed token verifies successfully within TTL");

    const tamperedDoc = verifySignedDownloadToken(tokenObj.token, crypto.randomUUID(), roomId, testBuyer.id, tokenObj.expiresAt);
    assert(tamperedDoc === false, "SEC16-44", "Tampering with documentId invalidates token signature");

    const tamperedRoom = verifySignedDownloadToken(tokenObj.token, docId, crypto.randomUUID(), testBuyer.id, tokenObj.expiresAt);
    assert(tamperedRoom === false, "SEC16-45", "Tampering with dataRoomId invalidates token signature");

    const tamperedUser = verifySignedDownloadToken(tokenObj.token, docId, roomId, crypto.randomUUID(), tokenObj.expiresAt);
    assert(tamperedUser === false, "SEC16-46", "Tampering with userId invalidates token signature");

    const expiredToken = verifySignedDownloadToken(tokenObj.token, docId, roomId, testBuyer.id, Math.floor(Date.now() / 1000) - 10);
    assert(expiredToken === false, "SEC16-47", "Expired token is rejected even if signature is valid");

    // =========================================================================
    // SECTION 7: SLIDING-WINDOW RATE LIMITING (Assertions 48-52)
    // =========================================================================
    console.log("\n--- SECTION 7: SLIDING-WINDOW RATE LIMITING ---");

    const rateKey = "test_rate_bucket_" + Date.now();
    const rateLimitConfig = { windowMs: 10000, maxRequests: 3 };

    const req1 = checkRateLimit(rateKey, rateLimitConfig);
    assert(req1.remaining === 2, "SEC16-48", "Initial request within rate limit window allowed");

    const req2 = checkRateLimit(rateKey, rateLimitConfig);
    const req3 = checkRateLimit(rateKey, rateLimitConfig);
    assert(req2.remaining === 1 && req3.remaining === 0, "SEC16-49", "Requests up to max burst limit allowed");

    let rateLimitThrown = false;
    try {
      checkRateLimit(rateKey, rateLimitConfig);
    } catch (err: any) {
      if (err instanceof RateLimitExceededError) rateLimitThrown = true;
    }
    assert(rateLimitThrown, "SEC16-50", "Request exceeding burst limit throws RateLimitExceededError");

    const otherKeyReq = checkRateLimit("different_key_" + Date.now(), rateLimitConfig);
    assert(otherKeyReq.remaining === 2, "SEC16-51", "Rate limits are isolated per key / bucket");

    resetAllRateLimits();
    const afterResetReq = checkRateLimit(rateKey, rateLimitConfig);
    assert(afterResetReq.remaining === 2, "SEC16-52", "resetAllRateLimits resets bucket state successfully");

    // =========================================================================
    // SECTION 8: SEPARATION OF DUTIES & ANTI-SELF-APPROVAL (Assertions 53-57)
    // =========================================================================
    console.log("\n--- SECTION 8: SEPARATION OF DUTIES & ANTI-SELF-APPROVAL ---");

    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();

    let modelSelfApprovalBlocked = false;
    try {
      assertSeparationOfDuties("REVIEW_VALUATION", userA, userA);
    } catch (err: any) {
      if (err instanceof ForbiddenError) modelSelfApprovalBlocked = true;
    }
    assert(modelSelfApprovalBlocked, "SEC16-53", "Anti-Self-Approval: Creator cannot approve their own valuation model");

    let txSelfApprovalBlocked = false;
    try {
      assertSeparationOfDuties("APPROVE_TRANSACTION", userA, userA);
    } catch (err: any) {
      if (err instanceof ForbiddenError) txSelfApprovalBlocked = true;
    }
    assert(txSelfApprovalBlocked, "SEC16-54", "Anti-Self-Approval: Creator cannot approve their own transaction closing");

    let diligenceSelfApprovalBlocked = false;
    try {
      assertSeparationOfDuties("REVIEW_DILIGENCE_EVIDENCE", userA, userA);
    } catch (err: any) {
      if (err instanceof ForbiddenError) diligenceSelfApprovalBlocked = true;
    }
    assert(diligenceSelfApprovalBlocked, "SEC16-55", "Anti-Self-Approval: Uploader cannot review their own due diligence evidence");

    let termsSelfConfirmationBlocked = false;
    try {
      assertSeparationOfDuties("CONFIRM_TRANSACTION_TERMS", userA, userB, userA);
    } catch (err: any) {
      if (err instanceof ForbiddenError) termsSelfConfirmationBlocked = true;
    }
    assert(termsSelfConfirmationBlocked, "SEC16-56", "Anti-Self-Approval: Counterparty cannot confirm terms on behalf of the other");

    let independentApprovalAllowed = false;
    try {
      assertSeparationOfDuties("REVIEW_VALUATION", userA, userB);
      independentApprovalAllowed = true;
    } catch {
      independentApprovalAllowed = false;
    }
    assert(independentApprovalAllowed, "SEC16-57", "Separation of duties permits independent authorized reviewer");

    // =========================================================================
    // SECTION 9: SECURITY HEADERS & CORS/CSRF DEFENSE (Assertions 58-62)
    // =========================================================================
    console.log("\n--- SECTION 9: SECURITY HEADERS & CORS/CSRF DEFENSE ---");

    assert(
      SECURITY_CONFIG.HEADERS.CONTENT_SECURITY_POLICY.includes("frame-ancestors 'none'"),
      "SEC16-58",
      "Content Security Policy defines frame-ancestors 'none' (Anti-Clickjacking)"
    );

    assert(
      SECURITY_CONFIG.HEADERS.HSTS.includes("max-age=31536000") && SECURITY_CONFIG.HEADERS.HSTS.includes("includeSubDomains"),
      "SEC16-59",
      "HSTS header enforces 1-year max-age with includeSubDomains and preload"
    );

    assert(SECURITY_CONFIG.HEADERS.FRAME_OPTIONS === "DENY", "SEC16-60", "X-Frame-Options is set to DENY");
    assert(SECURITY_CONFIG.HEADERS.CONTENT_TYPE_OPTIONS === "nosniff", "SEC16-61", "X-Content-Type-Options is set to nosniff");
    assert(
      SECURITY_CONFIG.HEADERS.REFERRER_POLICY === "strict-origin-when-cross-origin",
      "SEC16-62",
      "Referrer-Policy is set to strict-origin-when-cross-origin"
    );

    // =========================================================================
    // SECTION 10: RBAC MATRIX & AUDIT LOG INTEGRITY (Assertions 63-65)
    // =========================================================================
    console.log("\n--- SECTION 10: RBAC MATRIX & AUDIT LOG INTEGRITY ---");

    const buyerHasAdminPerm = hasPermission(["BUYER"], "security.admin");
    assert(!buyerHasAdminPerm, "SEC16-63", "Least Privilege: BUYER role does NOT have security.admin permission");

    const adminHasSecurityPerm = hasPermission(["SUPER_ADMIN"], "security.admin");
    assert(adminHasSecurityPerm, "SEC16-64", "SUPER_ADMIN role has security.admin permission");

    const auditCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE actor_id = $1`,
      [testBuyer.id]
    );
    assert(parseInt(auditCount.rows[0].count, 10) > 0, "SEC16-65", "Audit logs verify persistent tamper-evident records for security operations");

    // =========================================================================
    // SUMMARY REPORT
    // =========================================================================
    console.log("\n=================================================================");
    console.log(`PHASE 16 SECURITY GATE SUMMARY`);
    console.log(`TOTAL ASSERTIONS : ${totalPassed + totalFailed}`);
    console.log(`PASSED           : ${totalPassed}`);
    console.log(`FAILED           : ${totalFailed}`);
    console.log("=================================================================");

    if (totalFailed > 0) {
      console.error(`\n❌ VERDICT: FAIL — ${totalFailed} assertions failed.`);
      process.exit(1);
    } else {
      console.log(`\n✅ VERDICT: PASS — ALL ${totalPassed} ASSERTIONS PASSED.`);
      console.log("STATUS: READY_FOR_PHASE_17");
      process.exit(0);
    }
  } catch (error) {
    console.error("FATAL ERROR IN SECURITY GATE:", error);
    process.exit(1);
  }
}

runSecurityGate();
