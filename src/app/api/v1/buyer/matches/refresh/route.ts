import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { refreshBuyerMatches } from "@/domains/matching/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    let mandateId: string | undefined = undefined;
    try {
      const body = await req.json();
      mandateId = body?.mandateId;
    } catch {
      // Body is optional
    }

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await refreshBuyerMatches(user, mandateId, { ip, userAgent });

    return apiSuccess({
      ...result,
      message: "Opportunity matches evaluated successfully.",
    });
  } catch (error) {
    return apiError(error);
  }
}
