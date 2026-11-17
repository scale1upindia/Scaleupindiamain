// Scale-up India — Phase 15: Notification Preferences API
// Path: src/app/api/v1/notifications/preferences/route.ts

import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getUserPreferences,
  updateUserPreferences,
} from "@/domains/notifications/service";
import { updatePreferencesBatchSchema } from "@/schemas/notification";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const preferences = await getUserPreferences(user.id);
    return apiSuccess({ preferences });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const body = await req.json();
    const validated = updatePreferencesBatchSchema.parse(body);

    const updated = await updateUserPreferences(user.id, validated.preferences);
    return apiSuccess({ success: true, preferences: updated });
  } catch (error) {
    return apiError(error);
  }
}
