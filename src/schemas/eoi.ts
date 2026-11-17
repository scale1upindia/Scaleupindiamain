// Scale-up India — Phase 7: Expression of Interest (EOI) Validation Schemas
// Path: src/schemas/eoi.ts

import { z } from "zod";

export const EOIInterestTypeEnum = z.enum([
  "FULL_ACQUISITION",
  "MAJORITY_STAKE",
  "MINORITY_STAKE",
  "STRATEGIC_INVESTMENT",
  "JOINT_VENTURE",
  "PARTNERSHIP",
  "OTHER",
]);

export const EOITimelineEnum = z.enum([
  "IMMEDIATE_30_DAYS",
  "1_TO_3_MONTHS",
  "3_TO_6_MONTHS",
  "FLEXIBLE",
]);

export const IndicativeOfferRangeEnum = z.enum([
  "UNDER_10CR",
  "10CR_TO_25CR",
  "25CR_TO_50CR",
  "50CR_TO_100CR",
  "OVER_100CR",
  "NEGOTIABLE",
]);

export const EOIDeclineReasonEnum = z.enum([
  "VALUATION_MISMATCH",
  "STRATEGY_MISMATCH",
  "CAPACITY_CONCERN",
  "ALREADY_COMMITTED",
  "NOT_ACCEPTING_OFFERS",
  "OTHER",
]);

export const EOIStatusEnum = z.enum([
  "SUBMITTED",
  "UNDER_REVIEW",
  "CLARIFICATION_REQUESTED",
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
  "EXPIRED",
]);

/**
 * Buyer submission payload
 */
export const createEOISchema = z.object({
  interestType: EOIInterestTypeEnum,
  proposedTransactionType: z.string().trim().min(2, "Transaction type is required").max(100),
  indicativeOfferRange: IndicativeOfferRangeEnum.optional().nullable(),
  investmentTimeline: EOITimelineEnum,
  buyerMessage: z
    .string()
    .trim()
    .min(20, "Buyer message must be at least 20 characters")
    .max(2000, "Buyer message cannot exceed 2000 characters"),
  mandateId: z.string().uuid().optional().nullable(),
});

export type CreateEOIInput = z.infer<typeof createEOISchema>;

/**
 * Seller Accept payload
 */
export const sellerAcceptEOISchema = z.object({
  sellerResponseMessage: z.string().trim().max(1000).optional().nullable(),
});

export type SellerAcceptEOIInput = z.infer<typeof sellerAcceptEOISchema>;

/**
 * Seller Decline payload
 */
export const sellerDeclineEOISchema = z.object({
  sellerDeclineReason: EOIDeclineReasonEnum,
  sellerResponseMessage: z.string().trim().max(1000).optional().nullable(),
});

export type SellerDeclineEOIInput = z.infer<typeof sellerDeclineEOISchema>;

/**
 * Seller Request Clarification payload
 */
export const sellerClarifyEOISchema = z.object({
  clarificationQuestions: z
    .string()
    .trim()
    .min(10, "Clarification questions must be at least 10 characters")
    .max(1000, "Clarification questions cannot exceed 1000 characters"),
});

export type SellerClarifyEOIInput = z.infer<typeof sellerClarifyEOISchema>;

/**
 * Buyer Provide Clarification payload
 */
export const buyerClarifyEOISchema = z.object({
  clarificationAnswers: z
    .string()
    .trim()
    .min(10, "Clarification answers must be at least 10 characters")
    .max(1000, "Clarification answers cannot exceed 1000 characters"),
});

export type BuyerClarifyEOIInput = z.infer<typeof buyerClarifyEOISchema>;

/**
 * Query schema for listing EOIs
 */
export const eoiQuerySchema = z.object({
  status: EOIStatusEnum.optional(),
  opportunityId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type EOIQueryInput = z.infer<typeof eoiQuerySchema>;
