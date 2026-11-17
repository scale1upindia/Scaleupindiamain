// Scale-up India — Phase 12: Respond to Diligence Clarification Route
// Path: src/app/api/v1/diligence-cases/[caseId]/clarifications/[clarificationId]/respond/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { respondToClarification } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string; clarificationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId, clarificationId } = await params;
    const body = await req.json();

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await respondToClarification(user, caseId, clarificationId, body, { ip, userAgent });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
