// Scale-up India — Phase 18 Playwright E2E: FLOW 5
// Flow 5: Approved Valuation -> Deal Room -> Closing Conditions -> Bilateral Confirmations -> Independent Review -> Atomic Closing -> Post-Closing Immutability
// Path: tests/e2e/phase18/flow5-transaction-closing.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  seedUserAndSession,
  attachUserSession,
  createTestPdfBuffer,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("FLOW 5 — Transaction Deal Room, Bilateral Confirmations & Atomic Closing", () => {
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
  let diligenceCaseId: string;
  let valuationCaseId: string;
  let valuationVersionId: string;
  let transactionId: string;

  test("1. Setup full prerequisite chain: Opportunity, NDA, MOU, Payment, Diligence & Locked Valuation", async ({ context }) => {
    // 1. Seed Seller
    const seller = await seedUserAndSession(context, "PROMOTER", `flow5_s_${runId}`);
    sellerUserId = seller.user.id;
    sellerEmail = seller.email;

    const spRes = await dbQuery<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Promoter & Chairman', '+919844455566', $2, 'VERIFIED')
       ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [sellerUserId, sellerEmail]
    );
    const sellerProfileId = spRes.rows[0].id;

    // 2. Seed Published Opportunity
    const oppSeqRes = await dbQuery<{ seq: string }>(`SELECT nextval('opportunity_ref_seq') as seq`);
    const oppRef = `OPP-${new Date().getFullYear()}-${String(oppSeqRes.rows[0]?.seq || "3001").padStart(4, "0")}`;

    const oppRes = await dbQuery<{ id: string }>(
      `INSERT INTO opportunities (
        reference_code, user_id, seller_profile_id, title, headline, teaser_summary,
        business_category, industry, sub_sector, operating_region, registered_state,
        approximate_age_bracket, revenue_bracket, transaction_type, business_model,
        ebitda_margin_bracket, asking_price_bracket, exact_legal_name, exact_cin,
        exact_gstin, exact_pan, exact_address, status
      ) VALUES (
        $1, $2, $3, 'Solaris Defense Avionics Pvt Ltd', 'Strategic Aerospace Machining & Inertial Guidance',
        'Tier-1 defense plant with long-term contracts.',
        'MANUFACTURING', 'Precision Engineering', 'Aerospace Components', 'WEST_INDIA', 'Maharashtra',
        '10_TO_20_YRS', '50CR_TO_100CR', 'FULL_ACQUISITION', 'B2B',
        '20_TO_30_PCT', '50CR_TO_100CR', 'Solaris Defense Avionics Pvt Ltd', 'U29299MH2013PTC066666',
        '27AABCA6666F1Z4', 'AABCA6666F', 'Plot 120, Chakan Phase III, Pune', 'PUBLISHED'
      ) RETURNING id`,
      [oppRef, sellerUserId, sellerProfileId]
    );
    opportunityId = oppRes.rows[0].id;

    // 3. Seed Buyer
    const buyer = await seedUserAndSession(context, "BUYER", `flow5_b_${runId}`);
    buyerUserId = buyer.user.id;
    buyerEmail = buyer.email;

    const bpRes = await dbQuery<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, trade_name, entity_type,
        contact_name, designation, email, phone, state, city,
        onboarding_status
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Bharat Strategic Acquisitions Corp Ltd', 'Bharat Defense Holding', 'COMPANY',
        'Anil Deshmukh', 'Managing Director', $2, '+919722233344', 'Maharashtra', 'Mumbai',
        'VERIFIED'
      ) ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [buyerUserId, buyerEmail]
    );
    const buyerProfileId = bpRes.rows[0].id;

    // 4. Seed Accepted Bilateral EOI
    const eoiSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('eoi_ref_seq') as nextval`);
    const eoiRef = `EOI-${new Date().getFullYear()}-${eoiSeqRes.rows[0]?.nextval || "30001"}`;

    const eoiRes = await dbQuery<{ id: string }>(
      `INSERT INTO expressions_of_interest (
        reference_code, opportunity_id, buyer_id, buyer_profile_id, seller_id, seller_profile_id,
        status, interest_type, proposed_transaction_type, indicative_offer_range,
        investment_timeline, buyer_message, seller_response_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'ACCEPTED', 'FULL_ACQUISITION', 'FULL_ACQUISITION', '50CR_TO_100CR',
        '1_TO_3_MONTHS', 'Full buyout interest for Solaris Defense.',
        'Seller welcomes your interest.'
      ) RETURNING id`,
      [eoiRef, opportunityId, buyerUserId, buyerProfileId, sellerUserId, sellerProfileId]
    );
    const eoiId = eoiRes.rows[0].id;

    // 5. Seed Executed NDA
    const ndaSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('nda_ref_seq') as nextval`);
    const ndaRef = `NDA-${new Date().getFullYear()}-${ndaSeqRes.rows[0]?.nextval || "30001"}`;

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

    // 6. Seed Accepted Deal MOU
    const mouSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('mou_ref_seq') as nextval`);
    const mouRef = `MOU-${new Date().getFullYear()}-${mouSeqRes.rows[0]?.nextval || "30001"}`;

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

    await dbQuery(
      `INSERT INTO mou_versions (
        mou_id, version_number, proposed_by, proposed_by_role, status,
        proposed_valuation, earnest_deposit_amount, cash_consideration, equity_consideration,
        proposed_structure, exclusivity_period_days, due_diligence_window_days
      ) VALUES (
        $1, 1, $2, 'BUYER', 'ACCEPTED',
        950000000, 9500000, 950000000, 0,
        'FULL_ACQUISITION', 45, 30
      )`,
      [mouId, buyerUserId]
    );

    // 7. Seed Confirmed Payment Intent & Token Deposit
    const paySeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('payment_ref_seq') as nextval`);
    const payRef = `PAY-${new Date().getFullYear()}-${paySeqRes.rows[0]?.nextval || "30001"}`;

    const payRes = await dbQuery<{ id: string }>(
      `INSERT INTO payment_intents (
        reference_code, opportunity_id, mou_id, payer_user_id, payer_role,
        amount, currency, purpose, status, provider, completed_at
      ) VALUES (
        $1, $2, $3, $4, 'BUYER',
        9500000, 'INR', 'EARNEST_DEPOSIT', 'SUCCEEDED', 'TEST_SIMULATED', CURRENT_TIMESTAMP
      ) RETURNING id`,
      [payRef, opportunityId, mouId, buyerUserId]
    );

    const tokenSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('token_ref_seq') as nextval`);
    const tokenRef = `TKN-${new Date().getFullYear()}-${tokenSeqRes.rows[0]?.nextval || "30001"}`;

    await dbQuery(
      `INSERT INTO token_deposits (
        reference_code, opportunity_id, mou_id, payment_intent_id, buyer_id, seller_id,
        deposit_amount, currency, status, confirmed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        9500000, 'INR', 'TOKEN_PAYMENT_CONFIRMED', CURRENT_TIMESTAMP
      )`,
      [tokenRef, opportunityId, mouId, payRes.rows[0].id, buyerUserId, sellerUserId]
    );

    // 8. Seed Due Diligence Case
    const ddSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('dd_case_ref_seq') as nextval`);
    const ddRef = `DDC-${new Date().getFullYear()}-${ddSeqRes.rows[0]?.nextval || "30001"}`;

    const ddRes = await dbQuery<{ id: string }>(
      `INSERT INTO due_diligence_cases (
        reference_code, opportunity_id, nda_id, mou_id, buyer_id, seller_id,
        status, verdict
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'APPROVED', 'APPROVED'
      ) RETURNING id`,
      [ddRef, opportunityId, ndaId, mouId, buyerUserId, sellerUserId]
    );
    diligenceCaseId = ddRes.rows[0].id;

    // 9. Seed Valuation Case with LOCKED version
    const valSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('val_case_ref_seq') as nextval`);
    const valRef = `VAL-${new Date().getFullYear()}-${valSeqRes.rows[0]?.nextval || "30001"}`;

    const valRes = await dbQuery<{ id: string }>(
      `INSERT INTO valuation_cases (
        reference_code, diligence_case_id, opportunity_id, mou_id, nda_id, buyer_id, seller_id,
        current_version_number, status, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        1, 'LOCKED', $6
      ) RETURNING id`,
      [valRef, diligenceCaseId, opportunityId, mouId, ndaId, buyerUserId, sellerUserId]
    );
    valuationCaseId = valRes.rows[0].id;

    const valVerRes = await dbQuery<{ id: string }>(
      `INSERT INTO valuation_versions (
        case_id, version_number, status, title,
        currency, created_by, approved_at, locked_at, calculation_results
      ) VALUES (
        $1, 1, 'LOCKED', 'Certified Final Acquisition Valuation',
        'INR', $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, '{"blendedValuation": 950000000}'::jsonb
      ) RETURNING id`,
      [valuationCaseId, buyerUserId]
    );
    valuationVersionId = valVerRes.rows[0].id;

    expect(valuationCaseId).toBeDefined();
    expect(valuationVersionId).toBeDefined();
  });

  test("2. Buyer creates Transaction Deal Room for the certified valuation", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer creates transaction
    const txnCreateRes = await page.evaluate(
      async ({ valId }) => {
        const res = await fetch(`/api/v1/valuations/${valId}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transactionType: "SHARE_ACQUISITION",
            paymentStructure: "FULL_ESCROW",
            governingLaw: "Indian Law",
          }),
        });
        return await res.json();
      },
      { valId: valuationCaseId }
    );

    expect(txnCreateRes.success).toBe(true);
    transactionId = txnCreateRes.data.transaction?.id || txnCreateRes.data.id;
    expect(transactionId).toBeDefined();

    // Verify transaction status is INITIATED
    const txnDb = await dbQuery<{ status: string; agreed_amount: string }>(
      `SELECT status, agreed_amount FROM transactions WHERE id = $1`,
      [transactionId]
    );
    expect(txnDb.rows[0].status).toBe("INITIATED");
    expect(Number(txnDb.rows[0].agreed_amount)).toBe(950000000);
  });

  test("3. Closing Conditions: Mark mandatory closing conditions satisfied", async ({ page, context }) => {
    // Satisfy all mandatory conditions in database for deterministic closing readiness
    await dbQuery(
      `UPDATE transaction_conditions 
       SET status = 'SATISFIED', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE transaction_id = $1`,
      [transactionId]
    );

    const condRes = await dbQuery<{ count: string }>(
      `SELECT count(*) as count FROM transaction_conditions WHERE transaction_id = $1 AND status != 'SATISFIED'`,
      [transactionId]
    );
    expect(Number(condRes.rows[0].count)).toBe(0);
  });

  test("4. Bilateral Confirmations: Buyer and Seller confirm transaction terms", async ({ page, context }) => {
    // 1. Buyer confirms terms
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const buyerConfirmRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Buyer confirms all share purchase conditions and escrow terms." }),
        });
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(buyerConfirmRes.success).toBe(true);

    // 2. Seller confirms terms
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const sellerConfirmRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Promoter confirms definitive share transfer covenants." }),
        });
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(sellerConfirmRes.success).toBe(true);

    // Verify DB state reflects bilateral confirmation
    const txnDb = await dbQuery<{ buyer_confirmed: boolean; seller_confirmed: boolean }>(
      `SELECT buyer_confirmed, seller_confirmed FROM transactions WHERE id = $1`,
      [transactionId]
    );
    expect(txnDb.rows[0].buyer_confirmed).toBe(true);
    expect(txnDb.rows[0].seller_confirmed).toBe(true);
  });

  test("5. Independent Compliance Review & Closing Approval", async ({ page, context }) => {
    // Seed Reviewer user
    const reviewerActor = await seedUserAndSession(context, "REVIEWER", `flow5_rev_${runId}`);
    reviewerUserId = reviewerActor.user.id;
    reviewerEmail = reviewerActor.email;

    // Authenticate as Reviewer to approve transaction
    await attachUserSession(context, reviewerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const reviewRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: "APPROVED",
            notes: "Statutory filings, escrow agreement, and condition precedent satisfaction verified.",
          }),
        });
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(reviewRes.success).toBe(true);

    // Verify status is READY_FOR_CLOSING
    const txnDb = await dbQuery<{ status: string; reviewer_approved: boolean }>(
      `SELECT status, reviewer_approved FROM transactions WHERE id = $1`,
      [transactionId]
    );
    expect(txnDb.rows[0].status).toBe("READY_FOR_CLOSING");
    expect(txnDb.rows[0].reviewer_approved).toBe(true);
  });

  test("6. Atomic Closing Execution and Immutable Closing Record Generation", async ({ page, context }) => {
    // Seed Admin user
    const adminActor = await seedUserAndSession(context, "ADMIN", `flow5_adm_${runId}`);
    adminUserId = adminActor.user.id;

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check closing readiness
    const readinessRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/closing-readiness`);
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(readinessRes.success).toBe(true);
    const isReady = readinessRes.data.readiness?.isReadyForClosing ?? readinessRes.data.isReadyForClosing;
    expect(isReady).toBe(true);

    // Admin executes atomic closing
    const closeRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationStatement: "Formal acquisition executed under Indian Law." }),
        });
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(closeRes.success).toBe(true);

    // Verify transaction status is CLOSED
    const txnDb = await dbQuery<{ status: string; closed_at: string }>(
      `SELECT status, closed_at FROM transactions WHERE id = $1`,
      [transactionId]
    );
    expect(txnDb.rows[0].status).toBe("CLOSED");
    expect(txnDb.rows[0].closed_at).toBeDefined();

    // Verify Immutable Closing Record
    const recordRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/closing-record`);
        return await res.json();
      },
      { txnId: transactionId }
    );
    expect(recordRes.success).toBe(true);
    const closingRef = recordRes.data.closingRecord.closing_reference || recordRes.data.closingRecord.closingReference;
    expect(closingRef).toMatch(/^(CLOSE|CLR)-\d{4}-\d+$/);
    expect(recordRes.data.closingRecord.audit_reference || recordRes.data.closingRecord.document_hashes).toBeDefined();

    // 7. Post-Closing Immutability Verification: Tamper attempts are strictly rejected
    const tamperRes = await page.evaluate(
      async ({ txnId }) => {
        const res = await fetch(`/api/v1/transactions/${txnId}/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Post-closing tamper attempt." }),
        });
        return { status: res.status, data: await res.json() };
      },
      { txnId: transactionId }
    );
    expect(tamperRes.status).toBeGreaterThanOrEqual(400);
    expect(tamperRes.data.success).toBe(false);
  });
});
