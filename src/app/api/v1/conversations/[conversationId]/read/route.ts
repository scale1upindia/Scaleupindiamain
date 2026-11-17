// Scale-up India — Phase 9: Mark Conversation Read Route
// Path: src/app/api/v1/conversations/[conversationId]/read/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { markConversationRead } from "@/domains/messaging/service";
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
    let upToMessageId: string | undefined = undefined;

    try {
      const body = await req.json();
      if (body && typeof body.upToMessageId === "string") {
        upToMessageId = body.upToMessageId;
      }
    } catch {
      // Empty body is allowed, marks up to latest
    }

    const result = await markConversationRead(user, conversationId, upToMessageId);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
