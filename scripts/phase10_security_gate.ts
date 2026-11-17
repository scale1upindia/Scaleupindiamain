// Scale-up India — Phase 10: Deal Intent & Bilateral MOU Security Gate
// Script: scripts/phase10_security_gate.ts

import { getDb, query } from "../src/lib/db";
import { registerUser } from "../src/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "../src/domains/opportunity/service";
import {
  submitEOI,
  acceptEOI,
} from "../src/domains/eoi/service";
import {
  initiateNDA,
  acceptNDA,
} from "../src/domains/dataroom/service";
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
} from "../src/domains/mou/service";
import { getUserNotifications } from "../src/domains/notifications/service";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../src/lib/errors";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 10 DEAL INTENT & BILATERAL MOU GATE");
  console.log("=================================================================\n");

  const db = await getDb();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, label: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ PASS [Assertion ${totalCount}]: ${label}`);
    } else {
      console.error(`  ✗ FAIL [Assertion ${totalCount}]: ${label}`);
      process.exitCode = 1;
    }
  }

  // ============================================================================
  // 1. VERIFYING MIGRATION 010 & RELATIONAL SCHEMA INTEGRITY
  // ============================================================================
  console.log("--- 1. VERIFYING MIGRATION 010 & DATABASE INTEGRITY ---");
  const migRes = await query<{ id: string }>(
    `SELECT id FROM _schema_migrations WHERE id = '010_mou_deal_intent.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 010_mou_deal_intent.sql recorded in _schema_migrations");

  const seqRes = await query<any>(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'mou_ref_seq'`
  );
  assert(seqRes.rows.length === 1, "Sequence mou_ref_seq exists in database");

  const tablesRes = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN ('deal_mous', 'mou_versions')`
  );
  assert(tablesRes.rows.length === 2, "Tables deal_mous and mou_versions exist in database");

  const idxRes = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes 
     WHERE indexname IN ('idx_mou_active_nda', 'idx_deal_mous_buyer', 'idx_deal_mous_seller', 'idx_mou_versions_mou')`
  );
  assert(idxRes.rows.length >= 4, "Partial unique index and performance composite indexes exist in database");

  const permRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM permissions WHERE module = 'mou'`
  );
  assert(parseInt(permRes.rows[0].count, 10) >= 8, "Phase 10 RBAC permissions correctly seeded in permissions table");

  // ============================================================================
  // 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES
  // ============================================================================
  console.log("\n--- 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES ---");
  const rand = Math.floor(Math.random() * 1000000);

  const regSeller1 = await registerUser({
    email: `promoter1.gate.${rand}@machineworks.in`,
    firstName: "Ramesh",
    lastName: "Kirloskar",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller1 = regSeller1.user;
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Chairman', '+919911223344', $2, 'VERIFIED', 100)`,
    [seller1.id, seller1.email]
  );

  const regSeller2 = await registerUser({
    email: `promoter2.gate.${rand}@rivalworks.in`,
    firstName: "Suresh",
    lastName: "Patel",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller2 = regSeller2.user;
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Director', '+919911223345', $2, 'VERIFIED', 100)`,
    [seller2.id, seller2.email]
  );

  const regBuyer1 = await registerUser({
    email: `acquirer1.gate.${rand}@apexholdings.in`,
    firstName: "Siddharth",
    lastName: "Burman",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer1 = regBuyer1.user;
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'CORPORATE_BUYER', 'Apex Strategic Holdings Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
      'Siddharth Burman', 'Managing Director', $2, '+919822334455', 'VERIFIED', 'Precision Engineering'
    )`,
    [buyer1.id, buyer1.email]
  );

  const regBuyer2 = await registerUser({
    email: `acquirer2.gate.${rand}@unrelated.in`,
    firstName: "Arun",
    lastName: "Goenka",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer2 = regBuyer2.user;
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'FAMILY_OFFICE', 'Goenka Capital Advisors', 'LLP', 'Delhi', 'New Delhi',
      'Arun Goenka', 'Managing Partner', $2, '+919822334456', 'VERIFIED', 'Manufacturing'
    )`,
    [buyer2.id, buyer2.email]
  );

  const regAdmin = await registerUser({
    email: `admin.gate.${rand}@scaleup.gov.in`,
    firstName: "Compliance",
    lastName: "Director",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const admin = {
    ...regAdmin.user,
    roles: ["SUPER_ADMIN"],
    permissions: [
      "opportunities.read_all",
      "opportunities.review",
      "mou.manage",
      "mou.read_all",
    ],
  };

  assert(Boolean(seller1.id && seller2.id && buyer1.id && buyer2.id && admin.id), "Principals and compliance actors provisioned successfully");

  // ============================================================================
  // 3. OPPORTUNITY PUBLICATION & BILATERAL NDA EXECUTION
  // ============================================================================
  console.log("\n--- 3. OPPORTUNITY PUBLICATION & BILATERAL NDA EXECUTION ---");
  const opp1 = await createOpportunity(seller1, {
    title: "Kirloskar Precision Aerospace & Defense Engineering",
    headline: "Premier AS9100 Rev D Avionics Machining Facility",
    teaserSummary: "High-precision manufacturing facility with multi-year tier-1 aerospace defense contracts.",
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
    exactLegalName: "Kirloskar Precision Components Pvt Ltd",
    exactCin: "U29299MH2009PTC048199",
    exactGstin: "27AABCK1234F1Z9",
    exactPan: "AABCK1234F",
    exactAddress: "Plot 404, Hinjewadi Industrial Zone, Pune, Maharashtra",
  });
  await submitOpportunity(opp1.id, seller1);
  await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
  const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
  const opp1PublishedId = pubOpp1.id;

  const eoi1 = await submitEOI(buyer1, opp1PublishedId, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Buyout",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating complete buyout of Kirloskar defense machining asset.",
  });
  await acceptEOI(seller1, eoi1.id, {
    sellerResponseMessage: "Accepted for bilateral NDA & diligence exchange.",
  });

  const initNda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1.id });
  await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
  const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });
  const nda1ExecutedId = executedNda.id;

  // Create an unexecuted draft NDA for buyer 2 to test prerequisite gates
  const draftNdaRes = await query<{ id: string }>(
    `INSERT INTO nda_agreements (
      reference_code, opportunity_id, buyer_id, seller_id, eoi_id, status, created_by
    ) VALUES ($1, $2, $3, $4, $5, 'NDA_DRAFT', $3)
    RETURNING id`,
    [`NDA-DRAFT-GATE-${rand}`, opp1PublishedId, buyer2.id, seller1.id, eoi1.id]
  );
  const ndaDraftId = draftNdaRes.rows[0].id;

  assert(executedNda.status === "EXECUTED", "Bilateral NDA fully EXECUTED between Buyer 1 and Seller 1");

  // ============================================================================
  // 4. BILATERAL NDA EXECUTION PREREQUISITE GATE
  // ============================================================================
  console.log("\n--- 4. BILATERAL NDA EXECUTION GATE ---");
  let unexecutedGateBlocked = false;
  try {
    await createMOU(buyer2, opp1PublishedId, {
      ndaId: ndaDraftId,
      terms: {
        proposedValuation: 60000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 60000000,
        equityConsideration: 0,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      unexecutedGateBlocked = true;
    }
  }
  assert(unexecutedGateBlocked, "Bilateral NDA Execution Gate: Cannot create MOU on unexecuted NDA (Throws ValidationError)");

  // ============================================================================
  // 5. ANTI-IDOR VERIFICATION ON DEAL INTENT CREATION
  // ============================================================================
  console.log("\n--- 5. ANTI-IDOR VERIFICATION ON CREATION ---");
  let buyerIdorBlocked = false;
  try {
    await createMOU(buyer2, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 60000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 60000000,
        equityConsideration: 0,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      buyerIdorBlocked = true;
    }
  }
  assert(buyerIdorBlocked, "Anti-IDOR: Unauthorized Buyer 2 CANNOT create MOU for Buyer 1's deal (Throws ForbiddenError)");

  let sellerIdorBlocked = false;
  try {
    await createMOU(seller2, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 60000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 60000000,
        equityConsideration: 0,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerIdorBlocked = true;
    }
  }
  assert(sellerIdorBlocked, "Anti-IDOR: Unauthorized Seller 2 CANNOT create MOU for Seller 1's deal (Throws ForbiddenError)");

  // ============================================================================
  // 6. DRAFT MOU CREATION & INITIAL TERMS INTEGRITY
  // ============================================================================
  console.log("\n--- 6. DRAFT MOU CREATION & INITIAL TERMS INTEGRITY ---");
  const draftMOU = await createMOU(buyer1, opp1PublishedId, {
    ndaId: nda1ExecutedId,
    terms: {
      proposedValuation: 55000000, // ₹5.5 Cr
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 50000000,
      equityConsideration: 5000000,
      earnestDepositAmount: 2500000,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
      targetClosingDate: "2027-03-31",
      conditionsPrecedent: [
        "Satisfactory financial and legal diligence",
        "Clean title on Pune Hinjewadi industrial asset",
      ],
      keyAssumptions: "Normalized EBITDA of ₹1.5 Cr based on audited statements.",
      summaryNotes: "Initial commercial terms proposed by Apex Strategic Holdings.",
    },
    submitImmediately: false,
  });

  assert(draftMOU.status === "DRAFT", "Draft MOU successfully created with status DRAFT");
  assert(/^MOU-\d{4}-\d+$/.test(draftMOU.referenceCode), `Reference code formatted properly: ${draftMOU.referenceCode}`);
  assert(draftMOU.currentVersionNumber === 1, "Initial version number is strictly 1");
  assert(draftMOU.proposedValuation === 55000000, "Commercial terms: Proposed valuation recorded accurately");
  assert(draftMOU.earnestDepositAmount === 2500000, "Commercial terms: Earnest deposit recorded accurately");
  assert(draftMOU.exclusivityPeriodDays === 30, "Commercial terms: Exclusivity period recorded accurately");
  assert(draftMOU.dueDiligenceWindowDays === 45, "Commercial terms: DD window recorded accurately");
  assert(draftMOU.currentTerms.conditionsPrecedent.length === 2, "Conditions precedent array correctly preserved");
  assert(draftMOU.nonBindingDisclaimer.includes("NON-BINDING DEAL INTENT"), "Non-binding legal disclaimer permanently anchored to MOU");

  // ============================================================================
  // 7. FORMAL PROPOSAL SUBMISSION & RECIPIENT NOTIFICATION
  // ============================================================================
  console.log("\n--- 7. FORMAL PROPOSAL SUBMISSION ---");
  const proposedMOU = await proposeMOUDraft(buyer1, draftMOU.id, 14);

  assert(proposedMOU.status === "PROPOSED", "Draft MOU transitioned to PROPOSED");
  assert(Boolean(proposedMOU.validUntil), "Validity deadline timestamp computed and stored");
  assert(proposedMOU.lastProposedByRole === "BUYER", "Proposing role recorded as BUYER");

  const sellerNotifsAfterProposal = await getUserNotifications(seller1.id, 10);
  assert(
    sellerNotifsAfterProposal.notifications.some((n) => n.type === "MOU_PROPOSED"),
    "Seller received MOU_PROPOSED in-app notification"
  );

  // ============================================================================
  // 8. TURN ENFORCEMENT & SELF-ACCEPTANCE/COUNTER DEFENSE
  // ============================================================================
  console.log("\n--- 8. TURN ENFORCEMENT & STATE MACHINE GATES ---");
  let selfAcceptBlocked = false;
  try {
    await acceptMOU(buyer1, proposedMOU.id, { confirmed: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      selfAcceptBlocked = true;
    }
  }
  assert(selfAcceptBlocked, "Turn Enforcement: Proposer CANNOT accept their own proposal (Throws ValidationError)");

  let selfCounterBlocked = false;
  try {
    await counterMOU(buyer1, proposedMOU.id, {
      terms: {
        proposedValuation: 56000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 56000000,
        equityConsideration: 0,
        earnestDepositAmount: 2500000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      selfCounterBlocked = true;
    }
  }
  assert(selfCounterBlocked, "Turn Enforcement: Proposer CANNOT counter their own active proposal (Throws ValidationError)");

  // ============================================================================
  // 9. NEGOTIATION & COUNTERPROPOSAL (VERSION 2)
  // ============================================================================
  console.log("\n--- 9. NEGOTIATION & COUNTERPROPOSAL (VERSION 2) ---");
  const counteredMOU = await counterMOU(seller1, proposedMOU.id, {
    terms: {
      proposedValuation: 58000000, // Seller asks ₹5.8 Cr
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 54000000,
      equityConsideration: 4000000,
      earnestDepositAmount: 3000000,
      exclusivityPeriodDays: 21,
      dueDiligenceWindowDays: 30,
      summaryNotes: "Promoter requests ₹5.8 Cr valuation and 21 days exclusivity.",
      conditionsPrecedent: ["Definitive SPA execution within 21 days"],
    },
  });

  assert(counteredMOU.status === "COUNTERED", "MOU status updated to COUNTERED");
  assert(counteredMOU.currentVersionNumber === 2, "Current version number incremented to 2");
  assert(counteredMOU.proposedValuation === 58000000, "Countered valuation updated to ₹5.8 Cr");
  assert(counteredMOU.lastProposedByRole === "SELLER", "Proposing role switched to SELLER");

  const versionsAfterCounter = await getMOUVersions(buyer1, proposedMOU.id);
  assert(versionsAfterCounter.length === 2, "Version history contains exactly 2 immutable version records");
  assert(versionsAfterCounter[0].status === "SUPERSEDED", "Version 1 marked as SUPERSEDED");
  assert(versionsAfterCounter[1].status === "COUNTERED", "Version 2 marked as COUNTERED");
  assert(versionsAfterCounter[0].terms.proposedValuation === 55000000, "Version 1 proposed valuation strictly preserved (Immutability guarantee)");

  const buyerNotifsAfterCounter = await getUserNotifications(buyer1.id, 10);
  assert(
    buyerNotifsAfterCounter.notifications.some((n) => n.type === "MOU_COUNTERED"),
    "Buyer received MOU_COUNTERED in-app notification"
  );

  // ============================================================================
  // 10. BILATERAL ACCEPTANCE (TERMINAL INTENT AGREEMENT)
  // ============================================================================
  console.log("\n--- 10. BILATERAL ACCEPTANCE ---");
  const acceptedMOU = await acceptMOU(buyer1, counteredMOU.id, { confirmed: true });

  assert(acceptedMOU.status === "ACCEPTED", "Bilateral deal intent reached status ACCEPTED");
  assert(Boolean(acceptedMOU.acceptedAt), "Accepted timestamp recorded in database");
  assert(acceptedMOU.currentVersionNumber === 2, "Agreed terms correspond to Version 2");

  let counterAfterAcceptBlocked = false;
  try {
    await counterMOU(seller1, acceptedMOU.id, {
      terms: {
        proposedValuation: 60000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 60000000,
        equityConsideration: 0,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      counterAfterAcceptBlocked = true;
    }
  }
  assert(counterAfterAcceptBlocked, "Terminal State Invariant: Cannot counter an already ACCEPTED Deal Intent MOU");

  let rejectAfterAcceptBlocked = false;
  try {
    await rejectMOU(seller1, acceptedMOU.id, { reason: "Changed my mind" });
  } catch (err) {
    if (err instanceof ValidationError) {
      rejectAfterAcceptBlocked = true;
    }
  }
  assert(rejectAfterAcceptBlocked, "Terminal State Invariant: Cannot decline an already ACCEPTED Deal Intent MOU");

  const sellerNotifsAfterAccept = await getUserNotifications(seller1.id, 10);
  assert(
    sellerNotifsAfterAccept.notifications.some((n) => n.type === "MOU_ACCEPTED"),
    "Seller received MOU_ACCEPTED in-app notification"
  );

  // ============================================================================
  // 11. SINGLE ACTIVE MOU CONSTRAINT (PARTIAL UNIQUE INDEX)
  // ============================================================================
  console.log("\n--- 11. SINGLE ACTIVE MOU ENFORCEMENT ---");
  let duplicateActiveBlocked = false;
  try {
    await createMOU(seller1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      terms: {
        proposedValuation: 60000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 60000000,
        equityConsideration: 0,
        earnestDepositAmount: 3000000,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
        conditionsPrecedent: [],
      },
      submitImmediately: true,
    });
  } catch (err) {
    if (err instanceof ConflictError) {
      duplicateActiveBlocked = true;
    }
  }
  assert(duplicateActiveBlocked, "Single Active MOU Constraint: Cannot create second MOU while one is active/accepted (Throws ConflictError)");

  // ============================================================================
  // 12. ANTI-IDOR VERIFICATION ON ACCESS & DETAILS
  // ============================================================================
  console.log("\n--- 12. ANTI-IDOR ON VIEWING & DETAILS ---");
  let unauthorizedReadBlocked = false;
  try {
    await getMOUById(buyer2, acceptedMOU.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      unauthorizedReadBlocked = true;
    }
  }
  assert(unauthorizedReadBlocked, "Anti-IDOR: Unauthorized Buyer 2 CANNOT read Buyer 1 / Seller 1 MOU (Throws ForbiddenError)");

  let unauthorizedSellerReadBlocked = false;
  try {
    await getMOUById(seller2, acceptedMOU.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      unauthorizedSellerReadBlocked = true;
    }
  }
  assert(unauthorizedSellerReadBlocked, "Anti-IDOR: Unauthorized Seller 2 CANNOT read Seller 1's MOU (Throws ForbiddenError)");

  // ============================================================================
  // 13. CONFIDENTIALITY & ZERO DATA LEAKAGE
  // ============================================================================
  console.log("\n--- 13. CONFIDENTIALITY & PROGRESSIVE DISCLOSURE ---");
  const buyerMOUView = await getMOUById(buyer1, acceptedMOU.id);
  const sellerMOUView = await getMOUById(seller1, acceptedMOU.id);

  assert(buyerMOUView.counterpartyLabel === "Verified Seller / Promoter", "Buyer view masks seller identity with safe label");
  assert(sellerMOUView.counterpartyLabel === "Verified Buyer / Investor", "Seller view masks buyer identity with safe label");

  const buyerViewJson = JSON.stringify(buyerMOUView);
  assert(!buyerViewJson.includes("U29299MH2009PTC048199"), "Zero data leakage: Seller CIN not exposed in Deal Intent view");
  assert(!buyerViewJson.includes("AABCK1234F"), "Zero data leakage: Seller PAN not exposed in Deal Intent view");
  assert(!buyerViewJson.includes("Hinjewadi Industrial Zone"), "Zero data leakage: Seller exact address not exposed in Deal Intent view");

  // ============================================================================
  // 14. REJECTION & WITHDRAWAL TERMINAL PATHS
  // ============================================================================
  console.log("\n--- 14. REJECTION & WITHDRAWAL FLOWS ---");
  // Setup Opportunity 2 and execute NDA for testing rejection & withdrawal
  const opp2 = await createOpportunity(seller2, {
    title: "Patel Advanced Agro-Chemical Formulations",
    headline: "ISO 9001 Crop Nutrition & Bio-Fertilizer Plant",
    teaserSummary: "Modern chemical plant with pan-India dealer distribution network.",
    businessCategory: "MANUFACTURING",
    industry: "Chemicals & Petrochemicals",
    subSector: "Agro Chemicals",
    operatingRegion: "WEST_INDIA",
    registeredState: "Gujarat",
    approximateAgeBracket: "5_TO_10_YRS",
    revenueBracket: "25CR_TO_50CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "10_TO_20_PCT",
    askingPriceBracket: "25CR_TO_50CR",
    exactLegalName: "Patel Agro Chemical Formulations Pvt Ltd",
    exactCin: "U24299GJ2016PTC058190",
    exactGstin: "24AABCP1234F1Z1",
    exactPan: "AABCP1234F",
    exactAddress: "GIDC Industrial Estate, Ankleshwar, Gujarat",
  });
  await submitOpportunity(opp2.id, seller2);
  await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
  const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);

  const eoi2 = await submitEOI(buyer2, pubOpp2.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Buyout",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating agro-chemical manufacturing facility.",
  });
  await acceptEOI(seller2, eoi2.id, { sellerResponseMessage: "Accepted for diligence." });

  const initNda2 = await initiateNDA(buyer2, pubOpp2.id, { eoiId: eoi2.id });
  await acceptNDA(buyer2, initNda2.id, { termsAcknowledged: true });
  const executedNda2 = await acceptNDA(seller2, initNda2.id, { termsAcknowledged: true });

  // Test Withdrawal: Buyer 2 proposes and withdraws
  const mouToWithdraw = await createMOU(buyer2, pubOpp2.id, {
    ndaId: executedNda2.id,
    terms: {
      proposedValuation: 28000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 28000000,
      equityConsideration: 0,
      earnestDepositAmount: 1500000,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
      conditionsPrecedent: [],
    },
    submitImmediately: true,
  });

  const withdrawnMOU = await withdrawMOU(buyer2, mouToWithdraw.id, {
    reason: "Internal investment committee allocation pivot.",
  });
  assert(withdrawnMOU.status === "WITHDRAWN", "Proposing buyer can withdraw active proposal (Status WITHDRAWN)");

  let acceptWithdrawnBlocked = false;
  try {
    await acceptMOU(seller2, withdrawnMOU.id, { confirmed: true });
  } catch (err) {
    if (err instanceof ValidationError) {
      acceptWithdrawnBlocked = true;
    }
  }
  assert(acceptWithdrawnBlocked, "Terminal State Invariant: Cannot accept a WITHDRAWN Deal Intent proposal");

  // ============================================================================
  // 15. IMMUTABLE AUDIT LOGGING INTEGRITY
  // ============================================================================
  console.log("\n--- 15. IMMUTABLE AUDIT LOGGING INTEGRITY ---");
  const auditRes = await query<any>(
    `SELECT action, resource_type, metadata FROM audit_logs 
     WHERE resource_id = $1 
     ORDER BY created_at ASC`,
    [acceptedMOU.id]
  );

  const loggedActions = auditRes.rows.map((r) => r.action);
  assert(loggedActions.includes("MOU_CREATED"), "Audit log recorded: MOU_CREATED");
  assert(loggedActions.includes("MOU_PROPOSED"), "Audit log recorded: MOU_PROPOSED");
  assert(loggedActions.includes("MOU_COUNTERED"), "Audit log recorded: MOU_COUNTERED");
  assert(loggedActions.includes("MOU_ACCEPTED"), "Audit log recorded: MOU_ACCEPTED");

  // Zero PII / full contract text in audit metadata
  let auditIsClean = true;
  for (const entry of auditRes.rows) {
    const metaStr = JSON.stringify(entry.metadata);
    if (metaStr.includes("Kirloskar") || metaStr.includes("AABCK1234F")) {
      auditIsClean = false;
      break;
    }
  }
  assert(auditIsClean, "CRITICAL: Audit log stores safe structured metadata only (ZERO private PII or full text logged)");

  // ============================================================================
  // SUMMARY RESULTS
  // ============================================================================
  console.log("\n=================================================================");
  console.log(`PHASE 10 SECURITY GATE COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log("=================================================================");

  if (passedCount === totalCount) {
    console.log("\n>>> PHASE 10 FINAL VERDICT: READY_FOR_PHASE_11 <<<\n");
  } else {
    console.error(`\n>>> PHASE 10 FINAL VERDICT: NOT_READY_FOR_PHASE_11 (${totalCount - passedCount} FAILED) <<<\n`);
    process.exitCode = 1;
  }
}

runSecurityGate().catch((err) => {
  console.error("FATAL: Security Gate crashed:", err);
  process.exit(1);
});
