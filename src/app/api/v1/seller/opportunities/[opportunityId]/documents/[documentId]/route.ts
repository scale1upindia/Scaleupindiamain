import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getOpportunityDocumentForDownload,
  deleteOpportunityDocument,
} from "@/domains/documents/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string; documentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { documentId } = await params;
    const { record, buffer } = await getOpportunityDocumentForDownload(documentId, user);

    const headers = new Headers();
    headers.set("Content-Type", record.mimeType);
    headers.set("Content-Length", buffer.length.toString());
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(record.originalFilename)}"`
    );
    headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate");
    headers.set("X-Content-Type-Options", "nosniff");

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string; documentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { documentId } = await params;
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await deleteOpportunityDocument(documentId, user, { ip, userAgent });

    return apiSuccess({ message: "Opportunity document removed successfully." });
  } catch (error) {
    return apiError(error);
  }
}
