import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getOrCreateSellerProfile,
  getSellerDossier,
  saveDraftProgress,
} from "@/domains/seller/service";
import { SaveDraftSchema } from "@/schemas/seller";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    // Initialize profile if first visit
    await getOrCreateSellerProfile(user);
    const dossier = await getSellerDossier(user.id, user);

    return apiSuccess({ dossier });
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
    const validated = SaveDraftSchema.parse(body);

    await saveDraftProgress(user, validated);

    return apiSuccess({ message: "Draft saved successfully." });
  } catch (error) {
    return apiError(error);
  }
}

