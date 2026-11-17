// Scale-up India — Phase 11: Payment & Token Domain Service
// Path: src/domains/payments/service.ts

import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  PaymentProviderNotConfiguredError,
  InvalidPaymentStateError,
  PaymentAmountMismatchError,
  PaymentCurrencyMismatchError,
  InvalidWebhookError,
  IdempotencyConflictError,
} from "@/lib/errors";
import {
  PaymentIntentStatus,
  TokenDepositStatus,
  PaymentPurpose,
  PaymentIntentRecord,
  TokenDepositRecord,
  PaymentLedgerRecord,
  PaymentIntentDetailView,
  PaymentIntentListItemView,
  SellerTokenDepositView,
  PaymentLedgerItemView,
  ReconciliationResultView,
} from "@/types/payment";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreatePaymentIntentInput,
  CancelPaymentIntentInput,
  RefundPaymentIntentInput,
  createPaymentIntentSchema,
  cancelPaymentIntentSchema,
  refundPaymentIntentSchema,
} from "@/schemas/payment";
import {
  paymentProviderRegistry,
  PaymentProvider,
  ProviderWebhookEvent,
} from "@/domains/payments/provider";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";

// Sliding-window rate limiter for payment intent operations: userId -> timestamps[]
const paymentRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_PAYMENT_OPS_PER_MINUTE = 10;
const MAX_STATUS_QUERIES_PER_MINUTE = 30;

function checkPaymentRateLimit(userId: string, isQuery = false): void {
  const now = Date.now();
  const maxOps = isQuery ? MAX_STATUS_QUERIES_PER_MINUTE : MAX_PAYMENT_OPS_PER_MINUTE;
  const key = `${userId}:${isQuery ? "query" : "write"}`;
  const timestamps = paymentRateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= maxOps) {
    throw new ValidationError(
      `Payment request rate limit exceeded. Please wait a moment before trying again.`
    );
  }

  validTimestamps.push(now);
  paymentRateLimitMap.set(key, validTimestamps);
}

export function resetPaymentRateLimits(): void {
  paymentRateLimitMap.clear();
}

/**
 * Helper to generate institutional reference codes
 */
async function generatePaymentReference(): Promise<string> {
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('payment_ref_seq') as nextval`);
  const seqVal = seqRes.rows[0]?.nextval || "10001";
  return `PI-${new Date().getFullYear()}-${seqVal}`;
}

async function generateTokenReference(): Promise<string> {
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('token_ref_seq') as nextval`);
  const seqVal = seqRes.rows[0]?.nextval || "10001";
  return `TOK-${new Date().getFullYear()}-${seqVal}`;
}

