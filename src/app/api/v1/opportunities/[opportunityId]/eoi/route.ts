// Scale-up India — Phase 7: Submit Expression of Interest API
// Path: src/app/api/v1/opportunities/[opportunityId]/eoi/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createEOISchema } from "@/schemas/eoi";
import { submitEOI } from "@/domains/eoi/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { opportunityId } = await params;
    const body = await req.json();
    const parsed = createEOISchema.parse(body);

    const result = await submitEOI(user, opportunityId, parsed);
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
