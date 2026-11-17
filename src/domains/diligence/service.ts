// Scale-up India — Phase 12: Due Diligence Domain Service
// Path: src/domains/diligence/service.ts

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  DiligenceCaseClosedError,
  DiligenceGateError,
  InvalidDiligenceStateError,
} from "@/lib/errors";
import {
  DiligenceCaseRecord,
  DiligenceMemberRecord,
  DiligenceChecklistItemRecord,
  DiligenceRequestRecord,
  DiligenceEvidenceRecord,
  DiligenceEvidenceVersionRecord,
  DiligenceClarificationRecord,
  DiligenceFindingRecord,
  DiligenceCaseOverviewView,
  DiligenceChecklistItemView,
  DiligenceRequestView,
  DiligenceEvidenceDetailView,
  DiligenceEvidenceVersionView,
  DiligenceClarificationView,
  DiligenceFindingView,
  DiligenceStatsView,
  SignedDiligenceUrlResponse,
  DiligenceCategory,
  ChecklistItemStatus,
  ChecklistItemPriority,
  DiligenceCaseStatus,
  DiligenceMemberRole,
} from "@/types/diligence";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateDiligenceCaseInput,
  createDiligenceCaseSchema,
  CreateDiligenceRequestInput,
  createDiligenceRequestSchema,
  UploadEvidenceMetadataInput,
  uploadEvidenceMetadataSchema,
  ReviewEvidenceInput,
  reviewEvidenceSchema,
  RespondClarificationInput,
  respondClarificationSchema,
  CreateFindingInput,
  createFindingSchema,
  UpdateFindingInput,
  updateFindingSchema,
  TransitionCaseStatusInput,
  transitionCaseStatusSchema,
} from "@/schemas/diligence";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";
import {
  createSignedDiligenceToken,
  verifySignedDiligenceToken,
} from "@/lib/security/diligenceDownloadToken";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4e, 0x47], // .PNG
  JPEG: [0xff, 0xd8, 0xff], // JPEG SOI
};

// In-memory sliding-window rate limiter for signed URL requests
const signedUrlRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SIGNED_URLS_PER_WINDOW = 30;

function checkDiligenceRateLimit(userId: string): void {
  const now = Date.now();
  const timestamps = signedUrlRateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_SIGNED_URLS_PER_WINDOW) {
    throw new ValidationError(
      "Rate limit exceeded for document download authorization. Please wait before generating additional signed URLs."
    );
  }

  validTimestamps.push(now);
  signedUrlRateLimitMap.set(userId, validTimestamps);
}

export function resetDiligenceRateLimits(): void {
  signedUrlRateLimitMap.clear();
}

export function validateMagicBytes(buffer: Buffer, extension: string): boolean {
  if (extension === ".pdf") {
    return (
      buffer.length >= 4 &&
      buffer[0] === MAGIC_BYTES.PDF[0] &&
      buffer[1] === MAGIC_BYTES.PDF[1] &&
      buffer[2] === MAGIC_BYTES.PDF[2] &&
      buffer[3] === MAGIC_BYTES.PDF[3]
    );
  }

  if (extension === ".png") {
    return (
      buffer.length >= 4 &&
      buffer[0] === MAGIC_BYTES.PNG[0] &&
      buffer[1] === MAGIC_BYTES.PNG[1] &&
      buffer[2] === MAGIC_BYTES.PNG[2] &&
      buffer[3] === MAGIC_BYTES.PNG[3]
    );
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return (
      buffer.length >= 3 &&
      buffer[0] === MAGIC_BYTES.JPEG[0] &&
      buffer[1] === MAGIC_BYTES.JPEG[1] &&
      buffer[2] === MAGIC_BYTES.JPEG[2]
    );
  }

  return false;
}

async function generateCaseReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('dd_case_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `DD-${new Date().getFullYear()}-${seqVal}`;
}

async function generateRequestReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('dd_req_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `REQ-${new Date().getFullYear()}-${seqVal}`;
}

async function generateEvidenceReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('dd_evd_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `EVD-${new Date().getFullYear()}-${seqVal}`;
}

async function generateFindingReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('dd_fnd_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `FND-${new Date().getFullYear()}-${seqVal}`;
}

// Default 16-Category Due Diligence Checklist Template
const STANDARD_CHECKLIST_TEMPLATE: Array<{
  category: DiligenceCategory;
  title: string;
  description: string;
  required: boolean;
  requestedEvidenceType: string;
  priority: ChecklistItemPriority;
  sortOrder: number;
}> = [
  {
    category: "CORPORATE_LEGAL",
    title: "Corporate Charter & Statutory Registers",
    description: "Certificate of Incorporation, MoA, AoA, and current Register of Members & Directors.",
    required: true,
    requestedEvidenceType: "PDF of Certificate of Incorporation, MoA, AoA & Statutory Registers",
    priority: "CRITICAL",
    sortOrder: 1,
  },
  {
    category: "OWNERSHIP",
    title: "Cap Table & Historical Share Allotments",
    description: "Certified capitalization table with Form SH-4/SH-7 and historical transfer deeds.",
    required: true,
    requestedEvidenceType: "Certified Cap Table & Historical RoC Filings (PAS-3/SH-7)",
    priority: "CRITICAL",
    sortOrder: 2,
  },
  {
    category: "FINANCIAL",
    title: "Audited Financial Statements (Last 3 Fiscal Years)",
    description: "Complete balance sheets, profit & loss statements, cash flow statements, and notes to accounts.",
    required: true,
    requestedEvidenceType: "Signed & Audited Balance Sheets (3 Years) with Auditor Reports",
    priority: "CRITICAL",
    sortOrder: 3,
  },
  {
    category: "TAX",
    title: "Income Tax Returns & Tax Audit Reports (3CD)",
    description: "Filed ITR-6 acknowledgments, Form 3CD tax audit reports, and Form 26AS/AIS for 3 years.",
    required: true,
    requestedEvidenceType: "ITR Acknowledgements & Form 3CD Tax Audit Reports",
    priority: "HIGH",
    sortOrder: 4,
  },
  {
    category: "BANKING",
    title: "Operating Bank Accounts & Debt Schedules",
    description: "Last 12 months statements for active operating accounts and bank sanction letters.",
    required: true,
    requestedEvidenceType: "Bank Statements (12 Months) & Debt Sanction Letters",
    priority: "HIGH",
    sortOrder: 5,
  },
  {
    category: "COMPLIANCE",
    title: "RoC Annual Statutory Filings",
    description: "Filed Form AOC-4 and Form MGT-7 acknowledgments for the preceding 3 financial years.",
    required: true,
    requestedEvidenceType: "MCA Challans & Filed AOC-4 / MGT-7 Forms",
    priority: "HIGH",
    sortOrder: 6,
  },
  {
    category: "CONTRACTS",
    title: "Material Commercial & Customer Agreements",
    description: "Top customer contracts, multi-year supply agreements, and master service agreements.",
    required: true,
    requestedEvidenceType: "Executed Material Customer Contracts (>₹25 Lakhs)",
    priority: "HIGH",
    sortOrder: 7,
  },
  {
    category: "INTELLECTUAL_PROPERTY",
    title: "Trademarks, Patents & Proprietary Software",
    description: "Certificates of trademark registration, patent grants, and IP assignment agreements.",
    required: false,
    requestedEvidenceType: "IP Registration Certificates & Assignment Deeds",
    priority: "MEDIUM",
    sortOrder: 8,
  },
  {
    category: "EMPLOYEES_HR",
    title: "Employee Roll, Key Employment Agreements & PF/ESI",
    description: "Staff headcount schedule, senior executive contracts, and recent PF & ESI deposit challans.",
    required: true,
    requestedEvidenceType: "Employee Census Schedule & Statutory PF/ESI Challans",
    priority: "MEDIUM",
    sortOrder: 9,
  },
  {
    category: "LITIGATION",
    title: "Promoter Litigation & Legal Dispute Statement",
    description: "Declaration of pending litigation, consumer disputes, arbitrations, or NCLT notices.",
    required: true,
    requestedEvidenceType: "Promoter Certified Litigation Certificate / Court Filings",
    priority: "HIGH",
    sortOrder: 10,
  },
  {
    category: "REGULATORY",
    title: "Operating Licenses & Environmental Consents",
    description: "Factory licenses, State Pollution Control Board (Consent to Operate), and Fire Safety NOC.",
    required: true,
    requestedEvidenceType: "Pollution Control Board CTO & Municipal Factory Licenses",
    priority: "HIGH",
    sortOrder: 11,
  },
  {
    category: "TECHNOLOGY",
    title: "Technology Architecture & Infrastructure",
    description: "System architecture diagrams, cloud hosting contracts, and disaster recovery policies.",
    required: false,
    requestedEvidenceType: "Architecture Documentation & Cloud Services SLAs",
    priority: "LOW",
    sortOrder: 12,
  },
  {
    category: "ASSETS",
    title: "Fixed Asset Register & Property Title / Lease Deeds",
    description: "Certified fixed asset register with factory/office leasehold or freehold title deeds.",
    required: true,
    requestedEvidenceType: "Fixed Asset Schedule & Registered Property Lease Deeds",
    priority: "HIGH",
    sortOrder: 13,
  },
  {
    category: "LIABILITIES",
    title: "Contingent Liabilities & Director Guarantees",
    description: "Schedule of personal guarantees, statutory tax demands, and contingent obligations.",
    required: true,
    requestedEvidenceType: "Promoter Certified Contingent Liabilities Schedule",
    priority: "HIGH",
    sortOrder: 14,
  },
  {
    category: "CUSTOMERS_VENDORS",
    title: "Customer & Vendor Concentration Schedules",
    description: "Top 10 customer revenue concentration and top 10 supplier dependency metrics.",
    required: false,
    requestedEvidenceType: "Concentration Percentage Schedule (Top 10 Accounts)",
    priority: "MEDIUM",
    sortOrder: 15,
  },
  {
    category: "INSURANCE",
    title: "Business Insurance Policies",
    description: "Industrial All Risk (IAR), Fire, Marine Cargo, and Keyman / D&O insurance policies.",
    required: false,
    requestedEvidenceType: "Active Insurance Policies & Premium Receipts",
    priority: "LOW",
    sortOrder: 16,
  },
];

