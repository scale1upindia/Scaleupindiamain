// Scale-up India — Phase 13: Deterministic Financial Valuation Calculator Engine
// Path: src/domains/valuation/calculator.ts

import {
  FinancialInputUnit,
  DCFProjectionYear,
  DCFCalculationResult,
  RevenueMultipleResult,
  EBITDAMultipleResult,
  AssetBasedResult,
  ComparableAnalysisResult,
  BlendedValuationResult,
  ValuationRangeResult,
  ConfidenceEvaluationResult,
  ConfidenceFactorItem,
  ValuationScenario,
  ValuationComparableRecord,
  ValuationAdjustmentRecord,
  ValuationConfidenceLevel,
} from "@/types/valuation";
import { CalculationError } from "@/lib/errors";

export const UNIT_MULTIPLIERS: Record<FinancialInputUnit, number> = {
  INR: 1,
  THOUSAND: 1_000,
  LAKH: 100_000,
  MILLION: 1_000_000,
  CRORE: 10_000_000,
  BILLION: 1_000_000_000,
};

/**
 * Normalizes a raw financial value according to its financial unit into base INR.
 */
export function normalizeFinancialValue(rawValue: number, unit: FinancialInputUnit): number {
  if (!Number.isFinite(rawValue)) {
    throw new CalculationError(`Invalid raw financial value: ${rawValue}`);
  }
  const multiplier = UNIT_MULTIPLIERS[unit] ?? 1;
  const normalized = rawValue * multiplier;
  return Math.round(normalized * 10000) / 10000;
}

/**
 * 1. REVENUE MULTIPLE METHODOLOGY
 * Enterprise Value = Revenue * Multiple
 * Equity Value = Enterprise Value - Total Debt + Cash
 */
export function calculateRevenueMultiple(
  revenue: number,
  multiple: number,
  totalDebt = 0,
  cash = 0,
  period = "LTM"
): RevenueMultipleResult {
  if (!Number.isFinite(revenue) || !Number.isFinite(multiple)) {
    throw new CalculationError("Revenue and multiple must be finite numeric values.");
  }
  if (multiple <= 0) {
    throw new CalculationError("Revenue multiple must be greater than zero.");
  }
  if (revenue <= 0) {
    throw new CalculationError("Revenue must be greater than zero for Revenue Multiple valuation.");
  }

  const ev = Math.round(revenue * multiple);
  const netDebt = totalDebt - cash;
  const equityValue = Math.max(0, ev - netDebt);

  return {
    revenue,
    selectedMultiple: multiple,
    enterpriseValue: ev,
    totalDebt,
    cashAndEquivalents: cash,
    equityValue,
    period,
  };
}

/**
 * 2. EBITDA MULTIPLE METHODOLOGY
 * Enterprise Value = EBITDA * Multiple
 * If EBITDA is negative or zero, returns controlled unsuitability message rather than fabricating a valuation.
 */
export function calculateEBITDAMultiple(
  ebitda: number,
  multiple: number,
  totalDebt = 0,
  cash = 0,
  period = "LTM"
): EBITDAMultipleResult {
  if (!Number.isFinite(ebitda) || !Number.isFinite(multiple)) {
    throw new CalculationError("EBITDA and multiple must be finite numeric values.");
  }
  if (multiple <= 0) {
    throw new CalculationError("EBITDA multiple must be greater than zero.");
  }

  // Controlled handling for negative or zero EBITDA
  if (ebitda <= 0) {
    return {
      ebitda,
      selectedMultiple: multiple,
      enterpriseValue: null,
      totalDebt,
      cashAndEquivalents: cash,
      equityValue: null,
      period,
      isNegativeEbitdaUnsuitable: true,
      message: `EBITDA is ${ebitda <= 0 ? (ebitda === 0 ? "zero" : "negative") : ""}. EBITDA multiple valuation is unsuitable for unprofitable or break-even operations.`,
    };
  }

  const ev = Math.round(ebitda * multiple);
  const netDebt = totalDebt - cash;
  const equityValue = Math.max(0, ev - netDebt);

  return {
    ebitda,
    selectedMultiple: multiple,
    enterpriseValue: ev,
    totalDebt,
    cashAndEquivalents: cash,
    equityValue,
    period,
    isNegativeEbitdaUnsuitable: false,
  };
}

/**
 * 3. DISCOUNTED CASH FLOW (DCF) METHODOLOGY
 * Deterministic calculation of Free Cash Flows, Discount Factors, Present Value, Terminal Value, and Enterprise Value.
 */
