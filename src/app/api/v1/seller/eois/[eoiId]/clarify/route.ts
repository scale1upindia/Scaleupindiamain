// Scale-up India — Phase 7: Seller Request Clarification API
// Path: src/app/api/v1/seller/eois/[eoiId]/clarify/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { sellerClarifyEOISchema } from "@/schemas/eoi";
import { requestClarification } from "@/domains/eoi/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eoiId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { eoiId } = await params;
    const body = await req.json();
    const parsed = sellerClarifyEOISchema.parse(body);

    const result = await requestClarification(user, eoiId, parsed);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
