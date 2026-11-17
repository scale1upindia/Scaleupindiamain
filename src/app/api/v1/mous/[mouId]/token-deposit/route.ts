// Scale-up India — Phase 11: Get Token Deposit Status for Deal Intent MOU Route
// Path: src/app/api/v1/mous/[mouId]/token-deposit/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getTokenDepositForMOU } from "@/domains/payments/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    const tokenDeposit = await getTokenDepositForMOU(user, mouId);

    return apiSuccess({ tokenDeposit });
  } catch (error) {
    return apiError(error);
  }
}
