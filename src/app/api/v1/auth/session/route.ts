import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    if (!rawToken) {
      return apiSuccess({ user: null, isAuthenticated: false });
    }

    const user = await validateSession(rawToken);
    if (!user) {
      return apiSuccess({ user: null, isAuthenticated: false });
    }

    return apiSuccess({
      user,
      isAuthenticated: true,
    });
  } catch (error) {
    return apiError(error);
  }
}

