# Phase 11: Payment & Token Architecture — Security Gate Report

**Date**: 2026-11-15  
**Phase**: Phase 11 — Payment & Token Architecture  
**Platform**: Scale-up India  
**Status**: **COMPLETED & VERIFIED**  
**Security Gate Result**: **64 / 64 ASSERTIONS PASSED (100%)**  
**Test Suite Result**: **28 / 28 Suites Passed, 343 / 343 Tests Passed (100%)**  
**TypeScript Verification**: **PASS (0 errors)**  
**ESLint Verification**: **PASS (0 errors)**  
**Production Build**: **PASS (73 / 73 routes generated)**  
**Verdict**: **READY_FOR_PHASE_12**

---

## 1. Executive Summary

Phase 11 introduces the **Payment / Token Architecture** for the Scale-up India confidential acquisition platform. Building strictly upon the bilateral Deal Intent MOU framework completed in Phase 10, Phase 11 manages the financial commitment layer: facilitating earnest deposit intents, payment provider gateway abstraction, cryptographic webhook ingestion, append-only immutable ledgers, cancellation, refunding, and automated reconciliation.

Key Architectural Guarantees:
- **MOU Gate Precondition**: Payment intents can ONLY be created for Deal Intent MOUs in `ACCEPTED` state with an underlying bilateral NDA in `EXECUTED` state. Any attempt on draft, proposed, countered, rejected, or withdrawn MOUs is strictly rejected at the domain service level.
- **Authoritative Financial Invariants**: The payable amount is derived directly from the accepted MOU version (`earnest_deposit_amount`). Client attempts to submit altered amounts or unsupported foreign currencies are rejected with `PaymentAmountMismatchError` or `PaymentCurrencyMismatchError`.
- **Zero Fake Payments in Production**: In production mode (`NODE_ENV=production`), the payment provider registry enforces that valid payment gateway credentials (e.g., Razorpay Key ID & Secret) must be configured; simulated test providers are strictly blocked, preventing mock or simulated financial transactions from executing in production.
- **Cryptographic Webhook Ingestion**: Inbound webhooks must carry a valid HMAC SHA-256 signature calculated against the webhook secret. Tampered signatures, altered amounts, or unknown currencies are rejected before financial mutation.
- **Replay Protection**: Webhook deliveries are deduplicated against a relational unique constraint `uq_payment_webhook_provider_event(provider, event_id)`. Replayed events return safe duplicate acknowledgments without mutating financial state or ledger entries.
- **Double-Entry Append-Only Immutable Ledger**: Every financial transaction writes a sequential journal entry to `payment_ledger` with transaction references (`TX-YYYY-10001`), double-entry directions (`CREDIT` into escrow, `DEBIT` on refund), amounts, and audit notes. Direct mutation or deletion of ledger entries is strictly prohibited.
- **Confidentiality & Anti-IDOR**: The prospective seller/promoter views token deposits through `getTokenDepositForMOU`, strictly masking buyer banking details and client secrets, while raw payment intent endpoints (`getPaymentIntentById`) are restricted to the payer (Buyer) or compliance administrators.

---

## 2. Relational Architecture & Database Migrations

### Migration `011_payment_token_architecture.sql`
- **Sequences**:
  - `payment_ref_seq` starting at 10001 (`PI-YYYY-10001`).
  - `token_ref_seq` starting at 10001 (`TOK-YYYY-10001`).
  - `ledger_ref_seq` starting at 10001 (`TX-YYYY-10001`).
