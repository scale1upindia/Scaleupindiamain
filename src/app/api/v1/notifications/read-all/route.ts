// Scale-up India — Phase 15: Mark All Notifications Read API
// Path: src/app/api/v1/notifications/read-all/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { markAllNotificationsAsRead } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const result = await markAllNotificationsAsRead(user.id);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
