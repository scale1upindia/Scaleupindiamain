// Scale-up India — Phase 8: Get Data Room Detail Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getDataRoomForUser } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataRoomId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { dataRoomId } = await params;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const dataRoom = await getDataRoomForUser(user, dataRoomId, { ip, userAgent });
    return apiSuccess(dataRoom);
  } catch (error) {
    return apiError(error);
  }
}
