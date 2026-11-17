// Scale-up India — Phase 7: Expression of Interest (EOI) Comprehensive Test Suite
// Path: tests/eoi_workflow.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  getOpportunityForDiscovery,
} from "@/domains/opportunity/service";
import { createAcquisitionMandate } from "@/domains/buyer/service";
import {
  submitEOI,
  getBuyerEOIs,
  getBuyerEOIById,
  withdrawEOI,
  getSellerEOIs,
  getSellerEOIById,
  acceptEOI,
  declineEOI,
  requestClarification,
  provideClarification,
} from "@/domains/eoi/service";
import {
  getUserNotifications,
  markNotificationRead,
} from "@/domains/notifications/service";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

describe("Phase 7: Expression of Interest (EOI) & Bilateral Interest Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let seller1ProfileId: string;
  let seller2ProfileId: string;
  let buyer1ProfileId: string;
  let buyer2ProfileId: string;
  let buyer1MandateId: string;

  let opp1PublishedId: string;
  let opp2PublishedId: string;
  let oppDraftId: string;
  let oppRejectedId: string;
  let oppSuspendedId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Provision Seller 1
    const regSeller1 = await registerUser({
      email: "seller1@enterprise.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;

    const s1ProfRes = await query<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988776655', 'seller1@enterprise.in', 'VERIFIED', 100) RETURNING id`,
      [seller1.id]
    );
    seller1ProfileId = s1ProfRes.rows[0].id;

    // 2. Provision Seller 2
    const regSeller2 = await registerUser({
      email: "seller2@pharma.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;

    const s2ProfRes = await query<{ id: string }>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988776656', 'seller2@pharma.in', 'VERIFIED', 100) RETURNING id`,
      [seller2.id]
    );
    seller2ProfileId = s2ProfRes.rows[0].id;

    // 3. Provision Buyer 1
    const regBuyer1 = await registerUser({
      email: "buyer1@investments.in",
      firstName: "Rajesh",
      lastName: "Nair",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer1 = regBuyer1.user;

    const b1ProfRes = await query<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Alpha Strategic Capital Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
        'Rajesh Nair', 'Head of M&A', 'buyer1@investments.in', '+919876543210', 'VERIFIED', 'Precision Engineering'
      ) RETURNING id`,
      [buyer1.id]
    );
    buyer1ProfileId = b1ProfRes.rows[0].id;

    const m1 = await createAcquisitionMandate(buyer1, {
      name: "Strategic Manufacturing Buyout Mandate",
      minInvestment: 100000000,
      maxInvestment: 500000000,
      transactionTypes: ["FULL_ACQUISITION", "MAJORITY_STAKE"],
    });
    buyer1MandateId = m1.id;

    // 4. Provision Buyer 2
    const regBuyer2 = await registerUser({
      email: "buyer2@familyoffice.in",
      firstName: "Kavita",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer2 = regBuyer2.user;

    const b2ProfRes = await query<{ id: string }>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'FAMILY_OFFICE', 'Mehta Heritage Ventures', 'FAMILY_OFFICE', 'Gujarat', 'Ahmedabad',
        'Kavita Mehta', 'Managing Trustee', 'buyer2@familyoffice.in', '+919876543211', 'VERIFIED', 'Healthcare'
      ) RETURNING id`,
      [buyer2.id]
    );
    buyer2ProfileId = b2ProfRes.rows[0].id;

    // 5. Provision Admin
    const regAdmin = await registerUser({
      email: "admin.eoi@scaleup.in",
      firstName: "Chief",
      lastName: "Administrator",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: ["opportunities.publish", "eoi.manage", "eoi.read_all"],
    };

    // 6. Seed Opportunity 1 (Seller 1 -> Published)
    const opp1 = await createOpportunity(seller1, {
      title: "Precision Aerospace & Defense Component Manufacturer",
      headline: "AS9100 Certified Precision Engineering Undertaking",
      teaserSummary: "Tier-1 aerospace engineering facility with long-term defense contracts.",
      businessCategory: "MANUFACTURING",
      industry: "Precision Engineering",
      subSector: "Aerospace Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
      ebitdaMarginBracket: "20_TO_30_PCT",
      askingPriceBracket: "25CR_TO_50CR",
    });
    await submitOpportunity(opp1.id, seller1);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
    opp1PublishedId = pubOpp1.id;

    // 7. Seed Opportunity 2 (Seller 2 -> Published)
    const opp2 = await createOpportunity(seller2, {
      title: "Advanced Oncology Clinical Diagnostic Chain",
      headline: "Specialty Diagnostic Center Network",
      teaserSummary: "Network of 8 accredited specialty oncology labs.",
      businessCategory: "HEALTHCARE",
      industry: "Healthcare & Lifesciences",
      subSector: "Diagnostic Laboratories",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "B2C",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "10CR_TO_25CR",
    });
    await submitOpportunity(opp2.id, seller2);
    await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
    const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);
    opp2PublishedId = pubOpp2.id;

    // 8. Seed Opportunity Draft (Seller 1)
    const oppDraft = await createOpportunity(seller1, {
      title: "Unpublished Precision Plant Expansion",
      teaserSummary: "Confidential unreleased expansion draft.",
      businessCategory: "MANUFACTURING",
      industry: "Precision Engineering",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Haryana",
      approximateAgeBracket: "3_TO_5_YRS",
      revenueBracket: "5CR_TO_15CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    oppDraftId = oppDraft.id;

    // 9. Seed Opportunity Rejected (Seller 1)
    const oppRej = await createOpportunity(seller1, {
      title: "Sub-par Workshop Undertaking",
      teaserSummary: "Defunct component fabrication unit.",
      businessCategory: "MANUFACTURING",
      industry: "General Engineering",
      operatingRegion: "EAST_INDIA",
      registeredState: "West Bengal",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "UNDER_5CR",
      transactionType: "ASSET_SALE",
      businessModel: "B2B",
    });
    await submitOpportunity(oppRej.id, seller1);
    await executeAdminOpportunityReview(oppRej.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(oppRej.id, "REJECT", { rejectionReason: "Incomplete documentation" }, admin);
    oppRejectedId = oppRej.id;

    // 10. Seed Opportunity Suspended (Seller 1)
    const oppSusp = await createOpportunity(seller1, {
      title: "Suspended Marine Foundry Undertaking",
      teaserSummary: "Marine parts casting facility.",
      businessCategory: "MANUFACTURING",
      industry: "Marine Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Gujarat",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    await submitOpportunity(oppSusp.id, seller1);
    await executeAdminOpportunityReview(oppSusp.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(oppSusp.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(oppSusp.id, "PUBLISH", {}, admin);
    await executeAdminOpportunityReview(oppSusp.id, "SUSPEND", { suspensionReason: "Promoter regulatory dispute" }, admin);
    oppSuspendedId = oppSusp.id;
  });

  // ==========================================
  // PART 1: SUBMISSION ELIGIBILITY & VALIDATION
  // ==========================================

  it("1. Buyer 1 can submit a valid Expression of Interest for published opportunity", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout with 2-year retention",
      indicativeOfferRange: "25CR_TO_50CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage:
        "Alpha Strategic Capital is actively seeking precision aerospace facilities with AS9100 certification. We possess immediate deployable capital.",
      mandateId: buyer1MandateId,
    });

    expect(eoi.id).toBeDefined();
    expect(eoi.referenceCode).toMatch(/^EOI-2026-\d+$/);
    expect(eoi.status).toBe("SUBMITTED");
    expect(eoi.opportunityId).toBe(opp1PublishedId);
    expect(eoi.opportunityReference).toBeDefined();
  });

  it("2. Promoter cannot submit EOI for their own opportunity (Anti-self-submission)", async () => {
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES (
        $1, 'INDIVIDUAL_INVESTOR', 'Vikram Private Office', 'INDIVIDUAL', 'Maharashtra', 'Mumbai',
        'Vikram Singhania', 'Investor', 'seller1@enterprise.in', '+919988776655', 'VERIFIED'
      ) ON CONFLICT DO NOTHING`,
      [seller1.id]
    );

    await expect(
      submitEOI(seller1, opp1PublishedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Self buyback",
        investmentTimeline: "FLEXIBLE",
        buyerMessage: "Attempting to express interest in my own company with valid message length.",
      })
    ).rejects.toThrow("Promoters and sellers cannot submit an Expression of Interest for their own opportunity.");
  });

  it("3. User without an active buyer profile cannot submit EOI", async () => {
    const unprofiled = await registerUser({
      email: "nobuyerprofile@guest.in",
      firstName: "Unprofiled",
      lastName: "User",
      password: "Password@123",
      roles: ["BUYER"],
    });

    await expect(
      submitEOI(unprofiled.user, opp1PublishedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "100% Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "I do not have a buyer profile yet but want to buy this company.",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("4. EOI submission against an unpublished DRAFT returns uniform 404", async () => {
    await expect(
      submitEOI(buyer1, oppDraftId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Attempting to submit EOI against a draft opportunity.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("5. EOI submission against a REJECTED opportunity returns uniform 404", async () => {
    await expect(
      submitEOI(buyer1, oppRejectedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Attempting to submit EOI against a rejected opportunity.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("6. EOI submission against a SUSPENDED opportunity returns uniform 404", async () => {
    await expect(
      submitEOI(buyer1, oppSuspendedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Attempting to submit EOI against a suspended opportunity.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("7. EOI submission against a soft-deleted opportunity returns uniform 404", async () => {
    await query(`UPDATE opportunities SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      opp1PublishedId,
    ]);

    await expect(
      submitEOI(buyer1, opp1PublishedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Attempting to submit against a deleted opportunity.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("8. EOI submission against a non-existent UUID returns uniform 404", async () => {
    await expect(
      submitEOI(buyer1, "00000000-0000-0000-0000-000000000000", {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Attempting to submit against nonexistent UUID.",
      })
    ).rejects.toThrow(NotFoundError);
  });

  it("9. Submission with buyer message shorter than 20 chars throws validation error", async () => {
    await expect(
      submitEOI(buyer1, opp1PublishedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Too short message",
      })
    ).rejects.toThrow();
  });

  it("10. Submission with another buyer's mandate ID is rejected", async () => {
    // Mandate belonging to buyer1 attempted by buyer2
    await expect(
      submitEOI(buyer2, opp1PublishedId, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Buyout",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage:
          "Mehta Family Office is expressing interest but trying to attach Buyer 1 mandate.",
        mandateId: buyer1MandateId,
      })
    ).rejects.toThrow(ValidationError);
  });

  // ==========================================
  // PART 2: CONCURRENCY & DUPLICATE PREVENTION
  // ==========================================

  it("11. Duplicate active EOI by same buyer for same opportunity is blocked with ConflictError", async () => {
    await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout 1",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "First valid submission from Alpha Capital for aerospace opportunity.",
    });

    await expect(
      submitEOI(buyer1, opp1PublishedId, {
        interestType: "MAJORITY_STAKE",
        proposedTransactionType: "Buyout 2",
        investmentTimeline: "IMMEDIATE_30_DAYS",
        buyerMessage: "Second duplicate submission from Alpha Capital for aerospace opportunity.",
      })
    ).rejects.toThrow(ConflictError);
  });

  it("12. Simultaneous race-condition submissions safely enforce unique constraint", async () => {
    const payload = {
      interestType: "FULL_ACQUISITION" as const,
      proposedTransactionType: "Buyout Simultaneous",
      investmentTimeline: "1_TO_3_MONTHS" as const,
      buyerMessage: "Concurrent attempt submission testing race condition defense.",
    };

    const results = await Promise.allSettled([
      submitEOI(buyer1, opp1PublishedId, payload),
      submitEOI(buyer1, opp1PublishedId, payload),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictError);
  });

  it("13. After an EOI is WITHDRAWN, buyer can submit a new EOI for the same opportunity", async () => {
    const eoi1 = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Initial Buyout Structure",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Initial commercial interest submitted before strategic reassessment.",
    });

    // Withdraw the EOI
    await withdrawEOI(buyer1, eoi1.id);

    // Resubmission should now succeed
    const eoi2 = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "MAJORITY_STAKE",
      proposedTransactionType: "Restructured Majority Investment",
      investmentTimeline: "IMMEDIATE_30_DAYS",
      buyerMessage: "Revised acquisition proposal after restructuring our investment committee.",
    });

    expect(eoi2.id).toBeDefined();
    expect(eoi2.id).not.toBe(eoi1.id);
    expect(eoi2.status).toBe("SUBMITTED");
  });

  // ==========================================
  // PART 3: ANTI-IDOR AUTHORIZATION
  // ==========================================

  it("14. Buyer 1 can view their own submitted EOI", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Legitimate inquiry from Alpha Strategic Capital.",
    });

    const retrieved = await getBuyerEOIById(buyer1, submitted.id);
    expect(retrieved.id).toBe(submitted.id);
    expect(retrieved.referenceCode).toBe(submitted.referenceCode);
  });

  it("15. Buyer 2 CANNOT view Buyer 1's submitted EOI (Anti-IDOR ForbiddenError)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Legitimate inquiry from Alpha Strategic Capital.",
    });

    await expect(getBuyerEOIById(buyer2, submitted.id)).rejects.toThrow(ForbiddenError);
  });

  it("16. Buyer 2 CANNOT withdraw Buyer 1's submitted EOI (Anti-IDOR ForbiddenError)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Legitimate inquiry from Alpha Strategic Capital.",
    });

    await expect(withdrawEOI(buyer2, submitted.id)).rejects.toThrow(ForbiddenError);
  });

  it("17. Seller 1 can view received EOI on their own opportunity", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Legitimate inquiry from Alpha Strategic Capital.",
    });

    const retrieved = await getSellerEOIById(seller1, submitted.id);
    expect(retrieved.id).toBe(submitted.id);
    expect(retrieved.buyerEntityType).toBe("COMPANY");
  });

  it("18. Seller 2 CANNOT view EOI received for Seller 1's opportunity (Anti-IDOR ForbiddenError)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Inquiry intended for Seller 1's precision asset.",
    });

    await expect(getSellerEOIById(seller2, submitted.id)).rejects.toThrow(ForbiddenError);
  });

  it("19. Seller 2 CANNOT accept EOI received for Seller 1's opportunity (Anti-IDOR ForbiddenError)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Inquiry intended for Seller 1.",
    });

    await expect(
      acceptEOI(seller2, submitted.id, { sellerResponseMessage: "Unauthorized acceptance." })
    ).rejects.toThrow(ForbiddenError);
  });

  it("20. Seller 2 CANNOT decline EOI received for Seller 1's opportunity (Anti-IDOR ForbiddenError)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Inquiry intended for Seller 1.",
    });

    await expect(
      declineEOI(seller2, submitted.id, {
        sellerDeclineReason: "VALUATION_MISMATCH",
        sellerResponseMessage: "Unauthorized decline.",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 4: STATE MACHINE LIFECYCLE & TRANSITIONS
  // ==========================================

  it("21. Initial submission state is SUBMITTED", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing state machine initial state on submission.",
    });

    expect(submitted.status).toBe("SUBMITTED");
  });

  it("22. First seller inspection transitions EOI from SUBMITTED to UNDER_REVIEW", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing transition to UNDER_REVIEW upon seller inspection.",
    });

    const viewed = await getSellerEOIById(seller1, submitted.id);
    expect(viewed.status).toBe("UNDER_REVIEW");
    expect(viewed.reviewedAt).toBeDefined();
  });

  it("23. Buyer can withdraw EOI while in SUBMITTED state", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing withdrawal from SUBMITTED state.",
    });

    const withdrawn = await withdrawEOI(buyer1, submitted.id);
    expect(withdrawn.status).toBe("WITHDRAWN");
    expect(withdrawn.withdrawnAt).toBeDefined();
  });

  it("24. Buyer can withdraw EOI while in UNDER_REVIEW state", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing withdrawal from UNDER_REVIEW state.",
    });

    await getSellerEOIById(seller1, submitted.id); // Triggers UNDER_REVIEW
    const withdrawn = await withdrawEOI(buyer1, submitted.id);
    expect(withdrawn.status).toBe("WITHDRAWN");
  });

  it("25. Seller can accept EOI while in UNDER_REVIEW state", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing formal seller acceptance workflow.",
    });

    const accepted = await acceptEOI(seller1, submitted.id, {
      sellerResponseMessage: "Pleased to proceed toward bilateral NDA.",
    });

    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.acceptedAt).toBeDefined();
    expect(accepted.sellerResponseMessage).toBe("Pleased to proceed toward bilateral NDA.");
  });

  it("26. Once ACCEPTED, buyer CANNOT withdraw the EOI (Forbidden transition)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing invalid withdrawal after acceptance.",
    });

    await acceptEOI(seller1, submitted.id, {});

    await expect(withdrawEOI(buyer1, submitted.id)).rejects.toThrow(ValidationError);
  });

  it("27. Once ACCEPTED, seller CANNOT accept again", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing double acceptance prevention.",
    });

    await acceptEOI(seller1, submitted.id, {});

    await expect(acceptEOI(seller1, submitted.id, {})).rejects.toThrow(ValidationError);
  });

  it("28. Once ACCEPTED, seller CANNOT decline (State machine invariant)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing decline prevention after acceptance.",
    });

    await acceptEOI(seller1, submitted.id, {});

    await expect(
      declineEOI(seller1, submitted.id, { sellerDeclineReason: "VALUATION_MISMATCH" })
    ).rejects.toThrow(ValidationError);
  });

  it("29. Seller can decline EOI with structured decline reason", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing decline workflow with reason code.",
    });

    const declined = await declineEOI(seller1, submitted.id, {
      sellerDeclineReason: "STRATEGY_MISMATCH",
      sellerResponseMessage: "Seeking equity dilution rather than full buyout.",
    });

    expect(declined.status).toBe("DECLINED");
    expect(declined.sellerDeclineReason).toBe("STRATEGY_MISMATCH");
    expect(declined.declinedAt).toBeDefined();
  });

  it("30. Once DECLINED, seller CANNOT accept (Terminal state)", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing terminal decline state.",
    });

    await declineEOI(seller1, submitted.id, { sellerDeclineReason: "VALUATION_MISMATCH" });

    await expect(acceptEOI(seller1, submitted.id, {})).rejects.toThrow(ValidationError);
  });

  it("31. Seller can request clarification, moving state to CLARIFICATION_REQUESTED", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing clarification dialogue flow.",
    });

    const clarified = await requestClarification(seller1, submitted.id, {
      clarificationQuestions: "What is your anticipated post-acquisition promoter retention timeline?",
    });

    expect(clarified.status).toBe("CLARIFICATION_REQUESTED");
    expect(clarified.clarificationQuestions).toContain("promoter retention");
  });

  it("32. Buyer can provide clarification answers, returning status to UNDER_REVIEW", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing clarification answering flow.",
    });

    await requestClarification(seller1, submitted.id, {
      clarificationQuestions: "Please specify your planned board governance structure.",
    });

    const answered = await provideClarification(buyer1, submitted.id, {
      clarificationAnswers:
        "We propose 2 board seats for the founder during the 24-month operational transition.",
    });

    expect(answered.status).toBe("UNDER_REVIEW");
    expect(answered.clarificationAnswers).toContain("2 board seats");
  });

  // ==========================================
  // PART 5: PROGRESSIVE CONFIDENTIALITY & MASKING
  // ==========================================

  it("33. Seller view strictly masks buyer statutory identifiers and documents", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Checking seller-facing masking boundaries.",
    });

    const sellerView = await getSellerEOIById(seller1, submitted.id);

    expect((sellerView as any).buyerCin).toBeUndefined();
    expect((sellerView as any).buyerGstin).toBeUndefined();
    expect((sellerView as any).buyerPan).toBeUndefined();
    expect((sellerView as any).buyerAum).toBeUndefined();
    expect((sellerView as any).buyerDocuments).toBeUndefined();
    expect(sellerView.buyerEntityType).toBe("COMPANY");
    expect(sellerView.buyerLocation).toBe("Maharashtra, India");
  });

  it("34. Buyer view strictly masks seller statutory identifiers and accounts", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Checking buyer-facing masking boundaries.",
    });

    const buyerView = await getBuyerEOIById(buyer1, submitted.id);

    expect((buyerView as any).sellerCin).toBeUndefined();
    expect((buyerView as any).sellerGstin).toBeUndefined();
    expect((buyerView as any).sellerPan).toBeUndefined();
    expect((buyerView as any).exactAddress).toBeUndefined();
    expect((buyerView as any).auditedFinancials).toBeUndefined();
    expect(buyerView.opportunitySector).toBe("Precision Engineering");
  });

  it("35. EOI submission and acceptance do NOT unlock confidential documents or Tier 3 data", async () => {
    const submitted = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Verifying document protection remains sealed through acceptance.",
    });

    await acceptEOI(seller1, submitted.id, {});

    // Inspect database record of opportunity: verify exact CIN and PAN remain sealed from buyer view
    const buyerView = await getBuyerEOIById(buyer1, submitted.id);
    expect((buyerView as any).exact_cin).toBeUndefined();
    expect((buyerView as any).exact_pan).toBeUndefined();
    expect((buyerView as any).exact_legal_name).toBeUndefined();
  });

  // ==========================================
  // PART 6: AUDIT LOGGING & IN-APP NOTIFICATIONS
  // ==========================================

  it("36. EOI lifecycle generates immutable audit logs for submission, view, accept, decline, and withdrawal", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Audit logging test submission.",
    });

    await getSellerEOIById(seller1, eoi.id); // View
    await acceptEOI(seller1, eoi.id, {}); // Accept

    const auditRes = await query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE resource_id = $1 ORDER BY created_at ASC`,
      [eoi.id]
    );

    const actions = auditRes.rows.map((r) => r.action);
    expect(actions).toContain("EOI_SUBMITTED");
    expect(actions).toContain("EOI_VIEWED");
    expect(actions).toContain("EOI_ACCEPTED");
  });

  it("37. EOI submission and response create in-app notifications for respective counterparty", async () => {
    // 1. Submit creates notification for seller
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Notification flow test submission.",
    });

    const sellerNotifs = await getUserNotifications(seller1.id);
    expect(sellerNotifs.unreadCount).toBeGreaterThan(0);
    const eoiNotif = sellerNotifs.notifications.find((n) => n.resourceId === eoi.id);
    expect(eoiNotif).toBeDefined();
    expect(eoiNotif?.type).toBe("EOI_RECEIVED");

    // 2. Acceptance creates notification for buyer
    await acceptEOI(seller1, eoi.id, {});
    const buyerNotifs = await getUserNotifications(buyer1.id);
    expect(buyerNotifs.unreadCount).toBeGreaterThan(0);
    const acceptNotif = buyerNotifs.notifications.find((n) => n.resourceId === eoi.id);
    expect(acceptNotif?.type).toBe("EOI_ACCEPTED");

    // 3. Mark read
    const readSuccess = await markNotificationRead(acceptNotif!.id, buyer1.id);
    expect(readSuccess).toBe(true);

    const updatedNotifs = await getUserNotifications(buyer1.id);
    const updated = updatedNotifs.notifications.find((n) => n.id === acceptNotif!.id);
    expect(updated?.isRead).toBe(true);
  });

  // ==========================================
  // PART 7: ADVANCED STATE MACHINE & CONFIDENTIALITY REGRESSION GATES
  // ==========================================

  it("38. State Machine Invariant: WITHDRAWN -> ACCEPTED is strictly blocked", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing withdrawn to accepted transition blocking.",
    });

    await withdrawEOI(buyer1, eoi.id);

    await expect(acceptEOI(seller1, eoi.id, {})).rejects.toThrow(ValidationError);
  });

  it("39. Anti-IDOR: Buyer cannot call acceptEOI on their own submitted EOI", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing anti-IDOR on accept endpoint.",
    });

    // Buyer 1 attempts to accept their own EOI
    await expect(acceptEOI(buyer1, eoi.id, {})).rejects.toThrow(ForbiddenError);
  });

  it("40. Mass-assignment protection: Client cannot inject status, buyerId, sellerId, or timestamps", async () => {
    const maliciousPayload: any = {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing mass-assignment sanitization on EOI submission.",
      // Injected unauthorized properties:
      status: "ACCEPTED",
      buyerId: "00000000-0000-0000-0000-000000000001",
      sellerId: "00000000-0000-0000-0000-000000000002",
      acceptedAt: new Date().toISOString(),
      adminDecision: "FORCE_APPROVE",
    };

    const eoi = await submitEOI(buyer1, opp1PublishedId, maliciousPayload);

    // Injected fields must be completely ignored in returned view and database:
    expect(eoi.status).toBe("SUBMITTED");
    expect(eoi.acceptedAt).toBeNull();

    const dbRes = await query<{ buyer_id: string; seller_id: string; status: string; accepted_at: string | null }>(
      `SELECT buyer_id, seller_id, status, accepted_at FROM expressions_of_interest WHERE id = $1`,
      [eoi.id]
    );
    expect(dbRes.rows[0].status).toBe("SUBMITTED");
    expect(dbRes.rows[0].buyer_id).toBe(buyer1.id);
    expect(dbRes.rows[0].seller_id).toBe(seller1.id);
    expect(dbRes.rows[0].accepted_at).toBeNull();
  });

  it("41. CONFIDENTIALITY REGRESSION GATE: Accepting an EOI strictly keeps discovery opportunity at Tier 1 without unlocking private seller data", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing strict confidentiality maintenance after acceptance.",
    });

    // Seller accepts EOI
    await acceptEOI(seller1, eoi.id, {
      sellerResponseMessage: "Accepted for bilateral discussion.",
    });

    // Buyer fetches opportunity through discovery API
    const opp = await getOpportunityForDiscovery(opp1PublishedId, buyer1);

    // Must remain strictly Tier 1 masked:
    expect(opp.tier).toBe(1);
    expect((opp as any).exactLegalName).toBeUndefined();
    expect((opp as any).exactTradeName).toBeUndefined();
    expect((opp as any).exactCin).toBeUndefined();
    expect((opp as any).exactGstin).toBeUndefined();
    expect((opp as any).exactPan).toBeUndefined();
    expect((opp as any).exactAddress).toBeUndefined();
    expect((opp as any).exactRevenue).toBeUndefined();
    expect((opp as any).exactEbitda).toBeUndefined();
    expect((opp as any).exactAskingPrice).toBeUndefined();
    expect((opp as any).documents).toBeUndefined();
  });

  it("42. Buyer Confidentiality: Seller cannot access buyer-private mandate details or documents", async () => {
    const eoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Testing buyer confidential boundaries.",
      mandateId: buyer1MandateId,
    });

    const sellerView = await getSellerEOIById(seller1, eoi.id);

    // Seller gets approved summary only:
    expect(sellerView.buyerEntityType).toBe("COMPANY");
    expect(sellerView.buyerIndustry).toBe("Precision Engineering");
    expect((sellerView as any).mandateDetails).toBeUndefined();
    expect((sellerView as any).buyerPrivateNotes).toBeUndefined();
    expect((sellerView as any).buyerBankAccounts).toBeUndefined();
    expect((sellerView as any).buyerAum).toBeUndefined();
  });
});
