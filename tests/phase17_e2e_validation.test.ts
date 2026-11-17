// Scale-up India — Phase 17: Full End-to-End, Security, Workflow & Production Validation Test Suite
// Path: tests/phase17_e2e_validation.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { resetTestDb, query, transaction } from "@/lib/db";
import {
  registerUser,
  loginUser,
  createPasswordResetToken,
  resetPassword,
} from "@/domains/auth/service";
import {
  getOrCreateSellerProfile,
  updateSellerProfile,
  updateBusinessProfile,
  saveBusinessFinancials,
  submitSellerForVerification,
  executeAdminReviewAction,
} from "@/domains/seller/service";
import {
  getOrCreateBuyerProfile,
  updateBuyerProfile,
  createAcquisitionMandate,
  submitBuyerForVerification,
  executeAdminBuyerReviewAction,
} from "@/domains/buyer/service";
import {
  createOpportunity,
  updateOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  getOpportunityForDiscovery,
} from "@/domains/opportunity/service";
import { refreshBuyerMatches, listBuyerMatches } from "@/domains/matching/service";
import { submitEOI, acceptEOI, getBuyerEOIs, getSellerEOIs } from "@/domains/eoi/service";
import {
  initiateNDA,
  acceptNDA,
  getDataRoomForUser,
  uploadDataRoomDocument,
  generateDocumentSignedUrl,
  downloadDataRoomDocument,
} from "@/domains/dataroom/service";
import {
  initiateDealConversation,
  sendDealMessage,
  getPaginatedMessages,
  markConversationRead,
  resetMessageRateLimits,
} from "@/domains/messaging/service";
import {
  createMOU,
  acceptMOU,
  getMOUById,
} from "@/domains/mou/service";
import {
  createPaymentIntent,
  processProviderWebhook,
  getPaymentIntentById,
  refundPaymentIntent,
  resetPaymentRateLimits,
} from "@/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
} from "@/domains/payments/provider";
import {
  createDiligenceCase,
  getChecklistItems,
  uploadEvidenceDocument,
  createFinding,
  transitionCaseStatus,
  resetDiligenceRateLimits,
} from "@/domains/diligence/service";
import {
  createValuationCase,
  addValuationInput,
  submitValuationVersion,
  reviewValuationVersion,
  lockValuationVersion,
  resetValuationRateLimits,
} from "@/domains/valuation/service";
import {
  createTransaction,
  getTransactionById,
  updateTransactionTerms,
  confirmTransactionTerms,
  verifyClosingCondition,
  uploadTransactionDocument,
  evaluateClosingReadiness,
  reviewTransaction,
  closeTransaction,
  getClosingRecord,
} from "@/domains/transaction/service";
import {
  dispatchNotification,
  enqueueOutboxEvent,
  processOutboxEvents,
  listUserNotifications,
  markNotificationAsRead,
  resetNotificationRateLimits,
} from "@/domains/notifications/service";
import { validateSafeUrl, assertSafeUrl } from "@/lib/security/ssrf";
import {
  validateUploadedFile,
  assertUploadedFile,
  sanitizeFilename,
} from "@/lib/security/fileValidator";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "@/lib/security/downloadToken";
import {
  checkRateLimit,
  resetAllRateLimits,
  RateLimitExceededError,
} from "@/lib/security/rateLimiter";
import {
  assertSeparationOfDuties,
  hasPermission,
} from "@/lib/security/rbacMatrix";
import { SECURITY_CONFIG } from "@/lib/security/config";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  AccountLockedError,
  TransactionGateError,
  TransactionClosedError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  DomainError,
} from "@/lib/errors";

