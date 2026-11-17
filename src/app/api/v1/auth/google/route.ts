import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  buildGoogleAuthUrl,
  getPublicBaseUrl,
} from "@/domains/auth/google";
import { setOAuthCookieOnResponse } from "@/lib/security/cookies";

export async function GET(req: NextRequest) {
  const baseUrl = getPublicBaseUrl(req);
  const loginUrl = new URL("/login", baseUrl);

  try {
    const config = getGoogleOAuthConfig();
    const searchParams = req.nextUrl.searchParams;

    // Sanitize redirect target to prevent open redirect vulnerabilities
    const rawRedirect = searchParams.get("redirect") || "/dashboard";
    const redirectPath =
      rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
        ? rawRedirect
        : "/dashboard";

    const rolesParam = searchParams.get("roles");
    const roles = rolesParam ? rolesParam.split(",").map((r) => r.trim()) : undefined;

    // Check if Google OAuth credentials are configured
    if (!config.isConfigured) {
      loginUrl.searchParams.set("error", "google_auth_not_configured");
      return NextResponse.redirect(loginUrl);
    }

    const { authUrl, stateToken } = buildGoogleAuthUrl({
      baseUrl,
      redirectPath,
      roles,
    });

    const response = NextResponse.redirect(authUrl);
    setOAuthCookieOnResponse(response, stateToken);

    return response;
  } catch (error: any) {
    loginUrl.searchParams.set("error", encodeURIComponent(error?.message || "oauth_initiation_failed"));
    return NextResponse.redirect(loginUrl);
  }
}
