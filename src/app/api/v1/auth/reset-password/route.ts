import { NextRequest } from "next/server";
import { ResetPasswordSchema } from "@/schemas/auth";
import { resetPassword } from "@/domains/auth/service";
import { clearSessionCookie } from "@/lib/security/cookies";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = ResetPasswordSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await resetPassword(validatedInput, { ip, userAgent });

    // Ensure client-side session cookie is purged since sessions were invalidated
    await clearSessionCookie();

    return apiSuccess({
      message: "Password has been successfully updated. Please log in with your new password.",
    });
  } catch (error) {
    return apiError(error);
  }
}

