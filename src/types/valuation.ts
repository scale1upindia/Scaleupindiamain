// Scale-up India — Phase 13: Valuation Types & Domain Interfaces
// Path: src/types/valuation.ts

export type ValuationCaseStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "LOCKED"
  | "REJECTED";

export type ValuationVersionStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "REVISION_REQUIRED"
  | "APPROVED"
  | "LOCKED"
  | "REJECTED";

export type ValuationMethodology =
  | "REVENUE_MULTIPLE"
  | "EBITDA_MULTIPLE"
  | "DISCOUNTED_CASH_FLOW"
  | "ASSET_BASED"
  | "COMPARABLE_COMPANIES"
  | "BLENDED";

export type ValuationScenario = "CONSERVATIVE" | "BASE" | "OPTIMISTIC";

export type ValuationConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type FinancialInputUnit =
  | "INR"
  | "THOUSAND"
  | "LAKH"
  | "MILLION"
  | "CRORE"
  | "BILLION";

export type FinancialCurrency = "INR" | "USD" | "EUR" | "GBP";

export type InputProvenanceType =
  | "DILIGENCE_EVIDENCE"
  | "MANUAL_INPUT"
  | "AUDITED_STATEMENTS"
  | "TAX_FILINGS"
  | "MANAGEMENT_ACCOUNTS";

export type InputQualityFlag =
  | "VERIFIED"
  | "REVIEW_REQUIRED"
  | "MANUAL_INPUT"
  | "STALE"
  | "INCOMPLETE"
  | "CONFLICTING"
  | "UNAVAILABLE";

export type AdjustmentType =
  | "ASSET_ADDITION"
  | "LIABILITY_ADDITION"
  | "RISK_HAIRCUT"
  | "TAX_CONTINGENCY"
  | "WORKING_CAPITAL_NORM"
  | "PROMOTER_INDEMNITY"
  | "DEPRECIATION_ADJUSTMENT"
  | "OTHER";

// Database Records
export interface ValuationCaseRecord {
  id: string;
  reference_code: string;
  diligence_case_id: string;
  opportunity_id: string;
  mou_id: string;
  nda_id: string;
  token_deposit_id: string | null;
  buyer_id: string;
  seller_id: string;
  status: ValuationCaseStatus;
  current_version_number: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  locked_at: string | null;
}

