import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import { generateSecureToken, hashToken, hashIp } from "@/lib/security/crypto";
import {
  ValidationError,
  UnauthorizedError,
  AccountSuspendedError,
} from "@/lib/errors";
import { AuthenticatedUser, DbUserRow } from "@/types/auth";
import { auditLog } from "@/domains/audit/logger";

const SESSION_EXPIRY_DAYS = 7;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes
const OAUTH_SECRET = process.env.AUTH_SECRET || "scaleup_oauth_signing_fallback_key_min32chars";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
}

export interface GoogleOAuthStateData {
  state: string;
  nonce: string;
  redirectPath?: string;
  roles?: string[];
  createdAt: number;
}

export interface GoogleUserIdentity {
  sub: string;
  email: string;
  email_verified: boolean | string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface GoogleAuthResult {
  user: AuthenticatedUser;
  sessionToken: string;
  redirectPath: string;
}

/**
 * Returns Google OAuth configuration from environment
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const isConfigured = Boolean(clientId.trim() && clientSecret.trim());

  return {
    clientId,
    clientSecret,
    isConfigured,
  };
}

/**
 * Resolves the canonical public base URL of the platform.
 * Ensures internal container ports (like localhost:10000 on Render) are never leaked to user redirects.
 */
export function getPublicBaseUrl(reqOrHeaders?: {
  headers?: { get: (name: string) => string | null };
}): string {
  // 1. Highest priority: explicit production environment variable
  const envBase = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL;
  if (envBase && envBase.trim() && !envBase.includes("localhost:10000")) {
    return envBase.trim().replace(/\/+$/, "");
  }

  // 2. Derive from request headers (x-forwarded-host has precedence on reverse proxies)
  if (reqOrHeaders?.headers) {
    const forwardedHost = reqOrHeaders.headers.get("x-forwarded-host");
    const host = forwardedHost || reqOrHeaders.headers.get("host");
    const proto =
      reqOrHeaders.headers.get("x-forwarded-proto") ||
      (forwardedHost || (host && !host.includes("localhost")) ? "https" : "http");

    if (host && !host.includes("localhost:10000") && !host.includes("127.0.0.1:10000")) {
      return `${proto}://${host}`;
    }
  }

  // 3. Fallback to production Render domain if running in production
  if (process.env.NODE_ENV === "production") {
    return "https://scaleup-india.onrender.com";
  }

  // 4. Local development fallback
  return "http://localhost:3000";
}

/**
 * Derives the canonical OAuth redirect URI based on base URL or request headers
 */
export function getGoogleRedirectUri(baseUrl?: string): string {
  let base = baseUrl;
  if (!base || base.includes("localhost:10000") || base.includes("127.0.0.1:10000")) {
    base = getPublicBaseUrl();
  }
  const canonicalBase = base.replace(/\/+$/, "");
  return `${canonicalBase}/api/v1/auth/google/callback`;
}

/**
 * Signs and packages OAuth state payload with HMAC SHA-256 to prevent CSRF / tampering
 */
export function signOAuthState(data: GoogleOAuthStateData): string {
  const jsonPayload = JSON.stringify(data);
  const base64Payload = Buffer.from(jsonPayload, "utf-8").toString("base64url");
  const hmac = crypto.createHmac("sha256", OAUTH_SECRET).update(base64Payload).digest("hex");
  return `${base64Payload}.${hmac}`;
}

/**
 * Validates and decodes the HMAC-signed OAuth state payload
 */
export function verifyAndDecodeOAuthState(signedToken: string): GoogleOAuthStateData {
  const parts = signedToken.split(".");
  if (parts.length !== 2) {
    throw new ValidationError("Malformed OAuth state signature.");
  }

  const [base64Payload, hmac] = parts;
  const expectedHmac = crypto.createHmac("sha256", OAUTH_SECRET).update(base64Payload).digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
    throw new ValidationError("Invalid OAuth state signature (potential CSRF tamper attempt).");
  }

  const jsonPayload = Buffer.from(base64Payload, "base64url").toString("utf-8");
  const data: GoogleOAuthStateData = JSON.parse(jsonPayload);

  // Expiration check
  if (Date.now() - data.createdAt > OAUTH_STATE_MAX_AGE_MS) {
    throw new ValidationError("OAuth state has expired. Please initiate authentication again.");
  }

  return data;
}