// Helper: Assert case access
export async function assertCaseMember(
  user: AuthenticatedUser,
  caseId: string
): Promise<{ diligenceCase: DiligenceCaseRecord; memberRole: DiligenceMemberRole }> {
  const caseRes = await query<DiligenceCaseRecord>(
    `SELECT * FROM due_diligence_cases WHERE id = $1`,
    [caseId]
  );

  if (caseRes.rows.length === 0) {
    throw new NotFoundError("Due diligence workspace not found.");
  }

  const diligenceCase = caseRes.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");

  if (isAdmin) {
    return { diligenceCase, memberRole: "ADMIN" };
  }

  const memberRes = await query<DiligenceMemberRecord>(
    `SELECT * FROM diligence_members WHERE case_id = $1 AND user_id = $2`,
    [caseId, user.id]
  );

  if (memberRes.rows.length === 0) {
    // Check if user is buyer or seller directly
    if (user.id === diligenceCase.buyer_id) {
      return { diligenceCase, memberRole: "BUYER" };
    }
    if (user.id === diligenceCase.seller_id) {
      return { diligenceCase, memberRole: "SELLER" };
    }
    throw new ForbiddenError("You do not have authorization to access this due diligence workspace.");
  }

  const member = memberRes.rows[0];
  if (member.access_status !== "ACTIVE") {
    throw new ForbiddenError("Your access to this due diligence workspace has been revoked or suspended.");
  }

  return { diligenceCase, memberRole: member.role };
}

// Compute live statistics for a diligence case
async function computeDiligenceStats(caseId: string): Promise<DiligenceStatsView> {
  const itemRes = await query<any>(
    `SELECT status, required FROM diligence_checklist_items WHERE case_id = $1`,
    [caseId]
  );

  const reqRes = await query<any>(
    `SELECT status FROM diligence_requests WHERE case_id = $1`,
    [caseId]
  );

  const evdRes = await query<any>(
    `SELECT status FROM diligence_evidence WHERE case_id = $1`,
    [caseId]
  );

  const fndRes = await query<any>(
    `SELECT severity, status FROM diligence_findings WHERE case_id = $1`,
    [caseId]
  );

  const clarRes = await query<any>(
    `SELECT status FROM diligence_clarifications WHERE case_id = $1`,
    [caseId]
  );

  const totalItems = itemRes.rows.length;
  const completedItems = itemRes.rows.filter(
    (i) => i.status === "ACCEPTED" || i.status === "WAIVED"
  ).length;
  const pendingItems = totalItems - completedItems;

  const totalRequests = reqRes.rows.length;
  const openRequests = reqRes.rows.filter(
    (r) => r.status === "OPEN" || r.status === "CLARIFICATION_REQUESTED"
  ).length;

  const totalEvidence = evdRes.rows.length;
  const acceptedEvidence = evdRes.rows.filter((e) => e.status === "ACCEPTED").length;
  const pendingReviews = evdRes.rows.filter((e) => e.status === "PENDING_REVIEW").length;

  const criticalFindings = fndRes.rows.filter(
    (f) => f.severity === "CRITICAL" && f.status !== "RESOLVED" && f.status !== "CLOSED"
  ).length;
  const highFindings = fndRes.rows.filter(
    (f) => f.severity === "HIGH" && f.status !== "RESOLVED" && f.status !== "CLOSED"
  ).length;

  const openClarifications = clarRes.rows.filter(
    (c) => c.status === "OPEN" || c.status === "ANSWERED"
  ).length;

  const completionPercentage =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    totalItems,
    completedItems,
    pendingItems,
    totalRequests,
    openRequests,
    totalEvidence,
    acceptedEvidence,
    pendingReviews,
    criticalFindings,
    highFindings,
    openClarifications,
    completionPercentage,
  };
}

/**
 * 1. CREATE DUE DILIGENCE CASE
 * 
 * Strict Invariants:
 * - Deal Intent MOU must exist and be in ACCEPTED state
 * - Bilateral NDA must be EXECUTED
 * - Linked opportunity must be PUBLISHED
 * - Linked token deposit must be TOKEN_PAYMENT_CONFIRMED (or payment SUCCEEDED)
 * - Initiator must be the authorized Buyer or Admin
 * - Automatically instantiates default 16-category checklist items
 */
