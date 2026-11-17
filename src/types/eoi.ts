// Scale-up India — Phase 7: Expression of Interest (EOI) Domain Types
// Path: src/types/eoi.ts

export type EOIStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CLARIFICATION_REQUESTED"
  | "ACCEPTED"
  | "DECLINED"
  | "WITHDRAWN"
  | "EXPIRED";

export type EOIInterestType =
  | "FULL_ACQUISITION"
  | "MAJORITY_STAKE"
  | "MINORITY_STAKE"
  | "STRATEGIC_INVESTMENT"
  | "JOINT_VENTURE"
  | "PARTNERSHIP"
  | "OTHER";

export type EOITimeline =
  | "IMMEDIATE_30_DAYS"
  | "1_TO_3_MONTHS"
  | "3_TO_6_MONTHS"
  | "FLEXIBLE";

export type EOIDeclineReason =
  | "VALUATION_MISMATCH"
  | "STRATEGY_MISMATCH"
  | "CAPACITY_CONCERN"
  | "ALREADY_COMMITTED"
  | "NOT_ACCEPTING_OFFERS"
  | "OTHER";

export interface ExpressionOfInterestRecord {
  id: string;
  referenceCode: string;
  opportunityId: string;
  buyerId: string;
  buyerProfileId: string;
  mandateId: string | null;
  sellerId: string;
  sellerProfileId: string;
  status: EOIStatus;
  interestType: EOIInterestType;
  proposedTransactionType: string;
  indicativeOfferRange: string | null;
  investmentTimeline: EOITimeline;
  buyerMessage: string;
  sellerResponseMessage: string | null;
  sellerDeclineReason: EOIDeclineReason | null;
  clarificationQuestions: string | null;
  clarificationAnswers: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  reviewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  expiresAt: string;
}

/**
 * Safe Buyer-facing EOI view (includes masked opportunity summary)
 */
export interface BuyerEOIView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  opportunitySector: string;
  opportunityRegion: string;
  opportunityAskingPrice: string | null;
  opportunityTransactionType: string;
  status: EOIStatus;
  interestType: EOIInterestType;
  proposedTransactionType: string;
  indicativeOfferRange: string | null;
  investmentTimeline: EOITimeline;
  buyerMessage: string;
  sellerResponseMessage: string | null;
  sellerDeclineReason: EOIDeclineReason | null;
  clarificationQuestions: string | null;
  clarificationAnswers: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  expiresAt: string;
}

/**
 * Safe Seller-facing EOI view (Strictly sanitizes and masks proprietary buyer data)
 */
export interface SellerEOIView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  status: EOIStatus;
  
  // Safe Buyer Summary (Zero statutory IDs, zero AUM, zero documents)
  buyerEntityType: string;
  buyerType: string;
  buyerIndustry: string | null;
  buyerLocation: string; // State, Country
  
  // Proposed Deal Parameters
  interestType: EOIInterestType;
  proposedTransactionType: string;
  indicativeOfferRange: string | null;
  investmentTimeline: EOITimeline;
  buyerMessage: string;
  
  // Match Compatibility Badge
  matchScore: number | null;
  matchClassification: string | null;
  
  // Dialogue & Decisions
  sellerResponseMessage: string | null;
  sellerDeclineReason: EOIDeclineReason | null;
  clarificationQuestions: string | null;
  clarificationAnswers: string | null;
  
  submittedAt: string;
  reviewedAt: string | null;
  acceptedAt: string | null;
  declinedAt: string | null;
  withdrawnAt: string | null;
  expiresAt: string;
}

export interface InAppNotificationRecord {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}
