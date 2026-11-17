// Scale-up India — Phase 13: Valuation Validation Schemas
// Path: src/schemas/valuation.ts

import { z } from "zod";

export const FINANCIAL_CURRENCIES = ["INR", "USD", "EUR", "GBP"] as const;
export const FINANCIAL_UNITS = [
  "INR",
  "THOUSAND",
  "LAKH",
  "MILLION",
  "CRORE",
  "BILLION",
] as const;

export const INPUT_PROVENANCE_TYPES = [
  "DILIGENCE_EVIDENCE",
  "MANUAL_INPUT",
  "AUDITED_STATEMENTS",
  "TAX_FILINGS",
  "MANAGEMENT_ACCOUNTS",
] as const;

export const INPUT_QUALITY_FLAGS = [
  "VERIFIED",
  "REVIEW_REQUIRED",
  "MANUAL_INPUT",
  "STALE",
  "INCOMPLETE",
  "CONFLICTING",
  "UNAVAILABLE",
] as const;

export const VALUATION_METHODOLOGIES = [
  "REVENUE_MULTIPLE",
  "EBITDA_MULTIPLE",
  "DISCOUNTED_CASH_FLOW",
  "ASSET_BASED",
  "COMPARABLE_COMPANIES",
  "BLENDED",
] as const;

export const VALUATION_SCENARIOS = ["CONSERVATIVE", "BASE", "OPTIMISTIC"] as const;

export const ADJUSTMENT_TYPES = [
  "ASSET_ADDITION",
  "LIABILITY_ADDITION",
  "RISK_HAIRCUT",
  "TAX_CONTINGENCY",
  "WORKING_CAPITAL_NORM",
  "PROMOTER_INDEMNITY",
  "DEPRECIATION_ADJUSTMENT",
  "OTHER",
] as const;

export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const createValuationCaseSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  initialTitle: z.string().min(3).max(255).optional().default("Valuation Model V1"),
});

export const createValuationInputSchema = z.object({
  metricName: z.string().min(2).max(100),
  rawValue: z.number().finite("Value must be a finite number"),
  currency: z.enum(FINANCIAL_CURRENCIES).optional().default("INR"),
  unit: z.enum(FINANCIAL_UNITS).optional().default("INR"),
  sourcePeriod: z.string().max(50).optional().nullable(),
  provenanceType: z.enum(INPUT_PROVENANCE_TYPES).optional().default("MANUAL_INPUT"),
  evidenceId: z.string().uuid().optional().nullable(),
  evidenceVersionNumber: z.number().int().positive().optional().nullable(),
  qualityFlag: z.enum(INPUT_QUALITY_FLAGS).optional().default("VERIFIED"),
  notes: z.string().max(1000).optional().nullable(),
});

export const createValuationAdjustmentSchema = z.object({
  adjustmentType: z.enum(ADJUSTMENT_TYPES),
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  amount: z.number().finite("Amount must be a finite number"),
  currency: z.enum(FINANCIAL_CURRENCIES).optional().default("INR"),
  rationale: z.string().min(10, "Explicit rationale of at least 10 characters required for valuation adjustment").max(2000),
  sourceFindingId: z.string().uuid().optional().nullable(),
  sourceEvidenceId: z.string().uuid().optional().nullable(),
});

export const createValuationComparableSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters").max(255),
  sector: z.string().min(2).max(100),
  period: z.string().min(2).max(50),
  revenue: z.number().positive("Revenue must be greater than zero"),
  ebitda: z.number().finite().optional().nullable(),
  impliedEv: z.number().positive("Implied enterprise value must be greater than zero"),
  source: z.string().min(2).max(255),
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  confidence: z.enum(CONFIDENCE_LEVELS).optional().default("MEDIUM"),
});

export const dcfProjectionYearInputSchema = z.object({
  year: z.number().int().positive(),
  projectedRevenue: z.number().positive("Projected revenue must be positive"),
  ebitdaMarginPct: z.number().min(-100).max(100),
  depreciation: z.number().nonnegative().optional().default(0),
  taxRatePct: z.number().min(0).max(100).optional().default(25),
  capex: z.number().nonnegative().optional().default(0),
  workingCapitalChange: z.number().finite().optional().default(0),
});

