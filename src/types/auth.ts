export interface RoleRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isInternal: boolean;
}

export interface PermissionRecord {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

export interface DbUserRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string | null;
  first_name: string;
  last_name: string;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  is_active: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  failed_login_attempts: number;
  lockout_until: string | Date | null;
  last_login_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
  deleted_at: string | Date | null;
  google_id?: string | null;
  avatar_url?: string | null;
  auth_provider?: string;
}

export interface UserRecord {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  failedLoginAttempts: number;
  lockoutUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  googleId?: string | null;
  avatarUrl?: string | null;
  authProvider?: string;
}

export interface AuthenticatedUser extends UserRecord {
  roles: string[];
  permissions: string[];
  isInternal: boolean;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  ipHash: string | null;
  userAgent: string | null;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}
