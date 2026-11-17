// Scale-up India — Phase 10: Create / Propose Deal Intent MOU Route
// Path: src/app/api/v1/opportunities/[opportunityId]/mous/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createMOU } from "@/domains/mou/service";
import { createMOUInputSchema } from "@/schemas/mou";
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
    const validated = createMOUInputSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mou = await createMOU(user, opportunityId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(mou, 201);
  } catch (error) {
    return apiError(error);
  }
}
