// Scale-up India — Phase 14: Verify Closing Condition Route
// Path: src/app/api/v1/transactions/[transactionId]/conditions/[conditionId]/verify/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { verifyClosingCondition } from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string; conditionId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { transactionId, conditionId } = await params;

    const condition = await verifyClosingCondition(user, transactionId, conditionId, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ condition });
  } catch (error) {
    return apiError(error);
  }
}
