// Scale-up India — Phase 10: Formally Propose Draft MOU Route
// Path: src/app/api/v1/mous/[mouId]/propose/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { proposeMOUDraft } from "@/domains/mou/service";
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
    let validityDays = 14;
    try {
      const body = await req.json();
      if (body.validityDays && typeof body.validityDays === "number") {
        validityDays = body.validityDays;
      }
    } catch {
      // Body is optional
    }

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mou = await proposeMOUDraft(user, mouId, validityDays, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(mou);
  } catch (error) {
    return apiError(error);
  }
}
