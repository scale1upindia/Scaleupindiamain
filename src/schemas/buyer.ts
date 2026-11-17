import { z } from "zod";

const BUYER_TYPES = [
  "INDIVIDUAL_INVESTOR",
  "CORPORATE_BUYER",
  "PE_FUND",
  "VC_FUND",
  "FAMILY_OFFICE",
  "STRATEGIC_PARTNER",
  "OTHER",
] as const;

const ENTITY_TYPES = [
  "COMPANY",
  "FUND",
  "FAMILY_OFFICE",
  "INDIVIDUAL",
  "LLP",
  "PARTNERSHIP",
  "OTHER",
] as const;

const TRANSACTION_TYPES = [
  "FULL_ACQUISITION",
  "MAJORITY_STAKE",
  "MINORITY_STAKE",
  "STRATEGIC_INVESTMENT",
  "PRIVATE_EQUITY",
  "VENTURE_INVESTMENT",
  "JOINT_VENTURE",
  "STRATEGIC_PARTNERSHIP",
  "ASSET_ACQUISITION",
] as const;

const CONTROL_PREFERENCES = [
  "FULL_CONTROL",
  "MAJORITY_CONTROL",
  "JOINT_CONTROL",
  "MINORITY",
  "NO_CONTROL_FINANCIAL",
] as const;

const INVESTMENT_HORIZONS = ["SHORT_TERM", "MEDIUM_TERM", "LONG_TERM"] as const;

const FUNDING_SOURCES = [
  "OWN_CAPITAL",
  "FUND_CAPITAL",
  "BANK_DEBT",
  "INSTITUTIONAL_DEBT",
  "CO_INVESTMENT",
  "COMBINATION",
] as const;

const REGION_TYPES = [
  "PAN_INDIA",
  "NORTH_INDIA",
  "SOUTH_INDIA",
  "EAST_INDIA",
  "WEST_INDIA",
  "GLOBAL",
  "SPECIFIC_STATES",
] as const;

export const BuyerProfileSchema = z
  .object({
    buyerType: z.enum(BUYER_TYPES),
    legalName: z.string().min(2, "Legal name must be at least 2 characters").max(255),
    tradeName: z.string().max(255).optional().nullable(),
    entityType: z.enum(ENTITY_TYPES),
    registrationNumber: z.string().max(100).optional().nullable(),
    country: z.string().default("India"),
    state: z.string().min(2, "State is required"),
    city: z.string().min(2, "City is required"),
    website: z.string().url("Must be a valid URL").optional().or(z.literal("")).nullable(),
    yearEstablished: z
      .number()
      .int()
      .min(1800)
      .max(new Date().getFullYear())
      .optional()
      .nullable(),
    industry: z.string().max(100).optional().nullable(),
    description: z.string().max(5000).optional().nullable(),
    // Fund metrics
    fundSize: z.number().nonnegative().optional().nullable(),
    aum: z.number().nonnegative().optional().nullable(),
    currentVintage: z.number().int().min(1950).max(2050).optional().nullable(),
    typicalTicketSize: z.number().nonnegative().optional().nullable(),
    // Contact Person
    contactName: z.string().min(2, "Contact name is required").max(255),
    designation: z.string().min(2, "Designation is required").max(100),
    email: z.string().email("Invalid email address"),
    phone: z.string().min(7, "Phone number is too short").max(20),
    preferredCommMethod: z.enum(["IN_APP", "EMAIL", "PHONE", "WHATSAPP"]).default("IN_APP"),
  })
  .strict();

export const MandateTargetIndustrySchema = z.object({
  industry: z.string().min(2).max(100),
  subSectors: z.array(z.string()).default([]),
  otherSubSector: z.string().max(255).optional().nullable(),
});

export const MandateTargetGeographySchema = z.object({
  region: z.enum(REGION_TYPES),
  countries: z.array(z.string()).default(["India"]),
  states: z.array(z.string()).default([]),
  cities: z.array(z.string()).default([]),
});

