// Scale-up India — Phase 12: Create Due Diligence Case Route
// Path: src/app/api/v1/mous/[mouId]/diligence-cases/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { createDiligenceCase } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const diligenceCase = await createDiligenceCase(user, mouId, body, { ip, userAgent });

    return apiSuccess(diligenceCase, 201);
  } catch (error) {
    return apiError(error);
  }
}
