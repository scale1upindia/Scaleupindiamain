// Scale-up India — Phase 10: Deal Intent & Bilateral Memorandum of Understanding (MOU) Types
// Path: src/types/mou.ts

export type MOUStatus =
  | "DRAFT"
  | "PROPOSED"
  | "COUNTERED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN"
  | "EXPIRED";

export type MOUVersionStatus =
  | "DRAFT"
  | "PROPOSED"
  | "COUNTERED"
  | "ACCEPTED"
  | "REJECTED"
  | "SUPERSEDED";

export type ProposedStructure =
  | "FULL_ACQUISITION"
  | "MAJORITY_STAKE"
  | "MINORITY_STAKE"
  | "ASSET_PURCHASE"
  | "JOINT_VENTURE";

export interface DealMOURecord {
  id: string;
  referenceCode: string;
  opportunityId: string;
  eoiId: string;
  ndaId: string;
  conversationId?: string | null;
  buyerId: string;
  sellerId: string;
  createdBy: string;
  currentVersionNumber: number;
  status: MOUStatus;
  validUntil?: string | null;
  lastProposedBy?: string | null;
  lastProposedAt?: string | null;
  acceptedAt?: string | null;
  acceptedByBuyerAt?: string | null;
  acceptedBySellerAt?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  rejectionReason?: string | null;
  withdrawnAt?: string | null;
  withdrawnBy?: string | null;
  withdrawalReason?: string | null;
  expiredAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MOUCommercialTerms {
  proposedValuation: number;
  currency: string;
  proposedStructure: ProposedStructure;
  cashConsideration: number;
  equityConsideration: number;
  earnestDepositAmount: number;
  exclusivityPeriodDays: number;
  dueDiligenceWindowDays: number;
  targetClosingDate?: string | null;
  conditionsPrecedent: string[];
  keyAssumptions?: string | null;
  summaryNotes?: string | null;
  nonBindingDisclaimer: string;
}

export interface MOUVersionRecord extends MOUCommercialTerms {
  id: string;
  mouId: string;
  versionNumber: number;
  proposedBy: string;
  proposedByRole: "BUYER" | "SELLER";
  status: MOUVersionStatus;
  createdAt: string;
}

/**
 * Safe client view for Deal Intent MOU listing
 */
export interface DealMOUListItemView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityTitle: string;
  opportunityReference: string;
  ndaReference: string;
  conversationId?: string | null;
  myRole: "BUYER" | "SELLER" | "ADMIN";
  counterpartyLabel: string;
  status: MOUStatus;
  currentVersionNumber: number;
  proposedValuation: number;
  currency: string;
  proposedStructure: ProposedStructure;
  earnestDepositAmount: number;
  exclusivityPeriodDays: number;
  dueDiligenceWindowDays: number;
  lastProposedByRole: "BUYER" | "SELLER" | "NONE";
  isMyTurnToRespond: boolean;
  validUntil?: string | null;
  acceptedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Detailed view with full version history and terms
 */
export interface DealMOUDetailView extends DealMOUListItemView {
  currentTerms: MOUCommercialTerms;
  versions: MOUVersionView[];
  rejectionReason?: string | null;
  withdrawalReason?: string | null;
  nonBindingDisclaimer: string;
}

/**
 * Version view for audit and negotiation review
 */
export interface MOUVersionView {
  id: string;
  versionNumber: number;
  proposedByRole: "BUYER" | "SELLER";
  status: MOUVersionStatus;
  terms: MOUCommercialTerms;
  createdAt: string;
}
