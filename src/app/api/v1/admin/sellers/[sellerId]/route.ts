import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { getSellerDossier } from "@/domains/seller/service";
import { query } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    const { sellerId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    assertPermission(user, "sellers.read");

    // Look up the seller profile to find user_id
    const res = await query<any>(
      `SELECT user_id FROM seller_profiles WHERE id = $1 AND deleted_at IS NULL`,
      [sellerId]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError("Seller dossier not found.");
    }

    const sellerUserId = res.rows[0].user_id;
    const dossier = await getSellerDossier(sellerUserId, user);

    return apiSuccess({ dossier });
  } catch (error) {
    return apiError(error);
  }
}

