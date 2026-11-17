// Scale-up India — Phase 16: Admin Security Compliance API
// Path: src/app/api/v1/admin/security/compliance/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { query } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const isAdmin =
      user.roles.includes("SUPER_ADMIN") ||
      user.permissions.includes("security.audit") ||
      user.permissions.includes("security.admin");

    if (!isAdmin) {
      throw new ForbiddenError("Administrative privilege required to view security compliance telemetry.");
    }

    const [
      activeSessionsRes,
      lockedUsersRes,
      mfaUsersRes,
      recentEventsRes,
    ] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE lockout_until > CURRENT_TIMESTAMP`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM users WHERE mfa_enabled = TRUE`
      ),
      query<any>(
        `SELECT * FROM security_compliance_events ORDER BY created_at DESC LIMIT 10`
      ),
    ]);

    return apiSuccess({
      securityTelemetry: {
        activeSessions: parseInt(activeSessionsRes.rows[0]?.count || "0", 10),
        lockedAccounts: parseInt(lockedUsersRes.rows[0]?.count || "0", 10),
        mfaEnrolledAccounts: parseInt(mfaUsersRes.rows[0]?.count || "0", 10),
        recentSecurityEvents: recentEventsRes.rows,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
