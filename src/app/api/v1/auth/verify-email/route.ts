import { NextRequest } from "next/server";
import { VerifyEmailSchema } from "@/schemas/auth";
import { verifyEmail } from "@/domains/auth/service";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedInput = VerifyEmailSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await verifyEmail(validatedInput, { ip, userAgent });

    return apiSuccess({
      message: "Email address has been successfully verified.",
    });
  } catch (error) {
    return apiError(error);
  }
}

