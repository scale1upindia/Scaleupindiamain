import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listBuyerMatches } from "@/domains/matching/service";
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
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10,
      classification: (searchParams.get("classification") as MatchClassification) || undefined,
      mandateId: searchParams.get("mandateId") || undefined,
      minScore: searchParams.get("minScore") ? parseInt(searchParams.get("minScore")!, 10) : undefined,
      isEligibleOnly: searchParams.get("isEligibleOnly") !== "false",
      industry: searchParams.get("industry") || undefined,
      sortBy: (searchParams.get("sortBy") as "score" | "createdAt") || "score",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
    };

    const result = await listBuyerMatches(user, filters);

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
