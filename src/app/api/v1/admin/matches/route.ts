import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listAdminMatches } from "@/domains/matching/service";
import { MatchFilterInput, MatchClassification } from "@/types/matching";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);

    const filters: MatchFilterInput = {
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20,
      classification: (searchParams.get("classification") as MatchClassification) || undefined,
      minScore: searchParams.get("minScore") ? parseInt(searchParams.get("minScore")!, 10) : undefined,
    };

    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await listAdminMatches(user, filters, { ip, userAgent });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
