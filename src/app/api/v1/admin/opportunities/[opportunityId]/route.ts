import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getOpportunityForDiscovery } from "@/domains/opportunity/service";
import { query } from "@/lib/db";
import { ForbiddenError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
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
      user.permissions.includes("opportunities.read_all");

    if (!isAuthorized) {
      throw new ForbiddenError("Insufficient permissions to inspect administrative opportunity record.");
    }

    const { opportunityId } = await params;
    const opportunity = await getOpportunityForDiscovery(opportunityId, user);

    // Fetch internal staff notes
    const notesRes = await query<any>(
      `SELECT oin.*, u.first_name, u.last_name 
       FROM opportunity_internal_notes oin
       JOIN users u ON oin.author_id = u.id
       WHERE oin.opportunity_id = $1 
       ORDER BY oin.created_at DESC`,
      [opportunity.id]
    );

    const internalNotes = notesRes.rows.map((r) => ({
      id: r.id,
      opportunityId: r.opportunity_id,
      authorId: r.author_id,
      authorName: `${r.first_name} ${r.last_name}`.trim(),
      content: r.content,
      category: r.category,
      createdAt: new Date(r.created_at),
    }));

    return apiSuccess({
      opportunity,
      internalNotes,
    });
  } catch (error) {
    return apiError(error);
  }
}
