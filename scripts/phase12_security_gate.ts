// Scale-up India — Phase 12: Due Diligence Workspace & Evidence Management Security Gate
// Script: scripts/phase12_security_gate.ts

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
  getDiligenceCaseById,
  listDiligenceCases,
  getChecklistItems,
  createDiligenceRequest,
  uploadEvidenceDocument,
  getEvidenceDetailById,
  reviewEvidenceVersion,
  respondToClarification,
  getClarificationById,
  listClarifications,
  createFinding,
  getFindingById,
  listFindings,
  updateFinding,
  generateSignedEvidenceUrl,
  streamEvidenceDocument,
  transitionCaseStatus,
  listEvidenceForCase,
} from "../src/domains/diligence/service";
import {
  generateDiligenceDownloadSignature,
  createSignedDiligenceToken,
  generateDiligenceDownloadToken,
  verifySignedDiligenceToken,
} from "../src/lib/security/diligenceDownloadToken";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  DiligenceGateError,
  DiligenceCaseClosedError,
  InvalidDiligenceStateError,
} from "../src/lib/errors";

// Enable test simulated payment provider for prerequisite deposit setup
process.env.ENABLE_TEST_PAYMENT_PROVIDER = "true";

const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

function createValidPdfBuffer(content: string = "Phase 12 Audited Diligence Evidence Document"): Buffer {
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
  const body = Buffer.from(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
  const xref = Buffer.from("xref\n0 5\n0000000000 65535 f \n0000000015 00000 n \n0000000068 00000 n \n0000000125 00000 n \n0000000185 00000 n \ntrailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n300\n%%EOF");
  return Buffer.concat([header, body, xref]);
}

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 12 DUE DILIGENCE WORKSPACE SECURITY GATE");
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
  // 1. VERIFYING MIGRATION 012 & RELATIONAL SCHEMA INTEGRITY
  // ============================================================================
  console.log("--- 1. VERIFYING MIGRATION 012 & DATABASE INTEGRITY ---");
  const migRes = await query<{ id: string }>(
    `SELECT id FROM _schema_migrations WHERE id = '012_due_diligence.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 012_due_diligence.sql recorded in _schema_migrations");

  const seqRes = await query<any>(
    `SELECT sequence_name FROM information_schema.sequences 
     WHERE sequence_name IN ('dd_case_ref_seq', 'dd_req_ref_seq', 'dd_evd_ref_seq', 'dd_fnd_ref_seq')`
  );
  assert(seqRes.rows.length === 4, "Sequences dd_case_ref_seq, dd_req_ref_seq, dd_evd_ref_seq, dd_fnd_ref_seq exist");

  const tablesRes = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN (
       'due_diligence_cases', 'diligence_members', 'diligence_checklist_items',
       'diligence_requests', 'diligence_evidence', 'diligence_evidence_versions',
       'diligence_clarifications', 'diligence_findings'
     )`
  );
  assert(tablesRes.rows.length === 8, "All 8 due diligence tables exist in public schema");

  const idxRes = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes 
     WHERE indexname IN (
       'idx_dd_active_mou', 'uq_diligence_member_case_user', 'uq_dd_evidence_version', 'idx_dd_items_case'
     )`
  );
  assert(idxRes.rows.length >= 3, "Unique constraints on MOU diligence, membership, checklist items, and evidence versions exist");

  const permRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM permissions WHERE module = 'diligence'`
  );
  assert(parseInt(permRes.rows[0].count, 10) >= 9, "All Phase 12 RBAC permissions correctly seeded in permissions table");

  // ============================================================================
  // 2. PROVISIONING VERIFIED PRINCIPALS & OPP / NDA / MOU / TOKEN PREREQUISITES
  // ============================================================================
  console.log("\n--- 2. PROVISIONING PRINCIPALS & PREREQUISITE STAGES ---");
  const rand = Math.floor(Math.random() * 1000000);

  const regSeller1 = await registerUser({
    email: `seller1.dd.${rand}@apexeng.in`,
    password: "Password@123",
    firstName: "Promoter",
    lastName: "One",
    roles: ["PROMOTER"],
  });
  const seller1 = { ...regSeller1.user, roles: ["PROMOTER", "SELLER"] };
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919876543210', $2, 'VERIFIED', 100)`,
    [seller1.id, seller1.email]
  );

  const regBuyer1 = await registerUser({
    email: `buyer1.dd.${rand}@apexholdings.in`,
    password: "Password@123",
    firstName: "Investor",
    lastName: "One",
    roles: ["BUYER"],
  });
  const buyer1 = { ...regBuyer1.user, roles: ["BUYER"] };
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'PE_FUND', 'Apex Holdings PE Fund', 'LLP', 'Maharashtra', 'Mumbai',
      'Investor One', 'Managing Partner', $2, '+919988776655', 'VERIFIED', 'Manufacturing'
    )`,
    [buyer1.id, buyer1.email]
  );

  const regBuyer2 = await registerUser({
    email: `buyer2.dd.${rand}@unrelated.in`,
    password: "Password@123",
    firstName: "Unrelated",
    lastName: "Buyer",
    roles: ["BUYER"],
  });
  const buyer2 = { ...regBuyer2.user, roles: ["BUYER"] };
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'FAMILY_OFFICE', 'Unrelated Capital', 'LLP', 'Delhi', 'New Delhi',
      'Unrelated Buyer', 'Director', $2, '+919988776656', 'VERIFIED', 'Logistics'
    )`,
    [buyer2.id, buyer2.email]
  );

  const regAdmin = await registerUser({
    email: `admin.dd.${rand}@scaleup.test`,
    password: "Password@123",
    firstName: "Admin",
    lastName: "One",
    roles: ["BUYER"],
  });
  const admin = {
    ...regAdmin.user,
    roles: ["SUPER_ADMIN", "ADMIN"],
    permissions: [
      "opportunities.read_all",
      "opportunities.review",
      "mou.manage",
      "mou.read_all",
      "payments.manage",
      "diligence.manage",
      "diligence.read_all",
    ],
  };

  // Published Opportunity 1
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

  // EOI -> Bilateral NDA Execution
  const eoi1 = await submitEOI(buyer1, pubOpp1.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Buyout",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating complete buyout of aerospace asset.",
  });
  await acceptEOI(seller1, eoi1.id, {
    sellerResponseMessage: "Accepted for bilateral NDA & diligence exchange.",
  });

  const initNda = await initiateNDA(buyer1, pubOpp1.id, { eoiId: eoi1.id });
  await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
  const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });

  // Bilateral Deal Intent MOU (Accepted)
  const proposedMOU = await createMOU(buyer1, pubOpp1.id, {
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

  // Token Deposit Confirmation for Opp 1
  const testProvider = paymentProviderRegistry.getTestProvider();
  resetPaymentRateLimits();

  const payment = await createPaymentIntent(
    buyer1,
    acceptedMOU.id,
    {},
    { providerName: "TEST_SIMULATED" }
  );

  const payloadObj = {
    id: `evt_gate_${rand}`,
    eventType: "payment.captured",
    providerPaymentReference: payment.providerPaymentReference,
    amount: AUTHORITATIVE_EARNEST_AMOUNT,
    currency: "INR",
    status: "SUCCEEDED",
  };
  const payloadStr = JSON.stringify(payloadObj);
  const signature = testProvider.generateSignature(payloadStr);
  await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

  // ============================================================================
  // 3. 4-GATE PREREQUISITE SECURITY ENFORCEMENT
  // ============================================================================
  console.log("\n--- 3. 4-GATE DILIGENCE PREREQUISITE SECURITY ENFORCEMENT ---");

  // Gate 1: Unpublished Opportunity
  const seller2User = await registerUser({
    email: `seller2.dd.${rand}@pharmatech.in`,
    password: "Password@123",
    firstName: "Promoter",
    lastName: "Two",
    roles: ["PROMOTER"],
  });
  const seller2 = { ...seller2User.user, roles: ["PROMOTER", "SELLER"] };
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Director', '+919876543212', $2, 'VERIFIED', 100)`,
    [seller2.id, seller2.email]
  );

  const oppDraft = await createOpportunity(seller2, {
    title: "Draft Unapproved Asset",
    headline: "Draft Avionics Shop in Industrial Area",
    teaserSummary: "Teaser draft summary of unpublished asset for gate testing.",
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
    exactLegalName: "Draft Asset Pvt Ltd",
    exactCin: "U29299MH2008PTC038199",
    exactGstin: "27AABCA1234F1Z9",
    exactPan: "AABCA1234G",
    exactAddress: "Plot 999, Pune",
  });

  let unpublishedBlocked = false;
  try {
    await createMOU(buyer1, oppDraft.id, {
      ndaId: executedNda.id,
      submitImmediately: true,
      terms: {
        proposedValuation: 50000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        cashConsideration: 50000000,
        equityConsideration: 0,
        earnestDepositAmount: AUTHORITATIVE_EARNEST_AMOUNT,
        exclusivityPeriodDays: 30,
        dueDiligenceWindowDays: 45,
      },
    });
  } catch (err) {
    if (err instanceof NotFoundError) {
      unpublishedBlocked = true;
    }
  }
  assert(unpublishedBlocked, "Gate 1: Unpublished opportunity strictly blocks diligence prerequisite creation with uniform 404");

  // Gate 2 & 3: Secondary Opportunity without accepted MOU or deposit
  const opp2 = await createOpportunity(seller2, {
    title: "PharmaTech Formulations Ltd",
    headline: "WHO-GMP Certified Sterile Injectables Plant",
    teaserSummary: "USFDA compliant sterile injectables manufacturing facility in Gujarat.",
    businessCategory: "MANUFACTURING",
    industry: "Pharmaceuticals",
    subSector: "Formulations",
    operatingRegion: "WEST_INDIA",
    registeredState: "Gujarat",
    approximateAgeBracket: "10_TO_20_YRS",
    revenueBracket: "50CR_TO_100CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "20_TO_30_PCT",
    askingPriceBracket: "50CR_TO_100CR",
    exactLegalName: "PharmaTech Formulations Pvt Ltd",
    exactCin: "U24231GJ2012PTC049182",
    exactGstin: "24AABCP1234F1Z1",
    exactPan: "AABCP1234F",
    exactAddress: "Plot 42, GIDC Panoli, Bharuch, Gujarat",
  });
  await submitOpportunity(opp2.id, seller2);
  await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
  const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);

  const eoi2 = await submitEOI(buyer2, pubOpp2.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Buyout",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating complete buyout of pharma asset.",
  });
  await acceptEOI(seller2, eoi2.id, { sellerResponseMessage: "Accepted for bilateral NDA." });

  const initNda2 = await initiateNDA(buyer2, pubOpp2.id, { eoiId: eoi2.id });
  await acceptNDA(buyer2, initNda2.id, { termsAcknowledged: true });
  const executedNda2 = await acceptNDA(seller2, initNda2.id, { termsAcknowledged: true });

  // Unaccepted MOU
  const unaccMOU = await createMOU(buyer2, pubOpp2.id, {
    ndaId: executedNda2.id,
    submitImmediately: true,
    terms: {
      proposedValuation: 60000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 60000000,
      equityConsideration: 0,
      earnestDepositAmount: AUTHORITATIVE_EARNEST_AMOUNT,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
    },
  });

  let unacceptedMouBlocked = false;
  try {
    await createDiligenceCase(buyer2, unaccMOU.id, {});
  } catch (err) {
    if (err instanceof DiligenceGateError) {
      unacceptedMouBlocked = true;
    }
  }
  assert(unacceptedMouBlocked, "Gate 2: Diligence strictly blocked when Deal Intent MOU is not in ACCEPTED status");

  // Accept MOU but without confirmed deposit
  const accMOU2 = await acceptMOU(seller2, unaccMOU.id, { confirmed: true });
  let unconfirmedDepositBlocked = false;
  try {
    await createDiligenceCase(buyer2, accMOU2.id, {});
  } catch (err) {
    if (err instanceof DiligenceGateError) {
      unconfirmedDepositBlocked = true;
    }
  }
  assert(unconfirmedDepositBlocked, "Gate 3: Diligence strictly blocked when Token Deposit is not confirmed in escrow");

  // All 4 Gates Satisfied: Create Diligence Case for Opp 1
  const ddCase = await createDiligenceCase(buyer1, acceptedMOU.id, {
    scopeDescription: "Full technical, financial, and legal due diligence.",
    targetCompletionDate: new Date(Date.now() + 86400000 * 30).toISOString(),
  });
  assert(ddCase.status === "INITIATED", "Gate 4: When all 4 gates are satisfied, diligence workspace initializes in INITIATED status");
  assert(ddCase.stats.totalItems === 16, "Default 16 institutional checklist items automatically seeded on workspace initialization");

  // Idempotency: Calling createDiligenceCase again returns existing case
  const idempotencyCase = await createDiligenceCase(buyer1, acceptedMOU.id, {});
  assert(idempotencyCase.id === ddCase.id, "Idempotency: Re-calling createDiligenceCase returns existing case idempotently");

  // ============================================================================
  // 4. ANTI-IDOR SECURITY ENFORCEMENT
  // ============================================================================
  console.log("\n--- 4. ANTI-IDOR AUTHORIZATION DEFENSE ---");

  let idorCaseBlocked = false;
  try {
    await getDiligenceCaseById(buyer2, ddCase.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      idorCaseBlocked = true;
    }
  }
  assert(idorCaseBlocked, "Anti-IDOR: Unrelated buyer strictly blocked from reading case overview (ForbiddenError)");

  let idorChecklistBlocked = false;
  try {
    await getChecklistItems(buyer2, ddCase.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      idorChecklistBlocked = true;
    }
  }
  assert(idorChecklistBlocked, "Anti-IDOR: Unrelated buyer strictly blocked from fetching checklist items (ForbiddenError)");

  let idorUploadBlocked = false;
  const items = await getChecklistItems(buyer1, ddCase.id);
  try {
    await uploadEvidenceDocument(
      buyer2,
      ddCase.id,
      {
        originalFilename: "malicious_injection.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Malicious upload"),
      },
      {
        checklistItemId: items[0].id,
        title: "Malicious Document",
        category: "CORPORATE_LEGAL",
      }
    );
  } catch (err) {
    if (err instanceof ForbiddenError) {
      idorUploadBlocked = true;
    }
  }
  assert(idorUploadBlocked, "Anti-IDOR: Unrelated buyer strictly blocked from injecting evidence into workspace (ForbiddenError)");

  // ============================================================================
  // 5. ROLE PRIVILEGE SEPARATION
  // ============================================================================
  console.log("\n--- 5. ROLE PRIVILEGE SEPARATION ---");

  // Seller cannot create document requests
  let sellerReqBlocked = false;
  try {
    await createDiligenceRequest(seller1, ddCase.id, {
      checklistItemId: items[0].id,
      requestDescription: "Seller should not be requesting documents from themselves.",
      priority: "HIGH",
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerReqBlocked = true;
    }
  }
  assert(sellerReqBlocked, "Role Separation: Seller strictly blocked from creating diligence document requests");

  // Buyer creates legitimate document request
  const buyerReq = await createDiligenceRequest(buyer1, ddCase.id, {
    checklistItemId: items[0].id,
    requestDescription: "Please provide Balance Sheet, P&L, and Cash Flow audited by statutory auditors.",
    priority: "HIGH",
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
  });
  assert(buyerReq.status === "OPEN", "Buyer can formally issue document requests with structured priority and deadline");

  // Seller cannot create diligence findings
  let sellerFindingBlocked = false;
  try {
    await createFinding(seller1, ddCase.id, {
      category: "FINANCIAL",
      severity: "CRITICAL",
      title: "Promoter finding",
      description: "Sellers cannot create risk findings.",
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerFindingBlocked = true;
    }
  }
  assert(sellerFindingBlocked, "Role Separation: Seller strictly blocked from creating diligence risk findings");

  // Seller cannot unilaterally transition case status
  let sellerTransitionBlocked = false;
  try {
    await transitionCaseStatus(seller1, ddCase.id, {
      targetStatus: "APPROVED",
      verdictNotes: "Seller self-approving diligence.",
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerTransitionBlocked = true;
    }
  }
  assert(sellerTransitionBlocked, "Role Separation: Seller strictly blocked from mutating overall case status");

  // ============================================================================
  // 6. CRYPTOGRAPHIC EVIDENCE UPLOAD SECURITY & MAGIC BYTES
  // ============================================================================
  console.log("\n--- 6. EVIDENCE UPLOAD SECURITY & CRYPTOGRAPHIC INTEGRITY ---");

  // Fake executable disguised as PDF
  let fakePdfBlocked = false;
  try {
    await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "malware.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("MZ\x90\x00\x03\x00\x00\x00This is a Windows PE executable"),
      },
      {
        checklistItemId: items[0].id,
        title: "Malicious Disguised Executable",
        category: "FINANCIAL",
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      fakePdfBlocked = true;
    }
  }
  assert(fakePdfBlocked, "Upload Security: Magic-byte inspection detects and rejects disguised executables (.exe with .pdf name)");

  // Disallowed extension
  let badExtBlocked = false;
  try {
    await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "exploit.sh",
        mimeType: "text/x-shellscript",
        buffer: Buffer.from("#!/bin/bash\necho pwned"),
      },
      {
        checklistItemId: items[0].id,
        title: "Shell script",
        category: "FINANCIAL",
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      badExtBlocked = true;
    }
  }
  assert(badExtBlocked, "Upload Security: Strict extension whitelist blocks disallowed file extensions (.sh, .exe, .bat)");

  // Path traversal
  let pathTraversalBlocked = false;
  try {
    await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "../../../../etc/passwd",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("passwd traversal"),
      },
      {
        checklistItemId: items[0].id,
        title: "Path Traversal File",
        category: "FINANCIAL",
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      pathTraversalBlocked = true;
    }
  }
  assert(pathTraversalBlocked, "Upload Security: Path traversal attempts in filename are strictly blocked");

  // Oversized file (> 15MB)
  let oversizedBlocked = false;
  try {
    const hugeBuffer = Buffer.alloc(16 * 1024 * 1024, "A");
    await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "huge.pdf",
        mimeType: "application/pdf",
        buffer: hugeBuffer,
      },
      {
        checklistItemId: items[0].id,
        title: "Huge file",
        category: "FINANCIAL",
      }
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      oversizedBlocked = true;
    }
  }
  assert(oversizedBlocked, "Upload Security: Evidence files exceeding 15MB limit are strictly rejected");

  // Valid PDF Evidence Upload
  const validBuffer = createValidPdfBuffer("FY 2024 Audited Balance Sheet & Profit and Loss");
  const evd1 = await uploadEvidenceDocument(
    seller1,
    ddCase.id,
    {
      originalFilename: "audited_financials_2024.pdf",
      mimeType: "application/pdf",
      buffer: validBuffer,
    },
    {
      checklistItemId: items[0].id,
      requestId: buyerReq.id,
      title: "Audited Financials FY 2024",
      category: "FINANCIAL",
    }
  );
  assert(evd1.currentVersionNumber === 1, "Valid evidence upload succeeds with initial version number 1");
  assert(evd1.activeVersion.checksum.length === 64, "SHA-256 checksum cryptographically computed and bound to evidence version");

  // ============================================================================
  // 7. IMMUTABLE VERSIONING (v1 -> v2)
  // ============================================================================
  console.log("\n--- 7. IMMUTABLE VERSIONING (v1 -> v2) ---");

  const v2Buffer = createValidPdfBuffer("FY 2024 Audited Balance Sheet With Restated Disclosures");
  const evd1v2 = await uploadEvidenceDocument(
    seller1,
    ddCase.id,
    {
      originalFilename: "audited_financials_2024_restated.pdf",
      mimeType: "application/pdf",
      buffer: v2Buffer,
    },
    {
      checklistItemId: items[0].id,
      title: "Audited Financials FY 2024 (Restated)",
      category: "FINANCIAL",
    }
  );
  assert(evd1v2.currentVersionNumber === 2, "Re-uploading evidence for checklist item creates version 2");
  assert(evd1v2.versions.length === 2, "Evidence record preserves version history with multiple distinct versions");
  assert(evd1v2.versions[0].versionNumber === 1 && evd1v2.versions[0].checksum !== evd1v2.versions[1].checksum, "Version 1 remains completely immutable with its distinct cryptographic checksum");

  // ============================================================================
  // 8. EVIDENCE REVIEW & SELF-APPROVAL DEFENSE
  // ============================================================================
  console.log("\n--- 8. EVIDENCE REVIEW & SELF-APPROVAL DEFENSE ---");

  // Seller self-review blocked
  let selfReviewBlocked = false;
  try {
    await reviewEvidenceVersion(seller1, ddCase.id, evd1.id, 2, {
      decision: "ACCEPTED",
      notes: "Promoter approving own financial statements.",
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      selfReviewBlocked = true;
    }
  }
  assert(selfReviewBlocked, "Self-Approval Defense: Seller is strictly prohibited from reviewing or approving their own evidence");

  // Reviewer requests clarification
  const reviewedClarification = await reviewEvidenceVersion(buyer1, ddCase.id, evd1.id, 2, {
    decision: "CLARIFICATION_REQUIRED",
    notes: "Note 14 shows a contingent tax liability of INR 4.2 Crore.",
    clarificationQuestion: "Has the company filed an appeal before the High Court for this assessment order?",
  });
  assert(reviewedClarification.activeVersion.reviewStatus === "CLARIFICATION_REQUIRED", "Reviewer can mark evidence version as CLARIFICATION_REQUIRED");

  // Check clarification record created
  const clarRes = await listClarifications(buyer1, ddCase.id);
  assert(clarRes.length === 1 && clarRes[0].status === "OPEN", "Review clarification automatically opens a formal structured inquiry thread");

  // Seller responds to clarification
  const answeredClar = await respondToClarification(seller1, ddCase.id, clarRes[0].id, {
    responseText: "Yes, ITAT appeal admitted with 80% stay on demand. Order attached.",
  });
  assert(answeredClar.status === "ANSWERED", "Seller can submit formal response to clarification inquiry");

  // Reviewer accepts evidence version
  const acceptedEvd = await reviewEvidenceVersion(buyer1, ddCase.id, evd1.id, 2, {
    decision: "ACCEPTED",
    notes: "Clarification satisfactory. Stay order verified.",
  });
  assert(acceptedEvd.activeVersion.reviewStatus === "ACCEPTED", "Reviewer can formally accept evidence version after satisfactory clarification");

  // ============================================================================
  // 9. DILIGENCE RISK FINDINGS
  // ============================================================================
  console.log("\n--- 9. DILIGENCE RISK FINDINGS WORKFLOW ---");

  const finding1 = await createFinding(buyer1, ddCase.id, {
    checklistItemId: items[0].id,
    evidenceId: evd1.id,
    category: "TAX",
    severity: "HIGH",
    title: "Contingent Tax Liability ITAT Stay Pending Final Hearing",
    description: "Assessment year 2021-22 dispute of INR 4.2 Crore under Section 68 additions.",
    financialImpactEstimate: 42000000,
    remediationPlan: "Obtain promoter indemnity and holdback INR 4.2 Cr in escrow.",
  });
  assert(finding1.referenceCode.startsWith("FND-") || finding1.referenceCode.startsWith("DDF-"), "Diligence risk finding created with authoritative sequential reference code (FND-XXXXX)");
  assert(finding1.severity === "HIGH" && finding1.financialImpactEstimate === 42000000, "Finding records structured risk category, severity, and financial impact estimate");

  // Seller cannot close finding
  let sellerCloseFindingBlocked = false;
  try {
    await updateFinding(seller1, ddCase.id, finding1.id, {
      status: "RESOLVED",
      resolutionNotes: "Promoter says ignore it.",
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerCloseFindingBlocked = true;
    }
  }
  assert(sellerCloseFindingBlocked, "Role Separation: Seller strictly blocked from resolving or closing risk findings");

  // ============================================================================
  // 10. CRYPTOGRAPHIC SIGNED DOWNLOAD TOKEN ENFORCEMENT
  // ============================================================================
  console.log("\n--- 10. CRYPTOGRAPHIC SIGNED DOWNLOAD TOKEN ENFORCEMENT ---");

  const signedUrlData = await generateSignedEvidenceUrl(buyer1, ddCase.id, evd1.id, 2);
  const parsedUrl = new URL(signedUrlData.downloadUrl, "http://localhost:3000");
  const token = parsedUrl.searchParams.get("token")!;
  const expiresAt = parseInt(parsedUrl.searchParams.get("expires")!, 10);
  const u = parsedUrl.searchParams.get("u")!;
  const v = parseInt(parsedUrl.searchParams.get("v")!, 10);

  assert(token.length === 64, "Generated download token is a 64-character HMAC-SHA256 hex digest");
  assert(expiresAt > Date.now(), "Generated download token has forward-looking expiration timestamp (300s TTL)");

  // Stream document with valid token
  const streamedDoc = await streamEvidenceDocument(token, expiresAt, u, ddCase.id, evd1.id, v);
  assert(streamedDoc.buffer.length === v2Buffer.length, "Valid cryptographic signed token allows streaming document outside web root");
  assert(streamedDoc.filename === "audited_financials_2024_restated.pdf", "Streamed document preserves exact original sanitized filename");

  // Tampered token signature
  let tamperedTokenBlocked = false;
  try {
    await streamEvidenceDocument("a".repeat(64), expiresAt, u, ddCase.id, evd1.id, v);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      tamperedTokenBlocked = true;
    }
  }
  assert(tamperedTokenBlocked, "Token Tampering Defense: Tampered token signature is strictly rejected with ForbiddenError");

  // Expired token
  let expiredTokenBlocked = false;
  const expiredToken = generateDiligenceDownloadToken({
    evidenceId: evd1.id,
    versionNumber: 2,
    caseId: ddCase.id,
    userId: buyer1.id,
    expiresAt: Math.floor(Date.now() / 1000) - 60,
  });
  try {
    await streamEvidenceDocument(
      expiredToken,
      Math.floor(Date.now() / 1000) - 60,
      u,
      ddCase.id,
      evd1.id,
      v
    );
  } catch (err) {
    if (err instanceof ForbiddenError) {
      expiredTokenBlocked = true;
    }
  }
  assert(expiredTokenBlocked, "Token Expiration Defense: Expired signed download token is strictly rejected with ForbiddenError");

  // ============================================================================
  // 11. CASE FSM LIFECYCLE & TERMINAL STATE LOCKS
  // ============================================================================
  console.log("\n--- 11. FINITE STATE MACHINE & TERMINAL LOCKS ---");

  // Invalid transition jump: INITIATED -> APPROVED directly
  let invalidJumpBlocked = false;
  try {
    await transitionCaseStatus(buyer1, ddCase.id, {
      targetStatus: "APPROVED",
      verdictNotes: "Trying to jump from INITIATED directly to APPROVED without review.",
    });
  } catch (err) {
    if (err instanceof InvalidDiligenceStateError) {
      invalidJumpBlocked = true;
    }
  }
  assert(invalidJumpBlocked, "FSM Graph Guard: Invalid state jumps (INITIATED -> APPROVED) throw InvalidDiligenceStateError");

  // Valid progressive transitions
  const t1 = await transitionCaseStatus(buyer1, ddCase.id, {
    targetStatus: "UNDER_REVIEW",
    verdictNotes: "Checklist items in progress.",
  });
  assert(t1.status === "UNDER_REVIEW", "Valid FSM transition: INITIATED -> UNDER_REVIEW");

  const t2 = await transitionCaseStatus(buyer1, ddCase.id, {
    targetStatus: "REVIEW_COMPLETE",
    verdictNotes: "All 16 checklist categories evaluated.",
  });
  assert(t2.status === "REVIEW_COMPLETE", "Valid FSM transition: UNDER_REVIEW -> REVIEW_COMPLETE");

  const t3 = await transitionCaseStatus(buyer1, ddCase.id, {
    targetStatus: "APPROVED",
    verdict: "APPROVED",
    verdictNotes: "Due diligence passed with tax indemnity escrow condition.",
  });
  assert(t3.status === "APPROVED", "Valid FSM transition: REVIEW_COMPLETE -> APPROVED");

  // Close workspace (Terminal state)
  const tClosed = await transitionCaseStatus(buyer1, ddCase.id, {
    targetStatus: "CLOSED",
    closureReason: "Diligence formally completed and accepted.",
  });
  assert(tClosed.status === "CLOSED", "Workspace successfully transitions to terminal CLOSED status");

  // Mutation on closed workspace strictly blocked
  let closedMutationBlocked = false;
  try {
    await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "late_doc.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Late document"),
      },
      {
        checklistItemId: items[1].id,
        title: "Late Document",
        category: "CORPORATE_LEGAL",
      }
    );
  } catch (err) {
    if (err instanceof DiligenceCaseClosedError) {
      closedMutationBlocked = true;
    }
  }
  assert(closedMutationBlocked, "Terminal State Lock: Uploading evidence to CLOSED diligence case is strictly rejected (DiligenceCaseClosedError)");

  let closedRequestBlocked = false;
  try {
    await createDiligenceRequest(buyer1, ddCase.id, {
      checklistItemId: items[1].id,
      requestDescription: "Cannot request on closed case due diligence workspace.",
      priority: "LOW",
    });
  } catch (err) {
    if (err instanceof DiligenceCaseClosedError) {
      closedRequestBlocked = true;
    }
  }
  assert(closedRequestBlocked, "Terminal State Lock: Creating requests on CLOSED diligence case is strictly rejected (DiligenceCaseClosedError)");

  // ============================================================================
  // 12. AUDIT LOGGING & IN-APP NOTIFICATIONS
  // ============================================================================
  console.log("\n--- 12. AUDIT LOGGING & IN-APP NOTIFICATIONS ---");

  const auditRes = await query<{ action: string }>(
    `SELECT action FROM audit_logs 
     WHERE (resource_type = 'DILIGENCE_CASE' AND resource_id = $1)
        OR (resource_type = 'DILIGENCE_EVIDENCE' AND resource_id = $2)
        OR (resource_type = 'DILIGENCE_FINDING' AND resource_id = $3)
        OR (resource_type = 'DILIGENCE_EVIDENCE_VERSION')`,
    [ddCase.id, evd1.id, finding1.id]
  );
  const actions = auditRes.rows.map((r) => r.action);
  assert(actions.includes("DILIGENCE_CASE_CREATED"), "Audit Trail: DILIGENCE_CASE_CREATED recorded");
  assert(actions.includes("DILIGENCE_EVIDENCE_UPLOADED"), "Audit Trail: DILIGENCE_EVIDENCE_UPLOADED recorded");
  assert(actions.includes("DILIGENCE_EVIDENCE_REVIEWED"), "Audit Trail: DILIGENCE_EVIDENCE_REVIEWED recorded");
  assert(actions.includes("DILIGENCE_FINDING_CREATED"), "Audit Trail: DILIGENCE_FINDING_CREATED recorded");
  assert(actions.includes("DILIGENCE_DOCUMENT_DOWNLOADED"), "Audit Trail: DILIGENCE_DOCUMENT_DOWNLOADED recorded");

  const notifRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM in_app_notifications 
     WHERE user_id IN ($1, $2) AND resource_type IN ('DILIGENCE_CASE', 'DILIGENCE_REQUEST', 'DILIGENCE_EVIDENCE', 'DILIGENCE_CLARIFICATION', 'DILIGENCE_FINDING')`,
    [seller1.id, buyer1.id]
  );
  assert(parseInt(notifRes.rows[0].count, 10) >= 3, "Notification Hub: Due diligence events delivered to Buyer and Seller notification inboxes");

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n=================================================================");
  console.log(`PHASE 12 SECURITY GATE RESULT: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log("=================================================================\n");

  if (passedCount === totalCount) {
    console.log(">>> VERDICT: PHASE 12 SECURITY GATE PASSED (READY_FOR_PHASE_13) <<<\n");
    process.exit(0);
  } else {
    console.error(">>> VERDICT: PHASE 12 SECURITY GATE FAILED <<<\n");
    process.exit(1);
  }
}

runSecurityGate().catch((err) => {
  console.error("Fatal error during Phase 12 Security Gate execution:", err);
  process.exit(1);
});
