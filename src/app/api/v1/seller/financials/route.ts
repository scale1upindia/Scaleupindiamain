import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getSellerDossier,
  saveBusinessFinancials,
} from "@/domains/seller/service";
import { BulkFinancialsSchema } from "@/schemas/seller";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const dossier = await getSellerDossier(user.id, user);
    return apiSuccess({ financials: dossier.financials });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const body = await req.json();
    const validated = BulkFinancialsSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const financials = await saveBusinessFinancials(user, validated.financials, {
      ip,
      userAgent,
    });

    return apiSuccess({
      financials,
      message: "Financial profiles saved successfully.",
    });
  } catch (error) {
    return apiError(error);
  }
}