async function generateLedgerReference(): Promise<string> {
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('ledger_ref_seq') as nextval`);
  const seqVal = seqRes.rows[0]?.nextval || "10001";
  return `TX-${new Date().getFullYear()}-${seqVal}`;
}

/**
 * 1. CREATE PAYMENT INTENT (FOR ACCEPTED MOU EARNEST DEPOSIT)
 * 
 * Strict Invariants:
 * - Deal Intent MOU must exist and be in ACCEPTED state
 * - Bilateral NDA must be EXECUTED
 * - Linked opportunity must be PUBLISHED
 * - Initiator must be the authorized Buyer of the MOU
 * - Authoritative amount is derived from accepted MOU terms
 * - Currency is strictly INR
 * - Supports idempotency keys to prevent duplicate creation
 */
export async function createPaymentIntent(
  initiator: AuthenticatedUser,
  mouId: string,
  input: CreatePaymentIntentInput = {},
  context?: { ip?: string; userAgent?: string; providerName?: string }
): Promise<PaymentIntentDetailView> {
  checkPaymentRateLimit(initiator.id, false);

  if ((input as any).currency && (input as any).currency.toUpperCase() !== "INR") {
    throw new PaymentCurrencyMismatchError(
      `Escrow earnest deposit payments are strictly denominated in INR. Unsupported currency: ${(input as any).currency}`
    );
  }

  const validated = createPaymentIntentSchema.parse(input);

  // 1. Fetch Deal Intent MOU
  const mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title, o.reference_code as opp_ref, o.status as opp_status, o.deleted_at as opp_deleted_at
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU not found.");
  }

  const mou = mouRes.rows[0];

  // 2. Opportunity Publication Check
  if (mou.opp_deleted_at !== null || mou.opp_status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found or not published.");
  }

  // 3. Bilateral NDA Execution Gate
  const ndaRes = await query<any>(
    `SELECT id, status FROM nda_agreements WHERE id = $1`,
    [mou.nda_id]
  );
  if (ndaRes.rows.length === 0 || ndaRes.rows[0].status !== "EXECUTED") {
    throw new ValidationError("Cannot initiate payment. Associated bilateral NDA is not in EXECUTED state.");
  }

  // 4. STRICT MOU GATE: MOU must be in ACCEPTED state
  if (mou.status !== "ACCEPTED") {
    throw new ValidationError(
      `Cannot initiate payment. Deal Intent MOU must be in ACCEPTED status (Current status: ${mou.status}).`
    );
  }

  // 5. Anti-IDOR Authorization Check: Initiator must be the buyer of the MOU
  const isBuyer = initiator.id === mou.buyer_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isAdmin) {
    throw new ForbiddenError("You are not the authorized buyer for this Deal Intent MOU.");
  }

  // 6. Fetch accepted version commercial terms
  const versionRes = await query<any>(
    `SELECT * FROM mou_versions 
     WHERE mou_id = $1 AND version_number = $2 AND status = 'ACCEPTED'`,
    [mou.id, mou.current_version_number]
  );

  if (versionRes.rows.length === 0) {
    throw new ValidationError("Accepted commercial terms not found for this Deal Intent MOU.");
  }

  const acceptedTerms = versionRes.rows[0];
  const authoritativeAmount = Number(acceptedTerms.earnest_deposit_amount);

  if (authoritativeAmount <= 0) {
    throw new ValidationError(
      "Agreed earnest deposit amount in the accepted MOU is zero. No earnest deposit is required for this deal."
    );
  }

  // 7. Amount & Currency Integrity Enforcement
  if (validated.amount !== undefined && Number(validated.amount) !== authoritativeAmount) {
    throw new PaymentAmountMismatchError(
      `Submitted payment amount (₹${validated.amount}) does not match the agreed earnest deposit amount in the accepted MOU (₹${authoritativeAmount}).`
    );
  }

  const finalAmount = authoritativeAmount;
  const finalCurrency = "INR";

  // 8. Idempotency Key Handling
  if (validated.idempotencyKey) {
    const existingIntentRes = await query<PaymentIntentRecord>(
      `SELECT * FROM payment_intents 
       WHERE payer_user_id = $1 AND idempotency_key = $2`,
      [initiator.id, validated.idempotencyKey]
    );

    if (existingIntentRes.rows.length > 0) {
      const existing = existingIntentRes.rows[0];
      // Verify payload consistency
      if (existing.mou_id !== mouId || Number(existing.amount) !== finalAmount) {
        throw new IdempotencyConflictError(
          "Idempotency key collision: This idempotency key was previously used with different parameters."
        );
      }
      return getPaymentIntentById(initiator, existing.id);
    }
  }

  // 9. Existing Active Payment Check
  const activePaymentRes = await query<PaymentIntentRecord>(
    `SELECT * FROM payment_intents 
     WHERE mou_id = $1 AND status IN ('SUCCEEDED', 'AUTHORIZED')`,
    [mouId]
  );

  if (activePaymentRes.rows.length > 0) {
    throw new ConflictError(
      `An earnest deposit payment has already been completed for this deal (Reference: ${activePaymentRes.rows[0].reference_code}).`
    );
  }

  // 10. Provider Resolution & Intent Creation
  const provider = paymentProviderRegistry.getProvider(context?.providerName);
  const paymentRef = await generatePaymentReference();
  const tokenRef = await generateTokenReference();
  const ledgerRef = await generateLedgerReference();

  const providerResult = await provider.createPaymentIntent({
    internalReference: paymentRef,
    amount: finalAmount,
    currency: finalCurrency,
    purpose: validated.purpose || "EARNEST_DEPOSIT",
    payerEmail: initiator.email,
    metadata: {
      mouId: mou.id,
      opportunityId: mou.opportunity_id,
      mouReference: mou.reference_code,
    },
  });

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(); // 48h validity

  // 11. Transactionally persist Payment Intent, Token Deposit, and initial Ledger entry
  const paymentIntent = await transaction(async (tx) => {
    // 1. Insert Payment Intent
    const insertIntentRes = await tx.query<PaymentIntentRecord>(
      `INSERT INTO payment_intents (
        reference_code, opportunity_id, mou_id, payer_user_id, payer_role,
        amount, currency, purpose, status, provider,
        provider_payment_reference, idempotency_key, metadata, expires_at
      ) VALUES ($1, $2, $3, $4, 'BUYER', $5, $6, $7, 'CREATED', $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        paymentRef,
        mou.opportunity_id,
        mou.id,
        initiator.id,
        finalAmount,
        finalCurrency,
        validated.purpose || "EARNEST_DEPOSIT",
        provider.name,
        providerResult.providerPaymentReference,
        validated.idempotencyKey || null,
        JSON.stringify({
          clientSecret: providerResult.clientSecret,
          checkoutUrl: providerResult.checkoutUrl,
          mouReference: mou.reference_code,
        }),
        expiresAt,
      ]
    );

    const intent = insertIntentRes.rows[0];

    // 2. Insert Token Deposit Intent Record
    await tx.query(
      `INSERT INTO token_deposits (
        reference_code, opportunity_id, mou_id, buyer_id, seller_id,
        payment_intent_id, deposit_amount, currency, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TOKEN_INTENT_CREATED')`,
      [
        tokenRef,
        mou.opportunity_id,
        mou.id,
        initiator.id,
        mou.seller_id,
        intent.id,
        finalAmount,
        finalCurrency,
      ]
    );

    // 3. Append to Immutable Payment Ledger
    await tx.query(
      `INSERT INTO payment_ledger (
        transaction_reference, payment_intent_id, transaction_type,
        amount, currency, direction, status, provider_reference,
        related_opportunity_id, related_mou_id, actor_id, actor_role, notes
      ) VALUES ($1, $2, 'PAYMENT_CREATED', $3, $4, 'DEBIT', 'RECORDED', $5, $6, $7, $8, 'BUYER', $9)`,
      [
        ledgerRef,
        intent.id,
        finalAmount,
        finalCurrency,
        providerResult.providerPaymentReference,
        mou.opportunity_id,
        mou.id,
        initiator.id,
        `Payment intent created for earnest deposit on MOU ${mou.reference_code}`,
      ]
    );

    return intent;
  });

  // 12. Audit Logging & Notification
  await auditLog({
    actorId: initiator.id,
    action: "PAYMENT_INTENT_CREATED",
    resourceType: "PAYMENT_INTENT",
    resourceId: paymentIntent.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: paymentIntent.reference_code,
      mouReferenceCode: mou.reference_code,
      amount: finalAmount,
      currency: finalCurrency,
      provider: provider.name,
      purpose: paymentIntent.purpose,
    },
  });

  await createNotification({
    userId: initiator.id,
    type: "PAYMENT_INITIATED",
    title: "Earnest Deposit Initiated",
    message: `Payment intent ${paymentIntent.reference_code} for ₹${(finalAmount / 100000).toFixed(2)} Lakhs has been created for deal ${mou.reference_code}.`,
    resourceType: "PAYMENT_INTENT",
    resourceId: paymentIntent.id,
  });

  return getPaymentIntentById(initiator, paymentIntent.id);
}

