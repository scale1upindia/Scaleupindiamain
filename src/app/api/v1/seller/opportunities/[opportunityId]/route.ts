import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getSellerOpportunityById,
  updateOpportunity,
} from "@/domains/opportunity/service";
import { updateOpportunitySchema } from "@/schemas/opportunity";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { opportunityId } = await params;
    const opportunity = await getSellerOpportunityById(opportunityId, user);

    return apiSuccess({ opportunity });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ opportunityId: string }> }
) {
  try {
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const { opportunityId } = await params;
    const body = await req.json();
    const validated = updateOpportunitySchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const opportunity = await updateOpportunity(opportunityId, user, validated, { ip, userAgent });

    return apiSuccess({ opportunity, message: "Opportunity updated successfully." });
  } catch (error) {
    return apiError(error);
  }
}
