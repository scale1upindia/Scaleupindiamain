// Scale-up India — Phase 8: Buyer Get NDA Detail Route
// Path: src/app/api/v1/buyer/ndas/[ndaId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getBuyerNDAById } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ndaId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { ndaId } = await params;
    const nda = await getBuyerNDAById(user, ndaId);
    return apiSuccess(nda);
  } catch (error) {
    return apiError(error);
  }
}
