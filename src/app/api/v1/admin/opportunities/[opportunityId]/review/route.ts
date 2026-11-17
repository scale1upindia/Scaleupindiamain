import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { executeAdminOpportunityReview } from "@/domains/opportunity/service";
import { adminReviewOpportunitySchema } from "@/schemas/opportunity";
import { ForbiddenError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const isAuthorized =
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("ADMIN") ||
      user.permissions.includes("opportunities.review") ||
      user.permissions.includes("opportunities.verify") ||
      user.permissions.includes("opportunities.publish") ||
      user.permissions.includes("opportunities.suspend");

    if (!isAuthorized) {
      throw new ForbiddenError("Insufficient administrative permissions to execute opportunity review actions.");
    }

    const { opportunityId } = await params;
    const body = await req.json();
    const validated = adminReviewOpportunitySchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const opportunity = await executeAdminOpportunityReview(
      opportunityId,
      validated.action,
      validated,
      user,
      { ip, userAgent }
    );

    return apiSuccess({
      opportunity,
      message: `Opportunity successfully transitioned via [${validated.action}] action.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
