// Scale-up India — Phase 12: Due Diligence Types & Domain Models
// Path: src/types/diligence.ts

export type DiligenceCaseStatus =
  | "CREATED"
  | "INITIATED"
  | "REQUESTS_OPEN"
  | "DOCUMENTS_SUBMITTED"
  | "UNDER_REVIEW"
  | "CLARIFICATION_REQUIRED"
  | "REVIEW_COMPLETE"
  | "APPROVED"
  | "REJECTED"
  | "CLOSED";

export type DiligenceCaseVerdict =
  | "APPROVED"
  | "REJECTED"
  | "CONDITIONAL_APPROVAL";

export type DiligenceCategory =
  | "CORPORATE_LEGAL"
  | "OWNERSHIP"
  | "FINANCIAL"
  | "TAX"
  | "BANKING"
  | "COMPLIANCE"
  | "CONTRACTS"
  | "INTELLECTUAL_PROPERTY"
  | "EMPLOYEES_HR"
  | "LITIGATION"
  | "REGULATORY"
  | "TECHNOLOGY"
  | "ASSETS"
  | "LIABILITIES"
  | "CUSTOMERS_VENDORS"
  | "INSURANCE"
  | "OTHER";

export type ChecklistItemStatus =
  | "PENDING"
  | "REQUESTED"
  | "EVIDENCE_SUBMITTED"
  | "UNDER_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "CLARIFICATION_REQUIRED"
  | "WAIVED";

export type ChecklistItemPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DiligenceRequestStatus =
  | "OPEN"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "CLARIFICATION_REQUESTED"
  | "CANCELLED";

export type EvidenceStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "CLARIFICATION_REQUIRED";

export type EvidenceReviewStatus =
  | "PENDING_REVIEW"
  | "ACCEPTED"
  | "REJECTED"
  | "CLARIFICATION_REQUIRED";

export type ClarificationStatus =
  | "OPEN"
  | "ANSWERED"
  | "RESOLVED"
  | "CLOSED";

export type FindingSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type FindingStatus =
  | "OPEN"
  | "UNDER_DISCUSSION"
  | "MITIGATED"
  | "ACCEPTED_RISK"
  | "RESOLVED"
  | "CLOSED";

export type DiligenceMemberRole =
  | "BUYER"
  | "SELLER"
  | "REVIEWER"
  | "LEAD_REVIEWER"
  | "ADMIN";

