// Scale-up India — Phase 14: List Transactions Route
// Path: src/app/api/v1/transactions/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { listTransactions } from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;
    const status = searchParams.get("status") || undefined;

    const result = await listTransactions(user, { limit, offset, status });

    return apiSuccess({
      transactions: result.items,
      total: result.total,
    });
  } catch (error) {
    return apiError(error);
  }
}
