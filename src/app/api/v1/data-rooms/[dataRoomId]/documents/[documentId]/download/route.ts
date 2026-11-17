// Scale-up India — Phase 8: Stream Confidential Document Download Route
// Path: src/app/api/v1/data-rooms/[dataRoomId]/documents/[documentId]/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { downloadDataRoomDocument } from "@/domains/dataroom/service";
import { apiError } from "@/lib/api/response";
import { ValidationError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ dataRoomId: string; documentId: string }> }
) {
  try {
    const { dataRoomId, documentId } = await params;
    const { searchParams } = new URL(req.url);

    const token = searchParams.get("token");
    const expires = searchParams.get("expires");
    const userId = searchParams.get("u");

    if (!token || !expires || !userId) {
      throw new ValidationError("Missing required signed download parameters.");
    }

    const expiresAt = parseInt(expires, 10);
    if (isNaN(expiresAt)) {
      throw new ValidationError("Invalid expiration timestamp.");
    }

    const doc = await downloadDataRoomDocument(token, expiresAt, userId, dataRoomId, documentId);

    return new NextResponse(doc.buffer as any, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${doc.filename}"`,
        "Content-Length": doc.fileSize.toString(),
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
