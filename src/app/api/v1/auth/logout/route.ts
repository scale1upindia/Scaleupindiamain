import { NextRequest } from "next/server";
import { getSessionToken, clearSessionCookie } from "@/lib/security/cookies";
import { logoutUser, validateSession } from "@/domains/auth/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    if (rawToken) {
      const user = await validateSession(rawToken);
      if (user) {
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
        const userAgent = req.headers.get("user-agent") || undefined;
        await logoutUser(rawToken, user.id, { ip, userAgent });
      }
    }

    await clearSessionCookie();

    return apiSuccess({
      message: "Successfully logged out.",
    });
  } catch (error) {
    return apiError(error);
  }
}

