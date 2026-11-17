// Scale-up India — Phase 8: Initiate Bilateral NDA Route
// Path: src/app/api/v1/opportunities/[opportunityId]/nda/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createNDASchema } from "@/schemas/nda";
import { initiateNDA } from "@/domains/dataroom/service";
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
    const parsed = createNDASchema.parse(body);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await initiateNDA(user, opportunityId, parsed, { ip, userAgent });
    return apiSuccess(result, 201);
  } catch (error) {
    return apiError(error);
  }
}
