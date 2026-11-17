// Scale-up India — Phase 8: Seller Decline NDA Route
// Path: src/app/api/v1/seller/ndas/[ndaId]/decline/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { declineNDASchema } from "@/schemas/nda";
import { declineNDA } from "@/domains/dataroom/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ ndaId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { ndaId } = await params;
    const body = await req.json();
    const parsed = declineNDASchema.parse(body);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await declineNDA(user, ndaId, parsed, { ip, userAgent });
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
