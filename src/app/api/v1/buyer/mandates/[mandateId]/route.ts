import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated } from "@/lib/security/authorization";
import {
  getBuyerDossier,
  updateAcquisitionMandate,
  deleteAcquisitionMandate,
} from "@/domains/buyer/service";
import { AcquisitionMandateSchema } from "@/schemas/buyer";
import { NotFoundError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ mandateId: string }> }
) {
  try {
    const { mandateId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const dossier = await getBuyerDossier(user.id, user);
    const mandate = dossier.mandates.find((m) => m.id === mandateId);

    if (!mandate) {
      throw new NotFoundError("Acquisition mandate not found.");
    }

    return apiSuccess({ mandate });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ mandateId: string }> }
) {
  try {
    const { mandateId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const body = await req.json();
    const validated = AcquisitionMandateSchema.parse(body);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const mandate = await updateAcquisitionMandate(mandateId, user, validated, { ip, userAgent });

    return apiSuccess({ mandate, message: "Acquisition mandate updated successfully." });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ mandateId: string }> }
) {
  try {
    const { mandateId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    await deleteAcquisitionMandate(mandateId, user, { ip, userAgent });

    return apiSuccess({ message: "Acquisition mandate archived successfully." });
  } catch (error) {
    return apiError(error);
  }
}

