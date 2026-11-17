// Scale-up India — Phase 10: Deal Intent & Bilateral MOU Domain Service
// Path: src/domains/mou/service.ts

import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import {
  MOUStatus,
  MOUVersionStatus,
  ProposedStructure,
  DealMOURecord,
  MOUVersionRecord,
  MOUCommercialTerms,
  DealMOUListItemView,
  DealMOUDetailView,
  MOUVersionView,
} from "@/types/mou";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateMOUInput,
  CounterMOUInput,
  RejectMOUInput,
  WithdrawMOUInput,
  AcceptMOUInput,
  createMOUInputSchema,
  counterMOUInputSchema,
  acceptMOUInputSchema,
  rejectMOUInputSchema,
  withdrawMOUInputSchema,
} from "@/schemas/mou";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";

const STANDARD_NON_BINDING_DISCLAIMER =
  "NON-BINDING DEAL INTENT: This Memorandum of Understanding / Deal Intent document represents preliminary commercial terms and agreed intentions between the prospective buyer and promoter. It does not constitute a legally binding agreement of sale or transfer under applicable law, save for confidentiality, exclusivity, and governing law provisions. Definitive transaction completion remains subject to satisfactory due diligence, definitive agreements (Share Purchase/Asset Sale Agreement), and statutory approvals.";

/**
 * Helper to check and resolve lazy expiry
 */
async function checkAndApplyExpiry(mou: any): Promise<any> {
  if (
    (mou.status === "PROPOSED" || mou.status === "COUNTERED") &&
    mou.valid_until &&
    new Date(mou.valid_until) < new Date()
  ) {
    await query(
      `UPDATE deal_mous 
       SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND status IN ('PROPOSED', 'COUNTERED')`,
      [mou.id]
    );
    mou.status = "EXPIRED";
    mou.expired_at = new Date().toISOString();
  }
  return mou;
}

/**
 * 1. CREATE DEAL INTENT MOU (DRAFT OR SUBMITTED PROPOSAL)
 * Precondition:
 * - Opportunity must be PUBLISHED
 * - Bilateral NDA must be fully EXECUTED
 * - Active or valid deal discussion must exist
 * - Only authorized Buyer or Seller of that deal may initiate
 */
