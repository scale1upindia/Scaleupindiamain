// Scale-up India — Phase 11: Cancel Payment Intent Route
// Path: src/app/api/v1/payment-intents/[paymentIntentId]/cancel/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { cancelPaymentIntent } from "@/domains/payments/service";
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
    const body = await req.json();

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const paymentIntent = await cancelPaymentIntent(user, paymentIntentId, body, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess({ paymentIntent });
  } catch (error) {
    return apiError(error);
  }
}
