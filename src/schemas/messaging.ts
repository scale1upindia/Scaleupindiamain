// Scale-up India — Phase 9: Secure Deal Communication Schemas
// Path: src/schemas/messaging.ts

import { z } from "zod";

/**
 * Message creation input schema
 * Enforces size limits, disallows control characters/null bytes, rejects empty bodies
 */
export const createDealMessageSchema = z.object({
  content: z
    .string({ required_error: "Message content is required" })
    .trim()
    .min(1, "Message content cannot be empty")
    .max(4000, "Message content cannot exceed 4000 characters")
    .refine((val) => !val.includes("\0"), {
      message: "Null bytes are prohibited in message content",
    })
    .refine((val) => !/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(val), {
      message: "Unprintable control characters are prohibited",
    }),
});

export type CreateDealMessageInput = z.infer<typeof createDealMessageSchema>;

/**
 * Conversation initiation schema
 */
export const initiateDealConversationSchema = z.object({
  ndaId: z.string().uuid("Invalid NDA agreement identifier"),
  title: z
    .string()
    .trim()
    .max(255, "Title cannot exceed 255 characters")
    .optional(),
});

export type InitiateDealConversationInput = z.infer<typeof initiateDealConversationSchema>;

/**
 * Conversation closure schema
 */
export const closeDealConversationSchema = z.object({
  closeReason: z
    .string()
    .trim()
    .max(500, "Closure reason cannot exceed 500 characters")
    .optional(),
});

export type CloseDealConversationInput = z.infer<typeof closeDealConversationSchema>;

/**
 * Administrative conversation revocation schema
 */
export const revokeDealConversationSchema = z.object({
  revokeReason: z
    .string({ required_error: "Revocation reason is required" })
    .trim()
    .min(5, "Revocation reason must be at least 5 characters")
    .max(500, "Revocation reason cannot exceed 500 characters"),
});

export type RevokeDealConversationInput = z.infer<typeof revokeDealConversationSchema>;

/**
 * Cursor-based pagination query schema
 */
export const getMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(30),
});

export type GetMessagesQueryInput = z.infer<typeof getMessagesQuerySchema>;
