import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import {
  buildGoogleAuthUrl,
  verifyAndDecodeOAuthState,
  signOAuthState,
  processGoogleIdentity,
} from "@/domains/auth/google";
import { registerUser, validateSession } from "@/domains/auth/service";
import { UnauthorizedError, ValidationError, AccountSuspendedError } from "@/lib/errors";

describe("Google OAuth 2.0 / OpenID Connect Authentication", () => {
  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    process.env.GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
    process.env.APP_BASE_URL = "http://localhost:3000";
    await resetTestDb();
  });

  describe("1. OAuth URL Generation & State Cryptographic Integrity", () => {
    it("generates valid Google authorization URL with official parameters and signed state", () => {
      const { authUrl, stateToken, rawState } = buildGoogleAuthUrl({
        redirectPath: "/seller/opportunities",
        roles: ["PROMOTER", "BUYER"],
      });

      expect(authUrl).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(authUrl).toContain("client_id=test-google-client-id.apps.googleusercontent.com");
      expect(authUrl).toContain("response_type=code");
      expect(authUrl).toContain("scope=openid+email+profile");
      expect(authUrl).toContain(`state=${rawState}`);
      expect(authUrl).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fv1%2Fauth%2Fgoogle%2Fcallback");

      // Verify state decoding
      const decoded = verifyAndDecodeOAuthState(stateToken);
      expect(decoded.state).toBe(rawState);
      expect(decoded.redirectPath).toBe("/seller/opportunities");
      expect(decoded.roles).toEqual(["PROMOTER", "BUYER"]);
      expect(decoded.nonce).toBeDefined();
    });

    it("rejects tampered or forged state signature", () => {
      const { stateToken } = buildGoogleAuthUrl({});
      const tamperedToken = stateToken.slice(0, -4) + "abcd";

      expect(() => verifyAndDecodeOAuthState(tamperedToken)).toThrow(ValidationError);
    });

    it("rejects expired state tokens", () => {
      const expiredData = {
        state: "expired-state-test",
        nonce: "test-nonce",
        createdAt: Date.now() - 11 * 60 * 1000, // 11 minutes old (max 10 allowed)
      };
      const signedExpired = signOAuthState(expiredData);

      expect(() => verifyAndDecodeOAuthState(signedExpired)).toThrow("OAuth state has expired");
    });
  });

  describe("2. Security: Case D — Unverified Email Rejection", () => {
    it("rejects Google identity if email is not verified by Google", async () => {
      const unverifiedIdentity = {
        sub: "google-uid-unverified-101",
        email: "unverified@gmail.com",
        email_verified: false,
        name: "Unverified User",
      };

      await expect(
        processGoogleIdentity(unverifiedIdentity)
      ).rejects.toThrow(UnauthorizedError);

      // Verify audit log
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE action = 'GOOGLE_LOGIN_REJECTED_UNVERIFIED_EMAIL'`
      );
      expect(auditRes.rows.length).toBe(1);

      // Verify user was NOT created
      const userRes = await query<{ id: string }>(
        `SELECT id FROM users WHERE email = 'unverified@gmail.com'`
      );
      expect(userRes.rows.length).toBe(0);
    });
  });

  describe("3. Case C — New User Registration via Google", () => {
    it("creates a new user with password_hash=NULL, provider=GOOGLE, verified email and default role", async () => {
      const identity = {
        sub: "google-uid-new-123456",
        email: "raghav.sharma@gmail.com",
        email_verified: true,
        name: "Raghav Sharma",
        given_name: "Raghav",
        family_name: "Sharma",
        picture: "https://lh3.googleusercontent.com/a/avatar-123",
      };

      const result = await processGoogleIdentity(identity, {
        storedRoles: ["PROMOTER", "BUYER"],
        storedRedirect: "/seller/opportunities",
        context: { ip: "10.0.0.1", userAgent: "Mozilla/5.0 Vitest" },
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe("raghav.sharma@gmail.com");
      expect(result.user.firstName).toBe("Raghav");
      expect(result.user.lastName).toBe("Sharma");
      expect(result.user.googleId).toBe("google-uid-new-123456");
      expect(result.user.avatarUrl).toBe("https://lh3.googleusercontent.com/a/avatar-123");
      expect(result.user.authProvider).toBe("GOOGLE");
      expect(result.user.isEmailVerified).toBe(true);
      expect(result.user.roles).toContain("PROMOTER");
      expect(result.user.roles).toContain("BUYER");
      expect(result.redirectPath).toBe("/seller/opportunities");

      // Verify database record has password_hash = NULL
      const userRes = await query<{ password_hash: string | null; google_id: string }>(
        `SELECT password_hash, google_id FROM users WHERE id = $1`,
        [result.user.id]
      );
      expect(userRes.rows[0].password_hash).toBeNull();
      expect(userRes.rows[0].google_id).toBe("google-uid-new-123456");

      // Verify oauth_accounts entry
      const oauthRes = await query<{ provider: string; provider_account_id: string }>(
        `SELECT provider, provider_account_id FROM oauth_accounts WHERE user_id = $1`,
        [result.user.id]
      );
      expect(oauthRes.rows.length).toBe(1);
      expect(oauthRes.rows[0].provider).toBe("google");
      expect(oauthRes.rows[0].provider_account_id).toBe("google-uid-new-123456");

      // Verify active session created and valid
      const sessionUser = await validateSession(result.sessionToken);
      expect(sessionUser).not.toBeNull();
      expect(sessionUser?.id).toBe(result.user.id);

      // Verify audit log
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE actor_id = $1 AND action = 'GOOGLE_ACCOUNT_CREATED'`,
        [result.user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });

    it("prevents self-assignment of internal admin roles during Google signup", async () => {
      const identity = {
        sub: "google-uid-hacker-789",
        email: "attacker@gmail.com",
        email_verified: true,
        name: "Attacker User",
      };

      const result = await processGoogleIdentity(identity, {
        storedRoles: ["SUPER_ADMIN", "ADMIN", "BUYER"],
      });

      // Internal admin roles must be stripped
      expect(result.user.roles).not.toContain("SUPER_ADMIN");
      expect(result.user.roles).not.toContain("ADMIN");
      expect(result.user.roles).toContain("BUYER");
    });
  });

  describe("4. Case A — Safe Account Linking for Existing Password User", () => {
    it("safely links Google identity to existing email user without duplicate creation", async () => {
      // 1. Existing user registered via email & password
      const localUserResult = await registerUser({
        email: "priya.verma@enterprise.in",
        firstName: "Priya",
        lastName: "Verma",
        password: "SecurePassword@123",
        roles: ["INVESTOR"],
      });

      expect(localUserResult.user.isEmailVerified).toBe(false);

      // 2. User signs in with Google using the same email
      const googleIdentity = {
        sub: "google-sub-priya-9876",
        email: "priya.verma@enterprise.in",
        email_verified: true,
        name: "Priya Verma",
        picture: "https://lh3.googleusercontent.com/avatar/priya",
      };

      const linkResult = await processGoogleIdentity(googleIdentity, {
        storedRedirect: "/dashboard",
      });

      // Assert user ID is preserved (NO duplicate created)
      expect(linkResult.user.id).toBe(localUserResult.user.id);
      expect(linkResult.user.googleId).toBe("google-sub-priya-9876");
      expect(linkResult.user.avatarUrl).toBe("https://lh3.googleusercontent.com/avatar/priya");
      expect(linkResult.user.isEmailVerified).toBe(true); // Auto-verified by Google
      expect(linkResult.user.roles).toContain("INVESTOR");

      // Verify total user count for this email is exactly 1
      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE email = 'priya.verma@enterprise.in'`
      );
      expect(parseInt(countRes.rows[0].count, 10)).toBe(1);

      // Verify password_hash was preserved
      const userRes = await query<{ password_hash: string }>(
        `SELECT password_hash FROM users WHERE id = $1`,
        [linkResult.user.id]
      );
      expect(userRes.rows[0].password_hash).not.toBeNull();

      // Verify oauth_accounts entry was created
      const oauthRes = await query<{ provider_account_id: string }>(
        `SELECT provider_account_id FROM oauth_accounts WHERE user_id = $1`,
        [linkResult.user.id]
      );
      expect(oauthRes.rows[0].provider_account_id).toBe("google-sub-priya-9876");

      // Verify audit log
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE actor_id = $1 AND action = 'GOOGLE_ACCOUNT_LINKED'`,
        [linkResult.user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });
  });

  describe("5. Case B — Returning Google User Login", () => {
    it("authenticates returning Google user, updates last_login_at and generates valid session", async () => {
      // 1. Initial Google signup
      const identity = {
        sub: "google-sub-recurring-555",
        email: "recurring.investor@gmail.com",
        email_verified: true,
        name: "Arun Mehra",
      };

      const initialResult = await processGoogleIdentity(identity);
      expect(initialResult.user.id).toBeDefined();

      // 2. Second login with updated avatar
      const returningIdentity = {
        sub: "google-sub-recurring-555",
        email: "recurring.investor@gmail.com",
        email_verified: true,
        name: "Arun Mehra",
        picture: "https://lh3.googleusercontent.com/new-avatar",
      };

      const secondResult = await processGoogleIdentity(returningIdentity);
      expect(secondResult.user.id).toBe(initialResult.user.id);
      expect(secondResult.user.avatarUrl).toBe("https://lh3.googleusercontent.com/new-avatar");

      // Session must be valid
      const sessionUser = await validateSession(secondResult.sessionToken);
      expect(sessionUser?.id).toBe(initialResult.user.id);

      // Verify audit log
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE actor_id = $1 AND action = 'GOOGLE_LOGIN_SUCCESS'`,
        [initialResult.user.id]
      );
      expect(auditRes.rows.length).toBe(1);
    });
  });

  describe("6. Suspended Account Enforcement", () => {
    it("rejects login for suspended Google user", async () => {
      const identity = {
        sub: "google-sub-suspended-999",
        email: "suspended.user@gmail.com",
        email_verified: true,
        name: "Suspended User",
      };

      // Create user
      const created = await processGoogleIdentity(identity);

      // Suspend user
      await query(
        `UPDATE users SET is_suspended = TRUE, suspension_reason = 'Policy violation' WHERE id = $1`,
        [created.user.id]
      );

      // Attempt to sign in again via Google
      await expect(processGoogleIdentity(identity)).rejects.toThrow(AccountSuspendedError);
    });
  });

  describe("7. Route Handlers: Initiation & Callback", () => {
    it("initiates OAuth flow with secure state cookie and redirect target", async () => {
      const { GET: initiateOAuth } = await import("@/app/api/v1/auth/google/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/v1/auth/google?redirect=/deals/deal-123&roles=BUYER");
      const response = await initiateOAuth(req);

      expect(response.status).toBe(307); // NextResponse.redirect default
      const location = response.headers.get("location");
      expect(location).toContain("https://accounts.google.com/o/oauth2/v2/auth");
      expect(location).toContain("client_id=test-google-client-id.apps.googleusercontent.com");

      // Check state cookie attached
      const stateCookie = response.cookies.get("__scaleup_oauth_state");
      expect(stateCookie).toBeDefined();
      expect(stateCookie?.httpOnly).toBe(true);

      const decoded = verifyAndDecodeOAuthState(stateCookie!.value);
      expect(decoded.redirectPath).toBe("/deals/deal-123");
      expect(decoded.roles).toEqual(["BUYER"]);
    });

    it("rejects callback if Google returns access_denied error", async () => {
      const { GET: handleCallback } = await import("@/app/api/v1/auth/google/callback/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/v1/auth/google/callback?error=access_denied");
      const response = await handleCallback(req);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/login?error=access_denied");
    });

    it("rejects callback if state cookie is missing (CSRF attempt)", async () => {
      const { GET: handleCallback } = await import("@/app/api/v1/auth/google/callback/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/v1/auth/google/callback?code=mock_code&state=mock_state");
      const response = await handleCallback(req);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/login?error=invalid_oauth_state");
    });

    it("rejects callback if state parameter mismatches cookie (CSRF tamper)", async () => {
      const { GET: handleCallback } = await import("@/app/api/v1/auth/google/callback/route");
      const { NextRequest } = await import("next/server");

      const stateData = {
        state: "correct_random_state_12345",
        nonce: "test_nonce",
        createdAt: Date.now(),
      };
      const signedState = signOAuthState(stateData);

      const req = new NextRequest(
        "http://localhost:3000/api/v1/auth/google/callback?code=mock_code&state=attacker_manipulated_state",
        {
          headers: {
            cookie: `__scaleup_oauth_state=${signedState}`,
          },
        }
      );
      const response = await handleCallback(req);

      expect(response.status).toBe(307);
      const location = response.headers.get("location");
      expect(location).toContain("/login?error=csrf_state_mismatch");
    });
  });
});
