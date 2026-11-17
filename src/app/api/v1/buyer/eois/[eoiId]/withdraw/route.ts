// Scale-up India — Phase 7: Buyer Withdraw EOI API
// Path: src/app/api/v1/buyer/eois/[eoiId]/withdraw/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { withdrawEOI } from "@/domains/eoi/service";
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
    const result = await withdrawEOI(user, eoiId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
