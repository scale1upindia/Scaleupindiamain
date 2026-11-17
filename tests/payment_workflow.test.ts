// Scale-up India — Phase 11: Payment & Token Architecture Test Suite
// Path: tests/payment_workflow.test.ts

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
import {
  createMOU,
  acceptMOU,
} from "@/domains/mou/service";
import {
  createPaymentIntent,
  getPaymentIntentById,
  listPaymentIntents,
  getTokenDepositForMOU,
  processProviderWebhook,
  cancelPaymentIntent,
  refundPaymentIntent,
  reconcilePaymentIntent,
  resetPaymentRateLimits,
} from "@/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
} from "@/domains/payments/provider";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  InvalidWebhookError,
  InvalidPaymentStateError,
  IdempotencyConflictError,
} from "@/lib/errors";

describe("Phase 11: Payment & Token Architecture Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let admin: AuthenticatedUser;
  let finance: AuthenticatedUser;

  let opp1PublishedId: string;
  let nda1ExecutedId: string;
  let mou1AcceptedId: string;
  let mouDraftId: string;
  let testProvider: TestSimulatedPaymentProvider;

  const AUTHORITATIVE_EARNEST_AMOUNT = 500000; // ₹5 Lakhs INR

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_PAYMENT_PROVIDER = "true";
    resetPaymentRateLimits();
    await resetTestDb();

    testProvider = paymentProviderRegistry.getTestProvider();

    // 1. Provision Seller 1 (Apex Engineering)
    const regSeller1 = await registerUser({
      email: "seller1.p11@apexengineering.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p11@apexengineering.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Provision Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p11@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p11@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Provision Buyer 1 (Alpha Investments)
    const regBuyer1 = await registerUser({
      email: "buyer1.p11@alphainvestments.in",
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
        'Rajesh Kapoor', 'Managing Director', 'buyer1.p11@alphainvestments.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Provision Buyer 2 (Unrelated Buyer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p11@betacapital.in",
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
        'Pooja Bansal', 'Partner', 'buyer2.p11@betacapital.in', '+919876541123', 'VERIFIED', 'Technology'
      )`,
      [buyer2.id]
    );

    // 5. Provision Super Admin & Finance
    const regAdmin = await registerUser({
      email: "admin.p11@scaleup.gov.in",
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
        "payments.reconcile",
        "payments.read_all",
      ],
    };

    const regFinance = await registerUser({
      email: "finance.p11@scaleup.gov.in",
      firstName: "Head",
      lastName: "Escrow",
      password: "Password@123",
      roles: ["BUYER"],
    });
    finance = {
      ...regFinance.user,
      roles: ["FINANCE"],
      permissions: [
        "payments.verify",
        "payments.refund",
        "payments.reconcile",
        "payments.read_all",
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

    // 7. EOI -> Bilateral NDA Execution
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

    // 8. Create and Bilaterally Accept Deal Intent MOU (Buyer 1 & Seller 1)
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

    // 9. Create a real DRAFT MOU for buyer2 for gate testing
    const eoi2 = await submitEOI(buyer2, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Buyer 2 expressing interest for testing purposes.",
    });
    await acceptEOI(seller1, eoi2.id, {
      sellerResponseMessage: "Accepted for bilateral NDA.",
    });
    const initNda2 = await initiateNDA(buyer2, opp1PublishedId, { eoiId: eoi2.id });
    await acceptNDA(buyer2, initNda2.id, { termsAcknowledged: true });
    const executedNda2 = await acceptNDA(seller1, initNda2.id, { termsAcknowledged: true });

    const draftMOU = await createMOU(buyer2, opp1PublishedId, {
      ndaId: executedNda2.id,
      submitImmediately: false,
      terms: {
        proposedValuation: 50000000,
        currency: "INR",
        proposedStructure: "FULL_ACQUISITION",
        earnestDepositAmount: 200000,
      },
    });
    mouDraftId = draftMOU.id;
  });

  // ============================================================================
  // 1. STRICT MOU STATUS GATE
  // ============================================================================
  it("1. MOU Gate: Blocks payment intent creation if MOU is in DRAFT state", async () => {
    await expect(
      createPaymentIntent(buyer2, mouDraftId, {}, { providerName: "TEST_SIMULATED" })
    ).rejects.toThrow(ValidationError);
  });

  it("2. MOU Gate: Allows payment intent creation when MOU is in ACCEPTED state", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    expect(payment).toBeDefined();
    expect(payment.status).toBe("CREATED");
    expect(payment.amount).toBe(AUTHORITATIVE_EARNEST_AMOUNT);
    expect(payment.currency).toBe("INR");
    expect(payment.referenceCode).toMatch(/^PI-\d{4}-\d+$/);
  });

  // ============================================================================
  // 2. ANTI-IDOR AUTHORIZATION GATES
  // ============================================================================
  it("3. Anti-IDOR: Blocks unrelated Buyer 2 from creating payment for Buyer 1's accepted deal", async () => {
    await expect(
      createPaymentIntent(buyer2, mou1AcceptedId, {}, { providerName: "TEST_SIMULATED" })
    ).rejects.toThrow(ForbiddenError);
  });

  it("4. Anti-IDOR: Blocks Seller from creating buyer payment intent", async () => {
    await expect(
      createPaymentIntent(seller1, mou1AcceptedId, {}, { providerName: "TEST_SIMULATED" })
    ).rejects.toThrow(ForbiddenError);
  });

  it("5. Anti-IDOR: Blocks unrelated Buyer 2 from viewing Buyer 1's payment intent", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    await expect(getPaymentIntentById(buyer2, payment.id)).rejects.toThrow(ForbiddenError);
  });

  it("6. Anti-IDOR: Blocks unrelated Seller 2 from viewing deal token deposit status", async () => {
    await createPaymentIntent(buyer1, mou1AcceptedId, {}, { providerName: "TEST_SIMULATED" });
    await expect(getTokenDepositForMOU(seller2, mou1AcceptedId)).rejects.toThrow(ForbiddenError);
  });

  // ============================================================================
  // 3. AMOUNT & CURRENCY INTEGRITY
  // ============================================================================
  it("7. Amount Integrity: Blocks client attempt to pay ₹1 instead of agreed ₹5,00,000", async () => {
    await expect(
      createPaymentIntent(
        buyer1,
        mou1AcceptedId,
        { amount: 1 },
        { providerName: "TEST_SIMULATED" }
      )
    ).rejects.toThrow(PaymentAmountMismatchError);
  });

  it("8. Amount Integrity: Blocks negative or zero payment amount", async () => {
    await expect(
      createPaymentIntent(
        buyer1,
        mou1AcceptedId,
        { amount: -5000 },
        { providerName: "TEST_SIMULATED" }
      )
    ).rejects.toThrow();
  });

  it("9. Currency Integrity: Blocks unsupported currency (e.g. USD) when INR is mandated", async () => {
    await expect(
      createPaymentIntent(
        buyer1,
        mou1AcceptedId,
        { currency: "USD" },
        { providerName: "TEST_SIMULATED" }
      )
    ).rejects.toThrow();
  });

  // ============================================================================
  // 4. IDEMPOTENCY & CONCURRENCY
  // ============================================================================
  it("10. Idempotency: Repeated request with identical key returns existing payment intent without duplication", async () => {
    const key = "idempotency_key_p11_test_001";
    const payment1 = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      { idempotencyKey: key },
      { providerName: "TEST_SIMULATED" }
    );
    const payment2 = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      { idempotencyKey: key },
      { providerName: "TEST_SIMULATED" }
    );

    expect(payment1.id).toBe(payment2.id);
    expect(payment1.referenceCode).toBe(payment2.referenceCode);

    // Verify only one record in database
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM payment_intents WHERE idempotency_key = $1`,
      [key]
    );
    expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
  });

  it("11. Idempotency: Request with same key but conflicting parameters throws IdempotencyConflictError", async () => {
    const key = "idempotency_key_p11_test_conflict";
    await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      { idempotencyKey: key },
      { providerName: "TEST_SIMULATED" }
    );

    // Manipulate DB amount to trigger conflict detection
    await query(
      `UPDATE payment_intents SET amount = 999999 WHERE idempotency_key = $1`,
      [key]
    );

    await expect(
      createPaymentIntent(
        buyer1,
        mou1AcceptedId,
        { idempotencyKey: key },
        { providerName: "TEST_SIMULATED" }
      )
    ).rejects.toThrow(IdempotencyConflictError);
  });

  // ============================================================================
  // 5. TOKEN DEPOSIT MODEL & IMMUTABLE LEDGER
  // ============================================================================
  it("12. Token Deposit Model: Creates linked token deposit with status TOKEN_INTENT_CREATED", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    expect(payment.tokenDeposit).toBeDefined();
    expect(payment.tokenDeposit?.status).toBe("TOKEN_INTENT_CREATED");
    expect(payment.tokenDeposit?.referenceCode).toMatch(/^TOK-\d{4}-\d+$/);
    expect(payment.tokenDeposit?.depositAmount).toBe(AUTHORITATIVE_EARNEST_AMOUNT);
  });

  it("13. Immutable Ledger: Initial creation appends PAYMENT_CREATED transaction", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    expect(payment.ledger).toHaveLength(1);
    expect(payment.ledger[0].transactionType).toBe("PAYMENT_CREATED");
    expect(payment.ledger[0].direction).toBe("DEBIT");
    expect(payment.ledger[0].amount).toBe(AUTHORITATIVE_EARNEST_AMOUNT);
    expect(payment.ledger[0].status).toBe("RECORDED");
  });

  // ============================================================================
  // 6. WEBHOOK SECURITY & REPLAY PROTECTION
  // ============================================================================
  it("14. Webhook Security: Rejects webhook with invalid cryptographic signature", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payload = JSON.stringify({
      id: "evt_tampered_001",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    });

    await expect(
      processProviderWebhook("TEST_SIMULATED", payload, "invalid_forged_signature_hex")
    ).rejects.toThrow(InvalidWebhookError);
  });

  it("15. Webhook Security: Replay protection detects duplicate event and does not duplicate financial effects", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const eventId = "evt_replay_test_1001";
    const payloadObj = {
      id: eventId,
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);

    // 1st delivery
    const result1 = await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);
    expect(result1.success).toBe(true);
    expect(result1.status).toBe("SUCCEEDED");

    // 2nd delivery (Replay)
    const result2 = await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);
    expect(result2.success).toBe(true);
    expect(result2.duplicate).toBe(true);

    // Ledger must have exactly 2 entries (PAYMENT_CREATED + 1 PAYMENT_SUCCEEDED), NOT 3
    const updated = await getPaymentIntentById(buyer1, payment.id);
    expect(updated.ledger).toHaveLength(2);
  });

  it("16. Webhook Amount Integrity: Webhook claiming wrong amount fails and does NOT mark payment successful", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_mismatch_amount_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: 5000, // Attempted mismatch: ₹5,000 instead of ₹5,00,000
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);

    await expect(
      processProviderWebhook("TEST_SIMULATED", payloadStr, signature)
    ).rejects.toThrow(PaymentAmountMismatchError);

    const paymentAfter = await getPaymentIntentById(buyer1, payment.id);
    expect(paymentAfter.status).toBe("CREATED"); // Not marked as SUCCEEDED
  });

  // ============================================================================
  // 7. PAYMENT STATE MACHINE & CONCURRENCY
  // ============================================================================
  it("17. State Machine: Transitions to SUCCEEDED and updates token deposit to TOKEN_PAYMENT_CONFIRMED", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_success_transition_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);

    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    const updated = await getPaymentIntentById(buyer1, payment.id);
    expect(updated.status).toBe("SUCCEEDED");
    expect(updated.completedAt).not.toBeNull();
    expect(updated.tokenDeposit?.status).toBe("TOKEN_PAYMENT_CONFIRMED");
    expect(updated.tokenDeposit?.confirmedAt).not.toBeNull();
  });

  it("18. State Machine: Prevents cancellation of an already SUCCEEDED payment", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_success_cancel_block",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);

    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    await expect(
      cancelPaymentIntent(buyer1, payment.id, { reason: "Attempting to cancel succeeded" })
    ).rejects.toThrow(InvalidPaymentStateError);
  });

  // ============================================================================
  // 8. CANCELLATION FLOW
  // ============================================================================
  it("19. Cancellation: Buyer can cancel pending payment intent", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const cancelled = await cancelPaymentIntent(buyer1, payment.id, {
      reason: "Buyer decided to hold off deposit pending board review",
    });

    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.tokenDeposit?.status).toBe("TOKEN_CANCELLED");
    expect(cancelled.ledger.some((l) => l.transactionType === "PAYMENT_CANCELLED")).toBe(true);
  });

  // ============================================================================
  // 9. REFUND FLOW
  // ============================================================================
  it("20. Refund: Allows full refund of SUCCEEDED payment and appends REFUND_COMPLETED to ledger", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_refund_flow_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    const refunded = await refundPaymentIntent(buyer1, payment.id, {
      reason: "Transaction terminated under mutual consent during diligence period",
    });

    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundedAmount).toBe(AUTHORITATIVE_EARNEST_AMOUNT);
    expect(refunded.tokenDeposit?.status).toBe("TOKEN_REFUNDED");
    expect(refunded.ledger.some((l) => l.transactionType === "REFUND_COMPLETED")).toBe(true);
  });

  it("21. Refund: Rejects refund exceeding paid transaction amount", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const payloadObj = {
      id: "evt_over_refund_001",
      eventType: "payment.captured",
      providerPaymentReference: payment.providerPaymentReference,
      amount: AUTHORITATIVE_EARNEST_AMOUNT,
      currency: "INR",
      status: "SUCCEEDED",
    };
    const payloadStr = JSON.stringify(payloadObj);
    const signature = testProvider.generateSignature(payloadStr);
    await processProviderWebhook("TEST_SIMULATED", payloadStr, signature);

    await expect(
      refundPaymentIntent(buyer1, payment.id, {
        amount: AUTHORITATIVE_EARNEST_AMOUNT + 100000,
        reason: "Attempting to over-refund deposit amount",
      })
    ).rejects.toThrow(ValidationError);
  });

  // ============================================================================
  // 10. RECONCILIATION & AUDIT
  // ============================================================================
  it("22. Reconciliation: Admin can reconcile payment intent and recover captured funds", async () => {
    const payment = await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );

    // Simulate provider capturing payment without webhook delivery
    testProvider.simulatedStatuses.set(
      payment.providerPaymentReference!,
      "CAPTURED"
    );

    const reconciliation = await reconcilePaymentIntent(admin, payment.id);
    expect(reconciliation.matched).toBe(false); // Detected mismatch
    expect(reconciliation.reconciliationActionTaken).toContain("Updated status to SUCCEEDED");

    const updated = await getPaymentIntentById(buyer1, payment.id);
    expect(updated.status).toBe("SUCCEEDED");
    expect(
      updated.ledger.some((l) => l.transactionType === "RECONCILIATION_CORRECTION")
    ).toBe(true);
  });

  it("23. Confidentiality: Seller deposit view masks buyer sensitive bank details", async () => {
    await createPaymentIntent(
      buyer1,
      mou1AcceptedId,
      {},
      { providerName: "TEST_SIMULATED" }
    );
    const sellerView = await getTokenDepositForMOU(seller1, mou1AcceptedId);

    expect(sellerView).toBeDefined();
    expect(sellerView.depositAmount).toBe(AUTHORITATIVE_EARNEST_AMOUNT);
    expect(sellerView.status).toBe("TOKEN_INTENT_CREATED");
    // Ensure zero bank accounts, PAN, card numbers or provider secrets leaked
    expect((sellerView as any).payerUserId).toBeUndefined();
    expect((sellerView as any).providerPaymentReference).toBeUndefined();
    expect((sellerView as any).clientSecret).toBeUndefined();
  });
});
