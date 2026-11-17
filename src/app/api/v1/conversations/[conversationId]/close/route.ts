// Scale-up India — Phase 9: Close Deal Conversation Route
// Path: src/app/api/v1/conversations/[conversationId]/close/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { closeDealConversation } from "@/domains/messaging/service";
import { closeDealConversationSchema } from "@/schemas/messaging";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { conversationId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }
    const validated = closeDealConversationSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await closeDealConversation(user, conversationId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
