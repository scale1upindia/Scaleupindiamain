// Scale-up India — Phase 4: Opportunity Domain & Data Masking Types

export const OpportunityStatus = {
  DRAFT: "DRAFT",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  SUBMITTED: "SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  VERIFIED: "VERIFIED",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
  ARCHIVED: "ARCHIVED",
} as const;
export type OpportunityStatus = (typeof OpportunityStatus)[keyof typeof OpportunityStatus];

export const BusinessCategory = {
  MANUFACTURING: "MANUFACTURING",
  SERVICES: "SERVICES",
  TECHNOLOGY: "TECHNOLOGY",
  HEALTHCARE: "HEALTHCARE",
  CONSUMER_RETAIL: "CONSUMER_RETAIL",
  LOGISTICS: "LOGISTICS",
  AGRITECH: "AGRITECH",
  OTHER: "OTHER",
} as const;
export type BusinessCategory = (typeof BusinessCategory)[keyof typeof BusinessCategory];

export const OperatingRegion = {
  PAN_INDIA: "PAN_INDIA",
  NORTH_INDIA: "NORTH_INDIA",
  WEST_INDIA: "WEST_INDIA",
  SOUTH_INDIA: "SOUTH_INDIA",
  EAST_INDIA: "EAST_INDIA",
  CENTRAL_INDIA: "CENTRAL_INDIA",
  GLOBAL: "GLOBAL",
} as const;
export type OperatingRegion = (typeof OperatingRegion)[keyof typeof OperatingRegion];

export const BusinessAgeBracket = {
  LESS_THAN_3_YRS: "LESS_THAN_3_YRS",
  YRS_3_TO_5: "3_TO_5_YRS",
  YRS_5_TO_10: "5_TO_10_YRS",
  YRS_10_TO_20: "10_TO_20_YRS",
  OVER_20_YRS: "OVER_20_YRS",
} as const;
export type BusinessAgeBracket = (typeof BusinessAgeBracket)[keyof typeof BusinessAgeBracket];

export const RevenueBracket = {
  UNDER_5CR: "UNDER_5CR",
  CR_5_TO_15: "5CR_TO_15CR",
  CR_15_TO_25: "15CR_TO_25CR",
  CR_25_TO_50: "25CR_TO_50CR",
  CR_50_TO_100: "50CR_TO_100CR",
  CR_100_TO_250: "100CR_TO_250CR",
  OVER_250CR: "OVER_250CR",
} as const;
export type RevenueBracket = (typeof RevenueBracket)[keyof typeof RevenueBracket];

export const EbitdaMarginBracket = {
  NEGATIVE: "NEGATIVE",
  PCT_0_TO_10: "0_TO_10_PCT",
  PCT_10_TO_20: "10_TO_20_PCT",
  PCT_20_TO_30: "20_TO_30_PCT",
  PCT_OVER_30: "OVER_30_PCT",
} as const;
export type EbitdaMarginBracket =
  | "NEGATIVE"
  | "0_TO_10_PCT"
  | "10_TO_20_PCT"
  | "20_TO_30_PCT"
  | "OVER_30_PCT";

export const AskingPriceBracket = {
  UNDER_10CR: "UNDER_10CR",
  CR_10_TO_25: "10CR_TO_25CR",
  CR_25_TO_50: "25CR_TO_50CR",
  CR_50_TO_100: "50CR_TO_100CR",
  CR_100_TO_250: "100CR_TO_250CR",
  NEGOTIABLE: "NEGOTIABLE",
} as const;
export type AskingPriceBracket =
  | "UNDER_10CR"
  | "10CR_TO_25CR"
  | "25CR_TO_50CR"
  | "50CR_TO_100CR"
  | "100CR_TO_250CR"
  | "NEGOTIABLE";

export const OpportunityTransactionType = {
  FULL_ACQUISITION: "FULL_ACQUISITION",
  MAJORITY_STAKE: "MAJORITY_STAKE",
  MINORITY_STAKE: "MINORITY_STAKE",
  JOINT_VENTURE: "JOINT_VENTURE",
  STRATEGIC_PARTNERSHIP: "STRATEGIC_PARTNERSHIP",
  ASSET_SALE: "ASSET_SALE",
} as const;
export type OpportunityTransactionType =
  (typeof OpportunityTransactionType)[keyof typeof OpportunityTransactionType];

