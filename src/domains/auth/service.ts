import { query, transaction } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  hashIp,
} from "@/lib/security/crypto";
import {
  RegisterInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "@/schemas/auth";
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  AccountLockedError,
  AccountSuspendedError,
  NotFoundError,
} from "@/lib/errors";
import { AuthenticatedUser, UserRecord, DbUserRow } from "@/types/auth";
import { auditLog } from "@/domains/audit/logger";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;
const SESSION_EXPIRY_DAYS = 7;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const PASSWORD_RESET_EXPIRY_HOURS = 1;

export interface AuthSuccessResult {
  user: AuthenticatedUser;
  sessionToken: string;
  emailVerificationToken?: string;
}

/**
 * Register a new user with multi-role support
 */
export async function registerUser(
  input: RegisterInput,
  context?: { ip?: string; userAgent?: string }
): Promise<AuthSuccessResult> {
  // Check if email already exists
  const existingEmail = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [input.email]
  );
  if (existingEmail.rows.length > 0) {
    throw new ConflictError("An account with this email address is already registered.");
  }

  // Check if phone already exists (if provided)
  if (input.phone) {
    const existingPhone = await query<{ id: string }>(
      `SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL`,
      [input.phone]
    );
    if (existingPhone.rows.length > 0) {
      throw new ConflictError("An account with this mobile number is already registered.");
    }
  }

  // Validate that all specified roles exist and are external
  const rolesRes = await query<{ id: string; code: string; is_internal: boolean }>(
    `SELECT id, code, is_internal FROM roles WHERE code = ANY($1::varchar[])`,
    [input.roles]
  );

  if (rolesRes.rows.length !== input.roles.length) {
    throw new ValidationError("One or more selected roles are invalid.");
  }

  const hasInternalRole = rolesRes.rows.some((r) => r.is_internal);
  if (hasInternalRole) {
    throw new ValidationError("Internal administrative roles cannot be self-assigned during registration.");
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);
  const rawSessionToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(rawSessionToken);
  const rawEmailVerificationToken = generateSecureToken(32);
  const emailTokenHash = hashToken(rawEmailVerificationToken);

  const ipHash = hashIp(context?.ip);
  const userAgent = context?.userAgent || null;

  return await transaction(async (tx) => {
    // 1. Insert user
    const userRes = await tx.query<DbUserRow>(
      `INSERT INTO users (
        email, phone, password_hash, first_name, last_name,
        is_email_verified, is_phone_verified, is_active, is_suspended
      ) VALUES ($1, $2, $3, $4, $5, FALSE, FALSE, TRUE, FALSE)
      RETURNING *`,
      [input.email, input.phone || null, passwordHash, input.firstName, input.lastName]
    );
    const user = userRes.rows[0];

    // 2. Assign user roles
    for (const role of rolesRes.rows) {
      await tx.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
        [user.id, role.id]
      );
    }

    // 3. Create initial session
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await tx.query(
      `INSERT INTO sessions (user_id, token_hash, ip_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, sessionTokenHash, ipHash, userAgent, expiresAt]
    );

    // 4. Create email verification token
    const emailExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);
    await tx.query(
      `INSERT INTO verification_tokens (user_id, token_hash, type, expires_at)
       VALUES ($1, $2, 'EMAIL_VERIFICATION', $3)`,
      [user.id, emailTokenHash, emailExpiresAt]
    );

    // Fetch user permissions
    const permRes = await tx.query<{ code: string }>(
      `SELECT DISTINCT p.code
       FROM permissions p
       JOIN role_permissions rp ON p.id = rp.permission_id
       JOIN user_roles ur ON rp.role_id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.first_name,
      lastName: user.last_name,
      isEmailVerified: user.is_email_verified,
      isPhoneVerified: user.is_phone_verified,
      isActive: user.is_active,
      isSuspended: user.is_suspended,
      suspensionReason: user.suspension_reason,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: null,
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
      roles: input.roles,
      permissions: permRes.rows.map((p) => p.code),
      isInternal: false,
    };

    await auditLog({
      actorId: user.id,
      action: "USER_REGISTERED",
      resourceType: "users",
      resourceId: user.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { roles: input.roles },
    });

    return {
      user: authenticatedUser,
      sessionToken: rawSessionToken,
      emailVerificationToken: rawEmailVerificationToken,
    };
  });
}

