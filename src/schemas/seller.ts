import { z } from "zod";

export const BusinessTypeEnum = z.enum([
  "PRIVATE_LIMITED",
  "PUBLIC_LIMITED",
  "LLP",
  "PARTNERSHIP_FIRM",
  "SOLE_PROPRIETORSHIP",
  "OTHER",
]);

export const MSMEStatusEnum = z.enum(["MICRO", "SMALL", "MEDIUM", "NONE"]);

export const TransactionIntentEnum = z.enum([
  "FULL_SALE",
  "PARTIAL_STAKE_SALE",
  "INVESTMENT",
  "JOINT_VENTURE",
  "STRATEGIC_PARTNERSHIP",
  "ASSET_SALE",
]);

export const OwnerTypeEnum = z.enum([
  "INDIVIDUAL_PROMOTER",
  "CORPORATE_ENTITY",
  "PE_VC_FUND",
  "ESOP_POOL",
  "OTHER",
]);

export const SellerDocumentTypeEnum = z.enum([
  "INCORPORATION_CERT",
  "PAN_CARD",
  "GST_REGISTRATION",
  "AUDITED_FINANCIALS",
  "ITR_ACKNOWLEDGEMENT",
  "FORM_26AS",
  "SHAREHOLDING_PATTERN",
  "REGULATORY_APPROVAL",
  "OTHER",
]);

// 1. Promoter Profile Schema
export const SellerProfileSchema = z
  .object({
    designation: z.string().trim().min(2, "Designation is required").max(100),
    mobile: z
      .string()
      .trim()
      .regex(/^(\+91[\-\s]?)?[0]?(91)?[6789]\d{9}$/, "Please provide a valid Indian mobile number"),
    email: z.string().trim().toLowerCase().email("Please provide a valid email address"),
    preferredCommMethod: z.enum(["IN_APP", "EMAIL", "PHONE", "WHATSAPP"]).default("IN_APP"),
  })
  .strict();

// 2. Business Profile Schema
export const BusinessProfileSchema = z
  .object({
    legalName: z.string().trim().min(2, "Legal business name is required").max(255),
    tradeName: z.string().trim().max(255).optional().or(z.literal("")),
    businessType: BusinessTypeEnum,
    cin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[LUlu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/, "Invalid 21-character Corporate Identification Number (CIN)")
      .optional()
      .or(z.literal("")),
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}Z[0-9A-Za-z]{1}$/, "Invalid 15-character GSTIN format")
      .optional()
      .or(z.literal("")),
    pan: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/, "Invalid 10-character Permanent Account Number (PAN) format")
      .optional()
      .or(z.literal("")),
    industry: z.string().trim().min(2, "Industry is required").max(100),
    subSector: z.string().trim().max(100).optional().or(z.literal("")),
    yearEstablished: z
      .number()
      .int()
      .min(1800, "Year established must be after 1800")
      .max(new Date().getFullYear(), "Year established cannot be in the future"),
    registeredState: z.string().trim().min(2, "Registered state is required").max(100),
    registeredCity: z.string().trim().min(2, "Registered city is required").max(100),
    operatingLocations: z.array(z.string().trim()).default([]),
    employeeCount: z.number().int().min(0, "Employee count cannot be negative"),
    businessDescription: z
      .string()
      .trim()
      .min(20, "Business description must be at least 20 characters")
      .max(5000),
    website: z
      .string()
      .trim()
      .url("Please provide a valid URL (including https://)")
      .optional()
      .or(z.literal("")),
    msmeStatus: MSMEStatusEnum.default("NONE"),
    otherRegistrations: z.array(z.string().trim()).default([]),
  })
  .strict();

// 3. Financial Profile Schema
export const FinancialYearSchema = z
  .object({
    financialYear: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}$/, "Financial year must follow format 'YYYY-YY' (e.g. 2023-24)"),
    revenue: z.number().min(0, "Revenue cannot be negative"),
    ebitda: z.number(),
    pat: z.number(),
    netWorth: z.number(),
    debt: z.number().min(0, "Debt cannot be negative").default(0),
    assets: z.number().min(0, "Assets cannot be negative"),
    liabilities: z.number().min(0, "Liabilities cannot be negative"),
    cashFlow: z.number().optional().nullable(),
    isAudited: z.boolean().default(true),
  })
  .strict();

export const BulkFinancialsSchema = z
  .object({
    financials: z.array(FinancialYearSchema).min(1, "Please provide at least one financial year record"),
  })
  .strict();

// 4. Ownership Profile Schema
export const OwnershipItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    ownerType: OwnerTypeEnum,
    ownerName: z.string().trim().min(2, "Owner name is required").max(255),
    ownershipPercentage: z
      .number()
      .min(0.01, "Ownership percentage must be greater than 0")
      .max(100, "Ownership percentage cannot exceed 100"),
    holdingEntity: z.string().trim().max(255).optional().or(z.literal("")),
    role: z.string().trim().max(100).optional().or(z.literal("")),
    controlRights: z.string().trim().max(1000).optional().or(z.literal("")),
  })
  .strict();

export const BulkOwnershipSchema = z
  .object({
    ownerships: z
      .array(OwnershipItemSchema)
      .min(1, "Please provide at least one ownership record")
      .refine(
        (items) => {
          const total = items.reduce((acc, curr) => acc + curr.ownershipPercentage, 0);
          return Math.abs(total - 100) < 0.01 || total <= 100;
        },
        { message: "Total ownership percentage across all owners cannot exceed 100%" }
      ),
  })
  .strict();

// 5. Transaction Preferences Schema
export const SellerTransactionPreferenceSchema = z
  .object({
    intents: z.array(TransactionIntentEnum).min(1, "Select at least one transaction intent"),
    stakeOfferedPercentage: z
      .number()
      .min(0, "Stake offered cannot be negative")
      .max(100, "Stake offered cannot exceed 100")
      .optional()
      .nullable(),
    expectedValuation: z.number().min(0, "Expected valuation cannot be negative").optional().nullable(),
    expectedTransactionValue: z
      .number()
      .min(0, "Expected transaction value cannot be negative")
      .optional()
      .nullable(),
    minAcceptableTerms: z.string().trim().max(2000).optional().or(z.literal("")),
    preferredTimeline: z.string().trim().max(100).optional().or(z.literal("")),
    preferredBuyerType: z.array(z.string().trim()).default([]),
    strategicObjectives: z.string().trim().max(2000).optional().or(z.literal("")),
    reasonForTransaction: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .strict();

// 6. Draft Autosave Schema (Permits partial inputs without failing section-level required checks)
export const SaveDraftSchema = z
  .object({
    lastActiveSection: z.enum([
      "promoter",
      "identity",
      "overview",
      "financials",
      "ownership",
      "intent",
      "documents",
      "review",
    ]),
    draftPayload: z.record(z.any()),
  })
  .strict();

// 7. Admin Action Schema
export const AdminReviewActionSchema = z
  .object({
    action: z.enum(["START_REVIEW", "REQUEST_CHANGES", "VERIFY", "REJECT"]),
    notes: z.string().trim().max(2000).optional(),
    rejectionReason: z.string().trim().max(2000).optional(),
    changesRequestedNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

// 8. Internal Note Schema
export const AddInternalNoteSchema = z
  .object({
    content: z.string().trim().min(5, "Note must be at least 5 characters").max(2000),
    category: z.enum(["GENERAL", "COMPLIANCE", "FINANCIAL", "VALUATION", "RISK"]).default("GENERAL"),
  })
  .strict();

