// Scale-up India — Phase 12: Upload Diligence Evidence Route
// Path: src/app/api/v1/diligence-cases/[caseId]/evidence/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { uploadEvidenceMetadataSchema } from "@/schemas/diligence";
import { uploadEvidenceDocument, listEvidenceForCase } from "@/domains/diligence/service";
import { ValidationError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const evidence = await listEvidenceForCase(user, caseId);
    return apiSuccess({ evidence });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const checklistItemId = formData.get("checklistItemId") as string | null;
    const requestId = (formData.get("requestId") as string | null) || undefined;
    const title = formData.get("title") as string | null;
    const category = formData.get("category") as string | null;
    const isConfidentialStr = formData.get("isConfidential");
    const isConfidential = isConfidentialStr === null ? true : isConfidentialStr === "true";

    if (!file) {
      throw new ValidationError("No evidence file attached in request.");
    }

    const parsedMetadata = uploadEvidenceMetadataSchema.parse({
      checklistItemId,
      requestId,
      title,
      category,
      isConfidential,
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await uploadEvidenceDocument(
      user,
      caseId,
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
