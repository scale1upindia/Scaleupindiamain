import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getOrCreateBuyerProfile } from "@/domains/buyer/service";
import { uploadBuyerDocument } from "@/domains/documents/service";
import { BuyerDocumentType } from "@/types/buyer";
import { ValidationError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const profile = await getOrCreateBuyerProfile(user);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const documentType = formData.get("documentType") as BuyerDocumentType | null;
    const mandateId = formData.get("mandateId") as string | null;

    if (!file || typeof file === "string") {
      throw new ValidationError("No document file was provided for upload.");
    }
    if (!documentType) {
      throw new ValidationError("Document type classification is required.");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const record = await uploadBuyerDocument(
      profile.id,
      user,
      {
        originalFilename: file.name,
        mimeType: file.type || "application/octet-stream",
        buffer,
        documentType,
        mandateId: mandateId || null,
      },
      { ip, userAgent }
    );

    return apiSuccess({
      document: record,
      message: "Buyer document successfully uploaded and verified with SHA-256 checksum.",
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}

