// Scale-up India — Phase 10: Bilaterally Accept Deal Intent MOU Route
// Path: src/app/api/v1/mous/[mouId]/accept/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { acceptMOU } from "@/domains/mou/service";
import { acceptMOUInputSchema } from "@/schemas/mou";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    const body = await req.json();
    const validated = acceptMOUInputSchema.parse(body);

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mou = await acceptMOU(user, mouId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(mou);
  } catch (error) {
    return apiError(error);
  }
}
