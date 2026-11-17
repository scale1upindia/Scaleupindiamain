// Scale-up India — Phase 9: Get Deal Conversation Route
// Path: src/app/api/v1/conversations/[conversationId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getDealConversationById } from "@/domains/messaging/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { conversationId } = await params;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const conversation = await getDealConversationById(user, conversationId, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(conversation);
  } catch (error) {
    return apiError(error);
  }
}
