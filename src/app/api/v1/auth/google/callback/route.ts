import { NextRequest, NextResponse } from "next/server";
import {
  verifyAndDecodeOAuthState,
  getGoogleRedirectUri,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  processGoogleIdentity,
} from "@/domains/auth/google";
import {
  OAUTH_STATE_COOKIE_NAME,
  setSessionCookieOnResponse,
  clearOAuthCookieOnResponse,
} from "@/lib/security/cookies";

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const loginUrl = new URL("/login", req.url);

  // 1. Check for errors returned by Google provider
  const googleError = searchParams.get("error");
  if (googleError) {
    loginUrl.searchParams.set(
      "error",
      googleError === "access_denied" ? "access_denied" : `oauth_${googleError}`
    );
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }

  // 2. Validate presence of code and state
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    loginUrl.searchParams.set("error", "missing_oauth_parameters");
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }

  // 3. Retrieve and verify state cookie
  const stateCookie = req.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!stateCookie) {
    loginUrl.searchParams.set("error", "invalid_oauth_state");
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }

  let stateData;
  try {
    stateData = verifyAndDecodeOAuthState(stateCookie);
  } catch {
    loginUrl.searchParams.set("error", "invalid_oauth_state");
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }

  // 4. Verify state matches (prevent CSRF)
  if (stateData.state !== state) {
    loginUrl.searchParams.set("error", "csrf_state_mismatch");
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }

  try {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || undefined;
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const baseUrl = host ? `${proto}://${host}` : undefined;
    const redirectUri = getGoogleRedirectUri(baseUrl);

    // 5. Exchange code for Google access token
    const tokenResult = await exchangeGoogleCode(code, redirectUri);

    // 6. Fetch authenticated user profile
    const userInfo = await fetchGoogleUserInfo(tokenResult.access_token);

    // 7. Context information
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || undefined;

    // 8. Process identity: account linking, user creation, or login
    const result = await processGoogleIdentity(userInfo, {
      storedRoles: stateData.roles,
      storedRedirect: stateData.redirectPath,
      context: { ip, userAgent },
    });

    // 9. Redirect to authenticated destination
    const destinationUrl = new URL(result.redirectPath, req.url);
    const response = NextResponse.redirect(destinationUrl);

    // 10. Attach session cookie and clear temporary OAuth state cookie
    setSessionCookieOnResponse(response, result.sessionToken);
    clearOAuthCookieOnResponse(response);

    return response;
  } catch (err: any) {
    let errorCode = "oauth_failed";
    if (err?.message?.includes("unverified")) {
      errorCode = "unverified_email";
    } else if (err?.message?.includes("suspended")) {
      errorCode = "account_suspended";
    }

    loginUrl.searchParams.set("error", errorCode);
    const errorResponse = NextResponse.redirect(loginUrl);
    clearOAuthCookieOnResponse(errorResponse);
    return errorResponse;
  }
}