// Database Records
export interface DiligenceCaseRecord {
  id: string;
  reference_code: string;
  opportunity_id: string;
  mou_id: string;
  nda_id: string;
  token_deposit_id: string | null;
  buyer_id: string;
  seller_id: string;
  lead_reviewer_id: string | null;
  status: DiligenceCaseStatus;
  scope_description: string | null;
  target_completion_date: string | null;
  completed_at: string | null;
  closed_at: string | null;
  closure_reason: string | null;
  verdict: DiligenceCaseVerdict | null;
  verdict_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiligenceMemberRecord {
  id: string;
  case_id: string;
  user_id: string;
  role: DiligenceMemberRole;
  access_status: "ACTIVE" | "REVOKED" | "SUSPENDED";
  granted_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
}

export interface DiligenceChecklistItemRecord {
  id: string;
  case_id: string;
  category: DiligenceCategory;
  title: string;
  description: string;
  required: boolean;
  requested_evidence_type: string;
  status: ChecklistItemStatus;
  priority: ChecklistItemPriority;
  due_date: string | null;
  reviewer_id: string | null;
  seller_notes: string | null;
  evidence_count: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DiligenceRequestRecord {
  id: string;
  reference_code: string;
  case_id: string;
  checklist_item_id: string;
  requested_by: string;
  assigned_party_id: string;
  request_description: string;
  required: boolean;
  priority: ChecklistItemPriority;
  due_date: string | null;
  status: DiligenceRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface DiligenceEvidenceRecord {
  id: string;
  reference_code: string;
  case_id: string;
  checklist_item_id: string;
  request_id: string | null;
  title: string;
  category: DiligenceCategory;
  current_version_number: number;
  status: EvidenceStatus;
  uploaded_by: string;
  is_confidential: boolean;
  created_at: string;
  updated_at: string;
}

export interface DiligenceEvidenceVersionRecord {
  id: string;
  evidence_id: string;
  version_number: number;
  uploaded_by: string;
  storage_key: string;
  original_filename: string;
  file_size: string | number;
  mime_type: string;
  checksum: string;
  review_status: EvidenceReviewStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export interface DiligenceClarificationRecord {
  id: string;
  case_id: string;
  checklist_item_id: string;
  evidence_id: string | null;
  version_id: string | null;
  raised_by: string;
  question: string;
  status: ClarificationStatus;
  responded_by: string | null;
  response_text: string | null;
  responded_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiligenceFindingRecord {
  id: string;
  reference_code: string;
  case_id: string;
  checklist_item_id: string | null;
  evidence_id: string | null;
  created_by: string;
  category: DiligenceCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  financial_impact_estimate: string | number | null;
  status: FindingStatus;
  assigned_reviewer_id: string | null;
  remediation_plan: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

// Client View Models
export interface DiligenceStatsView {
  totalItems: number;
  completedItems: number;
  pendingItems: number;
  totalRequests: number;
  openRequests: number;
  totalEvidence: number;
  acceptedEvidence: number;
  pendingReviews: number;
  criticalFindings: number;
  highFindings: number;
  openClarifications: number;
  completionPercentage: number;
}

export interface DiligenceCaseOverviewView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  mouId: string;
  mouReferenceCode: string;
  ndaId: string;
  buyerId: string;
  sellerId: string;
  userRole: DiligenceMemberRole;
  status: DiligenceCaseStatus;
  scopeDescription: string | null;
  targetCompletionDate: string | null;
  completedAt: string | null;
  closedAt: string | null;
  closureReason: string | null;
  verdict: DiligenceCaseVerdict | null;
  verdictNotes: string | null;
  createdAt: string;
  updatedAt: string;
  stats: DiligenceStatsView;
}

export interface DiligenceChecklistItemView {
  id: string;
  caseId: string;
  category: DiligenceCategory;
  title: string;
  description: string;
  required: boolean;
  requestedEvidenceType: string;
  status: ChecklistItemStatus;
  priority: ChecklistItemPriority;
  dueDate: string | null;
  sellerNotes: string | null;
  evidenceCount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  activeRequests?: DiligenceRequestView[];
}

export interface DiligenceRequestView {
  id: string;
  referenceCode: string;
  caseId: string;
  checklistItemId: string;
  itemTitle?: string;
  requestedBy: string;
  requestedByName?: string;
  assignedPartyId: string;
  requestDescription: string;
  required: boolean;
  priority: ChecklistItemPriority;
  dueDate: string | null;
  status: DiligenceRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DiligenceEvidenceVersionView {
  id: string;
  evidenceId: string;
  versionNumber: number;
  uploadedBy: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  checksum: string;
  reviewStatus: EvidenceReviewStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface DiligenceEvidenceDetailView {
  id: string;
  referenceCode: string;
  caseId: string;
  checklistItemId: string;
  requestId: string | null;
  title: string;
  category: DiligenceCategory;
  currentVersionNumber: number;
  status: EvidenceStatus;
  uploadedBy: string;
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
  versions: DiligenceEvidenceVersionView[];
  activeVersion: DiligenceEvidenceVersionView;
}

export interface DiligenceClarificationView {
  id: string;
  caseId: string;
  checklistItemId: string;
  itemTitle?: string;
  evidenceId: string | null;
  evidenceTitle?: string | null;
  versionId: string | null;
  raisedBy: string;
  raisedByName?: string;
  question: string;
  status: ClarificationStatus;
  respondedBy: string | null;
  respondedByName?: string | null;
  responseText: string | null;
  respondedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiligenceFindingView {
  id: string;
  referenceCode: string;
  caseId: string;
  checklistItemId: string | null;
  itemTitle?: string | null;
  evidenceId: string | null;
  evidenceTitle?: string | null;
  createdBy: string;
  createdByName?: string;
  category: DiligenceCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  financialImpactEstimate: number | null;
  status: FindingStatus;
  assignedReviewerId: string | null;
  remediationPlan: string | null;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignedDiligenceUrlResponse {
  downloadUrl: string;
  expiresAt: number;
  expiresInSeconds: number;
  checksum: string;
  filename: string;
  versionNumber: number;
}
