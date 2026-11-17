// Scale-up India — Phase 7: Expression of Interest (EOI) Domain Service
// Path: src/domains/eoi/service.ts

import { query, transaction } from "@/lib/db";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateEOIInput,
  SellerAcceptEOIInput,
  SellerDeclineEOIInput,
  SellerClarifyEOIInput,
  BuyerClarifyEOIInput,
  EOIQueryInput,
  createEOISchema,
  sellerAcceptEOISchema,
  sellerDeclineEOISchema,
  sellerClarifyEOISchema,
  buyerClarifyEOISchema,
  eoiQuerySchema,
} from "@/schemas/eoi";
import {
  EOIStatus,
  BuyerEOIView,
  SellerEOIView,
  ExpressionOfInterestRecord,
} from "@/types/eoi";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";

// ==========================================
// 1. BUYER FLOW: SUBMIT EXPRESSION OF INTEREST
// ==========================================

export async function submitEOI(
  buyerUser: AuthenticatedUser,
  opportunityId: string,
  rawInput: CreateEOIInput
): Promise<BuyerEOIView> {
  const input = createEOISchema.parse(rawInput);
  // 1. Verify Buyer Profile
  const buyerProfileRes = await query<{
    id: string;
    onboarding_status: string;
  }>(
    `SELECT id, onboarding_status 
     FROM buyer_profiles 
     WHERE user_id = $1 AND deleted_at IS NULL`,
    [buyerUser.id]
  );

  if (buyerProfileRes.rowCount === 0) {
    throw new ValidationError(
      "A completed Buyer / Investor profile is required before submitting an Expression of Interest."
    );
  }

  const buyerProfile = buyerProfileRes.rows[0];

  // 2. Verify Opportunity Publication Status & Invariants
  const oppRes = await query<{
    id: string;
    reference_code: string;
    title: string;
    industry: string;
    operating_region: string;
    asking_price_bracket: string | null;
    transaction_type: string;
    status: string;
    user_id: string;
    seller_profile_id: string;
    deleted_at: string | null;
  }>(
    `SELECT 
       id, reference_code, title, industry, operating_region, 
       asking_price_bracket, transaction_type, status, user_id, 
       seller_profile_id, deleted_at 
     FROM opportunities 
     WHERE id = $1`,
    [opportunityId]
  );

  if (oppRes.rowCount === 0 || oppRes.rows[0].deleted_at !== null) {
    throw new NotFoundError("Opportunity not found.");
  }

  const opportunity = oppRes.rows[0];

  // Only PUBLISHED opportunities are eligible for EOI (uniform 404 anti-enumeration)
  if (opportunity.status !== "PUBLISHED") {
    throw new NotFoundError("Opportunity not found.");
  }

  // Anti-Self-Submission: Seller cannot express interest in their own opportunity
  if (opportunity.user_id === buyerUser.id) {
    throw new ValidationError(
      "Promoters and sellers cannot submit an Expression of Interest for their own opportunity."
    );
  }

  // 3. Verify Mandate Ownership (if mandateId is provided)
  let verifiedMandateId: string | null = null;
  if (input.mandateId) {
    const mandateRes = await query<{ id: string }>(
      `SELECT id FROM acquisition_mandates 
       WHERE id = $1 AND buyer_profile_id = $2`,
      [input.mandateId, buyerProfile.id]
    );
    if (mandateRes.rowCount === 0) {
      throw new ValidationError("Referenced acquisition mandate does not belong to your buyer profile.");
    }
    verifiedMandateId = mandateRes.rows[0].id;
  }

  // 4. Check for existing active EOI (Application-level pre-check)
  const activeCheck = await query<{ id: string }>(
    `SELECT id FROM expressions_of_interest 
     WHERE buyer_id = $1 AND opportunity_id = $2 
     AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ACCEPTED')`,
    [buyerUser.id, opportunityId]
  );

  if (activeCheck.rowCount > 0) {
    throw new ConflictError(
      "You already have an active Expression of Interest for this opportunity."
    );
  }

  // 5. Generate Reference Code & Insert with Transaction
  try {
    const seqRes = await query<{ seq: string }>(
      `SELECT nextval('eoi_ref_seq') as seq`
    );
    const refCode = `EOI-2026-${seqRes.rows[0].seq}`;

    const insertRes = await query<any>(
      `INSERT INTO expressions_of_interest (
        reference_code, opportunity_id, buyer_id, buyer_profile_id, mandate_id,
        seller_id, seller_profile_id, status, interest_type, proposed_transaction_type,
        indicative_offer_range, investment_timeline, buyer_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED', $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        refCode,
        opportunity.id,
        buyerUser.id,
        buyerProfile.id,
        verifiedMandateId,
        opportunity.user_id,
        opportunity.seller_profile_id,
        input.interestType,
        input.proposedTransactionType,
        input.indicativeOfferRange || null,
        input.investmentTimeline,
        input.buyerMessage,
      ]
    );

    const inserted = insertRes.rows[0];

    // 6. Audit Logging
    await auditLog({
      actorId: buyerUser.id,
      action: "EOI_SUBMITTED",
      resourceType: "expression_of_interest",
      resourceId: inserted.id,
      metadata: {
        referenceCode: inserted.reference_code,
        opportunityId: opportunity.id,
        opportunityReference: opportunity.reference_code,
      },
    });

    // 7. In-App Notification to Seller
    await createNotification({
      userId: opportunity.user_id,
      type: "EOI_RECEIVED",
      title: "New Expression of Interest Received",
      message: `A prospective buyer submitted an Expression of Interest (${inserted.reference_code}) for your listing ${opportunity.reference_code}.`,
      resourceType: "expression_of_interest",
      resourceId: inserted.id,
    });

    return {
      id: inserted.id,
      referenceCode: inserted.reference_code,
      opportunityId: opportunity.id,
      opportunityReference: opportunity.reference_code,
      opportunityTitle: opportunity.title,
      opportunitySector: opportunity.industry,
      opportunityRegion: opportunity.operating_region,
      opportunityAskingPrice: opportunity.asking_price_bracket,
      opportunityTransactionType: opportunity.transaction_type,
      status: inserted.status as EOIStatus,
      interestType: inserted.interest_type,
      proposedTransactionType: inserted.proposed_transaction_type,
      indicativeOfferRange: inserted.indicative_offer_range,
      investmentTimeline: inserted.investment_timeline,
      buyerMessage: inserted.buyer_message,
      sellerResponseMessage: inserted.seller_response_message,
      sellerDeclineReason: inserted.seller_decline_reason,
      clarificationQuestions: inserted.clarification_questions,
      clarificationAnswers: inserted.clarification_answers,
      submittedAt: inserted.submitted_at,
      reviewedAt: inserted.reviewed_at,
      acceptedAt: inserted.accepted_at,
      declinedAt: inserted.declined_at,
      withdrawnAt: inserted.withdrawn_at,
      expiresAt: inserted.expires_at,
    };
  } catch (err: any) {
    // Catch database-level unique constraint race condition
    if (err.code === "23505" || err.message?.includes("idx_eoi_active_buyer_opp")) {
      throw new ConflictError(
        "You already have an active Expression of Interest for this opportunity."
      );
    }
    throw err;
  }
}

// ==========================================
// 2. BUYER FLOW: LIST & GET OWN EOIs
// ==========================================

export async function getBuyerEOIs(
  buyerUser: AuthenticatedUser,
  filters: EOIQueryInput
): Promise<{ items: BuyerEOIView[]; total: number; page: number; limit: number }> {
  let countSql = `
    SELECT COUNT(*) as count 
    FROM expressions_of_interest e
    WHERE e.buyer_id = $1
  `;
  const countParams: any[] = [buyerUser.id];

  let listSql = `
    SELECT 
      e.id, e.reference_code, e.opportunity_id, e.status, e.interest_type,
      e.proposed_transaction_type, e.indicative_offer_range, e.investment_timeline,
      e.buyer_message, e.seller_response_message, e.seller_decline_reason,
      e.clarification_questions, e.clarification_answers,
      e.submitted_at, e.reviewed_at, e.accepted_at, e.declined_at, e.withdrawn_at, e.expires_at,
      o.reference_code as opp_ref, o.title as opp_title, o.industry as opp_industry,
      o.operating_region as opp_region, o.asking_price_bracket as opp_price,
      o.transaction_type as opp_trans_type
    FROM expressions_of_interest e
    JOIN opportunities o ON e.opportunity_id = o.id
    WHERE e.buyer_id = $1
  `;
  const listParams: any[] = [buyerUser.id];

  if (filters.status) {
    countParams.push(filters.status);
    countSql += ` AND e.status = $${countParams.length}`;

    listParams.push(filters.status);
    listSql += ` AND e.status = $${listParams.length}`;
  }

  if (filters.opportunityId) {
    countParams.push(filters.opportunityId);
    countSql += ` AND e.opportunity_id = $${countParams.length}`;

    listParams.push(filters.opportunityId);
    listSql += ` AND e.opportunity_id = $${listParams.length}`;
  }

  const offset = (filters.page - 1) * filters.limit;
  listParams.push(filters.limit, offset);
  listSql += ` ORDER BY e.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;

  const [countRes, listRes] = await Promise.all([
    query<{ count: string }>(countSql, countParams),
    query<any>(listSql, listParams),
  ]);

  const items: BuyerEOIView[] = listRes.rows.map((row) => ({
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    opportunitySector: row.opp_industry,
    opportunityRegion: row.opp_region,
    opportunityAskingPrice: row.opp_price,
    opportunityTransactionType: row.opp_trans_type,
    status: row.status as EOIStatus,
    interestType: row.interest_type,
    proposedTransactionType: row.proposed_transaction_type,
    indicativeOfferRange: row.indicative_offer_range,
    investmentTimeline: row.investment_timeline,
    buyerMessage: row.buyer_message,
    sellerResponseMessage: row.seller_response_message,
    sellerDeclineReason: row.seller_decline_reason,
    clarificationQuestions: row.clarification_questions,
    clarificationAnswers: row.clarification_answers,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    withdrawnAt: row.withdrawn_at,
    expiresAt: row.expires_at,
  }));

  return {
    items,
    total: parseInt(countRes.rows[0]?.count || "0", 10),
    page: filters.page,
    limit: filters.limit,
  };
}

export async function getBuyerEOIById(
  buyerUser: AuthenticatedUser,
  eoiId: string
): Promise<BuyerEOIView> {
  const res = await query<any>(
    `SELECT 
      e.id, e.reference_code, e.opportunity_id, e.buyer_id, e.status, e.interest_type,
      e.proposed_transaction_type, e.indicative_offer_range, e.investment_timeline,
      e.buyer_message, e.seller_response_message, e.seller_decline_reason,
      e.clarification_questions, e.clarification_answers,
      e.submitted_at, e.reviewed_at, e.accepted_at, e.declined_at, e.withdrawn_at, e.expires_at,
      o.reference_code as opp_ref, o.title as opp_title, o.industry as opp_industry,
      o.operating_region as opp_region, o.asking_price_bracket as opp_price,
      o.transaction_type as opp_trans_type
    FROM expressions_of_interest e
    JOIN opportunities o ON e.opportunity_id = o.id
    WHERE e.id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const row = res.rows[0];

  // Anti-IDOR Authorization Check
  if (row.buyer_id !== buyerUser.id && !buyerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to view this Expression of Interest.");
  }

  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    opportunitySector: row.opp_industry,
    opportunityRegion: row.opp_region,
    opportunityAskingPrice: row.opp_price,
    opportunityTransactionType: row.opp_trans_type,
    status: row.status as EOIStatus,
    interestType: row.interest_type,
    proposedTransactionType: row.proposed_transaction_type,
    indicativeOfferRange: row.indicative_offer_range,
    investmentTimeline: row.investment_timeline,
    buyerMessage: row.buyer_message,
    sellerResponseMessage: row.seller_response_message,
    sellerDeclineReason: row.seller_decline_reason,
    clarificationQuestions: row.clarification_questions,
    clarificationAnswers: row.clarification_answers,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    withdrawnAt: row.withdrawn_at,
    expiresAt: row.expires_at,
  };
}

// ==========================================
// 3. BUYER FLOW: WITHDRAW EOI
// ==========================================

export async function withdrawEOI(
  buyerUser: AuthenticatedUser,
  eoiId: string
): Promise<BuyerEOIView> {
  const res = await query<any>(
    `SELECT id, reference_code, buyer_id, seller_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const eoi = res.rows[0];

  // Anti-IDOR Check
  if (eoi.buyer_id !== buyerUser.id && !buyerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to withdraw this Expression of Interest.");
  }

  // State Machine Validation
  if (eoi.status === "ACCEPTED") {
    throw new ValidationError(
      "Cannot withdraw an Expression of Interest that has already been accepted by the promoter."
    );
  }
  if (eoi.status === "DECLINED") {
    throw new ValidationError("Cannot withdraw an Expression of Interest that was already declined.");
  }
  if (eoi.status === "WITHDRAWN") {
    throw new ValidationError("This Expression of Interest is already withdrawn.");
  }
  if (eoi.status === "EXPIRED") {
    throw new ValidationError("Cannot withdraw an expired Expression of Interest.");
  }

  // Update Status
  await query(
    `UPDATE expressions_of_interest 
     SET status = 'WITHDRAWN', withdrawn_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $1`,
    [eoiId]
  );

  // Audit Log
  await auditLog({
    actorId: buyerUser.id,
    action: "EOI_WITHDRAWN",
    resourceType: "expression_of_interest",
    resourceId: eoiId,
    metadata: { referenceCode: eoi.reference_code },
  });

  // Notify Seller
  await createNotification({
    userId: eoi.seller_id,
    type: "EOI_WITHDRAWN",
    title: "Expression of Interest Withdrawn",
    message: `The prospective buyer has withdrawn their Expression of Interest (${eoi.reference_code}).`,
    resourceType: "expression_of_interest",
    resourceId: eoiId,
  });

  return getBuyerEOIById(buyerUser, eoiId);
}

// ==========================================
// 4. SELLER FLOW: LIST & GET RECEIVED EOIs
// ==========================================

export async function getSellerEOIs(
  sellerUser: AuthenticatedUser,
  filters: EOIQueryInput
): Promise<{ items: SellerEOIView[]; total: number; page: number; limit: number }> {
  let countSql = `
    SELECT COUNT(*) as count 
    FROM expressions_of_interest e
    WHERE e.seller_id = $1
  `;
  const countParams: any[] = [sellerUser.id];

  let listSql = `
    SELECT 
      e.id, e.reference_code, e.opportunity_id, e.status, e.interest_type,
      e.proposed_transaction_type, e.indicative_offer_range, e.investment_timeline,
      e.buyer_message, e.seller_response_message, e.seller_decline_reason,
      e.clarification_questions, e.clarification_answers,
      e.submitted_at, e.reviewed_at, e.accepted_at, e.declined_at, e.withdrawn_at, e.expires_at,
      o.reference_code as opp_ref, o.title as opp_title,
      bp.entity_type as buyer_entity_type, bp.buyer_type as buyer_type_val,
      bp.industry as buyer_industry, bp.state as buyer_state, bp.country as buyer_country,
      bom.score as match_score, bom.classification as match_classification
    FROM expressions_of_interest e
    JOIN opportunities o ON e.opportunity_id = o.id
    JOIN buyer_profiles bp ON e.buyer_profile_id = bp.id
    LEFT JOIN buyer_opportunity_matches bom ON (
      bom.buyer_id = e.buyer_id AND 
      bom.opportunity_id = e.opportunity_id AND 
      bom.matching_version = 'v1.0.0-deterministic'
    )
    WHERE e.seller_id = $1
  `;
  const listParams: any[] = [sellerUser.id];

  if (filters.status) {
    countParams.push(filters.status);
    countSql += ` AND e.status = $${countParams.length}`;

    listParams.push(filters.status);
    listSql += ` AND e.status = $${listParams.length}`;
  }

  if (filters.opportunityId) {
    countParams.push(filters.opportunityId);
    countSql += ` AND e.opportunity_id = $${countParams.length}`;

    listParams.push(filters.opportunityId);
    listSql += ` AND e.opportunity_id = $${listParams.length}`;
  }

  const offset = (filters.page - 1) * filters.limit;
  listParams.push(filters.limit, offset);
  listSql += ` ORDER BY e.created_at DESC LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`;

  const [countRes, listRes] = await Promise.all([
    query<{ count: string }>(countSql, countParams),
    query<any>(listSql, listParams),
  ]);

  const items: SellerEOIView[] = listRes.rows.map((row) => ({
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    status: row.status as EOIStatus,
    buyerEntityType: row.buyer_entity_type,
    buyerType: row.buyer_type_val,
    buyerIndustry: row.buyer_industry,
    buyerLocation: `${row.buyer_state}, ${row.buyer_country}`,
    interestType: row.interest_type,
    proposedTransactionType: row.proposed_transaction_type,
    indicativeOfferRange: row.indicative_offer_range,
    investmentTimeline: row.investment_timeline,
    buyerMessage: row.buyer_message,
    matchScore: row.match_score !== null ? Number(row.match_score) : null,
    matchClassification: row.match_classification || null,
    sellerResponseMessage: row.seller_response_message,
    sellerDeclineReason: row.seller_decline_reason,
    clarificationQuestions: row.clarification_questions,
    clarificationAnswers: row.clarification_answers,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    withdrawnAt: row.withdrawn_at,
    expiresAt: row.expires_at,
  }));

  return {
    items,
    total: parseInt(countRes.rows[0]?.count || "0", 10),
    page: filters.page,
    limit: filters.limit,
  };
}

export async function getSellerEOIById(
  sellerUser: AuthenticatedUser,
  eoiId: string
): Promise<SellerEOIView> {
  const res = await query<any>(
    `SELECT 
      e.id, e.reference_code, e.opportunity_id, e.seller_id, e.status, e.interest_type,
      e.proposed_transaction_type, e.indicative_offer_range, e.investment_timeline,
      e.buyer_message, e.seller_response_message, e.seller_decline_reason,
      e.clarification_questions, e.clarification_answers,
      e.submitted_at, e.reviewed_at, e.accepted_at, e.declined_at, e.withdrawn_at, e.expires_at,
      o.reference_code as opp_ref, o.title as opp_title,
      bp.entity_type as buyer_entity_type, bp.buyer_type as buyer_type_val,
      bp.industry as buyer_industry, bp.state as buyer_state, bp.country as buyer_country,
      bom.score as match_score, bom.classification as match_classification
    FROM expressions_of_interest e
    JOIN opportunities o ON e.opportunity_id = o.id
    JOIN buyer_profiles bp ON e.buyer_profile_id = bp.id
    LEFT JOIN buyer_opportunity_matches bom ON (
      bom.buyer_id = e.buyer_id AND 
      bom.opportunity_id = e.opportunity_id AND 
      bom.matching_version = 'v1.0.0-deterministic'
    )
    WHERE e.id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const row = res.rows[0];

  // Anti-IDOR Authorization Check
  if (row.seller_id !== sellerUser.id && !sellerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to view this Expression of Interest.");
  }

  // Automatic state transition from SUBMITTED -> UNDER_REVIEW on first seller inspection
  if (row.status === "SUBMITTED") {
    await query(
      `UPDATE expressions_of_interest 
       SET status = 'UNDER_REVIEW', reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND status = 'SUBMITTED'`,
      [eoiId]
    );
    row.status = "UNDER_REVIEW";
    row.reviewed_at = new Date().toISOString();

    await auditLog({
      actorId: sellerUser.id,
      action: "EOI_VIEWED",
      resourceType: "expression_of_interest",
      resourceId: eoiId,
      metadata: { referenceCode: row.reference_code },
    });
  }

  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    status: row.status as EOIStatus,
    buyerEntityType: row.buyer_entity_type,
    buyerType: row.buyer_type_val,
    buyerIndustry: row.buyer_industry,
    buyerLocation: `${row.buyer_state}, ${row.buyer_country}`,
    interestType: row.interest_type,
    proposedTransactionType: row.proposed_transaction_type,
    indicativeOfferRange: row.indicative_offer_range,
    investmentTimeline: row.investment_timeline,
    buyerMessage: row.buyer_message,
    matchScore: row.match_score !== null ? Number(row.match_score) : null,
    matchClassification: row.match_classification || null,
    sellerResponseMessage: row.seller_response_message,
    sellerDeclineReason: row.seller_decline_reason,
    clarificationQuestions: row.clarification_questions,
    clarificationAnswers: row.clarification_answers,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    acceptedAt: row.accepted_at,
    declinedAt: row.declined_at,
    withdrawnAt: row.withdrawn_at,
    expiresAt: row.expires_at,
  };
}

// ==========================================
// 5. SELLER FLOW: ACCEPT EOI
// ==========================================

export async function acceptEOI(
  sellerUser: AuthenticatedUser,
  eoiId: string,
  input: SellerAcceptEOIInput
): Promise<SellerEOIView> {
  const res = await query<any>(
    `SELECT id, reference_code, seller_id, buyer_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const eoi = res.rows[0];

  // Anti-IDOR Authorization Check
  if (eoi.seller_id !== sellerUser.id && !sellerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to accept this Expression of Interest.");
  }

  // State Machine Invariant Validation
  if (eoi.status === "ACCEPTED") {
    throw new ValidationError("This Expression of Interest has already been accepted.");
  }
  if (eoi.status === "DECLINED") {
    throw new ValidationError("Cannot accept an Expression of Interest that has already been declined.");
  }
  if (eoi.status === "WITHDRAWN") {
    throw new ValidationError("Cannot accept an Expression of Interest that was withdrawn by the buyer.");
  }
  if (eoi.status === "EXPIRED") {
    throw new ValidationError("Cannot accept an expired Expression of Interest.");
  }

  // Update Status to ACCEPTED
  await query(
    `UPDATE expressions_of_interest 
     SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP, 
         seller_response_message = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [input.sellerResponseMessage || null, eoiId]
  );

  // Audit Log
  await auditLog({
    actorId: sellerUser.id,
    action: "EOI_ACCEPTED",
    resourceType: "expression_of_interest",
    resourceId: eoiId,
    metadata: { referenceCode: eoi.reference_code },
  });

  // Notify Buyer
  await createNotification({
    userId: eoi.buyer_id,
    type: "EOI_ACCEPTED",
    title: "Expression of Interest Accepted!",
    message: `The promoter has accepted your Expression of Interest (${eoi.reference_code}). Scale-up India transaction desk will orchestrate next confidentiality steps.`,
    resourceType: "expression_of_interest",
    resourceId: eoiId,
  });

  return getSellerEOIById(sellerUser, eoiId);
}

// ==========================================
// 6. SELLER FLOW: DECLINE EOI
// ==========================================

export async function declineEOI(
  sellerUser: AuthenticatedUser,
  eoiId: string,
  input: SellerDeclineEOIInput
): Promise<SellerEOIView> {
  const res = await query<any>(
    `SELECT id, reference_code, seller_id, buyer_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const eoi = res.rows[0];

  // Anti-IDOR Authorization Check
  if (eoi.seller_id !== sellerUser.id && !sellerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to decline this Expression of Interest.");
  }

  // State Machine Invariant Validation
  if (eoi.status === "ACCEPTED") {
    throw new ValidationError("Cannot decline an Expression of Interest that has already been accepted.");
  }
  if (eoi.status === "DECLINED") {
    throw new ValidationError("This Expression of Interest has already been declined.");
  }
  if (eoi.status === "WITHDRAWN") {
    throw new ValidationError("Cannot decline an Expression of Interest that was withdrawn by the buyer.");
  }
  if (eoi.status === "EXPIRED") {
    throw new ValidationError("Cannot decline an expired Expression of Interest.");
  }

  // Update Status to DECLINED
  await query(
    `UPDATE expressions_of_interest 
     SET status = 'DECLINED', declined_at = CURRENT_TIMESTAMP, 
         seller_decline_reason = $1, seller_response_message = $2, 
         updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [input.sellerDeclineReason, input.sellerResponseMessage || null, eoiId]
  );

  // Audit Log
  await auditLog({
    actorId: sellerUser.id,
    action: "EOI_DECLINED",
    resourceType: "expression_of_interest",
    resourceId: eoiId,
    metadata: {
      referenceCode: eoi.reference_code,
      declineReason: input.sellerDeclineReason,
    },
  });

  // Notify Buyer
  await createNotification({
    userId: eoi.buyer_id,
    type: "EOI_DECLINED",
    title: "Expression of Interest Declined",
    message: `The promoter has declined Expression of Interest (${eoi.reference_code}). Reason: ${input.sellerDeclineReason.replace(/_/g, " ")}.`,
    resourceType: "expression_of_interest",
    resourceId: eoiId,
  });

  return getSellerEOIById(sellerUser, eoiId);
}

// ==========================================
// 7. SELLER & BUYER CLARIFICATION DIALOGUE
// ==========================================

export async function requestClarification(
  sellerUser: AuthenticatedUser,
  eoiId: string,
  input: SellerClarifyEOIInput
): Promise<SellerEOIView> {
  const res = await query<any>(
    `SELECT id, reference_code, seller_id, buyer_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const eoi = res.rows[0];

  if (eoi.seller_id !== sellerUser.id && !sellerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to request clarification on this Expression of Interest.");
  }

  if (eoi.status !== "SUBMITTED" && eoi.status !== "UNDER_REVIEW") {
    throw new ValidationError(`Cannot request clarification on an EOI with status [${eoi.status}].`);
  }

  await query(
    `UPDATE expressions_of_interest 
     SET status = 'CLARIFICATION_REQUESTED', clarification_questions = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [input.clarificationQuestions, eoiId]
  );

  await auditLog({
    actorId: sellerUser.id,
    action: "EOI_CLARIFICATION_REQUESTED",
    resourceType: "expression_of_interest",
    resourceId: eoiId,
    metadata: { referenceCode: eoi.reference_code },
  });

  await createNotification({
    userId: eoi.buyer_id,
    type: "EOI_CLARIFICATION_REQUESTED",
    title: "Clarification Requested on EOI",
    message: `The promoter has requested clarification on your Expression of Interest (${eoi.reference_code}).`,
    resourceType: "expression_of_interest",
    resourceId: eoiId,
  });

  return getSellerEOIById(sellerUser, eoiId);
}

export async function provideClarification(
  buyerUser: AuthenticatedUser,
  eoiId: string,
  input: BuyerClarifyEOIInput
): Promise<BuyerEOIView> {
  const res = await query<any>(
    `SELECT id, reference_code, buyer_id, seller_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [eoiId]
  );

  if (res.rowCount === 0) {
    throw new NotFoundError("Expression of Interest not found.");
  }

  const eoi = res.rows[0];

  if (eoi.buyer_id !== buyerUser.id && !buyerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to respond to this Expression of Interest.");
  }

  if (eoi.status !== "CLARIFICATION_REQUESTED") {
    throw new ValidationError("Clarification has not been requested on this Expression of Interest.");
  }

  await query(
    `UPDATE expressions_of_interest 
     SET status = 'UNDER_REVIEW', clarification_answers = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [input.clarificationAnswers, eoiId]
  );

  await auditLog({
    actorId: buyerUser.id,
    action: "EOI_CLARIFICATION_PROVIDED",
    resourceType: "expression_of_interest",
    resourceId: eoiId,
    metadata: { referenceCode: eoi.reference_code },
  });

  await createNotification({
    userId: eoi.seller_id,
    type: "EOI_CLARIFICATION_PROVIDED",
    title: "Clarification Provided on EOI",
    message: `The prospective buyer has answered your clarification questions on Expression of Interest (${eoi.reference_code}).`,
    resourceType: "expression_of_interest",
    resourceId: eoiId,
  });

  return getBuyerEOIById(buyerUser, eoiId);
}
