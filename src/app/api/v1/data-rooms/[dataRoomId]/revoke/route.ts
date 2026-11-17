// Scale-up India — Phase 8: Administrative Revoke Data Room Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/revoke/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { revokeNDASchema } from "@/schemas/nda";
import { revokeDataRoom } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dataRoomId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { dataRoomId } = await params;
    const body = await req.json();
    const parsed = revokeNDASchema.parse(body);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await revokeDataRoom(user, dataRoomId, parsed, { ip, userAgent });
    return apiSuccess({ revoked: true });
  } catch (error) {
    return apiError(error);
  }
}