export interface ValuationVersionRecord {
  id: string;
  case_id: string;
  version_number: number;
  title: string;
  status: ValuationVersionStatus;
  currency: string;
  model_inputs: any;
  methodology_configs: any;
  calculation_results: any;
  confidence_score: number;
  confidence_level: ValuationConfidenceLevel;
  confidence_factors: any;
  created_by: string;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_notes: string | null;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

export interface ValuationInputRecord {
  id: string;
  case_id: string;
  version_id: string;
  metric_name: string;
  raw_value: number;
  normalized_value: number;
  currency: string;
  unit: FinancialInputUnit;
  source_period: string | null;
  provenance_type: InputProvenanceType;
  evidence_id: string | null;
  evidence_version_number: number | null;
  quality_flag: InputQualityFlag;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface ValuationAdjustmentRecord {
  id: string;
  case_id: string;
  version_id: string;
  adjustment_type: AdjustmentType;
  title: string;
  amount: number;
  currency: string;
  rationale: string;
  source_finding_id: string | null;
  source_evidence_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ValuationComparableRecord {
  id: string;
  case_id: string;
  version_id: string;
  company_name: string;
  sector: string;
  period: string;
  revenue: number;
  ebitda: number | null;
  implied_ev: number;
  revenue_multiple: number | null;
  ebitda_multiple: number | null;
  source: string;
  source_date: string | null;
  confidence: ValuationConfidenceLevel;
  created_at: string;
}

// Financial Model & Calculation Engine Types
export interface DCFProjectionYear {
  year: number;
  projectedRevenue: number;
  ebitdaMarginPct: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  taxRatePct: number;
  taxAmount: number;
  capex: number;
  workingCapitalChange: number;
  freeCashFlow: number;
  discountFactor: number;
  presentValue: number;
}

export interface DCFCalculationResult {
  projectionYears: DCFProjectionYear[];
  sumPvCashFlows: number;
  terminalYearFCF: number;
  terminalGrowthRatePct: number;
  waccPct: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  totalDebt: number;
  cashAndEquivalents: number;
  netDebt: number;
  equityValue: number;
  validationStatus: "VALID" | "INVALID_WACC_TERMINAL_GROWTH" | "DIVISION_BY_ZERO" | "UNSUITABLE";
  validationMessage?: string;
}

export interface RevenueMultipleResult {
  revenue: number;
  selectedMultiple: number;
  enterpriseValue: number;
  totalDebt: number;
  cashAndEquivalents: number;
  equityValue: number;
  period: string;
}

export interface EBITDAMultipleResult {
  ebitda: number;
  selectedMultiple: number;
  enterpriseValue: number | null;
  totalDebt: number;
  cashAndEquivalents: number;
  equityValue: number | null;
  period: string;
  isNegativeEbitdaUnsuitable: boolean;
  message?: string;
}

export interface AssetBasedResult {
  totalAssets: number;
  adjustedAssets: number;
  totalLiabilities: number;
  adjustedLiabilities: number;
  netAssetValue: number;
  adjustmentsSummary: {
    assetAdditions: number;
    liabilityAdditions: number;
    riskHaircuts: number;
  };
  enterpriseValue: number;
  equityValue: number;
}

export interface ComparableAnalysisResult {
  comparablesCount: number;
  medianRevenueMultiple: number | null;
  averageRevenueMultiple: number | null;
  medianEbitdaMultiple: number | null;
  averageEbitdaMultiple: number | null;
  selectedMultipleType: "REVENUE" | "EBITDA";
  selectedMultiple: number | null;
  enterpriseValue: number | null;
  equityValue: number | null;
  status: "AVAILABLE" | "INSUFFICIENT_COMPARABLE_DATA";
}

export interface BlendedValuationResult {
  weights: Record<string, number>;
  contributions: Array<{
    methodology: string;
    weightPct: number;
    methodologyEnterpriseValue: number;
    weightedEnterpriseValue: number;
    methodologyEquityValue: number;
    weightedEquityValue: number;
  }>;
  blendedEnterpriseValue: number;
  blendedEquityValue: number;
}

export interface ScenarioCalculationOutput {
  scenario: ValuationScenario;
  revenueMultiple?: RevenueMultipleResult;
  ebitdaMultiple?: EBITDAMultipleResult;
  dcf?: DCFCalculationResult;
  assetBased?: AssetBasedResult;
  comparables?: ComparableAnalysisResult;
  blended?: BlendedValuationResult;
  summaryEnterpriseValue: number;
  summaryEquityValue: number;
}

export interface ValuationRangeResult {
  status: "AVAILABLE" | "VALUATION_RANGE_UNAVAILABLE";
  lowEnterpriseValue: number | null;
  baseEnterpriseValue: number | null;
  highEnterpriseValue: number | null;
  lowEquityValue: number | null;
  baseEquityValue: number | null;
  highEquityValue: number | null;
  spreadPercentage: number | null;
}

export interface ConfidenceFactorItem {
  name: string;
  weight: number;
  score: number;
  explanation: string;
}

export interface ConfidenceEvaluationResult {
  score: number; // 0 to 100
  level: ValuationConfidenceLevel;
  factors: ConfidenceFactorItem[];
  verifiedEvidenceCount: number;
  totalInputsCount: number;
  activeDiligenceFindingsCount: number;
}

// User-facing View Models
export interface ValuationCaseOverviewView {
  id: string;
  referenceCode: string;
  diligenceCaseId: string;
  diligenceReferenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  mouId: string;
  mouReferenceCode: string;
  ndaId: string;
  buyerId: string;
  sellerId: string;
  userRole: "BUYER" | "SELLER" | "REVIEWER" | "ADMIN";
  status: ValuationCaseStatus;
  currentVersionNumber: number;
  notes: string | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
  activeVersion?: ValuationVersionDetailView;
  versionCount: number;
}

export interface ValuationVersionDetailView {
  id: string;
  caseId: string;
  versionNumber: number;
  title: string;
  status: ValuationVersionStatus;
  currency: string;
  confidenceScore: number;
  confidenceLevel: ValuationConfidenceLevel;
  confidenceFactors: ConfidenceFactorItem[];
  modelInputs: Record<string, any>;
  methodologyConfigs: Record<string, any>;
  calculationResults: {
    scenarios: Record<ValuationScenario, ScenarioCalculationOutput>;
    range: ValuationRangeResult;
    blended?: BlendedValuationResult;
    indicativeEnterpriseValue: number;
    indicativeEquityValue: number;
  };
  inputs: ValuationInputView[];
  adjustments: ValuationAdjustmentView[];
  comparables: ValuationComparableView[];
  createdBy: string;
  createdByName?: string;
  submittedAt: string | null;
  submittedBy: string | null;
  reviewerId: string | null;
  reviewerNotes: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  createdAt: string;
}

export interface ValuationInputView {
  id: string;
  metricName: string;
  rawValue: number;
  normalizedValue: number;
  currency: string;
  unit: FinancialInputUnit;
  sourcePeriod: string | null;
  provenanceType: InputProvenanceType;
  evidenceId: string | null;
  evidenceTitle?: string;
  evidenceVersionNumber: number | null;
  qualityFlag: InputQualityFlag;
  notes: string | null;
  createdAt: string;
}

export interface ValuationAdjustmentView {
  id: string;
  adjustmentType: AdjustmentType;
  title: string;
  amount: number;
  currency: string;
  rationale: string;
  sourceFindingId: string | null;
  sourceFindingReference?: string;
  sourceFindingTitle?: string;
  sourceFindingSeverity?: string;
  sourceEvidenceId: string | null;
  createdAt: string;
}

export interface ValuationComparableView {
  id: string;
  companyName: string;
  sector: string;
  period: string;
  revenue: number;
  ebitda: number | null;
  impliedEv: number;
  revenueMultiple: number | null;
  ebitdaMultiple: number | null;
  source: string;
  sourceDate: string | null;
  confidence: ValuationConfidenceLevel;
  createdAt: string;
}

// Progressive Disclosure: Seller View Model (Confidential internal buyer assumptions masked)
export interface ValuationSellerSummaryView {
  caseId: string;
  referenceCode: string;
  diligenceCaseId: string;
  opportunityTitle: string;
  status: ValuationCaseStatus;
  currentVersionNumber: number;
  indicativeValuationRange: {
    lowEnterpriseValue: number | null;
    baseEnterpriseValue: number | null;
    highEnterpriseValue: number | null;
  };
  confidenceLevel: ValuationConfidenceLevel;
  methodologiesApplied: ValuationMethodology[];
  disclosedAt: string;
}
