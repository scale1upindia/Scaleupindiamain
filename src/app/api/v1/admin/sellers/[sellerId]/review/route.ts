import { NextRequest } from "next/server";
import { getSessionToken } from "@/lib/security/cookies";
import { validateSession } from "@/domains/auth/service";
import { assertAuthenticated, assertPermission } from "@/lib/security/authorization";
import { executeAdminReviewAction } from "@/domains/seller/service";
import { AdminReviewActionSchema } from "@/schemas/seller";
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

    const body = await req.json();
    const validated = AdminReviewActionSchema.parse(body);

    // Permission checks based on action
    if (validated.action === "VERIFY" || validated.action === "REJECT") {
      assertPermission(user, "sellers.verify");
    } else {
      assertPermission(user, "sellers.review");
    }

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    const updatedProfile = await executeAdminReviewAction(
      sellerId,
      validated.action,
      {
        notes: validated.notes,
        rejectionReason: validated.rejectionReason,
        changesRequestedNotes: validated.changesRequestedNotes,
      },
      user,
      { ip, userAgent }
    );

    return apiSuccess({
      profile: updatedProfile,
      message: `Action [${validated.action}] executed successfully.`,
    });
  } catch (error) {
    return apiError(error);
  }
}

