import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import { getBuyerDossier, saveBuyerDraft } from "@/domains/buyer/service";
import { BuyerDraftAutosaveSchema } from "@/schemas/buyer";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const dossier = await getBuyerDossier(user.id, user);

    return apiSuccess({
      draftPayload: dossier.draftPayload,
      lastActiveStep: dossier.lastActiveStep,
      sectionsCompleted: dossier.sectionsCompleted,
    });
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
    const validated = BuyerDraftAutosaveSchema.parse(body);

    await saveBuyerDraft(user, validated);

    return apiSuccess({ message: "Draft progress autosaved successfully." });
  } catch (error) {
    return apiError(error);
  }
}

