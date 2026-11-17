import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getBuyerDossier,
  createAcquisitionMandate,
} from "@/domains/buyer/service";
import { AcquisitionMandateSchema } from "@/schemas/buyer";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const dossier = await getBuyerDossier(user.id, user);

    return apiSuccess({ mandates: dossier.mandates });
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
    const validated = AcquisitionMandateSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mandate = await createAcquisitionMandate(user, validated, { ip, userAgent });

    return apiSuccess({ mandate, message: "Acquisition mandate created successfully." }, 201);
  } catch (error) {
    return apiError(error);
  }
}

