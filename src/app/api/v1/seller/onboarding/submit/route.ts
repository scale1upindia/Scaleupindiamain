import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { submitSellerForVerification } from "@/domains/seller/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const profile = await submitSellerForVerification(user, { ip, userAgent });

    return apiSuccess({
      profile,
      message:
        "Your business dossier has been successfully submitted for Scale-up India administrative verification.",
    });
  } catch (error) {
    return apiError(error);
  }
}

