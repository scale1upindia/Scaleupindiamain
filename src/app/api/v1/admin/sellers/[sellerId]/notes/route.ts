import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { addSellerInternalNote } from "@/domains/seller/service";
import { AddInternalNoteSchema } from "@/schemas/seller";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sellerId: string }> }
) {
  try {
    const { sellerId } = await params;
    const rawToken = await getSessionToken();
    const user = rawToken ? await validateSession(rawToken) : null;
    assertAuthenticated(user);

    assertPermission(user, "sellers.review");

    const body = await req.json();
    const validated = AddInternalNoteSchema.parse(body);

    const note = await addSellerInternalNote(sellerId, validated, user);

    return apiSuccess({
      note,
      message: "Internal review note added successfully.",
    }, 201);
  } catch (error) {
    return apiError(error);
  }
}

