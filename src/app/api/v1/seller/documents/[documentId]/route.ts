import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getDocumentForDownload,
  deleteSellerDocument,
} from "@/domains/documents/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { record, buffer } = await getDocumentForDownload(documentId, user);

    const response = new NextResponse(new Uint8Array(buffer));
    response.headers.set("Content-Type", record.mimeType);
    response.headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(record.originalFilename)}"`
    );
    response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    response.headers.set("X-Content-Type-Options", "nosniff");

    return response;
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await deleteSellerDocument(documentId, user, { ip, userAgent });

    return apiSuccess({ message: "Document deleted successfully." });
  } catch (error) {
    return apiError(error);
  }
}
