// Scale-up India — Phase 13: Valuation Engine & Verified Valuation Workspace Test Suite
// Path: tests/valuation_workflow.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import { submitEOI, acceptEOI } from "@/domains/eoi/service";
import { initiateNDA, acceptNDA } from "@/domains/dataroom/service";
import { createMOU, acceptMOU } from "@/domains/mou/service";
import {
  createPaymentIntent,
  processProviderWebhook,
  resetPaymentRateLimits,
} from "@/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
} from "@/domains/payments/provider";
import {
  createDiligenceCase,
  getChecklistItems,
  uploadEvidenceDocument,
  createFinding,
} from "@/domains/diligence/service";
import {
  createValuationCase,
  getValuationCaseById,
  getValuationVersionDetail,
  listValuationCases,
  addValuationInput,
  addValuationAdjustment,
  addValuationComparable,
  updateValuationModel,
  createValuationVersion,
  submitValuationVersion,
  reviewValuationVersion,
  lockValuationVersion,
  getSellerValuationSummary,
} from "@/domains/valuation/service";
import {
  calculateRevenueMultiple,
  calculateEBITDAMultiple,
  calculateDCF,
  calculateAssetBased,
  calculateComparableAnalysis,
  calculateBlendedValuation,
  calculateValuationRange,
  evaluateValuationConfidence,
  normalizeFinancialValue,
} from "@/domains/valuation/calculator";
import { AuthenticatedUser } from "@/types/auth";
import {
  CalculationError,
  NotFoundError,
  ForbiddenError,
  ValuationGateError,
  InvalidValuationStateError,
  ValuationLockedError,
} from "@/lib/errors";