export const BusinessModel = {
  B2B: "B2B",
  B2C: "B2C",
  B2B2C: "B2B2C",
  D2C: "D2C",
  CONTRACT_MANUFACTURING: "CONTRACT_MANUFACTURING",
  SAAS: "SAAS",
  FRANCHISE: "FRANCHISE",
  HYBRID: "HYBRID",
} as const;
export type BusinessModel = (typeof BusinessModel)[keyof typeof BusinessModel];

export const EmployeeRange = {
  EMP_1_TO_10: "1_TO_10",
  EMP_11_TO_50: "11_TO_50",
  EMP_51_TO_200: "51_TO_200",
  EMP_201_TO_500: "201_TO_500",
  EMP_OVER_500: "OVER_500",
} as const;
export type EmployeeRange =
  | "1_TO_10"
  | "11_TO_50"
  | "51_TO_200"
  | "201_TO_500"
  | "OVER_500";

export const GrowthRateBracket = {
  STABLE: "STABLE",
  PCT_10_TO_25: "10_TO_25_PCT",
  PCT_25_TO_50: "25_TO_50_PCT",
  PCT_OVER_50: "OVER_50_PCT",
} as const;
export type GrowthRateBracket =
  | "STABLE"
  | "10_TO_25_PCT"
  | "25_TO_50_PCT"
  | "OVER_50_PCT";

export const OpportunityDocumentType = {
  TEASER_DECK: "TEASER_DECK",
  EXECUTIVE_SUMMARY: "EXECUTIVE_SUMMARY",
  FINANCIAL_MODEL: "FINANCIAL_MODEL",
  STATUTORY_AUDIT: "STATUTORY_AUDIT",
  FACILITY_PICTURES: "FACILITY_PICTURES",
  OTHER: "OTHER",
} as const;
export type OpportunityDocumentType =
  (typeof OpportunityDocumentType)[keyof typeof OpportunityDocumentType];

export const AdminOpportunityReviewAction = {
  START_REVIEW: "START_REVIEW",
  REQUEST_CHANGES: "REQUEST_CHANGES",
  VERIFY: "VERIFY",
  PUBLISH: "PUBLISH",
  UNPUBLISH: "UNPUBLISH",
  REJECT: "REJECT",
  SUSPEND: "SUSPEND",
} as const;
export type AdminOpportunityReviewAction =
  (typeof AdminOpportunityReviewAction)[keyof typeof AdminOpportunityReviewAction];

export type AccessTier = 0 | 1 | 2 | 3;

/**
 * Complete internal record stored in the database
 */
export interface OpportunityRecord {
  id: string;
  referenceCode: string;
  sellerProfileId: string;
  userId: string;
  
  // Public / Teaser Information (Tier 0)
  title: string;
  headline?: string | null;
  teaserSummary: string;
  businessCategory: BusinessCategory;
  industry: string;
  subSector?: string | null;
  operatingRegion: OperatingRegion;
  registeredState: string;
  registeredCity?: string | null;
  approximateAgeBracket: BusinessAgeBracket;
  revenueBracket: RevenueBracket;
  transactionType: OpportunityTransactionType;

  // Authenticated Buyer Information (Tier 1)
  detailedDescription?: string | null;
  businessModel: BusinessModel;
  yearEstablished?: number | null;
  employeeRange?: EmployeeRange | null;
  customerScale?: string | null;
  ebitdaMarginBracket?: EbitdaMarginBracket | null;
  askingPriceBracket?: AskingPriceBracket | null;
  growthRateBracket?: GrowthRateBracket | null;
  facilityDetails?: string | null;
  stakeOfferedPercentage?: number | null;
  promoterRetentionPreference?: string | null;
  reasonForSale?: string | null;
  transactionObjective?: string | null;

  // Confidential Underlying Data (Tier 3 / Staff Review Only)
  exactLegalName?: string | null;
  exactTradeName?: string | null;
  exactCin?: string | null;
  exactGstin?: string | null;
  exactPan?: string | null;
  exactAddress?: string | null;
  exactRevenue?: number | null;
  exactEbitda?: number | null;
  exactAskingPrice?: number | null;

