// Scale-up India — Phase 12: Get Diligence Evidence Detail Route
// Path: src/app/api/v1/diligence-cases/[caseId]/evidence/[evidenceId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getEvidenceDetailById } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId, evidenceId } = await params;
    const evidence = await getEvidenceDetailById(user, caseId, evidenceId);

    return apiSuccess(evidence);
  } catch (error) {
    return apiError(error);
  }
}
