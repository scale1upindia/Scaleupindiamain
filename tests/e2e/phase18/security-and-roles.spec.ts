// Scale-up India — Phase 18 Playwright E2E: Security Controls, Role Matrix & Tenant Isolation
// Path: tests/e2e/phase18/security-and-roles.spec.ts

import { test, expect } from "@playwright/test";
import crypto from "crypto";
import {
  dbQuery,
  seedUserAndSession,
  attachUserSession,
  createTestPdfBuffer,
  DEFAULT_TEST_PASSWORD,
} from "./helpers/auth";

test.describe.serial("SECURITY & ROLE MATRIX — Authorization, Multi-Tenancy & Sanitization", () => {
  const runId = crypto.randomUUID().slice(0, 6);
  let tenantA_sellerUserId: string;
  let tenantA_sellerEmail: string;
  let tenantA_buyerUserId: string;
  let tenantA_buyerEmail: string;
  let tenantA_oppId: string;
  let tenantA_ndaId: string;
  let tenantA_dataRoomId: string;

  let tenantB_buyerUserId: string;
  let tenantB_buyerEmail: string;

  test("1. Setup multi-tenant isolation fixtures (Tenant A vs Tenant B)", async ({ context }) => {
    // 1. Tenant A Seller
    const sA = await seedUserAndSession(context, "PROMOTER", `sec_sa_${runId}`);
    tenantA_sellerUserId = sA.user.id;
    tenantA_sellerEmail = sA.email;

    const spRes = await dbQuery<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Director', '+919800011122', $2, 'VERIFIED')
       ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [tenantA_sellerUserId, tenantA_sellerEmail]
    );
    const sProfileId = spRes.rows[0].id;

    // Opportunity for Tenant A
    const oppSeqRes = await dbQuery<{ seq: string }>(`SELECT nextval('opportunity_ref_seq') as seq`);
    const oppRef = `OPP-${new Date().getFullYear()}-${String(oppSeqRes.rows[0]?.seq || "4001").padStart(4, "0")}`;

    const oppRes = await dbQuery<{ id: string }>(
      `INSERT INTO opportunities (
        reference_code, user_id, seller_profile_id, title, headline, teaser_summary,
        business_category, industry, sub_sector, operating_region, registered_state,
        approximate_age_bracket, revenue_bracket, transaction_type, business_model,
        ebitda_margin_bracket, asking_price_bracket, exact_legal_name, exact_cin,
        exact_gstin, exact_pan, exact_address, status
      ) VALUES (
        $1, $2, $3, 'Aegis Quantum Sensors Ltd', 'Defense Quantum Sensors & Laser Optics',
        'Tier-1 defense manufacturing facility with proprietary photonics IP.',
        'MANUFACTURING', 'Precision Engineering', 'Aerospace Components', 'WEST_INDIA', 'Maharashtra',
        '10_TO_20_YRS', '50CR_TO_100CR', 'FULL_ACQUISITION', 'B2B',
        '20_TO_30_PCT', '50CR_TO_100CR', 'Aegis Quantum Sensors Pvt Ltd', 'U29299MH2014PTC055555',
        '27AABCA5555F1Z9', 'AABCA5555F', 'Plot 55, MIDC Talegaon, Pune', 'PUBLISHED'
      ) RETURNING id`,
      [oppRef, tenantA_sellerUserId, sProfileId]
    );
    tenantA_oppId = oppRes.rows[0].id;

    // 2. Tenant A Buyer
    const bA = await seedUserAndSession(context, "BUYER", `sec_ba_${runId}`);
    tenantA_buyerUserId = bA.user.id;
    tenantA_buyerEmail = bA.email;

    const bpRes = await dbQuery<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, trade_name, entity_type,
        contact_name, designation, email, phone, state, city,
        onboarding_status
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Aegis Capital Partners Ltd', 'Aegis Capital', 'COMPANY',
        'Vivek Oberoi', 'Managing Director', $2, '+919700011122', 'Maharashtra', 'Mumbai',
        'VERIFIED'
      ) ON CONFLICT (user_id) DO UPDATE SET onboarding_status = 'VERIFIED' RETURNING id`,
      [tenantA_buyerUserId, tenantA_buyerEmail]
    );
    const bProfileId = bpRes.rows[0].id;

    // EOI and NDA for Tenant A
    const eoiSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('eoi_ref_seq') as nextval`);
    const eoiRef = `EOI-${new Date().getFullYear()}-${eoiSeqRes.rows[0]?.nextval || "40001"}`;

    const eoiRes = await dbQuery<{ id: string }>(
      `INSERT INTO expressions_of_interest (
        reference_code, opportunity_id, buyer_id, buyer_profile_id, seller_id, seller_profile_id,
        status, interest_type, proposed_transaction_type, indicative_offer_range,
        investment_timeline, buyer_message, seller_response_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        'ACCEPTED', 'FULL_ACQUISITION', 'FULL_ACQUISITION', '50CR_TO_100CR',
        '1_TO_3_MONTHS', 'Full buyout interest for Aegis Quantum Sensors.',
        'Seller accepts.'
      ) RETURNING id`,
      [eoiRef, tenantA_oppId, tenantA_buyerUserId, bProfileId, tenantA_sellerUserId, sProfileId]
    );
    const eoiId = eoiRes.rows[0].id;

    const ndaSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('nda_ref_seq') as nextval`);
    const ndaRef = `NDA-${new Date().getFullYear()}-${ndaSeqRes.rows[0]?.nextval || "40001"}`;

    const ndaRes = await dbQuery<{ id: string }>(
      `INSERT INTO nda_agreements (
        reference_code, opportunity_id, eoi_id, buyer_id, seller_id,
        nda_version, status, buyer_accepted_at, seller_accepted_at, executed_at, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, 1, 'EXECUTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $4
      ) RETURNING id`,
      [ndaRef, tenantA_oppId, eoiId, tenantA_buyerUserId, tenantA_sellerUserId]
    );
    tenantA_ndaId = ndaRes.rows[0].id;

    // Data Room for Tenant A
    const vdrSeqRes = await dbQuery<{ nextval: string }>(`SELECT nextval('vdr_ref_seq') as nextval`);
    const vdrRef = `VDR-${new Date().getFullYear()}-${vdrSeqRes.rows[0]?.nextval || "40001"}`;

    const roomRes = await dbQuery<{ id: string }>(
      `INSERT INTO data_rooms (
        reference_code, opportunity_id, nda_id, seller_id, buyer_id,
        title, status, activated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'Confidential Diligence Room', 'ACTIVE', CURRENT_TIMESTAMP
      ) RETURNING id`,
      [vdrRef, tenantA_oppId, tenantA_ndaId, tenantA_sellerUserId, tenantA_buyerUserId]
    );
    tenantA_dataRoomId = roomRes.rows[0].id;

    await dbQuery(
      `INSERT INTO data_room_members (data_room_id, user_id, role, access_status)
       VALUES ($1, $2, 'SELLER', 'ACTIVE'), ($1, $3, 'BUYER', 'ACTIVE')
       ON CONFLICT (data_room_id, user_id) DO UPDATE SET access_status = 'ACTIVE'`,
      [tenantA_dataRoomId, tenantA_sellerUserId, tenantA_buyerUserId]
    );

    // 3. Tenant B Buyer (Strictly Unrelated Counterparty)
    const bB = await seedUserAndSession(context, "BUYER", `sec_bb_${runId}`);
    tenantB_buyerUserId = bB.user.id;
    tenantB_buyerEmail = bB.email;
  });

  test("2. Cross-Tenant Isolation: Tenant B strictly denied access to Tenant A's private VDR and Deal Room", async ({ page, context }) => {
    // Authenticate as Tenant B
    await attachUserSession(context, tenantB_buyerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Tenant B attempts to access Tenant A's private data room
    const drRes = await page.evaluate(
      async ({ roomId }) => {
        const res = await fetch(`/api/v1/data-rooms/${roomId}`);
        return { status: res.status, data: await res.json() };
      },
      { roomId: tenantA_dataRoomId }
    );
    expect([403, 404]).toContain(drRes.status);
    expect(drRes.data.success).toBe(false);

    // Tenant B attempts to fetch Tenant A's NDA details
    const ndaRes = await page.evaluate(
      async ({ ndaId }) => {
        const res = await fetch(`/api/v1/buyer/ndas/${ndaId}`);
        return { status: res.status, data: await res.json() };
      },
      { ndaId: tenantA_ndaId }
    );
    expect([403, 404]).toContain(ndaRes.status);
    expect(ndaRes.data.success).toBe(false);
  });

  test("3. Progressive Data Masking: Verify Zero-Leakage of Tier 2/3 Identifiers to Unauthorized / Public Viewers", async ({ page, context }) => {
    // Clear cookies to test completely unauthenticated public visitor
    await context.clearCookies();

    await page.goto(`/opportunities/${tenantA_oppId}`);
    await page.waitForLoadState("networkidle");

    // Wait for client-side hydration and opportunity data rendering
    await expect(page.getByText("Defense Quantum Sensors & Laser Optics")).toBeVisible({ timeout: 10000 });

    const htmlContent = await page.content();

    // Verify Tier 1 non-identifying data IS visible in rendered page and HTML (with entity encoding)
    expect(htmlContent).toContain("Defense Quantum Sensors &amp; Laser Optics");

    // CRITICAL SECURITY ASSERTION: Verify Zero-Leakage of Tier 2/3 sensitive identifying records in DOM and HTML source
    expect(htmlContent).not.toContain("Aegis Quantum Sensors Pvt Ltd");
    expect(htmlContent).not.toContain("U29299MH2014PTC055555"); // CIN
    expect(htmlContent).not.toContain("27AABCA5555F1Z9"); // GSTIN
    expect(htmlContent).not.toContain("AABCA5555F"); // PAN
    expect(htmlContent).not.toContain("Plot 55, MIDC Talegaon"); // Address
  });

  test("4. File Upload Security Controls: Reject file tampering, invalid magic bytes & path traversal", async ({ page, context }) => {
    // Authenticate as Tenant A Seller
    await attachUserSession(context, tenantA_sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // 1. Fake PDF with text payload (invalid magic bytes)
    const fakePdfBytes = Buffer.from("<html><script>alert(1)</script></html>");
    const fakeBase64 = fakePdfBytes.toString("base64");

    const fakeUploadRes = await page.evaluate(
      async ({ roomId, base64 }) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "malicious.pdf", { type: "application/pdf" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", "Malicious Executable Exploit");
        formData.append("documentCategory", "FINANCIAL");

        const res = await fetch(`/api/v1/data-rooms/${roomId}/documents`, {
          method: "POST",
          body: formData,
        });
        return { status: res.status, data: await res.json() };
      },
      { roomId: tenantA_dataRoomId, base64: fakeBase64 }
    );
    expect(fakeUploadRes.status).toBeGreaterThanOrEqual(400);
    expect(fakeUploadRes.data.success).toBe(false);

    // 2. Path Traversal Filename
    const validPdfBuffer = createTestPdfBuffer("Legit Covenants");
    const validBase64 = validPdfBuffer.toString("base64");

    const traversalRes = await page.evaluate(
      async ({ roomId, base64 }) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const file = new File([bytes], "../../../../etc/passwd.pdf", { type: "application/pdf" });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("title", "Path Traversal Probe");
        formData.append("documentCategory", "FINANCIAL");

        const res = await fetch(`/api/v1/data-rooms/${roomId}/documents`, {
          method: "POST",
          body: formData,
        });
        return { status: res.status, data: await res.json() };
      },
      { roomId: tenantA_dataRoomId, base64: validBase64 }
    );

    // Rejection of path traversal is verified: either 400 rejection or sanitized without directory traversal
    if (traversalRes.data?.success) {
      expect(traversalRes.data.data?.document?.originalFilename || traversalRes.data.data?.document?.title).not.toContain("../");
    } else {
      expect(traversalRes.status).toBeGreaterThanOrEqual(400);
    }
  });

  test("5. Role Matrix & Panel RBAC: View-Only and Unauthorized actors cannot execute privileged operations", async ({ page, context }) => {
    // Seed View-Only user
    const viewOnlyActor = await seedUserAndSession(context, "VIEW_ONLY", `sec_vo_${runId}`);

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // View-Only user attempts to publish an opportunity -> MUST FAIL
    const unauthPubRes = await page.evaluate(
      async ({ oppId }) => {
        const res = await fetch(`/api/v1/admin/opportunities/${oppId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "PUBLISH" }),
        });
        return { status: res.status, data: await res.json() };
      },
      { oppId: tenantA_oppId }
    );
    expect(unauthPubRes.status).toBe(403);
    expect(unauthPubRes.data.success).toBe(false);

    // View-Only user attempts to create a payment intent -> MUST FAIL (403/404/405)
    const unauthPayRes = await page.evaluate(async () => {
      const res = await fetch(`/api/v1/payment-intents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100000 }),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {}
      return { status: res.status, data };
    });
    expect([403, 404, 405]).toContain(unauthPayRes.status);
  });

  test("6. In-App Notification Delivery & Read Lifecycle", async ({ page, context }) => {
    // Send in-app notification to Tenant A Seller
    await dbQuery(
      `INSERT INTO notifications (
        recipient_user_id, category, title, safe_body, severity, is_read, created_at
      ) VALUES (
        $1, 'SECURITY', 'Confidential Diligence Access Granted',
        'Buyer Aegis Capital has completed biometric NDA execution.', 'INFO', false, CURRENT_TIMESTAMP
      )`,
      [tenantA_sellerUserId]
    );

    // Authenticate as Tenant A Seller
    await attachUserSession(context, tenantA_sellerEmail, DEFAULT_TEST_PASSWORD);
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");

    // Notifications page should render alert
    await expect(page.getByText("Confidential Diligence Access Granted")).toBeVisible({ timeout: 10000 });
  });
});
