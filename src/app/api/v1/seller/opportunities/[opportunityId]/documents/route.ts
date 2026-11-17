import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { uploadOpportunityDocument } from "@/domains/documents/service";
import { ValidationError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { opportunityId } = await params;
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as string | null;
    const accessTierRaw = formData.get("accessTier") as string | null;

    if (!file) {
      throw new ValidationError("No file attached in multipart form.");
    }
    if (!documentType) {
      throw new ValidationError("documentType is mandatory.");
    }

    const accessTier = accessTierRaw ? Number(accessTierRaw) : 2;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const documentRecord = await uploadOpportunityDocument(
      opportunityId,
      user,
      {
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        documentType,
        accessTier,
      },
      { ip, userAgent }
    );

    return apiSuccess(
      {
        document: documentRecord,
        message: "Opportunity document uploaded to private vault successfully.",
      },
      201
    );
  } catch (error) {
    return apiError(error);
  }
}
