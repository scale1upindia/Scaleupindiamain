// Scale-up India — Phase 5: Deterministic Match Evaluator
// Pure, deterministic function: (Mandate, Opportunity) -> MatchResult
// STRICT SECURITY INVARIANT: No black-box AI/LLM, no random scores, no sensitive data leakage.

import { AcquisitionMandateRecord } from "@/types/buyer";
import { OpportunityRecord, OpportunityStatus } from "@/types/opportunity";
import {
  MatchResult,
  MatchDimensionScore,
  MatchClassification,
} from "@/types/matching";
import {
  MATCHING_WEIGHTS,
  MATCHING_ALGORITHM_VERSION,
  classifyScore,
} from "./weights";
import {
  REVENUE_BRACKET_RANGES,
  ASKING_PRICE_BRACKET_RANGES,
  EMPLOYEE_RANGES,
  calculateRangeOverlap,
} from "./brackets";

export function evaluateOpportunityMatch(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord,
  buyerContext?: { buyerId?: string; buyerProfileId?: string }
): MatchResult {
  const buyerId = buyerContext?.buyerId || "";
  const buyerProfileId = buyerContext?.buyerProfileId || mandate.buyerProfileId;

  const matchedCriteria: string[] = [];
  const unmatchedCriteria: string[] = [];
  const blockingCriteria: string[] = [];
  const reasons: string[] = [];
  const dimensionScores: Record<string, MatchDimensionScore> = {};

  // =========================================================================
  // 1. HARD GATES (BINARY FEASIBILITY)
  // =========================================================================

  // Hard Gate 1: Opportunity Publication Status
  if (opportunity.status !== OpportunityStatus.PUBLISHED) {
    blockingCriteria.push("OPPORTUNITY_NOT_PUBLISHED");
    reasons.push("Opportunity is not in active published status");
    return createBlockedResult(
      opportunity.id,
      mandate.id,
      buyerProfileId,
      buyerId,
      blockingCriteria,
      reasons
    );
  }

  // Hard Gate 2: Industry Alignment
  const targetIndustries = mandate.targetIndustries || [];
  if (targetIndustries.length > 0) {
    const oppIndustryLower = opportunity.industry.toLowerCase().trim();
    const oppCategoryLower = opportunity.businessCategory.toLowerCase().trim();

    const industryMatch = targetIndustries.some((ti) => {
      const targetLower = ti.industry.toLowerCase().trim();
      return (
        oppIndustryLower === targetLower ||
        oppIndustryLower.includes(targetLower) ||
        targetLower.includes(oppIndustryLower) ||
        oppCategoryLower === targetLower
      );
    });

    if (!industryMatch) {
      blockingCriteria.push("INDUSTRY_MISMATCH");
      reasons.push(
        `Business industry [${opportunity.industry}] does not align with mandate target industries`
      );
      return createBlockedResult(
        opportunity.id,
        mandate.id,
        buyerProfileId,
        buyerId,
        blockingCriteria,
        reasons
      );
    }
  }

  // Hard Gate 3: Transaction Type Alignment
  const mandateTxTypes = mandate.transactionTypes || [];
  if (mandateTxTypes.length > 0) {
    const txMatch = mandateTxTypes.includes(opportunity.transactionType as any);
    if (!txMatch) {
      blockingCriteria.push("TRANSACTION_TYPE_MISMATCH");
      reasons.push(
        `Deal structure [${opportunity.transactionType}] is not accepted under buyer mandate preferences`
      );
      return createBlockedResult(
        opportunity.id,
        mandate.id,
        buyerProfileId,
        buyerId,
        blockingCriteria,
        reasons
      );
    }
  }

  // Hard Gate 4: Profitability / Distress Requirement
  if (
    mandate.profitableBusinessesOnly &&
    opportunity.ebitdaMarginBracket === "NEGATIVE"
  ) {
    blockingCriteria.push("UNPROFITABLE_BUSINESS");
    reasons.push(
      "Mandate requires profitable businesses only; target business reports negative operating margin"
    );
    return createBlockedResult(
      opportunity.id,
      mandate.id,
      buyerProfileId,
      buyerId,
      blockingCriteria,
      reasons
    );
  }

  // Hard Gate 5: Capital Ceiling Overrun (> 100% overrun)
  const askingPriceRange = opportunity.askingPriceBracket
    ? ASKING_PRICE_BRACKET_RANGES[opportunity.askingPriceBracket]
    : null;
  if (
    askingPriceRange &&
    mandate.maxInvestment > 0 &&
    askingPriceRange.min > mandate.maxInvestment * 2.0
  ) {
    blockingCriteria.push("CAPITAL_CAPACITY_EXCEEDED");
    reasons.push(
      "Minimum valuation expectations exceed buyer maximum allocated acquisition capital"
    );
    return createBlockedResult(
      opportunity.id,
      mandate.id,
      buyerProfileId,
      buyerId,
      blockingCriteria,
      reasons
    );
  }

  // All Hard Gates Passed!
  matchedCriteria.push("HARD_CONSTRAINTS_SATISFIED");

  // =========================================================================
  // 2. SOFT PREFERENCE SCORING (WEIGHTED SUM = 100)
  // =========================================================================

  // Dimension 1: Geographic Alignment (20%)
  const geoResult = evaluateGeography(mandate, opportunity);
  dimensionScores["GEOGRAPHY"] = geoResult;
  reasons.push(geoResult.reason);
  if (geoResult.matched) {
    matchedCriteria.push("GEOGRAPHY_MATCH");
  } else {
    unmatchedCriteria.push("GEOGRAPHY_VARIANCE");
  }

  // Dimension 2: Revenue Scale Compatibility (20%)
  const revResult = evaluateRevenue(mandate, opportunity);
  dimensionScores["REVENUE"] = revResult;
  reasons.push(revResult.reason);
  if (revResult.matched) {
    matchedCriteria.push("REVENUE_SCALE_MATCH");
  } else {
    unmatchedCriteria.push("REVENUE_SCALE_VARIANCE");
  }

  // Dimension 3: Investment / Ticket Size Compatibility (15%)
  const invResult = evaluateInvestmentCapacity(mandate, opportunity);
  dimensionScores["INVESTMENT_CAPACITY"] = invResult;
  reasons.push(invResult.reason);
  if (invResult.matched) {
    matchedCriteria.push("INVESTMENT_CAPACITY_MATCH");
  } else {
    unmatchedCriteria.push("VALUATION_VARIANCE");
  }

  // Dimension 4: EBITDA & Margin Quality (15%)
  const ebitdaResult = evaluateEbitdaMargin(opportunity);
  dimensionScores["EBITDA_MARGIN"] = ebitdaResult;
  reasons.push(ebitdaResult.reason);
  if (ebitdaResult.matched) {
    matchedCriteria.push("PROFITABILITY_MARGIN_MATCH");
  } else {
    unmatchedCriteria.push("MARGIN_VARIANCE");
  }

  // Dimension 5: Sub-Sector Depth (10%)
  const subSectorResult = evaluateSubSector(mandate, opportunity);
  dimensionScores["SUB_SECTOR_DEPTH"] = subSectorResult;
  reasons.push(subSectorResult.reason);
  if (subSectorResult.matched) {
    matchedCriteria.push("SUB_SECTOR_SPECIALIZATION_MATCH");
  } else {
    unmatchedCriteria.push("SUB_SECTOR_GENERAL_FIT");
  }

  // Dimension 6: Commercial Business Model (10%)
  const modelResult = evaluateBusinessModel(opportunity);
  dimensionScores["BUSINESS_MODEL"] = modelResult;
  reasons.push(modelResult.reason);
  if (modelResult.matched) {
    matchedCriteria.push("BUSINESS_MODEL_MATCH");
  } else {
    unmatchedCriteria.push("BUSINESS_MODEL_VARIANCE");
  }

  // Dimension 7: Operational Scale & Track Record (10%)
  const scaleResult = evaluateOperationalScale(mandate, opportunity);
  dimensionScores["OPERATIONAL_SCALE"] = scaleResult;
  reasons.push(scaleResult.reason);
  if (scaleResult.matched) {
    matchedCriteria.push("OPERATIONAL_SCALE_MATCH");
  } else {
    unmatchedCriteria.push("SCALE_VARIANCE");
  }

  // Sum total score
  const rawScore =
    geoResult.score +
    revResult.score +
    invResult.score +
    ebitdaResult.score +
    subSectorResult.score +
    modelResult.score +
    scaleResult.score;

  const totalScore = Math.min(100, Math.max(0, Math.round(rawScore)));
  const classification = classifyScore(totalScore);

  return {
    opportunityId: opportunity.id,
    mandateId: mandate.id,
    buyerProfileId,
    buyerId,
    isEligible: true,
    score: totalScore,
    classification,
    matchedCriteria,
    unmatchedCriteria,
    blockingCriteria: [],
    reasons,
    dimensionScores,
    matchingVersion: MATCHING_ALGORITHM_VERSION,
    evaluatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Helper Evaluation Functions
// ---------------------------------------------------------------------------

function evaluateGeography(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.GEOGRAPHY;
  const targetGeographies = mandate.targetGeographies || [];

  if (targetGeographies.length === 0) {
    return {
      dimension: "GEOGRAPHY",
      weight: maxScore,
      score: maxScore,
      maxScore,
      matched: true,
      reason: "Buyer mandate is geography-flexible (Pan-India)",
    };
  }

  // Check Pan-India / Global universal coverage
  const hasUniversal = targetGeographies.some(
    (g) => g.region === "PAN_INDIA" || g.region === "GLOBAL"
  );
  if (hasUniversal) {
    return {
      dimension: "GEOGRAPHY",
      weight: maxScore,
      score: maxScore,
      maxScore,
      matched: true,
      reason: "Target geography matches national acquisition criteria (Pan-India)",
    };
  }

  // Check specific state match
  const stateMatch = targetGeographies.some(
    (g) =>
      Array.isArray(g.states) &&
      g.states.some(
        (s) => s.toLowerCase() === opportunity.registeredState.toLowerCase()
      )
  );
  if (stateMatch) {
    return {
      dimension: "GEOGRAPHY",
      weight: maxScore,
      score: maxScore,
      maxScore,
      matched: true,
      reason: `Registered state [${opportunity.registeredState}] matches buyer priority location`,
    };
  }

  // Check regional match
  const regionMatch = targetGeographies.some(
    (g) => g.region === opportunity.operatingRegion
  );
  if (regionMatch) {
    return {
      dimension: "GEOGRAPHY",
      weight: maxScore,
      score: 16,
      maxScore,
      matched: true,
      reason: `Operating region [${opportunity.operatingRegion}] matches target mandate geography`,
    };
  }

  return {
    dimension: "GEOGRAPHY",
    weight: maxScore,
    score: 4,
    maxScore,
    matched: false,
    reason: `Operating region [${opportunity.operatingRegion}] is outside primary geographic preference`,
  };
}

function evaluateRevenue(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.REVENUE;
  const oppRange = REVENUE_BRACKET_RANGES[opportunity.revenueBracket];

  if (!oppRange) {
    return {
      dimension: "REVENUE",
      weight: maxScore,
      score: 10,
      maxScore,
      matched: true,
      reason: "Turnover bracket evaluated under standard commercial scope",
    };
  }

  const buyerRange = {
    min: mandate.revenueMin || 0,
    max: mandate.revenueMax || 10_000_000_000,
  };

  const { overlapRatio, isContained, isDisjoint } = calculateRangeOverlap(
    oppRange,
    buyerRange
  );

  if (isContained || overlapRatio >= 0.75) {
    return {
      dimension: "REVENUE",
      weight: maxScore,
      score: maxScore,
      maxScore,
      matched: true,
      reason: `Annual revenue bracket [${opportunity.revenueBracket}] falls squarely within buyer acquisition mandate`,
    };
  }

  if (overlapRatio >= 0.3) {
    return {
      dimension: "REVENUE",
      weight: maxScore,
      score: 15,
      maxScore,
      matched: true,
      reason: `Annual revenue bracket [${opportunity.revenueBracket}] substantially overlaps target turnover range`,
    };
  }

  if (!isDisjoint) {
    return {
      dimension: "REVENUE",
      weight: maxScore,
      score: 8,
      maxScore,
      matched: false,
      reason: `Annual revenue is within acceptable tolerance margin of mandate`,
    };
  }

  return {
    dimension: "REVENUE",
    weight: maxScore,
    score: 0,
    maxScore,
    matched: false,
    reason: `Business turnover bracket [${opportunity.revenueBracket}] is outside buyer preferred scale`,
  };
}

function evaluateInvestmentCapacity(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.INVESTMENT_CAPACITY;

  if (opportunity.askingPriceBracket === "NEGOTIABLE") {
    return {
      dimension: "INVESTMENT_CAPACITY",
      weight: maxScore,
      score: 13,
      maxScore,
      matched: true,
      reason: "Valuation expectations are flexible and negotiable",
    };
  }

  const askRange = opportunity.askingPriceBracket
    ? ASKING_PRICE_BRACKET_RANGES[opportunity.askingPriceBracket]
    : null;

  if (!askRange) {
    return {
      dimension: "INVESTMENT_CAPACITY",
      weight: maxScore,
      score: 8,
      maxScore,
      matched: true,
      reason: "Valuation parameter is flexible under mutual negotiation",
    };
  }

  // Preferred ticket size exact containment
  if (
    mandate.preferredTicketSize &&
    askRange.min <= mandate.preferredTicketSize &&
    askRange.max >= mandate.preferredTicketSize
  ) {
    return {
      dimension: "INVESTMENT_CAPACITY",
      weight: maxScore,
      score: maxScore,
      maxScore,
      matched: true,
      reason: "Asking price bracket matches buyer optimal ticket size",
    };
  }

  // Contained within minInvestment to maxInvestment
  const { overlapRatio, isDisjoint } = calculateRangeOverlap(askRange, {
    min: mandate.minInvestment,
    max: mandate.maxInvestment,
  });

  if (overlapRatio >= 0.5) {
    return {
      dimension: "INVESTMENT_CAPACITY",
      weight: maxScore,
      score: 12,
      maxScore,
      matched: true,
      reason: "Valuation expectations fall within committed capital capacity",
    };
  }

  if (!isDisjoint || askRange.min <= mandate.maxInvestment * 1.3) {
    return {
      dimension: "INVESTMENT_CAPACITY",
      weight: maxScore,
      score: 6,
      maxScore,
      matched: false,
      reason: "Valuation bracket requires capital syndication or flexible staging",
    };
  }

  return {
    dimension: "INVESTMENT_CAPACITY",
    weight: maxScore,
    score: 0,
    maxScore,
    matched: false,
    reason: "Valuation expectations exceed buyer stated capital allocation",
  };
}

function evaluateEbitdaMargin(
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.EBITDA_MARGIN;
  const bracket = opportunity.ebitdaMarginBracket;

  if (bracket === "OVER_30_PCT") {
    return {
      dimension: "EBITDA_MARGIN",
      weight: maxScore,
      score: 15,
      maxScore,
      matched: true,
      reason: "Superior operating profitability (EBITDA margin > 30%)",
    };
  }
  if (bracket === "20_TO_30_PCT") {
    return {
      dimension: "EBITDA_MARGIN",
      weight: maxScore,
      score: 13,
      maxScore,
      matched: true,
      reason: "Strong operating profitability (EBITDA margin 20% to 30%)",
    };
  }
  if (bracket === "10_TO_20_PCT") {
    return {
      dimension: "EBITDA_MARGIN",
      weight: maxScore,
      score: 10,
      maxScore,
      matched: true,
      reason: "Healthy industry EBITDA margin (10% to 20%)",
    };
  }
  if (bracket === "0_TO_10_PCT") {
    return {
      dimension: "EBITDA_MARGIN",
      weight: maxScore,
      score: 5,
      maxScore,
      matched: false,
      reason: "Moderate operating profitability (EBITDA margin under 10%)",
    };
  }
  if (bracket === "NEGATIVE") {
    return {
      dimension: "EBITDA_MARGIN",
      weight: maxScore,
      score: 0,
      maxScore,
      matched: false,
      reason: "Turnaround profile with negative operating margin",
    };
  }

  return {
    dimension: "EBITDA_MARGIN",
    weight: maxScore,
    score: 8,
    maxScore,
    matched: true,
    reason: "Operating profitability aligns with baseline industry metrics",
  };
}

function evaluateSubSector(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.SUB_SECTOR_DEPTH;
  const targetIndustries = mandate.targetIndustries || [];

  if (opportunity.subSector && targetIndustries.length > 0) {
    const oppSubLower = opportunity.subSector.toLowerCase().trim();
    const subMatch = targetIndustries.some(
      (ti) =>
        Array.isArray(ti.subSectors) &&
        ti.subSectors.some(
          (s) =>
            s.toLowerCase().trim() === oppSubLower ||
            oppSubLower.includes(s.toLowerCase().trim())
        )
    );

    if (subMatch) {
      return {
        dimension: "SUB_SECTOR_DEPTH",
        weight: maxScore,
        score: maxScore,
        maxScore,
        matched: true,
        reason: `Specialized sub-sector [${opportunity.subSector}] directly matches priority strategic interest`,
      };
    }
  }

  return {
    dimension: "SUB_SECTOR_DEPTH",
    weight: maxScore,
    score: 6,
    maxScore,
    matched: true,
    reason: `Industry sector [${opportunity.industry}] aligns with broad acquisition scope`,
  };
}

function evaluateBusinessModel(
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.BUSINESS_MODEL;
  const model = opportunity.businessModel;

  if (
    model === "B2B" ||
    model === "CONTRACT_MANUFACTURING" ||
    model === "SAAS"
  ) {
    return {
      dimension: "BUSINESS_MODEL",
      weight: maxScore,
      score: 10,
      maxScore,
      matched: true,
      reason: `Commercial business model [${model}] aligns with institutional acquirer operating thesis`,
    };
  }

  if (model === "B2B2C" || model === "HYBRID" || model === "FRANCHISE") {
    return {
      dimension: "BUSINESS_MODEL",
      weight: maxScore,
      score: 7,
      maxScore,
      matched: true,
      reason: `Scalable commercial distribution model [${model}]`,
    };
  }

  return {
    dimension: "BUSINESS_MODEL",
    weight: maxScore,
    score: 5,
    maxScore,
    matched: false,
    reason: `Consumer-facing operating model [${model}]`,
  };
}

function evaluateOperationalScale(
  mandate: AcquisitionMandateRecord,
  opportunity: OpportunityRecord
): MatchDimensionScore {
  const maxScore = MATCHING_WEIGHTS.OPERATIONAL_SCALE;
  let workforcePoints = 3;
  let trackRecordPoints = 3;

  // Headcount scale evaluation (5 pts max)
  if (opportunity.employeeRange) {
    const range = EMPLOYEE_RANGES[opportunity.employeeRange];
    if (range) {
      const buyerEmp = {
        min: mandate.employeeMin || 0,
        max: mandate.employeeMax || 10_000,
      };
      const { overlapRatio, isContained, isDisjoint } = calculateRangeOverlap(
        range,
        buyerEmp
      );
      if (isContained || overlapRatio >= 0.5) {
        workforcePoints = 5;
      } else if (!isDisjoint) {
        workforcePoints = 3;
      } else {
        workforcePoints = 1;
      }
    }
  }

  // Track record / Vintage evaluation (5 pts max)
  const age = opportunity.approximateAgeBracket;
  if (age === "OVER_20_YRS" || age === "10_TO_20_YRS") {
    trackRecordPoints = 5;
  } else if (age === "5_TO_10_YRS") {
    trackRecordPoints = 4;
  } else if (age === "3_TO_5_YRS") {
    trackRecordPoints = 3;
  } else {
    trackRecordPoints = 2;
  }

  const score = Math.min(maxScore, workforcePoints + trackRecordPoints);

  return {
    dimension: "OPERATIONAL_SCALE",
    weight: maxScore,
    score,
    maxScore,
    matched: score >= 6,
    reason: `Operational headcount and vintage demonstrate established market presence (${opportunity.approximateAgeBracket})`,
  };
}

function createBlockedResult(
  opportunityId: string,
  mandateId: string,
  buyerProfileId: string,
  buyerId: string,
  blockingCriteria: string[],
  reasons: string[]
): MatchResult {
  return {
    opportunityId,
    mandateId,
    buyerProfileId,
    buyerId,
    isEligible: false,
    score: 0,
    classification: MatchClassification.POOR_MATCH,
    matchedCriteria: [],
    unmatchedCriteria: blockingCriteria,
    blockingCriteria,
    reasons,
    dimensionScores: {},
    matchingVersion: MATCHING_ALGORITHM_VERSION,
    evaluatedAt: new Date(),
  };
}
