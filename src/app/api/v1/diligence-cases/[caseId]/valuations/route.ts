// Scale-up India — Phase 13: Create / Fetch Valuation Case from Diligence Case
// Path: src/app/api/v1/diligence-cases/[caseId]/valuations/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createValuationCase } from "@/domains/valuation/service";
import { query } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const body = await req.json().catch(() => ({}));

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const valuationCase = await createValuationCase(user, caseId, body, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(valuationCase, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const res = await query<{ id: string }>(
      `SELECT id FROM valuation_cases WHERE diligence_case_id = $1 AND status NOT IN ('REJECTED')`,
      [caseId]
    );

    if (res.rows.length === 0) {
      return apiSuccess({ exists: false, valuationCaseId: null });
    }

    return apiSuccess({ exists: true, valuationCaseId: res.rows[0].id });
  } catch (error) {
    return apiError(error);
  }
}
