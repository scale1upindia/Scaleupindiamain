// Scale-up India — Phase 7: Seller EOI Detail API
// Path: src/app/api/v1/seller/eois/[eoiId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getSellerEOIById } from "@/domains/eoi/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eoiId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { eoiId } = await params;
    const result = await getSellerEOIById(user, eoiId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
