// Scale-up India — Phase 10: Get Deal Intent MOU Detail Route
// Path: src/app/api/v1/mous/[mouId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getMOUById } from "@/domains/mou/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    const mou = await getMOUById(user, mouId);

    return apiSuccess(mou);
  } catch (error) {
    return apiError(error);
  }
}
