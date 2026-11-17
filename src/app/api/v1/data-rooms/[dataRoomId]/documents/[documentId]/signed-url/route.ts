// Scale-up India — Phase 8: Generate Signed Download URL Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/documents/[documentId]/signed-url/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { generateSignedUrlSchema } from "@/schemas/nda";
import { generateDocumentSignedUrl } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dataRoomId: string; documentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { dataRoomId, documentId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    const parsed = generateSignedUrlSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await generateDocumentSignedUrl(
      user,
      dataRoomId,
      documentId,
      parsed.expiresInSeconds,
      { ip, userAgent }
    );

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
