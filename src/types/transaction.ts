// Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine Types
// Path: src/types/transaction.ts

export type TransactionType = "SHARE_ACQUISITION" | "ASSET_ACQUISITION" | "BUSINESS_TRANSFER";

export type TransactionStatus =
  | "ELIGIBLE"
  | "INITIATED"
  | "TERMS_FINALIZATION"
  | "CLOSING_CONDITIONS"
  | "DOCUMENTS_PENDING"
  | "READY_FOR_CLOSING"
  | "CLOSING_IN_PROGRESS"
  | "CLOSED"
  | "CANCELLED"
  | "TERMINATED"
  | "FAILED_TO_CLOSE";

export type TransactionVersionStatus = "DRAFT" | "SUBMITTED" | "FROZEN" | "SUPERSEDED" | "CLOSED";

export type PaymentStructure = "FULL_ESCROW" | "TRANCHE_BASED" | "LUMP_SUM_AT_CLOSING";

export type TokenDepositTreatment =
  | "CREDITED_TOWARD_CONSIDERATION"
  | "REFUNDED_TO_BUYER"
  | "RELEASED_TO_SELLER";

export type TransactionConditionType =
  | "NDA_EXECUTED"
  | "MOU_ACCEPTED"
  | "TOKEN_DEPOSIT_CONFIRMED"
  | "DUE_DILIGENCE_APPROVED"
  | "VALUATION_APPROVED"
  | "TRANSACTION_AGREEMENT_SIGNED"
  | "BOARD_RESOLUTIONS_UPLOADED"
  | "REGULATORY_NOC_FILED"
  | "ESCROW_SETTLEMENT_CONFIRMED"
  | "CLOSING_CERTIFICATE_EXECUTED";

export type ConditionStatus = "PENDING" | "SATISFIED" | "WAIVED" | "FAILED" | "BLOCKED";

export type ConditionResponsibleParty = "BUYER" | "SELLER" | "PLATFORM" | "BOTH";

export type TransactionDocumentType =
  | "FINAL_TRANSACTION_AGREEMENT"
  | "BOARD_RESOLUTION"
  | "CLOSING_CERTIFICATE"
  | "REGULATORY_APPROVAL"
  | "SETTLEMENT_RECEIPT"
  | "TRANSFER_DOCUMENT"
  | "OTHER_CLOSING_EVIDENCE";

export type DocumentSigningStatus =
  | "NOT_REQUIRED"
  | "PENDING_SIGNATURE"
  | "SIGNATURE_RECORDED"
  | "VERIFIED";

export interface TransactionRecord {
  id: string;
  reference_code: string;
  opportunity_id: string;
  buyer_id: string;
  seller_id: string;
  mou_id: string;
  nda_id: string;
  token_deposit_id: string | null;
  payment_intent_id: string | null;
  diligence_case_id: string;
  valuation_case_id: string;
  valuation_version_id: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  agreed_amount: number | string;
  currency: string;
  payment_structure: PaymentStructure;
  token_deposit_treatment: TokenDepositTreatment;
  target_closing_date: Date | string | null;
  governing_law: string;
  dispute_resolution: string;
  current_version_number: number;
  buyer_confirmed: boolean;
  buyer_confirmed_at: Date | string | null;
  seller_confirmed: boolean;
  seller_confirmed_at: Date | string | null;
  reviewer_approved: boolean;
  reviewer_approved_at: Date | string | null;
  reviewer_id: string | null;
  buyer_notes: string | null;
  seller_notes: string | null;
  reviewer_notes: string | null;
  closed_at: Date | string | null;
  closed_by: string | null;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TransactionVersionRecord {
  id: string;
  transaction_id: string;
  version_number: number;
  transaction_type: TransactionType;
  agreed_amount: number | string;
  currency: string;
  payment_structure: PaymentStructure;
  token_deposit_treatment: TokenDepositTreatment;
  valuation_case_id: string;
  valuation_version_id: string;
  target_closing_date: Date | string | null;
  governing_law: string | null;
  dispute_resolution: string | null;
  special_conditions: string | null;
  status: TransactionVersionStatus;
  buyer_confirmed: boolean;
  buyer_confirmed_at: Date | string | null;
  seller_confirmed: boolean;
  seller_confirmed_at: Date | string | null;
  reviewer_approved: boolean;
  reviewer_approved_at: Date | string | null;
  created_by: string;
  created_at: Date | string;
}

export interface TransactionConditionRecord {
  id: string;
  transaction_id: string;
  condition_type: TransactionConditionType | string;
  title: string;
  description: string | null;
  status: ConditionStatus;
  is_mandatory: boolean;
  responsible_party: ConditionResponsibleParty;
  evidence_document_id: string | null;
  verified_by: string | null;
  verified_at: Date | string | null;
  waiver_reason: string | null;
  waived_by: string | null;
  waived_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TransactionDocumentRecord {
  id: string;
  transaction_id: string;
  condition_id: string | null;
  document_type: TransactionDocumentType;
  title: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  sha256_hash: string;
  version_number: number;
  signing_status: DocumentSigningStatus;
  signer_identity: string | null;
  signed_at: Date | string | null;
  signature_reference: string | null;
  uploaded_by: string;
  verified_by: string | null;
  verified_at: Date | string | null;
  created_at: Date | string;
}

export interface TransactionClosingRecord {
  id: string;
  closing_reference: string;
  transaction_id: string;
  version_number: number;
  opportunity_id: string;
  buyer_id: string;
  seller_id: string;
  mou_id: string;
  diligence_case_id: string;
  valuation_case_id: string;
  valuation_version_id: string;
  transaction_type: TransactionType;
  final_consideration: number | string;
  currency: string;
  payment_reference: string | null;
  conditions_snapshot: any;
  document_hashes: any;
  confirmations_snapshot: any;
  audit_reference: string | null;
  closed_by: string;
  closed_at: Date | string;
}

export interface TransactionOverviewView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityTitle?: string;
  opportunityReference?: string;
  buyerId: string;
  sellerId: string;
  mouId: string;
  mouReference?: string;
  ndaId: string;
  diligenceCaseId: string;
  diligenceReference?: string;
  valuationCaseId: string;
  valuationReference?: string;
  valuationVersionId: string;
  transactionType: TransactionType;
  status: TransactionStatus;
  agreedAmount: number;
  currency: string;
  paymentStructure: PaymentStructure;
  tokenDepositTreatment: TokenDepositTreatment;
  targetClosingDate: string | null;
  governingLaw: string;
  disputeResolution: string;
  currentVersionNumber: number;
  buyerConfirmed: boolean;
  buyerConfirmedAt: string | null;
  sellerConfirmed: boolean;
  sellerConfirmedAt: string | null;
  reviewerApproved: boolean;
  reviewerApprovedAt: string | null;
  reviewerId: string | null;
  notes: string | null; // Masked according to role
  userRole: "BUYER" | "SELLER" | "REVIEWER" | "ADMIN";
  closedAt: string | null;
  closedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClosingReadinessView {
  transactionId: string;
  referenceCode: string;
  isReadyForClosing: boolean;
  blockingReasons: string[];
  totalMandatoryConditions: number;
  satisfiedMandatoryConditions: number;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  reviewerApproved: boolean;
  unresolvedDiligenceFindingsCount: number;
}
