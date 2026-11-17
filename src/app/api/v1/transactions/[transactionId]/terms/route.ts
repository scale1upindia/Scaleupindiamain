// Scale-up India — Phase 14: Update Transaction Terms Route
// Path: src/app/api/v1/transactions/[transactionId]/terms/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { updateTransactionTerms } from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId } = await params;
    const body = await req.json();

    const result = await updateTransactionTerms(user, transactionId, body, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ transaction: result });
  } catch (error) {
    return apiError(error);
  }
}
