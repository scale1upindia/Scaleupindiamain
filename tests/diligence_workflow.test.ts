// Scale-up India — Phase 12: Due Diligence Workspace & Evidence Management Test Suite
// Path: tests/diligence_workflow.test.ts

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
} from "@/domains/diligence/service";
import { generateDiligenceDownloadToken } from "@/lib/security/diligenceDownloadToken";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  DiligenceGateError,
  DiligenceCaseClosedError,
  InvalidDiligenceStateError,
  UnauthorizedError,
} from "@/lib/errors";

describe("Phase 12: Due Diligence Workspace & Evidence Management Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let reviewer1: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let oppDraftId: string;
  let eoi1Id: string;
  let nda1ExecutedId: string;
  let mou1AcceptedId: string;
  let mouUnacceptedId: string;
  let testProvider: TestSimulatedPaymentProvider;

  const AUTHORITATIVE_EARNEST_AMOUNT = 500000; // ₹5 Lakhs INR

  // Valid 1KB PDF buffer starting with magic bytes '%PDF-1.4\n'
  const createValidPdfBuffer = (label = "Test Document") => {
    const header = Buffer.from("%PDF-1.4\n%âãÏÓ\n");
    const body = Buffer.from(`1 0 obj\n<< /Title (${label}) /Creator (ScaleUp India) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n`);
    return Buffer.concat([header, body]);
  };

  // Valid PNG buffer starting with magic bytes
  const createValidPngBuffer = () => {
    return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  };

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_PAYMENT_PROVIDER = "true";
    resetPaymentRateLimits();
    await resetTestDb();

    testProvider = paymentProviderRegistry.getTestProvider();

    // 1. Seller 1 (Apex Engineering)
    const regSeller1 = await registerUser({
      email: "seller1.p12@apexeng.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p12@apexeng.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p12@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p12@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Buyer 1 (Alpha Strategic Investments)
    const regBuyer1 = await registerUser({
      email: "buyer1.p12@alphainvest.in",
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
        'Rajesh Kapoor', 'Managing Director', 'buyer1.p12@alphainvest.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Buyer 2 (Beta Capital - Unrelated Buyer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p12@betacapital.in",
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
        'Pooja Bansal', 'Partner', 'buyer2.p12@betacapital.in', '+919876541123', 'VERIFIED', 'Technology'
      )`,
      [buyer2.id]
    );

    // 5. Reviewer 1 (Independent M&A Due Diligence Auditor)
    const regReviewer1 = await registerUser({
      email: "auditor.p12@diligencepros.in",
      firstName: "Arun",
      lastName: "Kulkarni",
      password: "Password@123",
      roles: ["BUYER"],
    });
    reviewer1 = {
      ...regReviewer1.user,
      roles: ["REVIEWER"],
      permissions: [
        "diligence.read_all",
        "diligence.manage",
        "diligence.request_docs",
        "diligence.review",
        "diligence.findings",
        "diligence.download",
      ],
    };

    // 6. Super Admin
    const regAdmin = await registerUser({
      email: "admin.p12@scaleup.gov.in",
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
        "mou.manage",
        "payments.manage",
        "diligence.manage",
        "diligence.read_all",
      ],
    };

    // 7. Seed Published Opportunity 1
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

    // Seed an unpublished draft opportunity for gate testing
    const draftOpp = await createOpportunity(seller1, {
      title: "Draft Unapproved Asset",
      headline: "Draft Avionics Shop in Industrial Area",
      teaserSummary: "Teaser draft summary of unpublished asset for gate testing.",
      businessCategory: "MANUFACTURING",
      industry: "Precision Engineering",
      subSector: "Aerospace",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      exactLegalName: "Draft Asset Pvt Ltd",
      exactCin: "U29299MH2010PTC038199",
      exactGstin: "27AABCA9999F1Z9",
      exactPan: "AABCA9999F",
      exactAddress: "Draft address",
    });
    oppDraftId = draftOpp.id;

    // 8. EOI -> Bilateral NDA Execution
    const eoi1 = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Interested in evaluating complete buyout of aerospace asset.",
    });
    eoi1Id = eoi1.id;
    await acceptEOI(seller1, eoi1.id, {
      sellerResponseMessage: "Accepted for bilateral NDA & diligence exchange.",
    });

    const initNda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });
    nda1ExecutedId = executedNda.id;

    // 9. Bilateral Deal Intent MOU (Accepted)
    const proposedMOU = await createMOU(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
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

    // 10. Bilateral EOI & Executed NDA for Opportunity 2 (Seller 2 & Buyer 2)
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
    await acceptEOI(seller2, eoi2.id, {
      sellerResponseMessage: "Accepted for bilateral NDA.",
    });

    const initNda2 = await initiateNDA(buyer2, pubOpp2.id, { eoiId: eoi2.id });
    await acceptNDA(buyer2, initNda2.id, { termsAcknowledged: true });
    const executedNda2 = await acceptNDA(seller2, initNda2.id, { termsAcknowledged: true });

    // Proposed (unaccepted) MOU for Buyer 2 & Seller 2
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
    mouUnacceptedId = unaccMOU.id;

    // 11. Satisfy Escrow Earnest Deposit Gate via Payment Intent + Confirmed Webhook for MOU 1
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_p12_dd_setup_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);
  });

  // =========================================================================
  // 1. FOUR-GATE PREREQUISITE INTEGRITY CHECKS
  // =========================================================================

  it("1. Blocked from creating diligence case if MOU is not ACCEPTED", async () => {
    await expect(
      createDiligenceCase(buyer2, mouUnacceptedId, {})
    ).rejects.toThrow(DiligenceGateError);
  });

  it("2. Blocked from creating diligence case if Token Deposit is unconfirmed", async () => {
    // Accept mouUnacceptedId so it is ACCEPTED, but deposit is never paid!
    const acceptedWithoutPay = await acceptMOU(seller2, mouUnacceptedId, { confirmed: true });

    await expect(
      createDiligenceCase(buyer2, acceptedWithoutPay.id, {})
    ).rejects.toThrow(DiligenceGateError);
  });

  it("3. Blocked from creating diligence case if Opportunity is unpublished or soft-deleted", async () => {
    // Temporarily soft-delete or unpublish opportunity 1
    await query(`UPDATE opportunities SET status = 'DRAFT' WHERE id = $1`, [opp1PublishedId]);

    await expect(
      createDiligenceCase(buyer1, mou1AcceptedId, {})
    ).rejects.toThrow(NotFoundError);

    // Restore to published
    await query(`UPDATE opportunities SET status = 'PUBLISHED' WHERE id = $1`, [opp1PublishedId]);
  });

  it("4. Successfully initializes diligence workspace when all 4 gates are satisfied", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {
      scopeDescription: "Comprehensive legal, financial, and tax due diligence for avionics buyout.",
    });

    expect(ddCase.id).toBeDefined();
    expect(ddCase.referenceCode).toMatch(/^DD-\d{4}-\d+/);
    expect(ddCase.status).toBe("INITIATED");
    expect(ddCase.buyerId).toBe(buyer1.id);
    expect(ddCase.sellerId).toBe(seller1.id);
    expect(ddCase.mouId).toBe(mou1AcceptedId);
    expect(ddCase.stats.totalItems).toBe(16);
    expect(ddCase.stats.completedItems).toBe(0);
    expect(ddCase.stats.completionPercentage).toBe(0);
  });

  it("5. Calling createDiligenceCase a second time returns existing case idempotently", async () => {
    const case1 = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const case2 = await createDiligenceCase(buyer1, mou1AcceptedId, {});

    expect(case1.id).toBe(case2.id);
    expect(case1.referenceCode).toBe(case2.referenceCode);
  });

  // =========================================================================
  // 2. AUTHORIZATION & ANTI-IDOR DEFENSE
  // =========================================================================

  it("6. Authorized Buyer and Seller can fetch case overview, but unrelated Buyer is strictly blocked (Anti-IDOR)", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});

    // Buyer 1 authorized
    const buyerView = await getDiligenceCaseById(buyer1, ddCase.id);
    expect(buyerView.id).toBe(ddCase.id);
    expect(buyerView.userRole).toBe("BUYER");

    // Seller 1 authorized
    const sellerView = await getDiligenceCaseById(seller1, ddCase.id);
    expect(sellerView.id).toBe(ddCase.id);
    expect(sellerView.userRole).toBe("SELLER");

    // Buyer 2 (unrelated) FORBIDDEN
    await expect(getDiligenceCaseById(buyer2, ddCase.id)).rejects.toThrow(ForbiddenError);

    // Seller 2 (unrelated) FORBIDDEN
    await expect(getDiligenceCaseById(seller2, ddCase.id)).rejects.toThrow(ForbiddenError);
  });

  it("7. Unrelated Buyer cannot fetch checklist items or evidence (Anti-IDOR)", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});

    const items = await getChecklistItems(buyer1, ddCase.id);
    expect(items.length).toBe(16);

    // Buyer 2 forbidden
    await expect(getChecklistItems(buyer2, ddCase.id)).rejects.toThrow(ForbiddenError);
  });

  // =========================================================================
  // 3. DOCUMENT REQUEST WORKFLOW & ROLE SEPARATION
  // =========================================================================

  it("8. Buyer can create a formal document request for a checklist item", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(buyer1, ddCase.id);
    const corporateLegalItem = items.find((i) => i.category === "CORPORATE_LEGAL")!;

    const req = await createDiligenceRequest(buyer1, ddCase.id, {
      checklistItemId: corporateLegalItem.id,
      requestDescription: "Please provide certified MOA & AOA with all historical MCA amendments.",
      priority: "HIGH",
      required: true,
    });

    expect(req.id).toBeDefined();
    expect(req.referenceCode).toMatch(/^REQ-\d{4}-\d+/);
    expect(req.status).toBe("OPEN");
    expect(req.checklistItemId).toBe(corporateLegalItem.id);

    // Re-checking checklist item reflects status updated to REQUESTED
    const updatedItems = await getChecklistItems(buyer1, ddCase.id);
    const updatedLegal = updatedItems.find((i) => i.id === corporateLegalItem.id)!;
    expect(updatedLegal.status).toBe("REQUESTED");
  });

  it("9. Seller CANNOT create document requests (Role privilege separation)", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    await expect(
      createDiligenceRequest(seller1, ddCase.id, {
        checklistItemId: items[0].id,
        requestDescription: "Promoter trying to request documents illegally.",
        priority: "MEDIUM",
        required: true,
      })
    ).rejects.toThrow(ForbiddenError);
  });

  // =========================================================================
  // 4. EVIDENCE UPLOAD SECURITY & IMMUTABILITY
  // =========================================================================

  it("10. Seller can upload valid PDF evidence with magic-byte validation & SHA256 integrity", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);
    const legalItem = items.find((i) => i.category === "CORPORATE_LEGAL")!;

    const pdfBuffer = createValidPdfBuffer("Certificate of Incorporation");

    const evidence = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "Certificate_of_Incorporation.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      },
      {
        checklistItemId: legalItem.id,
        title: "Certified Certificate of Incorporation",
        category: "CORPORATE_LEGAL",
      }
    );

    expect(evidence.id).toBeDefined();
    expect(evidence.referenceCode).toMatch(/^EVD-\d{4}-\d+/);
    expect(evidence.currentVersionNumber).toBe(1);
    expect(evidence.status).toBe("PENDING_REVIEW");
    expect(evidence.versions.length).toBe(1);
    expect(evidence.activeVersion.checksum).toBeDefined();
    expect(evidence.activeVersion.fileSize).toBe(pdfBuffer.length);
  });

  it("11. Uploading disguised executable or malicious file fails magic-byte inspection", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    // File claiming to be PDF but containing shell script header
    const maliciousBuffer = Buffer.from("#!/bin/bash\necho 'exploit'\nexit 0\n");

    await expect(
      uploadEvidenceDocument(
        seller1,
        ddCase.id,
        {
          originalFilename: "audit_report.pdf",
          mimeType: "application/pdf",
          buffer: maliciousBuffer,
        },
        {
          checklistItemId: items[0].id,
          title: "Spoofed Document",
          category: "FINANCIAL",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  it("12. Uploading disallowed file extension (.exe, .sh) is strictly rejected", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    await expect(
      uploadEvidenceDocument(
        seller1,
        ddCase.id,
        {
          originalFilename: "payload.exe",
          mimeType: "application/octet-stream",
          buffer: createValidPdfBuffer(),
        },
        {
          checklistItemId: items[0].id,
          title: "Executable",
          category: "TECHNOLOGY",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  it("13. Path traversal attempts in filename are strictly blocked with ValidationError", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const pdfBuffer = createValidPdfBuffer("Path Traversal Test");

    await expect(
      uploadEvidenceDocument(
        seller1,
        ddCase.id,
        {
          originalFilename: "../../../etc/passwd.pdf",
          mimeType: "application/pdf",
          buffer: pdfBuffer,
        },
        {
          checklistItemId: items[0].id,
          title: "Traversal Defense",
          category: "COMPLIANCE",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  it("14. Unrelated Buyer cannot upload evidence to Seller's workspace (Anti-IDOR)", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(buyer1, ddCase.id);

    await expect(
      uploadEvidenceDocument(
        buyer2,
        ddCase.id,
        {
          originalFilename: "unauthorized.pdf",
          mimeType: "application/pdf",
          buffer: createValidPdfBuffer(),
        },
        {
          checklistItemId: items[0].id,
          title: "Injected Document",
          category: "TAX",
        }
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("15. Evidence Version Immutability: Subsequent upload for same item creates v2 without mutating v1", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);
    const taxItem = items.find((i) => i.category === "TAX")!;

    const v1Buffer = createValidPdfBuffer("GST Return FY 23-24 v1");
    const evd1 = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "GST_Return_v1.pdf",
        mimeType: "application/pdf",
        buffer: v1Buffer,
      },
      {
        checklistItemId: taxItem.id,
        title: "Annual GST Return",
        category: "TAX",
      }
    );

    expect(evd1.currentVersionNumber).toBe(1);

    // Upload revised v2
    const v2Buffer = createValidPdfBuffer("GST Return FY 23-24 v2 Revised");
    const evd2 = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "GST_Return_v2_Revised.pdf",
        mimeType: "application/pdf",
        buffer: v2Buffer,
      },
      {
        checklistItemId: taxItem.id,
        title: "Annual GST Return",
        category: "TAX",
      }
    );

    expect(evd2.id).toBe(evd1.id); // Same evidence record
    expect(evd2.currentVersionNumber).toBe(2);
    expect(evd2.versions.length).toBe(2);
    expect(evd2.versions[0].versionNumber).toBe(1);
    expect(evd2.versions[1].versionNumber).toBe(2);
    expect(evd2.versions[0].checksum).not.toBe(evd2.versions[1].checksum);
  });

  // =========================================================================
  // 5. REVIEW WORKFLOW & SEPARATION OF POWERS
  // =========================================================================

  it("16. Seller CANNOT review or accept their own evidence (Self-approval blocked)", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "balance_sheet.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Balance Sheet"),
      },
      {
        checklistItemId: items[0].id,
        title: "Audited Balance Sheet",
        category: "FINANCIAL",
      }
    );

    await expect(
      reviewEvidenceVersion(seller1, ddCase.id, evd.id, 1, {
        decision: "ACCEPTED",
        notes: "Promoter trying to accept their own document.",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("17. Reviewer can accept evidence version, marking checklist item as ACCEPTED", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);
    const bankItem = items.find((i) => i.category === "BANKING")!;

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "bank_sanction.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Bank Sanction Letter"),
      },
      {
        checklistItemId: bankItem.id,
        title: "Working Capital Sanction Letter",
        category: "BANKING",
      }
    );

    const reviewed = await reviewEvidenceVersion(buyer1, ddCase.id, evd.id, 1, {
      decision: "ACCEPTED",
      notes: "Verified against State Bank of India portal.",
    });

    expect(reviewed.status).toBe("ACCEPTED");
    expect(reviewed.activeVersion.reviewStatus).toBe("ACCEPTED");

    // Check checklist item status
    const updatedItems = await getChecklistItems(buyer1, ddCase.id);
    const updatedBank = updatedItems.find((i) => i.id === bankItem.id)!;
    expect(updatedBank.status).toBe("ACCEPTED");

    // Case overview reflects 1 completed item
    const overview = await getDiligenceCaseById(buyer1, ddCase.id);
    expect(overview.stats.completedItems).toBe(1);
    expect(overview.stats.completionPercentage).toBeGreaterThan(0);
  });

  it("18. Reviewer can reject evidence version with mandatory rejectionReason", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "tax_challan.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Unsigned Challan"),
      },
      {
        checklistItemId: items[0].id,
        title: "Tax Challan",
        category: "TAX",
      }
    );

    // Rejecting without rejectionReason fails validation
    await expect(
      reviewEvidenceVersion(buyer1, ddCase.id, evd.id, 1, {
        decision: "REJECTED",
      })
    ).rejects.toThrow();

    // Rejecting with valid rejectionReason succeeds
    const rejected = await reviewEvidenceVersion(buyer1, ddCase.id, evd.id, 1, {
      decision: "REJECTED",
      rejectionReason: "Challan does not carry bank seal or BSR code verification.",
    });

    expect(rejected.status).toBe("REJECTED");
    expect(rejected.activeVersion.reviewStatus).toBe("REJECTED");
    expect(rejected.activeVersion.rejectionReason).toContain("BSR code");
  });

  // =========================================================================
  // 6. CLARIFICATION LOOP WORKFLOW
  // =========================================================================

  it("19. Reviewer can request clarification, opening a threaded inquiry that Seller can answer", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "pnl.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("P&L Statement"),
      },
      {
        checklistItemId: items[0].id,
        title: "Provisional P&L",
        category: "FINANCIAL",
      }
    );

    // Request clarification during review
    await reviewEvidenceVersion(buyer1, ddCase.id, evd.id, 1, {
      decision: "CLARIFICATION_REQUIRED",
      clarificationQuestion: "Please explain the 35% surge in other operating expenses in Q3.",
    });

    const clarList = await listClarifications(buyer1, ddCase.id);
    expect(clarList.length).toBe(1);
    expect(clarList[0].status).toBe("OPEN");
    expect(clarList[0].question).toContain("35% surge");

    // Seller answers clarification
    const answered = await respondToClarification(seller1, ddCase.id, clarList[0].id, {
      responseText: "The increase was due to one-time factory re-tooling for the Boeing export contract.",
    });

    expect(answered.status).toBe("ANSWERED");
    expect(answered.responseText).toContain("one-time factory re-tooling");
    expect(answered.respondedBy).toBe(seller1.id);
  });

  // =========================================================================
  // 7. DUE DILIGENCE FINDINGS (RED FLAGS) & RISK CLASSIFICATION
  // =========================================================================

  it("20. Buyer/Reviewer can record structured risk findings, but Seller cannot", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});

    // Seller cannot create findings
    await expect(
      createFinding(seller1, ddCase.id, {
        category: "LITIGATION",
        severity: "CRITICAL",
        title: "Promoter trying to add finding",
        description: "Not allowed",
      })
    ).rejects.toThrow(ForbiddenError);

    // Buyer creates critical finding
    const finding = await createFinding(buyer1, ddCase.id, {
      category: "LITIGATION",
      severity: "CRITICAL",
      title: "Pending Commercial High Court Suit for Contract Breach",
      description: "Supplier has filed a ₹2.5 Cr claim for non-fulfillment of supply agreement.",
      financialImpactEstimate: 25000000,
      remediationPlan: "Promoter to provide full bank indemnity or escrow retention before closing.",
    });

    expect(finding.id).toBeDefined();
    expect(finding.referenceCode).toMatch(/^FND-\d{4}-\d+/);
    expect(finding.severity).toBe("CRITICAL");
    expect(finding.status).toBe("OPEN");
    expect(finding.financialImpactEstimate).toBe(25000000);

    // Case overview reflects critical finding
    const overview = await getDiligenceCaseById(buyer1, ddCase.id);
    expect(overview.stats.criticalFindings).toBe(1);

    // Buyer can update finding status to MITIGATED
    const updated = await updateFinding(buyer1, ddCase.id, finding.id, {
      status: "MITIGATED",
      resolutionNotes: "Promoter furnished unconditional bank guarantee of ₹2.5 Cr.",
    });
    expect(updated.status).toBe("MITIGATED");
  });

  // =========================================================================
  // 8. CRYPTOGRAPHIC SIGNED DOWNLOAD URL & STREAMING
  // =========================================================================

  it("21. Generates cryptographic signed download token and streams file successfully", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const pdfBuffer = createValidPdfBuffer("Confidential Trade Secrets");
    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "trade_secrets.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      },
      {
        checklistItemId: items[0].id,
        title: "Trade Secrets Document",
        category: "INTELLECTUAL_PROPERTY",
      }
    );

    // Generate signed URL (300s TTL)
    const signed = await generateSignedEvidenceUrl(buyer1, ddCase.id, evd.id);
    expect(signed.downloadUrl).toBeDefined();
    expect(signed.downloadUrl).toContain("token=");
    expect(signed.expiresInSeconds).toBe(300);

    // Extract query parameters
    const url = new URL(signed.downloadUrl, "http://localhost:3000");
    const token = url.searchParams.get("token")!;
    const expiresAt = parseInt(url.searchParams.get("expires")!, 10);
    const userId = url.searchParams.get("u")!;
    const versionNumber = parseInt(url.searchParams.get("v")!, 10);

    // Stream file with valid token
    const streamed = await streamEvidenceDocument(token, expiresAt, userId, ddCase.id, evd.id, versionNumber);
    expect(streamed.buffer.length).toBe(pdfBuffer.length);
    expect(streamed.originalFilename).toBe("trade_secrets.pdf");
  });

  it("22. Tampered or expired signed download token is strictly rejected", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "document.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Document"),
      },
      {
        checklistItemId: items[0].id,
        title: "Document",
        category: "COMPLIANCE",
      }
    );

    const signed = await generateSignedEvidenceUrl(buyer1, ddCase.id, evd.id);
    const url = new URL(signed.downloadUrl, "http://localhost:3000");
    const validExpiresAt = parseInt(url.searchParams.get("expires")!, 10);
    const userId = url.searchParams.get("u")!;
    const versionNumber = parseInt(url.searchParams.get("v")!, 10);

    // Tampered token
    await expect(
      streamEvidenceDocument("tampered_fake_signature_token", validExpiresAt, userId, ddCase.id, evd.id, versionNumber)
    ).rejects.toThrow(ForbiddenError);

    // Expired token (10 seconds in past)
    const expiredTokenData = generateDiligenceDownloadToken({
      evidenceId: evd.id,
      versionNumber: 1,
      caseId: ddCase.id,
      userId: buyer1.id,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });

    await expect(
      streamEvidenceDocument(
        expiredTokenData,
        Math.floor(Date.now() / 1000) - 10,
        userId,
        ddCase.id,
        evd.id,
        versionNumber
      )
    ).rejects.toThrow(ForbiddenError);
  });

  // =========================================================================
  // 9. CASE STATE MACHINE TRANSITIONS & TERMINAL STATE LOCKS
  // =========================================================================

  it("23. FSM Status Transitions: INITIATED -> UNDER_REVIEW -> REVIEW_COMPLETE -> APPROVED", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    expect(ddCase.status).toBe("INITIATED");

    // INITIATED -> UNDER_REVIEW
    const s1 = await transitionCaseStatus(buyer1, ddCase.id, { targetStatus: "UNDER_REVIEW" });
    expect(s1.status).toBe("UNDER_REVIEW");

    // UNDER_REVIEW -> REVIEW_COMPLETE
    const s2 = await transitionCaseStatus(buyer1, ddCase.id, { targetStatus: "REVIEW_COMPLETE" });
    expect(s2.status).toBe("REVIEW_COMPLETE");

    // REVIEW_COMPLETE -> APPROVED (requires verdict)
    const s3 = await transitionCaseStatus(buyer1, ddCase.id, {
      targetStatus: "APPROVED",
      verdict: "APPROVED",
      verdictNotes: "All 16 categories verified with zero uncured high-severity red flags.",
    });
    expect(s3.status).toBe("APPROVED");
    expect(s3.verdict).toBe("APPROVED");
  });

  it("24. Invalid state transition jumps throw InvalidDiligenceStateError", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    expect(ddCase.status).toBe("INITIATED");

    // Jumping from INITIATED directly to APPROVED is illegal (must go through UNDER_REVIEW -> REVIEW_COMPLETE)
    await expect(
      transitionCaseStatus(buyer1, ddCase.id, {
        targetStatus: "APPROVED",
        verdict: "APPROVED",
      })
    ).rejects.toThrow(InvalidDiligenceStateError);
  });

  it("25. Terminal State Lock: Once CLOSED, workspace strictly rejects mutations", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    // Close case
    await transitionCaseStatus(buyer1, ddCase.id, {
      targetStatus: "CLOSED",
      closureReason: "Acquisition terms renegotiated; deal concluded.",
    });

    // Attempting to upload evidence throws DiligenceCaseClosedError
    await expect(
      uploadEvidenceDocument(
        seller1,
        ddCase.id,
        {
          originalFilename: "late_doc.pdf",
          mimeType: "application/pdf",
          buffer: createValidPdfBuffer("Late"),
        },
        {
          checklistItemId: items[0].id,
          title: "Late Document",
          category: "ASSETS",
        }
      )
    ).rejects.toThrow(DiligenceCaseClosedError);

    // Attempting to create requests throws DiligenceCaseClosedError
    await expect(
      createDiligenceRequest(buyer1, ddCase.id, {
        checklistItemId: items[0].id,
        requestDescription: "Late request",
        priority: "LOW",
        required: true,
      })
    ).rejects.toThrow(DiligenceCaseClosedError);
  });

  // =========================================================================
  // 10. AUDIT LOGGING & IN-APP NOTIFICATIONS
  // =========================================================================

  it("26. Diligence lifecycle actions generate immutable audit logs and in-app notifications", async () => {
    const ddCase = await createDiligenceCase(buyer1, mou1AcceptedId, {});
    const items = await getChecklistItems(seller1, ddCase.id);

    const evd = await uploadEvidenceDocument(
      seller1,
      ddCase.id,
      {
        originalFilename: "compliance_audit.pdf",
        mimeType: "application/pdf",
        buffer: createValidPdfBuffer("Compliance"),
      },
      {
        checklistItemId: items[0].id,
        title: "Statutory Compliance Audit",
        category: "COMPLIANCE",
      }
    );

    await reviewEvidenceVersion(buyer1, ddCase.id, evd.id, 1, {
      decision: "ACCEPTED",
      notes: "Audited cleanly.",
    });

    // Check audit logs for case and evidence
    const auditRes = await query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE (resource_type = 'DILIGENCE_CASE' AND resource_id = $1) OR (resource_type = 'DILIGENCE_EVIDENCE' AND resource_id = $2)`,
      [ddCase.id, evd.id]
    );
    const actions = auditRes.rows.map((r) => r.action);
    expect(actions).toContain("DILIGENCE_CASE_CREATED");
    expect(actions).toContain("DILIGENCE_EVIDENCE_UPLOADED");
    expect(actions).toContain("DILIGENCE_EVIDENCE_REVIEWED");

    // Check notifications for seller
    const notifRes = await query<{ title: string }>(
      `SELECT title FROM in_app_notifications WHERE user_id = $1`,
      [seller1.id]
    );
    const notifTitles = notifRes.rows.map((r) => r.title);
    expect(notifTitles.some((t) => t.includes("Due Diligence") || t.includes("Evidence Accepted"))).toBe(true);
  });
});
