// Scale-up India — Phase 15: Admin Notification Delivery Retry API
// Path: src/app/api/v1/admin/notifications/deliveries/[deliveryId]/retry/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { retryDelivery } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ deliveryId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { deliveryId } = await params;
    const result = await retryDelivery(deliveryId, user);
    return apiSuccess({ success: true, delivery: result });
  } catch (error) {
    return apiError(error);
  }
}
