// Scale-up India — Phase 11: Payment & Token Architecture Types
// Path: src/types/payment.ts

export type PaymentIntentStatus =
  | "CREATED"
  | "REQUIRES_ACTION"
  | "PENDING"
  | "AUTHORIZED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type PaymentPurpose =
  | "EARNEST_DEPOSIT"
  | "PLATFORM_FEE"
  | "ESCROW_TOKEN";

export type TokenDepositStatus =
  | "TOKEN_INTENT_CREATED"
  | "TOKEN_PAYMENT_PENDING"
  | "TOKEN_PAYMENT_CONFIRMED"
  | "TOKEN_PAYMENT_FAILED"
  | "TOKEN_CANCELLED"
  | "TOKEN_REFUND_PENDING"
  | "TOKEN_REFUNDED";

export type LedgerTransactionType =
  | "PAYMENT_CREATED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_CANCELLED"
  | "REFUND_INITIATED"
  | "REFUND_COMPLETED"
  | "REFUND_FAILED"
  | "RECONCILIATION_CORRECTION";

export type LedgerDirection = "DEBIT" | "CREDIT";

export type LedgerStatus = "RECORDED" | "CLEARED" | "FAILED";

export type WebhookEventStatus =
  | "PROCESSED"
  | "IGNORED"
  | "REJECTED"
  | "FAILED"
  | "DUPLICATE";

export interface PaymentIntentRecord {
  id: string;
  reference_code: string;
  opportunity_id: string;
  mou_id: string;
  payer_user_id: string;
  payer_role: string;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  status: PaymentIntentStatus;
  provider: string;
  provider_payment_reference: string | null;
  idempotency_key: string | null;
  refunded_amount: number;
  metadata: Record<string, any>;
  expires_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenDepositRecord {
  id: string;
  reference_code: string;
  opportunity_id: string;
  mou_id: string;
  buyer_id: string;
  seller_id: string;
  payment_intent_id: string;
  deposit_amount: number;
  currency: string;
  status: TokenDepositStatus;
  confirmed_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentLedgerRecord {
  id: string;
  transaction_reference: string;
  payment_intent_id: string;
  transaction_type: LedgerTransactionType;
  amount: number;
  currency: string;
  direction: LedgerDirection;
  status: LedgerStatus;
  provider_reference: string | null;
  provider_event_reference: string | null;
  related_opportunity_id: string | null;
  related_mou_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  notes: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface PaymentWebhookEventRecord {
  id: string;
  provider: string;
  event_id: string;
  event_type: string;
  payment_intent_id: string | null;
  payload_hash: string;
  raw_payload: Record<string, any>;
  status: WebhookEventStatus;
  error_message: string | null;
  processed_at: string;
  created_at: string;
}

// Client Views
export interface PaymentLedgerItemView {
  transactionReference: string;
  transactionType: LedgerTransactionType;
  amount: number;
  currency: string;
  direction: LedgerDirection;
  status: LedgerStatus;
  createdAt: string;
  notes?: string | null;
}

export interface PaymentIntentDetailView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityTitle?: string;
  opportunityReference?: string;
  mouId: string;
  mouReferenceCode?: string;
  payerUserId: string;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  status: PaymentIntentStatus;
  provider: string;
  providerPaymentReference: string | null;
  refundedAmount: number;
  expiresAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  tokenDeposit?: {
    referenceCode: string;
    depositAmount: number;
    currency: string;
    status: TokenDepositStatus;
    confirmedAt: string | null;
  } | null;
  ledger: PaymentLedgerItemView[];
  clientSecret?: string; // For checkout iframe/modal initialization
}

export interface PaymentIntentListItemView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityTitle?: string;
  opportunityReference?: string;
  mouId: string;
  mouReferenceCode?: string;
  amount: number;
  currency: string;
  purpose: PaymentPurpose;
  status: PaymentIntentStatus;
  provider: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SellerTokenDepositView {
  id: string;
  referenceCode: string;
  mouReferenceCode: string;
  opportunityReference: string;
  depositAmount: number;
  currency: string;
  status: TokenDepositStatus;
  confirmedAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  nonBindingNotice: string;
}

export interface ReconciliationResultView {
  paymentIntentId: string;
  referenceCode: string;
  internalStatus: PaymentIntentStatus;
  providerStatus: string;
  amount: number;
  currency: string;
  matched: boolean;
  discrepancies: string[];
  reconciliationActionTaken: string | null;
  reconciledAt: string;
}
