// Scale-up India — Phase 13: Valuation Domain Service
// Path: src/domains/valuation/service.ts

import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValuationGateError,
  InvalidValuationStateError,
  ValuationLockedError,
  CalculationError,
} from "@/lib/errors";
import {
  ValuationCaseRecord,
  ValuationVersionRecord,
  ValuationInputRecord,
  ValuationAdjustmentRecord,
  ValuationComparableRecord,
  ValuationCaseOverviewView,
  ValuationVersionDetailView,
  ValuationInputView,
  ValuationAdjustmentView,
  ValuationComparableView,
  ValuationSellerSummaryView,
  ValuationScenario,
  ScenarioCalculationOutput,
  ValuationRangeResult,
  ValuationMethodology,
} from "@/types/valuation";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateValuationCaseInput,
  createValuationCaseSchema,
  CreateValuationInputInput,
  createValuationInputSchema,
  CreateValuationAdjustmentInput,
  createValuationAdjustmentSchema,
  CreateValuationComparableInput,
  createValuationComparableSchema,
  UpdateValuationModelInput,
  updateValuationModelSchema,
  SubmitValuationVersionInput,
  submitValuationVersionSchema,
  ReviewValuationVersionInput,
  reviewValuationVersionSchema,
  LockValuationVersionInput,
  lockValuationVersionSchema,
} from "@/schemas/valuation";
import {
  normalizeFinancialValue,
  calculateRevenueMultiple,
  calculateEBITDAMultiple,
  calculateDCF,
  calculateAssetBased,
  calculateComparableAnalysis,
  calculateBlendedValuation,
  calculateValuationRange,
  evaluateValuationConfidence,
} from "@/domains/valuation/calculator";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";

// Sliding-window rate limiter for recalculation requests
const recalculateRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_RECALCULATIONS_PER_WINDOW = 40;

function checkRecalculateRateLimit(userId: string): void {
  const now = Date.now();
  const timestamps = recalculateRateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_RECALCULATIONS_PER_WINDOW) {
    throw new ValidationError(
      "Rate limit exceeded for valuation recalculation. Please wait before recalculating again."
    );
  }

  validTimestamps.push(now);
  recalculateRateLimitMap.set(userId, validTimestamps);
}

export function resetValuationRateLimits(): void {
  recalculateRateLimitMap.clear();
}

async function generateValuationCaseReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('val_case_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `VAL-${new Date().getFullYear()}-${seqVal}`;
}

/**
 * Multi-tenant authorization guard
 */
export async function assertValuationCaseMember(
  user: AuthenticatedUser,
  caseId: string
): Promise<{
  valuationCase: ValuationCaseRecord;
  userRole: "BUYER" | "SELLER" | "REVIEWER" | "ADMIN";
}> {
  const caseRes = await query<ValuationCaseRecord>(
    `SELECT * FROM valuation_cases WHERE id = $1`,
    [caseId]
  );

  if (caseRes.rows.length === 0) {
    throw new NotFoundError("Valuation workspace not found.");
  }

  const valuationCase = caseRes.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  if (isAdmin) {
    return { valuationCase, userRole: "ADMIN" };
  }

  if (user.id === valuationCase.buyer_id) {
    return { valuationCase, userRole: "BUYER" };
  }

  if (user.id === valuationCase.seller_id) {
    return { valuationCase, userRole: "SELLER" };
  }

  // Check if user has global reviewer role / valuation permissions
  if (
    user.roles.includes("REVIEWER") ||
    user.permissions.includes("valuation.review") ||
    user.permissions.includes("valuation.approve") ||
    user.permissions.includes("valuation.read_all")
  ) {
    return { valuationCase, userRole: "REVIEWER" };
  }

  // Check if user is an authorized reviewer in the linked diligence case
  const ddMemberRes = await query<{ role: string; access_status: string }>(
    `SELECT role, access_status FROM diligence_members WHERE case_id = $1 AND user_id = $2`,
    [valuationCase.diligence_case_id, user.id]
  );

  if (
    ddMemberRes.rows.length > 0 &&
    ddMemberRes.rows[0].access_status === "ACTIVE" &&
    (ddMemberRes.rows[0].role === "REVIEWER" ||
      ddMemberRes.rows[0].role === "LEAD_REVIEWER" ||
      ddMemberRes.rows[0].role === "ADMIN")
  ) {
    return { valuationCase, userRole: "REVIEWER" };
  }

  throw new ForbiddenError("You do not have authorization to access this valuation workspace.");
}

/**
 * 1. CREATE VALUATION CASE
 * Strict 5-Gate Precondition Enforcement:
 * 1. Linked Opportunity published & not soft-deleted.
 * 2. Bilateral NDA in EXECUTED state.
 * 3. Deal Intent MOU in ACCEPTED state.
 * 4. Escrow Token Deposit confirmed in ledger.
 * 5. Due Diligence case active & eligible (not REJECTED).
 */
