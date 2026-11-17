import { test, expect } from "@playwright/test";

test.describe("Favicon & Google Authentication UI", () => {
  test("1. Favicon is directly accessible and served with status 200", async ({ request }) => {
    const response = await request.get("/favicon.ico");
    expect(response.status()).toBe(200);

    const buffer = await response.body();
    // Official Scale-up India logo favicon is exactly 11,418 bytes
    expect(buffer.length).toBe(11418);
  });

  test("2. Root layout contains valid favicon and icon metadata links", async ({ page }) => {
    await page.goto("/");

    // Verify favicon link tags
    const faviconLink = page.locator('link[rel="icon"]');
    await expect(faviconLink.first()).toBeAttached();
    const href = await faviconLink.first().getAttribute("href");
    expect(href).toContain("/favicon.ico");

    // Verify brand title and branding
    const title = await page.title();
    expect(title).toContain("Scale-up India");
  });

  test("3. Login page renders branded Google Sign-In button and handles errors", async ({ page }) => {
    await page.goto("/login");

    // Google Sign-In button verification
    const googleButton = page.locator('a:has-text("Continue with Google")');
    await expect(googleButton).toBeVisible();

    const href = await googleButton.getAttribute("href");
    expect(href).toContain("/api/v1/auth/google");

    // Divider check
    await expect(page.locator("text=or continue with email")).toBeVisible();

    // Verify error parameter display
    await page.goto("/login?error=unverified_email");
    await expect(page.locator("text=Authentication Notice")).toBeVisible();
    await expect(page.locator("text=Google account email is not verified")).toBeVisible();
  });

  test("4. Register page renders branded Google Sign-Up button and role selection", async ({ page }) => {
    await page.goto("/register");

    // Google Sign-Up button verification
    const googleSignUpButton = page.locator('a:has-text("Sign up with Google")');
    await expect(googleSignUpButton).toBeVisible();

    const href = await googleSignUpButton.getAttribute("href");
    expect(href).toContain("/api/v1/auth/google?roles=");

    // Divider check
    await expect(page.locator("text=or register with email")).toBeVisible();

    // Verify default role selection
    await expect(page.locator("text=Promoter / Seller")).toBeVisible();
    await expect(page.locator("text=Buyer / Investor")).toBeVisible();
    await expect(page.locator("text=Partnership / JV")).toBeVisible();
  });
});
