// Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine Schemas
// Path: src/schemas/transaction.ts

import { z } from "zod";

export const transactionTypeEnum = z.enum([
  "SHARE_ACQUISITION",
  "ASSET_ACQUISITION",
  "BUSINESS_TRANSFER",
]);

export const paymentStructureEnum = z.enum([
  "FULL_ESCROW",
  "TRANCHE_BASED",
  "LUMP_SUM_AT_CLOSING",
]);

export const tokenDepositTreatmentEnum = z.enum([
  "CREDITED_TOWARD_CONSIDERATION",
  "REFUNDED_TO_BUYER",
  "RELEASED_TO_SELLER",
]);

export const createTransactionSchema = z.object({
  valuationCaseId: z.string().uuid("Invalid valuation case ID").optional(),
  valuationVersionId: z.string().uuid("Invalid valuation version ID").optional(),
  transactionType: transactionTypeEnum.default("SHARE_ACQUISITION"),
  agreedAmount: z.number().positive("Agreed consideration must be a positive amount").optional(),
  currency: z.string().min(3).max(10).default("INR"),
  paymentStructure: paymentStructureEnum.default("FULL_ESCROW"),
  tokenDepositTreatment: tokenDepositTreatmentEnum.default("CREDITED_TOWARD_CONSIDERATION"),
  targetClosingDate: z.string().datetime().optional().nullable(),
  governingLaw: z.string().min(2).max(100).default("Indian Law"),
  disputeResolution: z.string().min(2).max(150).default("Arbitration in New Delhi"),
  notes: z.string().max(2000).optional().nullable(),
});

export const updateTransactionTermsSchema = z.object({
  transactionType: transactionTypeEnum.optional(),
  agreedAmount: z.number().positive("Agreed consideration must be a positive amount").optional(),
  currency: z.string().min(3).max(10).optional(),
  paymentStructure: paymentStructureEnum.optional(),
  tokenDepositTreatment: tokenDepositTreatmentEnum.optional(),
  targetClosingDate: z.string().datetime().optional().nullable(),
  governingLaw: z.string().min(2).max(100).optional(),
  disputeResolution: z.string().min(2).max(150).optional(),
  specialConditions: z.string().max(4000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const createTransactionVersionSchema = z.object({
  transactionType: transactionTypeEnum.optional(),
  agreedAmount: z.number().positive("Agreed consideration must be a positive amount").optional(),
  currency: z.string().min(3).max(10).optional(),
  paymentStructure: paymentStructureEnum.optional(),
  tokenDepositTreatment: tokenDepositTreatmentEnum.optional(),
  targetClosingDate: z.string().datetime().optional().nullable(),
  governingLaw: z.string().min(2).max(100).optional(),
  disputeResolution: z.string().min(2).max(150).optional(),
  specialConditions: z.string().max(4000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export const waiveConditionSchema = z.object({
  waiverReason: z
    .string()
    .min(5, "Waiver reason must be provided and contain at least 5 characters"),
});

export const confirmTransactionSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const reviewTransactionSchema = z.object({
  decision: z.enum(["APPROVED", "REVISION_REQUIRED", "REJECTED"]),
  notes: z.string().min(3, "Review notes are required"),
});

export const closeTransactionSchema = z.object({
  confirmationStatement: z.string().optional(),
});

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionTermsInput = z.input<typeof updateTransactionTermsSchema>;
export type CreateTransactionVersionInput = z.input<typeof createTransactionVersionSchema>;
export type WaiveConditionInput = z.input<typeof waiveConditionSchema>;
export type ConfirmTransactionInput = z.input<typeof confirmTransactionSchema>;
export type ReviewTransactionInput = z.input<typeof reviewTransactionSchema>;
export type CloseTransactionInput = z.input<typeof closeTransactionSchema>;
