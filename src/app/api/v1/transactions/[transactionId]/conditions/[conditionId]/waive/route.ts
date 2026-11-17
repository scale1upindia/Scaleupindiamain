// Scale-up India — Phase 14: Waive Closing Condition Route
// Path: src/app/api/v1/transactions/[transactionId]/conditions/[conditionId]/waive/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { waiveClosingCondition } from "@/domains/transaction/service";
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
    const body = await req.json();

    const condition = await waiveClosingCondition(user, transactionId, conditionId, body, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ condition });
  } catch (error) {
    return apiError(error);
  }
}
