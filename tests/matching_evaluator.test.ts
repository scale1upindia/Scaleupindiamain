import { describe, it, expect } from "vitest";
import { evaluateOpportunityMatch } from "@/domains/matching/evaluator";
import { classifyScore, MATCHING_WEIGHTS } from "@/domains/matching/weights";
import { AcquisitionMandateRecord } from "@/types/buyer";
import {
  OpportunityRecord,
  OpportunityStatus,
  BusinessCategory,
  OperatingRegion,
  BusinessAgeBracket,
  RevenueBracket,
  OpportunityTransactionType,
  BusinessModel,
} from "@/types/opportunity";
import { MatchClassification } from "@/types/matching";

describe("Phase 5: Deterministic Match Evaluator (Pure Function Unit Tests)", () => {
  // Base baseline opportunity (Published, Manufacturing, West India)
  const baseOpportunity: OpportunityRecord = {
    id: "opp-1001-uuid",
    referenceCode: "OPP-2026-1001",
    sellerProfileId: "seller-profile-uuid",
    userId: "seller-user-uuid",
    title: "Precision Aerospace Machining Enterprise",
    headline: "Tier-1 AS9100D Certified Defense Partner",
    teaserSummary: "Precision 5-axis CNC machining manufacturer with multi-year defense contracts.",
    businessCategory: BusinessCategory.MANUFACTURING,
    industry: "Defense & Aerospace",
    subSector: "Precision Machining",
    operatingRegion: OperatingRegion.WEST_INDIA,
    registeredState: "Maharashtra",
    registeredCity: "Pune",
    approximateAgeBracket: BusinessAgeBracket.YRS_10_TO_20,
    revenueBracket: RevenueBracket.CR_25_TO_50,
    transactionType: OpportunityTransactionType.FULL_ACQUISITION,
    businessModel: BusinessModel.B2B,
    yearEstablished: 2012,
    employeeRange: "51_TO_200",
    customerScale: "18 Active Institutional OEMs",
    ebitdaMarginBracket: "20_TO_30_PCT",
    askingPriceBracket: "50CR_TO_100CR",
    growthRateBracket: "10_TO_25_PCT",
    facilityDetails: "70,000 sq ft industrial campus with 32 CNC centers",
    stakeOfferedPercentage: 100,

    // Confidential Statutory Fields (Must NEVER leak into explanations)
    exactLegalName: "Bharat Precision Dynamics Private Limited",
    exactTradeName: "Bharat Precision",
    exactCin: "U29253MH2012PTC234567",
    exactGstin: "27AABCB9876C1Z8",
    exactPan: "AABCB9876C",
    exactAddress: "Plot 88, Sector 10, Bhosari, Pune - 411026",
    exactRevenue: 425000000,
    exactEbitda: 98000000,
    exactAskingPrice: 650000000,

    status: OpportunityStatus.PUBLISHED,
    viewCount: 0,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  // Base baseline mandate (Active, Target: Defense, West India/Pan-India)
  const baseMandate: AcquisitionMandateRecord = {
    id: "mandate-1001-uuid",
    buyerProfileId: "buyer-profile-uuid",
    name: "Strategic Defense & Aerospace Buyout Mandate",
    description: "Seeking 100% acquisition of precision defense components manufacturers",
    status: "ACTIVE",
    minInvestment: 400000000, // ₹40 Cr
    maxInvestment: 800000000, // ₹80 Cr
    preferredTicketSize: 650000000, // ₹65 Cr
    availableCapital: 1000000000,
    financingRequirement: null,
    debtEquityPreference: null,
    revenueMin: 200000000, // ₹20 Cr
    revenueMax: 600000000, // ₹60 Cr
    ebitdaMin: 50000000,
    ebitdaMax: 150000000,
    employeeMin: 50,
    employeeMax: 300,
    businessAgeMin: 5,
    businessAgeMax: 30,
    netWorthMin: null,
    netWorthMax: null,
    transactionTypes: ["FULL_ACQUISITION"],
    controlPreference: "FULL_CONTROL",
    strategicObjectives: ["MARKET_EXPANSION", "OPERATIONAL_SCALE"],
    otherStrategicObjective: null,
    preferredBusinessAge: "ESTABLISHED",
    promoterInvolvement: "ADVISORY_TRANSITION",
    promoterExitPreference: "FULL_EXIT",
    existingManagementRetention: "DESIRED",
    turnaroundOpportunities: false,
    profitableBusinessesOnly: true,
    growthStage: true,
    distressedOpportunities: false,
    assetPreference: "ASSET_HEAVY",
    investmentHorizon: "LONG_TERM",
    expectedHoldingPeriodYears: 7,
    fundingSource: "FUND_CAPITAL",
    targetIndustries: [
      {
        id: "ti-1",
        mandateId: "mandate-1001-uuid",
        industry: "Defense & Aerospace",
        subSectors: ["Precision Machining", "Avionics"],
        otherSubSector: null,
        createdAt: new Date(),
      },
    ],
    targetGeographies: [
      {
        id: "tg-1",
        mandateId: "mandate-1001-uuid",
        region: "WEST_INDIA",
        countries: ["India"],
        states: ["Maharashtra", "Gujarat"],
        cities: ["Pune", "Mumbai"],
        createdAt: new Date(),
      },
    ],
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };

  // -------------------------------------------------------------------------
  // 1. HARD CONSTRAINT TESTS
  // -------------------------------------------------------------------------
  it("HARD GATE: REJECTS match when opportunity is not PUBLISHED (e.g. DRAFT)", () => {
    const opp = { ...baseOpportunity, status: OpportunityStatus.DRAFT };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.classification).toBe(MatchClassification.POOR_MATCH);
    expect(res.blockingCriteria).toContain("OPPORTUNITY_NOT_PUBLISHED");
  });

  it("HARD GATE: REJECTS match when opportunity is REJECTED", () => {
    const opp = { ...baseOpportunity, status: OpportunityStatus.REJECTED };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("OPPORTUNITY_NOT_PUBLISHED");
  });

  it("HARD GATE: REJECTS match when opportunity is SUSPENDED", () => {
    const opp = { ...baseOpportunity, status: OpportunityStatus.SUSPENDED };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("OPPORTUNITY_NOT_PUBLISHED");
  });

  it("HARD GATE: REJECTS match when industry does not align with target industries", () => {
    const opp = { ...baseOpportunity, industry: "Healthcare & Pharmaceuticals" };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("INDUSTRY_MISMATCH");
    expect(res.reasons.some((r) => r.includes("Healthcare"))).toBe(true);
  });

  it("HARD GATE: REJECTS match when transaction type does not match mandate constraints", () => {
    const opp = { ...baseOpportunity, transactionType: OpportunityTransactionType.MINORITY_STAKE };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("TRANSACTION_TYPE_MISMATCH");
  });

  it("HARD GATE: REJECTS match when buyer requires profitable businesses but opportunity reports negative margin", () => {
    const opp = { ...baseOpportunity, ebitdaMarginBracket: "NEGATIVE" as any };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("UNPROFITABLE_BUSINESS");
  });

  it("HARD GATE: REJECTS match when asking price bracket vastly exceeds capital capacity (> 100% overrun)", () => {
    // mandate maxInvestment is 80 Cr; asking price bracket 250CR_TO_500CR (min 250 Cr > 160 Cr)
    const opp = { ...baseOpportunity, askingPriceBracket: "100CR_TO_250CR" as any };
    const mandateWithSmallBudget = { ...baseMandate, maxInvestment: 200000000 }; // 20 Cr max vs 100 Cr min
    const res = evaluateOpportunityMatch(mandateWithSmallBudget, opp);
    expect(res.isEligible).toBe(false);
    expect(res.score).toBe(0);
    expect(res.blockingCriteria).toContain("CAPITAL_CAPACITY_EXCEEDED");
  });

  // -------------------------------------------------------------------------
  // 2. SOFT PREFERENCE & WEIGHTED SCORING TESTS
  // -------------------------------------------------------------------------
  it("PERFECT MATCH: produces EXCELLENT_MATCH (score >= 90) when all dimensions align", () => {
    const res = evaluateOpportunityMatch(baseMandate, baseOpportunity);
    expect(res.isEligible).toBe(true);
    expect(res.score).toBeGreaterThanOrEqual(90);
    expect(res.score).toBeLessThanOrEqual(100);
    expect(res.classification).toBe(MatchClassification.EXCELLENT_MATCH);
    expect(res.blockingCriteria.length).toBe(0);
    expect(res.matchedCriteria).toContain("HARD_CONSTRAINTS_SATISFIED");
    expect(res.matchedCriteria).toContain("GEOGRAPHY_MATCH");
    expect(res.matchedCriteria).toContain("REVENUE_SCALE_MATCH");
    expect(res.matchedCriteria).toContain("INVESTMENT_CAPACITY_MATCH");
  });

  it("GEOGRAPHY: scores full points for Pan-India mandate", () => {
    const panIndiaMandate = {
      ...baseMandate,
      targetGeographies: [
        {
          id: "tg-pan",
          mandateId: "mandate-1001-uuid",
          region: "PAN_INDIA" as any,
          countries: ["India"],
          states: [],
          cities: [],
          createdAt: new Date(),
        },
      ],
    };
    const res = evaluateOpportunityMatch(panIndiaMandate, baseOpportunity);
    expect(res.dimensionScores["GEOGRAPHY"].score).toBe(MATCHING_WEIGHTS.GEOGRAPHY);
    expect(res.dimensionScores["GEOGRAPHY"].matched).toBe(true);
  });

  it("GEOGRAPHY: scores full points when registered state matches target states", () => {
    const stateMandate = {
      ...baseMandate,
      targetGeographies: [
        {
          id: "tg-state",
          mandateId: "mandate-1001-uuid",
          region: "WEST_INDIA" as any,
          countries: ["India"],
          states: ["Maharashtra"],
          cities: [],
          createdAt: new Date(),
        },
      ],
    };
    const res = evaluateOpportunityMatch(stateMandate, baseOpportunity);
    expect(res.dimensionScores["GEOGRAPHY"].score).toBe(MATCHING_WEIGHTS.GEOGRAPHY);
  });

  it("GEOGRAPHY: gives partial score when opportunity is in different region", () => {
    const northIndiaMandate = {
      ...baseMandate,
      targetGeographies: [
        {
          id: "tg-north",
          mandateId: "mandate-1001-uuid",
          region: "NORTH_INDIA" as any,
          countries: ["India"],
          states: ["Delhi", "Haryana"],
          cities: [],
          createdAt: new Date(),
        },
      ],
    };
    const res = evaluateOpportunityMatch(northIndiaMandate, baseOpportunity);
    expect(res.dimensionScores["GEOGRAPHY"].score).toBeLessThan(MATCHING_WEIGHTS.GEOGRAPHY);
    expect(res.unmatchedCriteria).toContain("GEOGRAPHY_VARIANCE");
  });

  it("REVENUE: awards full score when turnover bracket is enclosed in mandate range", () => {
    const res = evaluateOpportunityMatch(baseMandate, baseOpportunity);
    expect(res.dimensionScores["REVENUE"].score).toBe(MATCHING_WEIGHTS.REVENUE);
    expect(res.dimensionScores["REVENUE"].matched).toBe(true);
  });

  it("REVENUE: awards 0 points when turnover bracket is completely outside target range", () => {
    const smallRevMandate = {
      ...baseMandate,
      revenueMin: 5000000,
      revenueMax: 30000000, // 3 Cr max vs 25-50 Cr bracket
    };
    const res = evaluateOpportunityMatch(smallRevMandate, baseOpportunity);
    expect(res.dimensionScores["REVENUE"].score).toBe(0);
    expect(res.dimensionScores["REVENUE"].matched).toBe(false);
  });

  it("INVESTMENT CAPACITY: awards top score when asking price matches preferred ticket size", () => {
    const res = evaluateOpportunityMatch(baseMandate, baseOpportunity);
    expect(res.dimensionScores["INVESTMENT_CAPACITY"].score).toBe(MATCHING_WEIGHTS.INVESTMENT_CAPACITY);
    expect(res.dimensionScores["INVESTMENT_CAPACITY"].matched).toBe(true);
  });

  it("INVESTMENT CAPACITY: awards high score when asking price is NEGOTIABLE", () => {
    const opp = { ...baseOpportunity, askingPriceBracket: "NEGOTIABLE" as any };
    const res = evaluateOpportunityMatch(baseMandate, opp);
    expect(res.dimensionScores["INVESTMENT_CAPACITY"].score).toBe(13);
  });

  it("EBITDA: scores according to margin bracket quality", () => {
    const opp30 = { ...baseOpportunity, ebitdaMarginBracket: "OVER_30_PCT" as any };
    const opp20 = { ...baseOpportunity, ebitdaMarginBracket: "20_TO_30_PCT" as any };
    const opp10 = { ...baseOpportunity, ebitdaMarginBracket: "10_TO_20_PCT" as any };
    const opp0 = { ...baseOpportunity, ebitdaMarginBracket: "0_TO_10_PCT" as any };

    expect(evaluateOpportunityMatch(baseMandate, opp30).dimensionScores["EBITDA_MARGIN"].score).toBe(15);
    expect(evaluateOpportunityMatch(baseMandate, opp20).dimensionScores["EBITDA_MARGIN"].score).toBe(13);
    expect(evaluateOpportunityMatch(baseMandate, opp10).dimensionScores["EBITDA_MARGIN"].score).toBe(10);
    expect(evaluateOpportunityMatch(baseMandate, opp0).dimensionScores["EBITDA_MARGIN"].score).toBe(5);
  });

  it("SUB-SECTOR: awards full points for exact sub-sector specialization match", () => {
    const res = evaluateOpportunityMatch(baseMandate, baseOpportunity);
    expect(res.dimensionScores["SUB_SECTOR_DEPTH"].score).toBe(MATCHING_WEIGHTS.SUB_SECTOR_DEPTH);
  });

  it("SUB-SECTOR: awards general points when base industry matches but sub-sector differs", () => {
    const oppDiffSub = { ...baseOpportunity, subSector: "Castings & Forgings" };
    const res = evaluateOpportunityMatch(baseMandate, oppDiffSub);
    expect(res.dimensionScores["SUB_SECTOR_DEPTH"].score).toBe(6);
  });

  it("BUSINESS MODEL: favors defensible B2B and Contract Manufacturing models", () => {
    const oppB2B = { ...baseOpportunity, businessModel: BusinessModel.B2B };
    const oppB2C = { ...baseOpportunity, businessModel: BusinessModel.B2C };

    const resB2B = evaluateOpportunityMatch(baseMandate, oppB2B);
    const resB2C = evaluateOpportunityMatch(baseMandate, oppB2C);

    expect(resB2B.dimensionScores["BUSINESS_MODEL"].score).toBe(10);
    expect(resB2C.dimensionScores["BUSINESS_MODEL"].score).toBe(5);
  });

  // -------------------------------------------------------------------------
  // 3. DETERMINISM & ZERO-LEAKAGE INVARIANTS
  // -------------------------------------------------------------------------
  it("DETERMINISM: 100 consecutive executions produce identical outputs without any jitter", () => {
    const baseline = evaluateOpportunityMatch(baseMandate, baseOpportunity);
    for (let i = 0; i < 100; i++) {
      const current = evaluateOpportunityMatch(baseMandate, baseOpportunity);
      expect(current.score).toBe(baseline.score);
      expect(current.classification).toBe(baseline.classification);
      expect(current.isEligible).toBe(baseline.isEligible);
      expect(current.reasons).toEqual(baseline.reasons);
    }
  });

  it("CONFIDENTIALITY INVARIANT: Explanations NEVER leak CIN, GSTIN, PAN, exact address, or legal name", () => {
    const res = evaluateOpportunityMatch(baseMandate, baseOpportunity);

    const serializedReasons = JSON.stringify(res.reasons) + JSON.stringify(res.matchedCriteria);

    // Verify statutory identifiers are absent
    expect(serializedReasons).not.toContain("U29253MH2012PTC234567"); // CIN
    expect(serializedReasons).not.toContain("27AABCB9876C1Z8"); // GSTIN
    expect(serializedReasons).not.toContain("AABCB9876C"); // PAN
    expect(serializedReasons).not.toContain("Plot 88"); // Exact address
    expect(serializedReasons).not.toContain("Bhosari"); // Exact address
    expect(serializedReasons).not.toContain("Bharat Precision Dynamics Private Limited"); // Legal name
    expect(serializedReasons).not.toContain("425000000"); // Exact revenue
  });

  it("RESILIENCE: Handles empty mandate target sectors without crashing (sector-agnostic)", () => {
    const agnosticMandate = { ...baseMandate, targetIndustries: [] };
    const res = evaluateOpportunityMatch(agnosticMandate, baseOpportunity);
    expect(res.isEligible).toBe(true);
    expect(res.score).toBeGreaterThan(0);
  });

  it("RESILIENCE: Handles missing optional criteria gracefully", () => {
    const sparseOpp: OpportunityRecord = {
      ...baseOpportunity,
      headline: null,
      subSector: null,
      employeeRange: null,
      ebitdaMarginBracket: null,
      askingPriceBracket: null,
      growthRateBracket: null,
      facilityDetails: null,
    };
    const res = evaluateOpportunityMatch(baseMandate, sparseOpp);
    expect(res.isEligible).toBe(true);
    expect(res.score).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 4. CLASSIFICATION THRESHOLDS
  // -------------------------------------------------------------------------
  it("CLASSIFICATION: correctly maps score boundaries", () => {
    expect(classifyScore(100)).toBe(MatchClassification.EXCELLENT_MATCH);
    expect(classifyScore(90)).toBe(MatchClassification.EXCELLENT_MATCH);
    expect(classifyScore(89)).toBe(MatchClassification.STRONG_MATCH);
    expect(classifyScore(75)).toBe(MatchClassification.STRONG_MATCH);
    expect(classifyScore(74)).toBe(MatchClassification.POTENTIAL_MATCH);
    expect(classifyScore(60)).toBe(MatchClassification.POTENTIAL_MATCH);
    expect(classifyScore(59)).toBe(MatchClassification.WEAK_MATCH);
    expect(classifyScore(40)).toBe(MatchClassification.WEAK_MATCH);
    expect(classifyScore(39)).toBe(MatchClassification.POOR_MATCH);
    expect(classifyScore(0)).toBe(MatchClassification.POOR_MATCH);
  });
});
