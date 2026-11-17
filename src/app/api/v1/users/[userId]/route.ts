import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertCanAccessUser } from "@/lib/security/authorization";
import { query } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId: targetUserId } = await params;

    const rawToken = await getSessionToken();
    const requestingUser = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(requestingUser);

    // ANTI-IDOR AUTHORIZATION CHECK:
    // Requesting user MUST be the target user OR possess 'users.read' permission
    assertCanAccessUser(requestingUser, targetUserId, "users.read");

    const userRes = await query<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      phone: string | null;
      is_email_verified: boolean;
      created_at: Date;
    }>(
      `SELECT id, email, first_name, last_name, phone, is_email_verified, created_at 
       FROM users 
       WHERE id = $1 AND deleted_at IS NULL`,
      [targetUserId]
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundError("User record not found.");
    }

    const targetUser = userRes.rows[0];

    // Fetch target user's roles
    const rolesRes = await query<{ code: string }>(
      `SELECT r.code 
       FROM roles r 
       JOIN user_roles ur ON r.id = ur.role_id 
       WHERE ur.user_id = $1`,
      [targetUserId]
    );

    return apiSuccess({
      user: {
        id: targetUser.id,
        email: targetUser.email,
        firstName: targetUser.first_name,
        lastName: targetUser.last_name,
        phone: targetUser.phone,
        isEmailVerified: targetUser.is_email_verified,
        createdAt: targetUser.created_at,
        roles: rolesRes.rows.map((r) => r.code),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

