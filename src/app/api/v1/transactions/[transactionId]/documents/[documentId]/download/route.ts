// Scale-up India — Phase 14: Download Transaction Document Route
// Path: src/app/api/v1/transactions/[transactionId]/documents/[documentId]/download/route.ts

import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { assertTransactionMember } from "@/domains/transaction/service";
import { query } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string; documentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId, documentId } = await params;
    await assertTransactionMember(user, transactionId);

    const docRes = await query<any>(
      `SELECT * FROM transaction_documents WHERE id = $1 AND transaction_id = $2`,
      [documentId, transactionId]
    );

    if (docRes.rows.length === 0) {
      throw new NotFoundError("Transaction document not found.");
    }

    const doc = docRes.rows[0];
    const fullPath = path.resolve(process.cwd(), "data", doc.file_path);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundError("Document file not found on disk vault.");
    }

    const fileBuffer = fs.readFileSync(fullPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": doc.mime_type,
        "Content-Disposition": `attachment; filename="${doc.file_name}"`,
        "Content-Length": doc.file_size.toString(),
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