export async function createDiligenceCase(
  initiator: AuthenticatedUser,
  mouId: string,
  input: CreateDiligenceCaseInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceCaseOverviewView> {
  const validated = createDiligenceCaseSchema.parse(input);

  // 1. Fetch MOU
  const mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title, o.reference_code as opp_ref, o.status as opp_status, o.deleted_at as opp_deleted_at
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU not found.");
  }

  const mou = mouRes.rows[0];

  // 2. Opportunity Publication Check
  if (mou.opp_deleted_at !== null || mou.opp_status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found or not published.");
  }

  // 3. Bilateral NDA Execution Gate
  const ndaRes = await query<any>(
    `SELECT id, status FROM nda_agreements WHERE id = $1`,
    [mou.nda_id]
  );
  if (ndaRes.rows.length === 0 || ndaRes.rows[0].status !== "EXECUTED") {
    throw new DiligenceGateError(
      "Cannot initiate due diligence. Associated bilateral NDA is not in EXECUTED state."
    );
  }

  // 4. MOU Gate: Status must be ACCEPTED
  if (mou.status !== "ACCEPTED") {
    throw new DiligenceGateError(
      `Cannot initiate due diligence. Deal Intent MOU must be in ACCEPTED status (Current status: ${mou.status}).`
    );
  }

  // 5. Escrow / Token Deposit Gate: Must be CONFIRMED or SUCCEEDED
  const tokenRes = await query<any>(
    `SELECT id, status FROM token_deposits 
     WHERE mou_id = $1 AND status = 'TOKEN_PAYMENT_CONFIRMED'
     ORDER BY confirmed_at DESC LIMIT 1`,
    [mou.id]
  );

  const paymentRes = await query<any>(
    `SELECT id, status FROM payment_intents 
     WHERE mou_id = $1 AND status = 'SUCCEEDED'
     ORDER BY completed_at DESC LIMIT 1`,
    [mou.id]
  );

  const tokenDepositConfirmed = tokenRes.rows.length > 0;
  const paymentSucceeded = paymentRes.rows.length > 0;

  if (!tokenDepositConfirmed && !paymentSucceeded) {
    throw new DiligenceGateError(
      "Cannot initiate due diligence. Required transaction earnest deposit has not been confirmed in escrow."
    );
  }

  const tokenDepositId = tokenRes.rows[0]?.id || null;

  // 6. Anti-IDOR: Initiator must be the Buyer or Admin
  const isBuyer = initiator.id === mou.buyer_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN") || initiator.roles.includes("ADMIN");

  if (!isBuyer && !isAdmin) {
    throw new ForbiddenError("You are not authorized to create a due diligence workspace for this deal.");
  }

  // 7. Check if active diligence case already exists
  const existingCaseRes = await query<DiligenceCaseRecord>(
    `SELECT * FROM due_diligence_cases 
     WHERE mou_id = $1 AND status NOT IN ('CLOSED', 'REJECTED')`,
    [mou.id]
  );

  if (existingCaseRes.rows.length > 0) {
    const existing = existingCaseRes.rows[0];
    return getDiligenceCaseById(initiator, existing.id);
  }

  const caseRef = await generateCaseReference();

  // 8. Transactional Creation: Case + Members + Default Checklist Template
  const diligenceCase = await transaction(async (tx) => {
    const caseInsert = await tx.query<DiligenceCaseRecord>(
      `INSERT INTO due_diligence_cases (
        reference_code, opportunity_id, mou_id, nda_id, token_deposit_id,
        buyer_id, seller_id, status, scope_description, target_completion_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIATED', $8, $9)
      RETURNING *`,
      [
        caseRef,
        mou.opportunity_id,
        mou.id,
        mou.nda_id,
        tokenDepositId,
        mou.buyer_id,
        mou.seller_id,
        validated.scopeDescription || "Full commercial, legal, and financial due diligence workspace.",
        validated.targetCompletionDate ? new Date(validated.targetCompletionDate).toISOString() : null,
      ]
    );

    const c = caseInsert.rows[0];

    // Seed Members: Buyer, Seller
    await tx.query(
      `INSERT INTO diligence_members (case_id, user_id, role, access_status)
       VALUES ($1, $2, 'BUYER', 'ACTIVE'), ($1, $3, 'SELLER', 'ACTIVE')
       ON CONFLICT (case_id, user_id) DO NOTHING`,
      [c.id, mou.buyer_id, mou.seller_id]
    );

    // If initiator is admin, seed admin member
    if (isAdmin) {
      await tx.query(
        `INSERT INTO diligence_members (case_id, user_id, role, access_status)
         VALUES ($1, $2, 'ADMIN', 'ACTIVE')
         ON CONFLICT (case_id, user_id) DO NOTHING`,
        [c.id, initiator.id]
      );
    }

    // Seed Default 16-Category Checklist Items
    for (const item of STANDARD_CHECKLIST_TEMPLATE) {
      await tx.query(
        `INSERT INTO diligence_checklist_items (
          case_id, category, title, description, required, requested_evidence_type, priority, sort_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          c.id,
          item.category,
          item.title,
          item.description,
          item.required,
          item.requestedEvidenceType,
          item.priority,
          item.sortOrder,
        ]
      );
    }

    return c;
  });

  // 9. Audit Logging
  await auditLog({
    actorId: initiator.id,
    action: "DILIGENCE_CASE_CREATED",
    resourceType: "DILIGENCE_CASE",
    resourceId: diligenceCase.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: diligenceCase.reference_code,
      mouReferenceCode: mou.reference_code,
      opportunityReference: mou.opp_ref,
      buyerId: mou.buyer_id,
      sellerId: mou.seller_id,
    },
  });

  // 10. Notifications to Buyer & Seller
  await createNotification({
    userId: mou.seller_id,
    type: "DILIGENCE_CASE_OPENED",
    title: "Due Diligence Workspace Activated! 🔍",
    message: `Due diligence workspace ${diligenceCase.reference_code} has been activated following confirmed escrow deposit for deal ${mou.reference_code}.`,
    resourceType: "DILIGENCE_CASE",
    resourceId: diligenceCase.id,
  });

  await createNotification({
    userId: mou.buyer_id,
    type: "DILIGENCE_CASE_OPENED",
    title: "Due Diligence Workspace Ready! 📋",
    message: `Your due diligence workspace ${diligenceCase.reference_code} is active. You may now request evidence across 16 commercial categories.`,
    resourceType: "DILIGENCE_CASE",
    resourceId: diligenceCase.id,
  });

  return getDiligenceCaseById(initiator, diligenceCase.id);
}

/**
 * 2. GET DUE DILIGENCE CASE BY ID
 */
export async function getDiligenceCaseById(
  user: AuthenticatedUser,
  caseId: string
): Promise<DiligenceCaseOverviewView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);

  const mouRes = await query<any>(
    `SELECT m.reference_code as mou_ref, o.reference_code as opp_ref, o.title as opp_title
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [diligenceCase.mou_id]
  );

  const mouInfo = mouRes.rows[0] || {};
  const stats = await computeDiligenceStats(diligenceCase.id);

  return {
    id: diligenceCase.id,
    referenceCode: diligenceCase.reference_code,
    opportunityId: diligenceCase.opportunity_id,
    opportunityReference: mouInfo.opp_ref || "",
    opportunityTitle: mouInfo.opp_title || "",
    mouId: diligenceCase.mou_id,
    mouReferenceCode: mouInfo.mou_ref || "",
    ndaId: diligenceCase.nda_id,
    buyerId: diligenceCase.buyer_id,
    sellerId: diligenceCase.seller_id,
    userRole: memberRole,
    status: diligenceCase.status,
    scopeDescription: diligenceCase.scope_description,
    targetCompletionDate: diligenceCase.target_completion_date
      ? new Date(diligenceCase.target_completion_date).toISOString()
      : null,
    completedAt: diligenceCase.completed_at
      ? new Date(diligenceCase.completed_at).toISOString()
      : null,
    closedAt: diligenceCase.closed_at
      ? new Date(diligenceCase.closed_at).toISOString()
      : null,
    closureReason: diligenceCase.closure_reason,
    verdict: diligenceCase.verdict,
    verdictNotes: diligenceCase.verdict_notes,
    createdAt: new Date(diligenceCase.created_at).toISOString(),
    updatedAt: new Date(diligenceCase.updated_at).toISOString(),
    stats,
  };
}

/**
 * 3. LIST DUE DILIGENCE CASES
 */
export async function listDiligenceCases(
  user: AuthenticatedUser,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: DiligenceCaseOverviewView[]; total: number }> {
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const offset = Math.max(options.offset || 0, 0);

  let whereSql = "";
  const params: any[] = [];

  if (!isAdmin) {
    params.push(user.id);
    whereSql = `WHERE c.id IN (SELECT case_id FROM diligence_members WHERE user_id = $1 AND access_status = 'ACTIVE')
                OR c.buyer_id = $1 OR c.seller_id = $1`;
  }

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM due_diligence_cases c ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || "0", 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const listRes = await query<DiligenceCaseRecord>(
    `SELECT c.* FROM due_diligence_cases c 
     ${whereSql}
     ORDER BY c.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const items: DiligenceCaseOverviewView[] = [];
  for (const c of listRes.rows) {
    const overview = await getDiligenceCaseById(user, c.id);
    items.push(overview);
  }

  return { items, total };
}

/**
 * 4. GET CHECKLIST ITEMS FOR CASE
 */
export async function getChecklistItems(
  user: AuthenticatedUser,
  caseId: string,
  filter: { category?: DiligenceCategory; status?: ChecklistItemStatus } = {}
): Promise<DiligenceChecklistItemView[]> {
  await assertCaseMember(user, caseId);

  const whereClauses: string[] = ["case_id = $1"];
  const params: any[] = [caseId];

  if (filter.category) {
    params.push(filter.category);
    whereClauses.push(`category = $${params.length}`);
  }

  if (filter.status) {
    params.push(filter.status);
    whereClauses.push(`status = $${params.length}`);
  }

  const itemsRes = await query<DiligenceChecklistItemRecord>(
    `SELECT * FROM diligence_checklist_items 
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY sort_order ASC, created_at ASC`,
    params
  );

  return itemsRes.rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    category: r.category,
    title: r.title,
    description: r.description,
    required: r.required,
    requestedEvidenceType: r.requested_evidence_type,
    status: r.status,
    priority: r.priority,
    dueDate: r.due_date ? new Date(r.due_date).toISOString() : null,
    sellerNotes: r.seller_notes,
    evidenceCount: Number(r.evidence_count),
    sortOrder: Number(r.sort_order),
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

/**
 * 5. CREATE DILIGENCE DOCUMENT REQUEST
 * Reviewer or Buyer requests evidence from the Seller for a checklist item.
 */
export async function createDiligenceRequest(
  user: AuthenticatedUser,
  caseId: string,
  input: CreateDiligenceRequestInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceRequestView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = createDiligenceRequestSchema.parse(input);

  // Status Guard
  if (diligenceCase.status === "CLOSED" || diligenceCase.status === "REJECTED") {
    throw new DiligenceCaseClosedError();
  }

  // Anti-IDOR Authorization: Seller cannot request documents from themselves
  if (memberRole === "SELLER") {
    throw new ForbiddenError("Promoters/sellers cannot initiate document requests. Requests must come from reviewers or buyers.");
  }

  // Verify Checklist Item belongs to case
  const itemRes = await query<DiligenceChecklistItemRecord>(
    `SELECT * FROM diligence_checklist_items WHERE id = $1 AND case_id = $2`,
    [validated.checklistItemId, caseId]
  );

  if (itemRes.rows.length === 0) {
    throw new NotFoundError("Checklist item not found in this due diligence workspace.");
  }

  const item = itemRes.rows[0];
  const reqRef = await generateRequestReference();

  const reqInsert = await query<DiligenceRequestRecord>(
    `INSERT INTO diligence_requests (
      reference_code, case_id, checklist_item_id, requested_by, assigned_party_id,
      request_description, required, priority, due_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN')
    RETURNING *`,
    [
      reqRef,
      caseId,
      item.id,
      user.id,
      diligenceCase.seller_id,
      validated.requestDescription,
      validated.required,
      validated.priority,
      validated.dueDate ? new Date(validated.dueDate).toISOString() : null,
    ]
  );

  const request = reqInsert.rows[0];

  // Update Checklist Item Status if currently PENDING
  if (item.status === "PENDING") {
    await query(
      `UPDATE diligence_checklist_items SET status = 'REQUESTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [item.id]
    );
  }

  // Update Case Status to REQUESTS_OPEN if currently INITIATED
  if (diligenceCase.status === "INITIATED" || diligenceCase.status === "CREATED") {
    await query(
      `UPDATE due_diligence_cases SET status = 'REQUESTS_OPEN', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [caseId]
    );
  }

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_REQUEST_CREATED",
    resourceType: "DILIGENCE_REQUEST",
    resourceId: request.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      requestReference: request.reference_code,
      category: item.category,
      itemTitle: item.title,
      priority: request.priority,
    },
  });

  // Notify Seller
  await createNotification({
    userId: diligenceCase.seller_id,
    type: "DILIGENCE_DOCUMENT_REQUESTED",
    title: "New Due Diligence Document Request 📄",
    message: `Reviewer requested "${item.title}" (${request.reference_code}) in your due diligence workspace.`,
    resourceType: "DILIGENCE_REQUEST",
    resourceId: request.id,
  });

  return {
    id: request.id,
    referenceCode: request.reference_code,
    caseId: request.case_id,
    checklistItemId: request.checklist_item_id,
    itemTitle: item.title,
    requestedBy: request.requested_by,
    requestedByName: `${user.firstName} ${user.lastName}`,
    assignedPartyId: request.assigned_party_id,
    requestDescription: request.request_description,
    required: request.required,
    priority: request.priority,
    dueDate: request.due_date ? new Date(request.due_date).toISOString() : null,
    status: request.status,
    createdAt: new Date(request.created_at).toISOString(),
    updatedAt: new Date(request.updated_at).toISOString(),
  };
}

/**
 * 6. UPLOAD & SUBMIT DILIGENCE EVIDENCE DOCUMENT
 * Seller uploads evidence document for a checklist item/request.
 * Supports immutable versioning: increments version number on subsequent uploads.
 */
export async function uploadEvidenceDocument(
  user: AuthenticatedUser,
  caseId: string,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
  },
  metadata: UploadEvidenceMetadataInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceEvidenceDetailView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = uploadEvidenceMetadataSchema.parse(metadata);

  // Status Guard
  if (diligenceCase.status === "CLOSED" || diligenceCase.status === "REJECTED") {
    throw new DiligenceCaseClosedError();
  }

  // Anti-IDOR Authorization: Seller or Admin only
  const isSeller = user.id === diligenceCase.seller_id || memberRole === "SELLER";
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");

  if (!isSeller && !isAdmin) {
    throw new ForbiddenError("Only authorized sellers or administrators may upload diligence evidence.");
  }

  // Verify Checklist Item belongs to case
  const itemRes = await query<DiligenceChecklistItemRecord>(
    `SELECT * FROM diligence_checklist_items WHERE id = $1 AND case_id = $2`,
    [validated.checklistItemId, caseId]
  );

  if (itemRes.rows.length === 0) {
    throw new NotFoundError("Checklist item not found in this due diligence workspace.");
  }

  const item = itemRes.rows[0];

  // 1. File Security: Size Check (15MB)
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file cannot be empty.");
  }

  // 2. File Security: Extension Check
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG files are permitted as due diligence evidence.`
    );
  }

  // 3. File Security: Path Traversal Defense
  if (
    file.originalFilename.includes("..") ||
    file.originalFilename.includes("/") ||
    file.originalFilename.includes("\\")
  ) {
    throw new ValidationError("Invalid or malicious filename detected (path traversal characters prohibited).");
  }

  const safeFilename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safeFilename.includes("..") || safeFilename.startsWith(".")) {
    throw new ValidationError("Invalid or malicious filename detected.");
  }

  // 4. File Security: Magic-byte inspection
  if (!validateMagicBytes(file.buffer, ext)) {
    throw new ValidationError("MIME spoofing detected: file contents do not match declared file extension.");
  }

  // 5. SHA-256 Checksum Calculation
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 6. Check existing evidence record for checklist item
  const existingEvdRes = await query<DiligenceEvidenceRecord>(
    `SELECT * FROM diligence_evidence 
     WHERE case_id = $1 AND checklist_item_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [caseId, item.id]
  );

  let evidenceId: string;
  let versionNumber: number;
  let evidenceRef: string;

  if (existingEvdRes.rows.length > 0) {
    const existingEvd = existingEvdRes.rows[0];
    evidenceId = existingEvd.id;
    evidenceRef = existingEvd.reference_code;
    versionNumber = existingEvd.current_version_number + 1;

    // Check for exact identical duplicate upload in same evidence
    const dupVerRes = await query<any>(
      `SELECT id FROM diligence_evidence_versions WHERE evidence_id = $1 AND checksum = $2`,
      [evidenceId, checksum]
    );
    if (dupVerRes.rows.length > 0) {
      throw new ConflictError("An identical copy of this document version has already been uploaded for this evidence item.");
    }
  } else {
    evidenceId = crypto.randomUUID();
    evidenceRef = await generateEvidenceReference();
    versionNumber = 1;
  }

  // 7. Secure Vault Storage outside web root
  const vaultDir = path.join(process.cwd(), "data", "vault", "diligence", caseId, evidenceId);
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });
  }

  const storageKey = path.join(vaultDir, `v${versionNumber}_${safeFilename}`);
  fs.writeFileSync(storageKey, file.buffer);

  // 8. Transactional Database Insert
  await transaction(async (tx) => {
    if (versionNumber === 1) {
      await tx.query(
        `INSERT INTO diligence_evidence (
          id, reference_code, case_id, checklist_item_id, request_id,
          title, category, current_version_number, status, uploaded_by, is_confidential
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'PENDING_REVIEW', $8, $9)`,
        [
          evidenceId,
          evidenceRef,
          caseId,
          item.id,
          validated.requestId || null,
          validated.title,
          validated.category,
          user.id,
          validated.isConfidential,
        ]
      );
    } else {
      await tx.query(
        `UPDATE diligence_evidence 
         SET current_version_number = $1, status = 'PENDING_REVIEW', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [versionNumber, evidenceId]
      );
    }

    // Insert Version
    await tx.query(
      `INSERT INTO diligence_evidence_versions (
        evidence_id, version_number, uploaded_by, storage_key, original_filename,
        file_size, mime_type, checksum, review_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_REVIEW')`,
      [
        evidenceId,
        versionNumber,
        user.id,
        storageKey,
        safeFilename,
        file.buffer.length,
        file.mimeType,
        checksum,
      ]
    );

    // Update Checklist Item
    await tx.query(
      `UPDATE diligence_checklist_items 
       SET status = 'EVIDENCE_SUBMITTED', evidence_count = evidence_count + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [item.id]
    );

    // Update Request status if linked
    if (validated.requestId) {
      await tx.query(
        `UPDATE diligence_requests SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [validated.requestId]
      );
    }

    // Update Case status to DOCUMENTS_SUBMITTED if needed
    if (
      diligenceCase.status === "REQUESTS_OPEN" ||
      diligenceCase.status === "INITIATED" ||
      diligenceCase.status === "CREATED"
    ) {
      await tx.query(
        `UPDATE due_diligence_cases SET status = 'DOCUMENTS_SUBMITTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [caseId]
      );
    }
  });

  // 9. Audit Logging
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_EVIDENCE_UPLOADED",
    resourceType: "DILIGENCE_EVIDENCE",
    resourceId: evidenceId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      evidenceReference: evidenceRef,
      versionNumber,
      category: validated.category,
      filename: safeFilename,
      fileSize: file.buffer.length,
      checksum,
    },
  });

  // 10. Notify Buyer
  await createNotification({
    userId: diligenceCase.buyer_id,
    type: "DILIGENCE_EVIDENCE_SUBMITTED",
    title: "Due Diligence Evidence Uploaded 📁",
    message: `Evidence document "${validated.title}" (v${versionNumber}) has been submitted for item "${item.title}".`,
    resourceType: "DILIGENCE_EVIDENCE",
    resourceId: evidenceId,
  });

  return getEvidenceDetailById(user, caseId, evidenceId);
}

/**
 * 7. GET EVIDENCE DETAIL BY ID
 */
export async function getEvidenceDetailById(
  user: AuthenticatedUser,
  caseId: string,
  evidenceId: string
): Promise<DiligenceEvidenceDetailView> {
  await assertCaseMember(user, caseId);

  const evdRes = await query<DiligenceEvidenceRecord>(
    `SELECT * FROM diligence_evidence WHERE id = $1 AND case_id = $2`,
    [evidenceId, caseId]
  );

  if (evdRes.rows.length === 0) {
    throw new NotFoundError("Due diligence evidence record not found.");
  }

  const evd = evdRes.rows[0];

  const versionsRes = await query<DiligenceEvidenceVersionRecord>(
    `SELECT * FROM diligence_evidence_versions 
     WHERE evidence_id = $1 
     ORDER BY version_number ASC`,
    [evidenceId]
  );

  const versions: DiligenceEvidenceVersionView[] = versionsRes.rows.map((v) => ({
    id: v.id,
    evidenceId: v.evidence_id,
    versionNumber: v.version_number,
    uploadedBy: v.uploaded_by,
    originalFilename: v.original_filename,
    fileSize: parseInt(v.file_size as any, 10),
    mimeType: v.mime_type,
    checksum: v.checksum,
    reviewStatus: v.review_status,
    reviewerId: v.reviewer_id,
    reviewedAt: v.reviewed_at ? new Date(v.reviewed_at).toISOString() : null,
    reviewerNotes: v.reviewer_notes,
    rejectionReason: v.rejection_reason,
    createdAt: new Date(v.created_at).toISOString(),
  }));

  const activeVersion =
    versions.find((v) => v.versionNumber === evd.current_version_number) ||
    versions[versions.length - 1];

  return {
    id: evd.id,
    referenceCode: evd.reference_code,
    caseId: evd.case_id,
    checklistItemId: evd.checklist_item_id,
    requestId: evd.request_id,
    title: evd.title,
    category: evd.category,
    currentVersionNumber: evd.current_version_number,
    status: evd.status,
    uploadedBy: evd.uploaded_by,
    isConfidential: evd.is_confidential,
    createdAt: new Date(evd.created_at).toISOString(),
    updatedAt: new Date(evd.updated_at).toISOString(),
    versions,
    activeVersion,
  };
}

/**
 * 7b. LIST EVIDENCE FOR CASE
 */
export async function listEvidenceForCase(
  user: AuthenticatedUser,
  caseId: string
): Promise<DiligenceEvidenceDetailView[]> {
  await assertCaseMember(user, caseId);

  const evdRes = await query<DiligenceEvidenceRecord>(
    `SELECT * FROM diligence_evidence WHERE case_id = $1 ORDER BY created_at DESC`,
    [caseId]
  );

  const results: DiligenceEvidenceDetailView[] = [];
  for (const evd of evdRes.rows) {
    const detail = await getEvidenceDetailById(user, caseId, evd.id);
    results.push(detail);
  }
  return results;
}

/**
 * 8. REVIEW EVIDENCE VERSION (ACCEPT / REJECT / CLARIFICATION REQUIRED)
 * 
 * Strict Invariants:
 * - Seller CANNOT review or accept their own evidence
 * - Only authorized Buyer, Reviewer, or Admin may review
 * - Terminal states cannot be arbitrarily mutated
 * - Threaded clarifications created if clarification is requested
 */
export async function reviewEvidenceVersion(
  user: AuthenticatedUser,
  caseId: string,
  evidenceId: string,
  versionNumber: number,
  input: ReviewEvidenceInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceEvidenceDetailView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = reviewEvidenceSchema.parse(input);

  // Status Guard
  if (diligenceCase.status === "CLOSED" || diligenceCase.status === "REJECTED") {
    throw new DiligenceCaseClosedError();
  }

  // Anti-IDOR Authorization: Seller CANNOT review evidence
  if (memberRole === "SELLER" || user.id === diligenceCase.seller_id) {
    throw new ForbiddenError("Sellers/promoters are strictly forbidden from reviewing or approving due diligence evidence.");
  }

  const evdRes = await query<DiligenceEvidenceRecord>(
    `SELECT * FROM diligence_evidence WHERE id = $1 AND case_id = $2`,
    [evidenceId, caseId]
  );
  if (evdRes.rows.length === 0) {
    throw new NotFoundError("Due diligence evidence not found.");
  }
  const evd = evdRes.rows[0];

  const verRes = await query<DiligenceEvidenceVersionRecord>(
    `SELECT * FROM diligence_evidence_versions WHERE evidence_id = $1 AND version_number = $2`,
    [evidenceId, versionNumber]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError(`Evidence version ${versionNumber} not found.`);
  }

  await transaction(async (tx) => {
    // 1. Update Version review status
    await tx.query(
      `UPDATE diligence_evidence_versions 
       SET review_status = $1, reviewer_id = $2, reviewed_at = CURRENT_TIMESTAMP,
           reviewer_notes = $3, rejection_reason = $4
       WHERE evidence_id = $5 AND version_number = $6`,
      [
        validated.decision,
        user.id,
        validated.notes || null,
        validated.rejectionReason || null,
        evidenceId,
        versionNumber,
      ]
    );

    // 2. Update Evidence Status
    await tx.query(
      `UPDATE diligence_evidence 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [validated.decision, evidenceId]
    );

    // 3. Update Checklist Item Status
    if (validated.decision === "ACCEPTED") {
      await tx.query(
        `UPDATE diligence_checklist_items 
         SET status = 'ACCEPTED', reviewer_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [user.id, evd.checklist_item_id]
      );

      if (evd.request_id) {
        await tx.query(
          `UPDATE diligence_requests SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [evd.request_id]
        );
      }
    } else if (validated.decision === "REJECTED") {
      await tx.query(
        `UPDATE diligence_checklist_items 
         SET status = 'REJECTED', reviewer_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [user.id, evd.checklist_item_id]
      );

      if (evd.request_id) {
        await tx.query(
          `UPDATE diligence_requests SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [evd.request_id]
        );
      }
    } else if (validated.decision === "CLARIFICATION_REQUIRED") {
      await tx.query(
        `UPDATE diligence_checklist_items 
         SET status = 'CLARIFICATION_REQUIRED', reviewer_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [user.id, evd.checklist_item_id]
      );

      if (evd.request_id) {
        await tx.query(
          `UPDATE diligence_requests SET status = 'CLARIFICATION_REQUESTED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [evd.request_id]
        );
      }

      // Create Clarification Record
      await tx.query(
        `INSERT INTO diligence_clarifications (
          case_id, checklist_item_id, evidence_id, version_id, raised_by, question, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN')`,
        [
          caseId,
          evd.checklist_item_id,
          evidenceId,
          verRes.rows[0].id,
          user.id,
          validated.clarificationQuestion!,
        ]
      );

      // Update Case status to CLARIFICATION_REQUIRED
      await tx.query(
        `UPDATE due_diligence_cases SET status = 'CLARIFICATION_REQUIRED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [caseId]
      );
    }
  });

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_EVIDENCE_REVIEWED",
    resourceType: "DILIGENCE_EVIDENCE",
    resourceId: evidenceId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      evidenceReference: evd.reference_code,
      versionNumber,
      decision: validated.decision,
      notes: validated.notes,
      rejectionReason: validated.rejectionReason,
    },
  });

  // Notify Seller
  await createNotification({
    userId: diligenceCase.seller_id,
    type: `DILIGENCE_EVIDENCE_${validated.decision}`,
    title: `Diligence Evidence ${validated.decision.replace("_", " ")}`,
    message: `Reviewer evaluated "${evd.title}" (v${versionNumber}) with verdict: ${validated.decision}.`,
    resourceType: "DILIGENCE_EVIDENCE",
    resourceId: evidenceId,
  });

  return getEvidenceDetailById(user, caseId, evidenceId);
}

/**
 * 9. RESPOND TO DILIGENCE CLARIFICATION
 * Seller responds to a reviewer's clarification inquiry.
 */
export async function respondToClarification(
  user: AuthenticatedUser,
  caseId: string,
  clarificationId: string,
  input: RespondClarificationInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceClarificationView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = respondClarificationSchema.parse(input);

  // Status Guard
  if (diligenceCase.status === "CLOSED" || diligenceCase.status === "REJECTED") {
    throw new DiligenceCaseClosedError();
  }

  // Anti-IDOR Authorization: Seller or Admin only
  const isSeller = user.id === diligenceCase.seller_id || memberRole === "SELLER";
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");

  if (!isSeller && !isAdmin) {
    throw new ForbiddenError("Only the seller or administrator may respond to due diligence clarifications.");
  }

  const clarRes = await query<DiligenceClarificationRecord>(
    `SELECT * FROM diligence_clarifications WHERE id = $1 AND case_id = $2`,
    [clarificationId, caseId]
  );

  if (clarRes.rows.length === 0) {
    throw new NotFoundError("Clarification record not found.");
  }

  const clar = clarRes.rows[0];

  if (clar.status === "RESOLVED" || clar.status === "CLOSED") {
    throw new InvalidDiligenceStateError("This clarification thread is already closed.");
  }

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE diligence_clarifications 
       SET status = 'ANSWERED', responded_by = $1, response_text = $2, responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [user.id, validated.responseText, clarificationId]
    );

    // Update case status to UNDER_REVIEW
    await tx.query(
      `UPDATE due_diligence_cases SET status = 'UNDER_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [caseId]
    );
  });

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_CLARIFICATION_ANSWERED",
    resourceType: "DILIGENCE_CLARIFICATION",
    resourceId: clarificationId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      clarificationId,
    },
  });

  // Notify Buyer
  await createNotification({
    userId: diligenceCase.buyer_id,
    type: "DILIGENCE_CLARIFICATION_ANSWERED",
    title: "Clarification Response Received 💬",
    message: `Promoter responded to your clarification on due diligence case ${diligenceCase.reference_code}.`,
    resourceType: "DILIGENCE_CLARIFICATION",
    resourceId: clarificationId,
  });

  return getClarificationById(user, caseId, clarificationId);
}

