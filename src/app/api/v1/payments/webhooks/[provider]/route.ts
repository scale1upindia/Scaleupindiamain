// Scale-up India — Phase 11: Payment Provider Webhook Receiver Route
// Path: src/app/api/v1/payments/webhooks/[provider]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { processProviderWebhook } from "@/domains/payments/service";
import { apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const rawPayload = await req.text();

    // Extract signature from possible provider headers
    const signature =
      req.headers.get("x-razorpay-signature") ||
      req.headers.get("x-signature") ||
      req.headers.get("stripe-signature") ||
      "";

    // Collect headers into dictionary for provider adapters
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await processProviderWebhook(
      provider,
      rawPayload,
      signature,
      headers,
      { ip: clientIp, userAgent }
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return apiError(error);
  }
}
