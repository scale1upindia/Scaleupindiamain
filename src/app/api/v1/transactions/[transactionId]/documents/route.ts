// Scale-up India — Phase 14: Transaction Documents Route
// Path: src/app/api/v1/transactions/[transactionId]/documents/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  listTransactionDocuments,
  uploadTransactionDocument,
} from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ValidationError } from "@/lib/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId } = await params;
    const documents = await listTransactionDocuments(user, transactionId);

    return apiSuccess({ documents });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId } = await params;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const documentType = (formData.get("documentType") as any) || "FINAL_TRANSACTION_AGREEMENT";
      const title = (formData.get("title") as string) || "Closing Document";
      const conditionId = (formData.get("conditionId") as string) || undefined;
      const signingStatus = (formData.get("signingStatus") as any) || "NOT_REQUIRED";
      const signerIdentity = (formData.get("signerIdentity") as string) || undefined;

      if (!file) {
        throw new ValidationError("Missing file in form data.");
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      const doc = await uploadTransactionDocument(
        user,
        transactionId,
        {
          originalFilename: file.name,
          mimeType: file.type || "application/pdf",
          buffer,
          documentType,
          title,
          conditionId,
          signingStatus,
          signerIdentity,
        },
        {
          ip: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined,
        }
      );

      return apiSuccess({ document: doc }, 201);
    } else {
      // JSON upload with base64 buffer
      const body = await req.json();
      if (!body.base64Content || !body.fileName) {
        throw new ValidationError("Missing base64Content or fileName in JSON payload.");
      }

      const buffer = Buffer.from(body.base64Content, "base64");

      const doc = await uploadTransactionDocument(
        user,
        transactionId,
        {
          originalFilename: body.fileName,
          mimeType: body.mimeType || "application/pdf",
          buffer,
          documentType: body.documentType || "FINAL_TRANSACTION_AGREEMENT",
          title: body.title || "Closing Document",
          conditionId: body.conditionId,
          signingStatus: body.signingStatus,
          signerIdentity: body.signerIdentity,
        },
        {
          ip: req.headers.get("x-forwarded-for") || undefined,
          userAgent: req.headers.get("user-agent") || undefined,
        }
      );

      return apiSuccess({ document: doc }, 201);
    }
  } catch (error) {
    return apiError(error);
  }
}
