// Scale-up India — Phase 13: Valuation Engine & Verified Valuation Workspace Security Gate
// Script: scripts/phase13_security_gate.ts

import { getDb, query } from "../src/lib/db";
import { registerUser } from "../src/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "../src/domains/opportunity/service";
import { submitEOI, acceptEOI } from "../src/domains/eoi/service";
import { initiateNDA, acceptNDA } from "../src/domains/dataroom/service";
import { createMOU, acceptMOU } from "../src/domains/mou/service";
import {
  createPaymentIntent,
  processProviderWebhook,
  resetPaymentRateLimits,
} from "../src/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
} from "../src/domains/payments/provider";
import {
  createDiligenceCase,
  getChecklistItems,
  uploadEvidenceDocument,
  createFinding,
} from "../src/domains/diligence/service";
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
} from "../src/domains/valuation/service";
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
} from "../src/domains/valuation/calculator";
import { AuthenticatedUser } from "../src/types/auth";
import {
  CalculationError,
  NotFoundError,
  ForbiddenError,
  ValuationGateError,
  InvalidValuationStateError,
  ValuationLockedError,
} from "../src/lib/errors";

process.env.ENABLE_TEST_PAYMENT_PROVIDER = "true";

const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

function createValidPdfBuffer(label = "Security Gate Evidence Document"): Buffer {
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
  const body = Buffer.from(`1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
  return Buffer.concat([header, body]);
}

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 13 VALUATION ENGINE SECURITY GATE");
  console.log("=================================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition: boolean, code: string, message: string) {
    if (condition) {
      console.log(`  [PASS] ${code}: ${message}`);
      totalPassed++;
    } else {
      console.error(`  [FAIL] ${code}: ${message}`);
      totalFailed++;
    }
  }

  try {
    const db = await getDb();
    resetPaymentRateLimits();
    const testProvider = paymentProviderRegistry.getTestProvider();

    // =========================================================================
    // SECTION 1: DATABASE SCHEMA & MIGRATION INTEGRITY (Assertions 1-10)
    // =========================================================================
    console.log("--- SECTION 1: DATABASE SCHEMA & MIGRATION INTEGRITY ---");

    const tables = [
      "valuation_cases",
      "valuation_versions",
      "valuation_inputs",
      "valuation_adjustments",
      "valuation_comparables",
    ];

    for (const t of tables) {
      const res = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        ) as exists`,
        [t]
      );
      assert(res.rows[0]?.exists === true, `SEC-13-MIG-${t.toUpperCase()}`, `Table ${t} exists in schema`);
    }

    const sequences = [
      "val_case_ref_seq",
      "val_ver_ref_seq",
      "val_inp_ref_seq",
      "val_adj_ref_seq",
    ];

    for (const s of sequences) {
      const res = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.sequences 
          WHERE sequence_name = $1
        ) as exists`,
        [s]
      );
      assert(res.rows[0]?.exists === true, `SEC-13-SEQ-${s.toUpperCase()}`, `Sequence ${s} exists`);
    }

    const permRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM permissions WHERE code LIKE 'valuation.%'`
    );
    assert(parseInt(permRes.rows[0].count, 10) >= 9, "SEC-13-PERMS-SEEDED", "At least 9 valuation permissions seeded");

    // =========================================================================
    // SECTION 2: TEST ACTORS & DEAL PRECONDITION SETUP (Assertions 11-16)
    // =========================================================================
    console.log("\n--- SECTION 2: ACTORS & PRECONDITION SETUP ---");

    const ts = Date.now();
    const regSeller = await registerUser({
      email: `seller.p13.gate.${ts}@apexeng.in`,
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    const seller = regSeller.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', $2, 'VERIFIED', 100)`,
      [seller.id, seller.email]
    );

    const regBuyer1 = await registerUser({
      email: `buyer1.p13.gate.${ts}@alphainvest.in`,
      firstName: "Rajesh",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const buyer1 = regBuyer1.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Alpha Strategic Investments Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
        'Rajesh Kapoor', 'Managing Director', $2, '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id, buyer1.email]
    );

    const regBuyer2 = await registerUser({
      email: `buyer2.p13.gate.${ts}@betacapital.in`,
      firstName: "Pooja",
      lastName: "Bansal",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const buyer2 = regBuyer2.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'FINANCIAL_SPONSOR', 'Beta Growth Capital LLP', 'LLP', 'Karnataka', 'Bengaluru',
        'Pooja Bansal', 'Partner', $2, '+919876541123', 'VERIFIED', 'Technology'
      )`,
      [buyer2.id, buyer2.email]
    );

    const regRev = await registerUser({
      email: `reviewer.p13.gate.${ts}@scaleup.in`,
      firstName: "Karan",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const reviewer: AuthenticatedUser = {
      ...regRev.user,
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

    const regAdmin = await registerUser({
      email: `admin.p13.gate.${ts}@scaleup.in`,
      firstName: "Super",
      lastName: "Admin",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const admin: AuthenticatedUser = {
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

    assert(Boolean(seller.id && buyer1.id && buyer2.id && reviewer.id && admin.id), "SEC-13-ACTORS-INIT", "All 5 security gate actors successfully registered");

    // Create and Publish Opportunity
    const opp = await createOpportunity(seller, {
      title: "Apex Aerospace Components Facility",
      headline: "AS9100 Certified Precision Machining Unit",
      teaserSummary: "Operational precision plant with multi-year tier-1 aerospace contracts.",
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
    await submitOpportunity(opp.id, seller);
    await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
    const pubOpp = await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);
    assert(pubOpp.status === "PUBLISHED", "SEC-13-OPP-PUBLISHED", "Opportunity published with progressive confidentiality masking");

    // EOI -> NDA -> MOU -> Escrow Deposit -> Diligence Case
    const eoi = await submitEOI(buyer1, pubOpp.id, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Acquisition evaluation under Phase 13 gate.",
    });
    await acceptEOI(seller, eoi.id, { sellerResponseMessage: "Accepted for NDA." });

    const initNda = await initiateNDA(buyer1, pubOpp.id, { eoiId: eoi.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller, initNda.id, { termsAcknowledged: true });
    assert(executedNda.status === "EXECUTED", "SEC-13-NDA-EXECUTED", "Bilateral NDA executed");

    const proposedMOU = await createMOU(buyer1, pubOpp.id, {
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
    const acceptedMOU = await acceptMOU(seller, proposedMOU.id, { confirmed: true });
    assert(acceptedMOU.status === "ACCEPTED", "SEC-13-MOU-ACCEPTED", "Deal Intent MOU accepted");

    // Escrow Token Deposit
    const payment = await createPaymentIntent(
      buyer1,
      acceptedMOU.id,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadStr = JSON.stringify({
      id: `evt_p13_gate_${ts}`,
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    });
    const sig = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, sig);

    const tokenCheck = await query<{ status: string }>(
      `SELECT status FROM token_deposits WHERE mou_id = $1`,
      [acceptedMOU.id]
    );
    assert(tokenCheck.rows[0]?.status === "TOKEN_PAYMENT_CONFIRMED", "SEC-13-ESCROW-CONFIRMED", "Escrow token deposit confirmed");

    // Diligence Case
    const ddCase = await createDiligenceCase(buyer1, acceptedMOU.id, {
      scopeDescription: "Phase 13 Security Gate Diligence Baseline",
    });
    assert(Boolean(ddCase.id && ddCase.referenceCode), "SEC-13-DD-INITIALIZED", "Due diligence case active");

    // Seed Evidence & Finding
    const items = await getChecklistItems(seller, ddCase.id);
    const pdfBuf = createValidPdfBuffer("FY24 Audited Balance Sheet");
    const evd = await uploadEvidenceDocument(
      seller,
      ddCase.id,
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
    assert(Boolean(evd.id), "SEC-13-EVIDENCE-SEEDED", "Verified diligence evidence seeded");

    const finding = await createFinding(buyer1, ddCase.id, {
      category: "FINANCIAL",
      title: "Unrecorded Working Capital Liability",
      description: "Vendor dispute of ₹15 Lakhs pending adjudication.",
      severity: "HIGH",
      financialImpactEstimate: 1500000,
    });
    assert(Boolean(finding.id), "SEC-13-FINDING-SEEDED", "Diligence risk finding seeded");

    // =========================================================================
    // SECTION 3: FIVE-GATE PRECONDITION ENFORCEMENT (Assertions 17-22)
    // =========================================================================
    console.log("\n--- SECTION 3: FIVE-GATE PRECONDITION ENFORCEMENT ---");

    // Gate 1: Unpublished opp
    await query(`UPDATE opportunities SET status = 'DRAFT' WHERE id = $1`, [pubOpp.id]);
    let g1Blocked = false;
    try {
      await createValuationCase(buyer1, ddCase.id);
    } catch (e) {
      if (e instanceof NotFoundError) g1Blocked = true;
    }
    await query(`UPDATE opportunities SET status = 'PUBLISHED' WHERE id = $1`, [pubOpp.id]);
    assert(g1Blocked, "SEC-13-GATE-1-OPP", "Gate 1: Unpublished opportunity throws uniform 404");

    // Gate 2: Unexecuted NDA
    await query(`UPDATE nda_agreements SET status = 'DRAFT' WHERE id = $1`, [executedNda.id]);
    let g2Blocked = false;
    try {
      await createValuationCase(buyer1, ddCase.id);
    } catch (e) {
      if (e instanceof ValuationGateError) g2Blocked = true;
    }
    await query(`UPDATE nda_agreements SET status = 'EXECUTED' WHERE id = $1`, [executedNda.id]);
    assert(g2Blocked, "SEC-13-GATE-2-NDA", "Gate 2: Unexecuted NDA blocks valuation workspace");

    // Gate 3: Unaccepted MOU
    await query(`UPDATE deal_mous SET status = 'DRAFT' WHERE id = $1`, [acceptedMOU.id]);
    let g3Blocked = false;
    try {
      await createValuationCase(buyer1, ddCase.id);
    } catch (e) {
      if (e instanceof ValuationGateError) g3Blocked = true;
    }
    await query(`UPDATE deal_mous SET status = 'ACCEPTED' WHERE id = $1`, [acceptedMOU.id]);
    assert(g3Blocked, "SEC-13-GATE-3-MOU", "Gate 3: Unaccepted MOU blocks valuation workspace");

    // Gate 4: Unconfirmed Escrow Deposit
    await query(`UPDATE token_deposits SET status = 'TOKEN_PAYMENT_PENDING' WHERE mou_id = $1`, [acceptedMOU.id]);
    await query(`UPDATE payment_intents SET status = 'PENDING' WHERE mou_id = $1`, [acceptedMOU.id]);
    let g4Blocked = false;
    try {
      await createValuationCase(buyer1, ddCase.id);
    } catch (e) {
      if (e instanceof ValuationGateError) g4Blocked = true;
    }
    await query(`UPDATE token_deposits SET status = 'TOKEN_PAYMENT_CONFIRMED' WHERE mou_id = $1`, [acceptedMOU.id]);
    await query(`UPDATE payment_intents SET status = 'SUCCEEDED' WHERE mou_id = $1`, [acceptedMOU.id]);
    assert(g4Blocked, "SEC-13-GATE-4-ESCROW", "Gate 4: Unconfirmed escrow deposit blocks valuation workspace");

    // Gate 5: Diligence Case Rejected
    await query(`UPDATE due_diligence_cases SET status = 'REJECTED' WHERE id = $1`, [ddCase.id]);
    let g5Blocked = false;
    try {
      await createValuationCase(buyer1, ddCase.id);
    } catch (e) {
      if (e instanceof ValuationGateError) g5Blocked = true;
    }
    await query(`UPDATE due_diligence_cases SET status = 'INITIATED' WHERE id = $1`, [ddCase.id]);
    assert(g5Blocked, "SEC-13-GATE-5-DD", "Gate 5: Rejected diligence case blocks valuation workspace");

    // Gate 6: Seller blocked from initiation
    let sellerInitBlocked = false;
    try {
      await createValuationCase(seller, ddCase.id);
    } catch (e) {
      if (e instanceof ForbiddenError) sellerInitBlocked = true;
    }
    assert(sellerInitBlocked, "SEC-13-GATE-SELLER-INIT", "Seller blocked from initiating buyer valuation workspace");

    // =========================================================================
    // SECTION 4: IDEMPOTENCY & ANTI-IDOR AUTHORIZATION (Assertions 23-28)
    // =========================================================================
    console.log("\n--- SECTION 4: IDEMPOTENCY & ANTI-IDOR SECURITY ---");

    const valCase1 = await createValuationCase(buyer1, ddCase.id, {
      notes: "Alpha Strategic acquisition target model",
    });
    assert(valCase1.status === "DRAFT", "SEC-13-CASE-INIT-DRAFT", "Valuation workspace created in initial DRAFT state");
    assert(valCase1.currentVersionNumber === 1, "SEC-13-VER-1-INIT", "Version V1 initialized automatically");

    const valCase2 = await createValuationCase(buyer1, ddCase.id);
    assert(valCase1.id === valCase2.id, "SEC-13-IDEMPOTENT-CREATE", "Creation is strictly idempotent without duplicate rows");

    let idorViewBlocked = false;
    try {
      await getValuationCaseById(buyer2, valCase1.id);
    } catch (e) {
      if (e instanceof ForbiddenError) idorViewBlocked = true;
    }
    assert(idorViewBlocked, "SEC-13-IDOR-VIEW-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from viewing case");

    let idorVersionBlocked = false;
    try {
      await getValuationVersionDetail(buyer2, valCase1.id, 1);
    } catch (e) {
      if (e instanceof ForbiddenError) idorVersionBlocked = true;
    }
    assert(idorVersionBlocked, "SEC-13-IDOR-VER-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from viewing version detail");

    let idorMutateBlocked = false;
    try {
      await addValuationInput(buyer2, valCase1.id, {
        metricName: "REVENUE",
        rawValue: 100000000,
        currency: "INR",
        unit: "INR",
      });
    } catch (e) {
      if (e instanceof ForbiddenError) idorMutateBlocked = true;
    }
    assert(idorMutateBlocked, "SEC-13-IDOR-MUTATE-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from mutating inputs");

    const buyer2List = await listValuationCases(buyer2);
    assert(buyer2List.items.length === 0, "SEC-13-IDOR-LIST-EMPTY", "Anti-IDOR: Unrelated Buyer 2 listing returns 0 items");

    // =========================================================================
    // SECTION 5: DETERMINISTIC CALCULATOR & MATH SAFETY (Assertions 29-40)
    // =========================================================================
    console.log("\n--- SECTION 5: DETERMINISTIC CALCULATOR & MATH SAFETY ---");

    // Revenue multiple
    const revRes = calculateRevenueMultiple(120000000, 1.5, 20000000, 5000000);
    assert(revRes.enterpriseValue === 180000000, "SEC-13-CALC-REV-EV", "Revenue multiple computes exact EV (120M * 1.5 = 180M)");
    assert(revRes.equityValue === 165000000, "SEC-13-CALC-REV-EQ", "Revenue multiple computes Net Debt adjusted Equity Value (165M)");

    // Positive EBITDA multiple
    const ebitdaRes = calculateEBITDAMultiple(28000000, 6.0, 20000000, 5000000);
    assert(ebitdaRes.enterpriseValue === 168000000, "SEC-13-CALC-EBITDA-EV", "EBITDA multiple computes exact EV (28M * 6 = 168M)");
    assert(ebitdaRes.isNegativeEbitdaUnsuitable === false, "SEC-13-CALC-EBITDA-SUITABLE", "Positive EBITDA marked suitable");

    // Negative EBITDA guard
    const negEbitdaRes = calculateEBITDAMultiple(-5000000, 5.0, 10000000, 2000000);
    assert(negEbitdaRes.isNegativeEbitdaUnsuitable === true, "SEC-13-CALC-NEG-EBITDA-GUARD", "Negative EBITDA triggers unsuitability guard");
    assert(negEbitdaRes.enterpriseValue === null, "SEC-13-CALC-NEG-EBITDA-NULL", "Negative EBITDA never fabricates positive EV (null)");

    // DCF Calculation
    const dcfRes = calculateDCF({
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
    assert(dcfRes.validationStatus === "VALID", "SEC-13-CALC-DCF-VALID", "DCF model produces VALID status");
    assert(dcfRes.enterpriseValue > 0, "SEC-13-CALC-DCF-EV-POS", "DCF model produces positive enterprise value");

    // DCF WACC <= g guard
    const invalidDcf = calculateDCF({
      projectionYears: [{ year: 1, projectedRevenue: 100000000, ebitdaMarginPct: 20 }],
      waccPct: 5,
      terminalGrowthRatePct: 6,
    });
    assert(invalidDcf.validationStatus === "INVALID_WACC_TERMINAL_GROWTH", "SEC-13-CALC-DCF-WACC-GUARD", "WACC <= g triggers controlled INVALID_WACC_TERMINAL_GROWTH");
    assert(invalidDcf.enterpriseValue === 0, "SEC-13-CALC-DCF-WACC-EV-ZERO", "WACC <= g completely avoids division by zero");

    // Asset-based valuation
    const navRes = calculateAssetBased(90000000, 30000000, [
      { adjustment_type: "ASSET_ADDITION", amount: 10000000 } as any,
      { adjustment_type: "LIABILITY_ADDITION", amount: 5000000 } as any,
      { adjustment_type: "RISK_HAIRCUT", amount: 2000000 } as any,
    ]);
    assert(navRes.netAssetValue === 63000000, "SEC-13-CALC-NAV-MATH", "Asset-Based NAV computes exact adjusted assets minus liabilities (63M)");

    // Comparable peers
    const emptyComps = calculateComparableAnalysis([], 100000000, 20000000);
    assert(emptyComps.status === "INSUFFICIENT_COMPARABLE_DATA", "SEC-13-CALC-EMPTY-COMPS", "Empty comparables returns INSUFFICIENT_COMPARABLE_DATA");

    // Blended weights
    let badWeightBlocked = false;
    try {
      calculateBlendedValuation(
        [{ methodology: "REVENUE_MULTIPLE", enterpriseValue: 100, equityValue: 100 }],
        { REVENUE_MULTIPLE: 0.8 } // != 1.0
      );
    } catch (e) {
      if (e instanceof CalculationError) badWeightBlocked = true;
    }
    assert(badWeightBlocked, "SEC-13-CALC-BLENDED-WEIGHTS", "Blended weights not summing to 1.0 (100%) are rejected");

    // Unit normalization
    assert(normalizeFinancialValue(15, "CRORE") === 150000000, "SEC-13-NORM-CRORE", "Normalizes CRORE to exact base currency integer");

    // =========================================================================
    // SECTION 6: WORKSPACE WORKFLOW & PROVENANCE (Assertions 41-46)
    // =========================================================================
    console.log("\n--- SECTION 6: WORKSPACE WORKFLOW & PROVENANCE ---");

    const verAfterRev = await addValuationInput(buyer1, valCase1.id, {
      metricName: "REVENUE",
      rawValue: 120000000,
      currency: "INR",
      unit: "INR",
      sourcePeriod: "FY2023-24",
      provenanceType: "DILIGENCE_EVIDENCE",
      evidenceId: evd.id,
      qualityFlag: "VERIFIED",
      notes: "Audited revenue from FY24 balance sheet",
    });
    const revInput = verAfterRev.inputs.find((i) => i.metricName === "REVENUE")!;
    assert(revInput.provenanceType === "DILIGENCE_EVIDENCE", "SEC-13-INPUT-PROV-EVIDENCE", "Evidence-linked input tagged DILIGENCE_EVIDENCE");
    assert(revInput.qualityFlag === "VERIFIED", "SEC-13-INPUT-FLAG-VERIFIED", "Evidence-linked input marked VERIFIED");

    const verAfterManual = await addValuationInput(buyer1, valCase1.id, {
      metricName: "EBITDA",
      rawValue: 28000000,
      currency: "INR",
      unit: "INR",
      provenanceType: "MANUAL_INPUT",
      qualityFlag: "MANUAL_INPUT",
      notes: "Working operating earnings figure",
    });
    const manualInput = verAfterManual.inputs.find((i) => i.metricName === "EBITDA")!;
    assert(manualInput.provenanceType === "MANUAL_INPUT", "SEC-13-INPUT-PROV-MANUAL", "Non-evidence input tagged MANUAL_INPUT");

    const verAfterAdj = await addValuationAdjustment(buyer1, valCase1.id, {
      adjustmentType: "RISK_HAIRCUT",
      title: "Vendor Dispute Holdback",
      amount: 1500000,
      currency: "INR",
      rationale: "Holdback for disputed vendor rebate",
      sourceFindingId: finding.id,
    });
    const adj = verAfterAdj.adjustments.find((a) => a.title === "Vendor Dispute Holdback")!;
    assert(adj.sourceFindingId === finding.id, "SEC-13-ADJ-FINDING-LINKED", "Adjustment explicitly linked to Diligence Finding");

    const verAfterComp = await addValuationComparable(buyer1, valCase1.id, {
      companyName: "Precision Aero Components Ltd",
      sector: "MANUFACTURING",
      period: "FY2023-24",
      revenue: 150000000,
      ebitda: 35000000,
      impliedEv: 220000000,
      source: "BSE filings",
      confidence: "HIGH",
    });
    assert(verAfterComp.comparables.length > 0, "SEC-13-COMP-ADDED", "Market comparable company registered");
    assert((verAfterComp.calculationResults.range.baseEnterpriseValue ?? 0) > 0, "SEC-13-AUTO-RECALC", "Adding comparable automatically triggers deterministic recalculation");

    // =========================================================================
    // SECTION 7: IMMUTABLE VERSIONING & GOVERNANCE STATE MACHINE (Assertions 47-52)
    // =========================================================================
    console.log("\n--- SECTION 7: IMMUTABLE VERSIONING & GOVERNANCE ---");

    const submittedVer = await submitValuationVersion(buyer1, valCase1.id, {
      notes: "Ready for formal review",
    });
    assert(submittedVer.status === "SUBMITTED", "SEC-13-SUBMIT-TRANSITION", "Version transitioned to SUBMITTED");

    let submittedMutateBlocked = false;
    try {
      await addValuationInput(buyer1, valCase1.id, {
        metricName: "CASH",
        rawValue: 5000000,
        currency: "INR",
        unit: "INR",
      });
    } catch (e) {
      if (e instanceof ValuationLockedError) submittedMutateBlocked = true;
    }
    assert(submittedMutateBlocked, "SEC-13-SUBMITTED-FROZEN", "SUBMITTED version is frozen against direct input mutation");

    let selfApproveBlocked = false;
    try {
      await reviewValuationVersion(buyer1, valCase1.id, {
        decision: "APPROVED",
        notes: "Self approval attempt notes",
      });
    } catch (e) {
      if (e instanceof ValuationGateError) selfApproveBlocked = true;
    }
    assert(selfApproveBlocked, "SEC-13-ANTI-SELF-APPROVE", "Strict Anti-Self-Approval: Creator blocked from approving own model");

    let sellerApproveBlocked = false;
    try {
      await reviewValuationVersion(seller, valCase1.id, {
        decision: "APPROVED",
        notes: "Seller approval attempt notes",
      });
    } catch (e) {
      if (e instanceof ForbiddenError) sellerApproveBlocked = true;
    }
    assert(sellerApproveBlocked, "SEC-13-SELLER-REVIEW-BLOCKED", "Seller blocked from reviewing or approving buyer model");

    const approvedVer = await reviewValuationVersion(reviewer, valCase1.id, {
      decision: "APPROVED",
      notes: "Independent deal reviewer verified evidence and methodology triangulation.",
    });
    assert(approvedVer.status === "APPROVED", "SEC-13-REVIEWER-APPROVED", "Independent reviewer successfully approved version");

    const lockedVer = await lockValuationVersion(admin, valCase1.id, {
      lockReason: "Baseline locked for definitive agreement negotiation.",
    });
    assert(lockedVer.status === "LOCKED", "SEC-13-VERSION-LOCKED", "Valuation version locked into immutable state");

    // =========================================================================
    // SECTION 8: PROGRESSIVE DISCLOSURE & AUDIT TRAIL (Assertions 53-56)
    // =========================================================================
    console.log("\n--- SECTION 8: PROGRESSIVE DISCLOSURE & AUDIT TRAIL ---");

    const sellerSummary = await getSellerValuationSummary(seller, valCase1.id);
    assert(sellerSummary.indicativeValuationRange.baseEnterpriseValue !== null, "SEC-13-SELLER-RANGE-VISIBLE", "Seller can see indicative valuation range");
    assert(sellerSummary.confidenceLevel !== null, "SEC-13-SELLER-CONF-VISIBLE", "Seller can see model confidence level");

    const sellerOverview = await getValuationCaseById(seller, valCase1.id);
    assert(sellerOverview.notes === null, "SEC-13-SELLER-NOTES-MASKED", "Progressive disclosure masks buyer internal notes to null for Seller");

    const auditRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE resource_id = $1::text 
          OR resource_id IN (SELECT id::text FROM valuation_versions WHERE case_id = $1::uuid)`,
      [valCase1.id]
    );
    assert(parseInt(auditRes.rows[0].count, 10) >= 3, "SEC-13-AUDIT-LOGGED", "Immutable audit trail records case lifecycle events");

    // =========================================================================
    // FINAL VERDICT & SUMMARY
    // =========================================================================
    console.log("\n=================================================================");
    console.log(`PHASE 13 SECURITY GATE RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log("=================================================================");

    if (totalFailed === 0) {
      console.log("\n>>> FINAL VERDICT: READY_FOR_PHASE_14 <<<\n");
      process.exit(0);
    } else {
      console.error("\n>>> FINAL VERDICT: NOT_READY_FOR_PHASE_14 <<<\n");
      process.exit(1);
    }
  } catch (error) {
    console.error("FATAL ERROR in Phase 13 Security Gate:", error);
    process.exit(1);
  }
}

runSecurityGate();
