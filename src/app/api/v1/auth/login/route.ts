import { NextRequest } from "next/server";
import { LoginSchema } from "@/schemas/auth";
import { loginUser } from "@/domains/auth/service";
import { setSessionCookie } from "@/lib/security/cookies";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = LoginSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const result = await loginUser(validatedInput, { ip, userAgent });

    // Set secure HTTP-only session cookie
    await setSessionCookie(result.sessionToken);

    return apiSuccess({
      user: result.user,
      message: "Login successful.",
    });
  } catch (error) {
    return apiError(error);
  }
}

