import { describe, it, expect, beforeAll } from "vitest";
import { getDb, resetTestDb } from "@/lib/db";
import { registerUser, loginUser } from "@/domains/auth/service";
import { createAcquisitionMandate } from "@/domains/buyer/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import {
  refreshBuyerMatches,
  listBuyerMatches,
  getBuyerMatchById,
  listAdminMatches,
} from "@/domains/matching/service";
import {
  BusinessCategory,
  OperatingRegion,
  BusinessAgeBracket,
  RevenueBracket,
  OpportunityTransactionType,
  BusinessModel,
  AdminOpportunityReviewAction,
  OpportunityStatus,
} from "@/types/opportunity";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 5: Matching Service & Anti-IDOR Security Tests", () => {
  let buyerAUser: AuthenticatedUser;
  let buyerBUser: AuthenticatedUser;
  let sellerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  let buyerAProfileId: string;
  let buyerBProfileId: string;
  let mandateAId: string;
  let mandateBId: string;

  let publishedOppId: string;
  let draftOppId: string;

  beforeAll(async () => {
    await resetTestDb();
    const db = await getDb();
    const ts = Date.now();

    // 1. Provision Buyer A
    const buyerAReg = await registerUser({
      email: `buyer_a_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Aarav",
      lastName: "Capital",
      roles: ["BUYER"],
    });
    buyerAUser = buyerAReg.user;

    const bProfileA = await db.query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'CORPORATE_BUYER', 'Aarav Holdings Pvt Ltd', 'COMPANY', 'India', 'Maharashtra', 'Mumbai',
        'Aarav Sharma', 'Managing Director', $2, '+91 9999999901', 'VERIFIED')
      RETURNING id`,
      [buyerAUser.id, buyerAUser.email]
    );
    buyerAProfileId = bProfileA.rows[0].id;

    // Mandate for Buyer A (Seeking Defense & Aerospace, West India)
    const mandARes = await createAcquisitionMandate(
      buyerAUser,
      {
        name: "Western Defense Buyout Mandate",
        minInvestment: 300000000,
        maxInvestment: 800000000,
        preferredTicketSize: 600000000,
        revenueMin: 200000000,
        revenueMax: 600000000,
        transactionTypes: ["FULL_ACQUISITION"],
        controlPreference: "FULL_CONTROL",
        strategicObjectives: ["OPERATIONAL_SCALE"],
        profitableBusinessesOnly: true,
        investmentHorizon: "LONG_TERM",
        fundingSource: "FUND_CAPITAL",
        targetIndustries: [
          {
            industry: "Defense & Aerospace",
            subSectors: ["Precision Machining"],
          },
        ],
        targetGeographies: [
          {
            region: "WEST_INDIA",
            states: ["Maharashtra"],
            cities: ["Pune"],
          },
        ],
      }
    );
    mandateAId = mandARes.id;

    // 2. Provision Buyer B
    const buyerBReg = await registerUser({
      email: `buyer_b_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Bhavin",
      lastName: "Ventures",
      roles: ["BUYER"],
    });
    buyerBUser = buyerBReg.user;

    const bProfileB = await db.query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'PE_FUND', 'Bhavin Capital Partners', 'FUND', 'India', 'Karnataka', 'Bengaluru',
        'Bhavin Patel', 'Partner', $2, '+91 9999999902', 'VERIFIED')
      RETURNING id`,
      [buyerBUser.id, buyerBUser.email]
    );
    buyerBProfileId = bProfileB.rows[0].id;

    // Mandate for Buyer B (Seeking Healthcare, South India)
    const mandBRes = await createAcquisitionMandate(
      buyerBUser,
      {
        name: "South Indian Healthcare Rollup",
        minInvestment: 100000000,
        maxInvestment: 500000000,
        revenueMin: 50000000,
        revenueMax: 300000000,
        transactionTypes: ["MAJORITY_STAKE"],
        controlPreference: "MAJORITY_CONTROL",
        strategicObjectives: ["MARKET_EXPANSION"],
        profitableBusinessesOnly: true,
        investmentHorizon: "MEDIUM_TERM",
        fundingSource: "OWN_CAPITAL",
        targetIndustries: [
          {
            industry: "Healthcare",
            subSectors: ["Specialty Clinics"],
          },
        ],
        targetGeographies: [
          {
            region: "SOUTH_INDIA",
            states: ["Karnataka"],
            cities: ["Bengaluru"],
          },
        ],
      }
    );
    mandateBId = mandBRes.id;

    // 3. Provision Seller & Admin
    const sellerReg = await registerUser({
      email: `seller_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Somesh",
      lastName: "Promoter",
      roles: ["PROMOTER"],
    });
    sellerUser = sellerReg.user;

    const adminReg = await registerUser({
      email: `admin_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Super",
      lastName: "Admin",
      roles: ["PROMOTER"],
    });
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = 'SUPER_ADMIN'
       ON CONFLICT DO NOTHING`,
      [adminReg.user.id]
    );
    const adminLogin = await loginUser({ email: adminReg.user.email, password: "Password123!Secure" });
    adminUser = adminLogin.user;

    // 4. Create Opportunities
    // Opp 1: Published Defense & Aerospace Opp (Matches Buyer A)
    const opp1 = await createOpportunity(sellerUser, {
      title: "Bharat Precision Defense Dynamics",
      headline: "Leading AS9100D Certified Defense Machining",
      teaserSummary: "High-precision 5-axis machining with multi-year defense contracts.",
      industry: "Defense & Aerospace",
      subSector: "Precision Machining",
      businessCategory: BusinessCategory.MANUFACTURING,
      operatingRegion: OperatingRegion.WEST_INDIA,
      registeredState: "Maharashtra",
      registeredCity: "Pune",
      approximateAgeBracket: BusinessAgeBracket.YRS_10_TO_20,
      revenueBracket: RevenueBracket.CR_25_TO_50,
      transactionType: OpportunityTransactionType.FULL_ACQUISITION,
      businessModel: BusinessModel.B2B,
      yearEstablished: 2012,
      employeeRange: "51_TO_200",
      ebitdaMarginBracket: "20_TO_30_PCT",
      askingPriceBracket: "50CR_TO_100CR",
      exactLegalName: "Confidential Defense Dynamics Pvt Ltd",
      exactCin: "U29253MH2012PTC234567",
      exactGstin: "27AABCB9876C1Z8",
      exactPan: "AABCB9876C",
      exactAddress: "Plot 88, Bhosari MIDC, Pune",
      exactRevenue: 425000000,
      exactEbitda: 98000000,
      exactAskingPrice: 650000000,
    });
    publishedOppId = opp1.id;

    // Submit for review, then review, verify, and publish Opp 1
    await submitOpportunity(publishedOppId, sellerUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.START_REVIEW, {}, adminUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.VERIFY, {}, adminUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.PUBLISH, {}, adminUser);

    // Opp 2: Draft Opportunity (Must NEVER be matched or discovered)
    const opp2 = await createOpportunity(sellerUser, {
      title: "Secret Quantum Chipset Lab",
      teaserSummary: "Unpublished semiconductor company.",
      industry: "Defense & Aerospace",
      businessCategory: BusinessCategory.TECHNOLOGY,
      operatingRegion: OperatingRegion.WEST_INDIA,
      registeredState: "Maharashtra",
      approximateAgeBracket: BusinessAgeBracket.LESS_THAN_3_YRS,
      revenueBracket: RevenueBracket.UNDER_5CR,
      transactionType: OpportunityTransactionType.FULL_ACQUISITION,
      businessModel: BusinessModel.B2B,
    });
    draftOppId = opp2.id;
  });

  // -------------------------------------------------------------------------
  // 1. REFRESH & PERSISTENCE TESTS
  // -------------------------------------------------------------------------
  it("REFRESH: successfully calculates and persists matches for buyer mandates", async () => {
    const res = await refreshBuyerMatches(buyerAUser);
    expect(res.refreshedCount).toBeGreaterThanOrEqual(1);
    expect(res.eligibleCount).toBeGreaterThanOrEqual(1);
    expect(res.topScore).toBeGreaterThanOrEqual(80);
  });

  it("PUBLISHED ISOLATION: strictly excludes DRAFT opportunities from match results", async () => {
    const res = await listBuyerMatches(buyerAUser, { isEligibleOnly: false });
    const containsDraft = res.items.some((m) => m.opportunityId === draftOppId);
    expect(containsDraft).toBe(false);
  });

  // -------------------------------------------------------------------------
  // 2. LISTING & PAGINATION TESTS
  // -------------------------------------------------------------------------
  it("LIST: lists matches with pagination and metadata", async () => {
    const listRes = await listBuyerMatches(buyerAUser, { page: 1, limit: 10 });
    expect(listRes.items.length).toBeGreaterThanOrEqual(1);
    expect(listRes.total).toBeGreaterThanOrEqual(1);
    expect(listRes.page).toBe(1);

    const firstMatch = listRes.items[0];
    expect(firstMatch.opportunityId).toBe(publishedOppId);
    expect(firstMatch.score).toBeGreaterThanOrEqual(80);
    expect(firstMatch.isEligible).toBe(true);
    expect(firstMatch.mandateName).toBe("Western Defense Buyout Mandate");
  });

  it("SORTING: sorts deterministically by score descending", async () => {
    const listRes = await listBuyerMatches(buyerAUser, { sortBy: "score", sortOrder: "desc" });
    for (let i = 1; i < listRes.items.length; i++) {
      expect(listRes.items[i - 1].score).toBeGreaterThanOrEqual(listRes.items[i].score);
    }
  });

  // -------------------------------------------------------------------------
  // 3. ANTI-IDOR & MULTI-TENANT ISOLATION TESTS
  // -------------------------------------------------------------------------
  it("ANTI-IDOR: Buyer B cannot see Buyer A's private match records", async () => {
    const buyerAList = await listBuyerMatches(buyerAUser);
    const matchAId = buyerAList.items[0].id;

    // Buyer B attempts to directly request Buyer A's match
    await expect(getBuyerMatchById(matchAId, buyerBUser)).rejects.toThrow(ForbiddenError);
  });

  it("ANTI-IDOR: Buyer B match listing only contains Buyer B matches", async () => {
    await refreshBuyerMatches(buyerBUser);
    const buyerBList = await listBuyerMatches(buyerBUser);

    // None of Buyer B's matches should link to Buyer A's mandate
    for (const item of buyerBList.items) {
      expect(item.mandateId).toBe(mandateBId);
      expect(item.mandateId).not.toBe(mandateAId);
    }
  });

  it("PRIVILEGE SEPARATION: Seller user is blocked from matching endpoints", async () => {
    // Seller does not have a buyer profile
    await expect(refreshBuyerMatches(sellerUser)).rejects.toThrow(NotFoundError);
  });

  it("ADMIN ACCESS: Authorized admin can inspect global matches", async () => {
    const adminList = await listAdminMatches(adminUser, { page: 1, limit: 10 });
    expect(adminList.items.length).toBeGreaterThanOrEqual(1);
    expect(adminList.total).toBeGreaterThanOrEqual(1);
  });

  it("ADMIN RBAC: Commercial buyer cannot call admin matching directory", async () => {
    await expect(listAdminMatches(buyerAUser)).rejects.toThrow(ForbiddenError);
  });

  // -------------------------------------------------------------------------
  // 4. PROGRESSIVE DATA MASKING & CONFIDENTIALITY PRESERVATION
  // -------------------------------------------------------------------------
  it("DATA MASKING: Attached opportunity strictly masks statutory identities (Tier 1 view)", async () => {
    const listRes = await listBuyerMatches(buyerAUser);
    const matchedOpp = listRes.items[0].opportunity;

    // Disclosed commercial properties
    expect(matchedOpp.title).toBe("Bharat Precision Defense Dynamics");
    expect(matchedOpp.industry).toBe("Defense & Aerospace");
    expect(matchedOpp.revenueBracket).toBe("25CR_TO_50CR");

    // SEALED CONFIDENTIAL FIELDS (MUST BE UNDEFINED)
    expect((matchedOpp as any).exactLegalName).toBeUndefined();
    expect((matchedOpp as any).exactTradeName).toBeUndefined();
    expect((matchedOpp as any).exactCin).toBeUndefined();
    expect((matchedOpp as any).exactGstin).toBeUndefined();
    expect((matchedOpp as any).exactPan).toBeUndefined();
    expect((matchedOpp as any).exactAddress).toBeUndefined();
    expect((matchedOpp as any).exactRevenue).toBeUndefined();
    expect((matchedOpp as any).exactEbitda).toBeUndefined();
    expect((matchedOpp as any).exactAskingPrice).toBeUndefined();
    expect((matchedOpp as any).documents).toBeUndefined();
  });

  it("CONFIDENTIALITY IN EXPLANATIONS: Explanations never contain statutory strings", async () => {
    const listRes = await listBuyerMatches(buyerAUser);
    const match = listRes.items[0];

    const allReasons = match.reasons.join(" ") + " " + match.matchedCriteria.join(" ");

    expect(allReasons).not.toContain("U29253MH2012PTC234567");
    expect(allReasons).not.toContain("27AABCB9876C1Z8");
    expect(allReasons).not.toContain("AABCB9876C");
    expect(allReasons).not.toContain("Plot 88");
    expect(allReasons).not.toContain("Confidential Defense Dynamics Pvt Ltd");
  });
});
