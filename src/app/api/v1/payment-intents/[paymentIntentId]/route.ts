// Scale-up India — Phase 11: Get Payment Intent Detail Route
// Path: src/app/api/v1/payment-intents/[paymentIntentId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getPaymentIntentById } from "@/domains/payments/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentIntentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { paymentIntentId } = await params;
    const paymentIntent = await getPaymentIntentById(user, paymentIntentId);

    return apiSuccess({ paymentIntent });
  } catch (error) {
    return apiError(error);
  }
}