export async function createMOU(
  initiator: AuthenticatedUser,
  opportunityId: string,
  input: CreateMOUInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  const validated = createMOUInputSchema.parse(input);

  // 1. Verify opportunity exists and is published
  const oppRes = await query<any>(
    `SELECT id, reference_code, title, status, deleted_at FROM opportunities WHERE id = $1`,
    [opportunityId]
  );
  if (oppRes.rows.length === 0 || oppRes.rows[0].deleted_at !== null) {
    throw new NotFoundError("Business opportunity not found.");
  }
  if (oppRes.rows[0].status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found.");
  }

  // 2. Verify Bilateral NDA
  const ndaRes = await query<any>(
    `SELECT n.*, o.reference_code as opp_ref, o.title as opp_title
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     WHERE n.id = $1`,
    [validated.ndaId]
  );

  if (ndaRes.rows.length === 0) {
    throw new NotFoundError("Associated bilateral NDA agreement not found.");
  }

  const nda = ndaRes.rows[0];

  // Must match specified opportunity
  if (nda.opportunity_id !== opportunityId) {
    throw new ValidationError("Bilateral NDA agreement does not match the specified opportunity.");
  }

  // CRITICAL GATE: NDA must be EXECUTED
  if (nda.status !== "EXECUTED") {
    throw new ValidationError(
      `Cannot create Deal Intent MOU. Bilateral NDA must be fully EXECUTED (Current status: ${nda.status}).`
    );
  }

  // Anti-IDOR Authorization Check: Initiator must be the buyer or seller of the bilateral NDA
  const isBuyer = initiator.id === nda.buyer_id;
  const isSeller = initiator.id === nda.seller_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not an authorized principal to this deal transaction.");
  }

  const initiatorRole: "BUYER" | "SELLER" = isBuyer ? "BUYER" : "SELLER";
  const recipientUserId = isBuyer ? nda.seller_id : nda.buyer_id;

  // 3. Check for existing active or accepted MOU for this bilateral NDA
  const existingMOURes = await query<any>(
    `SELECT id, reference_code, status 
     FROM deal_mous 
     WHERE nda_id = $1 AND status IN ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED')`,
    [validated.ndaId]
  );

  if (existingMOURes.rows.length > 0) {
    throw new ConflictError(
      `An active or accepted Deal Intent MOU already exists for this deal (Reference: ${existingMOURes.rows[0].reference_code}).`
    );
  }

  // Find linked deal conversation if exists
  const convRes = await query<{ id: string }>(
    `SELECT id FROM deal_conversations WHERE nda_id = $1 LIMIT 1`,
    [validated.ndaId]
  );
  const conversationId = convRes.rows[0]?.id || null;

  // 4. Allocate reference code: MOU-YYYY-seq
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('mou_ref_seq') as nextval`);
  const seqVal = seqRes.rows[0]?.nextval || "10001";
  const referenceCode = `MOU-${new Date().getFullYear()}-${seqVal}`;

  const submitNow = Boolean(validated.submitImmediately);
  const initialStatus: MOUStatus = submitNow ? "PROPOSED" : "DRAFT";
  const versionStatus: MOUVersionStatus = submitNow ? "PROPOSED" : "DRAFT";

  const validityDays = validated.terms.validityDays || 14;
  const validUntil = submitNow
    ? new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const nowIso = new Date().toISOString();

  // 5. Transactionally create MOU and Version 1
  const mou = await transaction(async (tx) => {
    const insertMOURes = await tx.query<any>(
      `INSERT INTO deal_mous (
        reference_code, opportunity_id, eoi_id, nda_id, conversation_id,
        buyer_id, seller_id, created_by, current_version_number,
        status, valid_until, last_proposed_by, last_proposed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12)
      RETURNING *`,
      [
        referenceCode,
        opportunityId,
        nda.eoi_id,
        nda.id,
        conversationId,
        nda.buyer_id,
        nda.seller_id,
        initiator.id,
        initialStatus,
        validUntil,
        submitNow ? initiator.id : null,
        submitNow ? nowIso : null,
      ]
    );

    const createdMOU = insertMOURes.rows[0];

    // Insert Version 1
    await tx.query(
      `INSERT INTO mou_versions (
        mou_id, version_number, proposed_by, proposed_by_role, status,
        proposed_valuation, currency, proposed_structure,
        cash_consideration, equity_consideration, earnest_deposit_amount,
        exclusivity_period_days, due_diligence_window_days,
        target_closing_date, conditions_precedent, key_assumptions,
        summary_notes, non_binding_disclaimer
      ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        createdMOU.id,
        initiator.id,
        initiatorRole,
        versionStatus,
        validated.terms.proposedValuation,
        validated.terms.currency || "INR",
        validated.terms.proposedStructure,
        validated.terms.cashConsideration || 0,
        validated.terms.equityConsideration || 0,
        validated.terms.earnestDepositAmount || 0,
        validated.terms.exclusivityPeriodDays ?? 30,
        validated.terms.dueDiligenceWindowDays ?? 45,
        validated.terms.targetClosingDate || null,
        validated.terms.conditionsPrecedent || [],
        validated.terms.keyAssumptions || null,
        validated.terms.summaryNotes || null,
        STANDARD_NON_BINDING_DISCLAIMER,
      ]
    );

    return createdMOU;
  });

  // 6. Audit Logging
  await auditLog({
    actorId: initiator.id,
    action: "MOU_CREATED",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode,
      opportunityId,
      ndaId: nda.id,
      versionNumber: 1,
      status: initialStatus,
      proposedValuation: validated.terms.proposedValuation,
      currency: validated.terms.currency || "INR",
      proposedStructure: validated.terms.proposedStructure,
    },
  });

  if (submitNow) {
    await auditLog({
      actorId: initiator.id,
      action: "MOU_PROPOSED",
      resourceType: "DEAL_MOU",
      resourceId: mou.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        referenceCode,
        versionNumber: 1,
        proposedValuation: validated.terms.proposedValuation,
        exclusivityPeriodDays: validated.terms.exclusivityPeriodDays ?? 30,
        dueDiligenceWindowDays: validated.terms.dueDiligenceWindowDays ?? 45,
      },
    });

    // In-app notification to counterparty
    await createNotification({
      userId: recipientUserId,
      type: "MOU_PROPOSED",
      title: "New Deal Intent (MOU) Proposed",
      message: `A formal commercial deal intent has been proposed for ${nda.opp_title} (${referenceCode}).`,
      resourceType: "DEAL_MOU",
      resourceId: mou.id,
    });
  }

  return getMOUById(initiator, mou.id);
}

