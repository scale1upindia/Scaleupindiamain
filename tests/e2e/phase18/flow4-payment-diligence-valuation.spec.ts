// Scale-up India — Phase 18 Playwright E2E: FLOW 4
// Flow 4: Accepted MOU -> Payment Intent & Token Deposit -> Due Diligence Workspace & Evidence -> Reviewer Findings -> Valuation Engine & Lock
// Path: tests/e2e/phase18/flow4-payment-diligence-valuation.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  seedUserAndSession,
  attachUserSession,
  createTestPdfBuffer,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("FLOW 4 — Payment Token Deposit, Due Diligence Workspace & Valuation Engine", () => {
  const runId = crypto.randomUUID().slice(0, 6);
  let buyerUserId: string;
  let buyerEmail: string;
  let sellerUserId: string;
  let sellerEmail: string;
  let reviewerUserId: string;
  let reviewerEmail: string;
  let adminUserId: string;
  let opportunityId: string;
  let ndaId: string;
  let mouId: string;
  let paymentIntentId: string;
  let diligenceCaseId: string;
  let evidenceId: string;
  let valuationCaseId: string;

  test("1. Setup prerequisite: Opportunity with fully Accepted Bilateral MOU", async ({ context }) => {
    // 1. Seed Seller
    const seller = await seedUserAndSession(context, "PROMOTER", `flow4_s_${runId}`);
    sellerUserId = seller.user.id;
    sellerEmail = seller.email;

    const spRes = await dbQuery<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Promoter & Managing Director', '+919833344455', $2, 'VERIFIED')
       ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [sellerUserId, sellerEmail]
    );
    const sellerProfileId = spRes.rows[0].id;

    // 2. Seed Published Opportunity
    const oppSeqRes = await dbQuery<{ seq: string }>(`SELECT nextval('opportunity_ref_seq') as seq`);
    const oppRef = `OPP-${new Date().getFullYear()}-${String(oppSeqRes.rows[0]?.seq || "2001").padStart(4, "0")}`;

    const oppRes = await dbQuery<{ id: string }>(
      `INSERT INTO opportunities (
        reference_code, user_id, seller_profile_id, title, headline, teaser_summary,
        business_category, industry, sub_sector, operating_region, registered_state,
        approximate_age_bracket, revenue_bracket, transaction_type, business_model,
        ebitda_margin_bracket, asking_price_bracket, exact_legal_name, exact_cin,
        exact_gstin, exact_pan, exact_address, status
      ) VALUES (
        $1, $2, $3, 'Orbit Dynamics Avionics Ltd', 'Aerospace Machining & Flight Control Systems',
        'Tier-1 defense machining plant with 10-year defense contracts.',
        'MANUFACTURING', 'Precision Engineering', 'Aerospace Components', 'WEST_INDIA', 'Maharashtra',
        '10_TO_20_YRS', '50CR_TO_100CR', 'FULL_ACQUISITION', 'B2B',
        '20_TO_30_PCT', '50CR_TO_100CR', 'Orbit Dynamics Avionics Pvt Ltd', 'U29299MH2012PTC077777',
        '27AABCA7777F1Z3', 'AABCA7777F', 'Plot 99, MIDC Chakan, Pune', 'PUBLISHED'
      ) RETURNING id`,
      [oppRef, sellerUserId, sellerProfileId]
    );
    opportunityId = oppRes.rows[0].id;

    // 3. Seed Buyer
    const buyer = await seedUserAndSession(context, "BUYER", `flow4_b_${runId}`);
    buyerUserId = buyer.user.id;
    buyerEmail = buyer.email;

    const bpRes = await dbQuery<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, trade_name, entity_type,
        contact_name, designation, email, phone, state, city,
        onboarding_status
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Apex Aerospace Holding Corp', 'Apex Defense Group', 'COMPANY',
        'Sameer Joshi', 'Chief Investment Officer', $2, '+919711122233', 'Maharashtra', 'Mumbai',
        'VERIFIED'
      ) ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [buyerUserId, buyerEmail]
    );
    const buyerProfileId = bpRes.rows[0].id;

    // 4. Seed Accepted Bilateral EOI
    const eoiSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('eoi_ref_seq') as nextval`);
    const eoiRef = `EOI-${new Date().getFullYear()}-${eoiSeqRes.rows[0]?.nextval || "20001"}`;

    const eoiRes = await dbQuery<{ id: string }>(
      `INSERT INTO expressions_of_interest (
        reference_code, opportunity_id, buyer_id, buyer_profile_id, seller_id, seller_profile_id,
        status, interest_type, proposed_transaction_type, indicative_offer_range,
        investment_timeline, buyer_message, seller_response_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'ACCEPTED', 'FULL_ACQUISITION', 'FULL_ACQUISITION', '50CR_TO_100CR',
        '1_TO_3_MONTHS', 'Expressing interest in acquiring 100% of Orbit Dynamics.',
        'Seller accepts EOI.'
      ) RETURNING id`,
      [eoiRef, opportunityId, buyerUserId, buyerProfileId, sellerUserId, sellerProfileId]
    );
    const eoiId = eoiRes.rows[0].id;

    // 5. Seed Executed NDA
    const ndaSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('nda_ref_seq') as nextval`);
    const ndaRef = `NDA-${new Date().getFullYear()}-${ndaSeqRes.rows[0]?.nextval || "20001"}`;

    const ndaRes = await dbQuery<{ id: string }>(
      `INSERT INTO nda_agreements (
        reference_code, opportunity_id, eoi_id, buyer_id, seller_id,
        nda_version, status, buyer_accepted_at, seller_accepted_at, executed_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, 1, 'EXECUTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4
      ) RETURNING id`,
      [ndaRef, opportunityId, eoiId, buyerUserId, sellerUserId]
    );
    ndaId = ndaRes.rows[0].id;

    // 6. Seed Accepted Deal MOU with Earnest Deposit Intent
    const mouSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('mou_ref_seq') as nextval`);
    const mouRef = `MOU-${new Date().getFullYear()}-${mouSeqRes.rows[0]?.nextval || "20001"}`;

    const mouRes = await dbQuery<{ id: string }>(
      `INSERT INTO deal_mous (
        reference_code, opportunity_id, eoi_id, nda_id, buyer_id, seller_id,
        created_by, current_version_number, status, accepted_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $5, 1, 'ACCEPTED', CURRENT_TIMESTAMP
      ) RETURNING id`,
      [mouRef, opportunityId, eoiId, ndaId, buyerUserId, sellerUserId]
    );
    mouId = mouRes.rows[0].id;

    // Seed Version 1 for the MOU
    await dbQuery(
      `INSERT INTO mou_versions (
        mou_id, version_number, proposed_by, proposed_by_role, status,
        proposed_valuation, earnest_deposit_amount, cash_consideration, equity_consideration,
        proposed_structure, exclusivity_period_days, due_diligence_window_days
      ) VALUES (
        $1, 1, $2, 'BUYER', 'ACCEPTED',
        900000000, 9000000, 900000000, 0,
        'FULL_ACQUISITION', 45, 30
      )`,
      [mouId, buyerUserId]
    );

    expect(mouId).toBeDefined();
  });

  test("2. Buyer creates Payment Intent for Earnest Token Deposit and settles it", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Create Payment Intent via API
    const payRes = await page.evaluate(
      async ({ id }) => {
        const res = await fetch(`/api/v1/mous/${id}/payment-intents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-payment-provider": "TEST_SIMULATED",
          },
          body: JSON.stringify({
            idempotencyKey: `idemp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          }),
        });
        return await res.json();
      },
      { id: mouId }
    );

    if (!payRes.success) {
      console.error("PAY RES ERROR:", JSON.stringify(payRes));
    }
    expect(payRes.success).toBe(true);
    paymentIntentId = payRes.data.paymentIntent?.id || payRes.data.id;
    expect(paymentIntentId).toBeDefined();

    // Settle payment intent in DB (simulating webhook execution)
    await dbQuery(
      `UPDATE payment_intents 
       SET status = 'SUCCEEDED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [paymentIntentId]
    );

    // Verify double-entry ledger entry exists or record payment confirmation
    const payCheck = await dbQuery<{ status: string }>(
      `SELECT status FROM payment_intents WHERE id = $1`,
      [paymentIntentId]
    );
    expect(payCheck.rows[0].status).toBe("SUCCEEDED");
  });

  test("3. Due Diligence Workspace: Case Creation, Evidence Upload & Reviewer Findings", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer creates Due Diligence Case
    const caseRes = await page.evaluate(
      async ({ id }) => {
        const res = await fetch(`/api/v1/mous/${id}/diligence-cases`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scopeDescription: "Technical, environmental, and statutory financial due diligence for Orbit Dynamics.",
          }),
        });
        return await res.json();
      },
      { id: mouId }
    );

    expect(caseRes.success).toBe(true);
    diligenceCaseId = caseRes.data.id;
    expect(diligenceCaseId).toBeDefined();

    // Authenticate as Seller to upload evidence
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const pdfBuffer = createTestPdfBuffer("Environmental & Pollution Control Clearance");
    const pdfBase64 = pdfBuffer.toString("base64");

    // Fetch a valid checklist item for this case
    const itemDb = await dbQuery<{ id: string; category: string }>(
      `SELECT id, category FROM diligence_checklist_items WHERE case_id = $1 LIMIT 1`,
      [diligenceCaseId]
    );
    const checklistItemId = itemDb.rows[0].id;
    const itemCategory = itemDb.rows[0].category;

    // Upload evidence document
    const uploadRes = await page.evaluate(
      async ({ caseId, base64, itemId, cat }) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "Pollution_Control_Clearance.pdf", { type: "application/pdf" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("checklistItemId", itemId);
        formData.append("title", "MPCB Consent to Operate Valid Till 2028");
        formData.append("category", cat);
        formData.append("isConfidential", "true");

        const res = await fetch(`/api/v1/diligence-cases/${caseId}/evidence`, {
          method: "POST",
          body: formData,
        });
        return await res.json();
      },
      { caseId: diligenceCaseId, base64: pdfBase64, itemId: checklistItemId, cat: itemCategory }
    );

    if (!uploadRes.success) {
      console.error("UPLOAD RES ERROR:", JSON.stringify(uploadRes));
    }
    expect(uploadRes.success).toBe(true);
    evidenceId = uploadRes.data.evidence?.id || uploadRes.data.id;
    expect(evidenceId).toBeDefined();

    // Seed Reviewer user
    const reviewerActor = await seedUserAndSession(context, "REVIEWER", `flow4_rev_${runId}`);
    reviewerUserId = reviewerActor.user.id;
    reviewerEmail = reviewerActor.email;

    // Add Reviewer to diligence case members
    await dbQuery(
      `INSERT INTO diligence_members (case_id, user_id, role, access_status)
       VALUES ($1, $2, 'REVIEWER', 'ACTIVE')
       ON CONFLICT (case_id, user_id) DO UPDATE SET access_status = 'ACTIVE'`,
      [diligenceCaseId, reviewerUserId]
    );

    // Authenticate as Reviewer to record finding
    await attachUserSession(context, reviewerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const findingRes = await page.evaluate(
      async ({ caseId, evidenceId, cat }) => {
        const res = await fetch(`/api/v1/diligence-cases/${caseId}/findings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceId,
            category: cat,
            severity: "LOW",
            title: "MPCB Clearance Annual Return Filed Timely",
            description: "Verified MPCB consent is active with zero outstanding show-cause notices.",
            remediationPlan: "Standard annual compliance renewal tracking.",
          }),
        });
        return await res.json();
      },
      { caseId: diligenceCaseId, evidenceId, cat: itemCategory }
    );

    expect(findingRes.success).toBe(true);
  });

  test("4. Valuation Engine: Model Creation, Inputs, Review & Lock", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer creates Valuation Case from Diligence Case
    const valCreateRes = await page.evaluate(
      async ({ caseId }) => {
        const res = await fetch(`/api/v1/diligence-cases/${caseId}/valuations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Orbit Dynamics Acquisition Valuation Baseline",
          }),
        });
        return await res.json();
      },
      { caseId: diligenceCaseId }
    );

    expect(valCreateRes.success).toBe(true);
    valuationCaseId = valCreateRes.data.id;
    expect(valuationCaseId).toBeDefined();

    // Buyer inputs baseline financial projection
    const inputRes = await page.evaluate(
      async ({ valId }) => {
        const res = await fetch(`/api/v1/valuations/${valId}/inputs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            metricName: "REVENUE",
            rawValue: 750000000,
            currency: "INR",
            unit: "INR",
          }),
        });
        return await res.json();
      },
      { valId: valuationCaseId }
    );
    expect(inputRes.success).toBe(true);

    // Buyer submits valuation version
    const submitValRes = await page.evaluate(
      async ({ valId }) => {
        const res = await fetch(`/api/v1/valuations/${valId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: "Valuation model submitted for independent technical peer review.",
          }),
        });
        return await res.json();
      },
      { valId: valuationCaseId }
    );
    expect(submitValRes.success).toBe(true);

    // Authenticate as Reviewer to approve valuation
    await attachUserSession(context, reviewerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const reviewRes = await page.evaluate(
      async ({ valId }) => {
        const res = await fetch(`/api/v1/valuations/${valId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "APPROVED",
            notes: "DCF cash flow projections, EBITDA multiples, and evidence provenance verified.",
          }),
        });
        return await res.json();
      },
      { valId: valuationCaseId }
    );
    expect(reviewRes.success).toBe(true);

    // Seed Admin to lock valuation
    const adminActor = await seedUserAndSession(context, "ADMIN", `flow4_adm_${runId}`);
    adminUserId = adminActor.user.id;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const lockRes = await page.evaluate(
      async ({ valId }) => {
        const res = await fetch(`/api/v1/valuations/${valId}/lock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lockReason: "Final certified valuation baseline locked for binding share purchase agreement.",
          }),
        });
        return await res.json();
      },
      { valId: valuationCaseId }
    );
    expect(lockRes.success).toBe(true);

    // Verify locked state in database
    const valDb = await dbQuery<{ status: string }>(
      `SELECT status FROM valuation_cases WHERE id = $1`,
      [valuationCaseId]
    );
    expect(valDb.rows[0].status).toBe("LOCKED");
  });
});
