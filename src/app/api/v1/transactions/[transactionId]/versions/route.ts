// Scale-up India — Phase 14: Transaction Versions Route
// Path: src/app/api/v1/transactions/[transactionId]/versions/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { assertTransactionMember, createTransactionVersion } from "@/domains/transaction/service";
import { query } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId } = await params;
    await assertTransactionMember(user, transactionId);

    const res = await query(
      `SELECT * FROM transaction_versions WHERE transaction_id = $1 ORDER BY version_number ASC`,
      [transactionId]
    );

    return apiSuccess({ versions: res.rows });
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
    const body = await req.json().catch(() => ({}));

    const result = await createTransactionVersion(user, transactionId, body, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ transaction: result }, 201);
  } catch (error) {
    return apiError(error);
  }
}
