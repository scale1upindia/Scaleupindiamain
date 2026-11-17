// Scale-up India — Phase 14: Create Transaction Route
// Path: src/app/api/v1/valuations/[valuationId]/transactions/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createTransaction } from "@/domains/transaction/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ valuationId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { valuationId } = await params;
    const body = await req.json().catch(() => ({}));

    const result = await createTransaction(user, valuationId, body, {
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    });

    return apiSuccess({ transaction: result }, 201);
  } catch (error) {
    return apiError(error);
  }
}