/**
 * 2. PROPOSE AN EXISTING DRAFT MOU
 */
export async function proposeMOUDraft(
  initiator: AuthenticatedUser,
  mouId: string,
  validityDays = 14,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  const mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title 
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  const mou = mouRes.rows[0];

  // Anti-IDOR Authorization Check
  if (mou.buyer_id !== initiator.id && mou.seller_id !== initiator.id && !initiator.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You do not have permission to access or submit this Deal Intent MOU.");
  }

  if (mou.status !== "DRAFT") {
    throw new ValidationError(`Cannot submit draft MOU. Current status is ${mou.status}.`);
  }

  if (mou.created_by !== initiator.id) {
    throw new ForbiddenError("Only the author of the draft Deal Intent may submit it for counterparty review.");
  }

  const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
  const recipientUserId = initiator.id === mou.buyer_id ? mou.seller_id : mou.buyer_id;

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE deal_mous 
       SET status = 'PROPOSED', 
           valid_until = $1, 
           last_proposed_by = $2, 
           last_proposed_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [validUntil, initiator.id, mouId]
    );

    await tx.query(
      `UPDATE mou_versions 
       SET status = 'PROPOSED' 
       WHERE mou_id = $1 AND version_number = 1`,
      [mouId]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "MOU_PROPOSED",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: mou.reference_code,
      versionNumber: 1,
    },
  });

  await createNotification({
    userId: recipientUserId,
    type: "MOU_PROPOSED",
    title: "New Deal Intent (MOU) Proposed",
    message: `A formal commercial deal intent has been proposed for ${mou.opp_title} (${mou.reference_code}).`,
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
  });

  return getMOUById(initiator, mouId);
}

/**
 * 3. SUBMIT COUNTERPROPOSAL (CREATES NEW IMMUTABLE VERSION)
 */
export async function counterMOU(
  initiator: AuthenticatedUser,
  mouId: string,
  input: CounterMOUInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  const validated = counterMOUInputSchema.parse(input);

  let mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title 
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  let mou = await checkAndApplyExpiry(mouRes.rows[0]);

  // Anti-IDOR Authorization Check
  if (mou.buyer_id !== initiator.id && mou.seller_id !== initiator.id && !initiator.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You do not have permission to counter this Deal Intent MOU.");
  }

  // State Machine Guard
  if (mou.status !== "PROPOSED" && mou.status !== "COUNTERED") {
    throw new ValidationError(`Cannot counter Deal Intent. MOU status is ${mou.status}.`);
  }

  // Turn Enforcement: Cannot counter own active proposal
  if (mou.last_proposed_by === initiator.id) {
    throw new ValidationError(
      "You cannot counter your own active proposal. Please wait for the counterparty response or withdraw your proposal."
    );
  }

  const nextVersionNumber = mou.current_version_number + 1;
  const initiatorRole: "BUYER" | "SELLER" = initiator.id === mou.buyer_id ? "BUYER" : "SELLER";
  const recipientUserId = initiator.id === mou.buyer_id ? mou.seller_id : mou.buyer_id;

  const validityDays = validated.terms.validityDays || 14;
  const validUntil = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();

  await transaction(async (tx) => {
    // Supersede previous version
    await tx.query(
      `UPDATE mou_versions 
       SET status = 'SUPERSEDED' 
       WHERE mou_id = $1 AND version_number = $2`,
      [mouId, mou.current_version_number]
    );

    // Insert new version
    await tx.query(
      `INSERT INTO mou_versions (
        mou_id, version_number, proposed_by, proposed_by_role, status,
        proposed_valuation, currency, proposed_structure,
        cash_consideration, equity_consideration, earnest_deposit_amount,
        exclusivity_period_days, due_diligence_window_days,
        target_closing_date, conditions_precedent, key_assumptions,
        summary_notes, non_binding_disclaimer
      ) VALUES ($1, $2, $3, $4, 'COUNTERED', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        mouId,
        nextVersionNumber,
        initiator.id,
        initiatorRole,
        validated.terms.proposedValuation,
        validated.terms.currency || "INR",
        validated.terms.proposedStructure,
        validated.terms.cashConsideration || 0,
        validated.terms.equityConsideration || 0,
        validated.terms.earnestDepositAmount || 0,
        validated.terms.exclusivityPeriodDays ?? 30,
        validated.terms.dueDiligenceWindowDays ?? 45,
        validated.terms.targetClosingDate || null,
        validated.terms.conditionsPrecedent || [],
        validated.terms.keyAssumptions || null,
        validated.terms.summaryNotes || null,
        STANDARD_NON_BINDING_DISCLAIMER,
      ]
    );

    // Update MOU master record
    await tx.query(
      `UPDATE deal_mous 
       SET current_version_number = $1,
           status = 'COUNTERED',
           last_proposed_by = $2,
           last_proposed_at = CURRENT_TIMESTAMP,
           valid_until = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [nextVersionNumber, initiator.id, validUntil, mouId]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "MOU_COUNTERED",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: mou.reference_code,
      versionNumber: nextVersionNumber,
      proposedValuation: validated.terms.proposedValuation,
      proposedStructure: validated.terms.proposedStructure,
      exclusivityPeriodDays: validated.terms.exclusivityPeriodDays ?? 30,
    },
  });

  await createNotification({
    userId: recipientUserId,
    type: "MOU_COUNTERED",
    title: "Deal Intent Counterproposal Received",
    message: `A counterproposal (v${nextVersionNumber}) has been submitted for ${mou.opp_title} (${mou.reference_code}).`,
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
  });

  return getMOUById(initiator, mouId);
}

