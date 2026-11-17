// Scale-up India — Phase 8: Seller List NDAs Route
// Path: src/app/api/v1/seller/ndas/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getSellerNDAs } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const ndas = await getSellerNDAs(user);
    return apiSuccess({ items: ndas, total: ndas.length });
  } catch (error) {
    return apiError(error);
  }
}
