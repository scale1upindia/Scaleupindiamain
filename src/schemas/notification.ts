// Scale-up India — Phase 15: Notification Zod Schemas
// Path: src/schemas/notification.ts

import { z } from "zod";

export const notificationCategorySchema = z.enum([
  "SECURITY",
  "TRANSACTION",
  "PAYMENT",
  "DILIGENCE",
  "DEAL_ACTIVITY",
  "MESSAGING",
  "MARKETING_INFORMATIONAL",
]);

export const notificationSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL", "SUCCESS"]);

export const notificationChannelSchema = z.enum(["IN_APP", "EMAIL", "SMS", "WHATSAPP"]);

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z
    .preprocess((val) => (val === "true" || val === true ? true : false), z.boolean())
    .default(false),
  category: notificationCategorySchema.optional(),
});

export const updatePreferenceSchema = z.object({
  category: notificationCategorySchema,
  channel: notificationChannelSchema,
  isEnabled: z.boolean(),
});

export const updatePreferencesBatchSchema = z.object({
  preferences: z.array(updatePreferenceSchema).min(1).max(20),
});

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
export type UpdatePreferencesBatchInput = z.infer<typeof updatePreferencesBatchSchema>;
