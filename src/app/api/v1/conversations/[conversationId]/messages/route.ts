// Scale-up India — Phase 9: Deal Messages List & Send Route
// Path: src/app/api/v1/conversations/[conversationId]/messages/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getPaginatedMessages,
  sendDealMessage,
} from "@/domains/messaging/service";
import {
  createDealMessageSchema,
  getMessagesQuerySchema,
} from "@/schemas/messaging";
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
    const { searchParams } = new URL(req.url);

    const queryParams = getMessagesQuerySchema.parse({
      cursor: searchParams.get("cursor") || undefined,
      limit: searchParams.get("limit") || undefined,
    });

    const result = await getPaginatedMessages(user, conversationId, queryParams);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

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
    const validated = createDealMessageSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const message = await sendDealMessage(user, conversationId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(message, 201);
  } catch (error) {
    return apiError(error);
  }
}
