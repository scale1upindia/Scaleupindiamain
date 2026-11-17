import { describe, it, expect, beforeAll } from "vitest";
import { getDb, resetTestDb } from "@/lib/db";
import { registerUser, loginUser } from "@/domains/auth/service";
import {
  createAcquisitionMandate,
  updateAcquisitionMandate,
  deleteAcquisitionMandate,
} from "@/domains/buyer/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  updateOpportunity,
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
} from "@/types/opportunity";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";
import { MATCHING_ALGORITHM_VERSION } from "@/domains/matching/weights";

describe("Phase 5.1: Match Integrity & Stale Data Elimination Tests", () => {
  let buyerAUser: AuthenticatedUser;
  let buyerBUser: AuthenticatedUser;
  let sellerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  let buyerAProfileId: string;
  let buyerBProfileId: string;
  let mandateAId: string;
  let mandateBId: string;

  let publishedOppId: string;

  beforeAll(async () => {
    await resetTestDb();
    const db = await getDb();
    const ts = Date.now();

    // 1. Provision Buyer A
    const bAReg = await registerUser({
      email: `integ_buyer_a_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Aarav",
      lastName: "Capital",
      roles: ["BUYER"],
    });
    buyerAUser = bAReg.user;

    const bProfA = await db.query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'CORPORATE_BUYER', 'Aarav Corp', 'COMPANY', 'India', 'Maharashtra', 'Mumbai',
        'Aarav Sharma', 'Director', $2, '+91 9999999101', 'VERIFIED')
      RETURNING id`,
      [buyerAUser.id, buyerAUser.email]
    );
    buyerAProfileId = bProfA.rows[0].id;

    // Mandate A: Defense & Aerospace in Maharashtra, 30-80 Cr
    const mandA = await createAcquisitionMandate(buyerAUser, {
      name: "Strategic Defense Buyout",
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
    });
    mandateAId = mandA.id;

    // 2. Provision Buyer B
    const bBReg = await registerUser({
      email: `integ_buyer_b_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Bhavin",
      lastName: "Ventures",
      roles: ["BUYER"],
    });
    buyerBUser = bBReg.user;

    const bProfB = await db.query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'PE_FUND', 'Bhavin Fund', 'FUND', 'India', 'Karnataka', 'Bengaluru',
        'Bhavin Patel', 'Partner', $2, '+91 9999999102', 'VERIFIED')
      RETURNING id`,
      [buyerBUser.id, buyerBUser.email]
    );
    buyerBProfileId = bProfB.rows[0].id;

    const mandB = await createAcquisitionMandate(buyerBUser, {
      name: "Healthcare Expansion Mandate",
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
          subSectors: ["Clinics"],
        },
      ],
      targetGeographies: [
        {
          region: "SOUTH_INDIA",
          states: ["Karnataka"],
          cities: ["Bengaluru"],
        },
      ],
    });
    mandateBId = mandB.id;

    // 3. Provision Seller & Admin
    const sReg = await registerUser({
      email: `integ_seller_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "Devendra",
      lastName: "Promoter",
      roles: ["PROMOTER"],
    });
    sellerUser = sReg.user;
    await db.query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Promoter', '+91 9999999103', $2, 'VERIFIED')`,
      [sellerUser.id, sellerUser.email]
    );

    const aReg = await registerUser({
      email: `integ_admin_${ts}@scaleup.test`,
      password: "Password123!Secure",
      firstName: "System",
      lastName: "Auditor",
      roles: ["PROMOTER"],
    });
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE code = 'SUPER_ADMIN'
       ON CONFLICT DO NOTHING`,
      [aReg.user.id]
    );
    const aLogin = await loginUser({ email: aReg.user.email, password: "Password123!Secure" });
    adminUser = aLogin.user;

    // 4. Create and Publish Baseline Opportunity (Opp 1)
    const opp = await createOpportunity(sellerUser, {
      title: "Bharat Precision Dynamics Enterprise",
      headline: "AS9100D Certified Defense Machining",
      teaserSummary: "High-precision 5-axis CNC machining manufacturer with multi-year defense contracts.",
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
      exactLegalName: "Confidential Bharat Dynamics Private Limited",
      exactCin: "U29253MH2012PTC234567",
      exactGstin: "27AABCB9876C1Z8",
      exactPan: "AABCB9876C",
      exactAddress: "Plot 88, Bhosari MIDC, Pune",
      exactRevenue: 425000000,
      exactEbitda: 98000000,
      exactAskingPrice: 650000000,
    });
    publishedOppId = opp.id;

    await submitOpportunity(publishedOppId, sellerUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.START_REVIEW, {}, adminUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.VERIFY, {}, adminUser);
    await executeAdminOpportunityReview(publishedOppId, AdminOpportunityReviewAction.PUBLISH, {}, adminUser);
  });

  // -------------------------------------------------------------------------
  // 1. STALE MATCH SCENARIOS
  // -------------------------------------------------------------------------

  it("CASE A: Mandate modification immediately purges stale match records", async () => {
    // 1. Calculate matches initially
    const initial = await refreshBuyerMatches(buyerAUser);
    expect(initial.eligibleCount).toBe(1);

    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    // 2. Update Mandate A: change target industry to "Logistics" (no longer matching Defense Opp)
    await updateAcquisitionMandate(mandateAId, buyerAUser, {
      name: "Updated Logistics Mandate",
      minInvestment: 300000000,
      maxInvestment: 800000000,
      revenueMin: 200000000,
      revenueMax: 600000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["OPERATIONAL_SCALE"],
      profitableBusinessesOnly: true,
      investmentHorizon: "LONG_TERM",
      fundingSource: "FUND_CAPITAL",
      targetIndustries: [{ industry: "Logistics", subSectors: ["Cold Chain"] }],
      targetGeographies: [{ region: "WEST_INDIA", states: ["Maharashtra"], cities: ["Pune"] }],
    });

    // 3. Stale match should be purged from listing
    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Restore mandate back to Defense for subsequent tests
    await updateAcquisitionMandate(mandateAId, buyerAUser, {
      name: "Strategic Defense Buyout",
      minInvestment: 300000000,
      maxInvestment: 800000000,
      revenueMin: 200000000,
      revenueMax: 600000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["OPERATIONAL_SCALE"],
      profitableBusinessesOnly: true,
      investmentHorizon: "LONG_TERM",
      fundingSource: "FUND_CAPITAL",
      targetIndustries: [{ industry: "Defense & Aerospace", subSectors: ["Precision Machining"] }],
      targetGeographies: [{ region: "WEST_INDIA", states: ["Maharashtra"], cities: ["Pune"] }],
    });
  });

  it("CASE B & C: Opportunity modification purges stale match records", async () => {
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    // Modify opportunity parameters via admin
    await updateOpportunity(publishedOppId, adminUser, {
      facilityDetails: "Updated facility details triggering cache invalidation",
    });

    // Stale match record is purged from active matches until re-evaluated
    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);
  });

  it("CASE D: Opportunity becoming SUSPENDED removes it from active matches", async () => {
    // Re-evaluate
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    // Admin suspends the opportunity
    await executeAdminOpportunityReview(
      publishedOppId,
      AdminOpportunityReviewAction.SUSPEND,
      { suspensionReason: "Statutory license dispute" },
      adminUser
    );

    // Stale match is purged
    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Direct match fetch by ID also fails with NotFoundError
    const matchId = listBefore.items[0].id;
    await expect(getBuyerMatchById(matchId, buyerAUser)).rejects.toThrow(NotFoundError);

    // Restore opportunity to PUBLISHED state
    const db = await getDb();
    await db.query(
      `UPDATE opportunities SET status = 'PUBLISHED', suspension_reason = NULL WHERE id = $1`,
      [publishedOppId]
    );
  });

  it("CASE E: Opportunity becoming REJECTED removes it from active matches", async () => {
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    // Change status to SUBMITTED to allow rejection
    const db = await getDb();
    await db.query(`UPDATE opportunities SET status = 'SUBMITTED' WHERE id = $1`, [publishedOppId]);

    await executeAdminOpportunityReview(
      publishedOppId,
      AdminOpportunityReviewAction.REJECT,
      { rejectionReason: "Failed MCA filing verification" },
      adminUser
    );

    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Restore to PUBLISHED
    await db.query(
      `UPDATE opportunities SET status = 'PUBLISHED', rejection_reason = NULL WHERE id = $1`,
      [publishedOppId]
    );
  });

  it("CASE G: Opportunity becoming UNPUBLISHED removes it from active matches", async () => {
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    await executeAdminOpportunityReview(
      publishedOppId,
      AdminOpportunityReviewAction.UNPUBLISH,
      {},
      adminUser
    );

    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Re-publish
    await executeAdminOpportunityReview(
      publishedOppId,
      AdminOpportunityReviewAction.PUBLISH,
      {},
      adminUser
    );
  });

  it("CASE H: Archiving/deleting buyer mandate removes its matches", async () => {
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);

    // Delete mandate
    await deleteAcquisitionMandate(mandateAId, buyerAUser);

    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Un-archive mandate for subsequent tests
    const db = await getDb();
    await db.query(
      `UPDATE acquisition_mandates SET deleted_at = NULL, status = 'ACTIVE' WHERE id = $1`,
      [mandateAId]
    );
  });

  it("CASE I: Old matching_version records are excluded from active match queries", async () => {
    await refreshBuyerMatches(buyerAUser);
    const listBefore = await listBuyerMatches(buyerAUser);
    expect(listBefore.items.length).toBe(1);
    const matchId = listBefore.items[0].id;

    // Simulate a legacy matching version stored in DB
    const db = await getDb();
    await db.query(
      `UPDATE buyer_opportunity_matches SET matching_version = 'v0.9.0-legacy' WHERE id = $1`,
      [matchId]
    );

    // Legacy version is excluded from current results
    const listAfter = await listBuyerMatches(buyerAUser);
    expect(listAfter.items.length).toBe(0);

    // Direct fetch rejects expired legacy version
    await expect(getBuyerMatchById(matchId, buyerAUser)).rejects.toThrow(NotFoundError);

    // Restore matching_version
    await db.query(
      `UPDATE buyer_opportunity_matches SET matching_version = $1 WHERE id = $2`,
      [MATCHING_ALGORITHM_VERSION, matchId]
    );
  });

  // -------------------------------------------------------------------------
  // 2. REFRESH IDEMPOTENCY & DETERMINISM
  // -------------------------------------------------------------------------

  it("IDEMPOTENCE: Repeated refresh with identical DB state produces zero drift and no duplicate rows", async () => {
    const db = await getDb();

    const run1 = await refreshBuyerMatches(buyerAUser);
    const count1 = await db.query(
      `SELECT COUNT(*) as count FROM buyer_opportunity_matches WHERE buyer_id = $1`,
      [buyerAUser.id]
    );

    const run2 = await refreshBuyerMatches(buyerAUser);
    const count2 = await db.query(
      `SELECT COUNT(*) as count FROM buyer_opportunity_matches WHERE buyer_id = $1`,
      [buyerAUser.id]
    );

    expect(run1.refreshedCount).toBe(run2.refreshedCount);
    expect(run1.eligibleCount).toBe(run2.eligibleCount);
    expect(run1.topScore).toBe(run2.topScore);
    expect(count1.rows[0].count).toBe(count2.rows[0].count);
  });

  // -------------------------------------------------------------------------
  // 3. AUTHORITATIVE STATE & CLIENT TAMPER DEFENSE
  // -------------------------------------------------------------------------

  it("AUTHORITATIVE STATE: Buyer identity is taken from session, not client query override", async () => {
    // Buyer A calls list matches with injected buyerId query param
    const res = await listBuyerMatches(buyerAUser, { buyerId: buyerBUser.id } as any);
    for (const item of res.items) {
      expect(item.mandateName).toBe("Strategic Defense Buyout");
      expect(item.mandateName).not.toBe("Healthcare Expansion Mandate");
    }
  });

  it("REFERENTIAL INTEGRITY: Matches strictly enforce foreign key cascades (No orphans)", async () => {
    const db = await getDb();
    const orphans = await db.query(
      `SELECT bom.id 
       FROM buyer_opportunity_matches bom
       LEFT JOIN users u ON bom.buyer_id = u.id
       LEFT JOIN buyer_profiles bp ON bom.buyer_profile_id = bp.id
       LEFT JOIN acquisition_mandates am ON bom.mandate_id = am.id
       LEFT JOIN opportunities o ON bom.opportunity_id = o.id
       WHERE u.id IS NULL OR bp.id IS NULL OR am.id IS NULL OR o.id IS NULL`
    );
    expect(orphans.rows.length).toBe(0);
  });
});
