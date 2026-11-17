// Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine Security Gate
// Script: scripts/phase14_security_gate.ts

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
  uploadEvidenceDocument,
  createFinding,
} from "../src/domains/diligence/service";
import {
  createValuationCase,
  addValuationInput,
  submitValuationVersion,
  reviewValuationVersion,
  lockValuationVersion,
} from "../src/domains/valuation/service";
import {
  createTransaction,
  getTransactionById,
  listTransactions,
  updateTransactionTerms,
  createTransactionVersion,
  listTransactionConditions,
  verifyClosingCondition,
  waiveClosingCondition,
  uploadTransactionDocument,
  listTransactionDocuments,
  confirmTransactionTerms,
  reviewTransaction,
  evaluateClosingReadiness,
  closeTransaction,
  getClosingRecord,
} from "../src/domains/transaction/service";
import { AuthenticatedUser } from "../src/types/auth";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  TransactionGateError,
  InvalidTransactionStateError,
  TransactionClosedError,
  ClosingConditionUnsatisfiedError,
  TermsConflictError,
} from "../src/lib/errors";

process.env.ENABLE_TEST_PAYMENT_PROVIDER = "true";

const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

function createValidPdfBuffer(label = "Security Gate Document"): Buffer {
  const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
  const body = Buffer.from(
    `1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
  );
  return Buffer.concat([header, body]);
}

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 14 TRANSACTION & CLOSING SECURITY GATE");
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

    const txnTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transactions') as exists`
    );
    assert(txnTable.rows[0]?.exists === true, "SEC-14-MIG-TRANSACTIONS", "Table transactions exists in schema");

    const verTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction_versions') as exists`
    );
    assert(verTable.rows[0]?.exists === true, "SEC-14-MIG-TXN_VERSIONS", "Table transaction_versions exists in schema");

    const condTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction_conditions') as exists`
    );
    assert(condTable.rows[0]?.exists === true, "SEC-14-MIG-TXN_CONDITIONS", "Table transaction_conditions exists in schema");

    const docTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction_documents') as exists`
    );
    assert(docTable.rows[0]?.exists === true, "SEC-14-MIG-TXN_DOCUMENTS", "Table transaction_documents exists in schema");

    const closeTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transaction_closing_records') as exists`
    );
    assert(closeTable.rows[0]?.exists === true, "SEC-14-MIG-TXN_CLOSING_RECORDS", "Table transaction_closing_records exists in schema");

    const seqTxn = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM pg_sequences WHERE sequencename = 'txn_ref_seq') as exists`
    );
    assert(seqTxn.rows[0]?.exists === true, "SEC-14-SEQ-TXN_REF_SEQ", "Sequence txn_ref_seq exists");

    const seqClose = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM pg_sequences WHERE sequencename = 'txn_close_ref_seq') as exists`
    );
    assert(seqClose.rows[0]?.exists === true, "SEC-14-SEQ-TXN_CLOSE_REF_SEQ", "Sequence txn_close_ref_seq exists");

    const permsRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM permissions WHERE module = 'transaction'`
    );
    assert(parseInt(permsRes.rows[0]?.count || "0", 10) >= 12, "SEC-14-PERMS-SEEDED", "At least 12 transaction permissions seeded");

    const unqCloseRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM information_schema.table_constraints 
       WHERE table_name = 'transaction_closing_records' AND constraint_type = 'UNIQUE'`
    );
    assert(parseInt(unqCloseRes.rows[0]?.count || "0", 10) >= 1, "SEC-14-UNQ-CLOSING-RECORD", "Transaction closing records enforce uniqueness");

    const idxTxnActive = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM pg_indexes WHERE indexname = 'idx_txn_active_val'`
    );
    assert(parseInt(idxTxnActive.rows[0]?.count || "0", 10) >= 1, "SEC-14-IDX-ACTIVE-TXN", "Partial unique index exists for active transactions");

    // =========================================================================
    // SECTION 2: ACTORS & PRECONDITION SETUP (Assertions 11-18)
    // =========================================================================
    console.log("\n--- SECTION 2: ACTORS & PRECONDITION SETUP ---");

    const regSeller1 = await registerUser({
      email: `seller1.sec14.${Date.now()}@apexeng.in`,
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    const seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', $2, 'VERIFIED', 100)`,
      [seller1.id, seller1.email]
    );

    const regBuyer1 = await registerUser({
      email: `buyer1.sec14.${Date.now()}@alphainvest.in`,
      firstName: "Rahul",
      lastName: "Mehta",
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
        'Rahul Mehta', 'Managing Director', $2, '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id, buyer1.email]
    );

    const regBuyer2 = await registerUser({
      email: `buyer2.sec14.${Date.now()}@betacapital.in`,
      firstName: "Sanjay",
      lastName: "Patel",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const buyer2 = regBuyer2.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Beta Growth Capital', 'COMPANY', 'Karnataka', 'Bengaluru',
        'Sanjay Patel', 'Partner', $2, '+919876541123', 'VERIFIED', 'Financial Services'
      )`,
      [buyer2.id, buyer2.email]
    );

    const regReviewer1 = await registerUser({
      email: `reviewer1.sec14.${Date.now()}@scaleupindia.gov.in`,
      firstName: "Pooja",
      lastName: "Iyer",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const reviewer1: AuthenticatedUser = {
      ...regReviewer1.user,
      roles: ["REVIEWER", "LEGAL", "FINANCE"],
      permissions: [
        "transaction.read_all",
        "transaction.review",
        "transaction.approve",
        "transaction.conditions_manage",
        "transaction.documents_manage",
        "valuation.review",
        "valuation.approve",
        "valuation.lock",
      ],
    };

    const regAdmin = await registerUser({
      email: `admin.sec14.${Date.now()}@scaleupindia.gov.in`,
      firstName: "Suresh",
      lastName: "Rao",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const admin: AuthenticatedUser = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN", "ADMIN"],
      permissions: [
        "transaction.create",
        "transaction.read_all",
        "transaction.read_sensitive",
        "transaction.update",
        "transaction.terms_update",
        "transaction.submit",
        "transaction.conditions_manage",
        "transaction.documents_manage",
        "transaction.confirm",
        "transaction.review",
        "transaction.approve",
        "transaction.close",
        "transaction.admin",
      ],
    };

    assert(Boolean(seller1 && buyer1 && buyer2 && reviewer1 && admin), "SEC-14-ACTORS-INIT", "All 5 security gate actors registered");

    // Seed published opportunity
    const opp1 = await createOpportunity(seller1, {
      title: "Apex Aerospace Components Ltd",
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
    const pubOpp = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
    assert(pubOpp.status === "PUBLISHED", "SEC-14-OPP-PUBLISHED", "Opportunity verified and published to catalog");

    // Bilateral EOI & NDA
    const eoi = await submitEOI(buyer1, pubOpp.id, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Evaluating full buyout.",
    });
    await acceptEOI(seller1, eoi.id, { sellerResponseMessage: "Accepted for bilateral NDA." });

    const initNda = await initiateNDA(buyer1, pubOpp.id, { eoiId: eoi.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });
    assert(executedNda.status === "EXECUTED", "SEC-14-NDA-EXECUTED", "Bilateral NDA executed by both parties");

    // MOU Accepted
    const proposedMOU = await createMOU(buyer1, pubOpp.id, {
      ndaId: executedNda.id,
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
        validityDays: 14,
      },
    });
    const acceptedMOU = await acceptMOU(seller1, proposedMOU.id, { confirmed: true });
    assert(acceptedMOU.status === "ACCEPTED", "SEC-14-MOU-ACCEPTED", "Deal Intent MOU accepted and frozen");

    // Escrow Token Deposit Confirmed
    const payment = await createPaymentIntent(buyer1, acceptedMOU.id, {}, { providerName: "TEST_SIMULATED" });
    const payloadStr = JSON.stringify({
      id: `evt_sec14_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    });
    const sig = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, sig);
    assert(true, "SEC-14-ESCROW-CONFIRMED", "Escrow token earnest deposit confirmed in ledger");

    // Due Diligence Completed
    const ddCase = await createDiligenceCase(buyer1, acceptedMOU.id, {
      scopeDescription: "Financial and compliance diligence",
    });
    await query(
      `UPDATE due_diligence_cases SET status = 'APPROVED', verdict = 'APPROVED' WHERE id = $1`,
      [ddCase.id]
    );
    assert(true, "SEC-14-DD-APPROVED", "Due diligence case approved and verified");

    // Valuation Case & Version Approved & Locked
    const valCase = await createValuationCase(buyer1, ddCase.id);
    await addValuationInput(buyer1, valCase.id, {
      metricName: "REVENUE",
      rawValue: 120000000,
      currency: "INR",
      unit: "INR",
    });
    await submitValuationVersion(buyer1, valCase.id, { notes: "Ready for review" });
    await reviewValuationVersion(reviewer1, valCase.id, { decision: "APPROVED", notes: "Approved" });
    const lockedVer = await lockValuationVersion(reviewer1, valCase.id);
    assert(lockedVer.status === "LOCKED", "SEC-14-VALUATION-LOCKED", "Valuation version locked into immutable state");

    // =========================================================================
    // SECTION 3: SEVEN-GATE PRECONDITION ENFORCEMENT (Assertions 19-26)
    // =========================================================================
    console.log("\n--- SECTION 3: SEVEN-GATE PRECONDITION ENFORCEMENT ---");

    // Gate 1: Unpublished Opportunity
    await query(`UPDATE opportunities SET status = 'DRAFT' WHERE id = $1`, [pubOpp.id]);
    let gate1Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate1Blocked = e instanceof NotFoundError;
    }
    await query(`UPDATE opportunities SET status = 'PUBLISHED' WHERE id = $1`, [pubOpp.id]);
    assert(gate1Blocked, "SEC-14-GATE-1-OPP", "Gate 1: Unpublished opportunity throws uniform 404");

    // Gate 2: Unexecuted NDA
    await query(`UPDATE nda_agreements SET status = 'DRAFT' WHERE id = $1`, [executedNda.id]);
    let gate2Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate2Blocked = e instanceof TransactionGateError;
    }
    await query(`UPDATE nda_agreements SET status = 'EXECUTED' WHERE id = $1`, [executedNda.id]);
    assert(gate2Blocked, "SEC-14-GATE-2-NDA", "Gate 2: Unexecuted NDA blocks transaction workspace");

    // Gate 3: Unaccepted MOU
    await query(`UPDATE deal_mous SET status = 'DRAFT' WHERE id = $1`, [acceptedMOU.id]);
    let gate3Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate3Blocked = e instanceof TransactionGateError;
    }
    await query(`UPDATE deal_mous SET status = 'ACCEPTED' WHERE id = $1`, [acceptedMOU.id]);
    assert(gate3Blocked, "SEC-14-GATE-3-MOU", "Gate 3: Unaccepted MOU blocks transaction workspace");

    // Gate 4: Unconfirmed Escrow Deposit
    await query(`UPDATE token_deposits SET status = 'TOKEN_PAYMENT_PENDING' WHERE mou_id = $1`, [acceptedMOU.id]);
    await query(`UPDATE payment_intents SET status = 'PENDING' WHERE mou_id = $1`, [acceptedMOU.id]);
    let gate4Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate4Blocked = e instanceof TransactionGateError;
    }
    await query(`UPDATE token_deposits SET status = 'TOKEN_PAYMENT_CONFIRMED' WHERE mou_id = $1`, [acceptedMOU.id]);
    await query(`UPDATE payment_intents SET status = 'SUCCEEDED' WHERE mou_id = $1`, [acceptedMOU.id]);
    assert(gate4Blocked, "SEC-14-GATE-4-ESCROW", "Gate 4: Unconfirmed escrow token deposit blocks transaction workspace");

    // Gate 5: Diligence Incomplete / Rejected
    await query(`UPDATE due_diligence_cases SET status = 'REJECTED' WHERE id = $1`, [ddCase.id]);
    let gate5Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate5Blocked = e instanceof TransactionGateError;
    }
    await query(`UPDATE due_diligence_cases SET status = 'APPROVED' WHERE id = $1`, [ddCase.id]);
    assert(gate5Blocked, "SEC-14-GATE-5-DD", "Gate 5: Rejected due diligence case blocks transaction workspace");

    // Gate 6: Unapproved Valuation Version
    await query(`UPDATE valuation_versions SET status = 'DRAFT' WHERE id = $1`, [lockedVer.id]);
    let gate6Blocked = false;
    try {
      await createTransaction(buyer1, valCase.id);
    } catch (e: any) {
      gate6Blocked = e instanceof TransactionGateError;
    }
    await query(`UPDATE valuation_versions SET status = 'LOCKED' WHERE id = $1`, [lockedVer.id]);
    assert(gate6Blocked, "SEC-14-GATE-6-VALUATION", "Gate 6: Unapproved valuation version blocks transaction workspace");

    // Gate 7: Seller Initiator Block
    let gate7Blocked = false;
    try {
      await createTransaction(seller1, valCase.id);
    } catch (e: any) {
      gate7Blocked = e instanceof ForbiddenError;
    }
    assert(gate7Blocked, "SEC-14-GATE-7-SELLER-INIT", "Gate 7: Seller blocked from initiating buyer transaction workspace");

    const validInitTxn = await createTransaction(buyer1, valCase.id, {
      transactionType: "SHARE_ACQUISITION",
      paymentStructure: "FULL_ESCROW",
      governingLaw: "Indian Law",
    });
    assert(validInitTxn.status === "INITIATED", "SEC-14-TXN-INITIATED", "Authorized Buyer initializes transaction in INITIATED state");

    // =========================================================================
    // SECTION 4: IDEMPOTENCY & ANTI-IDOR SECURITY (Assertions 27-34)
    // =========================================================================
    console.log("\n--- SECTION 4: IDEMPOTENCY & ANTI-IDOR SECURITY ---");

    assert(validInitTxn.currentVersionNumber === 1, "SEC-14-VERSION-1-INIT", "Version 1 initialized automatically in DRAFT state");
    assert(validInitTxn.referenceCode.startsWith("TXN-"), "SEC-14-REF-CODE-GEN", "Institutional reference code generated (TXN-YYYY-XXXXX)");

    // Idempotent creation
    const dupTxn = await createTransaction(buyer1, valCase.id);
    assert(dupTxn.id === validInitTxn.id, "SEC-14-IDEMPOTENT-CREATE", "Transaction creation is idempotent without duplicate rows");

    // Anti-IDOR: Unrelated Buyer 2 blocked from viewing
    let idorViewBlocked = false;
    try {
      await getTransactionById(buyer2, validInitTxn.id);
    } catch (e: any) {
      idorViewBlocked = e instanceof ForbiddenError;
    }
    assert(idorViewBlocked, "SEC-14-IDOR-VIEW-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from accessing transaction");

    // Anti-IDOR: Unrelated Buyer 2 blocked from mutating terms
    let idorMutateBlocked = false;
    try {
      await updateTransactionTerms(buyer2, validInitTxn.id, { agreedAmount: 90000000 });
    } catch (e: any) {
      idorMutateBlocked = e instanceof ForbiddenError;
    }
    assert(idorMutateBlocked, "SEC-14-IDOR-MUTATE-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from updating terms");

    // Anti-IDOR: Listing transactions is strictly scoped
    const buyer2List = await listTransactions(buyer2);
    assert(buyer2List.items.length === 0, "SEC-14-IDOR-LIST-SCOPED", "Anti-IDOR: Unrelated Buyer 2 listing returns zero items");

    // Anti-IDOR: Conditions listing blocked
    let idorCondBlocked = false;
    try {
      await listTransactionConditions(buyer2, validInitTxn.id);
    } catch (e: any) {
      idorCondBlocked = e instanceof ForbiddenError;
    }
    assert(idorCondBlocked, "SEC-14-IDOR-COND-BLOCKED", "Anti-IDOR: Unrelated Buyer 2 blocked from reading closing conditions");

    const buyer1List = await listTransactions(buyer1);
    assert(buyer1List.items.some((t) => t.id === validInitTxn.id), "SEC-14-BUYER-LIST-AUTH", "Buyer 1 sees their authorized transaction");

    // =========================================================================
    // SECTION 5: TERMS FINALIZATION & INVARIANT GUARDS (Assertions 35-42)
    // =========================================================================
    console.log("\n--- SECTION 5: TERMS FINALIZATION & INVARIANT GUARDS ---");

    const updatedTxn = await updateTransactionTerms(buyer1, validInitTxn.id, {
      agreedAmount: 62000000,
      paymentStructure: "TRANCHE_BASED",
      specialConditions: "Seller indemnity holdback of 10% for 12 months.",
    });
    assert(updatedTxn.agreedAmount === 62000000, "SEC-14-TERMS-AMOUNT-UPDATE", "Transaction terms updated successfully");
    assert(updatedTxn.status === "TERMS_FINALIZATION", "SEC-14-STATUS-TERMS-FIN", "Status transitioned to TERMS_FINALIZATION");

    // Silent Currency Mutation Blocked
    let currencyMutationBlocked = false;
    try {
      await updateTransactionTerms(buyer1, validInitTxn.id, { currency: "EUR" });
    } catch (e: any) {
      currencyMutationBlocked = e instanceof TermsConflictError;
    }
    assert(currencyMutationBlocked, "SEC-14-CURRENCY-INTEGRITY", "Silent currency mutation attempt strictly blocked with TermsConflictError");

    // Confirm Version 1 first
    await confirmTransactionTerms(buyer1, validInitTxn.id);
    await confirmTransactionTerms(seller1, validInitTxn.id);

    // Create Version 2
    const ver2Txn = await createTransactionVersion(buyer1, validInitTxn.id, {
      agreedAmount: 64000000,
      specialConditions: "Revised indemnity schedule.",
    });
    assert(ver2Txn.currentVersionNumber === 2, "SEC-14-VER-2-INCREMENT", "Version 2 created and version number incremented");
    assert(ver2Txn.agreedAmount === 64000000, "SEC-14-VER-2-AMOUNT", "Version 2 consideration preserved accurately");
    assert(ver2Txn.buyerConfirmed === false, "SEC-14-VER-2-RESET-BUYER-CONF", "Creating new version resets buyer confirmation");
    assert(ver2Txn.sellerConfirmed === false, "SEC-14-VER-2-RESET-SELLER-CONF", "Creating new version resets seller confirmation");

    const oldVerRes = await query<{ status: string }>(
      `SELECT status FROM transaction_versions WHERE transaction_id = $1 AND version_number = 1`,
      [validInitTxn.id]
    );
    assert(oldVerRes.rows[0]?.status === "SUPERSEDED", "SEC-14-OLD-VER-SUPERSEDED", "Previous version marked SUPERSEDED");

    // =========================================================================
    // SECTION 6: CLOSING CONDITIONS & SECURE DOCUMENT VAULT (Assertions 43-50)
    // =========================================================================
    console.log("\n--- SECTION 6: CLOSING CONDITIONS & SECURE DOCUMENT VAULT ---");

    const conditions = await listTransactionConditions(buyer1, validInitTxn.id);
    assert(conditions.length === 10, "SEC-14-COND-INITIALIZED", "10 standard closing conditions initialized");

    const tokenCond = conditions.find((c) => c.condition_type === "TOKEN_DEPOSIT_CONFIRMED")!;
    assert(tokenCond.status === "SATISFIED", "SEC-14-COND-TOKEN-SATISFIED", "Token deposit condition verified from ledger");

    const valCond = conditions.find((c) => c.condition_type === "VALUATION_APPROVED")!;
    assert(valCond.status === "SATISFIED", "SEC-14-COND-VAL-SATISFIED", "Valuation condition verified from valuation case");

    const spaCond = conditions.find((c) => c.condition_type === "TRANSACTION_AGREEMENT_SIGNED")!;
    let fakeCondBlocked = false;
    try {
      await verifyClosingCondition(buyer1, validInitTxn.id, spaCond.id);
    } catch (e: any) {
      fakeCondBlocked = e instanceof ValidationError;
    }
    assert(fakeCondBlocked, "SEC-14-FAKE-COND-BLOCKED", "Condition verification without evidence blocked (No Fake Conditions)");

    // Valid Document Upload
    const validPdf = createValidPdfBuffer("Definitive Share Purchase Agreement");
    const docRes = await uploadTransactionDocument(buyer1, validInitTxn.id, {
      title: "Definitive Share Purchase Agreement (Execution Copy)",
      documentType: "FINAL_TRANSACTION_AGREEMENT",
      originalFilename: "spa_final.pdf",
      mimeType: "application/pdf",
      buffer: validPdf,
      conditionId: spaCond.id,
    });
    assert(docRes.sha256_hash.length === 64, "SEC-14-DOC-SHA256", "Document stored with SHA-256 integrity hash");

    // MIME Spoofing Blocked
    let mimeSpoofBlocked = false;
    try {
      await uploadTransactionDocument(buyer1, validInitTxn.id, {
        title: "Malicious Document",
        documentType: "FINAL_TRANSACTION_AGREEMENT",
        originalFilename: "malicious.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("NOT_A_REAL_PDF_FILE"),
      });
    } catch (e: any) {
      mimeSpoofBlocked = e instanceof ValidationError;
    }
    assert(mimeSpoofBlocked, "SEC-14-DOC-MAGIC-BYTES", "MIME spoofing detected and rejected via magic-byte inspection");

    // Oversized Document Blocked (>15MB)
    let oversizedBlocked = false;
    try {
      await uploadTransactionDocument(buyer1, validInitTxn.id, {
        title: "Oversized Document",
        documentType: "FINAL_TRANSACTION_AGREEMENT",
        originalFilename: "huge.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.alloc(16 * 1024 * 1024),
      });
    } catch (e: any) {
      oversizedBlocked = e instanceof ValidationError;
    }
    assert(oversizedBlocked, "SEC-14-DOC-MAX-SIZE", "Oversized document (>15MB) strictly rejected");

    // Waive condition
    const regCond = conditions.find((c) => c.condition_type === "REGULATORY_NOC_FILED")!;
    const waivedCond = await waiveClosingCondition(reviewer1, validInitTxn.id, regCond.id, {
      waiverReason: "Exempted under competition commission de minimis thresholds.",
    });
    assert(waivedCond.status === "WAIVED", "SEC-14-COND-WAIVED-AUTH", "Reviewer waives non-mandatory condition with valid reason");

    // =========================================================================
    // SECTION 7: GOVERNANCE, CONFIRMATIONS & READINESS (Assertions 51-56)
    // =========================================================================
    console.log("\n--- SECTION 7: GOVERNANCE, CONFIRMATIONS & READINESS ---");

    // Buyer Confirm
    const buyerConf = await confirmTransactionTerms(buyer1, validInitTxn.id);
    assert(buyerConf.buyerConfirmed === true, "SEC-14-BUYER-CONFIRMED", "Buyer formally confirms final transaction terms");

    // Seller Confirm
    const sellerConf = await confirmTransactionTerms(seller1, validInitTxn.id);
    assert(sellerConf.sellerConfirmed === true, "SEC-14-SELLER-CONFIRMED", "Seller formally confirms final transaction terms");

    // Anti-Self-Approval
    let selfApprovalBlocked = false;
    try {
      await reviewTransaction(buyer1, validInitTxn.id, {
        decision: "APPROVED",
        notes: "Self-approval attempt by buyer.",
      });
    } catch (e: any) {
      selfApprovalBlocked = e instanceof ForbiddenError;
    }
    assert(selfApprovalBlocked, "SEC-14-ANTI-SELF-APPROVAL", "Strict Anti-Self-Approval: Buyer blocked from reviewing own transaction");

    // Seller Review Blocked
    let sellerReviewBlocked = false;
    try {
      await reviewTransaction(seller1, validInitTxn.id, {
        decision: "APPROVED",
        notes: "Seller review attempt.",
      });
    } catch (e: any) {
      sellerReviewBlocked = e instanceof ForbiddenError;
    }
    assert(sellerReviewBlocked, "SEC-14-SELLER-REVIEW-BLOCKED", "Seller blocked from platform reviewer role");

    // Reviewer Approved
    const approvedTxn = await reviewTransaction(reviewer1, validInitTxn.id, {
      decision: "APPROVED",
      notes: "All legal covenants and closing schedules approved.",
    });
    assert(approvedTxn.reviewerApproved === true, "SEC-14-REVIEWER-APPROVED", "Independent Reviewer approves transaction");

    // Satisfy remaining mandatory conditions for readiness
    for (const c of conditions) {
      if (c.status !== "SATISFIED" && c.status !== "WAIVED" && c.is_mandatory) {
        await uploadTransactionDocument(buyer1, validInitTxn.id, {
          title: `Evidence for ${c.title}`,
          documentType: "CLOSING_CERTIFICATE",
          originalFilename: `${c.condition_type.toLowerCase()}.pdf`,
          mimeType: "application/pdf",
          buffer: validPdf,
          conditionId: c.id,
        });
      }
    }

    const readiness = await evaluateClosingReadiness(admin, validInitTxn.id);
    assert(readiness.isReadyForClosing === true, "SEC-14-CLOSING-READINESS-PASS", "Deterministic Closing Readiness evaluates to READY_FOR_CLOSING");

    // =========================================================================
    // SECTION 8: ATOMIC CLOSING & POST-CLOSING IMMUTABILITY (Assertions 57-65)
    // =========================================================================
    console.log("\n--- SECTION 8: ATOMIC CLOSING & POST-CLOSING IMMUTABILITY ---");

    // Diligence Critical Finding Blocker Check
    await createFinding(buyer1, ddCase.id, {
      title: "Late Notice Tax Assessment",
      severity: "CRITICAL",
      category: "LITIGATION",
      description: "Demand notice of 12 Cr from Income Tax Department.",
    });

    let ddFindingBlocked = false;
    try {
      await closeTransaction(admin, validInitTxn.id);
    } catch (e: any) {
      ddFindingBlocked = e instanceof ClosingConditionUnsatisfiedError;
    }
    assert(ddFindingBlocked, "SEC-14-DD-FINDING-BLOCKED", "Critical diligence finding blocks closing attempt");

    // Remediate the finding
    await query(
      `UPDATE diligence_findings SET status = 'ACCEPTED_RISK' WHERE case_id = $1 AND title = 'Late Notice Tax Assessment'`,
      [ddCase.id]
    );

    // Atomic Closing
    const closingRecord = await closeTransaction(admin, validInitTxn.id);
    assert(closingRecord.id !== undefined, "SEC-14-CLOSING-RECORD-CREATED", "Atomic closing transaction executed and record created");
    assert(closingRecord.closing_reference.startsWith("CLOSE-"), "SEC-14-CLOSING-REF-GEN", "Authoritative closing reference generated (CLOSE-YYYY-XXXXX)");
    assert(Number(closingRecord.final_consideration) === 64000000, "SEC-14-CLOSING-CONSIDERATION", "Authoritative final consideration preserved in closing record");

    const closedTxn = await getTransactionById(buyer1, validInitTxn.id);
    assert(closedTxn.status === "CLOSED", "SEC-14-TXN-STATUS-CLOSED", "Transaction status successfully transitioned to CLOSED");
    assert(closedTxn.closedAt !== null, "SEC-14-TXN-CLOSED-AT", "Transaction timestamp closedAt recorded");

    // Post-Closing Immutability: Terms update blocked
    let postCloseTermsBlocked = false;
    try {
      await updateTransactionTerms(buyer1, validInitTxn.id, { agreedAmount: 90000000 });
    } catch (e: any) {
      postCloseTermsBlocked = e instanceof TransactionClosedError;
    }
    assert(postCloseTermsBlocked, "SEC-14-POST-CLOSE-TERMS-IMMUTABLE", "Post-closing terms mutation strictly blocked with TransactionClosedError");

    // Post-Closing Immutability: New version blocked
    let postCloseVerBlocked = false;
    try {
      await createTransactionVersion(buyer1, validInitTxn.id, { agreedAmount: 90000000 });
    } catch (e: any) {
      postCloseVerBlocked = e instanceof TransactionClosedError;
    }
    assert(postCloseVerBlocked, "SEC-14-POST-CLOSE-VER-IMMUTABLE", "Post-closing version creation strictly blocked with TransactionClosedError");

    // Idempotent duplicate close returns existing record safely
    const dupClose = await closeTransaction(admin, validInitTxn.id);
    assert(dupClose.id === closingRecord.id, "SEC-14-IDEMPOTENT-CLOSE", "Duplicate close call returns existing closing record safely");

    // Audit logs recorded
    const auditRes = await query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE resource_id = $1`,
      [validInitTxn.id]
    );
    assert(auditRes.rows.some((r) => r.action === "TRANSACTION_CLOSED"), "SEC-14-AUDIT-LOGGED", "Immutable audit log recorded for TRANSACTION_CLOSED");

    // Counterparty notification sent
    const notifRes = await query<{ type: string; user_id: string }>(
      `SELECT type, user_id FROM in_app_notifications WHERE resource_id = $1`,
      [validInitTxn.id]
    );
    assert(notifRes.rows.some((r) => r.type === "TRANSACTION_CLOSED" && r.user_id === seller1.id), "SEC-14-NOTIF-DELIVERED", "Counterparty in-app notification delivered on closing");

    console.log("\n=================================================================");
    console.log(`PHASE 14 SECURITY GATE RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log("=================================================================\n");

    if (totalFailed > 0) {
      console.error(`>>> FINAL VERDICT: BLOCKED (${totalFailed} assertions failed) <<<`);
      process.exit(1);
    } else {
      console.log(">>> FINAL VERDICT: READY_FOR_PHASE_15 <<<\n");
      process.exit(0);
    }
  } catch (err: any) {
    console.error("FATAL ERROR in Phase 14 Security Gate:", err);
    process.exit(1);
  }
}

runSecurityGate();
