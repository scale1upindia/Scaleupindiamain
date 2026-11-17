import { AuthenticatedUser } from "@/types/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/**
 * Asserts that the client has an active, authenticated session
 */
export function assertAuthenticated(user: AuthenticatedUser | null): asserts user is AuthenticatedUser {
  if (!user) {
    throw new UnauthorizedError("Authentication required. Please log in.");
  }
}

/**
 * Asserts that the authenticated user possesses a specific permission
 */
export function assertPermission(user: AuthenticatedUser, permissionCode: string): void {
  if (user.roles.includes("SUPER_ADMIN")) {
    return; // Super Admin retains bypass on all permissions
  }
  if (!user.permissions.includes(permissionCode)) {
    throw new ForbiddenError(
      `Access denied: Missing required permission [${permissionCode}].`
    );
  }
}

/**
 * Asserts that the authenticated user possesses at least one of the specified roles
 */
export function assertAnyRole(user: AuthenticatedUser, allowedRoles: string[]): void {
  if (user.roles.includes("SUPER_ADMIN")) {
    return;
  }
  const hasRole = allowedRoles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    throw new ForbiddenError(
      `Access denied: Action restricted to roles [${allowedRoles.join(", ")}].`
    );
  }
}

/**
 * Object-level Anti-IDOR Authorization Check for User Resources:
 * Ensures a user can only access their own profile/records unless they possess administrative privileges
 */
export function assertCanAccessUser(
  requestingUser: AuthenticatedUser,
  targetUserId: string,
  adminPermissionRequired = "users.read"
): void {
  // 1. Direct Ownership Check
  if (requestingUser.id === targetUserId) {
    return;
  }

  // 2. Admin Permission Override Check
  if (
    requestingUser.roles.includes("SUPER_ADMIN") ||
    requestingUser.permissions.includes(adminPermissionRequired)
  ) {
    return;
  }

  // 3. IDOR Prevention: Conceal or Reject
  throw new ForbiddenError("You are not authorized to access records belonging to another user.");
}

/**
 * Object-level Anti-IDOR Authorization Check for Documents:
 * Protects confidential files from cross-user inspection
 */
export function assertCanAccessDocumentRecord(
  requestingUser: AuthenticatedUser,
  documentOwnerId: string,
  accessLevel: string,
  isPartyToActiveNda = false
): void {
  // 1. Owner always has full access
  if (requestingUser.id === documentOwnerId) {
    return;
  }

  // 2. Internal Staff with global document read access
  if (
    requestingUser.roles.includes("SUPER_ADMIN") ||
    requestingUser.permissions.includes("documents.read_all")
  ) {
    return;
  }

  // 3. Party to deal room under active NDA for permitted document tiers
  if (isPartyToActiveNda && (accessLevel === "NDA_REQUIRED" || accessLevel === "VERIFIED_BUYER")) {
    return;
  }

  throw new ForbiddenError("You do not have authorization to view this confidential document.");
}

