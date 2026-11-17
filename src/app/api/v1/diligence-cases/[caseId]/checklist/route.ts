// Scale-up India — Phase 12: Get Diligence Checklist Items Route
// Path: src/app/api/v1/diligence-cases/[caseId]/checklist/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getChecklistItems } from "@/domains/diligence/service";
import { apiSuccess, apiError } from "@/lib/api/response";
import { DiligenceCategory, ChecklistItemStatus } from "@/types/diligence";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { caseId } = await params;
    const { searchParams } = new URL(req.url);
    const category = (searchParams.get("category") as DiligenceCategory) || undefined;
    const status = (searchParams.get("status") as ChecklistItemStatus) || undefined;

    const items = await getChecklistItems(user, caseId, { category, status });

    return apiSuccess({ items, total: items.length });
  } catch (error) {
    return apiError(error);
  }
}