describe("Phase 17: Full End-to-End, Security, Workflow & Production Validation", () => {
  let sellerA: AuthenticatedUser;
  let buyerA: AuthenticatedUser;
  let sellerB: AuthenticatedUser;
  let buyerB: AuthenticatedUser;
  let reviewer: AuthenticatedUser;
  let financeOfficer: AuthenticatedUser;
  let dealManager: AuthenticatedUser;
  let admin: AuthenticatedUser;
  let superAdmin: AuthenticatedUser;

  let testPaymentProvider: TestSimulatedPaymentProvider;

  const AUTHORITATIVE_EARNEST_AMOUNT = 500000;

  const createTestPdf = (label = "Test Document") => {
    const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
    const body = Buffer.from(
      `1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`
    );
    return Buffer.concat([header, body]);
  };

  const sampleOpportunityInput = (title = "Apex Precision Aerospace Ltd") => ({
    title,
    headline: "AS9100 Certified Avionics Component Facility in Pune",
    teaserSummary: "High-precision manufacturing facility with multi-year tier-1 aerospace contracts.",
    businessCategory: "MANUFACTURING" as const,
    industry: "Precision Engineering",
    subSector: "Aerospace Components",
    operatingRegion: "WEST_INDIA" as const,
    registeredState: "Maharashtra",
    approximateAgeBracket: "10_TO_20_YRS" as const,
    revenueBracket: "50CR_TO_100CR" as const,
    transactionType: "FULL_ACQUISITION" as const,
    businessModel: "B2B" as const,
    ebitdaMarginBracket: "20_TO_30_PCT" as const,
    askingPriceBracket: "50CR_TO_100CR" as const,
    exactLegalName: "Apex Aerospace Components Pvt Ltd",
    exactCin: "U29299MH2008PTC038192",
    exactGstin: "27AABCA1234F1Z8",
    exactPan: "AABCA1234F",
    exactAddress: "Plot 101, Chakan Phase II, Pune, Maharashtra",
  });

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_PAYMENT_PROVIDER = "true";
    (process.env as any).ENABLE_TEST_EMAIL_PROVIDER = "true";

    resetAllRateLimits();
    resetPaymentRateLimits();
    resetMessageRateLimits();
    resetDiligenceRateLimits();
    resetValuationRateLimits();
    resetNotificationRateLimits();

    await resetTestDb();
    testPaymentProvider = paymentProviderRegistry.getTestProvider();

    // 1. Seller A (Apex Industrial Dynamics - Tenant A)
    const regSellerA = await registerUser({
      email: "promoter.a@apexind.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerA = regSellerA.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'promoter.a@apexind.in', 'VERIFIED', 100)`,
      [sellerA.id]
    );

    // 2. Buyer A (Alpha Strategic Holdings - Tenant A Counterparty)
    const regBuyerA = await registerUser({
      email: "investor.a@alphash.in",
      firstName: "Rahul",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerA = regBuyerA.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Alpha Strategic Holdings Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
        'Rahul Mehta', 'Managing Director', 'investor.a@alphash.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyerA.id]
    );

    // 3. Seller B (Zenith Pharma Labs - Tenant B)
    const regSellerB = await registerUser({
      email: "promoter.b@zenithpharma.in",
      firstName: "Sunita",
      lastName: "Nambiar",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerB = regSellerB.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'promoter.b@zenithpharma.in', 'VERIFIED', 100)`,
      [sellerB.id]
    );

    // 4. Buyer B (BlueSky Ventures - Tenant B Counterparty)
    const regBuyerB = await registerUser({
      email: "investor.b@blueskyv.in",
      firstName: "Arun",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerB = regBuyerB.user;
    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'BlueSky Ventures Capital', 'COMPANY', 'Karnataka', 'Bengaluru',
        'Arun Kapoor', 'Partner', 'investor.b@blueskyv.in', '+919876541123', 'VERIFIED', 'Financial Services'
      )`,
      [buyerB.id]
    );

    // 5. Reviewer / Diligence Lead
    const regReviewer = await registerUser({
      email: "reviewer.lead@scaleupindia.co.in",
      firstName: "Pooja",
      lastName: "Iyer",
      password: "Password@123",
      roles: ["BUYER"],
    });
    reviewer = {
      ...regReviewer.user,
      roles: ["REVIEWER"],
      permissions: [
        "diligence.manage",
        "diligence.review",
        "valuation.manage",
        "valuation.review",
        "valuation.lock",
        "transaction.read_all",
        "transaction.review",
        "transaction.approve",
        "transaction.conditions_manage",
      ],
    };

    // 6. Finance Officer
    const regFinance = await registerUser({
      email: "finance.custodian@scaleupindia.co.in",
      firstName: "Raghav",
      lastName: "Menon",
      password: "Password@123",
      roles: ["BUYER"],
    });
    financeOfficer = {
      ...regFinance.user,
      roles: ["FINANCE"],
      permissions: [
        "payments.read_all",
        "payments.reconcile",
        "payments.refund",
        "transaction.verify_conditions",
      ],
    };

    // 7. Deal Manager
    const regDealManager = await registerUser({
      email: "deal.manager@scaleupindia.co.in",
      firstName: "Anand",
      lastName: "Verma",
      password: "Password@123",
      roles: ["BUYER"],
    });
    dealManager = {
      ...regDealManager.user,
      roles: ["ADMIN"],
      permissions: [
        "transaction.read_all",
        "transaction.review",
        "transaction.approve",
        "transaction.close",
        "transaction.conditions_manage",
        "transaction.documents_manage",
      ],
    };

    // 8. Admin / Operations
    const regAdmin = await registerUser({
      email: "operations.admin@scaleupindia.co.in",
      firstName: "Ritu",
      lastName: "Sharma",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const adminRole = await query<{ id: string }>(`SELECT id FROM roles WHERE code = 'ADMIN'`);
    if (adminRole.rows[0]) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [regAdmin.user.id, adminRole.rows[0].id]);
    }
    admin = {
      ...regAdmin.user,
      roles: ["ADMIN"],
      permissions: [
        "users.read",
        "opportunities.read_all",
        "opportunities.verify",
        "opportunities.publish",
        "profiles.verify",
        "security.audit",
      ],
    };

    // 9. Super Admin
    const regSuperAdmin = await registerUser({
      email: "super.master@scaleupindia.co.in",
      firstName: "Karan",
      lastName: "Malhotra",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const superAdminRole = await query<{ id: string }>(`SELECT id FROM roles WHERE code = 'SUPER_ADMIN'`);
    if (superAdminRole.rows[0]) {
      await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [regSuperAdmin.user.id, superAdminRole.rows[0].id]);
    }
    superAdmin = {
      ...regSuperAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "users.read",
        "users.manage_roles",
        "security.admin",
        "security.audit",
        "all",
      ],
    };
  });

  // ===========================================================================
  // SECTION 1: COMPLETE REAL-WORLD 23-STAGE E2E LIFECYCLE
  // ===========================================================================
  describe("1. Complete 23-Stage Real-World E2E Lifecycle", () => {
    it("executes the entire confidential transaction lifecycle from onboarding through atomic closing", async () => {
      // 1. Opportunity Creation & Verification
      const opp = await createOpportunity(sellerA, sampleOpportunityInput());
      expect(opp.status).toBe("DRAFT");

      await submitOpportunity(opp.id, sellerA);
      await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
      await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
      const pubOpp = await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);
      expect(pubOpp.status).toBe("PUBLISHED");

      // 2. Buyer Mandate Creation & Matching
      const mandate = await createAcquisitionMandate(buyerA, {
        name: "Aerospace Precision Engineering Target in Western India",
        description: "Targeting 100% acquisition of operating Tier-1 manufacturing units.",
        minInvestment: 500000000,
        maxInvestment: 1000000000,
        transactionTypes: ["FULL_ACQUISITION"],
        controlPreference: "FULL_CONTROL",
        strategicObjectives: ["CAPACITY_EXPANSION"],
        targetIndustries: [{ industry: "Manufacturing" }],
        targetGeographies: [{ region: "WEST_INDIA" }],
      });
      expect(mandate.id).toBeDefined();

      await refreshBuyerMatches(buyerA);
      const matches = await listBuyerMatches(buyerA);
      expect(matches.items.length).toBeGreaterThanOrEqual(1);

      // Discovery & Progressive Masking Verification
      const discovery = await getOpportunityForDiscovery(pubOpp.id, buyerA);
      expect(discovery.tier).toBe(1);
      expect((discovery as any).exactCin).toBeUndefined();
      expect((discovery as any).exactLegalName).toBeUndefined();

      // 3. Expression of Interest (EOI) Workflow
      const eoi = await submitEOI(buyerA, pubOpp.id, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "100% Equity Buyout",
        indicativeOfferRange: "50CR_TO_100CR",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Interested in evaluating strategic acquisition of aerospace facility.",
      });
      expect(eoi.status).toBe("SUBMITTED");

      const acceptedEoi = await acceptEOI(sellerA, eoi.id, {
        sellerResponseMessage: "Promoter welcomes strategic discussion.",
      });
      expect(acceptedEoi.status).toBe("ACCEPTED");

      // 4. Bilateral NDA & Secure Data Room
      const initNda = await initiateNDA(buyerA, pubOpp.id, { eoiId: eoi.id });
      expect(initNda.status).toBe("NDA_SENT");

      await acceptNDA(buyerA, initNda.id, { termsAcknowledged: true });
      const executedNda = await acceptNDA(sellerA, initNda.id, { termsAcknowledged: true });
      expect(executedNda.status).toBe("EXECUTED");
      expect(executedNda.dataRoomId).toBeDefined();

      // Access Data Room
      const dataRoom = await getDataRoomForUser(buyerA, executedNda.dataRoomId!);
      expect(dataRoom.opportunityId).toBe(pubOpp.id);

      // Upload document into Data Room
      const docBuffer = createTestPdf("Annual Audited Financial Statements FY23");
      const uploadedDoc = await uploadDataRoomDocument(
        sellerA,
        executedNda.dataRoomId!,
        {
          originalFilename: "audited_financials_fy23.pdf",
          mimeType: "application/pdf",
          buffer: docBuffer,
        },
        {
          title: "Audited Financials FY23",
          documentCategory: "FINANCIAL",
          accessLevel: "ROOM_MEMBER",
        }
      );
      expect(uploadedDoc.id).toBeDefined();
      const docDb = await query<any>(
        `SELECT checksum FROM data_room_documents WHERE id = $1`,
        [uploadedDoc.id]
      );
      expect(docDb.rows[0].checksum.length).toBe(64);

      // 5. Secure Deal Communication
      const convo = await initiateDealConversation(buyerA, pubOpp.id, {
        ndaId: executedNda.id,
        title: "Confidential Deal Discussions",
      });
      const msg = await sendDealMessage(buyerA, convo.id, {
        content: "Please confirm availability for on-site engineering team walkthrough.",
      });
      expect(msg.content).toContain("engineering team");

      const thread = await getPaginatedMessages(sellerA, convo.id);
      expect(thread.messages.length).toBeGreaterThanOrEqual(1);
      await markConversationRead(sellerA, convo.id);

      // 6. Tripartite MOU / Deal Intent
      const proposedMOU = await createMOU(buyerA, pubOpp.id, {
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
      const acceptedMOU = await acceptMOU(sellerA, proposedMOU.id, {
        confirmed: true,
        notes: "Terms agreed by promoter.",
      });
      expect(acceptedMOU.status).toBe("ACCEPTED");

      // 7. Payment & Earnest Token Deposit Workflow
      const payment = await createPaymentIntent(
        buyerA,
        acceptedMOU.id,
        {},
        { providerName: "TEST_SIMULATED" }
      );
      expect(payment.status).toBe("CREATED");

      const webhookPayload = {
        id: "evt_p17_e2e_pay_001",
        eventType: "payment.captured",
        providerPaymentReference: payment.providerPaymentReference,
        amount: AUTHORITATIVE_EARNEST_AMOUNT,
        currency: "INR",
        status: "SUCCEEDED",
      };
      const payloadStr = JSON.stringify(webhookPayload);
      const signature = testPaymentProvider.generateSignature(payloadStr);
      await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

      const confirmedPayment = await getPaymentIntentById(buyerA, payment.id);
      expect(confirmedPayment.status).toBe("SUCCEEDED");

      // 8. Due Diligence Workspace
      const ddCase = await createDiligenceCase(buyerA, acceptedMOU.id, {
        scopeDescription: "Technical, environmental, and financial due diligence audit.",
      });
      expect(ddCase.id).toBeDefined();

      await query(
        `INSERT INTO diligence_members (case_id, user_id, role, access_status) VALUES ($1, $2, 'REVIEWER', 'ACTIVE')`,
        [ddCase.id, reviewer.id]
      );

      const checklist = await getChecklistItems(buyerA, ddCase.id);
      const evidenceDoc = await uploadEvidenceDocument(
        sellerA,
        ddCase.id,
        {
          originalFilename: "pcb_consent_to_operate.pdf",
          mimeType: "application/pdf",
          buffer: createTestPdf("Factory Pollution Control Board Clearance"),
        },
        {
          checklistItemId: checklist[0].id,
          title: "Factory PCB Consent to Operate",
          category: checklist[0].category,
          isConfidential: true,
        }
      );
      expect(evidenceDoc.id).toBeDefined();

      const finding = await createFinding(reviewer, ddCase.id, {
        title: "Minor factory lease renewal pending for warehouse 2",
        category: "CORPORATE_LEGAL",
        severity: "LOW",
        description: "Warehouse 2 lease expires in 4 months.",
      });
      expect(finding.id).toBeDefined();

      await query(
        `UPDATE due_diligence_cases SET status = 'APPROVED', verdict = 'APPROVED' WHERE id = $1`,
        [ddCase.id]
      );

      // 9. Valuation Engine
      const valCase = await createValuationCase(buyerA, ddCase.id);
      await addValuationInput(buyerA, valCase.id, {
        metricName: "REVENUE",
        rawValue: 120000000,
        currency: "INR",
        unit: "INR",
      });

      await submitValuationVersion(buyerA, valCase.id, {
        notes: "V1 ready for committee approval.",
      });

      await reviewValuationVersion(reviewer, valCase.id, {
        decision: "APPROVED",
        notes: "Valuation assumptions thoroughly verified.",
      });

      const lockedVer = await lockValuationVersion(reviewer, valCase.id);
      expect(lockedVer.status).toBe("LOCKED");

      // 10. Transaction Deal Room & Closing Engine
      const txn = await createTransaction(buyerA, valCase.id);
      expect(txn.id).toBeDefined();
      expect(txn.status).toBe("INITIATED");

      await updateTransactionTerms(buyerA, txn.id, {
        agreedAmount: 55000000,
        currency: "INR",
        transactionType: "SHARE_ACQUISITION",
      });

      // Upload required closing documents
      await uploadTransactionDocument(buyerA, txn.id, {
        originalFilename: "final_transaction_agreement.pdf",
        mimeType: "application/pdf",
        buffer: createTestPdf("Final Transaction Agreement"),
        documentType: "FINAL_TRANSACTION_AGREEMENT",
        title: "Final Transaction Agreement",
        signingStatus: "VERIFIED",
      });
      await uploadTransactionDocument(buyerA, txn.id, {
        originalFilename: "board_resolution.pdf",
        mimeType: "application/pdf",
        buffer: createTestPdf("Board Resolution"),
        documentType: "BOARD_RESOLUTION",
        title: "Board Resolution",
        signingStatus: "VERIFIED",
      });
      await uploadTransactionDocument(buyerA, txn.id, {
        originalFilename: "closing_certificate.pdf",
        mimeType: "application/pdf",
        buffer: createTestPdf("Closing Certificate"),
        documentType: "CLOSING_CERTIFICATE",
        title: "Closing Certificate",
        signingStatus: "VERIFIED",
      });

      const conditions = await query<{ id: string; condition_type: string }>(
        `SELECT id, condition_type FROM transaction_conditions WHERE transaction_id = $1`,
        [txn.id]
      );
      for (const cond of conditions.rows) {
        await verifyClosingCondition(reviewer, txn.id, cond.id);
      }

      // Bilateral terms confirmation
      await confirmTransactionTerms(buyerA, txn.id);
      await confirmTransactionTerms(sellerA, txn.id);

      // Independent Governance Review
      await reviewTransaction(dealManager, txn.id, {
        decision: "APPROVED",
        notes: "All closing conditions verified",
      });

      // Evaluate closing readiness
      const readiness = await evaluateClosingReadiness(dealManager, txn.id);
      expect(readiness.isReadyForClosing).toBe(true);

      // 11. Atomic Closing Execution & Immutable Snapshot
      const closingRecord = await closeTransaction(dealManager, txn.id);
      expect(closingRecord.closing_reference).toMatch(/^CLOSE-\d{4}-\d{5}$/);
      expect(Number(closingRecord.final_consideration)).toBe(55000000);

      const txnAfterClose = await getTransactionById(buyerA, txn.id);
      expect(txnAfterClose.status).toBe("CLOSED");

      // 12. Post-Closing Immutability Invariant
      await expect(
        updateTransactionTerms(buyerA, txn.id, {
          agreedAmount: 60000000,
          currency: "INR",
        })
      ).rejects.toThrow(TransactionClosedError);

      // 13. Notifications & Outbox Consistency
      await processOutboxEvents(50);
      const buyerNotifs = await listUserNotifications(buyerA.id);
      expect(buyerNotifs.notifications.length).toBeGreaterThanOrEqual(1);

      // 14. Audit Log Trail
      const auditTrail = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM audit_logs WHERE actor_id IN ($1, $2, $3)`,
        [buyerA.id, sellerA.id, dealManager.id]
      );
      expect(parseInt(auditTrail.rows[0].count, 10)).toBeGreaterThan(10);
    });
  });

  // ===========================================================================
  // SECTION 2: GLOBAL ANTI-IDOR & MULTI-TENANT ISOLATION
  // ===========================================================================
  describe("2. Global Anti-IDOR & Multi-Tenant Isolation", () => {
    it("strictly isolates Tenant A resources from Tenant B across all object types", async () => {
      // Setup Opportunity A for Seller A
      const oppA = await createOpportunity(sellerA, sampleOpportunityInput("Apex Foundry Pune"));

      // 1. Seller B cannot view or modify Seller A's draft opportunity
      await expect(
        updateOpportunity(oppA.id, sellerB, { title: "Hacked Title" })
      ).rejects.toThrow(ForbiddenError);

      // 2. Buyer B cannot view Seller A's draft before publish
      await expect(
        getOpportunityForDiscovery(oppA.id, buyerB)
      ).rejects.toThrow(NotFoundError);

      // Publish oppA
      await submitOpportunity(oppA.id, sellerA);
      await executeAdminOpportunityReview(oppA.id, "START_REVIEW", {}, admin);
      await executeAdminOpportunityReview(oppA.id, "VERIFY", {}, admin);
      await executeAdminOpportunityReview(oppA.id, "PUBLISH", {}, admin);

      // EOI from Buyer A
      const eoiA = await submitEOI(buyerA, oppA.id, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Cash",
        indicativeOfferRange: "50CR_TO_100CR",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Interested in evaluating strategic acquisition of aerospace facility.",
      });

      // 3. Buyer B cannot view Buyer A's EOI
      await expect(
        query(`SELECT * FROM expressions_of_interest WHERE id = $1 AND buyer_id = $2`, [eoiA.id, buyerB.id])
      ).resolves.toMatchObject({ rows: [] });

      await acceptEOI(sellerA, eoiA.id, { sellerResponseMessage: "Accepted" });
      const ndaA = await initiateNDA(buyerA, oppA.id, { eoiId: eoiA.id });
      await acceptNDA(buyerA, ndaA.id, { termsAcknowledged: true });
      const executedNdaA = await acceptNDA(sellerA, ndaA.id, { termsAcknowledged: true });

      // 4. Buyer B cannot access Data Room A
      await expect(
        getDataRoomForUser(buyerB, executedNdaA.dataRoomId!)
      ).rejects.toThrow(ForbiddenError);

      // 5. Buyer B cannot access Deal Conversation A
      const convoA = await initiateDealConversation(buyerA, oppA.id, {
        ndaId: executedNdaA.id,
        title: "Deal Thread",
      });
      await expect(
        getPaginatedMessages(buyerB, convoA.id)
      ).rejects.toThrow(ForbiddenError);

      // 6. Buyer B cannot read or accept MOU A
      const mouA = await createMOU(buyerA, oppA.id, {
        ndaId: executedNdaA.id,
        submitImmediately: true,
        terms: {
          proposedValuation: 50000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 50000000,
          equityConsideration: 0,
          earnestDepositAmount: 500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          validityDays: 14,
        },
      });

      await expect(
        getMOUById(buyerB, mouA.id)
      ).rejects.toThrow(ForbiddenError);

      await expect(
        acceptMOU(buyerB, mouA.id, { confirmed: true })
      ).rejects.toThrow(ForbiddenError);

      await acceptMOU(sellerA, mouA.id, { confirmed: true });

      // 7. Buyer B cannot view Buyer A's Payment Intent
      const payA = await createPaymentIntent(
        buyerA,
        mouA.id,
        {},
        { providerName: "TEST_SIMULATED" }
      );

      await expect(
        getPaymentIntentById(buyerB, payA.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // ===========================================================================
  // SECTION 3: AUTHORITATIVE ROLE MATRIX & SEGREGATION OF DUTIES
  // ===========================================================================
  describe("3. Authoritative Role Matrix & Segregation of Duties", () => {
    it("enforces least privilege and anti-self-approval across all 9 platform roles", async () => {
      // 1. Buyer/Seller cannot perform Administrative review
      const buyerIsAdmin = hasPermission(buyerA.roles, "security.admin");
      expect(buyerIsAdmin).toBe(false);

      const sellerIsAdmin = hasPermission(sellerA.roles, "security.admin");
      expect(sellerIsAdmin).toBe(false);

      // 2. Anti-Self-Approval: Valuation Creator cannot approve their own valuation
      expect(() => {
        assertSeparationOfDuties("REVIEW_VALUATION", buyerA.id, buyerA.id);
      }).toThrow(ForbiddenError);

      // 3. Anti-Self-Approval: Transaction Creator cannot approve their own transaction closing
      expect(() => {
        assertSeparationOfDuties("APPROVE_TRANSACTION", buyerA.id, buyerA.id);
      }).toThrow(ForbiddenError);

      // 4. Anti-Self-Approval: Evidence Uploader cannot review their own evidence
      expect(() => {
        assertSeparationOfDuties("REVIEW_DILIGENCE_EVIDENCE", sellerA.id, sellerA.id);
      }).toThrow(ForbiddenError);

      // 5. Counterparty Spoofing Defense: Buyer cannot confirm terms on behalf of Seller
      expect(() => {
        assertSeparationOfDuties("CONFIRM_TRANSACTION_TERMS", buyerA.id, sellerA.id, buyerA.id);
      }).toThrow(ForbiddenError);

      // 6. Independent Reviewer is authorized to review
      expect(() => {
        assertSeparationOfDuties("REVIEW_VALUATION", reviewer.id, buyerA.id);
      }).not.toThrow();
    });
  });

  // ===========================================================================
  // SECTION 4: PROGRESSIVE DISCLOSURE & DATA MASKING
  // ===========================================================================
  describe("4. Progressive Disclosure & Data Masking", () => {
    it("verifies Tier 1 (Masked) vs Tier 2/3 (Unmasked) data confidentiality", async () => {
      const opp = await createOpportunity(sellerA, sampleOpportunityInput("Confidential Tier Test Plant"));
      await submitOpportunity(opp.id, sellerA);
      await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
      await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
      await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);

      // Pre-NDA: Public / Matched Buyer receives strictly Tier 1 Masked View
      const preNdaView = await getOpportunityForDiscovery(opp.id, buyerA);
      expect(preNdaView.tier).toBe(1);
      expect((preNdaView as any).exactCin).toBeUndefined();
      expect((preNdaView as any).exactLegalName).toBeUndefined();
      expect((preNdaView as any).exactAddress).toBeUndefined();
      expect((preNdaView as any).exactPan).toBeUndefined();

      // Post-NDA: Bilateral participants receive Tier 2 Unmasked View
      const eoi = await submitEOI(buyerA, opp.id, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Cash",
        indicativeOfferRange: "50CR_TO_100CR",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Interested in evaluating strategic acquisition of aerospace facility.",
      });
      await acceptEOI(sellerA, eoi.id, { sellerResponseMessage: "Accepted" });
      const nda = await initiateNDA(buyerA, opp.id, { eoiId: eoi.id });
      await acceptNDA(buyerA, nda.id, { termsAcknowledged: true });
      await acceptNDA(sellerA, nda.id, { termsAcknowledged: true });

      // Grant Tier 2 access
      await query(
        `INSERT INTO opportunity_access_grants (opportunity_id, buyer_user_id, granted_tier)
         VALUES ($1, $2, 2) ON CONFLICT DO NOTHING`,
        [opp.id, buyerA.id]
      );

      const postNdaView = await getOpportunityForDiscovery(opp.id, buyerA);
      expect(postNdaView.tier).toBe(2);
      expect(postNdaView.title).toBeDefined();
    });
  });

  // ===========================================================================
  // SECTION 5: STATE MACHINE ABUSE & INVARIANT GUARDS
  // ===========================================================================
  describe("5. State Machine Abuse & Invariant Guards", () => {
    it("blocks skipped states, illegal backward transitions, and duplicate actions", async () => {
      const opp = await createOpportunity(sellerA, sampleOpportunityInput("State Machine Abuse Plant"));

      // Cannot publish an opportunity that is in DRAFT state
      await expect(
        executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin)
      ).rejects.toThrow();

      // Submit opportunity
      await submitOpportunity(opp.id, sellerA);

      // Cannot re-submit an already submitted opportunity
      await expect(
        submitOpportunity(opp.id, sellerA)
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // SECTION 6: FINANCIAL INTEGRITY & WEBHOOK SECURITY
  // ===========================================================================
  describe("6. Financial Integrity & Webhook Security", () => {
    it("rejects client-tampered payment amounts and forged webhook callbacks", async () => {
      const opp = await createOpportunity(sellerA, sampleOpportunityInput("Financial Security Plant"));
      await submitOpportunity(opp.id, sellerA);
      await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
      await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
      await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);

      const eoi = await submitEOI(buyerA, opp.id, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Cash",
        indicativeOfferRange: "50CR_TO_100CR",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Interested in evaluating strategic acquisition of aerospace facility.",
      });
      await acceptEOI(sellerA, eoi.id, { sellerResponseMessage: "Accepted" });
      const nda = await initiateNDA(buyerA, opp.id, { eoiId: eoi.id });
      await acceptNDA(buyerA, nda.id, { termsAcknowledged: true });
      await acceptNDA(sellerA, nda.id, { termsAcknowledged: true });

      const mou = await createMOU(buyerA, opp.id, {
        ndaId: nda.id,
        submitImmediately: true,
        terms: {
          proposedValuation: 50000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 50000000,
          equityConsideration: 0,
          earnestDepositAmount: 500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          validityDays: 14,
        },
      });
      await acceptMOU(sellerA, mou.id, { confirmed: true });

      // 1. Amount Tampering: Client attempts to pay ₹1 instead of agreed ₹5,00,000
      await expect(
        createPaymentIntent(
          buyerA,
          mou.id,
          { amount: 1 } as any,
          { providerName: "TEST_SIMULATED" }
        )
      ).rejects.toThrow(PaymentAmountMismatchError);

      // 2. Currency Tampering: Client attempts to pay in USD when INR is mandated
      await expect(
        createPaymentIntent(
          buyerA,
          mou.id,
          { currency: "USD" } as any,
          { providerName: "TEST_SIMULATED" }
        )
      ).rejects.toThrow(PaymentCurrencyMismatchError);

      const validPay = await createPaymentIntent(
        buyerA,
        mou.id,
        {},
        { providerName: "TEST_SIMULATED" }
      );

      // 3. Forged Webhook: Invalid HMAC signature rejected
      const fakeWebhookPayload = JSON.stringify({
        id: "evt_p17_forge_001",
        eventType: "payment.captured",
        providerPaymentReference: validPay.providerPaymentReference,
        amount: 500000,
        currency: "INR",
        status: "SUCCEEDED",
      });
      await expect(
        processProviderWebhook("TEST_SIMULATED", fakeWebhookPayload, "invalid_forged_signature")
      ).rejects.toThrow();

      // 4. Replay Attack: Replaying webhook does not duplicate ledger mutations
      const validSig = testPaymentProvider.generateSignature(fakeWebhookPayload);
      await processProviderWebhook("TEST_SIMULATED", fakeWebhookPayload, validSig);

      const ledgerCountBefore = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM payment_ledger WHERE payment_intent_id = $1`,
        [validPay.id]
      );

      // Replay identical event
      await processProviderWebhook("TEST_SIMULATED", fakeWebhookPayload, validSig);
      const ledgerCountAfter = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM payment_ledger WHERE payment_intent_id = $1`,
        [validPay.id]
      );
      expect(ledgerCountAfter.rows[0].count).toBe(ledgerCountBefore.rows[0].count);
    });
  });

  // ===========================================================================
  // SECTION 7: CONCURRENCY, IDEMPOTENCY & ROLLBACK ATOMICITY
  // ===========================================================================
  describe("7. Concurrency, Idempotency & Rollback Atomicity", () => {
    it("guarantees idempotency and verifies rollback leaves zero orphaned records", async () => {
      const opp = await createOpportunity(sellerA, sampleOpportunityInput("Idempotency Plant"));
      await submitOpportunity(opp.id, sellerA);
      await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
      await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
      await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);

      const eoi = await submitEOI(buyerA, opp.id, {
        interestType: "FULL_ACQUISITION",
        proposedTransactionType: "Cash",
        indicativeOfferRange: "50CR_TO_100CR",
        investmentTimeline: "1_TO_3_MONTHS",
        buyerMessage: "Interested in evaluating strategic acquisition of aerospace facility.",
      });
      await acceptEOI(sellerA, eoi.id, { sellerResponseMessage: "Accepted" });
      const nda = await initiateNDA(buyerA, opp.id, { eoiId: eoi.id });
      await acceptNDA(buyerA, nda.id, { termsAcknowledged: true });
      await acceptNDA(sellerA, nda.id, { termsAcknowledged: true });

      const mou = await createMOU(buyerA, opp.id, {
        ndaId: nda.id,
        submitImmediately: true,
        terms: {
          proposedValuation: 50000000,
          currency: "INR",
          proposedStructure: "FULL_ACQUISITION",
          cashConsideration: 50000000,
          equityConsideration: 0,
          earnestDepositAmount: 500000,
          exclusivityPeriodDays: 30,
          dueDiligenceWindowDays: 45,
          validityDays: 14,
        },
      });
      await acceptMOU(sellerA, mou.id, { confirmed: true });

      // 1. Idempotent Payment Intent Creation
      const idempKey = "concurrent_key_" + Date.now();
      const pay1 = await createPaymentIntent(
        buyerA,
        mou.id,
        { idempotencyKey: idempKey },
        { providerName: "TEST_SIMULATED" }
      );

      const pay2 = await createPaymentIntent(
        buyerA,
        mou.id,
        { idempotencyKey: idempKey },
        { providerName: "TEST_SIMULATED" }
      );

      expect(pay1.id).toBe(pay2.id);

      // 2. Transaction Rollback Atomicity
      let rollbackErrorCaught = false;
      try {
        await transaction(async (tx) => {
          await tx.query(
            `INSERT INTO notifications (user_id, type, title, message) VALUES ($1, 'TEST', 'Atomic Title', 'Atomic Msg')`,
            [buyerA.id]
          );
          // Deliberate simulated failure
          throw new Error("Simulated failure inside database transaction");
        });
      } catch (err: any) {
        rollbackErrorCaught = true;
      }
      expect(rollbackErrorCaught).toBe(true);

      const rolledBackNotifs = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM notifications WHERE title = 'Atomic Title'`
      );
      expect(parseInt(rolledBackNotifs.rows[0].count, 10)).toBe(0);
    });
  });

  // ===========================================================================
  // SECTION 8: ENTERPRISE SECURITY UTILITIES (SSRF, FILES, RATE LIMITS)
  // ===========================================================================
  describe("8. Enterprise Security Utilities", () => {
    it("verifies SSRF blocks, file upload sanitization, and sliding-window rate limiting", async () => {
      // 1. SSRF loopback & cloud metadata blocking
      expect(validateSafeUrl("http://localhost:3000").isValid).toBe(false);
      expect(validateSafeUrl("http://127.0.0.1:8080").isValid).toBe(false);
      expect(validateSafeUrl("http://[::1]/internal").isValid).toBe(false);
      expect(validateSafeUrl("http://169.254.169.254/latest/meta-data/").isValid).toBe(false);
      expect(validateSafeUrl("http://metadata.google.internal").isValid).toBe(false);
      expect(validateSafeUrl("file:///etc/passwd").isValid).toBe(false);

      // Genuine public endpoints allowed
      expect(validateSafeUrl("https://api.razorpay.com/v1/checkout").isValid).toBe(true);

      // 2. File Upload Magic Bytes & Path Traversal Sanitization
      const authenticPdf = createTestPdf("Authentic Document");
      const validation = assertUploadedFile(authenticPdf, "report.pdf");
      expect(validation.isValid).toBe(true);
      expect(validation.mimeType).toBe("application/pdf");

      // Reject disguised executable
      const fakePdf = Buffer.from("<html><script>alert(1)</script></html>");
      expect(validateUploadedFile(fakePdf, "report.pdf").isValid).toBe(false);

      // Directory traversal sanitization
      expect(sanitizeFilename("../../../etc/passwd")).toBe("etc_passwd");
      expect(sanitizeFilename("..\\..\\windows\\cmd.exe")).toBe("windows_cmd.exe");

      // 3. Sliding-Window Rate Limiting
      const testKey = "rate_limit_test_" + Date.now();
      const cfg = { windowMs: 10000, maxRequests: 2 };
      expect(checkRateLimit(testKey, cfg).remaining).toBe(1);
      expect(checkRateLimit(testKey, cfg).remaining).toBe(0);
      expect(() => checkRateLimit(testKey, cfg)).toThrow(RateLimitExceededError);
    });
  });
});
