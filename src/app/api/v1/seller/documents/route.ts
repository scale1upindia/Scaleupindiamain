import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getOrCreateSellerProfile } from "@/domains/seller/service";
import { uploadSellerDocument } from "@/domains/documents/service";
import { SellerDocumentTypeEnum } from "@/schemas/seller";
import { ValidationError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const profile = await getOrCreateSellerProfile(user);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentTypeRaw = formData.get("documentType") as string | null;

    if (!file) {
      throw new ValidationError("No file attached in multipart form.");
    }
    if (!documentTypeRaw) {
      throw new ValidationError("documentType is required.");
    }

    const documentType = SellerDocumentTypeEnum.parse(documentTypeRaw);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const documentRecord = await uploadSellerDocument(
      profile.id,
      user,
      {
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        documentType,
      },
      { ip, userAgent }
    );

    return apiSuccess({
      document: documentRecord,
      message: "Document uploaded to private vault successfully.",
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}