  // Workflow & State Machine
  status: OpportunityStatus;
  rejectionReason?: string | null;
  changesRequestedNotes?: string | null;
  suspensionReason?: string | null;
  assignedReviewerId?: string | null;
  submittedAt?: Date | null;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  publishedAt?: Date | null;
  publishedBy?: string | null;
  suspendedAt?: Date | null;
  suspendedBy?: string | null;
  viewCount: number;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * TIER 0 — Public Blind Teaser (Unauthenticated / Public Search)
 * No legal name, no promoter name, no exact financials, no exact address, no contact info
 */
export interface Tier0Opportunity {
  id: string;
  referenceCode: string;
  tier: 0;
  title: string;
  headline?: string | null;
  teaserSummary: string;
  businessCategory: BusinessCategory;
  industry: string;
  subSector?: string | null;
  operatingRegion: OperatingRegion;
  registeredState: string;
  approximateAgeBracket: BusinessAgeBracket;
  revenueBracket: RevenueBracket;
  transactionType: OpportunityTransactionType;
  status: OpportunityStatus;
  publishedAt?: Date | null;
}

/**
 * TIER 1 — Authenticated Buyer
 * Includes operational parameters, business model, employee range, asking price bracket,
 * but still strictly masks legal name, CIN, GSTIN, promoter identity, exact address, exact accounts, documents
 */
export interface Tier1Opportunity extends Omit<Tier0Opportunity, "tier"> {
  tier: 1;
  detailedDescription?: string | null;
  businessModel: BusinessModel;
  yearEstablished?: number | null;
  employeeRange?: EmployeeRange | null;
  customerScale?: string | null;
  ebitdaMarginBracket?: EbitdaMarginBracket | null;
  askingPriceBracket?: AskingPriceBracket | null;
  growthRateBracket?: GrowthRateBracket | null;
  facilityDetails?: string | null;
  stakeOfferedPercentage?: number | null;
  promoterRetentionPreference?: string | null;
  reasonForSale?: string | null;
  transactionObjective?: string | null;
  // Phase 6: Match-Aware Discovery metadata (for authenticated buyers)
  matchScore?: number | null;
  matchClassification?: string | null;
  isEligible?: boolean | null;
}

/**
 * TIER 2 — Authorized Buyer (Architecture prepared for post-EOI / bilateral consent)
 */
export interface Tier2Opportunity extends Omit<Tier1Opportunity, "tier"> {
  tier: 2;
  registeredCity?: string | null;
  documents?: OpportunityDocumentSummary[];
}

/**
 * TIER 3 — Full Confidential Record (Owner Seller or Authorized Platform Staff Only)
 */
export interface Tier3Opportunity extends Omit<Tier2Opportunity, "tier"> {
  tier: 3;
  exactLegalName?: string | null;
  exactTradeName?: string | null;
  exactCin?: string | null;
  exactGstin?: string | null;
  exactPan?: string | null;
  exactAddress?: string | null;
  exactRevenue?: number | null;
  exactEbitda?: number | null;
  exactAskingPrice?: number | null;
  assignedReviewerId?: string | null;
  rejectionReason?: string | null;
  changesRequestedNotes?: string | null;
  suspensionReason?: string | null;
  verifiedAt?: Date | null;
  verifiedBy?: string | null;
  suspendedAt?: Date | null;
  suspendedBy?: string | null;
}

export interface OpportunityDocumentRecord {
  id: string;
  opportunityId: string;
  sellerProfileId: string;
  ownerId: string;
  documentType: OpportunityDocumentType;
  accessTier: number;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  verificationStatus: string;
  rejectionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OpportunityDocumentSummary {
  id: string;
  opportunityId: string;
  documentType: OpportunityDocumentType;
  accessTier: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  verificationStatus: string;
  createdAt: Date;
}

export interface OpportunityInternalNoteRecord {
  id: string;
  opportunityId: string;
  authorId: string;
  authorName?: string;
  content: string;
  category: "CURATION" | "FINANCIAL" | "LEGAL" | "RISK" | "VALUATION";
  createdAt: Date;
}
