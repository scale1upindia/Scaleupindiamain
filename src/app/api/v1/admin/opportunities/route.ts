import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listOpportunitiesForAdmin } from "@/domains/opportunity/service";
import { ForbiddenError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    // Permission guard
    const isAuthorized =
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("ADMIN") ||
      user.permissions.includes("opportunities.review") ||
      user.permissions.includes("opportunities.read_all");

    if (!isAuthorized) {
      throw new ForbiddenError("Insufficient permissions to access administrative opportunity queue.");
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 15;

    const result = await listOpportunitiesForAdmin(user, { status, search, page, limit });

    return apiSuccess({
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (error) {
    return apiError(error);
  }
}
