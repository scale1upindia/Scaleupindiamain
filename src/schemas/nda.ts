// Scale-up India — Phase 8: Bilateral NDA & Secure Data Room Validation Schemas
// Path: src/schemas/nda.ts

import { z } from "zod";

export const NDAStatusEnum = z.enum([
  "NDA_DRAFT",
  "NDA_SENT",
  "BUYER_VIEWED",
  "BUYER_ACCEPTED",
  "SELLER_ACCEPTED",
  "EXECUTED",
  "DECLINED",
  "EXPIRED",
  "REVOKED",
]);

export const DataRoomDocumentCategoryEnum = z.enum([
  "FINANCIAL",
  "TAX",
  "LEGAL",
  "CORPORATE",
  "OPERATIONAL",
  "COMMERCIAL",
  "HR",
  "TECHNICAL",
  "OTHER",
]);

export const DataRoomDocumentAccessLevelEnum = z.enum([
  "ROOM_MEMBER",
  "AUTHORIZED_BUYER",
  "AUTHORIZED_SELLER",
  "ADMIN",
]);

export const createNDASchema = z.object({
  eoiId: z.string().uuid("A valid accepted EOI ID is required"),
});

export type CreateNDAInput = z.infer<typeof createNDASchema>;

export const acceptNDASchema = z.object({
  termsAcknowledged: z
    .boolean()
    .refine((v) => v === true, "You must formally acknowledge and accept the bilateral NDA covenants"),
  comment: z.string().trim().max(500).optional().nullable(),
});

export type AcceptNDAInput = z.infer<typeof acceptNDASchema>;

export const declineNDASchema = z.object({
  declineReason: z
    .string()
    .trim()
    .min(5, "Decline reason must be at least 5 characters")
    .max(1000, "Decline reason cannot exceed 1000 characters"),
});

export type DeclineNDAInput = z.infer<typeof declineNDASchema>;

export const revokeNDASchema = z.object({
  revokeReason: z
    .string()
    .trim()
    .min(5, "Revocation reason must be at least 5 characters")
    .max(1000, "Revocation reason cannot exceed 1000 characters"),
});

export type RevokeNDAInput = z.infer<typeof revokeNDASchema>;

export const uploadDataRoomDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Document title is required")
    .max(255, "Document title cannot exceed 255 characters"),
  documentCategory: DataRoomDocumentCategoryEnum,
  accessLevel: DataRoomDocumentAccessLevelEnum.default("ROOM_MEMBER"),
});

export type UploadDataRoomDocumentInput = z.infer<typeof uploadDataRoomDocumentSchema>;

export const generateSignedUrlSchema = z.object({
  expiresInSeconds: z
    .number()
    .int()
    .min(60, "Expiry cannot be shorter than 60 seconds")
    .max(1800, "Expiry cannot exceed 1800 seconds (30 minutes)")
    .default(300), // Default 5 minutes
});

export type GenerateSignedUrlInput = z.infer<typeof generateSignedUrlSchema>;
