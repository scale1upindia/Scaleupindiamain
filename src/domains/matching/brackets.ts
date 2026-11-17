// Scale-up India — Phase 5: Bracket Mappings & Numeric Range Overlap Math

import {
  RevenueBracket,
  AskingPriceBracket,
  EmployeeRange,
  BusinessAgeBracket,
} from "@/types/opportunity";

export interface NumericRange {
  min: number;
  max: number;
}

export const REVENUE_BRACKET_RANGES: Record<RevenueBracket, NumericRange> = {
  UNDER_5CR: { min: 0, max: 50_000_000 },
  "5CR_TO_15CR": { min: 50_000_000, max: 150_000_000 },
  "15CR_TO_25CR": { min: 150_000_000, max: 250_000_000 },
  "25CR_TO_50CR": { min: 250_000_000, max: 500_000_000 },
  "50CR_TO_100CR": { min: 500_000_000, max: 1_000_000_000 },
  "100CR_TO_250CR": { min: 1_000_000_000, max: 2_500_000_000 },
  OVER_250CR: { min: 2_500_000_000, max: 10_000_000_000 },
};

export const ASKING_PRICE_BRACKET_RANGES: Record<string, NumericRange | null> = {
  UNDER_10CR: { min: 0, max: 100_000_000 },
  "10CR_TO_25CR": { min: 100_000_000, max: 250_000_000 },
  "25CR_TO_50CR": { min: 250_000_000, max: 500_000_000 },
  "50CR_TO_100CR": { min: 500_000_000, max: 1_000_000_000 },
  "100CR_TO_250CR": { min: 1_000_000_000, max: 2_500_000_000 },
  NEGOTIABLE: null,
};

export const EMPLOYEE_RANGES: Record<string, NumericRange> = {
  "1_TO_10": { min: 1, max: 10 },
  "11_TO_50": { min: 11, max: 50 },
  "51_TO_200": { min: 51, max: 200 },
  "201_TO_500": { min: 201, max: 500 },
  OVER_500: { min: 501, max: 10_000 },
};

export const BUSINESS_AGE_RANGES: Record<string, NumericRange> = {
  LESS_THAN_3_YRS: { min: 0, max: 3 },
  "3_TO_5_YRS": { min: 3, max: 5 },
  "5_TO_10_YRS": { min: 5, max: 10 },
  "10_TO_20_YRS": { min: 10, max: 20 },
  OVER_20_YRS: { min: 20, max: 100 },
};

/**
 * Calculates the overlap percentage between two ranges [minA, maxA] and [minB, maxB]
 * Returns a value between 0.0 (no overlap) and 1.0 (full overlap or enclosure)
 */
export function calculateRangeOverlap(
  rangeA: NumericRange,
  rangeB: NumericRange
): { overlapRatio: number; isContained: boolean; isDisjoint: boolean } {
  const overlapMin = Math.max(rangeA.min, rangeB.min);
  const overlapMax = Math.min(rangeA.max, rangeB.max);

  if (overlapMin > overlapMax) {
    return { overlapRatio: 0, isContained: false, isDisjoint: true };
  }

  const overlapLength = overlapMax - overlapMin;
  const lengthA = rangeA.max - rangeA.min || 1;
  const lengthB = rangeB.max - rangeB.min || 1;

  // Is range A completely contained inside range B?
  const isContained = rangeA.min >= rangeB.min && rangeA.max <= rangeB.max;

  // Overlap ratio relative to the target range A
  const overlapRatio = Math.min(1.0, overlapLength / Math.min(lengthA, lengthB));

  return { overlapRatio, isContained, isDisjoint: false };
}
