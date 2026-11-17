// Scale-up India — Phase 10: Get Deal Intent MOU Versions Route
// Path: src/app/api/v1/mous/[mouId]/versions/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getMOUVersions } from "@/domains/mou/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ mouId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { mouId } = await params;
    const versions = await getMOUVersions(user, mouId);

    return apiSuccess({ versions });
  } catch (error) {
    return apiError(error);
  }
}
