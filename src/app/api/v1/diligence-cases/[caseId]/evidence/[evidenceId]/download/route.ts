// Scale-up India — Phase 12: Stream Diligence Evidence Download Route
// Path: src/app/api/v1/diligence-cases/[caseId]/evidence/[evidenceId]/download/route.ts

import { NextRequest, NextResponse } from "next/server";
import { streamEvidenceDocument } from "@/domains/diligence/service";
import { apiError } from "@/lib/api/response";
import { ValidationError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  try {
    const { caseId, evidenceId } = await params;
    const { searchParams } = new URL(req.url);

    const token = searchParams.get("token");
    const expires = searchParams.get("expires");
    const userId = searchParams.get("u");
    const versionStr = searchParams.get("v");

    if (!token || !expires || !userId || !versionStr) {
      throw new ValidationError("Missing required signed download parameters.");
    }

    const expiresAt = parseInt(expires, 10);
    const versionNumber = parseInt(versionStr, 10);

    if (isNaN(expiresAt) || isNaN(versionNumber)) {
      throw new ValidationError("Invalid expiration or version parameter.");
    }

    const doc = await streamEvidenceDocument(
      token,
      expiresAt,
      userId,
      caseId,
      evidenceId,
      versionNumber
    );

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
