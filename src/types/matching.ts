// Scale-up India — Phase 5: Deterministic Matching Engine Types

import {
  Tier0Opportunity,
  Tier1Opportunity,
  Tier2Opportunity,
  Tier3Opportunity,
} from "./opportunity";

export const MatchClassification = {
  EXCELLENT_MATCH: "EXCELLENT_MATCH",
  STRONG_MATCH: "STRONG_MATCH",
  POTENTIAL_MATCH: "POTENTIAL_MATCH",
  WEAK_MATCH: "WEAK_MATCH",
  POOR_MATCH: "POOR_MATCH",
} as const;
export type MatchClassification =
  (typeof MatchClassification)[keyof typeof MatchClassification];

export interface MatchDimensionScore {
  dimension: string;
  weight: number;
  score: number;
  maxScore: number;
  matched: boolean;
  reason: string;
}

export interface MatchResult {
  opportunityId: string;
  mandateId: string;
  buyerProfileId: string;
  buyerId: string;
  isEligible: boolean;
  score: number;
  classification: MatchClassification;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  blockingCriteria: string[];
  reasons: string[];
  dimensionScores: Record<string, MatchDimensionScore>;
  matchingVersion: string;
  evaluatedAt: Date;
}

export interface BuyerOpportunityMatchRecord {
  id: string;
  buyerId: string;
  buyerProfileId: string;
  mandateId: string;
  opportunityId: string;
  isEligible: boolean;
  score: number;
  classification: MatchClassification;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  blockingCriteria: string[];
  reasons: string[];
  matchingVersion: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public/Buyer-Facing Match Teaser
 * STRICT SECURITY INVARIANT: The attached opportunity is ALWAYS passed through progressive
 * server-side masking. It NEVER discloses statutory or sealed seller identities.
 */
export interface BuyerMatchItem {
  id: string;
  mandateId: string;
  mandateName: string;
  opportunityId: string;
  score: number;
  classification: MatchClassification;
  isEligible: boolean;
  matchedCriteria: string[];
  unmatchedCriteria: string[];
  blockingCriteria: string[];
  reasons: string[];
  matchingVersion: string;
  createdAt: Date;
  opportunity:
    | Tier0Opportunity
    | Tier1Opportunity
    | Tier2Opportunity
    | Tier3Opportunity;
}

export interface BuyerMatchListResult {
  items: BuyerMatchItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MatchFilterInput {
  mandateId?: string;
  classification?: MatchClassification;
  industry?: string;
  minScore?: number;
  isEligibleOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: "score" | "createdAt";
  sortOrder?: "asc" | "desc";
}
