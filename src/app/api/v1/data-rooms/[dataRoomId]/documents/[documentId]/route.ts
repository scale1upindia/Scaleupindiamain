// Scale-up India — Phase 8: Delete Data Room Document Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/documents/[documentId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { deleteDataRoomDocument } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ dataRoomId: string; documentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { dataRoomId, documentId } = await params;
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await deleteDataRoomDocument(user, dataRoomId, documentId, { ip, userAgent });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