export function calculateDCF(config: {
  projectionYears: Array<{
    year: number;
    projectedRevenue: number;
    ebitdaMarginPct: number;
    depreciation?: number;
    taxRatePct?: number;
    capex?: number;
    workingCapitalChange?: number;
  }>;
  waccPct: number;
  terminalGrowthRatePct: number;
  totalDebt?: number;
  cashAndEquivalents?: number;
}): DCFCalculationResult {
  const {
    projectionYears,
    waccPct,
    terminalGrowthRatePct,
    totalDebt = 0,
    cashAndEquivalents = 0,
  } = config;

  if (!Number.isFinite(waccPct) || !Number.isFinite(terminalGrowthRatePct)) {
    throw new CalculationError("WACC and terminal growth rate must be finite numbers.");
  }
  if (waccPct <= 0 || waccPct > 100) {
    throw new CalculationError("WACC must be between 0% and 100%.");
  }

  // WACC > terminal growth rate mathematical invariant
  if (waccPct <= terminalGrowthRatePct) {
    return {
      projectionYears: [],
      sumPvCashFlows: 0,
      terminalYearFCF: 0,
      terminalGrowthRatePct,
      waccPct,
      terminalValue: 0,
      pvTerminalValue: 0,
      enterpriseValue: 0,
      totalDebt,
      cashAndEquivalents,
      netDebt: totalDebt - cashAndEquivalents,
      equityValue: 0,
      validationStatus: "INVALID_WACC_TERMINAL_GROWTH",
      validationMessage: `WACC discount rate (${waccPct}%) must be strictly greater than terminal growth rate (${terminalGrowthRatePct}%) to calculate a finite terminal value.`,
    };
  }

  const wacc = waccPct / 100;
  const g = terminalGrowthRatePct / 100;

  const calculatedYears: DCFProjectionYear[] = [];
  let sumPv = 0;

  for (let i = 0; i < projectionYears.length; i++) {
    const p = projectionYears[i];
    const year = p.year || i + 1;
    const rev = p.projectedRevenue;
    const ebitda = rev * (p.ebitdaMarginPct / 100);
    const dep = p.depreciation ?? 0;
    const ebit = ebitda - dep;
    const taxRate = (p.taxRatePct ?? 25) / 100;
    const taxAmount = ebit > 0 ? ebit * taxRate : 0;
    const capex = p.capex ?? 0;
    const wcChange = p.workingCapitalChange ?? 0;

    // Unlevered Free Cash Flow (FCFF) = EBIT*(1-T) + Dep - Capex - ΔWC
    const fcf = ebit - taxAmount + dep - capex - wcChange;
    const discountFactor = Math.pow(1 + wacc, -year);
    const pv = fcf * discountFactor;

    sumPv += pv;

    calculatedYears.push({
      year,
      projectedRevenue: Math.round(rev),
      ebitdaMarginPct: p.ebitdaMarginPct,
      ebitda: Math.round(ebitda),
      depreciation: Math.round(dep),
      ebit: Math.round(ebit),
      taxRatePct: p.taxRatePct ?? 25,
      taxAmount: Math.round(taxAmount),
      capex: Math.round(capex),
      workingCapitalChange: Math.round(wcChange),
      freeCashFlow: Math.round(fcf),
      discountFactor: Math.round(discountFactor * 10000) / 10000,
      presentValue: Math.round(pv),
    });
  }

  const n = calculatedYears.length;
  const lastYearFCF = calculatedYears[n - 1].freeCashFlow;
  const fcfNext = lastYearFCF * (1 + g);
  const terminalValue = fcfNext / (wacc - g);
  const pvTerminalValue = terminalValue * Math.pow(1 + wacc, -n);

  const ev = Math.round(sumPv + pvTerminalValue);
  const netDebt = totalDebt - cashAndEquivalents;
  const equityValue = Math.max(0, Math.round(ev - netDebt));

  return {
    projectionYears: calculatedYears,
    sumPvCashFlows: Math.round(sumPv),
    terminalYearFCF: lastYearFCF,
    terminalGrowthRatePct,
    waccPct,
    terminalValue: Math.round(terminalValue),
    pvTerminalValue: Math.round(pvTerminalValue),
    enterpriseValue: ev,
    totalDebt,
    cashAndEquivalents,
    netDebt,
    equityValue,
    validationStatus: "VALID",
  };
}

/**
 * 4. ASSET-BASED VALUATION METHODOLOGY
 * Adjusted Net Asset Value = Adjusted Assets - Adjusted Liabilities
 */
