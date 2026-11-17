import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { addBuyerInternalNote } from "@/domains/buyer/service";
import { AddBuyerInternalNoteSchema } from "@/schemas/buyer";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ buyerId: string }> }
) {
  try {
    const { buyerId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    assertPermission(user, "buyers.review");

    const body = await req.json();
    const validated = AddBuyerInternalNoteSchema.parse(body);

    const note = await addBuyerInternalNote(buyerId, validated, user);

    return apiSuccess(
      {
        note,
        message: "Internal review note recorded successfully.",
      },
      201
    );
  } catch (error) {
    return apiError(error);
  }
}

