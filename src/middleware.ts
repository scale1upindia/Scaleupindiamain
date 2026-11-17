// Scale-up India — Phase 16: Enterprise Security Middleware
// Path: src/middleware.ts

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/security/cookies";
import { SECURITY_CONFIG } from "@/lib/security/config";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME);

  // 1. Protected Route Authentication Gate
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/deals") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/buyer") ||
    pathname.startsWith("/seller") ||
    pathname.startsWith("/notifications");

  if (isProtectedRoute && !sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const redirectResponse = NextResponse.redirect(loginUrl);
    applySecurityHeaders(redirectResponse.headers);
    return redirectResponse;
  }

  // 2. State-Changing API CSRF / Origin Guard
  const isApiRoute = pathname.startsWith("/api/");
  const isMutationMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);

  if (isApiRoute && isMutationMethod) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // If Origin header is provided by browser, verify it matches the current Host
    if (origin && host) {
      const allowedOrigins = [
        `http://${host}`,
        `https://${host}`,
        "http://localhost:3000",
        "https://scaleupindia.gov.in",
      ];
      // Webhook paths are exempted from browser origin check since they are server-to-server calls
      const isWebhook = pathname.includes("/webhook");
      if (!isWebhook && !allowedOrigins.some((o) => origin.startsWith(o))) {
        const errorResponse = NextResponse.json(
          {
            success: false,
            error: {
              code: "CSRF_ORIGIN_MISMATCH",
              message: "Cross-site request forgery detected. Request origin rejected.",
            },
          },
          { status: 403 }
        );
        applySecurityHeaders(errorResponse.headers);
        return errorResponse;
      }
    }
  }

  // 3. Normal Request Pass-through with Hardened Security Headers
  const response = NextResponse.next();
  applySecurityHeaders(response.headers);
  return response;
}

/**
 * Applies OWASP compliant enterprise security headers
 */
function applySecurityHeaders(headers: Headers): void {
  headers.set("Content-Security-Policy", SECURITY_CONFIG.HEADERS.CONTENT_SECURITY_POLICY);
  headers.set("X-Frame-Options", SECURITY_CONFIG.HEADERS.FRAME_OPTIONS);
  headers.set("X-Content-Type-Options", SECURITY_CONFIG.HEADERS.CONTENT_TYPE_OPTIONS);
  headers.set("Strict-Transport-Security", SECURITY_CONFIG.HEADERS.HSTS);
  headers.set("Referrer-Policy", SECURITY_CONFIG.HEADERS.REFERRER_POLICY);
  headers.set("Permissions-Policy", SECURITY_CONFIG.HEADERS.PERMISSIONS_POLICY);
  headers.set("X-DNS-Prefetch-Control", "off");
  headers.set("X-XSS-Protection", "1; mode=block");
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
