// Scale-up India — Phase 12: Diligence Finding Resource Route
// Path: src/app/api/v1/diligence-cases/[caseId]/findings/[findingId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getFindingById, updateFinding } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; findingId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId, findingId } = await params;
    const finding = await getFindingById(user, caseId, findingId);

    return apiSuccess(finding);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; findingId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId, findingId } = await params;
    const body = await req.json();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const finding = await updateFinding(user, caseId, findingId, body, { ip, userAgent });

    return apiSuccess(finding);
  } catch (error) {
    return apiError(error);
  }
}
