// Scale-up India — Phase 15: Get Notification by ID API
// Path: src/app/api/v1/notifications/[notificationId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getNotificationById } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { notificationId } = await params;
    const notification = await getNotificationById(notificationId, user.id);
    return apiSuccess(notification);
  } catch (error) {
    return apiError(error);
  }
}