/**
 * 4. BILATERALLY ACCEPT DEAL INTENT MOU
 */
export async function acceptMOU(
  initiator: AuthenticatedUser,
  mouId: string,
  input: AcceptMOUInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  let mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title 
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  let mou = await checkAndApplyExpiry(mouRes.rows[0]);

  // Anti-IDOR Authorization Check
  if (mou.buyer_id !== initiator.id && mou.seller_id !== initiator.id && !initiator.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You do not have permission to accept this Deal Intent MOU.");
  }

  // State Machine Guard
  if (mou.status !== "PROPOSED" && mou.status !== "COUNTERED") {
    throw new ValidationError(`Cannot accept Deal Intent MOU. Current status is ${mou.status}.`);
  }

  // Anti-Self-Acceptance: Proposer cannot accept their own terms
  if (mou.last_proposed_by === initiator.id) {
    throw new ValidationError("You cannot accept your own proposal. Acceptance must be executed by the counterparty.");
  }

  const isBuyer = initiator.id === mou.buyer_id;
  const recipientUserId = isBuyer ? mou.seller_id : mou.buyer_id;

  await transaction(async (tx) => {
    // Update master MOU to ACCEPTED
    await tx.query(
      `UPDATE deal_mous 
       SET status = 'ACCEPTED',
           accepted_at = CURRENT_TIMESTAMP,
           accepted_by_buyer_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP ELSE accepted_by_buyer_at END,
           accepted_by_seller_at = CASE WHEN $1 = FALSE THEN CURRENT_TIMESTAMP ELSE accepted_by_seller_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [isBuyer, mouId]
    );

    // Update current active version to ACCEPTED
    await tx.query(
      `UPDATE mou_versions 
       SET status = 'ACCEPTED' 
       WHERE mou_id = $1 AND version_number = $2`,
      [mouId, mou.current_version_number]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "MOU_ACCEPTED",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: mou.reference_code,
      acceptedVersion: mou.current_version_number,
      acceptedByRole: isBuyer ? "BUYER" : "SELLER",
    },
  });

  await createNotification({
    userId: recipientUserId,
    type: "MOU_ACCEPTED",
    title: "Deal Intent Bilaterally Accepted! 🎉",
    message: `Your Deal Intent proposal (${mou.reference_code}) has been accepted by the counterparty.`,
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
  });

  return getMOUById(initiator, mouId);
}

/**
 * 5. REJECT DEAL INTENT MOU
 */
export async function rejectMOU(
  initiator: AuthenticatedUser,
  mouId: string,
  input: RejectMOUInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  let mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title 
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  let mou = await checkAndApplyExpiry(mouRes.rows[0]);

  // Anti-IDOR Authorization Check
  if (mou.buyer_id !== initiator.id && mou.seller_id !== initiator.id && !initiator.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You do not have permission to reject this Deal Intent MOU.");
  }

  // State Machine Guard
  if (mou.status !== "PROPOSED" && mou.status !== "COUNTERED") {
    throw new ValidationError(`Cannot reject Deal Intent MOU. Current status is ${mou.status}.`);
  }

  // Proposer cannot reject their own proposal (must withdraw instead)
  if (mou.last_proposed_by === initiator.id) {
    throw new ValidationError("You cannot reject your own proposal. You may withdraw it instead.");
  }

  const recipientUserId = initiator.id === mou.buyer_id ? mou.seller_id : mou.buyer_id;

  await transaction(async (tx) => {
    await tx.query(
      `UPDATE deal_mous 
       SET status = 'REJECTED',
           rejected_at = CURRENT_TIMESTAMP,
           rejected_by = $1,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [initiator.id, input.reason, mouId]
    );

    await tx.query(
      `UPDATE mou_versions 
       SET status = 'REJECTED' 
       WHERE mou_id = $1 AND version_number = $2`,
      [mouId, mou.current_version_number]
    );
  });

  await auditLog({
    actorId: initiator.id,
    action: "MOU_REJECTED",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: mou.reference_code,
      rejectedVersion: mou.current_version_number,
    },
  });

  await createNotification({
    userId: recipientUserId,
    type: "MOU_REJECTED",
    title: "Deal Intent Proposal Declined",
    message: `The Deal Intent proposal for ${mou.opp_title} (${mou.reference_code}) was declined.`,
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
  });

  return getMOUById(initiator, mouId);
}

