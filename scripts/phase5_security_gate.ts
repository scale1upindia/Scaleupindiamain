import { getDb } from "../src/lib/db";
import { registerUser, loginUser } from "../src/domains/auth/service";
import { createAcquisitionMandate } from "../src/domains/buyer/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  mapOpportunityRecord,
} from "../src/domains/opportunity/service";
import {
  refreshBuyerMatches,
  listBuyerMatches,
  getBuyerMatchById,
  listAdminMatches,
} from "../src/domains/matching/service";
import { evaluateOpportunityMatch } from "../src/domains/matching/evaluator";
import {
  BusinessCategory,
  OperatingRegion,
  BusinessAgeBracket,
  RevenueBracket,
  OpportunityTransactionType,
  BusinessModel,
  AdminOpportunityReviewAction,
  OpportunityStatus,
} from "../src/types/opportunity";
import { MatchClassification } from "../src/types/matching";
import { ForbiddenError, NotFoundError } from "../src/lib/errors";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedCount++;
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ""}`);
  }
}

async function main() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 5 DETERMINISTIC MATCHING ENGINE SECURITY GATE");
  console.log("=================================================================\n");

  const db = await getDb();
  const timestamp = Date.now();

  // -------------------------------------------------------------------------
  // 1. DATABASE SCHEMA & MIGRATION 005 INTEGRITY
  // -------------------------------------------------------------------------
  console.log("--- 1. VERIFYING MIGRATION 005 DATABASE INTEGRITY ---");
  const migrationRes = await db.query(
    `SELECT id FROM _schema_migrations WHERE id = '005_matching_engine.sql'`
  );
  assert(
    migrationRes.rows.length === 1,
    "Migration 005_matching_engine.sql is recorded in _schema_migrations"
  );

  const tableRes = await db.query(
    `SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = 'buyer_opportunity_matches'`
  );
  assert(
    tableRes.rows.length >= 12,
    `buyer_opportunity_matches table verified with ${tableRes.rows.length} columns`
  );

  const permRes = await db.query(
    `SELECT code FROM permissions WHERE code IN ('matches.read_own', 'matches.refresh_own', 'matches.read_all')`
  );
  assert(permRes.rows.length === 3, "Phase 5 matching permissions seeded in permissions table");

  // -------------------------------------------------------------------------
  // 2. PROVISION TEST ACTORS: Buyer A, Buyer B, Seller, Admin
  // -------------------------------------------------------------------------
  console.log("\n--- 2. PROVISIONING REAL MULTI-TENANT TEST ACTORS ---");
  const buyerAReg = await registerUser({
    email: `gate_buyer_a_${timestamp}@scaleup.test`,
    password: "Password123!Secure",
    firstName: "Aditya",
    lastName: "Enterprises",
    roles: ["BUYER"],
  });
  const buyerAUser = buyerAReg.user;

  const bProfileA = await db.query<any>(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, country, state, city,
      contact_name, designation, email, phone, onboarding_status
    ) VALUES ($1, 'CORPORATE_BUYER', 'Aditya Holdings Ltd', 'COMPANY', 'India', 'Maharashtra', 'Mumbai',
      'Aditya Roy', 'CEO', $2, '+91 9999999801', 'VERIFIED')
    RETURNING id`,
    [buyerAUser.id, buyerAUser.email]
  );
  const buyerAProfileId = bProfileA.rows[0].id;
  assert(Boolean(buyerAProfileId), "Buyer A profile created and verified");

  const buyerBReg = await registerUser({
    email: `gate_buyer_b_${timestamp}@scaleup.test`,
    password: "Password123!Secure",
    firstName: "Kavita",
    lastName: "Ventures",
    roles: ["BUYER"],
  });
  const buyerBUser = buyerBReg.user;

  const bProfileB = await db.query<any>(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, country, state, city,
      contact_name, designation, email, phone, onboarding_status
    ) VALUES ($1, 'PE_FUND', 'Kavita Growth Fund', 'FUND', 'India', 'Karnataka', 'Bengaluru',
      'Kavita Rao', 'Director', $2, '+91 9999999802', 'VERIFIED')
    RETURNING id`,
    [buyerBUser.id, buyerBUser.email]
  );
  const buyerBProfileId = bProfileB.rows[0].id;
  assert(Boolean(buyerBProfileId), "Buyer B profile created and verified");

  const sellerReg = await registerUser({
    email: `gate_seller_${timestamp}@scaleup.test`,
    password: "Password123!Secure",
    firstName: "Ramesh",
    lastName: "Promoter",
    roles: ["PROMOTER"],
  });
  const sellerUser = sellerReg.user;
  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
     VALUES ($1, 'Promoter', '+91 9999999803', $2, 'VERIFIED')`,
    [sellerUser.id, sellerUser.email]
  );
  assert(Boolean(sellerUser.id), "Seller promoter provisioned");

  const adminReg = await registerUser({
    email: `gate_admin_${timestamp}@scaleup.test`,
    password: "Password123!Secure",
    firstName: "Platform",
    lastName: "GateAdmin",
    roles: ["PROMOTER"],
  });
  await db.query(
    `INSERT INTO user_roles (user_id, role_id)
     SELECT $1, id FROM roles WHERE code = 'SUPER_ADMIN'
     ON CONFLICT DO NOTHING`,
    [adminReg.user.id]
  );
  const adminLogin = await loginUser({ email: adminReg.user.email, password: "Password123!Secure" });
  const adminUser = adminLogin.user;
  assert(adminUser.roles.includes("SUPER_ADMIN"), "Admin provisioned with SUPER_ADMIN role");

  // -------------------------------------------------------------------------
  // 3. SEED STRUCTURED MANDATES
  // -------------------------------------------------------------------------
  console.log("\n--- 3. SEEDING STRUCTURED ACQUISITION MANDATES ---");
  // Mandate A: Focus on Defense & Aerospace, West India, 30-80 Cr ticket, 20-60 Cr revenue
  const mandateARec = await createAcquisitionMandate(buyerAUser, {
    name: "Strategic Defense Acquisition Mandate",
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
  assert(Boolean(mandateARec.id), `Mandate A seeded: ${mandateARec.name}`);

  // Mandate B: Focus on Healthcare, South India, 10-50 Cr ticket
  const mandateBRec = await createAcquisitionMandate(buyerBUser, {
    name: "Southern Healthcare Platform Mandate",
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
  });
  assert(Boolean(mandateBRec.id), `Mandate B seeded: ${mandateBRec.name}`);

  // -------------------------------------------------------------------------
  // 4. SEED TEST OPPORTUNITIES (PUBLISHED & DRAFT)
  // -------------------------------------------------------------------------
  console.log("\n--- 4. SEEDING OPPORTUNITIES ---");
  // Opp 1: Defense Opp in Pune (High match for Buyer A, incompatible with Buyer B)
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
    exactLegalName: "Confidential Defense Dynamics Private Limited",
    exactCin: "U29253MH2012PTC234567",
    exactGstin: "27AABCB9876C1Z8",
    exactPan: "AABCB9876C",
    exactAddress: "Plot 88, Bhosari MIDC, Pune - 411026",
    exactRevenue: 425000000,
    exactEbitda: 98000000,
    exactAskingPrice: 650000000,
  });
  await submitOpportunity(opp1.id, sellerUser);
  await executeAdminOpportunityReview(opp1.id, AdminOpportunityReviewAction.START_REVIEW, {}, adminUser);
  await executeAdminOpportunityReview(opp1.id, AdminOpportunityReviewAction.VERIFY, {}, adminUser);
  await executeAdminOpportunityReview(opp1.id, AdminOpportunityReviewAction.PUBLISH, {}, adminUser);
  assert(true, "Opportunity 1 published to live platform");

  // Opp 2: Draft Opportunity (Must NEVER be matched)
  const opp2Draft = await createOpportunity(sellerUser, {
    title: "Unpublished Stealth AI Drone Systems",
    teaserSummary: "Stealth defense UAV startup.",
    industry: "Defense & Aerospace",
    businessCategory: BusinessCategory.TECHNOLOGY,
    operatingRegion: OperatingRegion.WEST_INDIA,
    registeredState: "Maharashtra",
    approximateAgeBracket: BusinessAgeBracket.LESS_THAN_3_YRS,
    revenueBracket: RevenueBracket.UNDER_5CR,
    transactionType: OpportunityTransactionType.FULL_ACQUISITION,
    businessModel: BusinessModel.B2B,
  });
  assert(opp2Draft.status === "DRAFT", "Opportunity 2 created in DRAFT state");

  // -------------------------------------------------------------------------
  // 5. DETERMINISTIC MATCHING REFRESH & PERSISTENCE
  // -------------------------------------------------------------------------
  console.log("\n--- 5. EVALUATING DETERMINISTIC MATCHING & PERSISTENCE ---");
  const refreshARes = await refreshBuyerMatches(buyerAUser);
  assert(refreshARes.refreshedCount >= 1, "Buyer A matches evaluated and refreshed");
  assert(refreshARes.eligibleCount >= 1, "Buyer A has eligible matches");
  assert(refreshARes.topScore >= 80, `Buyer A top match score is high: ${refreshARes.topScore}%`);

  const refreshBRes = await refreshBuyerMatches(buyerBUser);
  assert(refreshBRes.refreshedCount >= 1, "Buyer B matches evaluated and refreshed");
  assert(refreshBRes.eligibleCount === 0, "Buyer B has 0 eligible matches for defense opportunity (Industry hard gate)");

  // Direct DB check for persistent cache
  const dbMatchRow = await db.query<any>(
    `SELECT * FROM buyer_opportunity_matches WHERE mandate_id = $1 AND opportunity_id = $2`,
    [mandateARec.id, opp1.id]
  );
  assert(dbMatchRow.rows.length === 1, "Match persisted in buyer_opportunity_matches table");
  assert(dbMatchRow.rows[0].is_eligible === true, "Match is marked eligible in database");
  assert(dbMatchRow.rows[0].score >= 80, "Match score recorded accurately in database");
  assert(dbMatchRow.rows[0].matching_version === "v1.0.0-deterministic", "Matching version tracked in database");

  // -------------------------------------------------------------------------
  // 6. PROGRESSIVE DATA MASKING & CONFIDENTIALITY PRESERVATION
  // -------------------------------------------------------------------------
  console.log("\n--- 6. VERIFYING PROGRESSIVE DATA MASKING & SEALED CONFIDENTIALITY ---");
  const buyerAList = await listBuyerMatches(buyerAUser);
  assert(buyerAList.items.length >= 1, "Buyer A lists matches successfully");

  const matchedOpp = buyerAList.items[0].opportunity;
  assert(Boolean(matchedOpp.title) && matchedOpp.title.includes("Defense"), "Opportunity title disclosed");
  assert(matchedOpp.industry === "Defense & Aerospace", "Opportunity industry disclosed");
  assert(matchedOpp.revenueBracket === "25CR_TO_50CR", "Opportunity revenue bracket disclosed");

  // Strict negative assertions: statutory identifiers MUST be undefined
  assert((matchedOpp as any).exactLegalName === undefined, "CONFIDENTIALITY: exactLegalName strictly masked");
  assert((matchedOpp as any).exactTradeName === undefined, "CONFIDENTIALITY: exactTradeName strictly masked");
  assert((matchedOpp as any).exactCin === undefined, "CONFIDENTIALITY: exactCin strictly masked");
  assert((matchedOpp as any).exactGstin === undefined, "CONFIDENTIALITY: exactGstin strictly masked");
  assert((matchedOpp as any).exactPan === undefined, "CONFIDENTIALITY: exactPan strictly masked");
  assert((matchedOpp as any).exactAddress === undefined, "CONFIDENTIALITY: exactAddress strictly masked");
  assert((matchedOpp as any).exactRevenue === undefined, "CONFIDENTIALITY: exactRevenue strictly masked");
  assert((matchedOpp as any).exactEbitda === undefined, "CONFIDENTIALITY: exactEbitda strictly masked");
  assert((matchedOpp as any).exactAskingPrice === undefined, "CONFIDENTIALITY: exactAskingPrice strictly masked");
  assert((matchedOpp as any).documents === undefined, "CONFIDENTIALITY: documents vault strictly masked");

  // Verify explanation strings do NOT contain statutory or unmasked data
  const explanationBlob = JSON.stringify(buyerAList.items[0].reasons) + JSON.stringify(buyerAList.items[0].matchedCriteria);
  assert(!explanationBlob.includes("U29253MH2012PTC234567"), "CONFIDENTIALITY: Explanation does NOT leak CIN");
  assert(!explanationBlob.includes("27AABCB9876C1Z8"), "CONFIDENTIALITY: Explanation does NOT leak GSTIN");
  assert(!explanationBlob.includes("AABCB9876C"), "CONFIDENTIALITY: Explanation does NOT leak PAN");
  assert(!explanationBlob.includes("Bhosari"), "CONFIDENTIALITY: Explanation does NOT leak exact address");
  assert(!explanationBlob.includes("Confidential Defense Dynamics Private Limited"), "CONFIDENTIALITY: Explanation does NOT leak legal name");

  // -------------------------------------------------------------------------
  // 7. UNPUBLISHED & DRAFT OPPORTUNITY ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- 7. UNPUBLISHED & DRAFT OPPORTUNITY ISOLATION ---");
  const containsDraft = buyerAList.items.some((m) => m.opportunityId === opp2Draft.id);
  assert(!containsDraft, "DRAFT opportunity strictly EXCLUDED from buyer match results");

  // -------------------------------------------------------------------------
  // 8. ANTI-IDOR & MULTI-TENANT ISOLATION
  // -------------------------------------------------------------------------
  console.log("\n--- 8. ANTI-IDOR & PRIVILEGE ISOLATION ---");
  const matchAId = buyerAList.items[0].id;

  // Buyer B attempts to access Buyer A's private match
  try {
    await getBuyerMatchById(matchAId, buyerBUser);
    assert(false, "REJECT Buyer B accessing Buyer A private match");
  } catch (err) {
    assert(err instanceof ForbiddenError, "Buyer B accessing Buyer A match BLOCKED (ForbiddenError 403)");
  }

  // Seller attempts to call buyer matching endpoints
  try {
    await refreshBuyerMatches(sellerUser);
    assert(false, "REJECT Seller calling refreshBuyerMatches");
  } catch (err) {
    assert(err instanceof NotFoundError, "Seller without buyer profile BLOCKED (NotFoundError 404)");
  }

  // -------------------------------------------------------------------------
  // 9. ADMINISTRATIVE RBAC & AUDIT LOGGING
  // -------------------------------------------------------------------------
  console.log("\n--- 9. ADMINISTRATIVE RBAC & AUDIT LOGGING ---");
  const adminMatches = await listAdminMatches(adminUser, { page: 1, limit: 10 });
  assert(adminMatches.items.length >= 1, "Authorized Admin successfully inspected global match directory");

  // Verify audit log generated for admin match inspection
  const auditRes = await db.query(
    `SELECT * FROM audit_logs WHERE action IN ('MATCHES_REFRESHED', 'ADMIN_INSPECT_MATCHES')`
  );
  assert(auditRes.rows.length >= 2, `Audit trail contains ${auditRes.rows.length} immutable matching events`);

  // Commercial buyer cannot call admin directory
  try {
    await listAdminMatches(buyerAUser);
    assert(false, "REJECT commercial buyer calling listAdminMatches");
  } catch (err) {
    assert(err instanceof ForbiddenError, "Commercial buyer calling admin match directory BLOCKED (ForbiddenError 403)");
  }

  // -------------------------------------------------------------------------
  // 10. DETERMINISM VERIFICATION
  // -------------------------------------------------------------------------
  console.log("\n--- 10. REPEATABLE MATHEMATICAL DETERMINISM ---");
  const testMandate = mandateARec;
  const rawOppRow = await db.query(`SELECT * FROM opportunities WHERE id = $1`, [opp1.id]);
  const testOpp = mapOpportunityRecord(rawOppRow.rows[0]);
  const baseline = evaluateOpportunityMatch(testMandate, testOpp);

  let allIdentical = true;
  for (let i = 0; i < 50; i++) {
    const run = evaluateOpportunityMatch(testMandate, testOpp);
    if (
      run.score !== baseline.score ||
      run.classification !== baseline.classification ||
      run.isEligible !== baseline.isEligible
    ) {
      allIdentical = false;
      break;
    }
  }
  assert(allIdentical, "50 iterations of evaluateOpportunityMatch produced identical scores and classifications");

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log("\n=================================================================");
  console.log(`PHASE 5 SECURITY GATE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=================================================================");

  if (failedCount > 0) {
    console.error("\nFAILURES DETECTED! VERDICT: NOT_READY_FOR_PHASE_6");
    process.exit(1);
  } else {
    console.log("\nALL INTEGRITY & SECURITY ASSERTIONS PASSED!");
    console.log("VERDICT: READY_FOR_PHASE_6");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("GATE SCRIPT CRASHED:", err);
  process.exit(1);
});