describe("Phase 13: Valuation Engine & Verified Valuation Workspace", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let reviewer1: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let mou1AcceptedId: string;
  let diligenceCase1Id: string;
  let evidence1Id: string;
  let finding1Id: string;
  let testProvider: TestSimulatedPaymentProvider;

  const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

  // Valid 1KB PDF buffer starting with magic bytes '%PDF-1.4\n'
  const createValidPdfBuffer = (label = "Test Document") => {
    const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
    const body = Buffer.from(`1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
    return Buffer.concat([header, body]);
  };

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_PAYMENT_PROVIDER = "true";
    resetPaymentRateLimits();
    await resetTestDb();

    testProvider = paymentProviderRegistry.getTestProvider();

    // 1. Seller 1 (Apex Engineering)
    const regSeller1 = await registerUser({
      email: "seller1.p13@apexeng.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p13@apexeng.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p13@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p13@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Buyer 1 (Alpha Strategic Investments)
    const regBuyer1 = await registerUser({
      email: "buyer1.p13@alphainvest.in",
      firstName: "Rajesh",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer1 = regBuyer1.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Alpha Strategic Investments Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
        'Rajesh Kapoor', 'Managing Director', 'buyer1.p13@alphainvest.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Buyer 2 (Beta Capital - Unrelated Buyer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p13@betacapital.in",
      firstName: "Pooja",
      lastName: "Bansal",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer2 = regBuyer2.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'FINANCIAL_SPONSOR', 'Beta Growth Capital LLP', 'LLP', 'Karnataka', 'Bengaluru',
        'Pooja Bansal', 'Partner', 'buyer2.p13@betacapital.in', '+919876541123', 'VERIFIED', 'Technology'
      )`,
      [buyer2.id]
    );

    // 5. Reviewer 1 (Independent Valuation Reviewer / Deal Lead)
    const regRev1 = await registerUser({
      email: "reviewer1.p13@scaleup.in",
      firstName: "Karan",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    reviewer1 = {
      ...regRev1.user,
      roles: ["REVIEWER"],
      permissions: [
        "valuation.create",
        "valuation.read_all",
        "valuation.read_sensitive",
        "valuation.update",
        "valuation.submit",
        "valuation.review",
        "valuation.approve",
        "valuation.lock",
      ],
    };

    // 6. Admin
    const regAdmin = await registerUser({
      email: "admin.p13@scaleup.in",
      firstName: "Super",
      lastName: "Admin",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN", "ADMIN"],
      permissions: [
        "opportunities.read_all",
        "opportunities.review",
        "mou.manage",
        "payments.manage",
        "diligence.read_all",
        "diligence.manage",
        "valuation.create",
        "valuation.read_all",
        "valuation.read_sensitive",
        "valuation.update",
        "valuation.submit",
        "valuation.review",
        "valuation.approve",
        "valuation.lock",
      ],
    };

    // 7. Create and Publish Opportunity 1 (Apex Engineering)
    const opp1 = await createOpportunity(seller1, {
      title: "Apex Precision Aerospace Ltd",
      headline: "AS9100 Certified Avionics Component Facility",
      teaserSummary: "High-precision manufacturing facility with multi-year tier-1 aerospace contracts.",
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
    });
    await submitOpportunity(opp1.id, seller1);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
    opp1PublishedId = pubOpp1.id;

    // 8. Execute Precondition Chain for Diligence Case 1:
    // EOI -> NDA -> MOU -> Escrow Payment -> Diligence Case
    const eoi1 = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Interested in evaluating complete buyout of aerospace asset.",
    });
    await acceptEOI(seller1, eoi1.id, {
      sellerResponseMessage: "Accepted for bilateral NDA & diligence exchange.",
    });

    const initNda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });

    const proposedMOU = await createMOU(buyer1, opp1PublishedId, {
      ndaId: executedNda.id,
      submitImmediately: true,
      terms: {
        proposedValuation: 55000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 55000000,
        equityConsideration: 0,
        earnestDepositAmount: AUTHORITATIVE_EARNEST_AMOUNT,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        validityDays: 14,
      },
    });

    const acceptedMOU = await acceptMOU(seller1, proposedMOU.id, {
      confirmed: true,
    });
    mou1AcceptedId = acceptedMOU.id;

    // Escrow Earnest Payment
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_p13_val_setup_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    // Initialize Diligence Case
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {
      scopeDescription: "Valuation pre-requisite DD case",
    });
    diligenceCase1Id = ddCase.id;

    // Upload an evidence document to DD Case 1
    const items = await getChecklistItems(seller1, diligenceCase1Id);
    const pdfBuf = createValidPdfBuffer("FY24 Audited Balance Sheet");
    const evidenceRes = await uploadEvidenceDocument(
      seller1,
      diligenceCase1Id,
      {
        originalFilename: "fy24_audited_financials.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuf,
      },
      {
        checklistItemId: items[0]?.id || "00000000-0000-0000-0000-000000000001",
        title: "Audited Financial Statement FY23-24",
        category: "FINANCIAL",
      }
    );
    evidence1Id = evidenceRes.id;

    // Create a finding in DD Case 1
    const findingRes = await createFinding(buyer1, diligenceCase1Id, {
      category: "FINANCIAL",
      title: "Unrecorded Working Capital Liability",
      description: "Vendor rebate dispute of ₹15 Lakhs pending adjudication.",
      severity: "HIGH",
      financialImpactEstimate: 1500000,
      remediationPlan: "Escrow indemnity holdback",
    });
    finding1Id = findingRes.id;
  });

  // =========================================================================
  // 1. PRECONDITION GATING TESTS (5 GATES)
  // =========================================================================
  describe("1. Precondition Gating (5-Gate Strict Enforcement)", () => {
    it("Gate 1: Rejects valuation if Opportunity is unpublished or non-existent", async () => {
      // Temporarily set opportunity 1 status to DRAFT
      await query(`UPDATE opportunities SET status = 'DRAFT' WHERE id = $1`, [opp1PublishedId]);

      await expect(
        createValuationCase(buyer1, diligenceCase1Id)
      ).rejects.toThrow(NotFoundError);

      // Restore
      await query(`UPDATE opportunities SET status = 'PUBLISHED' WHERE id = $1`, [opp1PublishedId]);
    });

    it("Gate 2: Rejects valuation if bilateral NDA is not executed", async () => {
      // Modify NDA status in DB to DRAFT
      await query(`UPDATE nda_agreements SET status = 'DRAFT' WHERE opportunity_id = $1`, [opp1PublishedId]);

      await expect(
        createValuationCase(buyer1, diligenceCase1Id)
      ).rejects.toThrow(ValuationGateError);
    });

    it("Gate 3: Rejects valuation if Deal Intent MOU is not accepted", async () => {
      await query(`UPDATE deal_mous SET status = 'DRAFT' WHERE opportunity_id = $1`, [opp1PublishedId]);

      await expect(
        createValuationCase(buyer1, diligenceCase1Id)
      ).rejects.toThrow(ValuationGateError);
    });

    it("Gate 4: Rejects valuation if Escrow Token Deposit is not confirmed", async () => {
      await query(
        `UPDATE token_deposits SET status = 'TOKEN_PAYMENT_PENDING' WHERE opportunity_id = $1`,
        [opp1PublishedId]
      );
      await query(
        `UPDATE payment_intents SET status = 'PENDING' WHERE opportunity_id = $1`,
        [opp1PublishedId]
      );

      await expect(
        createValuationCase(buyer1, diligenceCase1Id)
      ).rejects.toThrow(ValuationGateError);
    });

    it("Gate 5: Rejects valuation if Diligence Case is rejected", async () => {
      await query(
        `UPDATE due_diligence_cases SET status = 'REJECTED' WHERE id = $1`,
        [diligenceCase1Id]
      );

      await expect(
        createValuationCase(buyer1, diligenceCase1Id)
      ).rejects.toThrow(ValuationGateError);
    });

    it("Initiator Gate: Rejects Seller from initiating valuation case (only Buyer or Admin allowed)", async () => {
      await expect(
        createValuationCase(seller1, diligenceCase1Id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // 2. IDEMPOTENT CREATION & IDOR PROTECTION
  // =========================================================================
  describe("2. Idempotent Creation & Anti-IDOR Authorization", () => {
    it("Creates valuation case and initializes Version 1 (V1) in DRAFT state", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id, {
        notes: "Acquisition target valuation model V1",
      });

      expect(valCase.id).toBeDefined();
      expect(valCase.referenceCode).toMatch(/^VAL-/);
      expect(valCase.status).toBe("DRAFT");
      expect(valCase.currentVersionNumber).toBe(1);
      expect(valCase.activeVersion).toBeDefined();
      expect(valCase.activeVersion?.versionNumber).toBe(1);
      expect(valCase.activeVersion?.status).toBe("DRAFT");
    });

    it("Idempotent creation: calling create twice returns existing case without duplicate rows", async () => {
      const case1 = await createValuationCase(buyer1, diligenceCase1Id);
      const case2 = await createValuationCase(buyer1, diligenceCase1Id);

      expect(case1.id).toBe(case2.id);
      expect(case1.referenceCode).toBe(case2.referenceCode);

      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM valuation_cases WHERE diligence_case_id = $1`,
        [diligenceCase1Id]
      );
      expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
    });

    it("Anti-IDOR: Unrelated Buyer 2 is strictly blocked from accessing Valuation Case", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      await expect(
        getValuationCaseById(buyer2, valCase.id)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        getValuationVersionDetail(buyer2, valCase.id, 1)
      ).rejects.toThrow(ForbiddenError);
    });

    it("Anti-IDOR: Unrelated Buyer 2 cannot list or mutate Buyer 1 valuation case", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      const listRes = await listValuationCases(buyer2);
      expect(listRes.items.length).toBe(0);

      await expect(
        addValuationInput(buyer2, valCase.id, {
          metricName: "REVENUE",
          rawValue: 120000000,
          currency: "INR",
          unit: "INR",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // 3. METHODOLOGY CALCULATOR TESTS & EDGE CASES
  // =========================================================================
  describe("3. Deterministic Calculator & Math Safety Invariants", () => {
    it("Revenue Multiple: computes EV and Net Debt adjusted Equity Value", () => {
      const res = calculateRevenueMultiple(
        120000000, // ₹12 Cr
        1.5,
        20000000, // ₹2 Cr
        5000000, // ₹50 L
        "FY2023-24"
      );

      expect(res.enterpriseValue).toBe(180000000); // 12 Cr * 1.5 = 18 Cr
      expect(res.equityValue).toBe(165000000); // 18 Cr - 2 Cr + 50 L = 16.5 Cr
    });

    it("EBITDA Multiple: normal positive EBITDA computes EV and Equity Value", () => {
      const res = calculateEBITDAMultiple(
        28000000, // ₹2.8 Cr
        6.0,
        20000000,
        5000000,
        "FY2023-24"
      );

      expect(res.isNegativeEbitdaUnsuitable).toBe(false);
      expect(res.enterpriseValue).toBe(168000000); // 2.8 Cr * 6 = 16.8 Cr
      expect(res.equityValue).toBe(153000000);
    });

    it("EBITDA Multiple Edge Case: EBITDA <= 0 triggers controlled non-fabrication guard", () => {
      const negativeRes = calculateEBITDAMultiple(
        -5000000,
        5.0,
        10000000,
        2000000,
        "FY2023-24"
      );

      expect(negativeRes.isNegativeEbitdaUnsuitable).toBe(true);
      expect(negativeRes.enterpriseValue).toBeNull();
      expect(negativeRes.equityValue).toBeNull();
      expect(negativeRes.message).toContain("unsuitable");

      const zeroRes = calculateEBITDAMultiple(
        0,
        5.0,
        10000000,
        2000000,
        "FY2023-24"
      );

      expect(zeroRes.isNegativeEbitdaUnsuitable).toBe(true);
      expect(zeroRes.enterpriseValue).toBeNull();
    });

    it("DCF Model: computes projection PVs, terminal value, and enterprise value", () => {
      const res = calculateDCF({
        projectionYears: [
          { year: 1, projectedRevenue: 115000000, ebitdaMarginPct: 20 },
          { year: 2, projectedRevenue: 132000000, ebitdaMarginPct: 20 },
          { year: 3, projectedRevenue: 152000000, ebitdaMarginPct: 20 },
        ],
        waccPct: 14,
        terminalGrowthRatePct: 4,
        totalDebt: 10000000,
        cashAndEquivalents: 5000000,
      });

      expect(res.validationStatus).toBe("VALID");
      expect(res.projectionYears.length).toBe(3);
      expect(res.sumPvCashFlows).toBeGreaterThan(0);
      expect(res.terminalValue).toBeGreaterThan(0);
      expect(res.pvTerminalValue).toBeGreaterThan(0);
      expect(res.enterpriseValue).toBe(res.sumPvCashFlows + res.pvTerminalValue);
      expect(res.equityValue).toBe(res.enterpriseValue - 10000000 + 5000000);
    });

    it("DCF Model Edge Case: WACC <= terminal growth triggers INVALID_WACC_TERMINAL_GROWTH guard", () => {
      const invalidRes = calculateDCF({
        projectionYears: [
          { year: 1, projectedRevenue: 115000000, ebitdaMarginPct: 20 },
        ],
        waccPct: 5,
        terminalGrowthRatePct: 6, // g > WACC
        totalDebt: 10000000,
        cashAndEquivalents: 5000000,
      });

      expect(invalidRes.validationStatus).toBe("INVALID_WACC_TERMINAL_GROWTH");
      expect(invalidRes.enterpriseValue).toBe(0);
      expect(invalidRes.validationMessage).toContain("strictly greater");
    });

    it("Asset-Based Valuation: computes Net Asset Value with additions and risk haircuts", () => {
      const res = calculateAssetBased(90000000, 30000000, [
        { adjustment_type: "ASSET_ADDITION", amount: 10000000 } as any,
        { adjustment_type: "LIABILITY_ADDITION", amount: 5000000 } as any,
        { adjustment_type: "RISK_HAIRCUT", amount: 2000000 } as any,
      ]);

      expect(res.adjustedAssets).toBe(98000000); // 90 + 10 - 2
      expect(res.adjustedLiabilities).toBe(35000000); // 30 + 5
      expect(res.netAssetValue).toBe(63000000); // 98 - 35
      expect(res.enterpriseValue).toBe(63000000);
      expect(res.equityValue).toBe(63000000);
    });

    it("Comparable Companies: computes sector median/avg and handles empty comparables", () => {
      const comps: any[] = [
        {
          id: "1",
          company_name: "Peer Alpha",
          revenue: 100000000,
          ebitda: 20000000,
          implied_ev: 120000000,
          revenue_multiple: 1.2,
          ebitda_multiple: 6.0,
        },
        {
          id: "2",
          company_name: "Peer Beta",
          revenue: 150000000,
          ebitda: 30000000,
          implied_ev: 210000000,
          revenue_multiple: 1.4,
          ebitda_multiple: 7.0,
        },
      ];

      const res = calculateComparableAnalysis(
        comps,
        120000000,
        28000000,
        "REVENUE",
        20000000,
        5000000
      );

      expect(res.status).toBe("AVAILABLE");
      expect(res.comparablesCount).toBe(2);
      expect(res.medianRevenueMultiple).toBe(1.3);
      expect(res.averageRevenueMultiple).toBe(1.3);
      expect(res.enterpriseValue).toBe(156000000); // 120M * 1.3
      expect(res.equityValue).toBe(141000000);

      // Empty comparables test
      const emptyRes = calculateComparableAnalysis([], 120000000, 28000000, "REVENUE", 20000000, 5000000);
      expect(emptyRes.status).toBe("INSUFFICIENT_COMPARABLE_DATA");
      expect(emptyRes.enterpriseValue).toBeNull();
    });

    it("Blended Valuation: weights must sum to 100% and correctly calculates weighted EV", () => {
      const outputs = [
        { methodology: "REVENUE_MULTIPLE", enterpriseValue: 180000000, equityValue: 165000000 },
        { methodology: "EBITDA_MULTIPLE", enterpriseValue: 168000000, equityValue: 153000000 },
        { methodology: "DISCOUNTED_CASH_FLOW", enterpriseValue: 160000000, equityValue: 145000000 },
      ];

      const blended = calculateBlendedValuation(outputs, {
        REVENUE_MULTIPLE: 0.2,
        EBITDA_MULTIPLE: 0.5,
        DISCOUNTED_CASH_FLOW: 0.3,
      });

      // Expected EV: (180 * 0.2) + (168 * 0.5) + (160 * 0.3) = 36 + 84 + 48 = 168M
      expect(blended.blendedEnterpriseValue).toBe(168000000);
      expect(blended.blendedEquityValue).toBe(153000000);

      // Rejects invalid weights not summing to 1.0
      expect(() =>
        calculateBlendedValuation(outputs, {
          REVENUE_MULTIPLE: 0.5,
          EBITDA_MULTIPLE: 0.6, // sum = 1.1 != 1.0
        })
      ).toThrow(CalculationError);
    });

    it("Unit Normalization: correctly converts CRORE, LAKH, THOUSAND, INR to exact numbers", () => {
      expect(normalizeFinancialValue(12, "CRORE")).toBe(120000000);
      expect(normalizeFinancialValue(45, "LAKH")).toBe(4500000);
      expect(normalizeFinancialValue(150, "THOUSAND")).toBe(150000);
      expect(normalizeFinancialValue(500000, "INR")).toBe(500000);
    });
  });

  // =========================================================================
  // 4. WORKSPACE WORKFLOW: INPUTS, FINDINGS, AND RECALCULATION
  // =========================================================================
  describe("4. Workspace Workflow: Inputs, Findings Adjustments, and Provenance", () => {
    it("Adds inputs linked to Diligence Evidence with VERIFIED provenance", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      // Add Revenue linked to evidence
      const verAfterRev = await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
        sourcePeriod: "FY2023-24",
        provenanceType: "DILIGENCE_EVIDENCE",
        evidenceId: evidence1Id,
        qualityFlag: "VERIFIED",
        notes: "Audited revenue from FY24 balance sheet",
      });

      const revInput = verAfterRev.inputs.find((i) => i.metricName === "REVENUE")!;
      expect(revInput.provenanceType).toBe("DILIGENCE_EVIDENCE");
      expect(revInput.qualityFlag).toBe("VERIFIED");
      expect(revInput.normalizedValue).toBe(120000000);

      // Add Manual Input (unverified)
      const verAfterManual = await addValuationInput(buyer1, valCase.id, {
        metricName: "PROJECTED_GROWTH",
        rawValue: 15,
        currency: "INR",
        unit: "INR",
        provenanceType: "MANUAL_INPUT",
        qualityFlag: "MANUAL_INPUT",
        notes: "Buyer conservative growth assumption",
      });

      const manualInput = verAfterManual.inputs.find((i) => i.metricName === "PROJECTED_GROWTH")!;
      expect(manualInput.provenanceType).toBe("MANUAL_INPUT");
      expect(manualInput.qualityFlag).toBe("MANUAL_INPUT");
    });

    it("Adds adjustment linked to Phase 12 Diligence Finding", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      const verAfterAdj = await addValuationAdjustment(buyer1, valCase.id, {
        adjustmentType: "RISK_HAIRCUT",
        title: "Vendor Dispute Liability Holdback",
        amount: 1500000,
        currency: "INR",
        rationale: "Unrecorded disputed vendor rebate identified in technical diligence.",
        sourceFindingId: finding1Id,
      });

      const adj = verAfterAdj.adjustments.find((a) => a.title === "Vendor Dispute Liability Holdback")!;
      expect(adj.sourceFindingId).toBe(finding1Id);
      expect(adj.amount).toBe(1500000);
    });

    it("Adds market comparable company and automatically recalculates version model", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      // Add revenue and EBITDA
      await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
        sourcePeriod: "FY2023-24",
        evidenceId: evidence1Id,
      });
      await addValuationInput(buyer1, valCase.id, {
        metricName: "EBITDA",
        rawValue: 28000000,
        currency: "INR",
        unit: "INR",
        sourcePeriod: "FY2023-24",
        evidenceId: evidence1Id,
      });

      // Add Comparable
      const verAfterComp = await addValuationComparable(buyer1, valCase.id, {
        companyName: "Precision Aero Components Ltd",
        sector: "MANUFACTURING",
        period: "FY2023-24",
        revenue: 150000000,
        ebitda: 35000000,
        impliedEv: 220000000,
        source: "BSE filings",
        confidence: "HIGH",
      });

      const comp = verAfterComp.comparables.find((c) => c.companyName === "Precision Aero Components Ltd")!;
      expect(comp.companyName).toBe("Precision Aero Components Ltd");
      expect(comp.revenueMultiple).toBeCloseTo(1.47, 1);

      // Verify active version calculation results updated
      const updatedCase = await getValuationCaseById(buyer1, valCase.id);
      expect(updatedCase.activeVersion?.calculationResults).toBeDefined();
      expect(updatedCase.activeVersion?.calculationResults.range.baseEnterpriseValue).toBeGreaterThan(0);
    });

    it("Updates valuation model methodology configurations across scenarios", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
        sourcePeriod: "FY2023-24",
      });
      await addValuationInput(buyer1, valCase.id, {
        metricName: "EBITDA",
        rawValue: 28000000,
        currency: "INR",
        unit: "INR",
        sourcePeriod: "FY2023-24",
      });

      const updatedVer = await updateValuationModel(buyer1, valCase.id, {
        methodologyConfigs: {
          revenueMultiple: {
            enabled: true,
            conservativeMultiple: 1.2,
            baseMultiple: 1.5,
            optimisticMultiple: 1.8,
          },
          ebitdaMultiple: {
            enabled: true,
            conservativeMultiple: 5.0,
            baseMultiple: 6.0,
            optimisticMultiple: 7.0,
          },
          dcf: {
            enabled: true,
            projectionYears: [
              { year: 1, projectedRevenue: 115000000, ebitdaMarginPct: 20 },
              { year: 2, projectedRevenue: 132000000, ebitdaMarginPct: 20 },
              { year: 3, projectedRevenue: 152000000, ebitdaMarginPct: 20 },
            ],
            waccPct: 14,
            terminalGrowthRatePct: 4,
          },
          blended: {
            enabled: true,
            weights: {
              REVENUE_MULTIPLE: 0.2,
              EBITDA_MULTIPLE: 0.5,
              DISCOUNTED_CASH_FLOW: 0.3,
            },
          },
        },
      });

      expect(updatedVer.calculationResults.scenarios.BASE.ebitdaMultiple).toBeDefined();
      expect(updatedVer.calculationResults.scenarios.BASE.dcf).toBeDefined();
      expect(updatedVer.calculationResults.blended).toBeDefined();
      expect(updatedVer.confidenceScore).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // 5. IMMUTABLE VERSIONING & STATE MACHINE
  // =========================================================================
  describe("5. Immutable Versioning & Governance State Machine", () => {
    it("Submits version V1: transitions status from DRAFT to SUBMITTED", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
      });

      const submittedVer = await submitValuationVersion(buyer1, valCase.id, {
        notes: "V1 ready for investment committee review.",
      });

      expect(submittedVer.status).toBe("SUBMITTED");
      expect(submittedVer.submittedAt).toBeDefined();

      const updatedCase = await getValuationCaseById(buyer1, valCase.id);
      expect(updatedCase.status).toBe("SUBMITTED");
    });

    it("Locked mutation guard: cannot add inputs or adjustments to a SUBMITTED version", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      await submitValuationVersion(buyer1, valCase.id, {
        notes: "Submitted for formal approval.",
      });

      await expect(
        addValuationInput(buyer1, valCase.id, {
          metricName: "REVENUE",
          rawValue: 100000000,
          currency: "INR",
          unit: "INR",
        })
      ).rejects.toThrow(ValuationLockedError);

      await expect(
        addValuationAdjustment(buyer1, valCase.id, {
          adjustmentType: "RISK_HAIRCUT",
          title: "Late Adjustment",
          amount: 500000,
          currency: "INR",
          rationale: "Should fail",
        })
      ).rejects.toThrow(ValuationLockedError);
    });

    it("Creates new version V2: increments version number and keeps V1 immutable", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
      });

      await submitValuationVersion(buyer1, valCase.id, {
        notes: "V1 completed",
      });

      // Create Version 2
      const ver2 = await createValuationVersion(buyer1, valCase.id, {
        title: "V2 with updated tax assumptions",
      });

      expect(ver2.versionNumber).toBe(2);
      expect(ver2.status).toBe("DRAFT");

      const caseOverview = await getValuationCaseById(buyer1, valCase.id);
      expect(caseOverview.currentVersionNumber).toBe(2);
      expect(caseOverview.versionCount).toBe(2);

      // Verify V1 is still SUBMITTED and untouched
      const ver1 = await getValuationVersionDetail(buyer1, valCase.id, 1);
      expect(ver1.status).toBe("SUBMITTED");
    });
  });

  // =========================================================================
  // 6. ANTI-SELF-APPROVAL & GOVERNANCE WORKFLOW
  // =========================================================================
  describe("6. Anti-Self-Approval & Governance Review", () => {
    it("Anti-self-approval: creator (Buyer 1) CANNOT approve their own valuation version", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);
      await submitValuationVersion(buyer1, valCase.id);

      await expect(
        reviewValuationVersion(buyer1, valCase.id, {
          decision: "APPROVED",
          notes: "Self approval attempt should be strictly blocked.",
        })
      ).rejects.toThrow(ValuationGateError);
    });

    it("Seller CANNOT review or approve Buyer's valuation model", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);
      await submitValuationVersion(buyer1, valCase.id);

      await expect(
        reviewValuationVersion(seller1, valCase.id, {
          decision: "APPROVED",
          notes: "Seller approving buyer valuation should be blocked.",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("Independent Reviewer reviews and approves valuation version (UNDER_REVIEW -> APPROVED)", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);
      await submitValuationVersion(buyer1, valCase.id);

      // 1. Begin review
      const reviewingVer = await reviewValuationVersion(reviewer1, valCase.id, {
        decision: "UNDER_REVIEW",
        notes: "Initiating peer technical audit.",
      });
      expect(reviewingVer.status).toBe("UNDER_REVIEW");

      // 2. Approve
      const approvedVer = await reviewValuationVersion(reviewer1, valCase.id, {
        decision: "APPROVED",
        notes: "Methodologies, WACC, and evidence provenance verified.",
      });
      expect(approvedVer.status).toBe("APPROVED");
      expect(approvedVer.approvedAt).toBeDefined();
    });

    it("Lock workflow: Admin or Lead locks approved version (APPROVED -> LOCKED)", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);
      await submitValuationVersion(buyer1, valCase.id);
      await reviewValuationVersion(reviewer1, valCase.id, {
        decision: "APPROVED",
        notes: "Pre-lock approval by reviewer.",
      });

      const lockedVer = await lockValuationVersion(admin, valCase.id, {
        lockReason: "Final baseline approved for binding share purchase agreement negotiation.",
      });

      expect(lockedVer.status).toBe("LOCKED");
      expect(lockedVer.lockedAt).toBeDefined();

      const caseOverview = await getValuationCaseById(buyer1, valCase.id);
      expect(caseOverview.status).toBe("LOCKED");
    });
  });

  // =========================================================================
  // 7. PROGRESSIVE DISCLOSURE FOR SELLER
  // =========================================================================
  describe("7. Progressive Disclosure for Seller (Masked Proprietary Assumptions)", () => {
    it("Seller summary masks buyer internal notes and raw risk haircuts while exposing indicative range", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id, {
        notes: "Confidential internal note: target has high customer concentration.",
      });

      await addValuationInput(buyer1, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
        notes: "Internal note on revenue quality.",
      });

      await addValuationAdjustment(buyer1, valCase.id, {
        adjustmentType: "RISK_HAIRCUT",
        title: "Internal Contingency Reserve",
        amount: 2000000,
        currency: "INR",
        rationale: "Aggressive bargaining margin.",
      });

      // Seller fetches progressive disclosure summary
      const sellerSummary = await getSellerValuationSummary(seller1, valCase.id);

      expect(sellerSummary.caseId).toBe(valCase.id);
      expect(sellerSummary.referenceCode).toBe(valCase.referenceCode);
      expect(sellerSummary.indicativeValuationRange).toBeDefined();
      expect(sellerSummary.confidenceLevel).toBeDefined();

      // Seller fetches overview: notes are masked to null
      const sellerOverview = await getValuationCaseById(seller1, valCase.id);
      expect(sellerOverview.notes).toBeNull();
      expect(sellerOverview.userRole).toBe("SELLER");

      // Seller fetches version detail: input and reviewer notes are masked
      const sellerVerDetail = await getValuationVersionDetail(seller1, valCase.id, 1);
      expect(sellerVerDetail.inputs[0].notes).toBeNull();
      expect(sellerVerDetail.reviewerNotes).toBeNull();
    });
  });

  // =========================================================================
  // 8. AUDIT LOGGING & NOTIFICATIONS
  // =========================================================================
  describe("8. Audit Logging & In-App Notifications", () => {
    it("Generates immutable audit logs and counterparty notifications on key actions", async () => {
      const valCase = await createValuationCase(buyer1, diligenceCase1Id);

      // Verify audit log for workspace creation
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE resource_id = $1`,
        [valCase.id]
      );
      expect(auditRes.rows.some((r) => r.action === "VALUATION_CASE_CREATED" || r.action === "VALUATION_WORKSPACE_CREATED")).toBe(true);

      // Verify notification sent to seller
      const notifRes = await query<{ type: string; user_id: string }>(
        `SELECT type, user_id FROM in_app_notifications WHERE resource_id = $1`,
        [valCase.id]
      );
      expect(notifRes.rows.some((r) => r.type === "VALUATION_WORKSPACE_CREATED" && r.user_id === seller1.id)).toBe(true);

      // Submit and verify submission audit log
      await submitValuationVersion(buyer1, valCase.id);
      const submitAuditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE action = 'VALUATION_VERSION_SUBMITTED'`
      );
      expect(submitAuditRes.rows.length).toBeGreaterThan(0);
    });
  });
});