/**
 * Generates the official Google OAuth 2.0 authorization URL
 */
export function buildGoogleAuthUrl(options: {
  baseUrl?: string;
  redirectPath?: string;
  roles?: string[];
}): { authUrl: string; stateToken: string; rawState: string } {
  const config = getGoogleOAuthConfig();
  const rawState = generateSecureToken(32);
  const nonce = generateSecureToken(32);

  const stateData: GoogleOAuthStateData = {
    state: rawState,
    nonce,
    redirectPath: options.redirectPath || "/dashboard",
    roles: options.roles,
    createdAt: Date.now(),
  };

  const stateToken = signOAuthState(stateData);
  const redirectUri = getGoogleRedirectUri(options.baseUrl);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: rawState,
    nonce,
    access_type: "online",
    prompt: "select_account",
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    stateToken,
    rawState,
  };
}

/**
 * Exchanges authorization code with Google token endpoint
 */
export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; id_token?: string }> {
  const config = getGoogleOAuthConfig();

  const bodyParams = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: bodyParams.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  const tokenData = await response.json();
  return tokenData as { access_token: string; id_token?: string };
}

/**
 * Fetches user profile from Google UserInfo endpoint
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserIdentity> {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch Google user profile (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as GoogleUserIdentity;
}

/**
 * Handles Account Linking & Lifecycle for Google authenticated users:
 * - Case A: Existing user with same email registered locally (safely link)
 * - Case B: Existing user previously authenticated via Google
 * - Case C: New user registering via Google (create user with password_hash = NULL)
 * - Case D: Unverified email from Google (reject immediately)
 */
