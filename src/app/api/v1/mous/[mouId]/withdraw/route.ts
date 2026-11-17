// Scale-up India — Phase 10: Withdraw Deal Intent MOU Route
// Path: src/app/api/v1/mous/[mouId]/withdraw/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { withdrawMOU } from "@/domains/mou/service";
import { withdrawMOUInputSchema } from "@/schemas/mou";
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
    let validated = {};
    try {
      const body = await req.json();
      validated = withdrawMOUInputSchema.parse(body);
    } catch {
      // Body is optional
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mou = await withdrawMOU(user, mouId, validated, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(mou);
  } catch (error) {
    return apiError(error);
  }
}
