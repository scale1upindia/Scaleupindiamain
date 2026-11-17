// Scale-up India — Phase 9: Initiate Deal Conversation Route
// Path: src/app/api/v1/opportunities/[opportunityId]/conversations/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { initiateDealConversation } from "@/domains/messaging/service";
import { initiateDealConversationSchema } from "@/schemas/messaging";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { opportunityId } = await params;
    const body = await req.json();
    const validated = initiateDealConversationSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const conversation = await initiateDealConversation(
      user,
      opportunityId,
      validated,
      { ip: clientIp, userAgent }
    );

    return apiSuccess(conversation, 201);
  } catch (error) {
    return apiError(error);
  }
}
