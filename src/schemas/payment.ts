// Scale-up India — Phase 11: Payment & Token Architecture Schemas
// Path: src/schemas/payment.ts

import { z } from "zod";

export const createPaymentIntentSchema = z.object({
  amount: z
    .number()
    .positive("Payment amount must be greater than zero")
    .optional(),
  currency: z
    .string()
    .default("INR")
    .refine((val) => val.toUpperCase() === "INR", {
      message: "Unsupported currency. Transaction must be denominated in INR.",
    }),
  purpose: z
    .enum(["EARNEST_DEPOSIT", "PLATFORM_FEE", "ESCROW_TOKEN"])
    .default("EARNEST_DEPOSIT"),
  idempotencyKey: z
    .string()
    .max(255, "Idempotency key must not exceed 255 characters")
    .optional(),
});

export type CreatePaymentIntentInput = z.input<typeof createPaymentIntentSchema>;

export const cancelPaymentIntentSchema = z.object({
  reason: z
    .string()
    .min(5, "Cancellation reason must be at least 5 characters")
    .max(500, "Cancellation reason must not exceed 500 characters"),
});

export type CancelPaymentIntentInput = z.input<typeof cancelPaymentIntentSchema>;

export const refundPaymentIntentSchema = z.object({
  amount: z
    .number()
    .positive("Refund amount must be greater than zero")
    .optional(),
  reason: z
    .string()
    .min(10, "Refund reason must be at least 10 characters")
    .max(500, "Refund reason must not exceed 500 characters"),
  idempotencyKey: z
    .string()
    .max(255, "Idempotency key must not exceed 255 characters")
    .optional(),
});

export type RefundPaymentIntentInput = z.input<typeof refundPaymentIntentSchema>;
