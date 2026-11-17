// Scale-up India — Phase 15: Notifications List API
// Path: src/app/api/v1/notifications/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listUserNotifications } from "@/domains/notifications/service";
import { listNotificationsQuerySchema } from "@/schemas/notification";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const queryInput = listNotificationsQuerySchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      unreadOnly: searchParams.get("unreadOnly") || "false",
      category: searchParams.get("category") || undefined,
    });

    const result = await listUserNotifications(user.id, queryInput);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
