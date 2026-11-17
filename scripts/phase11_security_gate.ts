// Scale-up India — Phase 11: Payment & Token Architecture Security Gate
// Script: scripts/phase11_security_gate.ts

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
  acceptMOU,
  rejectMOU,
  withdrawMOU,
} from "../src/domains/mou/service";
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
} from "../src/domains/payments/service";
import {
  paymentProviderRegistry,
  TestSimulatedPaymentProvider,
  RazorpayPaymentProvider,
} from "../src/domains/payments/provider";
import { getUserNotifications } from "../src/domains/notifications/service";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  PaymentProviderNotConfiguredError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  InvalidWebhookError,
  InvalidPaymentStateError,
} from "../src/lib/errors";

// Enable test simulated provider for this gate script
process.env.ENABLE_TEST_PAYMENT_PROVIDER = "true";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 11 PAYMENT / TOKEN ARCHITECTURE GATE");
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
  // 1. VERIFYING MIGRATION 011 & RELATIONAL SCHEMA INTEGRITY
  // ============================================================================
  console.log("--- 1. VERIFYING MIGRATION 011 & DATABASE INTEGRITY ---");
  const migRes = await query<{ id: string }>(
    `SELECT id FROM _schema_migrations WHERE id = '011_payment_token_architecture.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 011_payment_token_architecture.sql recorded in _schema_migrations");

  const seqRes = await query<any>(
    `SELECT sequence_name FROM information_schema.sequences 
     WHERE sequence_name IN ('payment_ref_seq', 'token_ref_seq', 'ledger_ref_seq')`
  );
  assert(seqRes.rows.length === 3, "Sequences payment_ref_seq, token_ref_seq, ledger_ref_seq exist in database");

  const tablesRes = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name IN ('payment_intents', 'token_deposits', 'payment_ledger', 'payment_webhook_events')`
  );
  assert(tablesRes.rows.length === 4, "Tables payment_intents, token_deposits, payment_ledger, payment_webhook_events exist in database");

  const idxRes = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes 
     WHERE indexname IN (
       'idx_payment_intents_idempotency', 
       'idx_payment_intents_provider_ref', 
       'idx_token_deposits_active_mou',
       'idx_payment_ledger_intent',
       'uq_payment_webhook_provider_event'
     )`
  );
  assert(idxRes.rows.length >= 4, "Unique idempotency, provider ref, active token deposit, and webhook deduplication indexes exist");

  const permRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM permissions WHERE module = 'payments'`
  );
  assert(parseInt(permRes.rows[0].count, 10) >= 6, "Phase 11 RBAC permissions correctly seeded in permissions table");

  // ============================================================================
  // 2. PRODUCTION PAYMENT GATEWAY CREDENTIAL GUARD
  // ============================================================================
  console.log("\n--- 2. PRODUCTION GATEWAY CREDENTIAL ENFORCEMENT ---");
  // Temporarily unset test provider env to verify production guard
  delete process.env.ENABLE_TEST_PAYMENT_PROVIDER;
  const originalNodeEnv = process.env.NODE_ENV;
  (process.env as any).NODE_ENV = "production";

  let prodGuardBlocked = false;
  try {
    paymentProviderRegistry.getProvider("RAZORPAY");
  } catch (err) {
    if (err instanceof PaymentProviderNotConfiguredError) {
      prodGuardBlocked = true;
    }
  }
  assert(prodGuardBlocked, "Production Security Guard: Throws PaymentProviderNotConfiguredError when real credentials missing in production");

  let testBlockedInProd = false;
  try {
    paymentProviderRegistry.getProvider("TEST_SIMULATED");
  } catch (err) {
    if (err instanceof PaymentProviderNotConfiguredError) {
      testBlockedInProd = true;
    }
  }
  assert(testBlockedInProd, "Zero Fake Payments Guard: TestSimulatedPaymentProvider strictly rejected when NODE_ENV=production");

  // Restore test provider for test execution
  process.env.ENABLE_TEST_PAYMENT_PROVIDER = "true";
  (process.env as any).NODE_ENV = originalNodeEnv || "test";

  // ============================================================================
  // 3. PROVISIONING PRINCIPALS & VERIFIED PROFILES
  // ============================================================================
  console.log("\n--- 3. PROVISIONING PRINCIPALS & VERIFIED PROFILES ---");
  const rand = Math.floor(Math.random() * 1000000);

  const regSeller1 = await registerUser({
    email: `seller1.escrow.${rand}@industrialvalves.in`,
    firstName: "Rajesh",
    lastName: "Sharma",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller1 = regSeller1.user;
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919876543210', $2, 'VERIFIED', 100)`,
    [seller1.id, seller1.email]
  );

  const regSeller2 = await registerUser({
    email: `seller2.escrow.${rand}@unrelated.in`,
    firstName: "Rohan",
    lastName: "Verma",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller2 = regSeller2.user;
  await query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Director', '+919876543211', $2, 'VERIFIED', 100)`,
    [seller2.id, seller2.email]
  );

  const regBuyer1 = await registerUser({
    email: `buyer1.escrow.${rand}@apexholdings.in`,
    firstName: "Vikram",
    lastName: "Singhania",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer1 = regBuyer1.user;
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'CORPORATE_BUYER', 'Apex Industrial Holdings LLP', 'LLP', 'Maharashtra', 'Mumbai',
      'Vikram Singhania', 'Partner', $2, '+919988776655', 'VERIFIED', 'Precision Engineering'
    )`,
    [buyer1.id, buyer1.email]
  );

  const regBuyer2 = await registerUser({
    email: `buyer2.escrow.${rand}@crossbuyer.in`,
    firstName: "Anand",
    lastName: "Mahindra",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer2 = regBuyer2.user;
  await query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'FAMILY_OFFICE', 'Cross Buyer Fund LLP', 'LLP', 'Delhi', 'New Delhi',
      'Anand Mahindra', 'Partner', $2, '+919988776656', 'VERIFIED', 'Manufacturing'
    )`,
    [buyer2.id, buyer2.email]
  );

  const regAdmin = await registerUser({
    email: `superadmin.escrow.${rand}@scaleup.in`,
    firstName: "Scaleup",
    lastName: "SuperAdmin",
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
      "payments.manage",
      "payments.read_all",
      "payments.reconcile",
    ],
  };

  assert(Boolean(seller1 && seller2 && buyer1 && buyer2 && admin), "Provisioned 5 test principals (Seller 1, Seller 2, Buyer 1, Buyer 2, Admin)");

  // ============================================================================
  // 4. PIPELINE SETUP: OPPORTUNITY, EOI, NDA, ACCEPTED MOU
  // ============================================================================
  console.log("\n--- 4. PIPELINE SETUP (OPPORTUNITY -> EOI -> NDA -> ACCEPTED MOU) ---");
  const opp1 = await createOpportunity(seller1, {
    title: "Precision Industrial Valves Manufacturer",
    headline: "ISO 9001 Heavy Industrial Valves & Actuators Unit",
    teaserSummary: "High-margin engineering company supplying oil & gas, petrochemical, and power plants.",
    businessCategory: "MANUFACTURING",
    industry: "Industrial Equipment & Machinery",
    subSector: "Industrial Valves & Actuators",
    operatingRegion: "WEST_INDIA",
    registeredState: "Maharashtra",
    approximateAgeBracket: "10_TO_20_YRS",
    revenueBracket: "25CR_TO_50CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "10_TO_20_PCT",
    askingPriceBracket: "25CR_TO_50CR",
    exactLegalName: "Apex Precision Valves Private Limited",
    exactCin: "U29299MH2010PTC058199",
    exactGstin: "27AABCA1234F1Z5",
    exactPan: "AABCA1234F",
    exactAddress: "Plot 42, Hinjewadi Industrial Zone, Pune, Maharashtra",
  });
  await submitOpportunity(opp1.id, seller1);
  await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
  const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);

  const eoi1 = await submitEOI(buyer1, pubOpp1.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Purchase",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in full acquisition of industrial valves manufacturing facility.",
  });
  await acceptEOI(seller1, eoi1.id, { sellerResponseMessage: "Accepted for bilateral NDA & diligence." });

  const initNda1 = await initiateNDA(buyer1, pubOpp1.id, { eoiId: eoi1.id });
  await acceptNDA(buyer1, initNda1.id, { termsAcknowledged: true });
  const executedNda1 = await acceptNDA(seller1, initNda1.id, { termsAcknowledged: true });

  // Create & Accept Bilateral Deal Intent MOU (Authoritative earnest deposit: ₹15,00,000)
  const draftMOU = await createMOU(buyer1, pubOpp1.id, {
    ndaId: executedNda1.id,
    terms: {
      proposedValuation: 35000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 35000000,
      equityConsideration: 0,
      earnestDepositAmount: 1500000, // ₹15 Lakhs earnest money
      exclusivityPeriodDays: 45,
      dueDiligenceWindowDays: 60,
      targetClosingDate: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0],
      conditionsPrecedent: ["Definitive SPA execution", "Due diligence clearance"],
    },
    submitImmediately: true,
  });

  const acceptedMOU = await acceptMOU(seller1, draftMOU.id, { confirmed: true });
  assert(acceptedMOU.status === "ACCEPTED", "Bilateral Deal Intent MOU accepted with earnest deposit ₹15,00,000");

  // ============================================================================
  // 5. MOU STATE GATE PRECONDITION ENFORCEMENT
  // ============================================================================
  console.log("\n--- 5. MOU STATE GATE PRECONDITION ENFORCEMENT ---");
  // Setup Opp 2 + NDA 2 with an unaccepted (DRAFT) MOU
  const opp2 = await createOpportunity(seller2, {
    title: "Precision Automation Systems",
    headline: "Robotics & PLC Automation Integration Unit",
    teaserSummary: "Factory automation solution provider with Fortune 500 OEM contracts.",
    businessCategory: "MANUFACTURING",
    industry: "Industrial Equipment & Machinery",
    subSector: "Industrial Automation",
    operatingRegion: "WEST_INDIA",
    registeredState: "Maharashtra",
    approximateAgeBracket: "5_TO_10_YRS",
    revenueBracket: "25CR_TO_50CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "10_TO_20_PCT",
    askingPriceBracket: "25CR_TO_50CR",
    exactLegalName: "Automation Solutions Private Limited",
    exactCin: "U29299MH2016PTC058200",
    exactGstin: "27AABCA1234F1Z6",
    exactPan: "AABCA1234G",
    exactAddress: "Plot 88, Chakan Industrial Phase II, Pune, Maharashtra",
  });
  await submitOpportunity(opp2.id, seller2);
  await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
  const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);

  const eoi2 = await submitEOI(buyer2, pubOpp2.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Purchase",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating automation unit.",
  });
  await acceptEOI(seller2, eoi2.id, { sellerResponseMessage: "Accepted." });

  const initNda2 = await initiateNDA(buyer2, pubOpp2.id, { eoiId: eoi2.id });
  await acceptNDA(buyer2, initNda2.id, { termsAcknowledged: true });
  const executedNda2 = await acceptNDA(seller2, initNda2.id, { termsAcknowledged: true });

  const unacceptedDraftMOU = await createMOU(buyer2, pubOpp2.id, {
    ndaId: executedNda2.id,
    terms: {
      proposedValuation: 25000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 25000000,
      equityConsideration: 0,
      earnestDepositAmount: 1000000,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
    },
    submitImmediately: false, // Remains DRAFT
  });

  let draftPaymentBlocked = false;
  try {
    await createPaymentIntent(buyer2, unacceptedDraftMOU.id, {
      amount: 1000000,
      currency: "INR",
      idempotencyKey: `idem_draft_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof ValidationError && (err as any).message.includes("ACCEPTED")) {
      draftPaymentBlocked = true;
    }
  }
  assert(draftPaymentBlocked, "MOU Precondition: Payment Intent creation BLOCKED on DRAFT MOU (Throws ValidationError)");

  // Propose and then Reject MOU
  await proposeMOUDraft(buyer2, unacceptedDraftMOU.id);
  const rejectedMOU = await rejectMOU(seller2, unacceptedDraftMOU.id, { reason: "Valuation too low." });
  let rejectedPaymentBlocked = false;
  try {
    await createPaymentIntent(buyer2, rejectedMOU.id, {
      amount: 1000000,
      currency: "INR",
      idempotencyKey: `idem_rej_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      rejectedPaymentBlocked = true;
    }
  }
  assert(rejectedPaymentBlocked, "MOU Precondition: Payment Intent creation BLOCKED on REJECTED MOU (Throws ValidationError)");

  // ============================================================================
  // 6. ANTI-IDOR & AUTHORIZATION BOUNDARIES
  // ============================================================================
  console.log("\n--- 6. ANTI-IDOR & AUTHORIZATION BOUNDARIES ---");
  // Foreign buyer 2 attempts to create Payment Intent on Buyer 1's accepted MOU
  let foreignBuyerBlocked = false;
  try {
    await createPaymentIntent(buyer2, acceptedMOU.id, {
      amount: 1500000,
      currency: "INR",
      idempotencyKey: `idem_foreign_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      foreignBuyerBlocked = true;
    }
  }
  assert(foreignBuyerBlocked, "Anti-IDOR: Unauthorized foreign Buyer 2 CANNOT create payment intent on Buyer 1's MOU (Throws ForbiddenError)");

  // Seller 1 attempts to create Payment Intent (only buyer can pay escrow deposit)
  let sellerCreateBlocked = false;
  try {
    await createPaymentIntent(seller1, acceptedMOU.id, {
      amount: 1500000,
      currency: "INR",
      idempotencyKey: `idem_seller_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      sellerCreateBlocked = true;
    }
  }
  assert(sellerCreateBlocked, "Role Invariant: Seller CANNOT create escrow payment intent (Throws ForbiddenError)");

  // ============================================================================
  // 7. AMOUNT & CURRENCY INVARIANT TAMPER DEFENSE
  // ============================================================================
  console.log("\n--- 7. AMOUNT & CURRENCY INTEGRITY DEFENSE ---");
  // Client attempts to pass manipulated amount lower than accepted earnest deposit (₹10 Lakh instead of ₹15 Lakh)
  let underpayBlocked = false;
  try {
    await createPaymentIntent(buyer1, acceptedMOU.id, {
      amount: 1000000,
      currency: "INR",
      idempotencyKey: `idem_tamper_low_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof PaymentAmountMismatchError) {
      underpayBlocked = true;
    }
  }
  assert(underpayBlocked, "Amount Invariant: Client underpayment attempt strictly BLOCKED with PaymentAmountMismatchError");

  // Client attempts to pass manipulated amount higher than accepted earnest deposit
  let overpayBlocked = false;
  try {
    await createPaymentIntent(buyer1, acceptedMOU.id, {
      amount: 2000000,
      currency: "INR",
      idempotencyKey: `idem_tamper_high_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof PaymentAmountMismatchError) {
      overpayBlocked = true;
    }
  }
  assert(overpayBlocked, "Amount Invariant: Client overpayment attempt strictly BLOCKED with PaymentAmountMismatchError");

  // Client attempts to pass foreign currency (USD instead of INR)
  let currencyMismatchBlocked = false;
  try {
    await createPaymentIntent(buyer1, acceptedMOU.id, {
      amount: 1500000,
      currency: "USD",
      idempotencyKey: `idem_tamper_curr_${Date.now()}`,
    });
  } catch (err) {
    if (err instanceof PaymentCurrencyMismatchError) {
      currencyMismatchBlocked = true;
    }
  }
  assert(currencyMismatchBlocked, "Currency Invariant: Non-INR currency strictly BLOCKED with PaymentCurrencyMismatchError");

  // ============================================================================
  // 8. IDEMPOTENCY KEY DEDUPLICATION & INTENT CREATION
  // ============================================================================
  console.log("\n--- 8. IDEMPOTENCY KEY DEDUPLICATION & INTENT CREATION ---");
  const testIdempotencyKey = `idem_valid_${Date.now()}_${rand}`;

  // First call: creates payment intent
  const intent1 = await createPaymentIntent(buyer1, acceptedMOU.id, {
    amount: 1500000,
    currency: "INR",
    idempotencyKey: testIdempotencyKey,
  });
  assert(intent1.id.length > 0 && intent1.status === "CREATED", "Valid Payment Intent created successfully with status CREATED");
  assert(intent1.referenceCode.startsWith("PI-"), "Standardized payment reference generated (e.g. PI-2026-10001)");
  assert(intent1.amount === 1500000 && intent1.currency === "INR", "Authoritative amount ₹15,00,000 and INR currency preserved");

  // Second call with same idempotencyKey: must return the exact same intent without creating duplicate
  const intent2 = await createPaymentIntent(buyer1, acceptedMOU.id, {
    amount: 1500000,
    currency: "INR",
    idempotencyKey: testIdempotencyKey,
  });
  assert(intent2.id === intent1.id, "Idempotency Invariant: Same idempotency key returned existing payment intent without creating new record");

  const duplicateCheck = await query<any>(
    `SELECT COUNT(*) as count FROM payment_intents WHERE payer_user_id = $1 AND idempotency_key = $2`,
    [buyer1.id, testIdempotencyKey]
  );
  assert(parseInt(duplicateCheck.rows[0].count, 10) === 1, "Database Verification: Exactly 1 record in payment_intents for idempotency key");

  // ============================================================================
  // 9. ANTI-IDOR READ RESTRICTIONS
  // ============================================================================
  console.log("\n--- 9. ANTI-IDOR READ RESTRICTIONS ---");
  let unauthorizedBuyerReadBlocked = false;
  try {
    await getPaymentIntentById(buyer2, intent1.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      unauthorizedBuyerReadBlocked = true;
    }
  }
  assert(unauthorizedBuyerReadBlocked, "Anti-IDOR: Foreign Buyer 2 CANNOT read Buyer 1's payment intent (Throws ForbiddenError)");

  let unauthorizedSellerReadBlocked = false;
  try {
    await getPaymentIntentById(seller2, intent1.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      unauthorizedSellerReadBlocked = true;
    }
  }
  assert(unauthorizedSellerReadBlocked, "Anti-IDOR: Foreign Seller 2 CANNOT read Payment Intent (Throws ForbiddenError)");

  // Confidentiality Boundary: Counterparty Seller cannot view raw payment intent containing gateway checkout tokens
  let counterpartySellerRawIntentBlocked = false;
  try {
    await getPaymentIntentById(seller1, intent1.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      counterpartySellerRawIntentBlocked = true;
    }
  }
  assert(counterpartySellerRawIntentBlocked, "Confidentiality Invariant: Seller CANNOT view raw payment intent containing checkout tokens (Throws ForbiddenError)");

  // Authorized counterparty seller CAN read token deposit status for their deal
  const sellerTokenView = await getTokenDepositForMOU(seller1, acceptedMOU.id);
  assert(sellerTokenView.depositAmount === 1500000, "Counterparty Seller 1 can view confidential token deposit status for their deal");

  // Foreign seller CANNOT view token deposit status
  let foreignSellerTokenBlocked = false;
  try {
    await getTokenDepositForMOU(seller2, acceptedMOU.id);
  } catch (err) {
    if (err instanceof ForbiddenError) {
      foreignSellerTokenBlocked = true;
    }
  }
  assert(foreignSellerTokenBlocked, "Anti-IDOR: Foreign Seller 2 CANNOT view deal token deposit (Throws ForbiddenError)");

  // Super Admin CAN view raw payment intent
  const adminIntentView = await getPaymentIntentById(admin, intent1.id);
  assert(adminIntentView.id === intent1.id, "Authorized Super Admin can view payment intent detail");

  // ============================================================================
  // 10. WEBHOOK SECURITY & CRYPTOGRAPHIC HMAC VERIFICATION
  // ============================================================================
  console.log("\n--- 10. WEBHOOK CRYPTOGRAPHIC VERIFICATION & TAMPER DEFENSE ---");
  const testProvider = paymentProviderRegistry.getTestProvider();
  const validWebhookPayload = {
    eventId: `evt_cap_${Date.now()}_${rand}`,
    eventType: "payment.captured",
    providerPaymentReference: intent1.providerPaymentReference,
    amount: 1500000,
    currency: "INR",
    status: "SUCCEEDED",
  };
  const payloadString = JSON.stringify(validWebhookPayload);
  const validSignature = testProvider.generateSignature(payloadString);

  // Test Tampered Signature: Bad HMAC
  let badSignatureBlocked = false;
  try {
    await processProviderWebhook("TEST_SIMULATED", payloadString, "invalid_hmac_tampered_signature_99999");
  } catch (err) {
    if (err instanceof InvalidWebhookError) {
      badSignatureBlocked = true;
    }
  }
  assert(badSignatureBlocked, "Webhook Security: Tampered / Invalid HMAC SHA-256 signature rejected with InvalidWebhookError");

  // Test Tampered Amount in Webhook: Webhook attempts to report lower amount than internal intent
  const tamperedAmountPayload = {
    ...validWebhookPayload,
    eventId: `evt_tamper_amt_${Date.now()}`,
    amount: 500000, // Attempted mismatch
  };
  const tamperedAmountString = JSON.stringify(tamperedAmountPayload);
  const tamperedAmountSig = testProvider.generateSignature(tamperedAmountString);

  let webhookAmountMismatchCaught = false;
  try {
    await processProviderWebhook("TEST_SIMULATED", tamperedAmountString, tamperedAmountSig);
  } catch (err) {
    if (err instanceof PaymentAmountMismatchError) {
      webhookAmountMismatchCaught = true;
    }
  }
  assert(webhookAmountMismatchCaught, "Webhook Tamper Defense: Webhook reporting mismatched amount strictly blocked with PaymentAmountMismatchError");

  // Process Valid Webhook Signature & Capture
  const webhookResult = await processProviderWebhook("TEST_SIMULATED", payloadString, validSignature);
  assert(webhookResult.success === true && webhookResult.duplicate === false, "Cryptographically verified webhook processed successfully");

  // ============================================================================
  // 11. WEBHOOK REPLAY PROTECTION & DEDUPLICATION
  // ============================================================================
  console.log("\n--- 11. WEBHOOK REPLAY PROTECTION & DEDUPLICATION ---");
  const replayResult = await processProviderWebhook("TEST_SIMULATED", payloadString, validSignature);
  assert(replayResult.success === true && replayResult.duplicate === true, "Replay Protection: Replayed webhook safely deduplicated without state mutation");

  const evtCount = await query<any>(
    `SELECT COUNT(*) as count FROM payment_webhook_events WHERE provider = 'TEST_SIMULATED' AND event_id = $1`,
    [validWebhookPayload.eventId]
  );
  assert(parseInt(evtCount.rows[0].count, 10) === 1, "Database Verification: Exactly 1 record stored in payment_webhook_events for eventId");

  // ============================================================================
  // 12. PAYMENT STATE MACHINE & TOKEN DEPOSIT CONFIRMATION
  // ============================================================================
  console.log("\n--- 12. PAYMENT STATE MACHINE & TOKEN DEPOSIT CONFIRMATION ---");
  const succeededIntent = await getPaymentIntentById(buyer1, intent1.id);
  assert(succeededIntent.status === "SUCCEEDED", "State Machine: Payment Intent transitioned to terminal state SUCCEEDED");
  assert(Boolean(succeededIntent.completedAt), "Timestamp completedAt recorded upon successful payment capture");

  // Check Token Deposit status synchronization
  const tokenDeposit = await getTokenDepositForMOU(buyer1, acceptedMOU.id);
  assert(tokenDeposit.status === "TOKEN_PAYMENT_CONFIRMED", "Token Deposit synchronized to TOKEN_PAYMENT_CONFIRMED");
  assert(tokenDeposit.depositAmount === 1500000, "Token Deposit confirmed with full earnest amount ₹15,00,000");
  assert(Boolean(tokenDeposit.confirmedAt), "Token Deposit confirmed_at timestamp recorded");

  // Terminal State Guard: Cannot cancel a SUCCEEDED payment
  let cancelSucceededBlocked = false;
  try {
    await cancelPaymentIntent(buyer1, intent1.id, { reason: "Buyer changed mind" });
  } catch (err) {
    if (err instanceof InvalidPaymentStateError) {
      cancelSucceededBlocked = true;
    }
  }
  assert(cancelSucceededBlocked, "Terminal State Invariant: Cannot CANCEL an already SUCCEEDED payment intent (Throws InvalidPaymentStateError)");

  // ============================================================================
  // 13. CANCELLATION WORKFLOW FOR PENDING INTENTS
  // ============================================================================
  console.log("\n--- 13. CANCELLATION WORKFLOW FOR PENDING INTENTS ---");
  // Setup another accepted MOU for testing cancellation
  const cancelIdemKey = `idem_cancel_test_${Date.now()}_${rand}`;
  const cancelNdaId = executedNda2.id;

  const cancelMOU = await createMOU(buyer2, pubOpp2.id, {
    ndaId: cancelNdaId,
    terms: {
      proposedValuation: 26000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 26000000,
      equityConsideration: 0,
      earnestDepositAmount: 1200000,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
    },
    submitImmediately: true,
  });
  await acceptMOU(seller2, cancelMOU.id, { confirmed: true });

  const cancelableIntent = await createPaymentIntent(buyer2, cancelMOU.id, {
    amount: 1200000,
    currency: "INR",
    idempotencyKey: cancelIdemKey,
  });

  const cancelledIntent = await cancelPaymentIntent(buyer2, cancelableIntent.id, {
    reason: "Buyer elected to withdraw before payment gateway authorization.",
  });
  assert(cancelledIntent.status === "CANCELLED", "Active Payment Intent successfully cancelled by buyer with status CANCELLED");

  // Terminal State Guard: Cannot refund a CANCELLED payment
  let refundCancelledBlocked = false;
  try {
    await refundPaymentIntent(admin, cancelableIntent.id, { reason: "Cannot refund cancelled" });
  } catch (err) {
    if (err instanceof InvalidPaymentStateError) {
      refundCancelledBlocked = true;
    }
  }
  assert(refundCancelledBlocked, "Terminal State Invariant: Cannot REFUND a CANCELLED payment (Throws InvalidPaymentStateError)");

  // ============================================================================
  // 14. REFUND WORKFLOW FOR SUCCEEDED INTENT
  // ============================================================================
  console.log("\n--- 14. AUTHORIZED REFUND WORKFLOW ---");
  // Unauthorized Seller 1 attempts to trigger refund
  let unauthorizedRefundBlocked = false;
  try {
    await refundPaymentIntent(seller1, intent1.id, { reason: "Seller wants to refund" });
  } catch (err) {
    if (err instanceof ForbiddenError) {
      unauthorizedRefundBlocked = true;
    }
  }
  assert(unauthorizedRefundBlocked, "Authorization Boundary: Seller CANNOT unilaterally execute payment refund (Throws ForbiddenError)");

  // Authorized Admin executes refund with audit reason
  const refundedIntent = await refundPaymentIntent(admin, intent1.id, {
    reason: "Mutual termination of acquisition talks during due diligence window.",
    amount: 1500000,
  });
  assert(refundedIntent.status === "REFUNDED", "Authorized Administrator successfully executed refund (Status: REFUNDED)");

  // Verify Token Deposit updated to REFUNDED
  const refundedTokenDeposit = await getTokenDepositForMOU(buyer1, acceptedMOU.id);
  assert(refundedTokenDeposit.status === "TOKEN_REFUNDED", "Token Deposit updated to TOKEN_REFUNDED upon successful refund");

  // ============================================================================
  // 15. APPEND-ONLY IMMUTABLE FINANCIAL LEDGER
  // ============================================================================
  console.log("\n--- 15. APPEND-ONLY IMMUTABLE FINANCIAL LEDGER ---");
  const ledgerEntries = await query<any>(
    `SELECT transaction_reference, transaction_type, amount, currency, direction, status, provider_reference 
     FROM payment_ledger 
     WHERE payment_intent_id = $1 
     ORDER BY created_at ASC`,
    [intent1.id]
  );

  assert(ledgerEntries.rows.length >= 3, "Immutable Ledger contains complete chronological journal trail (>= 3 entries)");
  const txTypes = ledgerEntries.rows.map((r) => r.transaction_type);
  assert(txTypes.includes("PAYMENT_CREATED"), "Ledger Journal Entry 1: PAYMENT_CREATED recorded");
  assert(txTypes.includes("PAYMENT_SUCCEEDED"), "Ledger Journal Entry 2: PAYMENT_SUCCEEDED recorded");
  assert(txTypes.includes("REFUND_COMPLETED"), "Ledger Journal Entry 3: REFUND_COMPLETED recorded");

  // Format Invariant: Each transaction reference starts with TX- and is unique
  const allRefsValid = ledgerEntries.rows.every((r) => r.transaction_reference.startsWith("TX-"));
  assert(allRefsValid, "Ledger Invariant: Standardized transaction references (e.g. TX-2026-10001) generated for all journal entries");

  // Direction Invariant: Payment Succeeded is CREDIT into escrow, Refund is DEBIT from escrow
  const succeededEntry = ledgerEntries.rows.find((r) => r.transaction_type === "PAYMENT_SUCCEEDED");
  const refundEntry = ledgerEntries.rows.find((r) => r.transaction_type === "REFUND_COMPLETED");
  assert(succeededEntry?.direction === "CREDIT" && refundEntry?.direction === "DEBIT", "Ledger Invariant: Double-entry accounting directions (Credit on Payment, Debit on Refund) preserved");

  // ============================================================================
  // 16. RECONCILIATION ENGINE
  // ============================================================================
  console.log("\n--- 16. PAYMENT RECONCILIATION ENGINE ---");
  // Setup Opportunity 3 + Bilateral NDA 3 for reconciliation testing
  const opp3 = await createOpportunity(seller1, {
    title: "Instrumentation Electronics Unit",
    headline: "Industrial IoT Sensors & Instrumentation",
    teaserSummary: "Export-oriented instrumentation electronics manufacturer.",
    businessCategory: "MANUFACTURING",
    industry: "Industrial Equipment & Machinery",
    subSector: "Industrial Sensors",
    operatingRegion: "WEST_INDIA",
    registeredState: "Maharashtra",
    approximateAgeBracket: "5_TO_10_YRS",
    revenueBracket: "25CR_TO_50CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "10_TO_20_PCT",
    askingPriceBracket: "25CR_TO_50CR",
    exactLegalName: "Sensorix Instruments Private Limited",
    exactCin: "U29299MH2018PTC058205",
    exactGstin: "27AABCS1234F1Z8",
    exactPan: "AABCS1234H",
    exactAddress: "MIDC Bhosari, Pune, Maharashtra",
  });
  await submitOpportunity(opp3.id, seller1);
  await executeAdminOpportunityReview(opp3.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(opp3.id, "VERIFY", {}, admin);
  const pubOpp3 = await executeAdminOpportunityReview(opp3.id, "PUBLISH", {}, admin);

  const eoi3 = await submitEOI(buyer1, pubOpp3.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Purchase",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in evaluating sensor manufacturing facility.",
  });
  await acceptEOI(seller1, eoi3.id, { sellerResponseMessage: "Accepted for bilateral NDA." });

  const initNda3 = await initiateNDA(buyer1, pubOpp3.id, { eoiId: eoi3.id });
  await acceptNDA(buyer1, initNda3.id, { termsAcknowledged: true });
  const executedNda3 = await acceptNDA(seller1, initNda3.id, { termsAcknowledged: true });

  const reconMOU = await createMOU(buyer1, pubOpp3.id, {
    ndaId: executedNda3.id,
    terms: {
      proposedValuation: 36000000,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 36000000,
      equityConsideration: 0,
      earnestDepositAmount: 1500000,
      exclusivityPeriodDays: 45,
      dueDiligenceWindowDays: 60,
    },
    submitImmediately: true,
  });
  await acceptMOU(seller1, reconMOU.id, { confirmed: true });

  const reconIntent = await createPaymentIntent(buyer1, reconMOU.id, {
    amount: 1500000,
    currency: "INR",
    idempotencyKey: `idem_recon_${Date.now()}_${rand}`,
  });

  // Simulate provider having captured payment out of band (e.g. missed webhook)
  testProvider.simulatedStatuses.set(reconIntent.providerPaymentReference!, "CAPTURED");

  // Trigger reconciliation
  const reconResult = await reconcilePaymentIntent(admin, reconIntent.id);
  assert(reconResult.matched === false, "Reconciliation Engine: Successfully detected status mismatch (Internal: CREATED, Provider: CAPTURED)");
  assert(reconResult.reconciliationActionTaken?.includes("SUCCEEDED") === true, "Reconciliation Engine: Safely auto-healed internal status to SUCCEEDED");

  // Verify ledger recorded correction
  const reconLedger = await query<any>(
    `SELECT transaction_type FROM payment_ledger WHERE payment_intent_id = $1 AND transaction_type = 'RECONCILIATION_CORRECTION'`,
    [reconIntent.id]
  );
  assert(reconLedger.rows.length === 1, "Reconciliation Ledger: RECONCILIATION_CORRECTION journal entry written to immutable ledger");

  // Run reconciliation a second time: now statuses match
  const secondReconResult = await reconcilePaymentIntent(admin, reconIntent.id);
  assert(secondReconResult.matched === true, "Reconciliation Engine: Second run confirms internal and provider statuses in full harmony");

  // ============================================================================
  // 17. CONFIDENTIALITY & ZERO SENSITIVE DATA LEAKAGE
  // ============================================================================
  console.log("\n--- 17. CONFIDENTIALITY & ZERO DATA LEAKAGE ---");
  const sellerConfidentialTokenView = await getTokenDepositForMOU(seller1, acceptedMOU.id);

  // Verify Seller sees confirmed token deposit without sensitive buyer financial identifiers
  const sellerTokenJson = JSON.stringify(sellerConfidentialTokenView);
  assert(!sellerTokenJson.includes("test_client_secret"), "Zero Secret Leakage: Client secrets never exposed to seller view");
  assert(!sellerTokenJson.includes("card_number"), "Zero Card Data Leakage: Raw card numbers never present");
  assert(!sellerTokenJson.includes("cvv"), "Zero Card Data Leakage: CVV never stored or exposed");
  assert(!sellerTokenJson.includes("otp"), "Zero Auth Leakage: OTP never stored or exposed");

  // Verify Database contains zero raw card or secret credentials
  const dbSecretsCheck = await query<any>(
    `SELECT metadata FROM payment_intents WHERE id = $1`,
    [intent1.id]
  );
  const metaStr = JSON.stringify(dbSecretsCheck.rows[0].metadata);
  assert(!metaStr.includes("cvv") && !metaStr.includes("otp"), "Database Hygiene: Zero payment secrets stored in payment_intents metadata");

  // ============================================================================
  // 18. AUDIT LOGGING & NOTIFICATIONS INTEGRITY
  // ============================================================================
  console.log("\n--- 18. AUDIT LOGGING & NOTIFICATIONS INTEGRITY ---");
  const auditRes = await query<any>(
    `SELECT action, resource_type FROM audit_logs 
     WHERE resource_id IN ($1, $2)
     ORDER BY created_at ASC`,
    [intent1.id, reconIntent.id]
  );

  const loggedActions = auditRes.rows.map((r) => r.action);
  assert(loggedActions.includes("PAYMENT_INTENT_CREATED"), "Audit log recorded: PAYMENT_INTENT_CREATED");
  assert(loggedActions.includes("PAYMENT_SUCCEEDED"), "Audit log recorded: PAYMENT_SUCCEEDED");
  assert(loggedActions.includes("REFUND_SUCCEEDED"), "Audit log recorded: REFUND_SUCCEEDED");
  assert(loggedActions.includes("PAYMENT_RECONCILED"), "Audit log recorded: PAYMENT_RECONCILED");

  // Verify in-app notifications generated for buyer and seller
  const buyerNotifData = await getUserNotifications(buyer1.id);
  const sellerNotifData = await getUserNotifications(seller1.id);

  const buyerHasPaymentNotif = buyerNotifData.notifications.some(
    (n) => n.title.includes("Earnest Deposit") || n.message.includes("Earnest Deposit") || n.title.includes("Payment")
  );
  const sellerHasPaymentNotif = sellerNotifData.notifications.some(
    (n) => n.title.includes("Earnest Deposit") || n.message.includes("Earnest Deposit") || n.title.includes("Payment")
  );

  assert(buyerHasPaymentNotif, "Notification dispatched to Buyer upon earnest deposit event");
  assert(sellerHasPaymentNotif, "Notification dispatched to Seller upon earnest deposit confirmation");

  // ============================================================================
  // SUMMARY RESULTS
  // ============================================================================
  console.log("\n=================================================================");
  console.log(`PHASE 11 SECURITY GATE COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log("=================================================================");

  if (passedCount === totalCount) {
    console.log("\n>>> PHASE 11 FINAL VERDICT: READY_FOR_PHASE_12 <<<\n");
  } else {
    console.error(`\n>>> PHASE 11 FINAL VERDICT: NOT_READY_FOR_PHASE_12 (${totalCount - passedCount} FAILED) <<<\n`);
    process.exitCode = 1;
  }
}

runSecurityGate().catch((err) => {
  console.error("FATAL: Security Gate crashed:", err);
  process.exit(1);
});
