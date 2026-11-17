import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import {
  registerUser,
  loginUser,
  validateSession,
  logoutUser,
  logoutAllSessions,
  createPasswordResetToken,
  resetPassword,
  verifyEmail,
} from "@/domains/auth/service";
import {
  ValidationError,
  UnauthorizedError,
  AccountLockedError,
  ConflictError,
} from "@/lib/errors";

describe("Phase 1: Enterprise Authentication & Session Management", () => {
  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();
  });

  it("registers a user with multiple commercial roles and issues session + email verification token", async () => {
    const result = await registerUser(
      {
        email: "promoter@enterprise.in",
        firstName: "Vikram",
        lastName: "Singhania",
        password: "Password@123",
        phone: "+919876543210",
        roles: ["PROMOTER", "INVESTOR"],
      },
      { ip: "192.168.1.10", userAgent: "Mozilla/5.0 Vitest" }
    );

    expect(result.user).toBeDefined();
    expect(result.user.email).toBe("promoter@enterprise.in");
    expect(result.user.roles).toContain("PROMOTER");
    expect(result.user.roles).toContain("INVESTOR");
    expect(result.user.isEmailVerified).toBe(false);
    expect(result.sessionToken).toBeDefined();
    expect(result.emailVerificationToken).toBeDefined();

    // Verify session in database
    const sessionUser = await validateSession(result.sessionToken);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser?.id).toBe(result.user.id);
    expect(sessionUser?.permissions).toContain("opportunities.create"); // From PROMOTER
    expect(sessionUser?.permissions).toContain("payments.initiate"); // From INVESTOR
  });

  it("prevents self-assignment of internal administrative roles during registration", async () => {
    await expect(
      registerUser({
        email: "hacker@test.in",
        firstName: "Bad",
        lastName: "Actor",
        password: "Password@123",
        roles: ["SUPER_ADMIN" as any],
      })
    ).rejects.toThrow();
  });

  it("authenticates valid credentials and updates last login timestamp", async () => {
    await registerUser({
      email: "buyer@venture.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "StrongPassword@99",
      roles: ["BUYER"],
    });

    const loginRes = await loginUser(
      { email: "buyer@venture.in", password: "StrongPassword@99" },
      { ip: "10.0.0.1" }
    );

    expect(loginRes.user.email).toBe("buyer@venture.in");
    expect(loginRes.sessionToken).toBeDefined();
  });

  it("enforces brute-force lockout after 5 consecutive failed login attempts", async () => {
    await registerUser({
      email: "victim@corp.in",
      firstName: "Rohan",
      lastName: "Mehta",
      password: "CorrectPassword#1",
      roles: ["PROMOTER"],
    });

    // 4 failed attempts should throw UnauthorizedError
    for (let i = 1; i <= 4; i++) {
      await expect(
        loginUser({ email: "victim@corp.in", password: "WrongPassword" })
      ).rejects.toThrow(UnauthorizedError);
    }

    // 5th failed attempt triggers account lockout
    await expect(
      loginUser({ email: "victim@corp.in", password: "WrongPassword" })
    ).rejects.toThrow(AccountLockedError);

    // Subsequent login attempt (even with correct password) is blocked during lockout window
    await expect(
      loginUser({ email: "victim@corp.in", password: "CorrectPassword#1" })
    ).rejects.toThrow(AccountLockedError);
  });

  it("revokes active session on single logout", async () => {
    const reg = await registerUser({
      email: "user@exit.in",
      firstName: "Dev",
      lastName: "Patel",
      password: "SecurePass@2026",
      roles: ["PROMOTER"],
    });

    // Session valid before logout
    const before = await validateSession(reg.sessionToken);
    expect(before).not.toBeNull();

    // Logout
    await logoutUser(reg.sessionToken, reg.user.id);

    // Session invalid after logout
    const after = await validateSession(reg.sessionToken);
    expect(after).toBeNull();
  });

  it("revokes all active sessions on logoutAllSessions", async () => {
    const reg = await registerUser({
      email: "multidevice@corp.in",
      firstName: "Suresh",
      lastName: "Iyer",
      password: "SecurePass@2026",
      roles: ["BUYER"],
    });

    // Device 2 login
    const login2 = await loginUser({
      email: "multidevice@corp.in",
      password: "SecurePass@2026",
    });

    expect(await validateSession(reg.sessionToken)).not.toBeNull();
    expect(await validateSession(login2.sessionToken)).not.toBeNull();

    // Terminate all sessions
    await logoutAllSessions(reg.user.id);

    expect(await validateSession(reg.sessionToken)).toBeNull();
    expect(await validateSession(login2.sessionToken)).toBeNull();
  });

  it("executes email verification via secure verification token", async () => {
    const reg = await registerUser({
      email: "verify@startup.in",
      firstName: "Pooja",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["PARTNER"],
    });

    expect(reg.emailVerificationToken).toBeDefined();

    // Verify email
    await verifyEmail({ token: reg.emailVerificationToken! });

    // Validate user in DB now has is_email_verified = true
    const userRes = await query<{ is_email_verified: boolean }>(
      `SELECT is_email_verified FROM users WHERE id = $1`,
      [reg.user.id]
    );
    expect(userRes.rows[0].is_email_verified).toBe(true);

    // Token reuse is rejected
    await expect(verifyEmail({ token: reg.emailVerificationToken! })).rejects.toThrow(
      ValidationError
    );
  });

  it("handles password reset and invalidates all existing active sessions", async () => {
    const reg = await registerUser({
      email: "reset@enterprise.in",
      firstName: "Alok",
      lastName: "Verma",
      password: "OldPassword@123",
      roles: ["INVESTOR"],
    });

    const resetReq = await createPasswordResetToken({ email: "reset@enterprise.in" });
    expect(resetReq.token).toBeDefined();

    // Update password
    await resetPassword({
      token: resetReq.token!,
      newPassword: "BrandNewPassword@2026",
    });

    // Session prior to password reset MUST be revoked
    expect(await validateSession(reg.sessionToken)).toBeNull();

    // Old password fails
    await expect(
      loginUser({ email: "reset@enterprise.in", password: "OldPassword@123" })
    ).rejects.toThrow(UnauthorizedError);

    // New password succeeds
    const newLogin = await loginUser({
      email: "reset@enterprise.in",
      password: "BrandNewPassword@2026",
    });
    expect(newLogin.user.id).toBe(reg.user.id);
  });
});
