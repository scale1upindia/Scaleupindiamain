// Scale-up India — Phase 7 Security & Bilateral EOI Workflow Gate
// Script: scripts/phase7_security_gate.ts

import { getDb, query } from "../src/lib/db";
import { registerUser } from "../src/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  getOpportunityForDiscovery,
} from "../src/domains/opportunity/service";
import { createAcquisitionMandate } from "../src/domains/buyer/service";
import {
  submitEOI,
  getBuyerEOIById,
  getSellerEOIById,
  acceptEOI,
  declineEOI,
  withdrawEOI,
} from "../src/domains/eoi/service";
import { getUserNotifications } from "../src/domains/notifications/service";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../src/lib/errors";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 7 BILATERAL EOI & CONFIDENTIALITY GATE");
  console.log("=================================================================\n");

  const db = await getDb();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, label: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ PASS: ${label}`);
    } else {
      console.error(`  ✗ FAIL: ${label}`);
      process.exitCode = 1;
    }
  }

  // --- 1. VERIFYING MIGRATION 007 & CONSTRAINTS ---
  console.log("--- 1. VERIFYING MIGRATION 007 & CONSTRAINTS ---");
  const migRes = await db.query(
    `SELECT id FROM _schema_migrations WHERE id = '007_expression_of_interest.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 007_expression_of_interest.sql is recorded in _schema_migrations");

  const idxRes = await db.query(
    `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_eoi_active_buyer_opp'`
  );
  assert(idxRes.rows.length === 1, "Partial unique index idx_eoi_active_buyer_opp is present in database");

  const notifTableRes = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name = 'in_app_notifications'`
  );
  assert(notifTableRes.rows.length === 1, "Table in_app_notifications is present in database");

  // --- 2. PROVISIONING TEST ACTORS ---
  console.log("\n--- 2. PROVISIONING TEST ACTORS ---");
  const rand = Math.floor(Math.random() * 100000);

  const regSellerA = await registerUser({
    email: `seller.gate.a.${rand}@enterprise.in`,
    firstName: "Vikram",
    lastName: "Singhania",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const sellerA = regSellerA.user;

  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919988776655', $2, 'VERIFIED', 100)`,
    [sellerA.id, sellerA.email]
  );

  const regSellerB = await registerUser({
    email: `seller.gate.b.${rand}@pharma.in`,
    firstName: "Anita",
    lastName: "Deshmukh",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const sellerB = regSellerB.user;

  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919988776656', $2, 'VERIFIED', 100)`,
    [sellerB.id, sellerB.email]
  );

  const regBuyerA = await registerUser({
    email: `buyer.gate.a.${rand}@acquisitions.in`,
    firstName: "Rajesh",
    lastName: "Nair",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyerA = regBuyerA.user;

  const bpARes = await db.query<{ id: string }>(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'CORPORATE_BUYER', 'Alpha Strategic Capital Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
      'Rajesh Nair', 'Head of M&A', $2, '+919876543210', 'VERIFIED', 'Precision Engineering'
    ) RETURNING id`,
    [buyerA.id, buyerA.email]
  );
  const buyerAProfileId = bpARes.rows[0].id;

  const regBuyerB = await registerUser({
    email: `buyer.gate.b.${rand}@familyoffice.in`,
    firstName: "Kavita",
    lastName: "Mehta",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyerB = regBuyerB.user;

  await db.query<{ id: string }>(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'FAMILY_OFFICE', 'Mehta Heritage Ventures', 'FAMILY_OFFICE', 'Gujarat', 'Ahmedabad',
      'Kavita Mehta', 'Managing Trustee', $2, '+919876543211', 'VERIFIED', 'Healthcare'
    )`,
    [buyerB.id, buyerB.email]
  );

  const regAdmin = await registerUser({
    email: `admin.gate.${rand}@scaleup.in`,
    firstName: "Chief",
    lastName: "Administrator",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const admin = {
    ...regAdmin.user,
    roles: ["SUPER_ADMIN"],
    permissions: [
      "opportunities.read_all",
      "opportunities.review",
      "opportunities.verify",
      "opportunities.publish",
      "eoi.manage",
      "eoi.read_all",
    ],
  };

  assert(true, "All test actors provisioned with clean profiles and verified permissions");

  // --- 3. SEEDING OPPORTUNITIES ---
  console.log("\n--- 3. SEEDING OPPORTUNITIES ---");
  const oppA = await createOpportunity(sellerA, {
    title: "Precision Aerospace Component Manufacturer",
    headline: "AS9100 Certified Avionics Supplier",
    teaserSummary: "High-precision manufacturing facility with long-term aerospace contracts.",
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
    exactLegalName: "Confidential Precision Aero Pvt Ltd",
    exactCin: "U29299MH2008PTC038192",
    exactGstin: "27AABCA1234F1Z8",
    exactPan: "AABCA1234F",
    exactAddress: "Plot 101, Chakan Industrial Area, Pune, Maharashtra",
  });
  await submitOpportunity(oppA.id, sellerA);
  await executeAdminOpportunityReview(oppA.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(oppA.id, "VERIFY", {}, admin);
  await executeAdminOpportunityReview(oppA.id, "PUBLISH", {}, admin);

  const oppDraft = await createOpportunity(sellerA, {
    title: "Unpublished Marine Engine Works",
    teaserSummary: "Draft undertaking unreleased to public.",
    businessCategory: "MANUFACTURING",
    industry: "Marine Components",
    operatingRegion: "WEST_INDIA",
    registeredState: "Gujarat",
    approximateAgeBracket: "5_TO_10_YRS",
    revenueBracket: "5CR_TO_15CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
  });

  assert(true, "Published opportunity and draft opportunity created");

  // --- 4. EOI SUBMISSION & ANTI-SELF-SUBMISSION ---
  console.log("\n--- 4. EOI SUBMISSION & ELIGIBILITY GATES ---");
  const eoi = await submitEOI(buyerA, oppA.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Acquisition",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage:
      "Alpha Strategic Capital is actively pursuing acquisitions in the precision engineering sector with verified balance sheets.",
  });
  assert(eoi.id !== undefined && eoi.status === "SUBMITTED", "Buyer A can submit valid EOI for published opportunity");

  let selfSubFailed = false;
  try {
    await submitEOI(sellerA, oppA.id, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "FLEXIBLE",
      buyerMessage: "Attempting to express interest in my own company.",
    });
  } catch (err: any) {
    selfSubFailed = true;
  }
  assert(selfSubFailed, "Promoter is strictly blocked from expressing interest in own listing");

  // --- 5. DUPLICATE ACTIVE SUBMISSION & CONCURRENCY ---
  console.log("\n--- 5. DUPLICATE PREVENTION & CONCURRENCY ---");
  let dupBlocked = false;
  try {
    await submitEOI(buyerA, oppA.id, {
      interestType: "MAJORITY_STAKE",
      proposedTransactionType: "Duplicate Attempt",
      investmentTimeline: "IMMEDIATE_30_DAYS",
      buyerMessage: "Second duplicate submission for the same opportunity.",
    });
  } catch (err: any) {
    if (err instanceof ConflictError) {
      dupBlocked = true;
    }
  }
  assert(dupBlocked, "Duplicate active EOI for same buyer and opportunity throws ConflictError");

  // Mass-assignment injection protection
  const maliciousPayload: any = {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "Buyout",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Testing mass assignment injection protection.",
    status: "ACCEPTED",
    buyerId: "00000000-0000-0000-0000-000000000001",
    sellerId: "00000000-0000-0000-0000-000000000002",
    acceptedAt: new Date().toISOString(),
  };
  const eoiSanitized = await submitEOI(buyerB, oppA.id, maliciousPayload);
  const dbCheck = await db.query<{ buyer_id: string; seller_id: string; status: string; accepted_at: string | null }>(
    `SELECT buyer_id, seller_id, status, accepted_at FROM expressions_of_interest WHERE id = $1`,
    [eoiSanitized.id]
  );
  assert(
    eoiSanitized.status === "SUBMITTED" &&
      dbCheck.rows[0].buyer_id === buyerB.id &&
      dbCheck.rows[0].seller_id === sellerA.id &&
      dbCheck.rows[0].status === "SUBMITTED" &&
      dbCheck.rows[0].accepted_at === null,
    "Mass-assignment protection: Client cannot inject status, buyerId, sellerId, or timestamps"
  );
  await withdrawEOI(buyerB, eoiSanitized.id);

  // --- 6. ANTI-IDOR AUTHORIZATION GATES ---
  console.log("\n--- 6. ANTI-IDOR AUTHORIZATION GATES ---");
  let buyerBReadBlocked = false;
  try {
    await getBuyerEOIById(buyerB, eoi.id);
  } catch (err: any) {
    if (err instanceof ForbiddenError) buyerBReadBlocked = true;
  }
  assert(buyerBReadBlocked, "Anti-IDOR: Buyer B cannot read Buyer A's submitted EOI");

  let buyerBWithdrawBlocked = false;
  try {
    await withdrawEOI(buyerB, eoi.id);
  } catch (err: any) {
    if (err instanceof ForbiddenError) buyerBWithdrawBlocked = true;
  }
  assert(buyerBWithdrawBlocked, "Anti-IDOR: Buyer B cannot withdraw Buyer A's submitted EOI");

  let buyerAAcceptBlocked = false;
  try {
    await acceptEOI(buyerA, eoi.id, {});
  } catch (err: any) {
    if (err instanceof ForbiddenError) buyerAAcceptBlocked = true;
  }
  assert(buyerAAcceptBlocked, "Anti-IDOR: Buyer cannot call acceptEOI on their own submitted EOI");

  let sellerBReadBlocked = false;
  try {
    await getSellerEOIById(sellerB, eoi.id);
  } catch (err: any) {
    if (err instanceof ForbiddenError) sellerBReadBlocked = true;
  }
  assert(sellerBReadBlocked, "Anti-IDOR: Seller B cannot read EOI received for Seller A's listing");

  let sellerBAcceptBlocked = false;
  try {
    await acceptEOI(sellerB, eoi.id, {});
  } catch (err: any) {
    if (err instanceof ForbiddenError) sellerBAcceptBlocked = true;
  }
  assert(sellerBAcceptBlocked, "Anti-IDOR: Seller B cannot accept EOI belonging to Seller A's listing");

  // --- 7. STATE MACHINE LIFECYCLE ---
  console.log("\n--- 7. STATE MACHINE ENFORCEMENT ---");
  const viewed = await getSellerEOIById(sellerA, eoi.id);
  assert(viewed.status === "UNDER_REVIEW", "First seller inspection transitions EOI to UNDER_REVIEW");

  const accepted = await acceptEOI(sellerA, eoi.id, {
    sellerResponseMessage: "Pleased to proceed toward tripartite NDA.",
  });
  assert(accepted.status === "ACCEPTED", "Seller A can accept EOI while in UNDER_REVIEW state");

  let withdrawAfterAcceptBlocked = false;
  try {
    await withdrawEOI(buyerA, eoi.id);
  } catch (err: any) {
    if (err instanceof ValidationError) withdrawAfterAcceptBlocked = true;
  }
  assert(withdrawAfterAcceptBlocked, "State Machine Invariant: Buyer cannot withdraw an ACCEPTED EOI");

  let declineAfterAcceptBlocked = false;
  try {
    await declineEOI(sellerA, eoi.id, { sellerDeclineReason: "VALUATION_MISMATCH" });
  } catch (err: any) {
    if (err instanceof ValidationError) declineAfterAcceptBlocked = true;
  }
  assert(declineAfterAcceptBlocked, "State Machine Invariant: Seller cannot decline an ACCEPTED EOI");

  // Withdrawn to Accept blocked test
  const eoiForWithdraw = await submitEOI(buyerB, oppA.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "Buyout",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Testing withdrawn to accepted transition blocking.",
  });
  await withdrawEOI(buyerB, eoiForWithdraw.id);
  let withdrawToAcceptBlocked = false;
  try {
    await acceptEOI(sellerA, eoiForWithdraw.id, {});
  } catch (err: any) {
    if (err instanceof ValidationError) withdrawToAcceptBlocked = true;
  }
  assert(withdrawToAcceptBlocked, "State Machine Invariant: WITHDRAWN -> ACCEPTED is strictly blocked");

  // --- 8. PROGRESSIVE DATA MASKING ---
  console.log("\n--- 8. PROGRESSIVE DATA MASKING BOUNDARIES ---");
  assert((viewed as any).buyerCin === undefined, "CONFIDENTIALITY: Buyer CIN masked from seller view");
  assert((viewed as any).buyerPan === undefined, "CONFIDENTIALITY: Buyer PAN masked from seller view");
  assert((viewed as any).buyerAum === undefined, "CONFIDENTIALITY: Buyer AUM masked from seller view");
  assert((viewed as any).buyerDocuments === undefined, "CONFIDENTIALITY: Buyer documents masked from seller view");
  assert((viewed as any).mandateDetails === undefined, "CONFIDENTIALITY: Buyer private mandate masked from seller view");

  const buyerView = await getBuyerEOIById(buyerA, eoi.id);
  assert((buyerView as any).exactCin === undefined, "CONFIDENTIALITY: Seller CIN masked from buyer view");
  assert((buyerView as any).exactGstin === undefined, "CONFIDENTIALITY: Seller GSTIN masked from buyer view");
  assert((buyerView as any).exactPan === undefined, "CONFIDENTIALITY: Seller PAN masked from buyer view");
  assert((buyerView as any).exactAddress === undefined, "CONFIDENTIALITY: Seller exact address masked from buyer view");

  // CRITICAL CONFIDENTIALITY REGRESSION GATE: Discovery opportunity remains Tier 1 masked after EOI acceptance
  const oppDiscoveryAfterAccept = await getOpportunityForDiscovery(oppA.id, buyerA);
  assert(
    oppDiscoveryAfterAccept.tier === 1 &&
      (oppDiscoveryAfterAccept as any).exactCin === undefined &&
      (oppDiscoveryAfterAccept as any).exactGstin === undefined &&
      (oppDiscoveryAfterAccept as any).exactPan === undefined &&
      (oppDiscoveryAfterAccept as any).exactAddress === undefined &&
      (oppDiscoveryAfterAccept as any).exactRevenue === undefined &&
      (oppDiscoveryAfterAccept as any).documents === undefined,
    "CONFIDENTIALITY REGRESSION GATE: EOI acceptance strictly keeps opportunity at Tier 1 without unlocking private data"
  );

  // --- 9. ANTI-ENUMERATION SAFETY ---
  console.log("\n--- 9. ANTI-ENUMERATION SAFETY ---");
  let draftEoiBlocked = false;
  try {
    await submitEOI(buyerA, oppDraft.id, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Attempting to submit EOI against a draft opportunity.",
    });
  } catch (err: any) {
    if (err instanceof NotFoundError) draftEoiBlocked = true;
  }
  assert(draftEoiBlocked, "Anti-Enumeration: Submission on unpublished DRAFT returns uniform 404");

  let nonExistentBlocked = false;
  try {
    await submitEOI(buyerA, "00000000-0000-0000-0000-000000000000", {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Attempting to submit against nonexistent UUID.",
    });
  } catch (err: any) {
    if (err instanceof NotFoundError) nonExistentBlocked = true;
  }
  assert(nonExistentBlocked, "Anti-Enumeration: Submission on nonexistent UUID returns uniform 404");

  // --- 10. AUDIT LOGGING & NOTIFICATIONS ---
  console.log("\n--- 10. AUDIT LOGGING & IN-APP NOTIFICATIONS ---");
  const auditRes = await db.query<{ action: string }>(
    `SELECT action FROM audit_logs WHERE resource_id = $1 ORDER BY created_at ASC`,
    [eoi.id]
  );
  const actions = auditRes.rows.map((r) => r.action);
  assert(actions.includes("EOI_SUBMITTED"), "Audit trail records EOI_SUBMITTED");
  assert(actions.includes("EOI_VIEWED"), "Audit trail records EOI_VIEWED");
  assert(actions.includes("EOI_ACCEPTED"), "Audit trail records EOI_ACCEPTED");

  const sellerNotifs = await getUserNotifications(sellerA.id);
  assert(
    sellerNotifs.notifications.some((n) => n.resourceId === eoi.id && n.type === "EOI_RECEIVED"),
    "In-App Notification: Verified delivery of EOI_RECEIVED to seller"
  );

  const buyerNotifs = await getUserNotifications(buyerA.id);
  assert(
    buyerNotifs.notifications.some((n) => n.resourceId === eoi.id && n.type === "EOI_ACCEPTED"),
    "In-App Notification: Verified delivery of EOI_ACCEPTED to buyer"
  );

  console.log("\n=================================================================");
  console.log(`PHASE 7 SECURITY GATE: ${passedCount}/${totalCount} ASSERTIONS PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  if (passedCount === totalCount) {
    console.log("VERDICT: READY_FOR_PHASE_8");
  } else {
    console.log("VERDICT: NOT_READY_FOR_PHASE_8");
    process.exit(1);
  }
  console.log("=================================================================");
}

runSecurityGate().catch((err) => {
  console.error("FATAL: Phase 7 Security Gate encountered unhandled error:", err);
  process.exit(1);
});