/**
 * 2. GET PAYMENT INTENT BY ID (Anti-IDOR Protected)
 */
export async function getPaymentIntentById(
  requester: AuthenticatedUser,
  paymentIntentId: string
): Promise<PaymentIntentDetailView> {
  checkPaymentRateLimit(requester.id, true);

  const res = await query<any>(
    `SELECT p.*, o.title as opp_title, o.reference_code as opp_ref, m.reference_code as mou_ref
     FROM payment_intents p
     JOIN opportunities o ON p.opportunity_id = o.id
     JOIN deal_mous m ON p.mou_id = m.id
     WHERE p.id = $1`,
    [paymentIntentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Payment intent record not found.");
  }

  const p = res.rows[0];

  // Anti-IDOR Authorization
  const isPayer = requester.id === p.payer_user_id;
  const isAdmin = requester.roles.includes("SUPER_ADMIN") || requester.roles.includes("FINANCE");

  if (!isPayer && !isAdmin) {
    throw new ForbiddenError("You do not have permission to view this payment intent.");
  }

  // Fetch token deposit if exists
  const tokenRes = await query<TokenDepositRecord>(
    `SELECT * FROM token_deposits WHERE payment_intent_id = $1`,
    [p.id]
  );
  const token = tokenRes.rows[0] || null;

  // Fetch immutable ledger
  const ledgerRes = await query<PaymentLedgerRecord>(
    `SELECT * FROM payment_ledger WHERE payment_intent_id = $1 ORDER BY created_at ASC`,
    [p.id]
  );

  const ledgerViews: PaymentLedgerItemView[] = ledgerRes.rows.map((l) => ({
    transactionReference: l.transaction_reference,
    transactionType: l.transaction_type,
    amount: Number(l.amount),
    currency: l.currency,
    direction: l.direction,
    status: l.status,
    createdAt: new Date(l.created_at).toISOString(),
    notes: l.notes,
  }));

  const metadata = typeof p.metadata === "string" ? JSON.parse(p.metadata) : p.metadata || {};

  return {
    id: p.id,
    referenceCode: p.reference_code,
    opportunityId: p.opportunity_id,
    opportunityTitle: p.opp_title,
    opportunityReference: p.opp_ref,
    mouId: p.mou_id,
    mouReferenceCode: p.mou_ref,
    payerUserId: p.payer_user_id,
    amount: Number(p.amount),
    currency: p.currency,
    purpose: p.purpose,
    status: p.status,
    provider: p.provider,
    providerPaymentReference: p.provider_payment_reference,
    refundedAmount: Number(p.refunded_amount || 0),
    expiresAt: p.expires_at ? new Date(p.expires_at).toISOString() : null,
    completedAt: p.completed_at ? new Date(p.completed_at).toISOString() : null,
    cancelledAt: p.cancelled_at ? new Date(p.cancelled_at).toISOString() : null,
    createdAt: new Date(p.created_at).toISOString(),
    updatedAt: new Date(p.updated_at).toISOString(),
    tokenDeposit: token
      ? {
          referenceCode: token.reference_code,
          depositAmount: Number(token.deposit_amount),
          currency: token.currency,
          status: token.status,
          confirmedAt: token.confirmed_at ? new Date(token.confirmed_at).toISOString() : null,
        }
      : null,
    ledger: ledgerViews,
    clientSecret: metadata.clientSecret,
  };
}

/**
 * 3. LIST PAYMENT INTENTS FOR AUTHENTICATED USER
 */
export async function listPaymentIntents(
  user: AuthenticatedUser,
  options: { mouId?: string; limit?: number; offset?: number } = {}
): Promise<{ items: PaymentIntentListItemView[]; total: number }> {
  checkPaymentRateLimit(user.id, true);

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("FINANCE");
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const offset = Math.max(options.offset || 0, 0);

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (!isAdmin) {
    params.push(user.id);
    whereClauses.push(`p.payer_user_id = $${params.length}`);
  }

  if (options.mouId) {
    params.push(options.mouId);
    whereClauses.push(`p.mou_id = $${params.length}`);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM payment_intents p ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || "0", 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const listRes = await query<any>(
    `SELECT p.*, o.title as opp_title, o.reference_code as opp_ref, m.reference_code as mou_ref
     FROM payment_intents p
     JOIN opportunities o ON p.opportunity_id = o.id
     JOIN deal_mous m ON p.mou_id = m.id
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const items: PaymentIntentListItemView[] = listRes.rows.map((r) => ({
    id: r.id,
    referenceCode: r.reference_code,
    opportunityId: r.opportunity_id,
    opportunityTitle: r.opp_title,
    opportunityReference: r.opp_ref,
    mouId: r.mou_id,
    mouReferenceCode: r.mou_ref,
    amount: Number(r.amount),
    currency: r.currency,
    purpose: r.purpose,
    status: r.status,
    provider: r.provider,
    createdAt: new Date(r.created_at).toISOString(),
    completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null,
  }));

  return { items, total };
}

/**
 * 4. GET CONFIDENTIAL TOKEN DEPOSIT STATUS FOR MOU (SELLER & BUYER VIEW)
 */
export async function getTokenDepositForMOU(
  requester: AuthenticatedUser,
  mouId: string
): Promise<SellerTokenDepositView> {
  checkPaymentRateLimit(requester.id, true);

  const mouRes = await query<any>(
    `SELECT m.*, o.reference_code as opp_ref
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  const mou = mouRes.rows[0];

  // Anti-IDOR Authorization Check: Buyer, Seller, or Admin
  const isBuyer = requester.id === mou.buyer_id;
  const isSeller = requester.id === mou.seller_id;
  const isAdmin = requester.roles.includes("SUPER_ADMIN") || requester.roles.includes("FINANCE");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not authorized to view the token deposit status for this deal.");
  }

  const tokenRes = await query<TokenDepositRecord>(
    `SELECT * FROM token_deposits WHERE mou_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [mouId]
  );

  if (tokenRes.rows.length === 0) {
    throw new NotFoundError("No earnest deposit intent has been created for this Deal Intent MOU yet.");
  }

  const token = tokenRes.rows[0];

  return {
    id: token.id,
    referenceCode: token.reference_code,
    mouReferenceCode: mou.reference_code,
    opportunityReference: mou.opp_ref,
    depositAmount: Number(token.deposit_amount),
    currency: token.currency,
    status: token.status,
    confirmedAt: token.confirmed_at ? new Date(token.confirmed_at).toISOString() : null,
    refundedAt: token.refunded_at ? new Date(token.refunded_at).toISOString() : null,
    createdAt: new Date(token.created_at).toISOString(),
    nonBindingNotice:
      "Earnest token deposit is held in commercial facilitation escrow. Definite disbursement remains subject to definitive Share Purchase/Asset Sale Agreement execution and Due Diligence completion.",
  };
}

/**
 * 5. PROCESS PROVIDER WEBHOOK (HOSTILE PUBLIC ENDPOINT HANDLER)
 * 
 * Strict Invariants:
 * - Signature Verification via provider adapter using constant-time comparison
 * - Replay protection: deduplicates based on (provider, event_id)
 * - Amount & Currency cross-verification against internal payment intent
 * - Row locking (SELECT ... FOR UPDATE) to prevent concurrency races
 * - Append-only ledger update
 */
export async function processProviderWebhook(
  providerName: string,
  rawPayload: string | Buffer,
  signature: string,
  headers?: Record<string, string>,
  context?: { ip?: string; userAgent?: string }
): Promise<{ success: boolean; duplicate?: boolean; status?: string; message: string }> {
  const provider = paymentProviderRegistry.getProvider(providerName);

  // 1. Cryptographic Signature Verification
  const isValid = provider.verifyWebhookSignature(rawPayload, signature, headers);
  if (!isValid) {
    await auditLog({
      action: "WEBHOOK_REJECTED",
      resourceType: "PAYMENT_WEBHOOK",
      resourceId: providerName,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { reason: "INVALID_SIGNATURE", provider: providerName },
    });
    throw new InvalidWebhookError("Webhook signature verification failed.");
  }

  // 2. Parse Event & Payload Hash
  const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
  const payloadHash = crypto.createHash("sha256").update(payloadStr).digest("hex");
  const event = provider.parseWebhookEvent(rawPayload, headers);

  // 3. Replay Protection: Check if event_id has already been processed for this provider
  const existingEventRes = await query<{ id: string; status: string }>(
    `SELECT id, status FROM payment_webhook_events WHERE provider = $1 AND event_id = $2`,
    [provider.name, event.eventId]
  );

  if (existingEventRes.rows.length > 0) {
    await auditLog({
      action: "WEBHOOK_REPLAY",
      resourceType: "PAYMENT_WEBHOOK",
      resourceId: event.eventId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { eventId: event.eventId, provider: provider.name },
    });
    return {
      success: true,
      duplicate: true,
      status: existingEventRes.rows[0].status,
      message: "Webhook event has already been processed (Replay protected).",
    };
  }

  // 4. Find linked Payment Intent
  const intentRes = await query<PaymentIntentRecord>(
    `SELECT * FROM payment_intents 
     WHERE provider_payment_reference = $1 OR reference_code = $1`,
    [event.providerPaymentReference]
  );

  if (intentRes.rows.length === 0) {
    // Record unmatched webhook event safely
    await query(
      `INSERT INTO payment_webhook_events (
        provider, event_id, event_type, payload_hash, raw_payload, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, 'IGNORED', 'Payment reference not found')`,
      [provider.name, event.eventId, event.eventType, payloadHash, JSON.stringify(event.rawPayload)]
    );

    return {
      success: true,
      message: "Webhook event recorded but not linked to active payment intent.",
    };
  }

  const paymentIntent = intentRes.rows[0];

  // 5. Cross-Verification: Amount & Currency Integrity
  if (event.amount !== Number(paymentIntent.amount) || event.currency !== paymentIntent.currency) {
    await query(
      `INSERT INTO payment_webhook_events (
        provider, event_id, event_type, payment_intent_id, payload_hash, raw_payload, status, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, 'REJECTED', $7)`,
      [
        provider.name,
        event.eventId,
        event.eventType,
        paymentIntent.id,
        payloadHash,
        JSON.stringify(event.rawPayload),
        `Amount mismatch: expected ${paymentIntent.amount} ${paymentIntent.currency}, received ${event.amount} ${event.currency}`,
      ]
    );

    await auditLog({
      action: "PAYMENT_AMOUNT_MISMATCH",
      resourceType: "PAYMENT_INTENT",
      resourceId: paymentIntent.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        expectedAmount: Number(paymentIntent.amount),
        expectedCurrency: paymentIntent.currency,
        receivedAmount: event.amount,
        receivedCurrency: event.currency,
      },
    });

    throw new PaymentAmountMismatchError(
      `Webhook payment amount or currency does not match authoritative payment intent.`
    );
  }

  const ledgerRef = await generateLedgerReference();

  // 6. Concurrency-Safe Transactional Execution
  await transaction(async (tx) => {
    // Row-level lock on payment intent
    const lockedRes = await tx.query<PaymentIntentRecord>(
      `SELECT * FROM payment_intents WHERE id = $1 FOR UPDATE`,
      [paymentIntent.id]
    );
    const lockedIntent = lockedRes.rows[0];

    if (event.status === "SUCCEEDED") {
      // Validate state machine transition
      if (
        lockedIntent.status !== "CREATED" &&
        lockedIntent.status !== "REQUIRES_ACTION" &&
        lockedIntent.status !== "PENDING" &&
        lockedIntent.status !== "AUTHORIZED"
      ) {
        if (lockedIntent.status === "SUCCEEDED") {
          // Idempotent duplicate success
          await tx.query(
            `INSERT INTO payment_webhook_events (
              provider, event_id, event_type, payment_intent_id, payload_hash, raw_payload, status
            ) VALUES ($1, $2, $3, $4, $5, $6, 'DUPLICATE')`,
            [provider.name, event.eventId, event.eventType, lockedIntent.id, payloadHash, JSON.stringify(event.rawPayload)]
          );
          return;
        }
        throw new InvalidPaymentStateError(
          `Cannot transition payment to SUCCEEDED. Current status is ${lockedIntent.status}.`
        );
      }

      // 1. Update Payment Intent
      await tx.query(
        `UPDATE payment_intents 
         SET status = 'SUCCEEDED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [lockedIntent.id]
      );

      // 2. Update Token Deposit Intent Record
      await tx.query(
        `UPDATE token_deposits 
         SET status = 'TOKEN_PAYMENT_CONFIRMED', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE payment_intent_id = $1`,
        [lockedIntent.id]
      );

      // 3. Append to Immutable Ledger
      await tx.query(
        `INSERT INTO payment_ledger (
          transaction_reference, payment_intent_id, transaction_type,
          amount, currency, direction, status, provider_reference, provider_event_reference,
          related_opportunity_id, related_mou_id, actor_role, notes
        ) VALUES ($1, $2, 'PAYMENT_SUCCEEDED', $3, $4, 'CREDIT', 'CLEARED', $5, $6, $7, $8, 'SYSTEM', $9)`,
        [
          ledgerRef,
          lockedIntent.id,
          lockedIntent.amount,
          lockedIntent.currency,
          event.providerPaymentReference,
          event.eventId,
          lockedIntent.opportunity_id,
          lockedIntent.mou_id,
          `Verified payment capture via ${provider.name} webhook`,
        ]
      );

      // 4. Record Webhook Event
      await tx.query(
        `INSERT INTO payment_webhook_events (
          provider, event_id, event_type, payment_intent_id, payload_hash, raw_payload, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSED')`,
        [provider.name, event.eventId, event.eventType, lockedIntent.id, payloadHash, JSON.stringify(event.rawPayload)]
      );
    } else if (event.status === "FAILED") {
      // 1. Update Payment Intent
      await tx.query(
        `UPDATE payment_intents 
         SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [lockedIntent.id]
      );

      // 2. Update Token Deposit
      await tx.query(
        `UPDATE token_deposits 
         SET status = 'TOKEN_PAYMENT_FAILED', updated_at = CURRENT_TIMESTAMP 
         WHERE payment_intent_id = $1`,
        [lockedIntent.id]
      );

      // 3. Append to Ledger
      await tx.query(
        `INSERT INTO payment_ledger (
          transaction_reference, payment_intent_id, transaction_type,
          amount, currency, direction, status, provider_reference, provider_event_reference,
          related_opportunity_id, related_mou_id, actor_role, notes
        ) VALUES ($1, $2, 'PAYMENT_FAILED', $3, $4, 'DEBIT', 'FAILED', $5, $6, $7, $8, 'SYSTEM', $9)`,
        [
          ledgerRef,
          lockedIntent.id,
          lockedIntent.amount,
          lockedIntent.currency,
          event.providerPaymentReference,
          event.eventId,
          lockedIntent.opportunity_id,
          lockedIntent.mou_id,
          `Payment failed via ${provider.name} webhook`,
        ]
      );

      // 4. Record Webhook Event
      await tx.query(
        `INSERT INTO payment_webhook_events (
          provider, event_id, event_type, payment_intent_id, payload_hash, raw_payload, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PROCESSED')`,
        [provider.name, event.eventId, event.eventType, lockedIntent.id, payloadHash, JSON.stringify(event.rawPayload)]
      );
    }
  });

  // 7. Audit Logging & Notification (Post-commit)
  if (event.status === "SUCCEEDED") {
    await auditLog({
      action: "PAYMENT_SUCCEEDED",
      resourceType: "PAYMENT_INTENT",
      resourceId: paymentIntent.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        referenceCode: paymentIntent.reference_code,
        provider: provider.name,
        amount: Number(paymentIntent.amount),
        currency: paymentIntent.currency,
        eventId: event.eventId,
      },
    });

    // Fetch counterparty seller to notify both
    const mouRes = await query<{ buyer_id: string; seller_id: string; reference_code: string }>(
      `SELECT buyer_id, seller_id, reference_code FROM deal_mous WHERE id = $1`,
      [paymentIntent.mou_id]
    );

    if (mouRes.rows.length > 0) {
      const deal = mouRes.rows[0];
      // Notify Buyer
      await createNotification({
        userId: deal.buyer_id,
        type: "PAYMENT_CONFIRMED",
        title: "Earnest Deposit Payment Confirmed! 💳",
        message: `Your earnest deposit of ₹${(Number(paymentIntent.amount) / 100000).toFixed(2)} Lakhs for deal ${deal.reference_code} has been successfully verified.`,
        resourceType: "PAYMENT_INTENT",
        resourceId: paymentIntent.id,
      });

      // Notify Seller (Promoter)
      await createNotification({
        userId: deal.seller_id,
        type: "TOKEN_DEPOSIT_CONFIRMED",
        title: "Deal Earnest Deposit Confirmed! 🛡️",
        message: `The prospective buyer has deposited the required transaction earnest deposit for ${deal.reference_code}. Deal room Due Diligence can now be unlocked.`,
        resourceType: "TOKEN_DEPOSIT",
        resourceId: paymentIntent.id,
      });
    }
  }

  return {
    success: true,
    duplicate: false,
    status: event.status,
    message: `Payment webhook successfully processed: ${event.status}`,
  };
}