export const dcfConfigSchema = z.object({
  enabled: z.boolean().default(true),
  projectionYears: z.array(dcfProjectionYearInputSchema).min(1, "At least 1 projection year required for DCF").max(10),
  waccPct: z.number().positive("WACC must be greater than 0%").max(100, "WACC cannot exceed 100%"),
  terminalGrowthRatePct: z.number().min(-10, "Terminal growth cannot be less than -10%").max(20, "Terminal growth rate is unrealistic above 20%"),
  totalDebt: z.number().nonnegative().optional().default(0),
  cashAndEquivalents: z.number().nonnegative().optional().default(0),
});

export const multipleMethodConfigSchema = z.object({
  enabled: z.boolean().default(true),
  conservativeMultiple: z.number().positive("Multiple must be positive"),
  baseMultiple: z.number().positive("Multiple must be positive"),
  optimisticMultiple: z.number().positive("Multiple must be positive"),
  totalDebt: z.number().nonnegative().optional().default(0),
  cashAndEquivalents: z.number().nonnegative().optional().default(0),
});

export const assetBasedConfigSchema = z.object({
  enabled: z.boolean().default(true),
  totalAssets: z.number().nonnegative("Total assets cannot be negative"),
  totalLiabilities: z.number().nonnegative("Total liabilities cannot be negative"),
});

export const comparableConfigSchema = z.object({
  enabled: z.boolean().default(true),
  selectedMultipleType: z.enum(["REVENUE", "EBITDA"]).default("REVENUE"),
  totalDebt: z.number().nonnegative().optional().default(0),
  cashAndEquivalents: z.number().nonnegative().optional().default(0),
});

export const blendedConfigSchema = z.object({
  enabled: z.boolean().default(true),
  weights: z.record(z.string(), z.number().min(0).max(1)),
});

export const methodologyConfigsSchema = z.object({
  revenueMultiple: multipleMethodConfigSchema.optional(),
  ebitdaMultiple: multipleMethodConfigSchema.optional(),
  dcf: dcfConfigSchema.optional(),
  assetBased: assetBasedConfigSchema.optional(),
  comparable: comparableConfigSchema.optional(),
  blended: blendedConfigSchema.optional(),
});

export const updateValuationModelSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  currency: z.enum(FINANCIAL_CURRENCIES).optional(),
  methodologyConfigs: methodologyConfigsSchema.optional(),
  activeScenario: z.enum(VALUATION_SCENARIOS).optional().default("BASE"),
});

export const submitValuationVersionSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
});

export const reviewValuationVersionSchema = z.object({
  decision: z.enum(["UNDER_REVIEW", "APPROVED", "REVISION_REQUIRED", "REJECTED"]),
  notes: z.string().min(5, "Review notes must be at least 5 characters").max(2000),
});

export const lockValuationVersionSchema = z.object({
  lockReason: z.string().max(2000).optional().nullable(),
});

// Infer types
export type CreateValuationCaseInput = z.input<typeof createValuationCaseSchema>;
export type CreateValuationInputInput = z.input<typeof createValuationInputSchema>;
export type CreateValuationAdjustmentInput = z.input<typeof createValuationAdjustmentSchema>;
export type CreateValuationComparableInput = z.input<typeof createValuationComparableSchema>;
export type MethodologyConfigsInput = z.input<typeof methodologyConfigsSchema>;
export type UpdateValuationModelInput = z.input<typeof updateValuationModelSchema>;
export type SubmitValuationVersionInput = z.input<typeof submitValuationVersionSchema>;
export type ReviewValuationVersionInput = z.input<typeof reviewValuationVersionSchema>;
export type LockValuationVersionInput = z.input<typeof lockValuationVersionSchema>;
export type DCFConfigInput = z.input<typeof dcfConfigSchema>;