export const AcquisitionMandateSchema = z
  .object({
    name: z.string().min(2, "Mandate name is required").max(255),
    description: z.string().max(4000).optional().nullable(),
    // Financial Capacity
    minInvestment: z.number().nonnegative("Minimum investment must be non-negative"),
    maxInvestment: z.number().nonnegative("Maximum investment must be non-negative"),
    preferredTicketSize: z.number().nonnegative().optional().nullable(),
    availableCapital: z.number().nonnegative().optional().nullable(),
    financingRequirement: z.string().max(100).optional().nullable(),
    debtEquityPreference: z.string().max(100).optional().nullable(),
    // Target Business Size
    revenueMin: z.number().nonnegative().default(0),
    revenueMax: z.number().nonnegative().optional().nullable(),
    ebitdaMin: z.number().optional().nullable(),
    ebitdaMax: z.number().optional().nullable(),
    employeeMin: z.number().int().nonnegative().default(0),
    employeeMax: z.number().int().nonnegative().optional().nullable(),
    businessAgeMin: z.number().int().nonnegative().default(0),
    businessAgeMax: z.number().int().nonnegative().optional().nullable(),
    netWorthMin: z.number().optional().nullable(),
    netWorthMax: z.number().optional().nullable(),
    // Governance & Transaction
    transactionTypes: z.array(z.enum(TRANSACTION_TYPES)).min(1, "Select at least one transaction type"),
    controlPreference: z.enum(CONTROL_PREFERENCES).default("MAJORITY_CONTROL"),
    strategicObjectives: z.array(z.string()).min(1, "Select at least one strategic objective"),
    otherStrategicObjective: z.string().max(500).optional().nullable(),
    // Preferences
    preferredBusinessAge: z.string().max(100).optional().nullable(),
    promoterInvolvement: z.string().max(100).optional().nullable(),
    promoterExitPreference: z.string().max(100).optional().nullable(),
    existingManagementRetention: z.string().max(100).optional().nullable(),
    turnaroundOpportunities: z.boolean().default(false),
    profitableBusinessesOnly: z.boolean().default(true),
    growthStage: z.boolean().default(true),
    distressedOpportunities: z.boolean().default(false),
    assetPreference: z.enum(["ASSET_HEAVY", "ASSET_LIGHT", "FLEXIBLE"]).default("FLEXIBLE"),
    // Horizon & Funding
    investmentHorizon: z.enum(INVESTMENT_HORIZONS).default("MEDIUM_TERM"),
    expectedHoldingPeriodYears: z.number().int().min(1).max(30).optional().nullable(),
    fundingSource: z.enum(FUNDING_SOURCES).default("OWN_CAPITAL"),
    // Multi-Relational Targets
    targetIndustries: z.array(MandateTargetIndustrySchema).min(1, "At least one target industry is required"),
    targetGeographies: z.array(MandateTargetGeographySchema).min(1, "At least one target geography is required"),
  })
  .strict()
  .refine((data) => data.minInvestment <= data.maxInvestment, {
    message: "Minimum investment cannot exceed maximum investment",
    path: ["minInvestment"],
  })
  .refine(
    (data) => {
      if (data.revenueMax !== null && data.revenueMax !== undefined) {
        return data.revenueMin <= data.revenueMax;
      }
      return true;
    },
    {
      message: "Revenue minimum cannot exceed revenue maximum",
      path: ["revenueMin"],
    }
  )
  .refine(
    (data) => {
      if (
        data.ebitdaMin !== null &&
        data.ebitdaMin !== undefined &&
        data.ebitdaMax !== null &&
        data.ebitdaMax !== undefined
      ) {
        return data.ebitdaMin <= data.ebitdaMax;
      }
      return true;
    },
    {
      message: "EBITDA minimum cannot exceed EBITDA maximum",
      path: ["ebitdaMin"],
    }
  )
  .refine(
    (data) => {
      if (
        data.employeeMin !== null &&
        data.employeeMin !== undefined &&
        data.employeeMax !== null &&
        data.employeeMax !== undefined
      ) {
        return data.employeeMin <= data.employeeMax;
      }
      return true;
    },
    {
      message: "Employee minimum cannot exceed employee maximum",
      path: ["employeeMin"],
    }
  )
  .refine(
    (data) => {
      if (
        data.businessAgeMin !== null &&
        data.businessAgeMin !== undefined &&
        data.businessAgeMax !== null &&
        data.businessAgeMax !== undefined
      ) {
        return data.businessAgeMin <= data.businessAgeMax;
      }
      return true;
    },
    {
      message: "Business age minimum cannot exceed business age maximum",
      path: ["businessAgeMin"],
    }
  )
  .refine(
    (data) => {
      if (
        data.netWorthMin !== null &&
        data.netWorthMin !== undefined &&
        data.netWorthMax !== null &&
        data.netWorthMax !== undefined
      ) {
        return data.netWorthMin <= data.netWorthMax;
      }
      return true;
    },
    {
      message: "Net worth minimum cannot exceed net worth maximum",
      path: ["netWorthMin"],
    }
  );

export const BuyerDraftAutosaveSchema = z
  .object({
    lastActiveStep: z.number().int().min(1).max(12).default(1),
    draftPayload: z.record(z.any()).default({}),
    sectionsCompleted: z.array(z.string()).optional(),
  })
  .strict();

export const AdminBuyerReviewActionSchema = z
  .object({
    action: z.enum(["START_REVIEW", "REQUEST_CHANGES", "VERIFY", "REJECT", "SUSPEND"]),
    notes: z.string().max(2000).optional(),
    changesRequestedNotes: z.string().max(2000).optional(),
    rejectionReason: z.string().max(2000).optional(),
    suspensionReason: z.string().max(2000).optional(),
  })
  .strict();

export const AddBuyerInternalNoteSchema = z
  .object({
    content: z.string().min(1, "Note content cannot be empty").max(4000),
    category: z
      .enum(["GENERAL", "COMPLIANCE", "FINANCIAL", "MANDATE", "RISK"])
      .default("GENERAL"),
  })
  .strict();