/**
 * 6. CANCEL PAYMENT INTENT
 */
export async function cancelPaymentIntent(
  initiator: AuthenticatedUser,
  paymentIntentId: string,
  input: CancelPaymentIntentInput,
  context?: { ip?: string; userAgent?: string }
): Promise<PaymentIntentDetailView> {
  checkPaymentRateLimit(initiator.id, false);
  const validated = cancelPaymentIntentSchema.parse(input);

  const intentRes = await query<PaymentIntentRecord>(
    `SELECT * FROM payment_intents WHERE id = $1`,
    [paymentIntentId]
  );

  if (intentRes.rows.length === 0) {
    throw new NotFoundError("Payment intent record not found.");
  }

  const intent = intentRes.rows[0];

  // Anti-IDOR Authorization
  const isPayer = initiator.id === intent.payer_user_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN");

  if (!isPayer && !isAdmin) {
    throw new ForbiddenError("You do not have permission to cancel this payment intent.");
  }

  // State Machine Guard
  if (
    intent.status !== "CREATED" &&
    intent.status !== "REQUIRES_ACTION" &&
    intent.status !== "PENDING"
  ) {
    if (intent.status === "SUCCEEDED") {
      throw new InvalidPaymentStateError(
        "Cannot cancel an already completed payment. Please initiate a refund request instead."
      );
    }
    throw new InvalidPaymentStateError(
      `Cannot cancel payment intent. Current status is ${intent.status}.`
    );
  }

  const ledgerRef = await generateLedgerReference();

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE payment_intents 
       SET status = 'CANCELLED', cancelled_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [intent.id]
    );

    await tx.query(
      `UPDATE token_deposits 
       SET status = 'TOKEN_CANCELLED', updated_at = CURRENT_TIMESTAMP 
       WHERE payment_intent_id = $1`,
      [intent.id]
    );

    await tx.query(
      `INSERT INTO payment_ledger (
        transaction_reference, payment_intent_id, transaction_type,
        amount, currency, direction, status, related_opportunity_id, related_mou_id,
        actor_id, actor_role, notes
      ) VALUES ($1, $2, 'PAYMENT_CANCELLED', $3, $4, 'DEBIT', 'CLEARED', $5, $6, $7, $8, $9)`,
      [
        ledgerRef,
        intent.id,
        intent.amount,
        intent.currency,
        intent.opportunity_id,
        intent.mou_id,
        initiator.id,
        isPayer ? "BUYER" : "ADMIN",
        `Payment intent cancelled: ${validated.reason}`,
      ]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "PAYMENT_CANCELLED",
    resourceType: "PAYMENT_INTENT",
    resourceId: intent.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: intent.reference_code,
      reason: validated.reason,
    },
  });

  return getPaymentIntentById(initiator, intent.id);
}

