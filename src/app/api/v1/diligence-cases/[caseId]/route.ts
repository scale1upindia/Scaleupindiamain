// Scale-up India — Phase 12: Get Due Diligence Case Overview Route
// Path: src/app/api/v1/diligence-cases/[caseId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getDiligenceCaseById } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const diligenceCase = await getDiligenceCaseById(user, caseId);

    return apiSuccess(diligenceCase);
  } catch (error) {
    return apiError(error);
  }
}