export async function createValuationCase(
  initiator: AuthenticatedUser,
  diligenceCaseId: string,
  input: CreateValuationCaseInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationCaseOverviewView> {
  const validated = createValuationCaseSchema.parse(input);

  // 1. Fetch Due Diligence Case & Preconditions
  const ddRes = await query<any>(
    `SELECT c.*, o.title as opp_title, o.reference_code as opp_ref, o.status as opp_status, o.deleted_at as opp_deleted_at,
            m.reference_code as mou_ref, m.status as mou_status
     FROM due_diligence_cases c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN deal_mous m ON c.mou_id = m.id
     WHERE c.id = $1`,
    [diligenceCaseId]
  );

  if (ddRes.rows.length === 0) {
    throw new NotFoundError("Due diligence case not found.");
  }

  const dd = ddRes.rows[0];

  // 2. Opportunity Publication Check (Uniform 404 to avoid disclosure)
  if (dd.opp_deleted_at !== null || dd.opp_status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found or not published.");
  }

  // 3. Bilateral NDA Execution Gate
  const ndaRes = await query<{ status: string }>(
    `SELECT status FROM nda_agreements WHERE id = $1`,
    [dd.nda_id]
  );
  if (ndaRes.rows.length === 0 || ndaRes.rows[0].status !== "EXECUTED") {
    throw new ValuationGateError(
      "Cannot initialize valuation workspace. Associated bilateral NDA is not in EXECUTED state."
    );
  }

  // 4. Deal Intent MOU Gate: Must be ACCEPTED
  if (dd.mou_status !== "ACCEPTED") {
    throw new ValuationGateError(
      `Cannot initialize valuation workspace. Deal Intent MOU must be in ACCEPTED status (Current status: ${dd.mou_status}).`
    );
  }

  // 5. Escrow Token Deposit Gate: Must be confirmed
  const tokenRes = await query<any>(
    `SELECT id, status FROM token_deposits 
     WHERE mou_id = $1 AND status = 'TOKEN_PAYMENT_CONFIRMED'
     ORDER BY confirmed_at DESC LIMIT 1`,
    [dd.mou_id]
  );

  const paymentRes = await query<any>(
    `SELECT id, status FROM payment_intents 
     WHERE mou_id = $1 AND status = 'SUCCEEDED'
     ORDER BY completed_at DESC LIMIT 1`,
    [dd.mou_id]
  );

  if (tokenRes.rows.length === 0 && paymentRes.rows.length === 0) {
    throw new ValuationGateError(
      "Cannot initialize valuation workspace. Transaction earnest token deposit has not been confirmed in escrow."
    );
  }

  // 6. Due Diligence Case Eligibility Gate
  if (dd.status === "REJECTED") {
    throw new ValuationGateError(
      "Cannot initialize valuation workspace. Associated due diligence case was REJECTED."
    );
  }

  // 7. Role Privilege: Initiator must be Buyer or Admin (Seller cannot create valuation case)
  const isBuyer = initiator.id === dd.buyer_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN") || initiator.roles.includes("ADMIN");

  if (!isBuyer && !isAdmin) {
    throw new ForbiddenError(
      "Sellers/promoters cannot initialize a valuation workspace for this transaction. Valuation must be initiated by the prospective buyer or authorized financial reviewer."
    );
  }

  // 8. Idempotency Check: return active case if already exists
  const existingCaseRes = await query<ValuationCaseRecord>(
    `SELECT * FROM valuation_cases WHERE diligence_case_id = $1 AND status NOT IN ('REJECTED')`,
    [diligenceCaseId]
  );

  if (existingCaseRes.rows.length > 0) {
    return getValuationCaseById(initiator, existingCaseRes.rows[0].id);
  }

  const caseRef = await generateValuationCaseReference();
  const tokenDepositId = tokenRes.rows[0]?.id || null;

  // 9. Transactional Creation: Case + Initial Version V1
  const createdCase = await transaction(async (tx) => {
    const caseInsert = await tx.query<ValuationCaseRecord>(
      `INSERT INTO valuation_cases (
        reference_code, diligence_case_id, opportunity_id, mou_id, nda_id,
        token_deposit_id, buyer_id, seller_id, status, current_version_number,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'DRAFT', 1, $9, $10)
      RETURNING *`,
      [
        caseRef,
        diligenceCaseId,
        dd.opportunity_id,
        dd.mou_id,
        dd.nda_id,
        tokenDepositId,
        dd.buyer_id,
        dd.seller_id,
        validated.notes || null,
        initiator.id,
      ]
    );

    const vCase = caseInsert.rows[0];

    // Initial default methodology configs
    const defaultMethodConfigs = {
      revenueMultiple: {
        enabled: true,
        conservativeMultiple: 1.5,
        baseMultiple: 2.0,
        optimisticMultiple: 2.5,
      },
      ebitdaMultiple: {
        enabled: true,
        conservativeMultiple: 6.0,
        baseMultiple: 8.0,
        optimisticMultiple: 10.0,
      },
      dcf: {
        enabled: false,
        waccPct: 14.0,
        terminalGrowthRatePct: 4.0,
        projectionYears: [
          { year: 1, projectedRevenue: 100000000, ebitdaMarginPct: 20 },
          { year: 2, projectedRevenue: 120000000, ebitdaMarginPct: 22 },
          { year: 3, projectedRevenue: 140000000, ebitdaMarginPct: 24 },
        ],
      },
      assetBased: {
        enabled: false,
        totalAssets: 0,
        totalLiabilities: 0,
      },
      comparable: {
        enabled: false,
        selectedMultipleType: "REVENUE",
      },
      blended: {
        enabled: false,
        weights: {
          REVENUE_MULTIPLE: 0.5,
          EBITDA_MULTIPLE: 0.5,
        },
      },
    };

    // Insert Version 1
    await tx.query<ValuationVersionRecord>(
      `INSERT INTO valuation_versions (
        case_id, version_number, title, status, currency,
        model_inputs, methodology_configs, calculation_results,
        confidence_score, confidence_level, created_by
      ) VALUES ($1, 1, $2, 'DRAFT', 'INR', '{}'::jsonb, $3, '{}'::jsonb, 20.00, 'LOW', $4)`,
      [
        vCase.id,
        validated.initialTitle || "Valuation Model V1",
        JSON.stringify(defaultMethodConfigs),
        initiator.id,
      ]
    );

    return vCase;
  });

  // Audit Log
  await auditLog({
    actorId: initiator.id,
    action: "VALUATION_CASE_CREATED",
    resourceType: "VALUATION_CASE",
    resourceId: createdCase.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: createdCase.reference_code,
      diligenceCaseId,
      opportunityId: dd.opportunity_id,
    },
  });

  // Counterparty Notification
  await createNotification({
    userId: dd.seller_id,
    type: "VALUATION_WORKSPACE_CREATED",
    title: "Valuation Workspace Initialized",
    message: `A valuation workspace (${createdCase.reference_code}) has been initialized for your opportunity.`,
    resourceType: "VALUATION_CASE",
    resourceId: createdCase.id,
  });

  return getValuationCaseById(initiator, createdCase.id);
}

/**
 * 2. GET VALUATION CASE BY ID
 * Applies progressive confidentiality disclosure:
 * - Buyers, Reviewers, Admins see full financial models, adjustments, and assumptions.
 * - Sellers see only non-sensitive valuation summaries, ranges, and confidence levels.
 */
