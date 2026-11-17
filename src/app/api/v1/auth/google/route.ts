import { NextRequest, NextResponse } from "next/server";
import {
  getGoogleOAuthConfig,
  buildGoogleAuthUrl,
} from "@/domains/auth/google";
import { setOAuthCookieOnResponse } from "@/lib/security/cookies";

export async function GET(req: NextRequest) {
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
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "google_auth_not_configured");
      return NextResponse.redirect(loginUrl);
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || undefined;
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = host ? `${proto}://${host}` : undefined;

    const { authUrl, stateToken } = buildGoogleAuthUrl({
      baseUrl,
      redirectPath,
      roles,
    });

    const response = NextResponse.redirect(authUrl);
    setOAuthCookieOnResponse(response, stateToken);

    return response;
  } catch (error: any) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", encodeURIComponent(error?.message || "oauth_initiation_failed"));
    return NextResponse.redirect(loginUrl);
  }
}
