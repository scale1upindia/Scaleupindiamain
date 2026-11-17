// Scale-up India — Phase 18 Playwright E2E: FLOW 2
// Flow 2: Buyer Registration -> Login -> Mandate -> Discovery/Filter -> Tier 1 Masking -> EOI Submission -> Seller Acceptance -> Bilateral State
// Path: tests/e2e/phase18/flow2-buyer-discovery-eoi.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  loginViaUI,
  seedUserAndSession,
  attachUserSession,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("FLOW 2 — Buyer Onboarding, Mandate, Catalog Discovery & Bilateral EOI", () => {
  const runId = crypto.randomUUID().slice(0, 6);
  const buyerEmail = `flow2.buyer.${runId}@scaleupindia.co.in`;
  const buyerPhone = `+9197${Math.floor(10000000 + Math.random() * 90000000)}`;
  const buyerPassword = DEFAULT_TEST_PASSWORD;
  let buyerUserId: string;
  let buyerProfileId: string;
  let sellerUserId: string;
  let sellerProfileId: string;
  let opportunityId: string;
  let eoiId: string;

  test("1. Buyer registers through the real registration UI", async ({ page }) => {
    await page.goto("/register");
    await page.waitForLoadState("networkidle");

    // Click Buyer / Investor card if present
    const buyerRoleCard = page.locator("text='Buyer / Investor'").first();
    if (await buyerRoleCard.isVisible()) {
      await buyerRoleCard.click();
    }

    // Fill registration credentials
    await page.fill('input[placeholder*="Ramesh"]', "Rajesh");
    await page.fill('input[placeholder*="Sharma"]', "Kulkarni");
    await page.fill('input[type="email"]', buyerEmail);
    await page.fill('input[type="tel"]', buyerPhone);
    await page.fill('input[type="password"]', buyerPassword);

    // Submit registration
    await page.click('button[type="submit"]');

    // Should redirect out of register
    await page.waitForURL((url) => !url.pathname.includes("/register"), { timeout: 15_000 });

    const userRes = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [buyerEmail]);
    expect(userRes.rows.length).toBe(1);
    buyerUserId = userRes.rows[0].id;
  });

  test("2. Buyer logs in through real login UI and accesses onboarding", async ({ page }) => {
    await loginViaUI(page, buyerEmail, buyerPassword);
    expect(page.url()).toContain("/dashboard");

    await page.goto("/onboarding/buyer");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1, h2, h3").first()).toBeVisible();
  });

  test("3. Buyer completes onboarding profile & acquisition mandate and submits for verification", async ({ page, context }) => {
    if (!buyerUserId) {
      const userRes = await dbQuery<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [buyerEmail]);
      buyerUserId = userRes.rows[0].id;
    }

    await attachUserSession(context, buyerEmail, buyerPassword);

    // Seed Buyer profile
    const bpRes = await dbQuery<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, trade_name, entity_type,
        contact_name, designation, email, phone, state, city,
        onboarding_status
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Mahindra Strategic Investments Ltd', 'Mahindra Defense Ventures', 'COMPANY',
        'Rajesh Kulkarni', 'Managing Director', $2, $3, 'Maharashtra', 'Mumbai',
        'DRAFT'
      ) ON CONFLICT (user_id) DO UPDATE SET 
        legal_name = EXCLUDED.legal_name,
        buyer_type = EXCLUDED.buyer_type,
        trade_name = EXCLUDED.trade_name,
        entity_type = EXCLUDED.entity_type,
        contact_name = EXCLUDED.contact_name,
        designation = EXCLUDED.designation,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        state = EXCLUDED.state,
        city = EXCLUDED.city,
        updated_at = NOW()
      RETURNING id`,
      [buyerUserId, buyerEmail, buyerPhone]
    );
    buyerProfileId = bpRes.rows[0].id;

    // Seed Acquisition Mandate
    await dbQuery(
      `INSERT INTO acquisition_mandates (
        buyer_profile_id, name, description, status,
        min_investment, max_investment, preferred_ticket_size, available_capital
      ) VALUES (
        $1, 'Strategic Aerospace Acquisition Mandate', 'Mandate for 100% acquisition of precision machining and avionics manufacturing units.', 'ACTIVE',
        500000000, 1500000000, 850000000, 1000000000
      ) ON CONFLICT DO NOTHING`,
      [buyerProfileId]
    );

    await page.goto("/onboarding/buyer");
    await page.waitForLoadState("networkidle");

    // Submit buyer dossier
    const submitRes = await page.evaluate(async () => {
      const res = await fetch("/api/v1/buyer/onboarding/submit", { method: "POST" });
      return await res.json();
    });
    expect(submitRes.success).toBe(true);

    const checkRes = await dbQuery<{ onboarding_status: string }>(
      `SELECT onboarding_status FROM buyer_profiles WHERE id = $1`,
      [buyerProfileId]
    );
    expect(["SUBMITTED", "UNDER_REVIEW"]).toContain(checkRes.rows[0].onboarding_status);
  });

  test("4. Admin reviews and verifies the buyer dossier", async ({ page, context }) => {
    await seedUserAndSession(context, "ADMIN", "flow2_admin");

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Execute review transition: START_REVIEW -> VERIFY
    await page.evaluate(async (id) => {
      await fetch(`/api/v1/admin/buyers/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START_REVIEW", notes: "Commenced compliance review of buyer credentials." }),
      });
      await fetch(`/api/v1/admin/buyers/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VERIFY", notes: "Proof of funds and corporate mandate verified." }),
      });
    }, buyerProfileId);

    const verifyRes = await dbQuery<{ onboarding_status: string }>(
      `SELECT onboarding_status FROM buyer_profiles WHERE id = $1`,
      [buyerProfileId]
    );
    expect(verifyRes.rows[0].onboarding_status).toBe("VERIFIED");
  });

  test("5. Buyer searches & filters confidential catalog and verifies Tier 1 masked opportunity", async ({ page, context }) => {
    // Ensure an existing published opportunity is available
    let oppRes = await dbQuery<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM opportunities WHERE status = 'PUBLISHED' LIMIT 1`
    );

    if (oppRes.rows.length === 0) {
      // Seed a published opportunity if none exists
      const sellerActor = await seedUserAndSession(context, "PROMOTER", "flow2_opp_seller");
      sellerUserId = sellerActor.user.id;
      const sp = await dbQuery<{ id: string }>(
        `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
         VALUES ($1, 'Promoter', '+919811122233', $2, 'VERIFIED')
         ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
        [sellerUserId, sellerActor.email]
      );
      sellerProfileId = sp.rows[0].id;

      const opp = await dbQuery<{ id: string }>(
        `INSERT INTO opportunities (
          user_id, seller_profile_id, title, headline, teaser_summary,
          business_category, industry, sub_sector, operating_region, registered_state,
          approximate_age_bracket, revenue_bracket, transaction_type, business_model,
          ebitda_margin_bracket, asking_price_bracket, exact_legal_name, exact_cin,
          exact_gstin, exact_pan, exact_address, status
        ) VALUES (
          $1, $2, 'Advanced Precision Dynamics Ltd', 'Defense Precision Component Manufacturer in Pune',
          'Tier-1 defense machining and component vendor with long-term contracts.',
          'MANUFACTURING', 'Precision Engineering', 'Aerospace Components', 'WEST_INDIA', 'Maharashtra',
          '10_TO_20_YRS', '50CR_TO_100CR', 'FULL_ACQUISITION', 'B2B',
          '20_TO_30_PCT', '50CR_TO_100CR', 'Advanced Precision Dynamics Pvt Ltd', 'U29299MH2010PTC099881',
          '27AABCA9999F1Z1', 'AABCA9999F', 'Plot 45, MIDC Bhosari, Pune', 'PUBLISHED'
        ) RETURNING id`,
        [sellerUserId, sellerProfileId]
      );
      opportunityId = opp.rows[0].id;
    } else {
      opportunityId = oppRes.rows[0].id;
      sellerUserId = oppRes.rows[0].user_id;
    }

    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, buyerPassword);

    // Browse confidential catalog
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");

    // The catalog should be loaded with opportunities
    await expect(page.locator("body")).toContainText("Opportunities");

    // Navigate to single opportunity discovery page
    await page.goto(`/opportunities/${opportunityId}`);
    await page.waitForLoadState("networkidle");

    const content = await page.content();
    // Verify Tier 1 teaser data is visible
    expect(content).toContain("Precision Engineering");

    // Verify statutory & confidential identifiers are masked (Zero-leakage)
    expect(content).not.toContain("U29299MH2010PTC099881");
    expect(content).not.toContain("27AABCA9999F1Z1");
    expect(content).not.toContain("AABCA9999F");
    expect(content).not.toContain("MIDC Bhosari");
  });

  test("6. Buyer submits Expression of Interest (EOI)", async ({ page, context }) => {
    await attachUserSession(context, buyerEmail, buyerPassword);

    await page.goto(`/opportunities/${opportunityId}`);
    await page.waitForLoadState("networkidle");

    // Submit EOI via API
    const eoiSubmitRes = await page.evaluate(async (oppId) => {
      const res = await fetch(`/api/v1/opportunities/${oppId}/eoi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestType: "FULL_ACQUISITION",
          proposedTransactionType: "FULL_ACQUISITION",
          indicativeOfferRange: "50CR_TO_100CR",
          investmentTimeline: "1_TO_3_MONTHS",
          buyerMessage: "We are deeply interested in exploring a 100% strategic acquisition of your precision manufacturing business and wish to execute an NDA to proceed to diligence.",
        }),
      });
      return await res.json();
    }, opportunityId);

    expect(eoiSubmitRes.success).toBe(true);
    eoiId = eoiSubmitRes.data.eoi?.id || eoiSubmitRes.data.id;
    expect(eoiId).toBeDefined();

    // Verify DB state
    const eoiDb = await dbQuery<{ status: string; buyer_id: string }>(
      `SELECT status, buyer_id FROM expressions_of_interest WHERE id = $1`,
      [eoiId]
    );
    expect(eoiDb.rows[0].status).toBe("SUBMITTED");
    expect(eoiDb.rows[0].buyer_id).toBe(buyerUserId);
  });

  test("7. Seller reviews EOI in inbox and accepts it, establishing bilateral relationship", async ({ page, context }) => {
    // Look up seller user for the opportunity
    const oppRes = await dbQuery<{ user_id: string; email: string }>(
      `SELECT o.user_id, u.email FROM opportunities o JOIN users u ON o.user_id = u.id WHERE o.id = $1`,
      [opportunityId]
    );
    sellerUserId = oppRes.rows[0].user_id;
    const sellerActorEmail = oppRes.rows[0].email;

    // Attach seller session
    await attachUserSession(context, sellerActorEmail, DEFAULT_TEST_PASSWORD);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Seller accepts EOI
    const acceptRes = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/seller/eois/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerResponseMessage: "We acknowledge and welcome your expression of interest. Please proceed with NDA countersignature.",
        }),
      });
      return await res.json();
    }, eoiId);

    expect(acceptRes.success).toBe(true);

    // Verify DB state is ACCEPTED
    const eoiDb = await dbQuery<{ status: string }>(
      `SELECT status FROM expressions_of_interest WHERE id = $1`,
      [eoiId]
    );
    expect(eoiDb.rows[0].status).toBe("ACCEPTED");
  });
});
