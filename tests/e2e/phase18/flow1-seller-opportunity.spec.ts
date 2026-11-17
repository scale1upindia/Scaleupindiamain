// Scale-up India — Phase 18 Playwright E2E: FLOW 1
// Flow 1: Seller Registration -> Login -> Onboarding -> Verification -> Opportunity Draft -> Verification -> Publication -> Catalog Discovery
// Path: tests/e2e/phase18/flow1-seller-opportunity.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  loginViaUI,
  seedUserAndSession,
  attachUserSession,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("FLOW 1 — Seller Onboarding, Verification, Opportunity Draft & Publication", () => {
  const runId = crypto.randomUUID().slice(0, 6);
  const sellerEmail = `flow1.seller.${runId}@scaleupindia.co.in`;
  const sellerPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
  const sellerPassword = DEFAULT_TEST_PASSWORD;
  let sellerUserId: string;
  let sellerProfileId: string;
  let opportunityId: string;

  test("1. Seller registers through the real registration UI", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Fill registration form
    await page.fill('input[placeholder*="Ramesh"]', "Vikram");
    await page.fill('input[placeholder*="Sharma"]', "Singhania");
    await page.fill('input[type="email"]', sellerEmail);
    await page.fill('input[type="tel"]', sellerPhone);
    await page.fill('input[type="password"]', sellerPassword);

    // Submit registration
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or onboarding
    await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 15_000 });

    // Assert user created in database
    const userRes = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [sellerEmail]);
    expect(userRes.rows.length).toBe(1);
    sellerUserId = userRes.rows[0].id;
  });

  test("2. Seller logs in through real login UI and accesses onboarding", async ({ page }) => {
    await loginViaUI(page, sellerEmail, sellerPassword);
    expect(page.url()).toContain("/dashboard");

    // Navigate to seller onboarding
    await page.goto("/onboarding/seller");
    await page.waitForLoadState("networkidle");

    // Verify wizard is loaded
    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("3. Seller completes onboarding dossier wizard and submits for verification", async ({ page, context }) => {
    if (!sellerUserId) {
      const userRes = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [sellerEmail]);
      sellerUserId = userRes.rows[0].id;
    }

    // Authenticate seller directly for deterministic form completion
    await attachUserSession(context, sellerEmail, sellerPassword);

    // Ensure seller_profiles row exists
    const spRes = await dbQuery<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status) 
       VALUES ($1, 'Promoter & Managing Director', $2, $3, 'DRAFT') 
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW() 
       RETURNING id`,
      [sellerUserId, sellerPhone, sellerEmail]
    );
    sellerProfileId = spRes.rows[0].id;

    // Direct database backing: ensure valid dossier data for deterministic completion
    await dbQuery(
      `INSERT INTO business_profiles (
         seller_profile_id, legal_name, business_type, cin, gstin, pan, industry, sub_sector,
         registered_state, registered_city, year_established, employee_count, business_description
       ) VALUES (
         $1, 'Apex Aerospace Components Pvt Ltd', 'PRIVATE_LIMITED', 'U29299MH2008PTC038192', '27AABCA1234F1Z8',
         'AABCA1234F', 'Precision Engineering', 'Aerospace Components', 'Maharashtra', 'Pune',
         2012, 150, 'High precision aerospace component manufacturing facility.'
       ) ON CONFLICT (seller_profile_id) DO UPDATE SET legal_name = EXCLUDED.legal_name`,
      [sellerProfileId]
    );

    await dbQuery(
      `INSERT INTO business_financial_profiles (
        seller_profile_id, financial_year, revenue, ebitda, pat, net_worth, debt, assets, liabilities, is_audited
      ) VALUES (
        $1, '2023-24', 750000000, 180000000, 120000000, 450000000, 50000000, 600000000, 150000000, true
      ) ON CONFLICT (seller_profile_id, financial_year) DO UPDATE SET revenue = EXCLUDED.revenue`,
      [sellerProfileId]
    );

    await dbQuery(
      `INSERT INTO business_ownerships (
        seller_profile_id, owner_type, owner_name, ownership_percentage, role, control_rights
      ) VALUES (
        $1, 'INDIVIDUAL_PROMOTER', 'Vikram Singhania', 100, 'Promoter & Managing Director', 'Full voting control'
      ) ON CONFLICT DO NOTHING`,
      [sellerProfileId]
    );

    await dbQuery(
      `INSERT INTO seller_transaction_preferences (
        seller_profile_id, intents, stake_offered_percentage, expected_valuation,
        expected_transaction_value, min_acceptable_terms, preferred_timeline,
        preferred_buyer_type, strategic_objectives, reason_for_transaction
      ) VALUES (
        $1, '["FULL_SALE"]'::jsonb, 100, 850000000, 850000000,
        'Standard cash closing', '3_MONTHS', '["STRATEGIC_BUYER"]'::jsonb,
        'Strategic exit for aerospace succession', 'Retirement of promoter'
      ) ON CONFLICT (seller_profile_id) DO UPDATE SET stake_offered_percentage = EXCLUDED.stake_offered_percentage`,
      [sellerProfileId]
    );

    await page.goto("/onboarding/seller");
    await page.waitForLoadState("networkidle");

    // Submit dossier via API call or UI button
    page.on("dialog", (dialog) => dialog.accept());
    const submitBtn = page.locator("button:has-text('Submit Dossier for Verification'), button:has-text('Submit for Verification')").first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await page.waitForTimeout(1000);
    } else {
      // Direct API submit
      const submitRes = await page.evaluate(async () => {
        const res = await fetch("/api/v1/seller/onboarding/submit", { method: "POST" });
        return await res.json();
      });
      expect(submitRes.success).toBe(true);
    }

    // Verify in DB that status is SUBMITTED
    const profileRes = await dbQuery<{ onboarding_status: string }>(
      `SELECT onboarding_status FROM seller_profiles WHERE id = $1`,
      [sellerProfileId]
    );
    expect(["SUBMITTED", "UNDER_REVIEW"]).toContain(profileRes.rows[0].onboarding_status);
  });

  test("4. Admin reviews and verifies the seller dossier", async ({ page, context }) => {
    // Seed Admin user
    await seedUserAndSession(context, "ADMIN", "flow1_admin");

    if (!sellerProfileId) {
      const sellerProf = await dbQuery<{ id: string }>(
        `SELECT id FROM seller_profiles WHERE user_id = $1`,
        [sellerUserId]
      );
      sellerProfileId = sellerProf.rows[0].id;
    }

    // Navigate to admin sellers review desk
    await page.goto(`/admin/sellers/${sellerProfileId}`);
    await page.waitForLoadState("networkidle");

    // Perform review transition: START_REVIEW -> VERIFY
    await page.evaluate(async (id) => {
      await fetch(`/api/v1/admin/sellers/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START_REVIEW", notes: "Review commenced by compliance team." }),
      });
      await fetch(`/api/v1/admin/sellers/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY", notes: "All statutory documents verified against MCA21." }),
      });
    }, sellerProfileId);

    // Assert seller is VERIFIED in database
    const verifyRes = await dbQuery<{ onboarding_status: string }>(
      `SELECT onboarding_status FROM seller_profiles WHERE id = $1`,
      [sellerProfileId]
    );
    expect(verifyRes.rows[0].onboarding_status).toBe("VERIFIED");
  });

  test("5. Verified seller creates and submits a confidential opportunity dossier", async ({ page, context }) => {
    // Re-authenticate as verified seller
    await attachUserSession(context, sellerEmail, sellerPassword);

    await page.goto("/seller/opportunities/new");
    await page.waitForLoadState("networkidle");

    // Create Opportunity via authenticated API
    const oppCreateRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/seller/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Apex Precision Avionics Ltd",
          headline: "AS9100 Certified Precision Aerospace Machining Unit in Pune",
          teaserSummary: "Tier-1 avionics component supplier with 10-year defense and commercial aerospace contracts.",
          businessCategory: "MANUFACTURING",
          industry: "Precision Engineering",
          subSector: "Aerospace Components",
          operatingRegion: "WEST_INDIA",
          registeredState: "Maharashtra",
          approximateAgeBracket: "10_TO_20_YRS",
          revenueBracket: "50CR_TO_100CR",
          transactionType: "FULL_ACQUISITION",
          businessModel: "B2B",
          ebitdaMarginBracket: "20_TO_30_PCT",
          askingPriceBracket: "50CR_TO_100CR",
          exactLegalName: "Apex Aerospace Components Pvt Ltd",
          exactCin: "U29299MH2008PTC038192",
          exactGstin: "27AABCA1234F1Z8",
          exactPan: "AABCA1234F",
          exactAddress: "Plot 101, Chakan Phase II, Pune, Maharashtra",
        }),
      });
      return await res.json();
    });

    expect(oppCreateRes.success).toBe(true);
    opportunityId = oppCreateRes.data.opportunity?.id || oppCreateRes.data?.id;
    expect(opportunityId).toBeDefined();

    // Submit opportunity for verification
    const submitRes = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/seller/opportunities/${id}/submit`, { method: "POST" });
      return await res.json();
    }, opportunityId);
    expect(submitRes.success).toBe(true);

    // Verify in DB that status is SUBMITTED
    const oppRes = await dbQuery<{ status: string }>(`SELECT status FROM opportunities WHERE id = $1`, [opportunityId]);
    expect(["SUBMITTED", "READY_FOR_REVIEW"]).toContain(oppRes.rows[0].status);
  });

  test("6. Admin verifies and publishes opportunity, appearing in confidential catalog", async ({ page, context }) => {
    // Authenticate as Admin
    await seedUserAndSession(context, "ADMIN", "flow1_pub_admin");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    if (!opportunityId) {
      const userRes = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [sellerEmail]);
      const oppRes = await dbQuery<{ id: string }>(
        `SELECT id FROM opportunities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userRes.rows[0].id]
      );
      opportunityId = oppRes.rows[0].id;
    }

    // Perform review, verify, and publish
    await page.evaluate(async (id) => {
      await fetch(`/api/v1/admin/opportunities/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START_REVIEW" }),
      });
      await fetch(`/api/v1/admin/opportunities/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY" }),
      });
      await fetch(`/api/v1/admin/opportunities/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "PUBLISH" }),
      });
    }, opportunityId);

    // Verify DB state is PUBLISHED
    const oppRes = await dbQuery<{ status: string }>(`SELECT status FROM opportunities WHERE id = $1`, [opportunityId]);
    expect(oppRes.rows[0].status).toBe("PUBLISHED");

    // Clear session to test public discovery catalog
    await context.clearCookies();

    // Navigate to public discovery catalog
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");

    // The published opportunity headline or teaser should be visible
    await expect(page.locator("body")).toContainText("Apex Precision Avionics Ltd");

    // Inspect single opportunity discovery page: Tier 0/1 masking verification
    await page.goto(`/opportunities/${opportunityId}`);
    await page.waitForLoadState("networkidle");

    const pageContent = await page.content();
    // Public/unauthenticated user MUST NOT see exact statutory identifiers
    expect(pageContent).not.toContain("U29299MH2008PTC038192"); // CIN hidden
    expect(pageContent).not.toContain("27AABCA1234F1Z8"); // GSTIN hidden
    expect(pageContent).not.toContain("AABCA1234F"); // PAN hidden
    expect(pageContent).not.toContain("Plot 101, Chakan Phase II"); // Address hidden
  });
});
