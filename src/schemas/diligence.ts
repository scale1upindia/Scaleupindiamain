// Scale-up India — Phase 12: Due Diligence Zod Schemas
// Path: src/schemas/diligence.ts

import { z } from "zod";

export const DILIGENCE_CATEGORIES = [
  "CORPORATE_LEGAL",
  "OWNERSHIP",
  "FINANCIAL",
  "TAX",
  "BANKING",
  "COMPLIANCE",
  "CONTRACTS",
  "INTELLECTUAL_PROPERTY",
  "EMPLOYEES_HR",
  "LITIGATION",
  "REGULATORY",
  "TECHNOLOGY",
  "ASSETS",
  "LIABILITIES",
  "CUSTOMERS_VENDORS",
  "INSURANCE",
  "OTHER",
] as const;

export const DILIGENCE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const FINDING_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export const FINDING_STATUSES = [
  "OPEN",
  "UNDER_DISCUSSION",
  "MITIGATED",
  "ACCEPTED_RISK",
  "RESOLVED",
  "CLOSED",
] as const;

export const createDiligenceCaseSchema = z.object({
  scopeDescription: z.string().max(2000).optional(),
  targetCompletionDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

export const createDiligenceRequestSchema = z.object({
  checklistItemId: z.string().uuid("Checklist item ID must be a valid UUID"),
  requestDescription: z.string().min(10, "Request description must be at least 10 characters").max(2000),
  required: z.boolean().optional().default(true),
  priority: z.enum(DILIGENCE_PRIORITIES).optional().default("MEDIUM"),
  dueDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

export const uploadEvidenceMetadataSchema = z.object({
  checklistItemId: z.string().uuid("Checklist item ID must be a valid UUID"),
  requestId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  category: z.enum(DILIGENCE_CATEGORIES),
  isConfidential: z.boolean().optional().default(true),
});

export const reviewEvidenceSchema = z.object({
  decision: z.enum(["ACCEPTED", "REJECTED", "CLARIFICATION_REQUIRED"]),
  notes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(1000).optional(),
  clarificationQuestion: z.string().max(2000).optional(),
}).refine(
  (data) => {
    if (data.decision === "REJECTED" && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
      return false;
    }
    if (data.decision === "CLARIFICATION_REQUIRED" && (!data.clarificationQuestion || data.clarificationQuestion.trim().length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: "Rejection requires a rejectionReason, and clarification requests require a clarificationQuestion.",
  }
);

export const respondClarificationSchema = z.object({
  responseText: z.string().min(5, "Response text must be at least 5 characters").max(4000),
});

export const createFindingSchema = z.object({
  checklistItemId: z.string().uuid().optional().nullable(),
  evidenceId: z.string().uuid().optional().nullable(),
  category: z.enum(DILIGENCE_CATEGORIES),
  severity: z.enum(FINDING_SEVERITIES).default("MEDIUM"),
  title: z.string().min(5, "Title must be at least 5 characters").max(255),
  description: z.string().min(10, "Description must be at least 10 characters").max(4000),
  financialImpactEstimate: z.number().nonnegative().optional().nullable(),
  remediationPlan: z.string().max(4000).optional().nullable(),
});

export const updateFindingSchema = z.object({
  status: z.enum(FINDING_STATUSES).optional(),
  remediationPlan: z.string().max(4000).optional().nullable(),
  resolutionNotes: z.string().max(4000).optional().nullable(),
});

export const transitionCaseStatusSchema = z.object({
  targetStatus: z.enum([
    "CREATED",
    "INITIATED",
    "REQUESTS_OPEN",
    "DOCUMENTS_SUBMITTED",
    "UNDER_REVIEW",
    "CLARIFICATION_REQUIRED",
    "REVIEW_COMPLETE",
    "APPROVED",
    "REJECTED",
    "CLOSED",
  ]),
  verdict: z.enum(["APPROVED", "REJECTED", "CONDITIONAL_APPROVAL"]).optional().nullable(),
  verdictNotes: z.string().max(4000).optional().nullable(),
  closureReason: z.string().max(2000).optional().nullable(),
});

export type CreateDiligenceCaseInput = z.input<typeof createDiligenceCaseSchema>;
export type CreateDiligenceRequestInput = z.input<typeof createDiligenceRequestSchema>;
export type UploadEvidenceMetadataInput = z.input<typeof uploadEvidenceMetadataSchema>;
export type ReviewEvidenceInput = z.input<typeof reviewEvidenceSchema>;
export type RespondClarificationInput = z.input<typeof respondClarificationSchema>;
export type CreateFindingInput = z.input<typeof createFindingSchema>;
export type UpdateFindingInput = z.input<typeof updateFindingSchema>;
export type TransitionCaseStatusInput = z.input<typeof transitionCaseStatusSchema>;
