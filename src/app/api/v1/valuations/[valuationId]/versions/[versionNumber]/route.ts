// Scale-up India — Phase 13: Get Specific Valuation Version Route
// Path: src/app/api/v1/valuations/[valuationId]/versions/[versionNumber]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getValuationVersionDetail } from "@/domains/valuation/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ valuationId: string; versionNumber: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { valuationId, versionNumber } = await params;
    const vNum = parseInt(versionNumber, 10);
    const versionDetail = await getValuationVersionDetail(user, valuationId, vNum);

    return apiSuccess(versionDetail);
  } catch (error) {
    return apiError(error);
  }
}
