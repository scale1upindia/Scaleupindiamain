import { NextRequest } from "next/server";
import { ForgotPasswordSchema } from "@/schemas/auth";
import { createPasswordResetToken } from "@/domains/auth/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = ForgotPasswordSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await createPasswordResetToken(validatedInput, { ip, userAgent });

    // In a production environment with email SMTP/provider configured, the token is emailed.
    // For local development and automated verification, we expose the token only in non-production environments.
    const isDev = process.env.NODE_ENV !== "production";

    return apiSuccess({
      message: "If an account with this email exists, a password reset link has been dispatched.",
      devToken: isDev ? result.token : undefined,
    });
  } catch (error) {
    return apiError(error);
  }
}

