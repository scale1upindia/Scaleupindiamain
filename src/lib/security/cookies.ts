import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "__scaleup_session";
export const OAUTH_STATE_COOKIE_NAME = "__scaleup_oauth_state";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 Days
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60; // 10 Minutes

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  };
}

export function getOAuthStateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

/**
 * Sets the secure HTTP-only session cookie in the Next.js header store
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/**
 * Attaches the session cookie directly to a NextResponse redirect/response
 */
export function setSessionCookieOnResponse(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
}

/**
 * Clears the session cookie on logout
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Attaches the OAuth state cookie directly to a NextResponse
 */
export function setOAuthCookieOnResponse(response: NextResponse, stateValue: string): void {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, stateValue, getOAuthStateCookieOptions());
}

/**
 * Clears the OAuth state cookie on a NextResponse
 */
export function clearOAuthCookieOnResponse(response: NextResponse): void {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    ...getOAuthStateCookieOptions(),
    maxAge: 0,
  });
}

/**
 * Retrieves the raw session token from the request cookie store
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME);
  return cookie?.value || null;
}

