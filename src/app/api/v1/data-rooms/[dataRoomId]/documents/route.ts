// Scale-up India — Phase 8: Upload Document to Data Room Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/documents/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { uploadDataRoomDocumentSchema } from "@/schemas/nda";
import { uploadDataRoomDocument } from "@/domains/dataroom/service";
import { ValidationError } from "@/lib/errors";
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const documentCategory = formData.get("documentCategory") as string | null;
    const accessLevel = (formData.get("accessLevel") as string | null) || "ROOM_MEMBER";

    if (!file) {
      throw new ValidationError("No document file attached in request.");
    }

    const parsedMetadata = uploadDataRoomDocumentSchema.parse({
      title,
      documentCategory,
      accessLevel,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await uploadDataRoomDocument(
      user,
      dataRoomId,
      {
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
      },
      parsedMetadata,
      { ip, userAgent }
    );

    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
