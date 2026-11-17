// Scale-up India — Phase 14: List Closing Conditions Route
// Path: src/app/api/v1/transactions/[transactionId]/conditions/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listTransactionConditions } from "@/domains/transaction/service";
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
    const conditions = await listTransactionConditions(user, transactionId);

    return apiSuccess({ conditions });
  } catch (error) {
    return apiError(error);
  }
}
