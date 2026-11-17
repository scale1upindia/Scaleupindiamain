// Scale-up India — Phase 13: Get Valuation Case Overview Route
// Path: src/app/api/v1/valuations/[valuationId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getValuationCaseById } from "@/domains/valuation/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ valuationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { valuationId } = await params;
    const valuationCase = await getValuationCaseById(user, valuationId);

    return apiSuccess(valuationCase);
  } catch (error) {
    return apiError(error);
  }
}
