// Scale-up India — Phase 5: Deterministic Matching Engine Weights & Thresholds
// CENTRALIZED CONFIGURATION: No scattered magic numbers.

import { MatchClassification } from "@/types/matching";

export const MATCHING_ALGORITHM_VERSION = "v1.0.0-deterministic";

/**
 * Dimension Scoring Weights (Sum MUST equal 100)
 */
export const MATCHING_WEIGHTS = {
  GEOGRAPHY: 20,           // Regional, State & Pan-India alignment
  REVENUE: 20,             // Turnover scale overlap and bracket compatibility
  INVESTMENT_CAPACITY: 15, // Ticket size vs Asking price capacity
  EBITDA_MARGIN: 15,       // Operational profitability & margin health
  SUB_SECTOR_DEPTH: 10,    // Niche sub-sector and specialization match
  BUSINESS_MODEL: 10,      // Commercial business model alignment (B2B, SaaS, etc.)
  OPERATIONAL_SCALE: 10,   // Workforce headcount & vintage/track record
} as const;

/**
 * Score Classification Boundaries
 */
export const CLASSIFICATION_THRESHOLDS = {
  EXCELLENT_MIN: 90,
  STRONG_MIN: 75,
  POTENTIAL_MIN: 60,
  WEAK_MIN: 40,
} as const;

/**
 * Deterministically maps an integer score (0–100) to its MatchClassification
 */
export function classifyScore(score: number): MatchClassification {
  if (score >= CLASSIFICATION_THRESHOLDS.EXCELLENT_MIN) {
    return MatchClassification.EXCELLENT_MATCH;
  }
  if (score >= CLASSIFICATION_THRESHOLDS.STRONG_MIN) {
    return MatchClassification.STRONG_MATCH;
  }
  if (score >= CLASSIFICATION_THRESHOLDS.POTENTIAL_MIN) {
    return MatchClassification.POTENTIAL_MATCH;
  }
  if (score >= CLASSIFICATION_THRESHOLDS.WEAK_MIN) {
    return MatchClassification.WEAK_MATCH;
  }
  return MatchClassification.POOR_MATCH;
}
