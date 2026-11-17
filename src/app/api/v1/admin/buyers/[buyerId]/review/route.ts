import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { executeAdminBuyerReviewAction } from "@/domains/buyer/service";
import { AdminBuyerReviewActionSchema } from "@/schemas/buyer";
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

    const body = await req.json();
    const validated = AdminBuyerReviewActionSchema.parse(body);

    // Permission enforcement based on administrative action
    if (validated.action === "VERIFY" || validated.action === "REJECT") {
      assertPermission(user, "buyers.verify");
    } else if (validated.action === "SUSPEND") {
      assertPermission(user, "buyers.suspend");
    } else {
      assertPermission(user, "buyers.review");
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const updatedProfile = await executeAdminBuyerReviewAction(
      buyerId,
      validated.action,
      {
        notes: validated.notes,
        rejectionReason: validated.rejectionReason,
        changesRequestedNotes: validated.changesRequestedNotes,
        suspensionReason: validated.suspensionReason,
      },
      user,
      { ip, userAgent }
    );

    return apiSuccess({
      profile: updatedProfile,
      message: `Buyer review action [${validated.action}] executed successfully.`,
    });
  } catch (error) {
    return apiError(error);
  }
}