/**
 * 7. REFUND PAYMENT INTENT
 */
export async function refundPaymentIntent(
  initiator: AuthenticatedUser,
  paymentIntentId: string,
  input: RefundPaymentIntentInput,
  context?: { ip?: string; userAgent?: string }
): Promise<PaymentIntentDetailView> {
  checkPaymentRateLimit(initiator.id, false);
  const validated = refundPaymentIntentSchema.parse(input);

  const intentRes = await query<PaymentIntentRecord>(
    `SELECT * FROM payment_intents WHERE id = $1`,
    [paymentIntentId]
  );

  if (intentRes.rows.length === 0) {
    throw new NotFoundError("Payment intent record not found.");
  }

  const intent = intentRes.rows[0];

  // Anti-IDOR Authorization
  const isPayer = initiator.id === intent.payer_user_id;
  const isAdmin =
    initiator.roles.includes("SUPER_ADMIN") || initiator.roles.includes("FINANCE");

  if (!isPayer && !isAdmin) {
    throw new ForbiddenError("You do not have permission to refund this payment.");
  }

  // State Machine Guard
  if (intent.status !== "SUCCEEDED" && intent.status !== "PARTIALLY_REFUNDED") {
    throw new InvalidPaymentStateError(
      `Cannot refund payment. Payment status must be SUCCEEDED (Current status: ${intent.status}).`
    );
  }

  const totalAmount = Number(intent.amount);
  const alreadyRefunded = Number(intent.refunded_amount || 0);
  const remainingRefundable = totalAmount - alreadyRefunded;

  if (remainingRefundable <= 0) {
    throw new InvalidPaymentStateError("This transaction has already been fully refunded.");
  }

  const requestedRefund = validated.amount ? Number(validated.amount) : remainingRefundable;

  if (requestedRefund > remainingRefundable) {
    throw new ValidationError(
      `Requested refund amount (₹${requestedRefund}) exceeds remaining refundable balance (₹${remainingRefundable}).`
    );
  }

  // Call provider refund
  const provider = paymentProviderRegistry.getProvider(intent.provider);
  const refundResult = await provider.refundPayment({
    providerPaymentReference: intent.provider_payment_reference || intent.reference_code,
    refundAmount: requestedRefund,
    currency: intent.currency,
    reason: validated.reason,
  });

  const newTotalRefunded = alreadyRefunded + requestedRefund;
  const targetStatus: PaymentIntentStatus =
    newTotalRefunded >= totalAmount ? "REFUNDED" : "PARTIALLY_REFUNDED";

  const ledgerRef = await generateLedgerReference();

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE payment_intents 
       SET refunded_amount = $1, status = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [newTotalRefunded, targetStatus, intent.id]
    );

    await tx.query(
      `UPDATE token_deposits 
       SET status = 'TOKEN_REFUNDED', refunded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE payment_intent_id = $1`,
      [intent.id]
    );

    await tx.query(
      `INSERT INTO payment_ledger (
        transaction_reference, payment_intent_id, transaction_type,
        amount, currency, direction, status, provider_reference,
        related_opportunity_id, related_mou_id, actor_id, actor_role, notes
      ) VALUES ($1, $2, 'REFUND_COMPLETED', $3, $4, 'DEBIT', 'CLEARED', $5, $6, $7, $8, $9, $10)`,
      [
        ledgerRef,
        intent.id,
        requestedRefund,
        intent.currency,
        refundResult.providerRefundReference,
        intent.opportunity_id,
        intent.mou_id,
        initiator.id,
        isPayer ? "BUYER" : "FINANCE",
        `Refund processed: ${validated.reason}`,
      ]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "REFUND_SUCCEEDED",
    resourceType: "PAYMENT_INTENT",
    resourceId: intent.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: intent.reference_code,
      refundAmount: requestedRefund,
      totalRefunded: newTotalRefunded,
      status: targetStatus,
      reason: validated.reason,
    },
  });

  await createNotification({
    userId: intent.payer_user_id,
    type: "REFUND_COMPLETED",
    title: "Earnest Deposit Refund Processed",
    message: `A refund of ₹${(requestedRefund / 100000).toFixed(2)} Lakhs has been issued for payment ${intent.reference_code}.`,
    resourceType: "PAYMENT_INTENT",
    resourceId: intent.id,
  });

  return getPaymentIntentById(initiator, intent.id);
}

