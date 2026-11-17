import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { getBuyerDossier } from "@/domains/buyer/service";
import { query } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ buyerId: string }> }
) {
  try {
    const { buyerId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    assertPermission(user, "buyers.read");

    const res = await query<any>(
      `SELECT user_id FROM buyer_profiles WHERE id = $1 AND deleted_at IS NULL`,
      [buyerId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError("Buyer profile dossier not found.");
    }

    const buyerUserId = res.rows[0].user_id;
    const dossier = await getBuyerDossier(buyerUserId, user);

    return apiSuccess({ dossier });
  } catch (error) {
    return apiError(error);
  }
}