/**
 * Authenticate user credentials and create active session
 */
export async function loginUser(
  input: LoginInput,
  context?: { ip?: string; userAgent?: string }
): Promise<AuthSuccessResult> {
  const userRes = await query<any>(
    `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [input.email]
  );

  if (userRes.rows.length === 0) {
    // Constant time dummy check to prevent user enumeration timing attacks
    await verifyPassword("dummy_password", "$2a$12$e8Y4JgE.yE9pL1W0mS6zGe9cR2r4x2P6m1V5l9T0k1J8z5X4a3Q2O");
    throw new UnauthorizedError("Invalid email address or password.");
  }

  const rawUser = userRes.rows[0];

  // Check account suspension
  if (rawUser.is_suspended) {
    throw new AccountSuspendedError(
      rawUser.suspension_reason || "Your account has been suspended by Scale-up India administration."
    );
  }

  // Check brute force lockout
  if (rawUser.lockout_until && new Date(rawUser.lockout_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(rawUser.lockout_until).getTime() - Date.now()) / (1000 * 60)
    );
    throw new AccountLockedError(
      `Account is temporarily locked due to consecutive failed attempts. Try again in ${minutesLeft} minutes.`
    );
  }

  // Verify password
  const isValid = await verifyPassword(input.password, rawUser.password_hash);
  if (!isValid) {
    const newAttempts = (rawUser.failed_login_attempts || 0) + 1;
    let lockoutDate: Date | null = null;

    if (newAttempts >= MAX_FAILED_ATTEMPTS) {
      lockoutDate = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    }

    await query(
      `UPDATE users 
       SET failed_login_attempts = $1, lockout_until = $2, updated_at = NOW() 
       WHERE id = $3`,
      [newAttempts, lockoutDate, rawUser.id]
    );

    await auditLog({
      actorId: rawUser.id,
      action: "LOGIN_FAILED",
      resourceType: "users",
      resourceId: rawUser.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { attempts: newAttempts, lockedOut: !!lockoutDate },
    });

    if (lockoutDate) {
      throw new AccountLockedError(
        `Account locked due to 5 failed attempts. Please wait ${LOCKOUT_DURATION_MINUTES} minutes or reset your password.`
      );
    }

    throw new UnauthorizedError("Invalid email address or password.");
  }

  // Success: Reset failed login attempts and update last_login_at
  await query(
    `UPDATE users 
     SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = NOW(), updated_at = NOW() 
     WHERE id = $1`,
    [rawUser.id]
  );

  // Generate session token
  const rawSessionToken = generateSecureToken(32);
  const sessionTokenHash = hashToken(rawSessionToken);
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const ipHash = hashIp(context?.ip);

  await query(
    `INSERT INTO sessions (user_id, token_hash, ip_hash, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [rawUser.id, sessionTokenHash, ipHash, context?.userAgent || null, expiresAt]
  );

  // Fetch roles and permissions
  const rolesRes = await query<{ code: string; is_internal: boolean }>(
    `SELECT r.code, r.is_internal 
     FROM roles r 
     JOIN user_roles ur ON r.id = ur.role_id 
     WHERE ur.user_id = $1`,
    [rawUser.id]
  );

  const permRes = await query<{ code: string }>(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [rawUser.id]
  );

  const authenticatedUser: AuthenticatedUser = {
    id: rawUser.id,
    email: rawUser.email,
    phone: rawUser.phone,
    firstName: rawUser.first_name,
    lastName: rawUser.last_name,
    isEmailVerified: rawUser.is_email_verified,
    isPhoneVerified: rawUser.is_phone_verified,
    isActive: rawUser.is_active,
    isSuspended: rawUser.is_suspended,
    suspensionReason: rawUser.suspension_reason,
    failedLoginAttempts: 0,
    lockoutUntil: null,
    lastLoginAt: new Date(),
    createdAt: rawUser.created_at,
    updatedAt: rawUser.updated_at,
    roles: rolesRes.rows.map((r) => r.code),
    permissions: permRes.rows.map((p) => p.code),
    isInternal: rolesRes.rows.some((r) => r.is_internal),
  };

  await auditLog({
    actorId: rawUser.id,
    action: "USER_LOGIN",
    resourceType: "users",
    resourceId: rawUser.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return {
    user: authenticatedUser,
    sessionToken: rawSessionToken,
  };
}

/**
 * Validates a session token and returns the current user context with fresh roles & permissions
 */
export async function validateSession(rawToken: string): Promise<AuthenticatedUser | null> {
  if (!rawToken || rawToken.trim().length === 0) return null;

  const sessionTokenHash = hashToken(rawToken);

  const sessionRes = await query<{
    user_id: string;
    expires_at: Date;
    revoked_at: Date | null;
  }>(
    `SELECT user_id, expires_at, revoked_at 
     FROM sessions 
     WHERE token_hash = $1`,
    [sessionTokenHash]
  );

  if (sessionRes.rows.length === 0) return null;
  const session = sessionRes.rows[0];

  if (session.revoked_at || new Date(session.expires_at) <= new Date()) {
    return null;
  }

  const userRes = await query<any>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [session.user_id]
  );

  if (userRes.rows.length === 0) return null;
  const rawUser = userRes.rows[0];

  if (rawUser.is_suspended || !rawUser.is_active) return null;

  // Fetch current roles and permissions
  const rolesRes = await query<{ code: string; is_internal: boolean }>(
    `SELECT r.code, r.is_internal 
     FROM roles r 
     JOIN user_roles ur ON r.id = ur.role_id 
     WHERE ur.user_id = $1`,
    [rawUser.id]
  );

  const permRes = await query<{ code: string }>(
    `SELECT DISTINCT p.code
     FROM permissions p
     JOIN role_permissions rp ON p.id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1`,
    [rawUser.id]
  );

  return {
    id: rawUser.id,
    email: rawUser.email,
    phone: rawUser.phone,
    firstName: rawUser.first_name,
    lastName: rawUser.last_name,
    isEmailVerified: rawUser.is_email_verified,
    isPhoneVerified: rawUser.is_phone_verified,
    isActive: rawUser.is_active,
    isSuspended: rawUser.is_suspended,
    suspensionReason: rawUser.suspension_reason,
    failedLoginAttempts: rawUser.failed_login_attempts || 0,
    lockoutUntil: rawUser.lockout_until ? new Date(rawUser.lockout_until) : null,
    lastLoginAt: rawUser.last_login_at ? new Date(rawUser.last_login_at) : null,
    createdAt: rawUser.created_at,
    updatedAt: rawUser.updated_at,
    roles: rolesRes.rows.map((r) => r.code),
    permissions: permRes.rows.map((p) => p.code),
    isInternal: rolesRes.rows.some((r) => r.is_internal),
  };
}

/**
 * Logout single session
 */
export async function logoutUser(
  rawToken: string,
  userId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await query(
    `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1`,
    [tokenHash]
  );

  await auditLog({
    actorId: userId,
    action: "USER_LOGOUT",
    resourceType: "sessions",
    resourceId: userId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Logout all active sessions for a user
 */
export async function logoutAllSessions(
  userId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  await query(
    `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );

  await auditLog({
    actorId: userId,
    action: "USER_LOGOUT_ALL",
    resourceType: "users",
    resourceId: userId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Initiate password reset flow (issues secure 1-hour token)
 */
export async function createPasswordResetToken(
  input: ForgotPasswordInput,
  context?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; token?: string }> {
  const userRes = await query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [input.email]
  );

  // Return success even if email not found to prevent user enumeration
  if (userRes.rows.length === 0) {
    return { success: true };
  }

  const userId = userRes.rows[0].id;
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

  // Invalidate any existing unused reset tokens for this user
  await query(
    `UPDATE verification_tokens 
     SET used_at = NOW() 
     WHERE user_id = $1 AND type = 'PASSWORD_RESET' AND used_at IS NULL`,
    [userId]
  );

  await query(
    `INSERT INTO verification_tokens (user_id, token_hash, type, expires_at)
     VALUES ($1, $2, 'PASSWORD_RESET', $3)`,
    [userId, tokenHash, expiresAt]
  );

  await auditLog({
    actorId: userId,
    action: "PASSWORD_RESET_REQUESTED",
    resourceType: "users",
    resourceId: userId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return { success: true, token: rawToken };
}

/**
 * Complete password reset with token
 */
export async function resetPassword(
  input: ResetPasswordInput,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const tokenHash = hashToken(input.token);

  const tokenRes = await query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
    `SELECT id, user_id, expires_at, used_at 
     FROM verification_tokens 
     WHERE token_hash = $1 AND type = 'PASSWORD_RESET'`,
    [tokenHash]
  );

  if (tokenRes.rows.length === 0) {
    throw new ValidationError("Invalid or expired password reset token.");
  }

  const tokenRecord = tokenRes.rows[0];

  if (tokenRecord.used_at) {
    throw new ValidationError("This password reset token has already been used.");
  }

  if (new Date(tokenRecord.expires_at) <= new Date()) {
    throw new ValidationError("Password reset token has expired. Please request a new one.");
  }

  const newPasswordHash = await hashPassword(input.newPassword);

  await transaction(async (tx) => {
    // 1. Update password and clear any failed attempts / lockouts
    await tx.query(
      `UPDATE users 
       SET password_hash = $1, failed_login_attempts = 0, lockout_until = NULL, updated_at = NOW() 
       WHERE id = $2`,
      [newPasswordHash, tokenRecord.user_id]
    );

    // 2. Mark token as used
    await tx.query(
      `UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenRecord.id]
    );

    // 3. Security invariant: Revoke ALL existing active sessions for this user
    await tx.query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [tokenRecord.user_id]
    );
  });

  await auditLog({
    actorId: tokenRecord.user_id,
    action: "PASSWORD_CHANGED",
    resourceType: "users",
    resourceId: tokenRecord.user_id,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Verify email address via verification token
 */
export async function verifyEmail(
  input: VerifyEmailInput,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const tokenHash = hashToken(input.token);

  const tokenRes = await query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
    `SELECT id, user_id, expires_at, used_at 
     FROM verification_tokens 
     WHERE token_hash = $1 AND type = 'EMAIL_VERIFICATION'`,
    [tokenHash]
  );

  if (tokenRes.rows.length === 0) {
    throw new ValidationError("Invalid email verification token.");
  }

  const tokenRecord = tokenRes.rows[0];

  if (tokenRecord.used_at) {
    throw new ValidationError("Email address has already been verified.");
  }

  if (new Date(tokenRecord.expires_at) <= new Date()) {
    throw new ValidationError("Email verification link has expired. Please request a new one.");
  }

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE users SET is_email_verified = TRUE, updated_at = NOW() WHERE id = $1`,
      [tokenRecord.user_id]
    );

    await tx.query(
      `UPDATE verification_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenRecord.id]
    );
  });

  await auditLog({
    actorId: tokenRecord.user_id,
    action: "EMAIL_VERIFIED",
    resourceType: "users",
    resourceId: tokenRecord.user_id,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}
