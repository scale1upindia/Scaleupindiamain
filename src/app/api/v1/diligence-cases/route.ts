// Scale-up India — Phase 12: List Due Diligence Cases Route
// Path: src/app/api/v1/diligence-cases/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listDiligenceCases } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await listDiligenceCases(user, { limit, offset });

    return apiSuccess({
      cases: result.items,
      total: result.total,
    });
  } catch (error) {
    return apiError(error);
  }
}