export async function getValuationCaseById(
  user: AuthenticatedUser,
  caseId: string
): Promise<ValuationCaseOverviewView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);

  const metaRes = await query<any>(
    `SELECT o.reference_code as opp_ref, o.title as opp_title,
            m.reference_code as mou_ref,
            d.reference_code as dd_ref
     FROM valuation_cases v
     JOIN opportunities o ON v.opportunity_id = o.id
     JOIN deal_mous m ON v.mou_id = m.id
     JOIN due_diligence_cases d ON v.diligence_case_id = d.id
     WHERE v.id = $1`,
    [caseId]
  );
  const meta = metaRes.rows[0] || {};

  const versionCountRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM valuation_versions WHERE case_id = $1`,
    [caseId]
  );
  const versionCount = parseInt(versionCountRes.rows[0]?.count || "1", 10);

  // Fetch active/latest version
  const activeVersion = await getValuationVersionDetail(user, caseId, valuationCase.current_version_number);

  return {
    id: valuationCase.id,
    referenceCode: valuationCase.reference_code,
    diligenceCaseId: valuationCase.diligence_case_id,
    diligenceReferenceCode: meta.dd_ref || "",
    opportunityId: valuationCase.opportunity_id,
    opportunityReference: meta.opp_ref || "",
    opportunityTitle: meta.opp_title || "",
    mouId: valuationCase.mou_id,
    mouReferenceCode: meta.mou_ref || "",
    ndaId: valuationCase.nda_id,
    buyerId: valuationCase.buyer_id,
    sellerId: valuationCase.seller_id,
    userRole,
    status: valuationCase.status,
    currentVersionNumber: valuationCase.current_version_number,
    notes: userRole === "SELLER" ? null : valuationCase.notes,
    lockedAt: valuationCase.locked_at ? new Date(valuationCase.locked_at).toISOString() : null,
    createdAt: new Date(valuationCase.created_at).toISOString(),
    updatedAt: new Date(valuationCase.updated_at).toISOString(),
    activeVersion,
    versionCount,
  };
}

/**
 * 3. GET VALUATION VERSION DETAIL
 */
export async function getValuationVersionDetail(
  user: AuthenticatedUser,
  caseId: string,
  versionNumber: number
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT v.*, u.first_name, u.last_name
     FROM valuation_versions v
     JOIN users u ON v.created_by = u.id
     WHERE v.case_id = $1 AND v.version_number = $2`,
    [caseId, versionNumber]
  );

  if (verRes.rows.length === 0) {
    throw new NotFoundError(`Valuation version V${versionNumber} not found.`);
  }

  const ver = verRes.rows[0];

  // Fetch Inputs with evidence provenance details
  const inputsRes = await query<any>(
    `SELECT i.*, e.title as evidence_title
     FROM valuation_inputs i
     LEFT JOIN diligence_evidence e ON i.evidence_id = e.id
     WHERE i.version_id = $1
     ORDER BY i.created_at ASC`,
    [ver.id]
  );

  const inputs: ValuationInputView[] = inputsRes.rows.map((r) => ({
    id: r.id,
    metricName: r.metric_name,
    rawValue: Number(r.raw_value),
    normalizedValue: Number(r.normalized_value),
    currency: r.currency,
    unit: r.unit,
    sourcePeriod: r.source_period,
    provenanceType: r.provenance_type,
    evidenceId: r.evidence_id,
    evidenceTitle: r.evidence_title,
    evidenceVersionNumber: r.evidence_version_number,
    qualityFlag: r.quality_flag,
    notes: userRole === "SELLER" ? null : r.notes,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Fetch Adjustments with linked diligence findings
  const adjRes = await query<any>(
    `SELECT a.*, f.reference_code as finding_ref, f.title as finding_title, f.severity as finding_severity
     FROM valuation_adjustments a
     LEFT JOIN diligence_findings f ON a.source_finding_id = f.id
     WHERE a.version_id = $1
     ORDER BY a.created_at ASC`,
    [ver.id]
  );

  const adjustments: ValuationAdjustmentView[] = adjRes.rows.map((r) => ({
    id: r.id,
    adjustmentType: r.adjustment_type,
    title: r.title,
    amount: Number(r.amount),
    currency: r.currency,
    rationale: r.rationale,
    sourceFindingId: r.source_finding_id,
    sourceFindingReference: r.finding_ref,
    sourceFindingTitle: r.finding_title,
    sourceFindingSeverity: r.finding_severity,
    sourceEvidenceId: r.source_evidence_id,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Fetch Comparables
  const compRes = await query<ValuationComparableRecord>(
    `SELECT * FROM valuation_comparables WHERE version_id = $1 ORDER BY created_at ASC`,
    [ver.id]
  );

  const comparables: ValuationComparableView[] = compRes.rows.map((r) => ({
    id: r.id,
    companyName: r.company_name,
    sector: r.sector,
    period: r.period,
    revenue: Number(r.revenue),
    ebitda: r.ebitda ? Number(r.ebitda) : null,
    impliedEv: Number(r.implied_ev),
    revenueMultiple: r.revenue_multiple ? Number(r.revenue_multiple) : null,
    ebitdaMultiple: r.ebitda_multiple ? Number(r.ebitda_multiple) : null,
    source: r.source,
    sourceDate: r.source_date ? new Date(r.source_date).toISOString().split("T")[0] : null,
    confidence: r.confidence,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  // Confidentiality filter for Seller view: mask raw reviewer internal notes
  const reviewerNotes = userRole === "SELLER" ? null : ver.reviewer_notes;
  const approvalNotes = userRole === "SELLER" ? null : ver.approval_notes;

  return {
    id: ver.id,
    caseId: ver.case_id,
    versionNumber: ver.version_number,
    title: ver.title,
    status: ver.status,
    currency: ver.currency,
    confidenceScore: Number(ver.confidence_score),
    confidenceLevel: ver.confidence_level,
    confidenceFactors: ver.confidence_factors || [],
    modelInputs: ver.model_inputs || {},
    methodologyConfigs: ver.methodology_configs || {},
    calculationResults: ver.calculation_results || {
      scenarios: {},
      range: { status: "VALUATION_RANGE_UNAVAILABLE" },
      indicativeEnterpriseValue: 0,
      indicativeEquityValue: 0,
    },
    inputs,
    adjustments,
    comparables,
    createdBy: ver.created_by,
    createdByName: `${(ver as any).first_name} ${(ver as any).last_name}`,
    submittedAt: ver.submitted_at ? new Date(ver.submitted_at).toISOString() : null,
    submittedBy: ver.submitted_by,
    reviewerId: ver.reviewer_id,
    reviewerNotes,
    reviewedAt: ver.reviewed_at ? new Date(ver.reviewed_at).toISOString() : null,
    approvedAt: ver.approved_at ? new Date(ver.approved_at).toISOString() : null,
    approvedBy: ver.approved_by,
    approvalNotes,
    lockedAt: ver.locked_at ? new Date(ver.locked_at).toISOString() : null,
    lockedBy: ver.locked_by,
    createdAt: new Date(ver.created_at).toISOString(),
  };
}

/**
 * 4. LIST VALUATION CASES
 */
export async function listValuationCases(
  user: AuthenticatedUser,
  options: { limit?: number; offset?: number } = {}
): Promise<{ items: ValuationCaseOverviewView[]; total: number }> {
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const offset = Math.max(options.offset || 0, 0);

  let whereSql = "";
  const params: any[] = [];

  if (!isAdmin) {
    params.push(user.id);
    whereSql = `WHERE v.buyer_id = $1 OR v.seller_id = $1 OR v.diligence_case_id IN (
      SELECT case_id FROM diligence_members WHERE user_id = $1 AND access_status = 'ACTIVE'
    )`;
  }

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM valuation_cases v ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || "0", 10);

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const listRes = await query<ValuationCaseRecord>(
    `SELECT v.* FROM valuation_cases v 
     ${whereSql}
     ORDER BY v.created_at DESC 
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  const items: ValuationCaseOverviewView[] = [];
  for (const c of listRes.rows) {
    const overview = await getValuationCaseById(user, c.id);
    items.push(overview);
  }

  return { items, total };
}

/**
 * 5. ADD VALUATION INPUT
 * Normalizes units, validates evidence provenance, updates active version, and recalculates model.
 */
export async function addValuationInput(
  user: AuthenticatedUser,
  caseId: string,
  input: CreateValuationInputInput,
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot add or alter valuation inputs.");
  }

  const validated = createValuationInputSchema.parse(input);

  // Status Guard: Target version must not be LOCKED or APPROVED
  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError("Active valuation version not found.");
  }
  const ver = verRes.rows[0];

  if (ver.status !== "DRAFT" && ver.status !== "REVISION_REQUIRED") {
    throw new ValuationLockedError(
      `Cannot modify inputs for valuation version with status ${ver.status}. Create a new version or request revision.`
    );
  }

  // Evidence Provenance Check
  if (validated.evidenceId) {
    const evdCheck = await query<any>(
      `SELECT id, case_id FROM diligence_evidence WHERE id = $1 AND case_id = $2`,
      [validated.evidenceId, valuationCase.diligence_case_id]
    );
    if (evdCheck.rows.length === 0) {
      throw new ValidationError("Referenced evidence document does not belong to this deal's due diligence workspace.");
    }
  }

  // Normalize financial amount according to unit
  const normalizedValue = normalizeFinancialValue(validated.rawValue, validated.unit);

  await query(
    `INSERT INTO valuation_inputs (
      case_id, version_id, metric_name, raw_value, normalized_value,
      currency, unit, source_period, provenance_type, evidence_id,
      evidence_version_number, quality_flag, notes, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      caseId,
      ver.id,
      validated.metricName.toUpperCase(),
      validated.rawValue,
      normalizedValue,
      validated.currency,
      validated.unit,
      validated.sourcePeriod || null,
      validated.provenanceType,
      validated.evidenceId || null,
      validated.evidenceVersionNumber || null,
      validated.qualityFlag,
      validated.notes || null,
      user.id,
    ]
  );

  // Recalculate version model
  await recalculateValuationVersion(ver.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_INPUT_ADDED",
    resourceType: "VALUATION_INPUT",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
      metricName: validated.metricName,
      normalizedValue,
      provenanceType: validated.provenanceType,
    },
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 6. ADD VALUATION ADJUSTMENT
 * Requires explicit rationale and author provenance.
 */
export async function addValuationAdjustment(
  user: AuthenticatedUser,
  caseId: string,
  input: CreateValuationAdjustmentInput,
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot add valuation adjustments.");
  }

  const validated = createValuationAdjustmentSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError("Active valuation version not found.");
  }
  const ver = verRes.rows[0];

  if (ver.status !== "DRAFT" && ver.status !== "REVISION_REQUIRED") {
    throw new ValuationLockedError(
      `Cannot modify adjustments for valuation version with status ${ver.status}. Create a new version or request revision.`
    );
  }

  // Check finding linkage
  if (validated.sourceFindingId) {
    const fndCheck = await query<any>(
      `SELECT id FROM diligence_findings WHERE id = $1 AND case_id = $2`,
      [validated.sourceFindingId, valuationCase.diligence_case_id]
    );
    if (fndCheck.rows.length === 0) {
      throw new ValidationError("Referenced diligence finding does not belong to this transaction's diligence case.");
    }
  }

  await query(
    `INSERT INTO valuation_adjustments (
      case_id, version_id, adjustment_type, title, amount,
      currency, rationale, source_finding_id, source_evidence_id, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      caseId,
      ver.id,
      validated.adjustmentType,
      validated.title,
      validated.amount,
      validated.currency,
      validated.rationale,
      validated.sourceFindingId || null,
      validated.sourceEvidenceId || null,
      user.id,
    ]
  );

  await recalculateValuationVersion(ver.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_ADJUSTMENT_ADDED",
    resourceType: "VALUATION_ADJUSTMENT",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
      adjustmentType: validated.adjustmentType,
      amount: validated.amount,
      rationale: validated.rationale,
    },
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 7. ADD VALUATION COMPARABLE PEER
 */
export async function addValuationComparable(
  user: AuthenticatedUser,
  caseId: string,
  input: CreateValuationComparableInput,
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot add comparable companies.");
  }

  const validated = createValuationComparableSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError("Active valuation version not found.");
  }
  const ver = verRes.rows[0];

  if (ver.status !== "DRAFT" && ver.status !== "REVISION_REQUIRED") {
    throw new ValuationLockedError(
      `Cannot modify adjustments for valuation version with status ${ver.status}. Create a new version or request revision.`
    );
  }

  const revMultiple = validated.impliedEv / validated.revenue;
  const ebitdaMultiple =
    validated.ebitda && validated.ebitda > 0
      ? validated.impliedEv / validated.ebitda
      : null;

  await query(
    `INSERT INTO valuation_comparables (
      case_id, version_id, company_name, sector, period,
      revenue, ebitda, implied_ev, revenue_multiple, ebitda_multiple,
      source, source_date, confidence
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      caseId,
      ver.id,
      validated.companyName,
      validated.sector,
      validated.period,
      validated.revenue,
      validated.ebitda || null,
      validated.impliedEv,
      Math.round(revMultiple * 100) / 100,
      ebitdaMultiple ? Math.round(ebitdaMultiple * 100) / 100 : null,
      validated.source,
      validated.sourceDate || null,
      validated.confidence,
    ]
  );

  await recalculateValuationVersion(ver.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_COMPARABLE_ADDED",
    resourceType: "VALUATION_COMPARABLE",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      companyName: validated.companyName,
      impliedEv: validated.impliedEv,
      revenueMultiple: revMultiple,
    },
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 8. UPDATE VALUATION MODEL & METHODOLOGY CONFIGS
 */
export async function updateValuationModel(
  user: AuthenticatedUser,
  caseId: string,
  input: UpdateValuationModelInput,
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot configure valuation methodologies.");
  }

  checkRecalculateRateLimit(user.id);
  const validated = updateValuationModelSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) {
    throw new NotFoundError("Active valuation version not found.");
  }
  const ver = verRes.rows[0];

  if (ver.status !== "DRAFT" && ver.status !== "REVISION_REQUIRED") {
    throw new ValuationLockedError(
      `Cannot modify adjustments for valuation version with status ${ver.status}. Create a new version or request revision.`
    );
  }

  const currentConfigs = ver.methodology_configs || {};
  const updatedConfigs = {
    ...currentConfigs,
    ...(validated.methodologyConfigs || {}),
  };

  const updates: string[] = ["methodology_configs = $1"];
  const params: any[] = [JSON.stringify(updatedConfigs)];

  if (validated.title) {
    params.push(validated.title);
    updates.push(`title = $${params.length}`);
  }
  if (validated.currency) {
    params.push(validated.currency);
    updates.push(`currency = $${params.length}`);
  }

  params.push(ver.id);
  await query(
    `UPDATE valuation_versions SET ${updates.join(", ")} WHERE id = $${params.length}`,
    params
  );

  await recalculateValuationVersion(ver.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_MODEL_UPDATED",
    resourceType: "VALUATION_VERSION",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
    },
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 9. CREATE NEW VALUATION VERSION (V1 -> V2 -> V3)
 * Deep-clones inputs, adjustments, comparables, and configs from previous version into a new immutable draft.
 */
export async function createValuationVersion(
  user: AuthenticatedUser,
  caseId: string,
  titleOrInput?: string | { title?: string },
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const title = typeof titleOrInput === "object" && titleOrInput !== null ? titleOrInput.title : titleOrInput;
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot create new valuation versions.");
  }

  const prevVerRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (prevVerRes.rows.length === 0) {
    throw new NotFoundError("Current valuation version not found.");
  }
  const prevVer = prevVerRes.rows[0];

  const nextVerNum = valuationCase.current_version_number + 1;
  const newTitle = title || `Valuation Model V${nextVerNum}`;

  const newVer = await transaction(async (tx) => {
    // 1. Insert New Version
    const verInsert = await tx.query<ValuationVersionRecord>(
      `INSERT INTO valuation_versions (
        case_id, version_number, title, status, currency,
        model_inputs, methodology_configs, calculation_results,
        confidence_score, confidence_level, created_by
      ) VALUES ($1, $2, $3, 'DRAFT', $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        caseId,
        nextVerNum,
        newTitle,
        prevVer.currency,
        JSON.stringify(prevVer.model_inputs || {}),
        JSON.stringify(prevVer.methodology_configs || {}),
        JSON.stringify(prevVer.calculation_results || {}),
        prevVer.confidence_score,
        prevVer.confidence_level,
        user.id,
      ]
    );

    const insertedVer = verInsert.rows[0];

    // 2. Clone Inputs
    await tx.query(
      `INSERT INTO valuation_inputs (
        case_id, version_id, metric_name, raw_value, normalized_value,
        currency, unit, source_period, provenance_type, evidence_id,
        evidence_version_number, quality_flag, notes, created_by
      )
      SELECT case_id, $1, metric_name, raw_value, normalized_value,
             currency, unit, source_period, provenance_type, evidence_id,
             evidence_version_number, quality_flag, notes, $2
      FROM valuation_inputs WHERE version_id = $3`,
      [insertedVer.id, user.id, prevVer.id]
    );

    // 3. Clone Adjustments
    await tx.query(
      `INSERT INTO valuation_adjustments (
        case_id, version_id, adjustment_type, title, amount,
        currency, rationale, source_finding_id, source_evidence_id, created_by
      )
      SELECT case_id, $1, adjustment_type, title, amount,
             currency, rationale, source_finding_id, source_evidence_id, $2
      FROM valuation_adjustments WHERE version_id = $3`,
      [insertedVer.id, user.id, prevVer.id]
    );

    // 4. Clone Comparables
    await tx.query(
      `INSERT INTO valuation_comparables (
        case_id, version_id, company_name, sector, period,
        revenue, ebitda, implied_ev, revenue_multiple, ebitda_multiple,
        source, source_date, confidence
      )
      SELECT case_id, $1, company_name, sector, period,
             revenue, ebitda, implied_ev, revenue_multiple, ebitda_multiple,
             source, source_date, confidence
      FROM valuation_comparables WHERE version_id = $2`,
      [insertedVer.id, prevVer.id]
    );

    // 5. Update Case current version pointer and status
    await tx.query(
      `UPDATE valuation_cases 
       SET current_version_number = $1, status = 'DRAFT', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [nextVerNum, caseId]
    );

    return insertedVer;
  });

  await recalculateValuationVersion(newVer.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_VERSION_CREATED",
    resourceType: "VALUATION_VERSION",
    resourceId: newVer.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      previousVersion: prevVer.version_number,
      newVersion: nextVerNum,
    },
  });

  return getValuationVersionDetail(user, caseId, nextVerNum);
}

/**
 * 10. SUBMIT VALUATION VERSION (DRAFT -> SUBMITTED)
 */
export async function submitValuationVersion(
  user: AuthenticatedUser,
  caseId: string,
  input: SubmitValuationVersionInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot submit valuation models.");
  }

  const validated = submitValuationVersionSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) throw new NotFoundError("Version not found.");
  const ver = verRes.rows[0];

  if (ver.status !== "DRAFT" && ver.status !== "REVISION_REQUIRED") {
    throw new InvalidValuationStateError(
      `Cannot submit valuation version in status ${ver.status}. Must be in DRAFT or REVISION_REQUIRED state.`
    );
  }

  await query(
    `UPDATE valuation_versions 
     SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP, submitted_by = $1
     WHERE id = $2`,
    [user.id, ver.id]
  );

  await query(
    `UPDATE valuation_cases 
     SET status = 'SUBMITTED', updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [caseId]
  );

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_VERSION_SUBMITTED",
    resourceType: "VALUATION_VERSION",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
      notes: validated.notes,
    },
  });

  // Notify Reviewers and Seller
  await createNotification({
    userId: valuationCase.seller_id,
    type: "VALUATION_VERSION_SUBMITTED",
    title: "Valuation Submitted for Review",
    message: `Valuation model V${ver.version_number} (${valuationCase.reference_code}) has been formally submitted for evaluation.`,
    resourceType: "VALUATION_CASE",
    resourceId: caseId,
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 11. REVIEW VALUATION VERSION (APPROVE / REVISION_REQUIRED / REJECT)
 * Strict Invariants:
 * - Anti-Self-Approval: The creator/buyer cannot review or approve their own submission.
 * - Seller cannot approve buyer's valuation.
 * - Reviewer or Admin context required.
 */
export async function reviewValuationVersion(
  user: AuthenticatedUser,
  caseId: string,
  input: ReviewValuationVersionInput,
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  const validated = reviewValuationVersionSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) throw new NotFoundError("Version not found.");
  const ver = verRes.rows[0];

  if (ver.status !== "SUBMITTED" && ver.status !== "UNDER_REVIEW") {
    throw new InvalidValuationStateError(
      `Cannot review valuation version in status ${ver.status}. Must be in SUBMITTED or UNDER_REVIEW state.`
    );
  }

  // Anti-Self-Approval Guard: Submitter / Creator cannot approve their own model
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  if (!isAdmin && (user.id === ver.created_by || user.id === ver.submitted_by || user.id === valuationCase.buyer_id)) {
    throw new ValuationGateError(
      "Anti-Self-Approval Guard: Valuations cannot be self-reviewed or approved by their author or submitting buyer. An independent financial reviewer or administrator must evaluate the model."
    );
  }

  // Seller cannot approve
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot unilaterally approve valuation models.");
  }

  const updates: string[] = [
    `status = $1`,
    `reviewer_id = $2`,
    `reviewed_at = CURRENT_TIMESTAMP`,
    `reviewer_notes = $3`,
  ];
  const params: any[] = [validated.decision, user.id, validated.notes];

  if (validated.decision === "APPROVED") {
    params.push(user.id);
    updates.push(`approved_by = $${params.length}`);
    updates.push(`approved_at = CURRENT_TIMESTAMP`);
    params.push(validated.notes);
    updates.push(`approval_notes = $${params.length}`);
  }

  params.push(ver.id);
  await query(
    `UPDATE valuation_versions SET ${updates.join(", ")} WHERE id = $${params.length}`,
    params
  );

  await query(
    `UPDATE valuation_cases 
     SET status = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [validated.decision, caseId]
  );

  // Recalculate with reviewer approval confidence bonus
  await recalculateValuationVersion(ver.id);

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: `VALUATION_VERSION_${validated.decision}`,
    resourceType: "VALUATION_VERSION",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
      decision: validated.decision,
      notes: validated.notes,
    },
  });

  // Notify Buyer and Seller
  await createNotification({
    userId: valuationCase.buyer_id,
    type: `VALUATION_VERSION_${validated.decision}`,
    title: `Valuation V${ver.version_number} ${validated.decision.replace("_", " ")}`,
    message: `Reviewer evaluated valuation V${ver.version_number} with verdict: ${validated.decision}. Notes: "${validated.notes}"`,
    resourceType: "VALUATION_CASE",
    resourceId: caseId,
  });

  await createNotification({
    userId: valuationCase.seller_id,
    type: `VALUATION_VERSION_${validated.decision}`,
    title: `Valuation V${ver.version_number} ${validated.decision.replace("_", " ")}`,
    message: `Valuation version V${ver.version_number} has been evaluated by reviewers with verdict: ${validated.decision}.`,
    resourceType: "VALUATION_CASE",
    resourceId: caseId,
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 12. LOCK VALUATION VERSION (APPROVED -> LOCKED)
 * Permanently locks an approved valuation version into an immutable historical record.
 */
export async function lockValuationVersion(
  user: AuthenticatedUser,
  caseId: string,
  input: LockValuationVersionInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<ValuationVersionDetailView> {
  const { valuationCase, userRole } = await assertValuationCaseMember(user, caseId);
  if (userRole === "SELLER") {
    throw new ForbiddenError("Sellers/promoters cannot lock valuation records.");
  }

  const validated = lockValuationVersionSchema.parse(input);

  const verRes = await query<ValuationVersionRecord>(
    `SELECT * FROM valuation_versions WHERE case_id = $1 AND version_number = $2`,
    [caseId, valuationCase.current_version_number]
  );
  if (verRes.rows.length === 0) throw new NotFoundError("Version not found.");
  const ver = verRes.rows[0];

  if (ver.status !== "APPROVED") {
    throw new InvalidValuationStateError(
      `Cannot lock valuation version in status ${ver.status}. Only APPROVED valuation versions may be permanently locked.`
    );
  }

  await query(
    `UPDATE valuation_versions 
     SET status = 'LOCKED', locked_at = CURRENT_TIMESTAMP, locked_by = $1
     WHERE id = $2`,
    [user.id, ver.id]
  );

  await query(
    `UPDATE valuation_cases 
     SET status = 'LOCKED', locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [caseId]
  );

  // Audit Log
  await auditLog({
    actorId: user.id,
    action: "VALUATION_VERSION_LOCKED",
    resourceType: "VALUATION_VERSION",
    resourceId: ver.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      caseReference: valuationCase.reference_code,
      versionNumber: ver.version_number,
      lockReason: validated.lockReason,
    },
  });

  return getValuationVersionDetail(user, caseId, ver.version_number);
}

/**
 * 13. RECALCULATE VALUATION VERSION
 * Deterministic orchestrator that executes all configured methodologies across scenarios.
 */
export async function recalculateValuationVersion(versionId: string): Promise<void> {
  const verRes = await query<ValuationVersionRecord & { diligence_case_id: string }>(
    `SELECT v.*, c.diligence_case_id 
     FROM valuation_versions v
     JOIN valuation_cases c ON v.case_id = c.id
     WHERE v.id = $1`,
    [versionId]
  );
  if (verRes.rows.length === 0) return;
  const ver = verRes.rows[0];

  // Fetch inputs
  const inpRes = await query<ValuationInputRecord>(
    `SELECT * FROM valuation_inputs WHERE version_id = $1`,
    [versionId]
  );
  const inputs = inpRes.rows;

  // Extract core financial metrics
  const inputMap = new Map<string, number>();
  for (const i of inputs) {
    inputMap.set(i.metric_name, Number(i.normalized_value));
  }

  const revenue = inputMap.get("REVENUE") ?? 0;
  const ebitda = inputMap.get("EBITDA") ?? 0;
  const totalDebt = inputMap.get("TOTAL_DEBT") ?? 0;
  const cash = inputMap.get("CASH") ?? 0;
  const totalAssets = inputMap.get("TOTAL_ASSETS") ?? 0;
  const totalLiabilities = inputMap.get("TOTAL_LIABILITIES") ?? 0;

  // Fetch adjustments
  const adjRes = await query<ValuationAdjustmentRecord>(
    `SELECT * FROM valuation_adjustments WHERE version_id = $1`,
    [versionId]
  );
  const adjustments = adjRes.rows;

  // Fetch comparables
  const compRes = await query<ValuationComparableRecord>(
    `SELECT * FROM valuation_comparables WHERE version_id = $1`,
    [versionId]
  );
  const comparables = compRes.rows;

  // Fetch active diligence findings for confidence impact
  const fndRes = await query<{ severity: string }>(
    `SELECT severity FROM diligence_findings 
     WHERE case_id = $1 AND status NOT IN ('RESOLVED', 'CLOSED')`,
    [ver.diligence_case_id]
  );
  const activeFindings = fndRes.rows;

  const configs = ver.methodology_configs || {};

  // Compute for all 3 Scenarios: CONSERVATIVE, BASE, OPTIMISTIC
  const scenarios: Record<ValuationScenario, ScenarioCalculationOutput> = {
    CONSERVATIVE: {
      scenario: "CONSERVATIVE",
      summaryEnterpriseValue: 0,
      summaryEquityValue: 0,
    },
    BASE: {
      scenario: "BASE",
      summaryEnterpriseValue: 0,
      summaryEquityValue: 0,
    },
    OPTIMISTIC: {
      scenario: "OPTIMISTIC",
      summaryEnterpriseValue: 0,
      summaryEquityValue: 0,
    },
  };

  const validEVs: number[] = [];
  const validEqs: number[] = [];

  const scenarioKeys: ValuationScenario[] = ["CONSERVATIVE", "BASE", "OPTIMISTIC"];
  for (const sc of scenarioKeys) {
    const scOutput: ScenarioCalculationOutput = {
      scenario: sc,
      summaryEnterpriseValue: 0,
      summaryEquityValue: 0,
    };

    const methodOutputs: Array<{
      methodology: string;
      enterpriseValue: number | null;
      equityValue: number | null;
    }> = [];

    // 1. Revenue Multiple
    if (configs.revenueMultiple?.enabled && revenue > 0) {
      let mult = configs.revenueMultiple.baseMultiple;
      if (sc === "CONSERVATIVE") mult = configs.revenueMultiple.conservativeMultiple;
      if (sc === "OPTIMISTIC") mult = configs.revenueMultiple.optimisticMultiple;

      const rRes = calculateRevenueMultiple(revenue, mult, totalDebt, cash);
      scOutput.revenueMultiple = rRes;
      methodOutputs.push({
        methodology: "REVENUE_MULTIPLE",
        enterpriseValue: rRes.enterpriseValue,
        equityValue: rRes.equityValue,
      });
      validEVs.push(rRes.enterpriseValue);
      validEqs.push(rRes.equityValue);
    }

    // 2. EBITDA Multiple
    if (configs.ebitdaMultiple?.enabled) {
      let mult = configs.ebitdaMultiple.baseMultiple;
      if (sc === "CONSERVATIVE") mult = configs.ebitdaMultiple.conservativeMultiple;
      if (sc === "OPTIMISTIC") mult = configs.ebitdaMultiple.optimisticMultiple;

      const ebRes = calculateEBITDAMultiple(ebitda, mult, totalDebt, cash);
      scOutput.ebitdaMultiple = ebRes;
      if (ebRes.enterpriseValue !== null && ebRes.equityValue !== null) {
        methodOutputs.push({
          methodology: "EBITDA_MULTIPLE",
          enterpriseValue: ebRes.enterpriseValue,
          equityValue: ebRes.equityValue,
        });
        validEVs.push(ebRes.enterpriseValue);
        validEqs.push(ebRes.equityValue);
      }
    }

    // 3. DCF
    if (configs.dcf?.enabled && configs.dcf.projectionYears?.length > 0) {
      let dcfWacc = configs.dcf.waccPct;
      let dcfG = configs.dcf.terminalGrowthRatePct;
      if (sc === "CONSERVATIVE") {
        dcfWacc += 1.0;
        dcfG = Math.max(0, dcfG - 0.5);
      }
      if (sc === "OPTIMISTIC") {
        dcfWacc = Math.max(1.0, dcfWacc - 1.0);
        dcfG += 0.5;
      }

      const dcfRes = calculateDCF({
        projectionYears: configs.dcf.projectionYears,
        waccPct: dcfWacc,
        terminalGrowthRatePct: dcfG,
        totalDebt,
        cashAndEquivalents: cash,
      });
      scOutput.dcf = dcfRes;
      if (dcfRes.validationStatus === "VALID") {
        methodOutputs.push({
          methodology: "DISCOUNTED_CASH_FLOW",
          enterpriseValue: dcfRes.enterpriseValue,
          equityValue: dcfRes.equityValue,
        });
        validEVs.push(dcfRes.enterpriseValue);
        validEqs.push(dcfRes.equityValue);
      }
    }

    // 4. Asset-Based
    if (configs.assetBased?.enabled && (totalAssets > 0 || configs.assetBased.totalAssets > 0)) {
      const astRes = calculateAssetBased(
        configs.assetBased.totalAssets || totalAssets,
        configs.assetBased.totalLiabilities || totalLiabilities,
        adjustments
      );
      scOutput.assetBased = astRes;
      methodOutputs.push({
        methodology: "ASSET_BASED",
        enterpriseValue: astRes.enterpriseValue,
        equityValue: astRes.equityValue,
      });
      validEVs.push(astRes.enterpriseValue);
      validEqs.push(astRes.equityValue);
    }

    // 5. Comparables
    if (configs.comparable?.enabled) {
      const compRes = calculateComparableAnalysis(
        comparables,
        revenue,
        ebitda,
        configs.comparable.selectedMultipleType || "REVENUE",
        totalDebt,
        cash
      );
      scOutput.comparables = compRes;
      if (compRes.enterpriseValue !== null && compRes.equityValue !== null) {
        methodOutputs.push({
          methodology: "COMPARABLE_COMPANIES",
          enterpriseValue: compRes.enterpriseValue,
          equityValue: compRes.equityValue,
        });
        validEVs.push(compRes.enterpriseValue);
        validEqs.push(compRes.equityValue);
      }
    }

    // 6. Blended
    if (configs.blended?.enabled && configs.blended.weights) {
      try {
        const blRes = calculateBlendedValuation(methodOutputs, configs.blended.weights);
        scOutput.blended = blRes;
        scOutput.summaryEnterpriseValue = blRes.blendedEnterpriseValue;
        scOutput.summaryEquityValue = blRes.blendedEquityValue;
      } catch (err) {
        // If weights do not match available outputs, calculate unweighted average
        const avgEV =
          methodOutputs.length > 0
            ? methodOutputs.reduce((acc, m) => acc + (m.enterpriseValue || 0), 0) / methodOutputs.length
            : 0;
        const avgEq =
          methodOutputs.length > 0
            ? methodOutputs.reduce((acc, m) => acc + (m.equityValue || 0), 0) / methodOutputs.length
            : 0;
        scOutput.summaryEnterpriseValue = Math.round(avgEV);
        scOutput.summaryEquityValue = Math.round(avgEq);
      }
    } else {
      const avgEV =
        methodOutputs.length > 0
          ? methodOutputs.reduce((acc, m) => acc + (m.enterpriseValue || 0), 0) / methodOutputs.length
          : 0;
      const avgEq =
        methodOutputs.length > 0
          ? methodOutputs.reduce((acc, m) => acc + (m.equityValue || 0), 0) / methodOutputs.length
          : 0;
      scOutput.summaryEnterpriseValue = Math.round(avgEV);
      scOutput.summaryEquityValue = Math.round(avgEq);
    }

    scenarios[sc] = scOutput;
  }

  // Derive Range
  const rangeResult = calculateValuationRange(validEVs, validEqs);

  // Evaluate Confidence Model
  const appliedMethodsCount = [
    configs.revenueMultiple?.enabled,
    configs.ebitdaMultiple?.enabled,
    configs.dcf?.enabled,
    configs.assetBased?.enabled,
    configs.comparable?.enabled,
  ].filter(Boolean).length;

  const confidenceResult = evaluateValuationConfidence({
    inputs: inputs.map((i) => ({
      provenanceType: i.provenance_type,
      qualityFlag: i.quality_flag,
      sourcePeriod: i.source_period,
    })),
    methodologiesCount: appliedMethodsCount,
    comparablesCount: comparables.length,
    activeDiligenceFindings: activeFindings,
    isReviewerApproved: ver.status === "APPROVED" || ver.status === "LOCKED",
  });

  const baseScenario = scenarios.BASE;
  const indicativeEnterpriseValue = baseScenario.summaryEnterpriseValue;
  const indicativeEquityValue = baseScenario.summaryEquityValue;

  const calcResults = {
    scenarios,
    range: rangeResult,
    blended: baseScenario.blended,
    indicativeEnterpriseValue,
    indicativeEquityValue,
  };

  await query(
    `UPDATE valuation_versions 
     SET calculation_results = $1,
         confidence_score = $2,
         confidence_level = $3,
         confidence_factors = $4
     WHERE id = $5`,
    [
      JSON.stringify(calcResults),
      confidenceResult.score,
      confidenceResult.level,
      JSON.stringify(confidenceResult.factors),
      versionId,
    ]
  );
}

/**
 * 14. GET SELLER PROGRESSIVE DISCLOSURE VIEW
 */
export async function getSellerValuationSummary(
  seller: AuthenticatedUser,
  caseId: string
): Promise<ValuationSellerSummaryView> {
  const { valuationCase } = await assertValuationCaseMember(seller, caseId);

  const overview = await getValuationCaseById(seller, caseId);
  const activeVer = overview.activeVersion;

  const appliedMethods: ValuationMethodology[] = [];
  const configs = activeVer?.methodologyConfigs || {};
  if (configs.revenueMultiple?.enabled) appliedMethods.push("REVENUE_MULTIPLE");
  if (configs.ebitdaMultiple?.enabled) appliedMethods.push("EBITDA_MULTIPLE");
  if (configs.dcf?.enabled) appliedMethods.push("DISCOUNTED_CASH_FLOW");
  if (configs.assetBased?.enabled) appliedMethods.push("ASSET_BASED");
  if (configs.comparable?.enabled) appliedMethods.push("COMPARABLE_COMPANIES");
  if (configs.blended?.enabled) appliedMethods.push("BLENDED");

  return {
    caseId: valuationCase.id,
    referenceCode: valuationCase.reference_code,
    diligenceCaseId: valuationCase.diligence_case_id,
    opportunityTitle: overview.opportunityTitle,
    status: valuationCase.status,
    currentVersionNumber: valuationCase.current_version_number,
    indicativeValuationRange: {
      lowEnterpriseValue: activeVer?.calculationResults?.range?.lowEnterpriseValue ?? null,
      baseEnterpriseValue: activeVer?.calculationResults?.range?.baseEnterpriseValue ?? null,
      highEnterpriseValue: activeVer?.calculationResults?.range?.highEnterpriseValue ?? null,
    },
    confidenceLevel: activeVer?.confidenceLevel || "LOW",
    methodologiesApplied: appliedMethods,
    disclosedAt: new Date().toISOString(),
  };
}