export function calculateAssetBased(
  totalAssets: number,
  totalLiabilities: number,
  adjustments: ValuationAdjustmentRecord[] = []
): AssetBasedResult {
  if (!Number.isFinite(totalAssets) || !Number.isFinite(totalLiabilities)) {
    throw new CalculationError("Total assets and total liabilities must be finite numbers.");
  }
  if (totalAssets < 0 || totalLiabilities < 0) {
    throw new CalculationError("Total assets and liabilities cannot be negative.");
  }

  let assetAdditions = 0;
  let riskHaircuts = 0;
  let liabilityAdditions = 0;

  for (const adj of adjustments) {
    const amt = Number(adj.amount);
    if (adj.adjustment_type === "ASSET_ADDITION") {
      assetAdditions += amt;
    } else if (adj.adjustment_type === "RISK_HAIRCUT") {
      riskHaircuts += Math.abs(amt);
    } else if (
      adj.adjustment_type === "LIABILITY_ADDITION" ||
      adj.adjustment_type === "TAX_CONTINGENCY" ||
      adj.adjustment_type === "PROMOTER_INDEMNITY"
    ) {
      liabilityAdditions += Math.abs(amt);
    }
  }

  const adjustedAssets = Math.round(totalAssets + assetAdditions - riskHaircuts);
  const adjustedLiabilities = Math.round(totalLiabilities + liabilityAdditions);
  const netAssetValue = Math.max(0, adjustedAssets - adjustedLiabilities);

  return {
    totalAssets: Math.round(totalAssets),
    adjustedAssets,
    totalLiabilities: Math.round(totalLiabilities),
    adjustedLiabilities,
    netAssetValue,
    adjustmentsSummary: {
      assetAdditions: Math.round(assetAdditions),
      liabilityAdditions: Math.round(liabilityAdditions),
      riskHaircuts: Math.round(riskHaircuts),
    },
    enterpriseValue: netAssetValue,
    equityValue: netAssetValue,
  };
}

/**
 * 5. COMPARABLE COMPANIES ANALYSIS METHODOLOGY
 * Calculates median and average multiples from authorized market peer transactions.
 */
export function calculateComparableAnalysis(
  comparables: ValuationComparableRecord[],
  revenue: number,
  ebitda: number | null,
  selectedMultipleType: "REVENUE" | "EBITDA" = "REVENUE",
  totalDebt = 0,
  cash = 0
): ComparableAnalysisResult {
  if (!comparables || comparables.length === 0) {
    return {
      comparablesCount: 0,
      medianRevenueMultiple: null,
      averageRevenueMultiple: null,
      medianEbitdaMultiple: null,
      averageEbitdaMultiple: null,
      selectedMultipleType,
      selectedMultiple: null,
      enterpriseValue: null,
      equityValue: null,
      status: "INSUFFICIENT_COMPARABLE_DATA",
    };
  }

  const revMultiples: number[] = [];
  const ebitdaMultiples: number[] = [];

  for (const c of comparables) {
    if (c.revenue_multiple && c.revenue_multiple > 0) {
      revMultiples.push(Number(c.revenue_multiple));
    }
    if (c.ebitda_multiple && c.ebitda_multiple > 0) {
      ebitdaMultiples.push(Number(c.ebitda_multiple));
    }
  }

  const computeMedian = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const computeAvg = (arr: number[]): number | null => {
    if (arr.length === 0) return null;
    return arr.reduce((acc, v) => acc + v, 0) / arr.length;
  };

  const medianRev = computeMedian(revMultiples);
  const avgRev = computeAvg(revMultiples);
  const medianEbitda = computeMedian(ebitdaMultiples);
  const avgEbitda = computeAvg(ebitdaMultiples);

  let selectedMultiple: number | null = null;
  let impliedEV: number | null = null;

  if (selectedMultipleType === "REVENUE") {
    selectedMultiple = medianRev ?? avgRev;
    if (selectedMultiple && revenue > 0) {
      impliedEV = Math.round(revenue * selectedMultiple);
    }
  } else {
    selectedMultiple = medianEbitda ?? avgEbitda;
    if (selectedMultiple && ebitda && ebitda > 0) {
      impliedEV = Math.round(ebitda * selectedMultiple);
    }
  }

  const netDebt = totalDebt - cash;
  const equityValue = impliedEV !== null ? Math.max(0, impliedEV - netDebt) : null;

  return {
    comparablesCount: comparables.length,
    medianRevenueMultiple: medianRev ? Math.round(medianRev * 100) / 100 : null,
    averageRevenueMultiple: avgRev ? Math.round(avgRev * 100) / 100 : null,
    medianEbitdaMultiple: medianEbitda ? Math.round(medianEbitda * 100) / 100 : null,
    averageEbitdaMultiple: avgEbitda ? Math.round(avgEbitda * 100) / 100 : null,
    selectedMultipleType,
    selectedMultiple: selectedMultiple ? Math.round(selectedMultiple * 100) / 100 : null,
    enterpriseValue: impliedEV,
    equityValue,
    status: impliedEV !== null ? "AVAILABLE" : "INSUFFICIENT_COMPARABLE_DATA",
  };
}

