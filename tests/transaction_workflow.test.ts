// Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine Test Suite
// Path: tests/transaction_workflow.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import { submitEOI, acceptEOI } from "@/domains/eoi/service";
import { initiateNDA, acceptNDA } from "@/domains/dataroom/service";
import { createMOU, acceptMOU } from "@/domains/mou/service";
import {
  createPaymentIntent,
  processProviderWebhook,
  resetPaymentRateLimits,
} from "@/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
} from "@/domains/payments/provider";
import {
  createDiligenceCase,
  uploadEvidenceDocument,
  createFinding,
} from "@/domains/diligence/service";
import {
  createValuationCase,
  addValuationInput,
  submitValuationVersion,
  reviewValuationVersion,
  lockValuationVersion,
} from "@/domains/valuation/service";
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
} from "@/domains/transaction/service";
import { AuthenticatedUser } from "@/types/auth";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  TransactionGateError,
  InvalidTransactionStateError,
  TransactionClosedError,
  ClosingConditionUnsatisfiedError,
  TermsConflictError,
} from "@/lib/errors";

describe("Phase 14: Transaction / Deal Room & Closing Engine", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let reviewer1: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let mou1AcceptedId: string;
  let diligenceCase1Id: string;
  let valuationCase1Id: string;
  let approvedValuationVersionId: string;
  let testProvider: TestSimulatedPaymentProvider;

  const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

  // Valid 1KB PDF buffer starting with magic bytes '%PDF-1.4\n'
  const createValidPdfBuffer = (label = "Test Document") => {
    const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
    const body = Buffer.from(
      `1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
    );
    return Buffer.concat([header, body]);
  };

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_PAYMENT_PROVIDER = "true";
    resetPaymentRateLimits();
    await resetTestDb();

    testProvider = paymentProviderRegistry.getTestProvider();

    // 1. Seller 1 (Apex Engineering)
    const regSeller1 = await registerUser({
      email: "seller1.p14@apexeng.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p14@apexeng.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p14@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p14@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Buyer 1 (Alpha Strategic Investments)
    const regBuyer1 = await registerUser({
      email: "buyer1.p14@alphainvest.in",
      firstName: "Rahul",
      lastName: "Mehta",
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
        'Rahul Mehta', 'Managing Director', 'buyer1.p14@alphainvest.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Buyer 2 (Beta Capital - Unrelated Buyer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p14@betacapital.in",
      firstName: "Sanjay",
      lastName: "Patel",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer2 = regBuyer2.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Beta Growth Capital', 'COMPANY', 'Karnataka', 'Bengaluru',
        'Sanjay Patel', 'Partner', 'buyer2.p14@betacapital.in', '+919876541123', 'VERIFIED', 'Financial Services'
      )`,
      [buyer2.id]
    );

    // 5. Independent Reviewer (Lead Legal & Financial Reviewer)
    const regReviewer1 = await registerUser({
      email: "reviewer1.p14@scaleupindia.gov.in",
      firstName: "Pooja",
      lastName: "Iyer",
      password: "Password@123",
      roles: ["BUYER"],
    });
    reviewer1 = {
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

    // 6. Platform Administrator
    const regAdmin = await registerUser({
      email: "admin.p14@scaleupindia.gov.in",
      firstName: "Suresh",
      lastName: "Rao",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
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

    // 7. Create and Publish Opportunity 1 (Apex Engineering)
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

    // 8. EOI -> Accepted
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

    // 9. Bilateral NDA -> Executed
    const initNda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });

    // 10. MOU / Deal Intent -> Accepted
    const proposedMOU = await createMOU(buyer1, opp1PublishedId, {
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
    mou1AcceptedId = acceptedMOU.id;

    // 11. Escrow Earnest Payment Confirmed
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_p14_txn_setup_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    // 12. Due Diligence Case Created and Approved
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {
      scopeDescription: "Comprehensive financial, tax, and legal due diligence.",
    });
    diligenceCase1Id = ddCase.id;

    await query(
      `UPDATE due_diligence_cases SET status = 'APPROVED', verdict = 'APPROVED' WHERE id = $1`,
      [diligenceCase1Id]
    );

    // 13. Valuation Case Created, Version 1 submitted, reviewed, and locked
    const valCase = await createValuationCase(buyer1, diligenceCase1Id);
    valuationCase1Id = valCase.id;

    await addValuationInput(buyer1, valuationCase1Id, {
      metricName: "REVENUE",
      rawValue: 120000000,
      currency: "INR",
      unit: "INR",
    });

    await submitValuationVersion(buyer1, valuationCase1Id, {
      notes: "V1 ready for committee approval.",
    });

    await reviewValuationVersion(reviewer1, valuationCase1Id, {
      decision: "APPROVED",
      notes: "Valuation assumptions thoroughly verified.",
    });

    const lockedVer = await lockValuationVersion(reviewer1, valuationCase1Id);
    approvedValuationVersionId = lockedVer.id;
  });

  // =========================================================================
  // 1. PRECONDITION GATING (7-Gate Strict Enforcement)
  // =========================================================================
  describe("1. Precondition Gating (7-Gate Strict Enforcement)", () => {
    it("Gate 1: Rejects transaction if Opportunity is unpublished or non-existent (Uniform 404)", async () => {
      // Soft-delete opportunity
      await query(`UPDATE opportunities SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        opp1PublishedId,
      ]);

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(NotFoundError);
    });

    it("Gate 2: Rejects transaction if bilateral NDA is not executed", async () => {
      const valCaseRes = await query<{ nda_id: string }>(
        `SELECT nda_id FROM valuation_cases WHERE id = $1`,
        [valuationCase1Id]
      );
      await query(`UPDATE nda_agreements SET status = 'DRAFT' WHERE id = $1`, [
        valCaseRes.rows[0].nda_id,
      ]);

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(TransactionGateError);
    });

    it("Gate 3: Rejects transaction if Deal Intent MOU is not in ACCEPTED state", async () => {
      await query(`UPDATE deal_mous SET status = 'DRAFT' WHERE id = $1`, [mou1AcceptedId]);

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(TransactionGateError);
    });

    it("Gate 4: Rejects transaction if Escrow Token Deposit is not confirmed in ledger", async () => {
      await query(`UPDATE token_deposits SET status = 'TOKEN_PAYMENT_PENDING' WHERE mou_id = $1`, [
        mou1AcceptedId,
      ]);
      await query(`UPDATE payment_intents SET status = 'PENDING' WHERE mou_id = $1`, [
        mou1AcceptedId,
      ]);

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(TransactionGateError);
    });

    it("Gate 5: Rejects transaction if Due Diligence case is REJECTED or incomplete", async () => {
      await query(
        `UPDATE due_diligence_cases SET status = 'REJECTED', verdict = 'REJECTED' WHERE id = $1`,
        [diligenceCase1Id]
      );

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(TransactionGateError);
    });

    it("Gate 6: Rejects transaction if Valuation Version is not APPROVED or LOCKED", async () => {
      // Revert valuation version to DRAFT
      await query(
        `UPDATE valuation_versions SET status = 'DRAFT' WHERE id = $1`,
        [approvedValuationVersionId]
      );

      await expect(
        createTransaction(buyer1, valuationCase1Id)
      ).rejects.toThrow(TransactionGateError);
    });

    it("Gate 7: Rejects Seller from unilaterally creating buyer transaction workspace", async () => {
      await expect(
        createTransaction(seller1, valuationCase1Id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // =========================================================================
  // 2. IDEMPOTENT CREATION & ANTI-IDOR AUTHORIZATION
  // =========================================================================
  describe("2. Idempotent Creation & Anti-IDOR Authorization", () => {
    it("Creates transaction deal room, initializes Version 1 and default closing conditions", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id, {
        transactionType: "SHARE_ACQUISITION",
        paymentStructure: "FULL_ESCROW",
        governingLaw: "Indian Law",
      });

      expect(txn.id).toBeDefined();
      expect(txn.referenceCode).toMatch(/^TXN-\d{4}-\d+$/);
      expect(txn.status).toBe("INITIATED");
      expect(txn.currentVersionNumber).toBe(1);
      expect(txn.agreedAmount).toBe(55000000);
      expect(txn.currency).toBe("INR");

      // Verify conditions initialized
      const conditions = await listTransactionConditions(buyer1, txn.id);
      expect(conditions.length).toBe(10);
      expect(conditions.some((c) => c.condition_type === "NDA_EXECUTED" && c.status === "SATISFIED")).toBe(true);
      expect(conditions.some((c) => c.condition_type === "TOKEN_DEPOSIT_CONFIRMED" && c.status === "SATISFIED")).toBe(true);
      expect(conditions.some((c) => c.condition_type === "TRANSACTION_AGREEMENT_SIGNED" && c.status === "PENDING")).toBe(true);
    });

    it("Idempotent creation: calling create twice returns existing transaction without duplicate rows", async () => {
      const txn1 = await createTransaction(buyer1, valuationCase1Id);
      const txn2 = await createTransaction(buyer1, valuationCase1Id);

      expect(txn1.id).toBe(txn2.id);
      expect(txn1.referenceCode).toBe(txn2.referenceCode);

      const countRes = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM transactions WHERE valuation_case_id = $1`,
        [valuationCase1Id]
      );
      expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
    });

    it("Anti-IDOR: Unrelated Buyer 2 is strictly blocked from accessing Buyer 1 transaction", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      await expect(getTransactionById(buyer2, txn.id)).rejects.toThrow(ForbiddenError);
      await expect(listTransactionConditions(buyer2, txn.id)).rejects.toThrow(ForbiddenError);
      await expect(
        updateTransactionTerms(buyer2, txn.id, { agreedAmount: 160000000 })
      ).rejects.toThrow(ForbiddenError);

      const buyer2List = await listTransactions(buyer2);
      expect(buyer2List.items.length).toBe(0);
    });
  });

  // =========================================================================
  // 3. TERMS FINALIZATION & INVARIANT GUARDS
  // =========================================================================
  describe("3. Terms Finalization & Invariant Guards", () => {
    it("Updates transaction terms and updates both header and current draft version", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const updated = await updateTransactionTerms(buyer1, txn.id, {
        agreedAmount: 155000000,
        paymentStructure: "TRANCHE_BASED",
        specialConditions: "Seller indemnity for pre-closing tax liabilities for 3 years.",
      });

      expect(updated.agreedAmount).toBe(155000000);
      expect(updated.paymentStructure).toBe("TRANCHE_BASED");
      expect(updated.status).toBe("TERMS_FINALIZATION");

      const verRes = await query<{ agreed_amount: string; payment_structure: string }>(
        `SELECT agreed_amount, payment_structure FROM transaction_versions WHERE transaction_id = $1 AND version_number = 1`,
        [txn.id]
      );
      expect(Number(verRes.rows[0].agreed_amount)).toBe(155000000);
      expect(verRes.rows[0].payment_structure).toBe("TRANCHE_BASED");
    });

    it("Currency integrity: silent currency mutation attempt is blocked", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      await expect(
        updateTransactionTerms(buyer1, txn.id, { currency: "USD" })
      ).rejects.toThrow(TermsConflictError);
    });

    it("Creates new transaction version (V2): increments version and resets bilateral confirmations", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // Confirm terms first
      await confirmTransactionTerms(buyer1, txn.id);
      await confirmTransactionTerms(seller1, txn.id);

      // Now create Version 2
      const ver2Txn = await createTransactionVersion(buyer1, txn.id, {
        agreedAmount: 158000000,
        specialConditions: "Revised milestone tranches agreed in follow-up negotiation.",
      });

      expect(ver2Txn.currentVersionNumber).toBe(2);
      expect(ver2Txn.agreedAmount).toBe(158000000);
      expect(ver2Txn.buyerConfirmed).toBe(false);
      expect(ver2Txn.sellerConfirmed).toBe(false);

      const oldVerRes = await query<{ status: string }>(
        `SELECT status FROM transaction_versions WHERE transaction_id = $1 AND version_number = 1`,
        [txn.id]
      );
      expect(oldVerRes.rows[0].status).toBe("SUPERSEDED");
    });
  });

  // =========================================================================
  // 4. CLOSING CONDITIONS ENGINE
  // =========================================================================
  describe("4. Closing Conditions Engine", () => {
    it("Verifies condition against authoritative sources and rejects fake conditions", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const conditions = await listTransactionConditions(buyer1, txn.id);
      const spaCond = conditions.find((c) => c.condition_type === "TRANSACTION_AGREEMENT_SIGNED")!;

      // Attempting to verify without document evidence should fail
      await expect(
        verifyClosingCondition(buyer1, txn.id, spaCond.id)
      ).rejects.toThrow(ValidationError);

      // Upload valid SPA document
      const validPdf = createValidPdfBuffer("Definitive Share Purchase Agreement");
      await uploadTransactionDocument(buyer1, txn.id, {
        title: "Definitive Share Purchase Agreement (Signed Copy)",
        documentType: "FINAL_TRANSACTION_AGREEMENT",
        originalFilename: "spa_signed.pdf",
        mimeType: "application/pdf",
        buffer: validPdf,
        conditionId: spaCond.id,
      });

      // Now verification succeeds
      const verifiedCond = await verifyClosingCondition(buyer1, txn.id, spaCond.id);
      expect(verifiedCond.status).toBe("SATISFIED");
      expect(verifiedCond.verified_by).toBe(buyer1.id);
    });

    it("Reviewer or Admin can waive non-mandatory condition with required rationale", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const conditions = await listTransactionConditions(buyer1, txn.id);
      const regCond = conditions.find((c) => c.condition_type === "REGULATORY_NOC_FILED")!;

      // Buyer cannot waive condition
      await expect(
        waiveClosingCondition(buyer1, txn.id, regCond.id, {
          waiverReason: "Not required for domestic entity under threshold.",
        })
      ).rejects.toThrow(ForbiddenError);

      // Reviewer waives condition
      const waivedCond = await waiveClosingCondition(reviewer1, txn.id, regCond.id, {
        waiverReason: "Not required under CCI threshold exemptions.",
      });

      expect(waivedCond.status).toBe("WAIVED");
      expect(waivedCond.waiver_reason).toContain("exemptions");
      expect(waivedCond.waived_by).toBe(reviewer1.id);
    });
  });

  // =========================================================================
  // 5. SECURE DOCUMENT VAULT
  // =========================================================================
  describe("5. Secure Document Vault", () => {
    it("Uploads valid PDF with SHA-256 and rejects MIME-spoofed or oversized documents", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const validPdf = createValidPdfBuffer("Board Resolution");
      const doc = await uploadTransactionDocument(seller1, txn.id, {
        title: "Board Resolution Approving Share Transfer",
        documentType: "BOARD_RESOLUTION",
        originalFilename: "board_resolution.pdf",
        mimeType: "application/pdf",
        buffer: validPdf,
      });

      expect(doc.id).toBeDefined();
      expect(doc.sha256_hash).toBeDefined();
      expect(doc.sha256_hash.length).toBe(64);

      // Rejects spoofed MIME (fake PDF containing text)
      const spoofedBuffer = Buffer.from("NOT_A_PDF_CONTENT");
      await expect(
        uploadTransactionDocument(seller1, txn.id, {
          title: "Malicious Fake PDF",
          documentType: "BOARD_RESOLUTION",
          originalFilename: "fake.pdf",
          mimeType: "application/pdf",
          buffer: spoofedBuffer,
        })
      ).rejects.toThrow(ValidationError);

      // Rejects oversized file (>15MB)
      const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
      await expect(
        uploadTransactionDocument(seller1, txn.id, {
          title: "Oversized Document",
          documentType: "BOARD_RESOLUTION",
          originalFilename: "oversized.pdf",
          mimeType: "application/pdf",
          buffer: oversizedBuffer,
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  // =========================================================================
  // 6. BILATERAL CONFIRMATIONS & GOVERNANCE REVIEW
  // =========================================================================
  describe("6. Bilateral Confirmations & Governance Review", () => {
    it("Bilateral confirmations: buyer and seller confirm, role separation strictly enforced", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // Buyer confirms
      const buyerConf = await confirmTransactionTerms(buyer1, txn.id);
      expect(buyerConf.buyerConfirmed).toBe(true);
      expect(buyerConf.sellerConfirmed).toBe(false);

      // Seller confirms
      const sellerConf = await confirmTransactionTerms(seller1, txn.id);
      expect(sellerConf.buyerConfirmed).toBe(true);
      expect(sellerConf.sellerConfirmed).toBe(true);

      // Buyer cannot confirm for Seller
      await expect(
        confirmTransactionTerms(buyer2, txn.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("Anti-Self-Approval: Creator/Buyer CANNOT approve their own transaction deal room", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      await expect(
        reviewTransaction(buyer1, txn.id, {
          decision: "APPROVED",
          notes: "Self-approval attempt by buyer.",
        })
      ).rejects.toThrow(ForbiddenError);

      await expect(
        reviewTransaction(seller1, txn.id, {
          decision: "APPROVED",
          notes: "Seller approval attempt.",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("Independent Reviewer reviews and approves transaction", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const approved = await reviewTransaction(reviewer1, txn.id, {
        decision: "APPROVED",
        notes: "All legal covenants and closing schedules approved.",
      });

      expect(approved.reviewerApproved).toBe(true);
      expect(approved.status).toBe("READY_FOR_CLOSING");
    });
  });

  // =========================================================================
  // 7. CLOSING READINESS EVALUATION
  // =========================================================================
  describe("7. Closing Readiness Evaluation", () => {
    it("Identifies pending blockers when conditions or confirmations are missing", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const readiness = await evaluateClosingReadiness(buyer1, txn.id);
      expect(readiness.isReadyForClosing).toBe(false);
      expect(readiness.blockingReasons.length).toBeGreaterThan(0);
      expect(readiness.blockingReasons.some((r) => r.includes("Buyer formal confirmation"))).toBe(true);
    });

    it("Critical diligence finding blocks closing readiness until resolved or accepted", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // Add a critical unresolved finding to diligence case
      await createFinding(buyer1, diligenceCase1Id, {
        title: "Undisclosed Environmental Litigation",
        severity: "CRITICAL",
        category: "LITIGATION",
        description: "Potential 20 Cr liability from PCB pollution notice.",
      });

      const readiness = await evaluateClosingReadiness(buyer1, txn.id);
      expect(readiness.isReadyForClosing).toBe(false);
      expect(readiness.unresolvedDiligenceFindingsCount).toBeGreaterThan(0);
      expect(readiness.blockingReasons.some((r) => r.includes("CRITICAL"))).toBe(true);
    });
  });

  // =========================================================================
  // 8. ATOMIC CLOSING EXECUTION & POST-CLOSING IMMUTABILITY
  // =========================================================================
  describe("8. Atomic Closing Execution & Post-Closing Immutability", () => {
    it("Closes transaction atomically and creates immutable closing record", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // 1. Upload required documents
      const validPdf = createValidPdfBuffer("Execution Copy");
      const conditions = await listTransactionConditions(buyer1, txn.id);

      for (const cond of conditions) {
        if (cond.status !== "SATISFIED" && cond.is_mandatory) {
          await uploadTransactionDocument(buyer1, txn.id, {
            title: `Evidence for ${cond.title}`,
            documentType:
              cond.condition_type === "TRANSACTION_AGREEMENT_SIGNED"
                ? "FINAL_TRANSACTION_AGREEMENT"
                : cond.condition_type === "BOARD_RESOLUTIONS_UPLOADED"
                ? "BOARD_RESOLUTION"
                : "CLOSING_CERTIFICATE",
            originalFilename: `${cond.condition_type.toLowerCase()}.pdf`,
            mimeType: "application/pdf",
            buffer: validPdf,
            conditionId: cond.id,
          });
        }
      }

      // 2. Bilateral Confirmations
      await confirmTransactionTerms(buyer1, txn.id);
      await confirmTransactionTerms(seller1, txn.id);

      // 3. Reviewer Approval
      await reviewTransaction(reviewer1, txn.id, {
        decision: "APPROVED",
        notes: "Approved for formal closing.",
      });

      // 4. Readiness check
      const readiness = await evaluateClosingReadiness(admin, txn.id);
      expect(readiness.isReadyForClosing).toBe(true);

      // 5. Execute Atomic Closing
      const closingRecord = await closeTransaction(admin, txn.id);

      expect(closingRecord.id).toBeDefined();
      expect(closingRecord.closing_reference).toMatch(/^CLOSE-\d{4}-\d+$/);
      expect(closingRecord.transaction_id).toBe(txn.id);
      expect(Number(closingRecord.final_consideration)).toBe(55000000);
      expect(closingRecord.closed_by).toBe(admin.id);

      // Verify transaction status is CLOSED
      const closedTxn = await getTransactionById(buyer1, txn.id);
      expect(closedTxn.status).toBe("CLOSED");
      expect(closedTxn.closedAt).toBeDefined();

      // Fetch closing record
      const fetchedRecord = await getClosingRecord(buyer1, txn.id);
      expect(fetchedRecord.closing_reference).toBe(closingRecord.closing_reference);
    });

    it("Post-Closing Immutability: Mutating terms on a CLOSED transaction throws TransactionClosedError", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // Satisfy all and close
      const validPdf = createValidPdfBuffer("Execution Copy");
      const conditions = await listTransactionConditions(buyer1, txn.id);
      for (const cond of conditions) {
        if (cond.status !== "SATISFIED" && cond.is_mandatory) {
          await uploadTransactionDocument(buyer1, txn.id, {
            title: `Evidence for ${cond.title}`,
            documentType: "CLOSING_CERTIFICATE",
            originalFilename: `${cond.condition_type.toLowerCase()}.pdf`,
            mimeType: "application/pdf",
            buffer: validPdf,
            conditionId: cond.id,
          });
        }
      }
      await confirmTransactionTerms(buyer1, txn.id);
      await confirmTransactionTerms(seller1, txn.id);
      await reviewTransaction(reviewer1, txn.id, {
        decision: "APPROVED",
        notes: "Ready for closing.",
      });

      await closeTransaction(admin, txn.id);

      // Attempts to mutate terms or versions must throw TransactionClosedError
      await expect(
        updateTransactionTerms(buyer1, txn.id, { agreedAmount: 180000000 })
      ).rejects.toThrow(TransactionClosedError);

      await expect(
        createTransactionVersion(buyer1, txn.id, { agreedAmount: 180000000 })
      ).rejects.toThrow(TransactionClosedError);

      await expect(
        confirmTransactionTerms(buyer1, txn.id)
      ).rejects.toThrow(TransactionClosedError);
    });

    it("Concurrency & Idempotency: Duplicate close call returns existing record safely", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      const validPdf = createValidPdfBuffer("Execution Copy");
      const conditions = await listTransactionConditions(buyer1, txn.id);
      for (const cond of conditions) {
        if (cond.status !== "SATISFIED" && cond.is_mandatory) {
          await uploadTransactionDocument(buyer1, txn.id, {
            title: `Evidence for ${cond.title}`,
            documentType: "CLOSING_CERTIFICATE",
            originalFilename: `${cond.condition_type.toLowerCase()}.pdf`,
            mimeType: "application/pdf",
            buffer: validPdf,
            conditionId: cond.id,
          });
        }
      }
      await confirmTransactionTerms(buyer1, txn.id);
      await confirmTransactionTerms(seller1, txn.id);
      await reviewTransaction(reviewer1, txn.id, {
        decision: "APPROVED",
        notes: "Approved.",
      });

      const close1 = await closeTransaction(admin, txn.id);
      const close2 = await closeTransaction(admin, txn.id);

      expect(close1.id).toBe(close2.id);
      expect(close1.closing_reference).toBe(close2.closing_reference);
    });
  });

  // =========================================================================
  // 9. AUDIT LOGGING & IN-APP NOTIFICATIONS
  // =========================================================================
  describe("9. Audit Logging & In-App Notifications", () => {
    it("Generates immutable audit logs and counterparty notifications on key actions", async () => {
      const txn = await createTransaction(buyer1, valuationCase1Id);

      // Verify audit log for transaction creation
      const auditRes = await query<{ action: string }>(
        `SELECT action FROM audit_logs WHERE resource_id = $1`,
        [txn.id]
      );
      expect(auditRes.rows.some((r) => r.action === "TRANSACTION_CREATED")).toBe(true);

      // Verify notification sent to seller
      const notifRes = await query<{ type: string; user_id: string }>(
        `SELECT type, user_id FROM in_app_notifications WHERE resource_id = $1`,
        [txn.id]
      );
      expect(notifRes.rows.some((r) => r.type === "TRANSACTION_CREATED" && r.user_id === seller1.id)).toBe(true);
    });
  });
});
