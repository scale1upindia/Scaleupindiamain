// Scale-up India — Phase 15: Admin Notification Outbox Queue API
// Path: src/app/api/v1/admin/notifications/outbox/route.ts

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
      user.roles.includes("ADMIN") ||
      user.permissions.includes("notification.admin");

    if (!isAdmin) {
      throw new ForbiddenError("Administrative privilege required to inspect outbox queue.");
    }

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const [eventsRes, statsRes] = await Promise.all([
      query<any>(
        `SELECT id, tenant_id, event_type, aggregate_type, aggregate_id, 
                actor_user_id, status, idempotency_key, created_at, processed_at
         FROM notification_events 
         ORDER BY created_at DESC 
         LIMIT $1`,
        [limit]
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM notification_events GROUP BY status`
      ),
    ]);

    const stats: Record<string, number> = {};
    for (const r of statsRes.rows) {
      stats[r.status] = parseInt(r.count, 10);
    }

    return apiSuccess({
      events: eventsRes.rows,
      stats,
    });
  } catch (error) {
    return apiError(error);
  }
}
