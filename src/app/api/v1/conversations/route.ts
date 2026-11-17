// Scale-up India — Phase 9: List Deal Conversations Route
// Path: src/app/api/v1/conversations/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getDealConversationsForUser } from "@/domains/messaging/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const conversations = await getDealConversationsForUser(user);
    return apiSuccess({ items: conversations, total: conversations.length });
  } catch (error) {
    return apiError(error);
  }
}