/**
 * 8. RECONCILE PAYMENT INTENT (AUDIT & INTEGRITY RECOVERY)
 */
export async function reconcilePaymentIntent(
  requester: AuthenticatedUser,
  paymentIntentId: string
): Promise<ReconciliationResultView> {
  const isAdmin =
    requester.roles.includes("SUPER_ADMIN") || requester.roles.includes("FINANCE");

  if (!isAdmin) {
    throw new ForbiddenError("Reconciliation operations are restricted to administrative and finance staff.");
  }

  const intentRes = await query<PaymentIntentRecord>(
    `SELECT * FROM payment_intents WHERE id = $1`,
    [paymentIntentId]
  );

  if (intentRes.rows.length === 0) {
    throw new NotFoundError("Payment intent record not found.");
  }

  const intent = intentRes.rows[0];
  const provider = paymentProviderRegistry.getProvider(intent.provider);

  const providerStatus = await provider.getPaymentStatus(
    intent.provider_payment_reference || intent.reference_code
  );

  const discrepancies: string[] = [];
  let actionTaken: string | null = null;

  // Check currency
  if (providerStatus.currency && providerStatus.currency !== intent.currency) {
    discrepancies.push(
      `Currency mismatch: internal ${intent.currency} vs provider ${providerStatus.currency}`
    );
  }

  // Check state mismatch
  if (
    (intent.status === "CREATED" ||
      intent.status === "PENDING" ||
      intent.status === "REQUIRES_ACTION") &&
    providerStatus.status === "CAPTURED"
  ) {
    discrepancies.push(`Internal status ${intent.status} but provider captured funds.`);
    const ledgerRef = await generateLedgerReference();

    await transaction(async (tx) => {
      await tx.query(
        `UPDATE payment_intents 
         SET status = 'SUCCEEDED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [intent.id]
      );

      await tx.query(
        `UPDATE token_deposits 
         SET status = 'TOKEN_PAYMENT_CONFIRMED', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE payment_intent_id = $1`,
        [intent.id]
      );

      await tx.query(
        `INSERT INTO payment_ledger (
          transaction_reference, payment_intent_id, transaction_type,
          amount, currency, direction, status, provider_reference,
          related_opportunity_id, related_mou_id, actor_id, actor_role, notes
        ) VALUES ($1, $2, 'RECONCILIATION_CORRECTION', $3, $4, 'CREDIT', 'CLEARED', $5, $6, $7, $8, 'FINANCE', $9)`,
        [
          ledgerRef,
          intent.id,
          intent.amount,
          intent.currency,
          intent.provider_payment_reference,
          intent.opportunity_id,
          intent.mou_id,
          requester.id,
          "Reconciliation correction: Captured funds verified with payment provider",
        ]
      );
    });

    actionTaken = "Updated status to SUCCEEDED and appended RECONCILIATION_CORRECTION ledger entry";
  } else if (intent.status === "SUCCEEDED" && providerStatus.status === "FAILED") {
    discrepancies.push("CRITICAL: Internal status SUCCEEDED but provider reports FAILED.");
    actionTaken = "Flagged for manual compliance audit; historical records preserved";
  }

  const matched = discrepancies.length === 0;

  await auditLog({
    actorId: requester.id,
    action: matched ? "PAYMENT_RECONCILED" : "PAYMENT_RECONCILIATION_MISMATCH",
    resourceType: "PAYMENT_INTENT",
    resourceId: intent.id,
    metadata: {
      referenceCode: intent.reference_code,
      internalStatus: intent.status,
      providerStatus: providerStatus.status,
      matched,
      discrepancies,
      actionTaken,
    },
  });

  return {
    paymentIntentId: intent.id,
    referenceCode: intent.reference_code,
    internalStatus: intent.status,
    providerStatus: providerStatus.status,
    amount: Number(intent.amount),
    currency: intent.currency,
    matched,
    discrepancies,
    reconciliationActionTaken: actionTaken,
    reconciledAt: new Date().toISOString(),
  };
}
