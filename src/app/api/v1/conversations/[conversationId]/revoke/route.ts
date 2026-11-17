// Scale-up India — Phase 9: Revoke Deal Conversation Route
// Path: src/app/api/v1/conversations/[conversationId]/revoke/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { revokeDealConversation } from "@/domains/messaging/service";
import { revokeDealConversationSchema } from "@/schemas/messaging";
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
    const body = await req.json();
    const validated = revokeDealConversationSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await revokeDealConversation(user, conversationId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess({ success: true, message: "Deal conversation revoked successfully." });
  } catch (error) {
    return apiError(error);
  }
}
