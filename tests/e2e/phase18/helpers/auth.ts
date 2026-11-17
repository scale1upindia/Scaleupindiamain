// Scale-up India — Phase 18 Playwright E2E Auth Helpers
// Path: tests/e2e/phase18/helpers/auth.ts
// Communicates with Next.js server via HTTP test fixture API to avoid PGlite process lock conflicts

import { Page, BrowserContext } from "@playwright/test";
import crypto from "crypto";

export const DEFAULT_TEST_PASSWORD = "Password@123";
export const FIXTURE_API_URL = "http://localhost:3000/api/v1/test/fixture";

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  status: string;
}

export interface SeededActor {
  user: AuthenticatedUser;
  sessionToken: string;
  email: string;
}

/**
 * Execute direct SQL via Next.js server test fixture
 */
export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const res = await fetch(FIXTURE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "query", sql, params }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`dbQuery failed: ${data.error || JSON.stringify(data)}`);
  }
  return { rows: data.rows, rowCount: data.rowCount };
}

/**
 * Logs in via the real browser UI at /login
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password = DEFAULT_TEST_PASSWORD,
  expectedRedirect = "/dashboard"
): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

/**
 * Seeds a user with explicit platform roles and establishes an authenticated browser session
 */
export async function seedUserAndSession(
  context: BrowserContext,
  role: "PROMOTER" | "BUYER" | "ADMIN" | "REVIEWER" | "FINANCE" | "SUPER_ADMIN" | "VIEW_ONLY",
  prefix = "test"
): Promise<SeededActor> {
  const res = await fetch(FIXTURE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "seed_actor",
      role,
      prefix,
      password: DEFAULT_TEST_PASSWORD,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`seedUserAndSession failed: ${data.error || JSON.stringify(data)}`);
  }

  // Inject session cookie into browser context
  await context.addCookies([
    {
      name: "__scaleup_session",
      value: data.sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return {
    user: data.user,
    sessionToken: data.sessionToken,
    email: data.email,
  };
}

/**
 * Login user via fixture and attach session cookie to context
 */
export async function attachUserSession(
  context: BrowserContext,
  email: string,
  password = DEFAULT_TEST_PASSWORD
): Promise<string> {
  const res = await fetch(FIXTURE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "login",
      email,
      password,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`attachUserSession failed: ${data.error || JSON.stringify(data)}`);
  }

  await context.addCookies([
    {
      name: "__scaleup_session",
      value: data.sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  return data.sessionToken;
}

/**
 * Creates a valid PDF binary buffer with required magic bytes (%PDF-)
 */
export function createTestPdfBuffer(label = "ScaleUp Test PDF"): Buffer {
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
  const body = Buffer.from(
    `1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India E2E) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
  );
  return Buffer.concat([header, body]);
}
