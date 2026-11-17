import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { getOpportunityForDiscovery } from "@/domains/opportunity/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;

    const { opportunityId } = await params;

    const opportunity = await getOpportunityForDiscovery(opportunityId, user);

    return apiSuccess({
      opportunity,
      viewerTier: opportunity.tier,
    });
  } catch (error) {
    return apiError(error);
  }
}
