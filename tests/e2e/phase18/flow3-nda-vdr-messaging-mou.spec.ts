// Scale-up India — Phase 18 Playwright E2E: FLOW 3
// Flow 3: Bilateral Interest -> NDA Workspace -> VDR Access & Downloads -> Deal Messaging -> MOU Proposal, Counter & Acceptance
// Path: tests/e2e/phase18/flow3-nda-vdr-messaging-mou.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  seedUserAndSession,
  attachUserSession,
  createTestPdfBuffer,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("FLOW 3 — NDA Workspace, VDR Access, Deal Messaging & MOU Negotiations", () => {
  const runId = crypto.randomUUID().slice(0, 6);
  let buyerUserId: string;
  let buyerEmail: string;
  let sellerUserId: string;
  let sellerEmail: string;
  let opportunityId: string;
  let eoiId: string;
  let ndaId: string;
  let dataRoomId: string;
  let documentId: string;
  let conversationId: string;
  let mouId: string;

  test("1. Setup bilateral prerequisite: Verified Opportunity and Accepted EOI", async ({ context }) => {
    // 1. Seed Seller
    const seller = await seedUserAndSession(context, "PROMOTER", `flow3_s_${runId}`);
    sellerUserId = seller.user.id;
    sellerEmail = seller.email;

    const spRes = await dbQuery<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Promoter & MD', '+919812345678', $2, 'VERIFIED')
       ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [sellerUserId, sellerEmail]
    );
    const sellerProfileId = spRes.rows[0].id;

    // 2. Seed Published Opportunity
    const oppSeqRes = await dbQuery<{ seq: string }>(`SELECT nextval('opportunity_ref_seq') as seq`);
    const oppRef = `OPP-${new Date().getFullYear()}-${String(oppSeqRes.rows[0]?.seq || "1001").padStart(4, "0")}`;

    const oppRes = await dbQuery<{ id: string }>(
      `INSERT INTO opportunities (
        reference_code, user_id, seller_profile_id, title, headline, teaser_summary,
        business_category, industry, sub_sector, operating_region, registered_state,
        approximate_age_bracket, revenue_bracket, transaction_type, business_model,
        ebitda_margin_bracket, asking_price_bracket, exact_legal_name, exact_cin,
        exact_gstin, exact_pan, exact_address, status
      ) VALUES (
        $1, $2, $3, 'AeroDyn Technologies Pvt Ltd', 'Aerospace Machining Facility in Pune',
        'Tier 1 AS9100 certified precision machining plant with 10-year defense contracts.',
        'MANUFACTURING', 'Precision Engineering', 'Aerospace Components', 'WEST_INDIA', 'Maharashtra',
        '10_TO_20_YRS', '50CR_TO_100CR', 'FULL_ACQUISITION', 'B2B',
        '20_TO_30_PCT', '50CR_TO_100CR', 'AeroDyn Technologies Pvt Ltd', 'U29299MH2011PTC087654',
        '27AABCA5555F1Z2', 'AABCA5555F', 'Plot 88, Chakan MIDC, Pune', 'PUBLISHED'
      ) RETURNING id`,
      [oppRef, sellerUserId, sellerProfileId]
    );
    opportunityId = oppRes.rows[0].id;

    // 3. Seed Buyer
    const buyer = await seedUserAndSession(context, "BUYER", `flow3_b_${runId}`);
    buyerUserId = buyer.user.id;
    buyerEmail = buyer.email;

    const bpRes = await dbQuery<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, trade_name, entity_type,
        contact_name, designation, email, phone, state, city,
        onboarding_status
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Apex Strategic Capital Partners Ltd', 'Apex Defense', 'COMPANY',
        'Kunal Deshmukh', 'Managing Partner', $2, '+919798765432', 'Maharashtra', 'Mumbai',
        'VERIFIED'
      ) ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [buyerUserId, buyerEmail]
    );
    const buyerProfileId = bpRes.rows[0].id;

    // 4. Seed Accepted Bilateral EOI
    const seqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('eoi_ref_seq') as nextval`);
    const eoiRef = `EOI-${new Date().getFullYear()}-${seqRes.rows[0]?.nextval || "10001"}`;

    const eoiDb = await dbQuery<{ id: string }>(
      `INSERT INTO expressions_of_interest (
        reference_code, opportunity_id, buyer_id, buyer_profile_id, seller_id, seller_profile_id,
        status, interest_type, proposed_transaction_type, indicative_offer_range,
        investment_timeline, buyer_message, seller_response_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'ACCEPTED', 'FULL_ACQUISITION', 'FULL_ACQUISITION', '50CR_TO_100CR',
        '1_TO_3_MONTHS', 'We express bilateral interest in acquiring 100% of AeroDyn Technologies.',
        'Seller welcomes your interest. Ready for NDA.'
      ) RETURNING id`,
      [eoiRef, opportunityId, buyerUserId, buyerProfileId, sellerUserId, sellerProfileId]
    );
    eoiId = eoiDb.rows[0].id;

    expect(opportunityId).toBeDefined();
    expect(eoiId).toBeDefined();
  });

  test("2. Buyer initiates bilateral NDA and both parties countersign to execute", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer initiates NDA
    const initRes = await page.evaluate(async ({ oppId, eoiId }) => {
      const res = await fetch(`/api/v1/opportunities/${oppId}/nda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eoiId }),
      });
      return await res.json();
    }, { oppId: opportunityId, eoiId });

    expect(initRes.success).toBe(true);
    ndaId = initRes.data.nda?.id || initRes.data.id;
    expect(ndaId).toBeDefined();

    // Buyer accepts NDA
    const buyerAcceptRes = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/buyer/ndas/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsAcknowledged: true,
          comment: "Buyer formally accepts all confidentiality covenants.",
        }),
      });
      return await res.json();
    }, ndaId);
    expect(buyerAcceptRes.success).toBe(true);

    // Verify status is BUYER_ACCEPTED
    let ndaDb = await dbQuery<{ status: string }>(`SELECT status FROM nda_agreements WHERE id = $1`, [ndaId]);
    expect(ndaDb.rows[0].status).toBe("BUYER_ACCEPTED");

    // Authenticate as Seller to countersign
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Seller countersigns NDA
    const sellerAcceptRes = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/seller/ndas/${id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termsAcknowledged: true,
          comment: "Seller countersigns NDA. VDR access provisioned.",
        }),
      });
      return await res.json();
    }, ndaId);
    expect(sellerAcceptRes.success).toBe(true);

    // Verify status is EXECUTED
    ndaDb = await dbQuery<{ status: string }>(`SELECT status FROM nda_agreements WHERE id = $1`, [ndaId]);
    expect(ndaDb.rows[0].status).toBe("EXECUTED");

    // Verify automatic Data Room creation
    const roomDb = await dbQuery<{ id: string; status: string }>(
      `SELECT id, status FROM data_rooms WHERE nda_id = $1`,
      [ndaId]
    );
    expect(roomDb.rows.length).toBe(1);
    expect(roomDb.rows[0].status).toBe("ACTIVE");
    dataRoomId = roomDb.rows[0].id;
  });

  test("3. Seller uploads confidential document to VDR and Buyer accesses it with signed URL", async ({ page, context }) => {
    // Authenticate as Seller
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Create valid PDF buffer with magic bytes %PDF-1.4
    const pdfBuffer = createTestPdfBuffer("AeroDyn Financial Statements FY2023-24");
    const pdfBase64 = pdfBuffer.toString("base64");

    // Seller uploads document via multipart formData
    const uploadRes = await page.evaluate(
      async ({ roomId, base64 }) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "Audited_Financials_FY24.pdf", { type: "application/pdf" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", "Audited Financial Statements FY24");
        formData.append("documentCategory", "FINANCIAL");
        formData.append("accessLevel", "ROOM_MEMBER");

        const res = await fetch(`/api/v1/data-rooms/${roomId}/documents`, {
          method: "POST",
          body: formData,
        });
        return await res.json();
      },
      { roomId: dataRoomId, base64: pdfBase64 }
    );

    expect(uploadRes.success).toBe(true);
    documentId = uploadRes.data.document?.id || uploadRes.data.id;
    expect(documentId).toBeDefined();

    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer views VDR document listing
    const listRes = await page.evaluate(async (roomId) => {
      const res = await fetch(`/api/v1/data-rooms/${roomId}`);
      return await res.json();
    }, dataRoomId);
    expect(listRes.success).toBe(true);

    // Buyer generates signed URL
    const signedUrlRes = await page.evaluate(
      async ({ roomId, docId }) => {
        const res = await fetch(`/api/v1/data-rooms/${roomId}/documents/${docId}/signed-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInSeconds: 300 }),
        });
        return await res.json();
      },
      { roomId: dataRoomId, docId: documentId }
    );
    expect(signedUrlRes.success).toBe(true);
    expect(signedUrlRes.data.downloadUrl).toBeDefined();

    // Negative Security Check: Third-party unauthenticated / unauthorized actor denied
    await context.clearCookies();
    const rogueActor = await seedUserAndSession(context, "BUYER", `flow3_rogue_${runId}`);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const rogueRes = await page.evaluate(
      async ({ roomId, docId }) => {
        const res = await fetch(`/api/v1/data-rooms/${roomId}/documents/${docId}/signed-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInSeconds: 300 }),
        });
        return { status: res.status, data: await res.json() };
      },
      { roomId: dataRoomId, docId: documentId }
    );
    expect(rogueRes.status).toBe(403);
    expect(rogueRes.data.success).toBe(false);
  });

  test("4. Secure Deal Messaging between Buyer and Seller", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer initiates deal conversation
    const convRes = await page.evaluate(
      async ({ oppId, ndaId }) => {
        const res = await fetch(`/api/v1/opportunities/${oppId}/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ndaId,
            title: "AeroDyn Acquisition & Due Diligence Schedule",
          }),
        });
        return await res.json();
      },
      { oppId: opportunityId, ndaId }
    );

    expect(convRes.success).toBe(true);
    conversationId = convRes.data.conversation?.id || convRes.data.id;
    expect(conversationId).toBeDefined();

    // Buyer sends message
    const buyerMsgRes = await page.evaluate(
      async ({ convId }) => {
        const res = await fetch(`/api/v1/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "Hello Vikram, we have reviewed your AS9100 quality certificates and FY24 financials. We are preparing a formal MOU proposal.",
          }),
        });
        return await res.json();
      },
      { convId: conversationId }
    );
    expect(buyerMsgRes.success).toBe(true);

    // Authenticate as Seller
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Seller reads messages and replies
    const sellerMsgRes = await page.evaluate(
      async ({ convId }) => {
        const res = await fetch(`/api/v1/conversations/${convId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "Thank you Rajesh. We welcome your commercial terms and look forward to the earnest token intent.",
          }),
        });
        return await res.json();
      },
      { convId: conversationId }
    );
    expect(sellerMsgRes.success).toBe(true);

    // Verify messages in DB
    const msgDb = await dbQuery<{ count: string }>(
      `SELECT count(*) as count FROM deal_messages WHERE conversation_id = $1`,
      [conversationId]
    );
    expect(Number(msgDb.rows[0].count)).toBeGreaterThanOrEqual(2);
  });

  test("5. Bilateral MOU Workflow: Proposal, Counter-offer, and Final Acceptance", async ({ page, context }) => {
    // Authenticate as Buyer
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer proposes MOU
    const proposeRes = await page.evaluate(
      async ({ oppId, ndaId }) => {
        const res = await fetch(`/api/v1/opportunities/${oppId}/mous`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ndaId,
            submitImmediately: true,
            terms: {
              proposedValuation: 850000000,
              currency: "INR",
              proposedStructure: "FULL_ACQUISITION",
              cashConsideration: 850000000,
              equityConsideration: 0,
              earnestDepositAmount: 8500000,
              exclusivityPeriodDays: 45,
              dueDiligenceWindowDays: 30,
              conditionsPrecedent: [
                "Satisfactory technical and financial due diligence",
                "Verified independent valuation certificate",
              ],
              keyAssumptions: "All manufacturing assets free from encumbrance.",
              summaryNotes: "Initial 100% equity purchase proposal.",
            },
          }),
        });
        return await res.json();
      },
      { oppId: opportunityId, ndaId }
    );

    expect(proposeRes.success).toBe(true);
    mouId = proposeRes.data.mou?.id || proposeRes.data.id;
    expect(mouId).toBeDefined();

    // Verify status is PROPOSED
    let mouDb = await dbQuery<{ status: string }>(`SELECT status FROM deal_mous WHERE id = $1`, [mouId]);
    expect(mouDb.rows[0].status).toBe("PROPOSED");

    // Authenticate as Seller
    await attachUserSession(context, sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Seller counters terms
    const counterRes = await page.evaluate(
      async ({ id }) => {
        const res = await fetch(`/api/v1/mous/${id}/counter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terms: {
              proposedValuation: 900000000,
              currency: "INR",
              proposedStructure: "FULL_ACQUISITION",
              cashConsideration: 900000000,
              equityConsideration: 0,
              earnestDepositAmount: 9000000,
              exclusivityPeriodDays: 45,
              dueDiligenceWindowDays: 30,
              conditionsPrecedent: [
                "Satisfactory technical and financial due diligence",
                "Verified independent valuation certificate",
              ],
              keyAssumptions: "All manufacturing assets free from encumbrance.",
              summaryNotes: "Counter proposal reflecting defense IP contracts.",
            },
          }),
        });
        return await res.json();
      },
      { id: mouId }
    );

    expect(counterRes.success).toBe(true);

    // Verify status is COUNTERED
    mouDb = await dbQuery<{ status: string }>(`SELECT status FROM deal_mous WHERE id = $1`, [mouId]);
    expect(mouDb.rows[0].status).toBe("COUNTERED");

    // Authenticate as Buyer to accept counter
    await attachUserSession(context, buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Buyer accepts countered MOU
    const acceptRes = await page.evaluate(
      async ({ id }) => {
        const res = await fetch(`/api/v1/mous/${id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmed: true,
            notes: "Buyer accepts seller counter-proposal of INR 90 Cr valuation.",
          }),
        });
        return await res.json();
      },
      { id: mouId }
    );

    expect(acceptRes.success).toBe(true);

    // Verify status is ACCEPTED
    mouDb = await dbQuery<{ status: string }>(`SELECT status FROM deal_mous WHERE id = $1`, [mouId]);
    expect(mouDb.rows[0].status).toBe("ACCEPTED");

    // Immutability Check: counter is rejected once ACCEPTED
    const tamperRes = await page.evaluate(
      async ({ id }) => {
        const res = await fetch(`/api/v1/mous/${id}/counter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            terms: {
              proposedValuation: 950000000,
              currency: "INR",
              proposedStructure: "FULL_ACQUISITION",
            },
          }),
        });
        return { status: res.status, data: await res.json() };
      },
      { id: mouId }
    );
    expect(tamperRes.status).toBeGreaterThanOrEqual(400);
    expect(tamperRes.data.success).toBe(false);
  });
});
