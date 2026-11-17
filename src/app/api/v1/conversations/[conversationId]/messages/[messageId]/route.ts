// Scale-up India — Phase 9: Soft Delete Deal Message Route
// Path: src/app/api/v1/conversations/[conversationId]/messages/[messageId]/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { softDeleteDealMessage } from "@/domains/messaging/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string; messageId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { conversationId, messageId } = await params;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await softDeleteDealMessage(user, conversationId, messageId, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess({ success: true, message: "Message soft deleted successfully." });
  } catch (error) {
    return apiError(error);
  }
}
