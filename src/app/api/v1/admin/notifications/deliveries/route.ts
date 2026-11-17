// Scale-up India — Phase 15: Admin Notification Deliveries API
// Path: src/app/api/v1/admin/notifications/deliveries/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listDeliveriesAdmin } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

    const deliveries = await listDeliveriesAdmin(user, { status, limit });
    return apiSuccess({ deliveries });
  } catch (error) {
    return apiError(error);
  }
}