/**
 * 6. BLENDED VALUATION METHODOLOGY
 * Combines configured methodologies with non-negative weights summing to 1.0 (100%).
 */
export function calculateBlendedValuation(
  methodologyOutputs: Array<{
    methodology: string;
    enterpriseValue: number | null;
    equityValue: number | null;
  }>,
  weights: Record<string, number>
): BlendedValuationResult {
  const methodMap = new Map<string, { ev: number; eq: number }>();
  for (const o of methodologyOutputs) {
    if (o.enterpriseValue !== null && o.equityValue !== null) {
      methodMap.set(o.methodology, {
        ev: o.enterpriseValue,
        eq: o.equityValue,
      });
    }
  }

  let totalWeight = 0;
  for (const [method, w] of Object.entries(weights)) {
    if (w < 0) {
      throw new CalculationError(`Weight for ${method} cannot be negative.`);
    }
    totalWeight += w;
  }

  // Weight sum check: Must sum to 1.0 (with precision tolerance)
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    throw new CalculationError(
      `Blended valuation weights must sum to exactly 1.0 (100%). Current sum: ${Math.round(totalWeight * 100)}%`
    );
  }

  const contributions: BlendedValuationResult["contributions"] = [];
  let blendedEV = 0;
  let blendedEquity = 0;

  for (const [method, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    const values = methodMap.get(method);
    if (!values) {
      throw new CalculationError(
        `Methodology "${method}" is assigned weight ${(weight * 100).toFixed(0)}%, but has no valid calculation output.`
      );
    }

    const weightedEV = values.ev * weight;
    const weightedEquity = values.eq * weight;

    blendedEV += weightedEV;
    blendedEquity += weightedEquity;

    contributions.push({
      methodology: method,
      weightPct: Math.round(weight * 100),
      methodologyEnterpriseValue: values.ev,
      weightedEnterpriseValue: Math.round(weightedEV),
      methodologyEquityValue: values.eq,
      weightedEquityValue: Math.round(weightedEquity),
    });
  }

  return {
    weights,
    contributions,
    blendedEnterpriseValue: Math.round(blendedEV),
    blendedEquityValue: Math.round(blendedEquity),
  };
}

/**
 * 7. VALUATION RANGE ESTIMATOR
 * Derives indicative low, base, and high valuation range from scenario outputs and methodology distribution.
 */
export function calculateValuationRange(
  validEnterpriseValues: number[],
  validEquityValues: number[]
): ValuationRangeResult {
  if (validEnterpriseValues.length === 0 || validEquityValues.length === 0) {
    return {
      status: "VALUATION_RANGE_UNAVAILABLE",
      lowEnterpriseValue: null,
      baseEnterpriseValue: null,
      highEnterpriseValue: null,
      lowEquityValue: null,
      baseEquityValue: null,
      highEquityValue: null,
      spreadPercentage: null,
    };
  }

  const lowEV = Math.min(...validEnterpriseValues);
  const highEV = Math.max(...validEnterpriseValues);
  const avgEV = validEnterpriseValues.reduce((a, b) => a + b, 0) / validEnterpriseValues.length;
  const baseEV = Math.round(avgEV);

  const lowEq = Math.min(...validEquityValues);
  const highEq = Math.max(...validEquityValues);
  const avgEq = validEquityValues.reduce((a, b) => a + b, 0) / validEquityValues.length;
  const baseEq = Math.round(avgEq);

  const spread = baseEV > 0 ? Math.round(((highEV - lowEV) / baseEV) * 100) : 0;

  return {
    status: "AVAILABLE",
    lowEnterpriseValue: lowEV,
    baseEnterpriseValue: baseEV,
    highEnterpriseValue: highEV,
    lowEquityValue: lowEq,
    baseEquityValue: baseEq,
    highEquityValue: highEq,
    spreadPercentage: spread,
  };
}

/**
 * 8. CONFIDENCE MODEL
 * Deterministic and transparent confidence score (0-100) based on verified evidence, freshness, findings, and inputs.
 */
