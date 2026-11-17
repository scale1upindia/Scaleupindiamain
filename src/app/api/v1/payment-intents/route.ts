// Scale-up India — Phase 11: List Payment Intents Route
// Path: src/app/api/v1/payment-intents/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listPaymentIntents } from "@/domains/payments/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const mouId = searchParams.get("mouId") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await listPaymentIntents(user, { mouId, limit, offset });

    return apiSuccess({
      paymentIntents: result.items,
      total: result.total,
    });
  } catch (error) {
    return apiError(error);
  }
}
