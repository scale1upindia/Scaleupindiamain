// Scale-up India — Phase 8: Seller Get NDA Detail Route
// Path: src/app/api/v1/seller/ndas/[ndaId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getSellerNDAById } from "@/domains/dataroom/service";
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
    const nda = await getSellerNDAById(user, ndaId);
    return apiSuccess(nda);
  } catch (error) {
    return apiError(error);
  }
}