export function evaluateValuationConfidence(params: {
  inputs: Array<{ provenanceType: string; qualityFlag: string; sourcePeriod?: string | null }>;
  methodologiesCount: number;
  comparablesCount: number;
  activeDiligenceFindings: Array<{ severity: string }>;
  isReviewerApproved: boolean;
}): ConfidenceEvaluationResult {
  const {
    inputs,
    methodologiesCount,
    comparablesCount,
    activeDiligenceFindings,
    isReviewerApproved,
  } = params;

  const factors: ConfidenceFactorItem[] = [];

  // 1. Evidence Verification Factor (25 points max)
  const totalInputs = inputs.length;
  const verifiedInputs = inputs.filter(
    (i) => i.qualityFlag === "VERIFIED" && i.provenanceType !== "MANUAL_INPUT"
  ).length;
  const verificationRatio = totalInputs > 0 ? verifiedInputs / totalInputs : 0;
  const verificationScore = Math.round(verificationRatio * 25);
  factors.push({
    name: "Evidence Provenance & Verification",
    weight: 25,
    score: verificationScore,
    explanation: `${verifiedInputs} of ${totalInputs} financial inputs are verified and backed by due diligence evidence.`,
  });

  // 2. Evidence Freshness & Period Definition (15 points max)
  const periodDefinedInputs = inputs.filter((i) => i.sourcePeriod && i.sourcePeriod.trim().length > 0).length;
  const freshnessRatio = totalInputs > 0 ? periodDefinedInputs / totalInputs : 0;
  const freshnessScore = Math.round(freshnessRatio * 15);
  factors.push({
    name: "Input Freshness & Period Completeness",
    weight: 15,
    score: freshnessScore,
    explanation: `${periodDefinedInputs} of ${totalInputs} inputs have specific source reporting periods bound.`,
  });

  // 3. Methodologies Breadth (20 points max)
  let methodScore = 0;
  if (methodologiesCount >= 3) {
    methodScore = 20;
  } else if (methodologiesCount === 2) {
    methodScore = 14;
  } else if (methodologiesCount === 1) {
    methodScore = 8;
  }
  factors.push({
    name: "Methodological Triangulation",
    weight: 20,
    score: methodScore,
    explanation: `${methodologiesCount} distinct valuation methodology calculations executed and cross-referenced.`,
  });

  // 4. Comparable Market Peer Validation (15 points max)
  let compScore = 0;
  if (comparablesCount >= 3) {
    compScore = 15;
  } else if (comparablesCount >= 1) {
    compScore = 8;
  }
  factors.push({
    name: "Market Peer Benchmark Coverage",
    weight: 15,
    score: compScore,
    explanation: `${comparablesCount} peer transaction comparables included in benchmark valuation.`,
  });

  // 5. Diligence Findings Impact (15 points max)
  let findingsScore = 15;
  let criticalCount = 0;
  let highCount = 0;
  for (const f of activeDiligenceFindings) {
    if (f.severity === "CRITICAL") {
      criticalCount++;
      findingsScore -= 5;
    } else if (f.severity === "HIGH") {
      highCount++;
      findingsScore -= 2;
    }
  }
  findingsScore = Math.max(0, findingsScore);
  factors.push({
    name: "Due Diligence Risk Exposure",
    weight: 15,
    score: findingsScore,
    explanation:
      criticalCount > 0 || highCount > 0
        ? `${criticalCount} critical and ${highCount} high risk findings identified in due diligence.`
        : "No active critical or high severity due diligence risk findings.",
  });

  // 6. Reviewer Assessment Bonus (10 points max)
  const reviewerScore = isReviewerApproved ? 10 : 0;
  factors.push({
    name: "Independent Reviewer Approval",
    weight: 10,
    score: reviewerScore,
    explanation: isReviewerApproved
      ? "Formally reviewed and approved by authorized financial reviewer."
      : "Pending formal reviewer endorsement.",
  });

  const totalScore = Math.min(
    100,
    verificationScore + freshnessScore + methodScore + compScore + findingsScore + reviewerScore
  );

  let level: ValuationConfidenceLevel = "LOW";
  if (totalScore >= 75) {
    level = "HIGH";
  } else if (totalScore >= 45) {
    level = "MEDIUM";
  }

  return {
    score: totalScore,
    level,
    factors,
    verifiedEvidenceCount: verifiedInputs,
    totalInputsCount: totalInputs,
    activeDiligenceFindingsCount: activeDiligenceFindings.length,
  };
}
