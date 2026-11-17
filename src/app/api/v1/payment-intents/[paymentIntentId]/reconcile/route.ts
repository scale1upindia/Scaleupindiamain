// Scale-up India — Phase 11: Reconcile Payment Intent Route
// Path: src/app/api/v1/payment-intents/[paymentIntentId]/reconcile/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { reconcilePaymentIntent } from "@/domains/payments/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ paymentIntentId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { paymentIntentId } = await params;
    const reconciliation = await reconcilePaymentIntent(user, paymentIntentId);

    return apiSuccess({ reconciliation });
  } catch (error) {
    return apiError(error);
  }
}
