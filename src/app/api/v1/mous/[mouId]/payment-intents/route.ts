// Scale-up India — Phase 11: Create Payment Intent for Accepted MOU Route
// Path: src/app/api/v1/mous/[mouId]/payment-intents/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createPaymentIntent } from "@/domains/payments/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // Support Idempotency-Key HTTP header
    const idempotencyHeader = req.headers.get("idempotency-key");
    if (idempotencyHeader && !body.idempotencyKey) {
      body.idempotencyKey = idempotencyHeader;
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;
    const providerName = req.headers.get("x-payment-provider") || body.providerName;

    const paymentIntent = await createPaymentIntent(user, mouId, body, {
      ip: clientIp,
      userAgent,
      providerName,
    });

    return apiSuccess({ paymentIntent }, 201);
  } catch (error) {
    return apiError(error);
  }
}