export async function processGoogleIdentity(
  identity: GoogleUserIdentity,
  options?: {
    storedRoles?: string[];
    storedRedirect?: string;
    context?: { ip?: string; userAgent?: string };
  }
): Promise<GoogleAuthResult> {
  // Case D: Validate email verification
  const isVerified = identity.email_verified === true || identity.email_verified === "true";
  if (!isVerified) {
    await auditLog({
      action: "GOOGLE_LOGIN_REJECTED_UNVERIFIED_EMAIL",
      resourceType: "users",
      resourceId: identity.sub,
      ip: options?.context?.ip,
      userAgent: options?.context?.userAgent,
      metadata: { email: identity.email, provider: "google" },
    });
    throw new UnauthorizedError(
      "Your Google account email is not verified. Please verify your email with Google or sign in using a password."
    );
  }

  const email = identity.email.trim().toLowerCase();
  const googleId = identity.sub;
  const avatarUrl = identity.picture || null;
  const firstName = identity.given_name || identity.name?.split(" ")[0] || "User";
  const lastName =
    identity.family_name ||
    (identity.name && identity.name.split(" ").length > 1
      ? identity.name.split(" ").slice(1).join(" ")
      : "Member");

  return await transaction(async (tx) => {
    // 1. Check if user already exists by google_id or via oauth_accounts (Case B)
    const existingGoogleRes = await tx.query<DbUserRow>(
      `SELECT u.* FROM users u
       LEFT JOIN oauth_accounts oa ON u.id = oa.user_id AND oa.provider = 'google'
       WHERE (u.google_id = $1 OR oa.provider_account_id = $1)
         AND u.deleted_at IS NULL
       LIMIT 1`,
      [googleId]
    );

    let user: DbUserRow;
    let isNewUser = false;
    let isAccountLinked = false;

    if (existingGoogleRes.rows.length > 0) {
      // Case B: Existing user with Google identity
      user = existingGoogleRes.rows[0];

      if (user.is_suspended) {
        throw new AccountSuspendedError(
          user.suspension_reason || "Your account has been suspended by Scale-up India administration."
        );
      }

      // Update avatar if not present, and update last_login_at
      const updatedRes = await tx.query<DbUserRow>(
        `UPDATE users
         SET last_login_at = NOW(),
             avatar_url = COALESCE(avatar_url, $1),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [avatarUrl, user.id]
      );
      user = updatedRes.rows[0];

      // Ensure oauth_accounts mapping exists
      await tx.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email)
         VALUES ($1, 'google', $2, $3)
         ON CONFLICT (provider, provider_account_id) DO NOTHING`,
        [user.id, googleId, email]
      );
    } else {
      // Check if user exists by email (Case A)
      const existingEmailRes = await tx.query<DbUserRow>(
        `SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
        [email]
      );

      if (existingEmailRes.rows.length > 0) {
        // Case A: Existing user registered via email/password - Link account
        user = existingEmailRes.rows[0];

        if (user.is_suspended) {
          throw new AccountSuspendedError(
            user.suspension_reason || "Your account has been suspended by Scale-up India administration."
          );
        }

        const updatedRes = await tx.query<DbUserRow>(
          `UPDATE users
           SET google_id = $1,
               is_email_verified = TRUE,
               avatar_url = COALESCE(avatar_url, $2),
               last_login_at = NOW(),
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [googleId, avatarUrl, user.id]
        );
        user = updatedRes.rows[0];

        await tx.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email)
           VALUES ($1, 'google', $2, $3)
           ON CONFLICT (provider, provider_account_id) DO NOTHING`,
          [user.id, googleId, email]
        );

        isAccountLinked = true;
      } else {
        // Case C: New user registering via Google
        isNewUser = true;

        const newUserRes = await tx.query<DbUserRow>(
          `INSERT INTO users (
             email, first_name, last_name, google_id, avatar_url,
             auth_provider, is_email_verified, is_phone_verified, is_active, is_suspended, password_hash
           ) VALUES ($1, $2, $3, $4, $5, 'GOOGLE', TRUE, FALSE, TRUE, FALSE, NULL)
           RETURNING *`,
          [email, firstName, lastName, googleId, avatarUrl]
        );

        user = newUserRes.rows[0];

        await tx.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_account_id, email)
           VALUES ($1, 'google', $2, $3)`,
          [user.id, googleId, email]
        );

        // Assign external commercial roles (Default: PROMOTER, or user-selected from registration)
        const allowedExternalRoles = ["PROMOTER", "BUYER", "INVESTOR", "PARTNER"];
        const candidateRoles = (options?.storedRoles || []).filter((r) =>
          allowedExternalRoles.includes(r)
        );
        const rolesToAssign = candidateRoles.length > 0 ? candidateRoles : ["PROMOTER"];

        const rolesRes = await tx.query<{ id: string; code: string }>(
          `SELECT id, code FROM roles WHERE code = ANY($1::varchar[])`,
          [rolesToAssign]
        );

        for (const r of rolesRes.rows) {
          await tx.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [user.id, r.id]
          );
        }
      }
    }

    // Generate secure platform session
    const rawSessionToken = generateSecureToken(32);
    const sessionTokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    const ipHash = hashIp(options?.context?.ip);

    await tx.query(
      `INSERT INTO sessions (user_id, token_hash, ip_hash, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, sessionTokenHash, ipHash, options?.context?.userAgent || null, expiresAt]
    );

    // Fetch user roles and permissions
    const rolesRes = await tx.query<{ code: string; is_internal: boolean }>(
      `SELECT r.code, r.is_internal
       FROM roles r
       JOIN user_roles ur ON r.id = ur.role_id
       WHERE ur.user_id = $1`,
      [user.id]
    );

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
      lastLoginAt: new Date(),
      createdAt: new Date(user.created_at),
      updatedAt: new Date(user.updated_at),
      googleId: user.google_id || googleId,
      avatarUrl: user.avatar_url || avatarUrl,
      authProvider: user.auth_provider || (isNewUser ? "GOOGLE" : "LOCAL"),
      roles: rolesRes.rows.map((r) => r.code),
      permissions: permRes.rows.map((p) => p.code),
      isInternal: rolesRes.rows.some((r) => r.is_internal),
    };

    // Determine audit action
    let auditAction = "GOOGLE_LOGIN_SUCCESS";
    if (isNewUser) {
      auditAction = "GOOGLE_ACCOUNT_CREATED";
    } else if (isAccountLinked) {
      auditAction = "GOOGLE_ACCOUNT_LINKED";
    }

    await auditLog({
      actorId: user.id,
      action: auditAction,
      resourceType: "users",
      resourceId: user.id,
      ip: options?.context?.ip,
      userAgent: options?.context?.userAgent,
      metadata: {
        provider: "google",
        googleId,
        email,
        isNewUser,
        isAccountLinked,
        roles: authenticatedUser.roles,
      },
    });

    return {
      user: authenticatedUser,
      sessionToken: rawSessionToken,
      redirectPath: options?.storedRedirect || "/dashboard",
    };
  });
}
