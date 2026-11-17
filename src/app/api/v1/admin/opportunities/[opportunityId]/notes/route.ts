import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { addOpportunityInternalNote } from "@/domains/opportunity/service";
import { ForbiddenError, ValidationError } from "@/lib/errors";
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
      user.permissions.includes("opportunities.review");

    if (!isAuthorized) {
      throw new ForbiddenError("Insufficient permissions to log internal opportunity remarks.");
    }

    const { opportunityId } = await params;
    const body = await req.json();

    if (!body.content || typeof body.content !== "string" || body.content.trim().length === 0) {
      throw new ValidationError("Note content is required.");
    }

    const note = await addOpportunityInternalNote(
      opportunityId,
      {
        content: body.content.trim(),
        category: body.category || "CURATION",
      },
      user
    );

    return apiSuccess({ note, message: "Internal note logged successfully." }, 201);
  } catch (error) {
    return apiError(error);
  }
}
