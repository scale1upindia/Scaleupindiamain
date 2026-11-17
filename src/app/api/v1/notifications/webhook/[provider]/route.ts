// Scale-up India — Phase 15: Provider Inbound Email Webhook API
// Path: src/app/api/v1/notifications/webhook/[provider]/route.ts

import { NextRequest } from "next/server";
import { processEmailWebhook } from "@/domains/notifications/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const rawPayload = await req.text();

    const signature =
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-signature") ||
      req.headers.get("signature") ||
      "";

    const timestamp =
      req.headers.get("x-webhook-timestamp") ||
      req.headers.get("x-timestamp") ||
      req.headers.get("timestamp") ||
      undefined;

    const headers: Record<string, string> = {};
    if (timestamp) headers["timestamp"] = timestamp;

    const result = await processEmailWebhook(provider, rawPayload, signature, headers);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
