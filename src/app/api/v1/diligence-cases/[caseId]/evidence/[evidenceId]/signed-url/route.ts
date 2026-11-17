// Scale-up India — Phase 12: Generate Signed Diligence Evidence URL Route
// Path: src/app/api/v1/diligence-cases/[caseId]/evidence/[evidenceId]/signed-url/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { generateSignedEvidenceUrl } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId, evidenceId } = await params;
    let versionNumber: number | undefined;

    try {
      const body = await req.json();
      if (body.versionNumber) {
        versionNumber = parseInt(body.versionNumber, 10);
      }
    } catch {
      // Body is optional
    }

    const result = await generateSignedEvidenceUrl(user, caseId, evidenceId, versionNumber);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
