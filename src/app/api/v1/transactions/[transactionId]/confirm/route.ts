// Scale-up India — Phase 14: Confirm Transaction Terms Route
// Path: src/app/api/v1/transactions/[transactionId]/confirm/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { confirmTransactionTerms } from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";

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

    const result = await confirmTransactionTerms(user, transactionId, body, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ transaction: result });
  } catch (error) {
    return apiError(error);
  }
}