- **Table `payment_intents`**:
  - `id`: UUID Primary Key.
  - `reference_code`: Formatted payment intent reference (`PI-YYYY-10001`).
  - `opportunity_id`: UUID Foreign Key to `opportunities(id)` ON DELETE CASCADE.
  - `mou_id`: UUID Foreign Key to `deal_mous(id)` ON DELETE CASCADE.
  - `payer_user_id`: UUID Foreign Key to `users(id)` ON DELETE CASCADE.
  - `payer_role`: Role indicator (`BUYER`).
  - `amount`: Numeric(18, 2) authoritative amount.
  - `currency`: Mandated currency (`INR`).
  - `purpose`: `EARNEST_DEPOSIT`, `PLATFORM_FEE`, `ESCROW_TOKEN`.
  - `status`: State machine status (`CREATED`, `REQUIRES_ACTION`, `PENDING`, `AUTHORIZED`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUND_PENDING`, `REFUNDED`, `PARTIALLY_REFUNDED`).
  - `provider`: Gateway identifier (e.g. `RAZORPAY`, `TEST_SIMULATED`).
  - `provider_payment_reference`: External payment reference.
  - `idempotency_key`: Client-supplied idempotency key.
  - `refunded_amount`: Cumulative refunded amount.
  - `metadata`: JSONB containing operational parameters (zero PII/secrets).
- **Table `token_deposits`**:
  - Tracks the transaction earnest deposit model (`reference_code`, `opportunity_id`, `mou_id`, `buyer_id`, `seller_id`, `payment_intent_id`, `deposit_amount`, `currency`, `status`).
  - Partial Unique Index `idx_token_deposits_active_mou`: Guarantees at most ONE confirmed token deposit per MOU `WHERE status = 'TOKEN_PAYMENT_CONFIRMED'`.
- **Table `payment_ledger`**:
  - Append-only immutable financial journal (`transaction_reference`, `payment_intent_id`, `transaction_type`, `amount`, `currency`, `direction`, `status`, `provider_reference`, `related_opportunity_id`, `related_mou_id`, `actor_id`, `actor_role`, `notes`).
- **Table `payment_webhook_events`**:
  - Inbound webhook audit and deduplication log (`provider`, `event_id`, `event_type`, `payment_intent_id`, `payload_hash`, `raw_payload`, `status`, `error_message`).
  - Unique Constraint `uq_payment_webhook_provider_event(provider, event_id)` enforcing replay protection.
- **RBAC Matrix**:
  - Permissions seeded: `payments.create`, `payments.read_own`, `payments.cancel`, `payments.read_all`, `payments.manage`, `payments.reconcile`.

---

## 3. Finite State Machine (FSM) & Lifecycle

```text
       ┌───────────┐
       │  CREATED  │ (Intent initialized with authoritative earnest deposit)
       └─────┬─────┘
             │
             ├──► cancelPaymentIntent() ──► ┌───────────┐
             │                              │ CANCELLED │ (Terminal)
             │                              └───────────┘
             ├──► [Requires 3D-Secure / OTP] ──► ┌─────────────────┐
             │                                   │ REQUIRES_ACTION │
             │                                   └────────┬────────┘
             ├──► [Gateway Processing] ──► ┌─────────┴┐   │
             │                             │ PENDING  │◄──┘
             │                             └────┬─────┘
             ▼                                  ▼
      [Webhook / Capture Verified]
             ▼
       ┌───────────┐
       │ SUCCEEDED │ (Token deposit confirms; unlocks diligence prerequisites)
       └─────┬─────┘
             │
             ├──► refundPaymentIntent(partial) ──► ┌────────────────────┐
             │                                     │ PARTIALLY_REFUNDED │
             │                                     └─────────┬──────────┘
             │                                               │
             └──► refundPaymentIntent(full) ─────────────────┴──► ┌──────────┐
                                                                  │ REFUNDED │ (Terminal)
                                                                  └──────────┘
```

---

## 4. Security Gate Assertions Breakdown (64 / 64)

| Section | Assertions Passed | Verification Scope |
| :--- | :---: | :--- |
| **1. Migration & Schema** | 5 / 5 | Migration 011 recorded, sequences exist, tables exist, indexes verified, RBAC seeded |
| **2. Production Gateway Guard** | 2 / 2 | Real credentials enforced in production, test simulated provider rejected in production |
| **3. Principals Provisioning** | 1 / 1 | Seller 1, Seller 2, Buyer 1, Buyer 2, Admin verified with role integrity |
| **4. Pipeline Setup** | 1 / 1 | Opportunity published, bilateral NDA executed, MOU accepted with ₹15,00,000 earnest |
| **5. MOU State Gate Preconditions** | 2 / 2 | DRAFT and REJECTED MOUs strictly block payment intent creation with ValidationError |
| **6. Anti-IDOR Authorization** | 2 / 2 | Unauthorized foreign Buyer 2 blocked; Seller blocked from initiating buyer payment |
| **7. Amount & Currency Integrity** | 3 / 3 | Underpayment, overpayment, and non-INR currencies strictly blocked |
| **8. Idempotency Key Invariants** | 5 / 5 | Valid intent created, standard reference PI- generated, duplicate calls return same intent |
| **9. Anti-IDOR Read Restrictions** | 6 / 6 | Foreign buyers/sellers blocked, raw intent hidden from seller, token deposit viewable by counterparty |
| **10. Webhook HMAC & Tamper Defense**| 3 / 3 | Tampered HMAC rejected, mismatched amount payload blocked, valid signature accepted |
| **11. Webhook Replay Protection** | 2 / 2 | Replayed webhook safely deduplicated, exactly 1 record stored in database |
| **12. State Machine & Token Sync** | 6 / 6 | Intent transitions to SUCCEEDED, token confirms, cannot cancel succeeded payment |
| **13. Cancellation Workflow** | 2 / 2 | Active intent cancelled by buyer, cannot refund a cancelled payment |
| **14. Authorized Refund Workflow** | 3 / 3 | Seller cannot refund, Admin executes full refund, token deposit updated to TOKEN_REFUNDED |
| **15. Append-Only Immutable Ledger** | 6 / 6 | >= 3 entries, PAYMENT_CREATED, PAYMENT_SUCCEEDED, REFUND_COMPLETED, double-entry directions |
| **16. Payment Reconciliation Engine** | 4 / 4 | Status mismatch detected, auto-healed to SUCCEEDED, correction logged, second run in harmony |
| **17. Zero Data Leakage** | 5 / 5 | No secrets/card numbers/CVV/OTP exposed to seller or database metadata |
| **18. Audit Logging & Notifications**| 6 / 6 | Audit records created for all actions, in-app notifications delivered to buyer and seller |
| **Total** | **64 / 64** | **100% PASS RATE** |

---

## 5. Verification Commands & Outputs

```bash
# 1. Security Gate Execution
npx tsx scripts/phase11_security_gate.ts
# Result: PHASE 11 SECURITY GATE COMPLETE: 64/64 ASSERTIONS PASSED (Exit code: 0)

# 2. Payment Integration Tests
npx vitest run tests/payment_workflow.test.ts
# Result: 1 passed (1), 23 passed (23) (Exit code: 0)

# 3. Full Project Test Regression Suite
npx vitest run
# Result: 28 passed (28), 343 passed (343) (Exit code: 0)

# 4. TypeScript Strict Compilation
npx tsc --noEmit
# Result: 0 errors (Exit code: 0)

# 5. ESLint Code Quality
npm run lint
# Result: 0 errors (Exit code: 0)

# 6. Next.js Production Build
npm run build
# Result: 73 static and dynamic routes generated successfully (Exit code: 0)
```

---

## 6. Phase 11 Verdict

```text
=================================================================
>>> PHASE 11 FINAL VERDICT: READY_FOR_PHASE_12 <<<
=================================================================
```
