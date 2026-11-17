import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { discoverOpportunities } from "@/domains/opportunity/service";
import { opportunityDiscoveryQuerySchema } from "@/schemas/opportunity";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;

    const { searchParams } = new URL(req.url);
    const queryParams: Record<string, string> = {};
    searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const validatedFilters = opportunityDiscoveryQuerySchema.parse(queryParams);

    const result = await discoverOpportunities(validatedFilters, user);

    return apiSuccess({
      opportunities: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: Math.min(50, Math.max(1, validatedFilters.pageSize || validatedFilters.limit || 12)),
        totalPages: result.totalPages,
      },
      appliedFilters: {
        search: validatedFilters.q || validatedFilters.search || null,
        industry: validatedFilters.industry || null,
        subSector: validatedFilters.subSector || null,
        businessCategory: validatedFilters.businessCategory || null,
        region: validatedFilters.region || null,
        transactionType: validatedFilters.transactionType || null,
        businessModel: validatedFilters.businessModel || null,
        revenueBracket: validatedFilters.revenueBracket || null,
        ebitdaBracket: validatedFilters.ebitdaBracket || null,
        askingPriceBracket: validatedFilters.askingPriceBracket || null,
      },
      sorting: {
        sort: validatedFilters.sort,
      },
      viewerTier: user ? 1 : 0,
    });
  } catch (error) {
    return apiError(error);
  }
}
