// Scale-up India — Phase 10: Deal Intent & Bilateral MOU Test Suite
// Path: tests/mou_workflow.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import {
  submitEOI,
  acceptEOI,
} from "@/domains/eoi/service";
import {
  initiateNDA,
  acceptNDA,
} from "@/domains/dataroom/service";
import {
  createMOU,
  proposeMOUDraft,
  counterMOU,
  acceptMOU,
  rejectMOU,
  withdrawMOU,
  getMOUById,
  getMOUsForUser,
  getMOUVersions,
} from "@/domains/mou/service";
import { getUserNotifications } from "@/domains/notifications/service";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

describe("Phase 10: Deal Intent & Bilateral MOU Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let nda1ExecutedId: string;
  let ndaDraftId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Provision Seller 1 (Apex Engineering)
    const regSeller1 = await registerUser({
      email: "seller1.p10@apexengineering.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p10@apexengineering.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Provision Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p10@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p10@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Provision Buyer 1 (Alpha Investments)
    const regBuyer1 = await registerUser({
      email: "buyer1.p10@alphainvestments.in",
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
        'Rajesh Kapoor', 'Managing Director', 'buyer1.p10@alphainvestments.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Provision Buyer 2 (Unrelated Buyer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p10@betacapital.in",
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
        'Pooja Bansal', 'Partner', 'buyer2.p10@betacapital.in', '+919876541123', 'VERIFIED', 'Technology'
      )`,
      [buyer2.id]
    );

    // 5. Provision Super Admin
    const regAdmin = await registerUser({
      email: "admin.p10@scaleup.gov.in",
      firstName: "Chief",
      lastName: "Compliance",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "opportunities.read_all",
        "opportunities.review",
        "mou.manage",
        "mou.read_all",
      ],
    };

    // 6. Seed Published Opportunity 1 (Seller 1)
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

    // 7. EOI -> Bilateral NDA Execution between Buyer 1 & Seller 1
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
    nda1ExecutedId = executedNda.id;

    // Create an unexecuted draft NDA for testing execution gates
    const draftNdaRes = await query<{ id: string }>(
      `INSERT INTO nda_agreements (
        reference_code, opportunity_id, buyer_id, seller_id, eoi_id, status, created_by
      ) VALUES ('NDA-DRAFT-001', $1, $2, $3, $4, 'NDA_DRAFT', $2)
      RETURNING id`,
      [opp1PublishedId, buyer2.id, seller1.id, eoi1.id]
    );
    ndaDraftId = draftNdaRes.rows[0].id;
  });

  // ============================================================================
  // 1. BILATERAL NDA EXECUTION PREREQUISITE GATE
  // ============================================================================
  it("Bilateral NDA Execution Gate: Rejects MOU creation if NDA is not EXECUTED", async () => {
    await expect(
      createMOU(buyer2, opp1PublishedId, {
        ndaId: ndaDraftId,
        terms: {
          proposedValuation: 45000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 45000000,
          equityConsideration: 0,
          earnestDepositAmount: 2500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: ["Satisfactory technical diligence"],
        },
      })
    ).rejects.toThrow(ValidationError);
  });

  // ============================================================================
  // 2. ANTI-IDOR AUTHORIZATION CHECK ON CREATION
  // ============================================================================
  it("Anti-IDOR: Unauthorized Buyer 2 CANNOT create MOU for Buyer 1's deal", async () => {
    await expect(
      createMOU(buyer2, opp1PublishedId, {
        ndaId: nda1ExecutedId,
        terms: {
          proposedValuation: 45000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 45000000,
          equityConsideration: 0,
          earnestDepositAmount: 2500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("Anti-IDOR: Unauthorized Seller 2 CANNOT create MOU for Seller 1's deal", async () => {
    await expect(
      createMOU(seller2, opp1PublishedId, {
        ndaId: nda1ExecutedId,
        terms: {
          proposedValuation: 45000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 45000000,
          equityConsideration: 0,
          earnestDepositAmount: 2500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // ============================================================================
  // 3. INPUT VALIDATION GATES
  // ============================================================================
  it("Input Validation: Proposed valuation <= 0 throws ValidationError", async () => {
    await expect(
      createMOU(buyer1, opp1PublishedId, {
        ndaId: nda1ExecutedId,
        terms: {
          proposedValuation: -1000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 0,
          equityConsideration: 0,
          earnestDepositAmount: 0,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow();
  });

  // ============================================================================
  // 4. CREATION OF DRAFT MOU
  // ============================================================================
  it("Authorized Buyer can create a DRAFT Deal Intent MOU with structured terms", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 47500000, // ₹4.75 Cr
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 40000000,
        equityConsideration: 7500000,
        earnestDepositAmount: 2500000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        targetClosingDate: "2027-03-31",
        conditionsPrecedent: [
          "Satisfactory financial and legal due diligence",
          "Clean title on Pune industrial land and machinery",
        ],
        keyAssumptions: "Normalized EBITDA of ₹1.2 Cr based on FY25-26 audited financials.",
        summaryNotes: "Initial commercial terms proposed by Alpha Strategic Investments.",
      },
      submitImmediately: false,
    });

    expect(mou.status).toBe("DRAFT");
    expect(mou.referenceCode).toMatch(/^MOU-\d{4}-\d+$/);
    expect(mou.currentVersionNumber).toBe(1);
    expect(mou.proposedValuation).toBe(47500000);
    expect(mou.earnestDepositAmount).toBe(2500000);
    expect(mou.exclusivityPeriodDays).toBe(30);
    expect(mou.currentTerms.conditionsPrecedent).toHaveLength(2);
    expect(mou.nonBindingDisclaimer).toContain("NON-BINDING DEAL INTENT");
  });

  // ============================================================================
  // 5. PROPOSE DRAFT MOU
  // ============================================================================
  it("Author can formally propose DRAFT Deal Intent MOU to counterparty", async () => {
    const draft = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 48000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 48000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: ["Diligence completion"],
      },
      submitImmediately: false,
    });

    expect(draft.status).toBe("DRAFT");

    const proposed = await proposeMOUDraft(buyer1, draft.id, 14);

    expect(proposed.status).toBe("PROPOSED");
    expect(proposed.validUntil).not.toBeNull();
    expect(proposed.lastProposedByRole).toBe("BUYER");
  });

  // ============================================================================
  // 6. IMMEDIATE PROPOSAL & SINGLE ACTIVE MOU CONSTRAINT
  // ============================================================================
  it("Creating with submitImmediately = true directly transitions to PROPOSED", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 46000000,
        currency: "INR",
        proposedStructure: "MAJORITY_STAKE",
        cashConsideration: 46000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 45,
        dueDiligenceWindowDays: 60,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    expect(mou.status).toBe("PROPOSED");
    expect(mou.currentVersionNumber).toBe(1);
  });

  it("Cannot create a second active Deal Intent MOU for the same deal (ConflictError)", async () => {
    // First MOU is created
    await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 46000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 46000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    // Second attempt should fail with ConflictError
    await expect(
      createMOU(seller1, opp1PublishedId, {
        ndaId: nda1ExecutedId,
        terms: {
          proposedValuation: 50000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 50000000,
          equityConsideration: 0,
          earnestDepositAmount: 2500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow(ConflictError);
  });

  // ============================================================================
  // 7. TURN ENFORCEMENT & SELF-ACCEPTANCE/COUNTER DEFENSE
  // ============================================================================
  it("Proposer CANNOT accept their own proposal (State machine turn enforcement)", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    await expect(
      acceptMOU(buyer1, mou.id, { confirmed: true })
    ).rejects.toThrow(ValidationError);
  });

  it("Proposer CANNOT counter their own active proposal", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    await expect(
      counterMOU(buyer1, mou.id, {
        terms: {
          proposedValuation: 46000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 46000000,
          equityConsideration: 0,
          earnestDepositAmount: 2000000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow(ValidationError);
  });

  // ============================================================================
  // 8. COUNTERPROPOSAL & VERSIONING
  // ============================================================================
  it("Seller can submit a counterproposal, incrementing to version 2", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    const countered = await counterMOU(seller1, mou.id, {
      terms: {
        proposedValuation: 49000000, // Seller asks ₹4.9 Cr
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 4000000,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 21,
        dueDiligenceWindowDays: 30,
        summaryNotes: "Promoter requests shorter exclusivity and ₹4.9 Cr valuation.",
        conditionsPrecedent: ["Definitive SPA execution within 30 days"],
      },
    });

    expect(countered.status).toBe("COUNTERED");
    expect(countered.currentVersionNumber).toBe(2);
    expect(countered.proposedValuation).toBe(49000000);
    expect(countered.lastProposedByRole).toBe("SELLER");
    expect(countered.isMyTurnToRespond).toBe(false); // For seller who just proposed, it is not their turn

    const buyerView = await getMOUById(buyer1, mou.id);
    expect(buyerView.isMyTurnToRespond).toBe(true); // For buyer, it is now their turn to respond

    // Check version history
    const versions = await getMOUVersions(buyer1, mou.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].status).toBe("SUPERSEDED");
    expect(versions[1].versionNumber).toBe(2);
    expect(versions[1].status).toBe("COUNTERED");
    expect(versions[1].terms.proposedValuation).toBe(49000000);
  });

  // ============================================================================
  // 9. BILATERAL ACCEPTANCE
  // ============================================================================
  it("Buyer can accept Seller counterproposal, transitioning to ACCEPTED", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    // Seller counters
    await counterMOU(seller1, mou.id, {
      terms: {
        proposedValuation: 48500000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 48500000,
        equityConsideration: 0,
        earnestDepositAmount: 2500000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });

    // Buyer accepts Seller's counterproposal
    const accepted = await acceptMOU(buyer1, mou.id, { confirmed: true });

    expect(accepted.status).toBe("ACCEPTED");
    expect(accepted.acceptedAt).not.toBeNull();
    expect(accepted.currentVersionNumber).toBe(2);

    // Terminal state: Cannot counter an accepted MOU
    await expect(
      counterMOU(seller1, mou.id, {
        terms: {
          proposedValuation: 50000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 50000000,
          equityConsideration: 0,
          earnestDepositAmount: 2500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          conditionsPrecedent: [],
        },
      })
    ).rejects.toThrow(ValidationError);
  });

  // ============================================================================
  // 10. REJECTION FLOW
  // ============================================================================
  it("Seller can reject Buyer proposal with structured reason", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 30000000, // Significantly below asking price
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 30000000,
        equityConsideration: 0,
        earnestDepositAmount: 1000000,
        exclusivityPeriodDays: 60,
        dueDiligenceWindowDays: 60,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    const rejected = await rejectMOU(seller1, mou.id, {
      reason: "Offer valuation of ₹3.0 Cr is unacceptable given current run-rate revenue and asset base.",
    });

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.rejectionReason).toContain("valuation of ₹3.0 Cr is unacceptable");

    // Terminal state: Cannot accept a rejected MOU
    await expect(
      acceptMOU(buyer1, mou.id, { confirmed: true })
    ).rejects.toThrow(ValidationError);
  });

  // ============================================================================
  // 11. WITHDRAWAL FLOW
  // ============================================================================
  it("Proposing party can withdraw their active proposal", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    // Buyer withdraws their own proposal
    const withdrawn = await withdrawMOU(buyer1, mou.id, {
      reason: "Withdrawn due to internal investment committee mandate change.",
    });

    expect(withdrawn.status).toBe("WITHDRAWN");
    expect(withdrawn.withdrawalReason).toContain("investment committee mandate change");

    // Counterparty can no longer accept a withdrawn proposal
    await expect(
      acceptMOU(seller1, mou.id, { confirmed: true })
    ).rejects.toThrow(ValidationError);
  });

  it("Recipient CANNOT withdraw counterparty's proposal (ForbiddenError)", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    // Seller tries to withdraw Buyer's proposal
    await expect(
      withdrawMOU(seller1, mou.id, { reason: "Not allowed" })
    ).rejects.toThrow(ForbiddenError);
  });

  // ============================================================================
  // 12. ANTI-IDOR ON VIEWING AND LISTING
  // ============================================================================
  it("Anti-IDOR: Unauthorized Buyer 2 CANNOT read Buyer 1 / Seller 1 Deal Intent MOU", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    await expect(getMOUById(buyer2, mou.id)).rejects.toThrow(ForbiddenError);
  });

  it("Authorized participants can list their own MOUs with safe counterparty labels", async () => {
    await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    const buyerList = await getMOUsForUser(buyer1, "BUYER");
    expect(buyerList).toHaveLength(1);
    expect(buyerList[0].counterpartyLabel).toBe("Verified Seller / Promoter");

    const sellerList = await getMOUsForUser(seller1, "SELLER");
    expect(sellerList).toHaveLength(1);
    expect(sellerList[0].counterpartyLabel).toBe("Verified Buyer / Investor");

    const unrelatedBuyerList = await getMOUsForUser(buyer2, "BUYER");
    expect(unrelatedBuyerList).toHaveLength(0);
  });

  // ============================================================================
  // 13. AUDIT TRAIL AND IN-APP NOTIFICATIONS
  // ============================================================================
  it("Deal Intent lifecycle generates structured audit logs without confidential leakage", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    await acceptMOU(seller1, mou.id, { confirmed: true });

    const auditRes = await query<any>(
      `SELECT action, resource_type, metadata FROM audit_logs 
       WHERE resource_id = $1 
       ORDER BY created_at ASC`,
      [mou.id]
    );

    const actions = auditRes.rows.map((r) => r.action);
    expect(actions).toContain("MOU_CREATED");
    expect(actions).toContain("MOU_PROPOSED");
    expect(actions).toContain("MOU_ACCEPTED");

    // Verify zero document full content or PII in audit metadata
    for (const entry of auditRes.rows) {
      const metaStr = JSON.stringify(entry.metadata);
      expect(metaStr).not.toContain("Singhania");
      expect(metaStr).not.toContain("AAACA1234A"); // Buyer PAN
    }
  });

  it("In-app notifications alert counterparty of proposals and counterproposals", async () => {
    const mou = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 45000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 45000000,
        equityConsideration: 0,
        earnestDepositAmount: 2000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });

    // Seller should receive notification of MOU_PROPOSED
    const sellerNotifs = await getUserNotifications(seller1.id, 10);
    expect(sellerNotifs.notifications.some((n) => n.type === "MOU_PROPOSED")).toBe(true);

    // Seller counters
    await counterMOU(seller1, mou.id, {
      terms: {
        proposedValuation: 48000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 48000000,
        equityConsideration: 0,
        earnestDepositAmount: 2500000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });

    // Buyer should receive notification of MOU_COUNTERED
    const buyerNotifs = await getUserNotifications(buyer1.id, 10);
    expect(buyerNotifs.notifications.some((n) => n.type === "MOU_COUNTERED")).toBe(true);
  });
});
