// Scale-up India — Phase 13: Add Valuation Comparable Peer Route
// Path: src/app/api/v1/valuations/[valuationId]/comparables/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { addValuationComparable } from "@/domains/valuation/service";
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
    const body = await req.json();

    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || undefined;
    const userAgent = req.headers.get("user-agent") || undefined;

    const versionDetail = await addValuationComparable(user, valuationId, body, {
      ip: clientIp,
      userAgent,
    });

    return apiSuccess(versionDetail, 201);
  } catch (error) {
    return apiError(error);
  }
}