/**
 * 10. GET CLARIFICATION BY ID
 */
export async function getClarificationById(
  user: AuthenticatedUser,
  caseId: string,
  clarificationId: string
): Promise<DiligenceClarificationView> {
  await assertCaseMember(user, caseId);

  const res = await query<any>(
    `SELECT c.*, i.title as item_title, e.title as evd_title,
            u1.first_name as raised_first, u1.last_name as raised_last,
            u2.first_name as resp_first, u2.last_name as resp_last
     FROM diligence_clarifications c
     JOIN diligence_checklist_items i ON c.checklist_item_id = i.id
     LEFT JOIN diligence_evidence e ON c.evidence_id = e.id
     JOIN users u1 ON c.raised_by = u1.id
     LEFT JOIN users u2 ON c.responded_by = u2.id
     WHERE c.id = $1 AND c.case_id = $2`,
    [clarificationId, caseId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Clarification record not found.");
  }

  const r = res.rows[0];

  return {
    id: r.id,
    caseId: r.case_id,
    checklistItemId: r.checklist_item_id,
    itemTitle: r.item_title,
    evidenceId: r.evidence_id,
    evidenceTitle: r.evd_title,
    versionId: r.version_id,
    raisedBy: r.raised_by,
    raisedByName: `${r.raised_first} ${r.raised_last}`,
    question: r.question,
    status: r.status,
    respondedBy: r.responded_by,
    respondedByName: r.resp_first ? `${r.resp_first} ${r.resp_last}` : null,
    responseText: r.response_text,
    respondedAt: r.responded_at ? new Date(r.responded_at).toISOString() : null,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/**
 * 11. LIST CLARIFICATIONS FOR CASE
 */
export async function listClarifications(
  user: AuthenticatedUser,
  caseId: string
): Promise<DiligenceClarificationView[]> {
  await assertCaseMember(user, caseId);

  const res = await query<any>(
    `SELECT c.*, i.title as item_title, e.title as evd_title,
            u1.first_name as raised_first, u1.last_name as raised_last,
            u2.first_name as resp_first, u2.last_name as resp_last
     FROM diligence_clarifications c
     JOIN diligence_checklist_items i ON c.checklist_item_id = i.id
     LEFT JOIN diligence_evidence e ON c.evidence_id = e.id
     JOIN users u1 ON c.raised_by = u1.id
     LEFT JOIN users u2 ON c.responded_by = u2.id
     WHERE c.case_id = $1
     ORDER BY c.created_at DESC`,
    [caseId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    checklistItemId: r.checklist_item_id,
    itemTitle: r.item_title,
    evidenceId: r.evidence_id,
    evidenceTitle: r.evd_title,
    versionId: r.version_id,
    raisedBy: r.raised_by,
    raisedByName: `${r.raised_first} ${r.raised_last}`,
    question: r.question,
    status: r.status,
    respondedBy: r.responded_by,
    respondedByName: r.resp_first ? `${r.resp_first} ${r.resp_last}` : null,
    responseText: r.response_text,
    respondedAt: r.responded_at ? new Date(r.responded_at).toISOString() : null,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

/**
 * 12. CREATE DILIGENCE RISK FINDING / ISSUE
 */
export async function createFinding(
  user: AuthenticatedUser,
  caseId: string,
  input: CreateFindingInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceFindingView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = createFindingSchema.parse(input);

  // Status Guard
  if (diligenceCase.status === "CLOSED" || diligenceCase.status === "REJECTED") {
    throw new DiligenceCaseClosedError();
  }

  // Anti-IDOR Authorization: Seller cannot create risk findings against themselves
  if (memberRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot create due diligence risk findings.");
  }

  const fndRef = await generateFindingReference();

  const insertRes = await query<DiligenceFindingRecord>(
    `INSERT INTO diligence_findings (
      reference_code, case_id, checklist_item_id, evidence_id, created_by,
      category, severity, title, description, financial_impact_estimate,
      status, assigned_reviewer_id, remediation_plan
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'OPEN', $11, $12)
    RETURNING *`,
    [
      fndRef,
      caseId,
      validated.checklistItemId || null,
      validated.evidenceId || null,
      user.id,
      validated.category,
      validated.severity,
      validated.title,
      validated.description,
      validated.financialImpactEstimate || null,
      user.id,
      validated.remediationPlan || null,
    ]
  );

  const finding = insertRes.rows[0];

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_FINDING_CREATED",
    resourceType: "DILIGENCE_FINDING",
    resourceId: finding.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      findingReference: finding.reference_code,
      category: finding.category,
      severity: finding.severity,
      title: finding.title,
    },
  });

  // If Critical or High severity, notify counterparties
  if (finding.severity === "CRITICAL" || finding.severity === "HIGH") {
    await createNotification({
      userId: diligenceCase.buyer_id,
      type: "DILIGENCE_CRITICAL_FINDING",
      title: `${finding.severity} Risk Finding Logged ⚠️`,
      message: `A ${finding.severity.toLowerCase()} risk finding ("${finding.title}") has been recorded in due diligence case ${diligenceCase.reference_code}.`,
      resourceType: "DILIGENCE_FINDING",
      resourceId: finding.id,
    });
  }

  return getFindingById(user, caseId, finding.id);
}

/**
 * 13. GET FINDING BY ID
 */
export async function getFindingById(
  user: AuthenticatedUser,
  caseId: string,
  findingId: string
): Promise<DiligenceFindingView> {
  await assertCaseMember(user, caseId);

  const res = await query<any>(
    `SELECT f.*, i.title as item_title, e.title as evd_title,
            u.first_name, u.last_name
     FROM diligence_findings f
     LEFT JOIN diligence_checklist_items i ON f.checklist_item_id = i.id
     LEFT JOIN diligence_evidence e ON f.evidence_id = e.id
     JOIN users u ON f.created_by = u.id
     WHERE f.id = $1 AND f.case_id = $2`,
    [findingId, caseId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Due diligence finding not found.");
  }

  const r = res.rows[0];

  return {
    id: r.id,
    referenceCode: r.reference_code,
    caseId: r.case_id,
    checklistItemId: r.checklist_item_id,
    itemTitle: r.item_title,
    evidenceId: r.evidence_id,
    evidenceTitle: r.evd_title,
    createdBy: r.created_by,
    createdByName: `${r.first_name} ${r.last_name}`,
    category: r.category,
    severity: r.severity,
    title: r.title,
    description: r.description,
    financialImpactEstimate: r.financial_impact_estimate ? Number(r.financial_impact_estimate) : null,
    status: r.status,
    assignedReviewerId: r.assigned_reviewer_id,
    remediationPlan: r.remediation_plan,
    resolutionNotes: r.resolution_notes,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

/**
 * 14. LIST FINDINGS FOR CASE
 */
export async function listFindings(
  user: AuthenticatedUser,
  caseId: string
): Promise<DiligenceFindingView[]> {
  await assertCaseMember(user, caseId);

  const res = await query<any>(
    `SELECT f.*, i.title as item_title, e.title as evd_title,
            u.first_name, u.last_name
     FROM diligence_findings f
     LEFT JOIN diligence_checklist_items i ON f.checklist_item_id = i.id
     LEFT JOIN diligence_evidence e ON f.evidence_id = e.id
     JOIN users u ON f.created_by = u.id
     WHERE f.case_id = $1
     ORDER BY 
       CASE f.severity 
         WHEN 'CRITICAL' THEN 1 
         WHEN 'HIGH' THEN 2 
         WHEN 'MEDIUM' THEN 3 
         WHEN 'LOW' THEN 4 
       END ASC,
       f.created_at DESC`,
    [caseId]
  );

  return res.rows.map((r) => ({
    id: r.id,
    referenceCode: r.reference_code,
    caseId: r.case_id,
    checklistItemId: r.checklist_item_id,
    itemTitle: r.item_title,
    evidenceId: r.evidence_id,
    evidenceTitle: r.evd_title,
    createdBy: r.created_by,
    createdByName: `${r.first_name} ${r.last_name}`,
    category: r.category,
    severity: r.severity,
    title: r.title,
    description: r.description,
    financialImpactEstimate: r.financial_impact_estimate ? Number(r.financial_impact_estimate) : null,
    status: r.status,
    assignedReviewerId: r.assigned_reviewer_id,
    remediationPlan: r.remediation_plan,
    resolutionNotes: r.resolution_notes,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

/**
 * 15. UPDATE DILIGENCE FINDING
 */
export async function updateFinding(
  user: AuthenticatedUser,
  caseId: string,
  findingId: string,
  input: UpdateFindingInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceFindingView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = updateFindingSchema.parse(input);

  const fndRes = await query<DiligenceFindingRecord>(
    `SELECT * FROM diligence_findings WHERE id = $1 AND case_id = $2`,
    [findingId, caseId]
  );
  if (fndRes.rows.length === 0) {
    throw new NotFoundError("Due diligence finding not found.");
  }
  const fnd = fndRes.rows[0];

  // Seller can only propose remediation plan; cannot close or change status
  if (memberRole === "SELLER" && validated.status && validated.status !== fnd.status) {
    throw new ForbiddenError("Sellers/promoters cannot unilaterally change the status or resolution of diligence risk findings.");
  }

  const updates: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const params: any[] = [findingId];

  if (validated.status) {
    params.push(validated.status);
    updates.push(`status = $${params.length}`);
    if (validated.status === "RESOLVED" || validated.status === "CLOSED") {
      updates.push(`resolved_at = CURRENT_TIMESTAMP`);
    }
  }

  if (validated.remediationPlan !== undefined) {
    params.push(validated.remediationPlan);
    updates.push(`remediation_plan = $${params.length}`);
  }

  if (validated.resolutionNotes !== undefined) {
    params.push(validated.resolutionNotes);
    updates.push(`resolution_notes = $${params.length}`);
  }

  await query(
    `UPDATE diligence_findings SET ${updates.join(", ")} WHERE id = $1`,
    params
  );

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "DILIGENCE_FINDING_UPDATED",
    resourceType: "DILIGENCE_FINDING",
    resourceId: findingId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      findingReference: fnd.reference_code,
      status: validated.status || fnd.status,
    },
  });

  return getFindingById(user, caseId, findingId);
}

/**
 * 16. GENERATE SIGNED DILIGENCE EVIDENCE DOWNLOAD URL
 */
export async function generateSignedEvidenceUrl(
  user: AuthenticatedUser,
  caseId: string,
  evidenceId: string,
  versionNumber?: number
): Promise<SignedDiligenceUrlResponse> {
  checkDiligenceRateLimit(user.id);
  const { diligenceCase } = await assertCaseMember(user, caseId);

  const evdRes = await query<DiligenceEvidenceRecord>(
    `SELECT * FROM diligence_evidence WHERE id = $1 AND case_id = $2`,
    [evidenceId, caseId]
  );
  if (evdRes.rows.length === 0) {
    throw new NotFoundError("Due diligence evidence not found.");
  }
  const evd = evdRes.rows[0];

  const targetVer = versionNumber || evd.current_version_number;

  const verRes = await query<DiligenceEvidenceVersionRecord>(
    `SELECT * FROM diligence_evidence_versions WHERE evidence_id = $1 AND version_number = $2`,
    [evidenceId, targetVer]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError(`Evidence version ${targetVer} not found.`);
  }
  const ver = verRes.rows[0];

  // Cryptographic signed token (300 seconds TTL)
  const tokenData = createSignedDiligenceToken(
    evidenceId,
    targetVer,
    caseId,
    user.id,
    300
  );

  const downloadUrl = `/api/v1/diligence-cases/${caseId}/evidence/${evidenceId}/download?v=${targetVer}&token=${tokenData.token}&expires=${tokenData.expiresAt}&u=${user.id}`;

  return {
    downloadUrl,
    expiresAt: tokenData.expiresAt,
    expiresInSeconds: tokenData.expiresInSeconds,
    checksum: ver.checksum,
    filename: ver.original_filename,
    versionNumber: targetVer,
  };
}

/**
 * 17. STREAM EVIDENCE DOCUMENT DOWNLOAD
 */
export async function streamEvidenceDocument(
  token: string,
  expiresAt: number,
  userId: string,
  caseId: string,
  evidenceId: string,
  versionNumber: number
): Promise<{ buffer: Buffer; filename: string; originalFilename: string; mimeType: string; fileSize: number }> {
  // 1. Verify Cryptographic Token
  const isValid = verifySignedDiligenceToken(
    token,
    evidenceId,
    versionNumber,
    caseId,
    userId,
    expiresAt
  );

  if (!isValid) {
    throw new ForbiddenError("Invalid, expired, or tampered document download authorization token.");
  }

  // 2. Fetch Version Record
  const verRes = await query<DiligenceEvidenceVersionRecord>(
    `SELECT v.*, e.case_id 
     FROM diligence_evidence_versions v
     JOIN diligence_evidence e ON v.evidence_id = e.id
     WHERE v.evidence_id = $1 AND v.version_number = $2 AND e.case_id = $3`,
    [evidenceId, versionNumber, caseId]
  );

  if (verRes.rows.length === 0) {
    throw new NotFoundError("Requested evidence document version not found.");
  }

  const ver = verRes.rows[0];

  // 3. Verify file exists in vault
  if (!fs.existsSync(ver.storage_key)) {
    throw new NotFoundError("Document vault storage object not found on secure disk.");
  }

  const buffer = fs.readFileSync(ver.storage_key);

  // 4. Audit Log
  await auditLog({
    actorId: userId,
    action: "DILIGENCE_DOCUMENT_DOWNLOADED",
    resourceType: "DILIGENCE_EVIDENCE_VERSION",
    resourceId: ver.id,
    metadata: {
      caseId,
      evidenceId,
      versionNumber,
      filename: ver.original_filename,
    },
  });

  return {
    buffer,
    filename: ver.original_filename,
    originalFilename: ver.original_filename,
    mimeType: ver.mime_type,
    fileSize: buffer.length,
  };
}

/**
 * 18. TRANSITION DUE DILIGENCE CASE STATUS (FINITE STATE MACHINE)
 */
export async function transitionCaseStatus(
  user: AuthenticatedUser,
  caseId: string,
  input: TransitionCaseStatusInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DiligenceCaseOverviewView> {
  const { diligenceCase, memberRole } = await assertCaseMember(user, caseId);
  const validated = transitionCaseStatusSchema.parse(input);

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  const isBuyer = memberRole === "BUYER" || user.id === diligenceCase.buyer_id;

  // Seller cannot transition case status
  if (memberRole === "SELLER" && !isAdmin) {
    throw new ForbiddenError("Sellers/promoters cannot transition the status of a due diligence workspace.");
  }

  // Terminal State Guards
  if (diligenceCase.status === "CLOSED" && validated.targetStatus !== "CLOSED") {
    throw new InvalidDiligenceStateError("Due diligence case is closed and cannot be reopened.");
  }

  const VALID_CASE_TRANSITIONS: Record<DiligenceCaseStatus, DiligenceCaseStatus[]> = {
    CREATED: ["INITIATED", "CLOSED"],
    INITIATED: ["REQUESTS_OPEN", "DOCUMENTS_SUBMITTED", "UNDER_REVIEW", "CLOSED"],
    REQUESTS_OPEN: ["DOCUMENTS_SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUIRED", "CLOSED"],
    DOCUMENTS_SUBMITTED: ["UNDER_REVIEW", "REQUESTS_OPEN", "CLARIFICATION_REQUIRED", "CLOSED"],
    UNDER_REVIEW: ["CLARIFICATION_REQUIRED", "REVIEW_COMPLETE", "REQUESTS_OPEN", "CLOSED"],
    CLARIFICATION_REQUIRED: ["UNDER_REVIEW", "DOCUMENTS_SUBMITTED", "REVIEW_COMPLETE", "CLOSED"],
    REVIEW_COMPLETE: ["APPROVED", "REJECTED", "UNDER_REVIEW", "CLOSED"],
    APPROVED: ["CLOSED"],
    REJECTED: ["CLOSED"],
    CLOSED: [],
  };

  if (
    validated.targetStatus !== diligenceCase.status &&
    !VALID_CASE_TRANSITIONS[diligenceCase.status]?.includes(validated.targetStatus)
  ) {
    throw new InvalidDiligenceStateError(
      `Cannot transition due diligence case from ${diligenceCase.status} to ${validated.targetStatus}.`
    );
  }

  // Admin or Lead Reviewer required for verdict transitions (APPROVED, REJECTED, CLOSED)
  if (
    (validated.targetStatus === "APPROVED" ||
      validated.targetStatus === "REJECTED" ||
      validated.targetStatus === "CLOSED") &&
    !isAdmin &&
    !isBuyer
  ) {
    throw new ForbiddenError("Only the buyer, lead diligence reviewer, or administrator may issue a final diligence verdict.");
  }

  const updates: string[] = [
    `status = $2`,
    `updated_at = CURRENT_TIMESTAMP`,
  ];
  const params: any[] = [caseId, validated.targetStatus];

  if (validated.verdict) {
    params.push(validated.verdict);
    updates.push(`verdict = $${params.length}`);
  }

  if (validated.verdictNotes) {
    params.push(validated.verdictNotes);
    updates.push(`verdict_notes = $${params.length}`);
  }

  if (validated.closureReason) {
    params.push(validated.closureReason);
    updates.push(`closure_reason = $${params.length}`);
  }

  if (validated.targetStatus === "REVIEW_COMPLETE" || validated.targetStatus === "APPROVED") {
    updates.push(`completed_at = CURRENT_TIMESTAMP`);
  }

  if (validated.targetStatus === "CLOSED") {
    updates.push(`closed_at = CURRENT_TIMESTAMP`);
  }

  await query(
    `UPDATE due_diligence_cases SET ${updates.join(", ")} WHERE id = $1`,
    params
  );

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: `DILIGENCE_CASE_${validated.targetStatus}`,
    resourceType: "DILIGENCE_CASE",
    resourceId: caseId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: diligenceCase.reference_code,
      priorStatus: diligenceCase.status,
      targetStatus: validated.targetStatus,
      verdict: validated.verdict,
    },
  });

  return getDiligenceCaseById(user, caseId);
}
