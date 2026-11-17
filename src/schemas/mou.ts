// Scale-up India — Phase 10: Deal Intent & Bilateral MOU Validation Schemas
// Path: src/schemas/mou.ts

import { z } from "zod";

export const proposedStructureEnum = z.enum([
  "FULL_ACQUISITION",
  "MAJORITY_STAKE",
  "MINORITY_STAKE",
  "ASSET_PURCHASE",
  "JOINT_VENTURE",
]);

export const mouCommercialTermsSchema = z.object({
  proposedValuation: z
    .number({ required_error: "Proposed valuation is required" })
    .positive("Proposed valuation must be strictly greater than 0"),
  currency: z.string().default("INR"),
  proposedStructure: proposedStructureEnum,
  cashConsideration: z
    .number()
    .min(0, "Cash consideration cannot be negative")
    .default(0),
  equityConsideration: z
    .number()
    .min(0, "Equity consideration cannot be negative")
    .default(0),
  earnestDepositAmount: z
    .number()
    .min(0, "Earnest deposit cannot be negative")
    .default(0),
  exclusivityPeriodDays: z
    .number()
    .int()
    .min(0, "Exclusivity period cannot be negative")
    .max(180, "Exclusivity period cannot exceed 180 days")
    .default(30),
  dueDiligenceWindowDays: z
    .number()
    .int()
    .min(0, "Due diligence window cannot be negative")
    .max(180, "Due diligence window cannot exceed 180 days")
    .default(45),
  targetClosingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target closing date must be in YYYY-MM-DD format")
    .optional()
    .nullable(),
  conditionsPrecedent: z
    .array(z.string().trim().max(300, "Condition exceeds maximum length"))
    .max(20, "Cannot specify more than 20 conditions precedent")
    .optional()
    .default([]),
  keyAssumptions: z
    .string()
    .trim()
    .max(3000, "Key assumptions cannot exceed 3000 characters")
    .optional()
    .nullable(),
  summaryNotes: z
    .string()
    .trim()
    .max(2000, "Summary notes cannot exceed 2000 characters")
    .optional()
    .nullable(),
  validityDays: z
    .number()
    .int()
    .min(1, "Validity must be at least 1 day")
    .max(90, "Validity cannot exceed 90 days")
    .optional()
    .default(14),
});

export const createMOUInputSchema = z.object({
  ndaId: z.string().uuid("A valid bilateral NDA ID is required"),
  terms: mouCommercialTermsSchema,
  submitImmediately: z.boolean().optional().default(false),
});

export const counterMOUInputSchema = z.object({
  terms: mouCommercialTermsSchema,
});

export const rejectMOUInputSchema = z.object({
  reason: z
    .string({ required_error: "Rejection reason is required" })
    .trim()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(1000, "Rejection reason cannot exceed 1000 characters"),
});

export const withdrawMOUInputSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(1000, "Withdrawal reason cannot exceed 1000 characters")
    .optional()
    .nullable(),
});

export const acceptMOUInputSchema = z.object({
  confirmed: z.literal(true, {
    errorMap: () => ({ message: "You must explicitly confirm bilateral deal intent acceptance." }),
  }),
  notes: z
    .string()
    .trim()
    .max(1000, "Acceptance notes cannot exceed 1000 characters")
    .optional()
    .nullable(),
});

export type CreateMOUInput = z.input<typeof createMOUInputSchema>;
export type CounterMOUInput = z.input<typeof counterMOUInputSchema>;
export type RejectMOUInput = z.input<typeof rejectMOUInputSchema>;
export type WithdrawMOUInput = z.input<typeof withdrawMOUInputSchema>;
export type AcceptMOUInput = z.input<typeof acceptMOUInputSchema>;
export type MOUCommercialTermsInput = z.input<typeof mouCommercialTermsSchema>;
