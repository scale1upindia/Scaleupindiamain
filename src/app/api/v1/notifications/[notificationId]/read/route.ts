// Scale-up India — Phase 15: Mark Notification Read API
// Path: src/app/api/v1/notifications/[notificationId]/read/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { markNotificationAsRead } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

async function handleMarkRead(notificationId: string) {
  const rawToken = await getSessionToken();
  const user = rawToken ? await validateSession(rawToken) : null;
  assertAuthenticated(user);

  const updated = await markNotificationAsRead(notificationId, user.id);
  return apiSuccess({ success: true, notification: updated });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params;
    return await handleMarkRead(notificationId);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> }
) {
  try {
    const { notificationId } = await params;
    return await handleMarkRead(notificationId);
  } catch (error) {
    return apiError(error);
  }
}