/**
 * 6. WITHDRAW ACTIVE DEAL INTENT PROPOSAL
 */
export async function withdrawMOU(
  initiator: AuthenticatedUser,
  mouId: string,
  input: WithdrawMOUInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMOUDetailView> {
  const mouRes = await query<any>(
    `SELECT m.*, o.title as opp_title 
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  const mou = mouRes.rows[0];

  // Anti-IDOR Authorization Check
  if (mou.buyer_id !== initiator.id && mou.seller_id !== initiator.id && !initiator.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You do not have permission to withdraw this Deal Intent MOU.");
  }

  if (mou.status !== "PROPOSED" && mou.status !== "COUNTERED" && mou.status !== "DRAFT") {
    throw new ValidationError(`Cannot withdraw Deal Intent MOU. Current status is ${mou.status}.`);
  }

  // Only proposing party or draft creator can withdraw
  if (mou.last_proposed_by && mou.last_proposed_by !== initiator.id && mou.status !== "DRAFT") {
    throw new ForbiddenError("Only the party that submitted the active proposal may withdraw it.");
  }

  const recipientUserId = initiator.id === mou.buyer_id ? mou.seller_id : mou.buyer_id;

  await query(
    `UPDATE deal_mous 
     SET status = 'WITHDRAWN',
         withdrawn_at = CURRENT_TIMESTAMP,
         withdrawn_by = $1,
         withdrawal_reason = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3`,
    [initiator.id, input.reason || null, mouId]
  );

  await auditLog({
    actorId: initiator.id,
    action: "MOU_WITHDRAWN",
    resourceType: "DEAL_MOU",
    resourceId: mou.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      referenceCode: mou.reference_code,
      versionNumber: mou.current_version_number,
    },
  });

  if (mou.status !== "DRAFT") {
    await createNotification({
      userId: recipientUserId,
      type: "MOU_WITHDRAWN",
      title: "Deal Intent Proposal Withdrawn",
      message: `The Deal Intent proposal for ${mou.opp_title} (${mou.reference_code}) has been withdrawn by the proposer.`,
      resourceType: "DEAL_MOU",
      resourceId: mou.id,
    });
  }

  return getMOUById(initiator, mouId);
}

/**
 * 7. GET DEAL INTENT MOU DETAIL BY ID
 */
export async function getMOUById(
  user: AuthenticatedUser,
  mouId: string
): Promise<DealMOUDetailView> {
  const mouRes = await query<any>(
    `SELECT m.*, 
            o.title as opp_title, o.reference_code as opp_ref,
            n.reference_code as nda_ref
     FROM deal_mous m
     JOIN opportunities o ON m.opportunity_id = o.id
     JOIN nda_agreements n ON m.nda_id = n.id
     WHERE m.id = $1`,
    [mouId]
  );

  if (mouRes.rows.length === 0) {
    throw new NotFoundError("Deal Intent MOU record not found.");
  }

  let mou = await checkAndApplyExpiry(mouRes.rows[0]);

  // Anti-IDOR Authorization Check
  const isBuyer = user.id === mou.buyer_id;
  const isSeller = user.id === mou.seller_id;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not authorized to view this Deal Intent MOU.");
  }

  // Fetch all versions
  const versionsRes = await query<any>(
    `SELECT * FROM mou_versions 
     WHERE mou_id = $1 
     ORDER BY version_number ASC`,
    [mouId]
  );

  const versions: MOUVersionView[] = versionsRes.rows.map((v) => ({
    id: v.id,
    versionNumber: v.version_number,
    proposedByRole: v.proposed_by_role,
    status: v.status,
    terms: {
      proposedValuation: Number(v.proposed_valuation),
      currency: v.currency,
      proposedStructure: v.proposed_structure,
      cashConsideration: Number(v.cash_consideration),
      equityConsideration: Number(v.equity_consideration),
      earnestDepositAmount: Number(v.earnest_deposit_amount),
      exclusivityPeriodDays: v.exclusivity_period_days,
      dueDiligenceWindowDays: v.due_diligence_window_days,
      targetClosingDate: v.target_closing_date ? String(v.target_closing_date).slice(0, 10) : null,
      conditionsPrecedent: Array.isArray(v.conditions_precedent) ? v.conditions_precedent : [],
      keyAssumptions: v.key_assumptions,
      summaryNotes: v.summary_notes,
      nonBindingDisclaimer: v.non_binding_disclaimer,
    },
    createdAt: v.created_at,
  }));

  const latestVersion = versions[versions.length - 1];
  const lastProposedRole: "BUYER" | "SELLER" | "NONE" =
    mou.last_proposed_by === mou.buyer_id
      ? "BUYER"
      : mou.last_proposed_by === mou.seller_id
      ? "SELLER"
      : "NONE";

  const isMyTurn =
    (mou.status === "PROPOSED" || mou.status === "COUNTERED") &&
    mou.last_proposed_by !== null &&
    mou.last_proposed_by !== user.id;

  const myRole: "BUYER" | "SELLER" | "ADMIN" = isBuyer ? "BUYER" : isSeller ? "SELLER" : "ADMIN";
  const counterpartyLabel = isBuyer ? "Verified Seller / Promoter" : "Verified Buyer / Investor";

  return {
    id: mou.id,
    referenceCode: mou.reference_code,
    opportunityId: mou.opportunity_id,
    opportunityTitle: mou.opp_title,
    opportunityReference: mou.opp_ref,
    ndaReference: mou.nda_ref,
    conversationId: mou.conversation_id,
    myRole,
    counterpartyLabel,
    status: mou.status,
    currentVersionNumber: mou.current_version_number,
    proposedValuation: latestVersion?.terms.proposedValuation || 0,
    currency: latestVersion?.terms.currency || "INR",
    proposedStructure: latestVersion?.terms.proposedStructure || "FULL_ACQUISITION",
    earnestDepositAmount: latestVersion?.terms.earnestDepositAmount || 0,
    exclusivityPeriodDays: latestVersion?.terms.exclusivityPeriodDays || 30,
    dueDiligenceWindowDays: latestVersion?.terms.dueDiligenceWindowDays || 45,
    lastProposedByRole: lastProposedRole,
    isMyTurnToRespond: isMyTurn,
    validUntil: mou.valid_until,
    acceptedAt: mou.accepted_at,
    rejectionReason: mou.rejection_reason,
    withdrawalReason: mou.withdrawal_reason,
    nonBindingDisclaimer: latestVersion?.terms.nonBindingDisclaimer || STANDARD_NON_BINDING_DISCLAIMER,
    currentTerms: latestVersion?.terms || {
      proposedValuation: 0,
      currency: "INR",
      proposedStructure: "FULL_ACQUISITION",
      cashConsideration: 0,
      equityConsideration: 0,
      earnestDepositAmount: 0,
      exclusivityPeriodDays: 30,
      dueDiligenceWindowDays: 45,
      conditionsPrecedent: [],
      nonBindingDisclaimer: STANDARD_NON_BINDING_DISCLAIMER,
    },
    versions,
    createdAt: mou.created_at,
    updatedAt: mou.updated_at,
  };
}

/**
 * 8. GET MOUS FOR USER (BUYER OR SELLER)
 */
export async function getMOUsForUser(
  user: AuthenticatedUser,
  role?: "BUYER" | "SELLER"
): Promise<DealMOUListItemView[]> {
  let sql = `
    SELECT m.*, 
           o.title as opp_title, o.reference_code as opp_ref,
           n.reference_code as nda_ref,
           v.proposed_valuation, v.currency, v.proposed_structure,
           v.earnest_deposit_amount, v.exclusivity_period_days, v.due_diligence_window_days
    FROM deal_mous m
    JOIN opportunities o ON m.opportunity_id = o.id
    JOIN nda_agreements n ON m.nda_id = n.id
    LEFT JOIN mou_versions v ON v.mou_id = m.id AND v.version_number = m.current_version_number
    WHERE `;

  const params: any[] = [];

  if (user.roles.includes("SUPER_ADMIN")) {
    sql += `1=1 `;
  } else if (role === "BUYER") {
    sql += `m.buyer_id = $1 `;
    params.push(user.id);
  } else if (role === "SELLER") {
    sql += `m.seller_id = $1 `;
    params.push(user.id);
  } else {
    sql += `(m.buyer_id = $1 OR m.seller_id = $1) `;
    params.push(user.id);
  }

  sql += `ORDER BY m.updated_at DESC`;

  const res = await query<any>(sql, params);

  return res.rows.map((mou) => {
    const isBuyer = user.id === mou.buyer_id;
    const isSeller = user.id === mou.seller_id;
    const myRole: "BUYER" | "SELLER" | "ADMIN" = isBuyer ? "BUYER" : isSeller ? "SELLER" : "ADMIN";
    const counterpartyLabel = isBuyer ? "Verified Seller / Promoter" : "Verified Buyer / Investor";

    const lastProposedRole: "BUYER" | "SELLER" | "NONE" =
      mou.last_proposed_by === mou.buyer_id
        ? "BUYER"
        : mou.last_proposed_by === mou.seller_id
        ? "SELLER"
        : "NONE";

    const isMyTurn =
      (mou.status === "PROPOSED" || mou.status === "COUNTERED") &&
      mou.last_proposed_by !== null &&
      mou.last_proposed_by !== user.id;

    return {
      id: mou.id,
      referenceCode: mou.reference_code,
      opportunityId: mou.opportunity_id,
      opportunityTitle: mou.opp_title,
      opportunityReference: mou.opp_ref,
      ndaReference: mou.nda_ref,
      conversationId: mou.conversation_id,
      myRole,
      counterpartyLabel,
      status: mou.status,
      currentVersionNumber: mou.current_version_number,
      proposedValuation: Number(mou.proposed_valuation || 0),
      currency: mou.currency || "INR",
      proposedStructure: mou.proposed_structure || "FULL_ACQUISITION",
      earnestDepositAmount: Number(mou.earnest_deposit_amount || 0),
      exclusivityPeriodDays: mou.exclusivity_period_days || 30,
      dueDiligenceWindowDays: mou.due_diligence_window_days || 45,
      lastProposedByRole: lastProposedRole,
      isMyTurnToRespond: isMyTurn,
      validUntil: mou.valid_until,
      acceptedAt: mou.accepted_at,
      createdAt: mou.created_at,
      updatedAt: mou.updated_at,
    };
  });
}

/**
 * 9. GET IMMUTABLE VERSION HISTORY
 */
export async function getMOUVersions(
  user: AuthenticatedUser,
  mouId: string
): Promise<MOUVersionView[]> {
  const mou = await getMOUById(user, mouId);
  return mou.versions;
}
