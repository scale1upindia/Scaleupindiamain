// Scale-up India — Phase 10: List User Deal Intent MOUs Route
// Path: src/app/api/v1/mous/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getMOUsForUser } from "@/domains/mou/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role") as "BUYER" | "SELLER" | null;
    const role = roleParam === "BUYER" || roleParam === "SELLER" ? roleParam : undefined;

    const mous = await getMOUsForUser(user, role);

    return apiSuccess({ mous });
  } catch (error) {
    return apiError(error);
  }
}
