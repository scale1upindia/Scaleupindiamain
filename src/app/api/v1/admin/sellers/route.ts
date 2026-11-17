import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { listSellersForAdmin } from "@/domains/seller/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    // Enforce administrative permission
    assertPermission(user, "sellers.read");

    const searchParams = req.nextUrl.searchParams;
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "15", 10);

    const result = await listSellersForAdmin(user, { status, search, page, limit });

    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

