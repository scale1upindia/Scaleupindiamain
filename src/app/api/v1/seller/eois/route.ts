// Scale-up India — Phase 7: Seller EOI Listing API
// Path: src/app/api/v1/seller/eois/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { eoiQuerySchema } from "@/schemas/eoi";
import { getSellerEOIs } from "@/domains/eoi/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const query = eoiQuerySchema.parse({
      status: searchParams.get("status") || undefined,
      opportunityId: searchParams.get("opportunityId") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 20,
    });

    const result = await getSellerEOIs(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
