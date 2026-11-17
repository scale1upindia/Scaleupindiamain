// Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine Service
// Path: src/domains/transaction/service.ts

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { query, transaction as dbTransaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  TransactionGateError,
  InvalidTransactionStateError,
  TransactionClosedError,
  ClosingConditionUnsatisfiedError,
  TermsConflictError,
} from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";
import {
  TransactionRecord,
  TransactionVersionRecord,
  TransactionConditionRecord,
  TransactionDocumentRecord,
  TransactionClosingRecord,
  TransactionOverviewView,
  ClosingReadinessView,
  TransactionType,
  TransactionConditionType,
  TransactionDocumentType,
} from "@/types/transaction";
import {
  CreateTransactionInput,
  UpdateTransactionTermsInput,
  CreateTransactionVersionInput,
  WaiveConditionInput,
  ConfirmTransactionInput,
  ReviewTransactionInput,
  createTransactionSchema,
  updateTransactionTermsSchema,
  createTransactionVersionSchema,
  waiveConditionSchema,
  confirmTransactionSchema,
  reviewTransactionSchema,
} from "@/schemas/transaction";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";
import { validateMagicBytes } from "@/domains/documents/service";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

const STANDARD_CLOSING_CONDITIONS: Array<{
  conditionType: TransactionConditionType;
  title: string;
  description: string;
  isMandatory: boolean;
  responsibleParty: "BUYER" | "SELLER" | "PLATFORM" | "BOTH";
}> = [
  {
    conditionType: "NDA_EXECUTED",
    title: "Bilateral Non-Disclosure Agreement Executed",
    description: "Verified institutional bilateral NDA executed by both parties.",
    isMandatory: true,
    responsibleParty: "BOTH",
  },
  {
    conditionType: "MOU_ACCEPTED",
    title: "Deal Intent MOU Accepted",
    description: "Bilateral Memorandum of Understanding accepted and frozen.",
    isMandatory: true,
    responsibleParty: "BOTH",
  },
  {
    conditionType: "TOKEN_DEPOSIT_CONFIRMED",
    title: "Earnest Token Deposit Confirmed in Escrow",
    description: "Earnest token deposit confirmed in immutable escrow ledger.",
    isMandatory: true,
    responsibleParty: "BUYER",
  },
  {
    conditionType: "DUE_DILIGENCE_APPROVED",
    title: "Due Diligence Satisfactorily Completed",
    description: "Phase 12 Due Diligence case approved or conditionally approved without blocking findings.",
    isMandatory: true,
    responsibleParty: "PLATFORM",
  },
  {
    conditionType: "VALUATION_APPROVED",
    title: "Corporate Valuation Model Approved",
    description: "Phase 13 Valuation Model approved and locked by independent financial reviewer.",
    isMandatory: true,
    responsibleParty: "PLATFORM",
  },
  {
    conditionType: "TRANSACTION_AGREEMENT_SIGNED",
    title: "Definitive Transaction Agreement Signed",
    description: "Execution copy of Share Purchase Agreement / Asset Transfer Agreement uploaded and signed.",
    isMandatory: true,
    responsibleParty: "BOTH",
  },
  {
    conditionType: "BOARD_RESOLUTIONS_UPLOADED",
    title: "Board / Shareholder Resolutions Uploaded",
    description: "Promoter and corporate board resolutions authorizing transaction execution.",
    isMandatory: true,
    responsibleParty: "SELLER",
  },
  {
    conditionType: "REGULATORY_NOC_FILED",
    title: "Regulatory / Statutory Clearances & Filings",
    description: "Filing of required regulatory NOCs, MCA/RoC resolutions, or tax compliances where applicable.",
    isMandatory: false,
    responsibleParty: "SELLER",
  },
  {
    conditionType: "ESCROW_SETTLEMENT_CONFIRMED",
    title: "Final Settlement & Escrow Release Instruction",
    description: "Institutional confirmation of payment readiness or escrow consideration settlement.",
    isMandatory: true,
    responsibleParty: "PLATFORM",
  },
  {
    conditionType: "CLOSING_CERTIFICATE_EXECUTED",
    title: "Bilateral Closing Certificate Executed",
    description: "Formal bilateral closing confirmation signed by authorized representatives of Buyer and Seller.",
    isMandatory: true,
    responsibleParty: "BOTH",
  },
];

async function generateTransactionReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('txn_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `TXN-${new Date().getFullYear()}-${seqVal}`;
}

async function generateClosingReference(): Promise<string> {
  const res = await query<{ nextval: string }>(`SELECT nextval('txn_close_ref_seq') as nextval`);
  const seqVal = res.rows[0]?.nextval || "10001";
  return `CLOSE-${new Date().getFullYear()}-${seqVal}`;
}

/**
 * Multi-tenant authorization guard
 */
export async function assertTransactionMember(
  user: AuthenticatedUser,
  transactionId: string
): Promise<{
  transaction: TransactionRecord;
  userRole: "BUYER" | "SELLER" | "REVIEWER" | "ADMIN";
}> {
  const txnRes = await query<TransactionRecord>(
    `SELECT * FROM transactions WHERE id = $1`,
    [transactionId]
  );

  if (txnRes.rows.length === 0) {
    throw new NotFoundError("Transaction workspace not found.");
  }

  const transaction = txnRes.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  if (isAdmin) {
    return { transaction, userRole: "ADMIN" };
  }

  if (user.id === transaction.buyer_id) {
    return { transaction, userRole: "BUYER" };
  }

  if (user.id === transaction.seller_id) {
    return { transaction, userRole: "SELLER" };
  }

  if (
    user.roles.includes("REVIEWER") ||
    user.roles.includes("LEGAL") ||
    user.roles.includes("FINANCE") ||
    user.permissions.includes("transaction.review") ||
    user.permissions.includes("transaction.approve") ||
    user.permissions.includes("transaction.read_all")
  ) {
    return { transaction, userRole: "REVIEWER" };
  }

  throw new ForbiddenError("You do not have authorization to access this transaction workspace.");
}

/**
 * 1. CREATE TRANSACTION
 * Strict 7-Gate Precondition Enforcement:
 * 1. Linked Opportunity published & not soft-deleted.
 * 2. Bilateral NDA in EXECUTED state.
 * 3. Deal Intent MOU in ACCEPTED state.
 * 4. Escrow Token Deposit confirmed in ledger.
 * 5. Due Diligence Case completed/approved (not REJECTED).
 * 6. Authoritative Valuation Version approved or locked.
 * 7. Initiator must be Buyer or Admin.
 */
export async function createTransaction(
  initiator: AuthenticatedUser,
  valuationCaseId: string,
  input: CreateTransactionInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionOverviewView> {
  const validated = createTransactionSchema.parse(input);

  // 1. Fetch Valuation Case & Linked Preconditions
  const valRes = await query<any>(
    `SELECT vc.*, 
            vv.id as active_val_version_id, vv.version_number as val_version_num, vv.status as val_version_status,
            vv.calculation_results as val_calc_results,
            dd.id as dd_case_id, dd.status as dd_status, dd.verdict as dd_verdict,
            o.id as opp_id, o.title as opp_title, o.reference_code as opp_ref, o.status as opp_status, o.deleted_at as opp_deleted_at,
            m.id as mou_id, m.reference_code as mou_ref, m.status as mou_status, 
            COALESCE(mv.proposed_valuation, 0) as mou_amount, COALESCE(mv.currency, 'INR') as mou_currency,
            nda.id as nda_id, nda.status as nda_status
     FROM valuation_cases vc
     JOIN valuation_versions vv ON vv.case_id = vc.id AND (vv.status IN ('APPROVED', 'LOCKED') OR vv.version_number = vc.current_version_number)
     JOIN due_diligence_cases dd ON vc.diligence_case_id = dd.id
     JOIN opportunities o ON vc.opportunity_id = o.id
     JOIN deal_mous m ON vc.mou_id = m.id
     LEFT JOIN mou_versions mv ON mv.mou_id = m.id AND mv.version_number = m.current_version_number
     JOIN nda_agreements nda ON vc.nda_id = nda.id
     WHERE vc.id = $1
     ORDER BY vv.version_number DESC
     LIMIT 1`,
    [valuationCaseId]
  );

  if (valRes.rows.length === 0) {
    throw new NotFoundError("Valuation workspace not found.");
  }

  const dealData = valRes.rows[0];

  // GATE 1: Opportunity Publication Check (Uniform 404 to avoid disclosure)
  if (dealData.opp_deleted_at !== null || dealData.opp_status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found or not published.");
  }

  // GATE 2: Bilateral NDA Execution Gate
  if (dealData.nda_status !== "EXECUTED") {
    throw new TransactionGateError(
      "Cannot create transaction deal room. Associated bilateral NDA is not in EXECUTED state."
    );
  }

  // GATE 3: Deal Intent MOU Gate
  if (dealData.mou_status !== "ACCEPTED") {
    throw new TransactionGateError(
      `Cannot create transaction deal room. Deal Intent MOU must be in ACCEPTED status (Current status: ${dealData.mou_status}).`
    );
  }

  // GATE 4: Escrow Token Deposit Gate
  const tokenRes = await query<any>(
    `SELECT id, status FROM token_deposits 
     WHERE mou_id = $1 AND status = 'TOKEN_PAYMENT_CONFIRMED'
     ORDER BY confirmed_at DESC LIMIT 1`,
    [dealData.mou_id]
  );
  const paymentRes = await query<any>(
    `SELECT id, status FROM payment_intents 
     WHERE mou_id = $1 AND status = 'SUCCEEDED'
     ORDER BY completed_at DESC LIMIT 1`,
    [dealData.mou_id]
  );

  if (tokenRes.rows.length === 0 && paymentRes.rows.length === 0) {
    throw new TransactionGateError(
      "Cannot create transaction deal room. Transaction earnest token deposit has not been confirmed in escrow."
    );
  }

  // GATE 5: Due Diligence Case Completion Gate
  if (dealData.dd_status === "REJECTED") {
    throw new TransactionGateError(
      "Cannot create transaction deal room. Associated due diligence case was REJECTED."
    );
  }

  const isDdComplete =
    dealData.dd_status === "APPROVED" ||
    dealData.dd_status === "REVIEW_COMPLETE" ||
    dealData.dd_verdict === "APPROVED" ||
    dealData.dd_verdict === "CONDITIONAL_APPROVAL";

  if (!isDdComplete) {
    throw new TransactionGateError(
      `Cannot create transaction deal room. Due diligence must be completed or approved before transaction closing (Current DD status: ${dealData.dd_status}).`
    );
  }

  // GATE 6: Authoritative Approved Valuation Gate
  if (dealData.val_version_status !== "APPROVED" && dealData.val_version_status !== "LOCKED") {
    throw new TransactionGateError(
      `Cannot create transaction deal room. Authoritative valuation must be in APPROVED or LOCKED status (Current valuation version status: ${dealData.val_version_status}).`
    );
  }

  // GATE 7: Initiator Authorization (Buyer or Admin only)
  const isBuyer = initiator.id === dealData.buyer_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN") || initiator.roles.includes("ADMIN");

  if (!isBuyer && !isAdmin) {
    throw new ForbiddenError(
      "Sellers/promoters cannot unilaterally create a transaction closing room. Transaction creation must be initiated by the prospective buyer or authorized transaction administrator."
    );
  }

  // Idempotency: Return existing active transaction if already created
  const existingTxnRes = await query<TransactionRecord>(
    `SELECT * FROM transactions 
     WHERE valuation_case_id = $1 AND status NOT IN ('CANCELLED', 'TERMINATED', 'FAILED_TO_CLOSE')
     LIMIT 1`,
    [valuationCaseId]
  );

  if (existingTxnRes.rows.length > 0) {
    const existing = existingTxnRes.rows[0];
    return {
      id: existing.id,
      referenceCode: existing.reference_code,
      opportunityId: existing.opportunity_id,
      opportunityTitle: dealData.opp_title,
      opportunityReference: dealData.opp_ref,
      buyerId: existing.buyer_id,
      sellerId: existing.seller_id,
      mouId: existing.mou_id,
      mouReference: dealData.mou_ref,
      ndaId: existing.nda_id,
      diligenceCaseId: existing.diligence_case_id,
      valuationCaseId: existing.valuation_case_id,
      valuationVersionId: existing.valuation_version_id,
      transactionType: existing.transaction_type,
      status: existing.status,
      agreedAmount: Number(existing.agreed_amount),
      currency: existing.currency,
      paymentStructure: existing.payment_structure,
      tokenDepositTreatment: existing.token_deposit_treatment,
      targetClosingDate: existing.target_closing_date ? new Date(existing.target_closing_date).toISOString() : null,
      governingLaw: existing.governing_law,
      disputeResolution: existing.dispute_resolution,
      currentVersionNumber: existing.current_version_number,
      buyerConfirmed: existing.buyer_confirmed,
      buyerConfirmedAt: existing.buyer_confirmed_at ? new Date(existing.buyer_confirmed_at).toISOString() : null,
      sellerConfirmed: existing.seller_confirmed,
      sellerConfirmedAt: existing.seller_confirmed_at ? new Date(existing.seller_confirmed_at).toISOString() : null,
      reviewerApproved: existing.reviewer_approved,
      reviewerApprovedAt: existing.reviewer_approved_at ? new Date(existing.reviewer_approved_at).toISOString() : null,
      reviewerId: existing.reviewer_id,
      notes: isBuyer ? existing.buyer_notes : isAdmin ? existing.reviewer_notes : existing.seller_notes,
      userRole: isBuyer ? "BUYER" : isAdmin ? "ADMIN" : "SELLER",
      closedAt: existing.closed_at ? new Date(existing.closed_at).toISOString() : null,
      closedBy: existing.closed_by,
      createdAt: new Date(existing.created_at).toISOString(),
      updatedAt: new Date(existing.updated_at).toISOString(),
    };
  }

  // Authoritative consideration derivation
  const agreedAmount = validated.agreedAmount ?? Number(dealData.mou_amount ?? 0);
  const currency = validated.currency || dealData.mou_currency || "INR";

  if (currency !== dealData.mou_currency && dealData.mou_currency) {
    throw new TermsConflictError(
      `Transaction currency (${currency}) does not match authoritative MOU currency (${dealData.mou_currency}). Silent currency conversion is prohibited.`
    );
  }

  const referenceCode = await generateTransactionReference();
  const tokenDepositId = tokenRes.rows[0]?.id || null;
  const paymentIntentId = paymentRes.rows[0]?.id || null;

  // Insert Transaction in atomic block
  const createdTxn = await dbTransaction(async (db) => {
    const txnInsertRes = await db.query<TransactionRecord>(
      `INSERT INTO transactions (
        reference_code, opportunity_id, buyer_id, seller_id, mou_id, nda_id,
        token_deposit_id, payment_intent_id, diligence_case_id, valuation_case_id, valuation_version_id,
        transaction_type, status, agreed_amount, currency, payment_structure, token_deposit_treatment,
        target_closing_date, governing_law, dispute_resolution, current_version_number,
        buyer_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'INITIATED', $13, $14, $15, $16, $17, $18, $19, 1, $20, $21)
      RETURNING *`,
      [
        referenceCode,
        dealData.opp_id,
        dealData.buyer_id,
        dealData.seller_id,
        dealData.mou_id,
        dealData.nda_id,
        tokenDepositId,
        paymentIntentId,
        dealData.dd_case_id,
        dealData.id,
        dealData.active_val_version_id,
        validated.transactionType,
        agreedAmount,
        currency,
        validated.paymentStructure,
        validated.tokenDepositTreatment,
        validated.targetClosingDate ? new Date(validated.targetClosingDate) : null,
        validated.governingLaw,
        validated.disputeResolution,
        validated.notes || null,
        initiator.id,
      ]
    );

    const txn = txnInsertRes.rows[0];

    // Create Initial Version 1
    await db.query(
      `INSERT INTO transaction_versions (
        transaction_id, version_number, transaction_type, agreed_amount, currency,
        payment_structure, token_deposit_treatment, valuation_case_id, valuation_version_id,
        target_closing_date, governing_law, dispute_resolution, special_conditions, status, created_by
      ) VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'DRAFT', $13)`,
      [
        txn.id,
        txn.transaction_type,
        txn.agreed_amount,
        txn.currency,
        txn.payment_structure,
        txn.token_deposit_treatment,
        txn.valuation_case_id,
        txn.valuation_version_id,
        txn.target_closing_date,
        txn.governing_law,
        txn.dispute_resolution,
        null,
        initiator.id,
      ]
    );

    // Seed Standard Closing Conditions
    for (const cond of STANDARD_CLOSING_CONDITIONS) {
      // Determine if automatically verified by previous phases
      let initialStatus = "PENDING";
      let verifiedBy = null;
      let verifiedAt = null;

      if (
        cond.conditionType === "NDA_EXECUTED" ||
        cond.conditionType === "MOU_ACCEPTED" ||
        cond.conditionType === "TOKEN_DEPOSIT_CONFIRMED" ||
        cond.conditionType === "DUE_DILIGENCE_APPROVED" ||
        cond.conditionType === "VALUATION_APPROVED"
      ) {
        initialStatus = "SATISFIED";
        verifiedBy = initiator.id;
        verifiedAt = new Date();
      }

      await db.query(
        `INSERT INTO transaction_conditions (
          transaction_id, condition_type, title, description, status, is_mandatory, responsible_party,
          verified_by, verified_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (transaction_id, condition_type) DO NOTHING`,
        [
          txn.id,
          cond.conditionType,
          cond.title,
          cond.description,
          initialStatus,
          cond.isMandatory,
          cond.responsibleParty,
          verifiedBy,
          verifiedAt,
        ]
      );
    }

    return txn;
  });

  // Audit Log & Notifications
  await auditLog({
    action: "TRANSACTION_CREATED",
    resourceType: "TRANSACTION",
    resourceId: createdTxn.id,
    actorId: initiator.id,
    metadata: {
      referenceCode: createdTxn.reference_code,
      opportunityId: createdTxn.opportunity_id,
      agreedAmount: createdTxn.agreed_amount,
      currency: createdTxn.currency,
      valuationCaseId,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // Notify seller of transaction creation
  await createNotification({
    userId: dealData.seller_id,
    type: "TRANSACTION_CREATED",
    title: "Transaction Deal Room Initialized",
    message: `Buyer has initialized the transaction deal room for ${dealData.opp_title} (Ref: ${createdTxn.reference_code}).`,
    resourceType: "TRANSACTION",
    resourceId: createdTxn.id,
  });

  return {
    id: createdTxn.id,
    referenceCode: createdTxn.reference_code,
    opportunityId: createdTxn.opportunity_id,
    opportunityTitle: dealData.opp_title,
    opportunityReference: dealData.opp_ref,
    buyerId: createdTxn.buyer_id,
    sellerId: createdTxn.seller_id,
    mouId: createdTxn.mou_id,
    mouReference: dealData.mou_ref,
    ndaId: createdTxn.nda_id,
    diligenceCaseId: createdTxn.diligence_case_id,
    valuationCaseId: createdTxn.valuation_case_id,
    valuationVersionId: createdTxn.valuation_version_id,
    transactionType: createdTxn.transaction_type,
    status: createdTxn.status,
    agreedAmount: Number(createdTxn.agreed_amount),
    currency: createdTxn.currency,
    paymentStructure: createdTxn.payment_structure,
    tokenDepositTreatment: createdTxn.token_deposit_treatment,
    targetClosingDate: createdTxn.target_closing_date ? new Date(createdTxn.target_closing_date).toISOString() : null,
    governingLaw: createdTxn.governing_law,
    disputeResolution: createdTxn.dispute_resolution,
    currentVersionNumber: createdTxn.current_version_number,
    buyerConfirmed: createdTxn.buyer_confirmed,
    buyerConfirmedAt: null,
    sellerConfirmed: createdTxn.seller_confirmed,
    sellerConfirmedAt: null,
    reviewerApproved: createdTxn.reviewer_approved,
    reviewerApprovedAt: null,
    reviewerId: null,
    notes: isBuyer ? createdTxn.buyer_notes : null,
    userRole: isBuyer ? "BUYER" : "ADMIN",
    closedAt: null,
    closedBy: null,
    createdAt: new Date(createdTxn.created_at).toISOString(),
    updatedAt: new Date(createdTxn.updated_at).toISOString(),
  };
}

/**
 * 2. GET TRANSACTION BY ID (With Progressive Masking)
 */
export async function getTransactionById(
  user: AuthenticatedUser,
  transactionId: string
): Promise<TransactionOverviewView> {
  const { transaction: txn, userRole } = await assertTransactionMember(user, transactionId);

  const oppRes = await query<{ title: string; reference_code: string }>(
    `SELECT title, reference_code FROM opportunities WHERE id = $1`,
    [txn.opportunity_id]
  );
  const mouRes = await query<{ reference_code: string }>(
    `SELECT reference_code FROM deal_mous WHERE id = $1`,
    [txn.mou_id]
  );
  const ddRes = await query<{ reference_code: string }>(
    `SELECT reference_code FROM due_diligence_cases WHERE id = $1`,
    [txn.diligence_case_id]
  );
  const valRes = await query<{ reference_code: string }>(
    `SELECT reference_code FROM valuation_cases WHERE id = $1`,
    [txn.valuation_case_id]
  );

  let notes: string | null = null;
  if (userRole === "BUYER") {
    notes = txn.buyer_notes;
  } else if (userRole === "SELLER") {
    notes = txn.seller_notes;
  } else {
    notes = txn.reviewer_notes || txn.buyer_notes;
  }

  return {
    id: txn.id,
    referenceCode: txn.reference_code,
    opportunityId: txn.opportunity_id,
    opportunityTitle: oppRes.rows[0]?.title,
    opportunityReference: oppRes.rows[0]?.reference_code,
    buyerId: txn.buyer_id,
    sellerId: txn.seller_id,
    mouId: txn.mou_id,
    mouReference: mouRes.rows[0]?.reference_code,
    ndaId: txn.nda_id,
    diligenceCaseId: txn.diligence_case_id,
    diligenceReference: ddRes.rows[0]?.reference_code,
    valuationCaseId: txn.valuation_case_id,
    valuationReference: valRes.rows[0]?.reference_code,
    valuationVersionId: txn.valuation_version_id,
    transactionType: txn.transaction_type,
    status: txn.status,
    agreedAmount: Number(txn.agreed_amount),
    currency: txn.currency,
    paymentStructure: txn.payment_structure,
    tokenDepositTreatment: txn.token_deposit_treatment,
    targetClosingDate: txn.target_closing_date ? new Date(txn.target_closing_date).toISOString() : null,
    governingLaw: txn.governing_law,
    disputeResolution: txn.dispute_resolution,
    currentVersionNumber: txn.current_version_number,
    buyerConfirmed: txn.buyer_confirmed,
    buyerConfirmedAt: txn.buyer_confirmed_at ? new Date(txn.buyer_confirmed_at).toISOString() : null,
    sellerConfirmed: txn.seller_confirmed,
    sellerConfirmedAt: txn.seller_confirmed_at ? new Date(txn.seller_confirmed_at).toISOString() : null,
    reviewerApproved: txn.reviewer_approved,
    reviewerApprovedAt: txn.reviewer_approved_at ? new Date(txn.reviewer_approved_at).toISOString() : null,
    reviewerId: txn.reviewer_id,
    notes,
    userRole,
    closedAt: txn.closed_at ? new Date(txn.closed_at).toISOString() : null,
    closedBy: txn.closed_by,
    createdAt: new Date(txn.created_at).toISOString(),
    updatedAt: new Date(txn.updated_at).toISOString(),
  };
}

/**
 * 3. LIST TRANSACTIONS
 */
export async function listTransactions(
  user: AuthenticatedUser,
  options: { limit?: number; offset?: number; status?: string } = {}
): Promise<{ items: TransactionOverviewView[]; total: number }> {
  const limit = Math.min(Math.max(options.limit || 20, 1), 100);
  const offset = Math.max(options.offset || 0, 0);

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN");
  const isReviewer =
    user.roles.includes("REVIEWER") ||
    user.roles.includes("LEGAL") ||
    user.roles.includes("FINANCE") ||
    user.permissions.includes("transaction.read_all");

  let whereClauses: string[] = [];
  let params: any[] = [];

  if (isAdmin || isReviewer) {
    if (options.status) {
      params.push(options.status);
      whereClauses.push(`t.status = $${params.length}`);
    }
  } else {
    params.push(user.id);
    whereClauses.push(`(t.buyer_id = $1 OR t.seller_id = $1)`);
    if (options.status) {
      params.push(options.status);
      whereClauses.push(`t.status = $${params.length}`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM transactions t ${whereSql}`,
    params
  );
  const total = parseInt(countRes.rows[0]?.count || "0", 10);

  params.push(limit, offset);
  const listSql = `
    SELECT t.*, o.title as opp_title, o.reference_code as opp_ref,
           m.reference_code as mou_ref, dd.reference_code as dd_ref, vc.reference_code as val_ref
    FROM transactions t
    JOIN opportunities o ON t.opportunity_id = o.id
    JOIN deal_mous m ON t.mou_id = m.id
    JOIN due_diligence_cases dd ON t.diligence_case_id = dd.id
    JOIN valuation_cases vc ON t.valuation_case_id = vc.id
    ${whereSql}
    ORDER BY t.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const rows = await query<any>(listSql, params);

  const items: TransactionOverviewView[] = rows.rows.map((r) => {
    let userRole: "BUYER" | "SELLER" | "REVIEWER" | "ADMIN" = "BUYER";
    if (isAdmin) userRole = "ADMIN";
    else if (isReviewer) userRole = "REVIEWER";
    else if (user.id === r.seller_id) userRole = "SELLER";

    return {
      id: r.id,
      referenceCode: r.reference_code,
      opportunityId: r.opportunity_id,
      opportunityTitle: r.opp_title,
      opportunityReference: r.opp_ref,
      buyerId: r.buyer_id,
      sellerId: r.seller_id,
      mouId: r.mou_id,
      mouReference: r.mou_ref,
      ndaId: r.nda_id,
      diligenceCaseId: r.diligence_case_id,
      diligenceReference: r.dd_ref,
      valuationCaseId: r.valuation_case_id,
      valuationReference: r.val_ref,
      valuationVersionId: r.valuation_version_id,
      transactionType: r.transaction_type,
      status: r.status,
      agreedAmount: Number(r.agreed_amount),
      currency: r.currency,
      paymentStructure: r.payment_structure,
      tokenDepositTreatment: r.token_deposit_treatment,
      targetClosingDate: r.target_closing_date ? new Date(r.target_closing_date).toISOString() : null,
      governingLaw: r.governing_law,
      disputeResolution: r.dispute_resolution,
      currentVersionNumber: r.current_version_number,
      buyerConfirmed: r.buyer_confirmed,
      buyerConfirmedAt: r.buyer_confirmed_at ? new Date(r.buyer_confirmed_at).toISOString() : null,
      sellerConfirmed: r.seller_confirmed,
      sellerConfirmedAt: r.seller_confirmed_at ? new Date(r.seller_confirmed_at).toISOString() : null,
      reviewerApproved: r.reviewer_approved,
      reviewerApprovedAt: r.reviewer_approved_at ? new Date(r.reviewer_approved_at).toISOString() : null,
      reviewerId: r.reviewer_id,
      notes: null, // Redacted in list view for performance and confidentiality
      userRole,
      closedAt: r.closed_at ? new Date(r.closed_at).toISOString() : null,
      closedBy: r.closed_by,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  });

  return { items, total };
}

/**
 * 4. UPDATE TRANSACTION TERMS
 */
export async function updateTransactionTerms(
  user: AuthenticatedUser,
  transactionId: string,
  input: UpdateTransactionTermsInput,
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionOverviewView> {
  const { transaction: txn, userRole } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot update terms. Transaction is already closed.");
  }

  if (
    txn.status === "CLOSING_IN_PROGRESS" ||
    txn.status === "READY_FOR_CLOSING"
  ) {
    throw new InvalidTransactionStateError(
      "Terms are frozen in ready-for-closing status. Create a new transaction version to revise terms."
    );
  }

  const validated = updateTransactionTermsSchema.parse(input);

  // Validate currency cannot be silently mutated
  if (validated.currency && validated.currency !== txn.currency) {
    throw new TermsConflictError("Currency cannot be mutated. Transaction must remain in original currency.");
  }

  const newTxnType = validated.transactionType || txn.transaction_type;
  const newAmount = validated.agreedAmount !== undefined ? validated.agreedAmount : Number(txn.agreed_amount);
  const newStructure = validated.paymentStructure || txn.payment_structure;
  const newTreatment = validated.tokenDepositTreatment || txn.token_deposit_treatment;
  const newTargetDate = validated.targetClosingDate !== undefined ? (validated.targetClosingDate ? new Date(validated.targetClosingDate) : null) : txn.target_closing_date;
  const newGovLaw = validated.governingLaw || txn.governing_law;
  const newDispute = validated.disputeResolution || txn.dispute_resolution;

  // Perform update in atomic block
  await dbTransaction(async (db) => {
    let noteUpdateSql = "";
    const noteParams: any[] = [];
    if (validated.notes !== undefined) {
      if (userRole === "BUYER") {
        noteUpdateSql = `, buyer_notes = $${noteParams.length + 8}`;
        noteParams.push(validated.notes);
      } else if (userRole === "SELLER") {
        noteUpdateSql = `, seller_notes = $${noteParams.length + 8}`;
        noteParams.push(validated.notes);
      } else {
        noteUpdateSql = `, reviewer_notes = $${noteParams.length + 8}`;
        noteParams.push(validated.notes);
      }
    }

    await db.query(
      `UPDATE transactions SET 
        transaction_type = $1, agreed_amount = $2, payment_structure = $3,
        token_deposit_treatment = $4, target_closing_date = $5, governing_law = $6,
        dispute_resolution = $7, status = 'TERMS_FINALIZATION',
        buyer_confirmed = FALSE, buyer_confirmed_at = NULL,
        seller_confirmed = FALSE, seller_confirmed_at = NULL,
        reviewer_approved = FALSE, reviewer_approved_at = NULL,
        updated_at = CURRENT_TIMESTAMP
        ${noteUpdateSql}
       WHERE id = $${noteParams.length + 8}`,
      [
        newTxnType,
        newAmount,
        newStructure,
        newTreatment,
        newTargetDate,
        newGovLaw,
        newDispute,
        ...noteParams,
        txn.id,
      ]
    );

    // Update current draft version
    await db.query(
      `UPDATE transaction_versions SET
        transaction_type = $1, agreed_amount = $2, payment_structure = $3,
        token_deposit_treatment = $4, target_closing_date = $5, governing_law = $6,
        dispute_resolution = $7, special_conditions = COALESCE($8::text, special_conditions),
        buyer_confirmed = FALSE, buyer_confirmed_at = NULL,
        seller_confirmed = FALSE, seller_confirmed_at = NULL,
        reviewer_approved = FALSE, reviewer_approved_at = NULL
       WHERE transaction_id = $9 AND version_number = $10`,
      [
        newTxnType,
        newAmount,
        newStructure,
        newTreatment,
        newTargetDate,
        newGovLaw,
        newDispute,
        validated.specialConditions || null,
        txn.id,
        txn.current_version_number,
      ]
    );
  });

  await auditLog({
    action: "TRANSACTION_TERMS_UPDATED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      transactionType: newTxnType,
      agreedAmount: newAmount,
      version: txn.current_version_number,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return getTransactionById(user, txn.id);
}

/**
 * 5. CREATE NEW TRANSACTION VERSION
 */
export async function createTransactionVersion(
  user: AuthenticatedUser,
  transactionId: string,
  input: CreateTransactionVersionInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionOverviewView> {
  const { transaction: txn } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot create a new version. Transaction is already closed.");
  }

  const validated = createTransactionVersionSchema.parse(input);
  const nextVer = txn.current_version_number + 1;

  await dbTransaction(async (db) => {
    // Freeze previous version
    await db.query(
      `UPDATE transaction_versions SET status = 'SUPERSEDED' WHERE transaction_id = $1 AND version_number = $2`,
      [txn.id, txn.current_version_number]
    );

    const newTxnType = validated.transactionType || txn.transaction_type;
    const newAmount = validated.agreedAmount !== undefined ? validated.agreedAmount : Number(txn.agreed_amount);
    const newStructure = validated.paymentStructure || txn.payment_structure;
    const newTreatment = validated.tokenDepositTreatment || txn.token_deposit_treatment;
    const newTargetDate = validated.targetClosingDate ? new Date(validated.targetClosingDate) : txn.target_closing_date;
    const newGovLaw = validated.governingLaw || txn.governing_law;
    const newDispute = validated.disputeResolution || txn.dispute_resolution;

    // Insert new version
    await db.query(
      `INSERT INTO transaction_versions (
        transaction_id, version_number, transaction_type, agreed_amount, currency,
        payment_structure, token_deposit_treatment, valuation_case_id, valuation_version_id,
        target_closing_date, governing_law, dispute_resolution, special_conditions, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'DRAFT', $14)`,
      [
        txn.id,
        nextVer,
        newTxnType,
        newAmount,
        txn.currency,
        newStructure,
        newTreatment,
        txn.valuation_case_id,
        txn.valuation_version_id,
        newTargetDate,
        newGovLaw,
        newDispute,
        validated.specialConditions || null,
        user.id,
      ]
    );

    // Update transaction header
    await db.query(
      `UPDATE transactions SET 
        current_version_number = $1, transaction_type = $2, agreed_amount = $3,
        payment_structure = $4, token_deposit_treatment = $5, target_closing_date = $6,
        governing_law = $7, dispute_resolution = $8, status = 'TERMS_FINALIZATION',
        buyer_confirmed = FALSE, buyer_confirmed_at = NULL,
        seller_confirmed = FALSE, seller_confirmed_at = NULL,
        reviewer_approved = FALSE, reviewer_approved_at = NULL,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        nextVer,
        newTxnType,
        newAmount,
        newStructure,
        newTreatment,
        newTargetDate,
        newGovLaw,
        newDispute,
        txn.id,
      ]
    );
  });

  await auditLog({
    action: "TRANSACTION_VERSION_CREATED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      versionNumber: nextVer,
      agreedAmount: validated.agreedAmount,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return getTransactionById(user, txn.id);
}

/**
 * 6. LIST TRANSACTION CONDITIONS
 */
export async function listTransactionConditions(
  user: AuthenticatedUser,
  transactionId: string
): Promise<TransactionConditionRecord[]> {
  const { transaction: txn } = await assertTransactionMember(user, transactionId);

  const res = await query<TransactionConditionRecord>(
    `SELECT * FROM transaction_conditions WHERE transaction_id = $1 ORDER BY created_at ASC`,
    [txn.id]
  );

  return res.rows;
}

/**
 * 7. VERIFY CLOSING CONDITION (Server-side authoritative check)
 */
export async function verifyClosingCondition(
  user: AuthenticatedUser,
  transactionId: string,
  conditionId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionConditionRecord> {
  const { transaction: txn, userRole } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot verify condition. Transaction is already closed.");
  }

  const condRes = await query<TransactionConditionRecord>(
    `SELECT * FROM transaction_conditions WHERE id = $1 AND transaction_id = $2`,
    [conditionId, txn.id]
  );

  if (condRes.rows.length === 0) {
    throw new NotFoundError("Closing condition not found.");
  }

  const condition = condRes.rows[0];

  // Authoritative server-side verification: NO FAKE CONDITIONS
  if (condition.condition_type === "TOKEN_DEPOSIT_CONFIRMED") {
    const tokenRes = await query<any>(
      `SELECT status FROM token_deposits WHERE mou_id = $1 AND status = 'TOKEN_PAYMENT_CONFIRMED'`,
      [txn.mou_id]
    );
    const paymentRes = await query<any>(
      `SELECT status FROM payment_intents WHERE mou_id = $1 AND status = 'SUCCEEDED'`,
      [txn.mou_id]
    );
    if (tokenRes.rows.length === 0 && paymentRes.rows.length === 0) {
      throw new ValidationError("Authoritative payment ledger has not confirmed earnest deposit.");
    }
  } else if (condition.condition_type === "VALUATION_APPROVED") {
    const valRes = await query<any>(
      `SELECT status FROM valuation_versions WHERE id = $1 AND status IN ('APPROVED', 'LOCKED')`,
      [txn.valuation_version_id]
    );
    if (valRes.rows.length === 0) {
      throw new ValidationError("Authoritative valuation version is not in APPROVED or LOCKED status.");
    }
  } else if (condition.condition_type === "DUE_DILIGENCE_APPROVED") {
    const ddRes = await query<any>(
      `SELECT status, verdict FROM due_diligence_cases WHERE id = $1`,
      [txn.diligence_case_id]
    );
    const dd = ddRes.rows[0];
    const isApproved =
      dd &&
      dd.status !== "REJECTED" &&
      (dd.status === "APPROVED" ||
        dd.status === "REVIEW_COMPLETE" ||
        dd.verdict === "APPROVED" ||
        dd.verdict === "CONDITIONAL_APPROVAL");
    if (!isApproved) {
      throw new ValidationError("Due diligence has not reached approved or completed status.");
    }
  } else if (
    condition.condition_type === "TRANSACTION_AGREEMENT_SIGNED" ||
    condition.condition_type === "BOARD_RESOLUTIONS_UPLOADED" ||
    condition.condition_type === "CLOSING_CERTIFICATE_EXECUTED"
  ) {
    // Requires verified document
    const docRes = await query<any>(
      `SELECT id FROM transaction_documents WHERE transaction_id = $1 AND (condition_id = $2 OR document_type = $3)`,
      [
        txn.id,
        condition.id,
        condition.condition_type === "TRANSACTION_AGREEMENT_SIGNED"
          ? "FINAL_TRANSACTION_AGREEMENT"
          : condition.condition_type === "BOARD_RESOLUTIONS_UPLOADED"
          ? "BOARD_RESOLUTION"
          : "CLOSING_CERTIFICATE",
      ]
    );
    if (docRes.rows.length === 0) {
      throw new ValidationError(
        `Cannot satisfy condition. Authoritative document evidence is missing for ${condition.title}.`
      );
    }
  }

  // Update condition status
  const updatedRes = await query<TransactionConditionRecord>(
    `UPDATE transaction_conditions SET 
      status = 'SATISFIED', verified_by = $1, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [user.id, condition.id]
  );

  await auditLog({
    action: "CLOSING_CONDITION_VERIFIED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      conditionId: condition.id,
      conditionType: condition.condition_type,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return updatedRes.rows[0];
}

/**
 * 8. WAIVE CLOSING CONDITION (Reviewer / Admin Authority only)
 */
export async function waiveClosingCondition(
  user: AuthenticatedUser,
  transactionId: string,
  conditionId: string,
  input: WaiveConditionInput,
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionConditionRecord> {
  const { transaction: txn, userRole } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot waive condition. Transaction is already closed.");
  }

  if (userRole !== "REVIEWER" && userRole !== "ADMIN") {
    throw new ForbiddenError("Only platform financial/legal reviewers or administrators can waive closing conditions.");
  }

  const validated = waiveConditionSchema.parse(input);

  const updatedRes = await query<TransactionConditionRecord>(
    `UPDATE transaction_conditions SET 
      status = 'WAIVED', waiver_reason = $1, waived_by = $2, waived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND transaction_id = $4
     RETURNING *`,
    [validated.waiverReason, user.id, conditionId, txn.id]
  );

  if (updatedRes.rows.length === 0) {
    throw new NotFoundError("Closing condition not found.");
  }

  await auditLog({
    action: "CLOSING_CONDITION_WAIVED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      conditionId,
      waiverReason: validated.waiverReason,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return updatedRes.rows[0];
}

/**
 * 9. UPLOAD TRANSACTION CLOSING DOCUMENT (With SHA-256 and Magic-Byte Inspection)
 */
export async function uploadTransactionDocument(
  user: AuthenticatedUser,
  transactionId: string,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
    documentType: TransactionDocumentType;
    title: string;
    conditionId?: string;
    signingStatus?: "NOT_REQUIRED" | "PENDING_SIGNATURE" | "SIGNATURE_RECORDED" | "VERIFIED";
    signerIdentity?: string;
  },
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionDocumentRecord> {
  const { transaction: txn } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot upload document. Transaction is already closed.");
  }

  // 1. File size check
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }

  // 2. Extension check
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG documents are permitted.`
    );
  }

  // 3. Prevent path traversal
  const baseFilename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (baseFilename.includes("..") || baseFilename.startsWith(".")) {
    throw new ValidationError("Malicious or invalid filename detected.");
  }

  // 4. Magic bytes validation
  const isMagicValid = validateMagicBytes(file.buffer, ext);
  if (!isMagicValid) {
    throw new ValidationError(
      "File content does not match its declared format. Potential MIME-spoofing detected."
    );
  }

  // 5. SHA-256 Checksum
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 6. Write file to disk
  const storageDir = path.resolve(process.cwd(), "data/vault/transactions", txn.id);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const safeStorageKey = `vault/transactions/${txn.id}/${file.documentType}_${crypto.randomUUID()}${ext}`;
  const fullPath = path.resolve(process.cwd(), "data", safeStorageKey);
  fs.writeFileSync(fullPath, file.buffer);

  // 7. Insert DB record & link to condition
  const docRes = await dbTransaction(async (db) => {
    const insertRes = await db.query<TransactionDocumentRecord>(
      `INSERT INTO transaction_documents (
        transaction_id, condition_id, document_type, title, file_name, file_path,
        file_size, mime_type, sha256_hash, version_number, signing_status, signer_identity,
        uploaded_by, verified_by, verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        txn.id,
        file.conditionId || null,
        file.documentType,
        file.title,
        baseFilename,
        safeStorageKey,
        file.buffer.length,
        file.mimeType,
        checksum,
        file.signingStatus || "NOT_REQUIRED",
        file.signerIdentity || null,
        user.id,
        user.id,
      ]
    );

    // If conditionId provided, update condition
    if (file.conditionId) {
      await db.query(
        `UPDATE transaction_conditions SET 
          status = 'SATISFIED', evidence_document_id = $1, verified_by = $2, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 AND transaction_id = $4`,
        [insertRes.rows[0].id, user.id, file.conditionId, txn.id]
      );
    }

    return insertRes.rows[0];
  });

  await auditLog({
    action: "TRANSACTION_DOCUMENT_UPLOADED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      documentId: docRes.id,
      documentType: docRes.document_type,
      checksum,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return docRes;
}

/**
 * 10. LIST TRANSACTION DOCUMENTS
 */
export async function listTransactionDocuments(
  user: AuthenticatedUser,
  transactionId: string
): Promise<TransactionDocumentRecord[]> {
  const { transaction: txn } = await assertTransactionMember(user, transactionId);

  const res = await query<TransactionDocumentRecord>(
    `SELECT * FROM transaction_documents WHERE transaction_id = $1 ORDER BY created_at DESC`,
    [txn.id]
  );

  return res.rows;
}

/**
 * 11. CONFIRM TRANSACTION TERMS (Bilateral Confirmation)
 */
export async function confirmTransactionTerms(
  user: AuthenticatedUser,
  transactionId: string,
  input: ConfirmTransactionInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionOverviewView> {
  const { transaction: txn, userRole } = await assertTransactionMember(user, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot confirm terms. Transaction is already closed.");
  }

  if (userRole !== "BUYER" && userRole !== "SELLER") {
    throw new ForbiddenError(
      "Only the designated Buyer or Seller can bilaterally confirm transaction terms. Platform reviewers must use the formal review endpoint."
    );
  }

  const validated = confirmTransactionSchema.parse(input);

  await dbTransaction(async (db) => {
    if (userRole === "BUYER") {
      await db.query(
        `UPDATE transactions SET 
          buyer_confirmed = TRUE, buyer_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [txn.id]
      );
      await db.query(
        `UPDATE transaction_versions SET 
          buyer_confirmed = TRUE, buyer_confirmed_at = CURRENT_TIMESTAMP
         WHERE transaction_id = $1 AND version_number = $2`,
        [txn.id, txn.current_version_number]
      );
    } else {
      await db.query(
        `UPDATE transactions SET 
          seller_confirmed = TRUE, seller_confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [txn.id]
      );
      await db.query(
        `UPDATE transaction_versions SET 
          seller_confirmed = TRUE, seller_confirmed_at = CURRENT_TIMESTAMP
         WHERE transaction_id = $1 AND version_number = $2`,
        [txn.id, txn.current_version_number]
      );
    }
  });

  await auditLog({
    action: userRole === "BUYER" ? "TRANSACTION_BUYER_CONFIRMED" : "TRANSACTION_SELLER_CONFIRMED",
    resourceType: "TRANSACTION",
    resourceId: txn.id,
    actorId: user.id,
    metadata: {
      role: userRole,
      notes: validated.notes,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // Check if both sides have now confirmed
  const refreshed = await getTransactionById(user, txn.id);
  if (refreshed.buyerConfirmed && refreshed.sellerConfirmed && refreshed.status !== "READY_FOR_CLOSING") {
    // Notify reviewer/admin that bilateral confirmations are complete
    await query(
      `UPDATE transactions SET status = 'CLOSING_CONDITIONS' WHERE id = $1`,
      [txn.id]
    );
  }

  return getTransactionById(user, txn.id);
}

/**
 * 12. REVIEW TRANSACTION (Independent Reviewer / Admin Approval)
 * Anti-Self-Approval: Creator/Buyer cannot approve their own model.
 */
export async function reviewTransaction(
  reviewer: AuthenticatedUser,
  transactionId: string,
  input: ReviewTransactionInput,
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionOverviewView> {
  const { transaction: txn } = await assertTransactionMember(reviewer, transactionId);

  if (txn.status === "CLOSED") {
    throw new TransactionClosedError("Cannot review transaction. Transaction is already closed.");
  }

  // Anti-Self-Approval Check
  if (reviewer.id === txn.buyer_id) {
    throw new ForbiddenError(
      "Strict Anti-Self-Approval: The prospective buyer cannot act as the platform reviewer or approve their own transaction."
    );
  }

  if (reviewer.id === txn.seller_id) {
    throw new ForbiddenError(
      "Sellers cannot review or approve the platform transaction closing. Independent review required."
    );
  }

  const isReviewer =
    reviewer.roles.includes("SUPER_ADMIN") ||
    reviewer.roles.includes("ADMIN") ||
    reviewer.roles.includes("REVIEWER") ||
    reviewer.permissions.includes("transaction.review") ||
    reviewer.permissions.includes("transaction.approve");

  if (!isReviewer) {
    throw new ForbiddenError("You do not have reviewer permissions for transaction approval.");
  }

  const validated = reviewTransactionSchema.parse(input);

  if (validated.decision === "APPROVED") {
    await dbTransaction(async (db) => {
      await db.query(
        `UPDATE transactions SET 
          reviewer_approved = TRUE, reviewer_approved_at = CURRENT_TIMESTAMP, reviewer_id = $1,
          reviewer_notes = $2, status = 'READY_FOR_CLOSING', updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [reviewer.id, validated.notes, txn.id]
      );
      await db.query(
        `UPDATE transaction_versions SET 
          reviewer_approved = TRUE, reviewer_approved_at = CURRENT_TIMESTAMP, status = 'FROZEN'
         WHERE transaction_id = $1 AND version_number = $2`,
        [txn.id, txn.current_version_number]
      );
    });

    await auditLog({
      action: "TRANSACTION_REVIEWER_APPROVED",
      resourceType: "TRANSACTION",
      resourceId: txn.id,
      actorId: reviewer.id,
      metadata: { decision: "APPROVED", notes: validated.notes },
      ip: context?.ip,
      userAgent: context?.userAgent,
    });
  } else if (validated.decision === "REVISION_REQUIRED") {
    await query(
      `UPDATE transactions SET 
        status = 'TERMS_FINALIZATION', buyer_confirmed = FALSE, seller_confirmed = FALSE,
        reviewer_approved = FALSE, reviewer_notes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [validated.notes, txn.id]
    );

    await auditLog({
      action: "TRANSACTION_REVISION_REQUESTED",
      resourceType: "TRANSACTION",
      resourceId: txn.id,
      actorId: reviewer.id,
      metadata: { decision: "REVISION_REQUIRED", notes: validated.notes },
      ip: context?.ip,
      userAgent: context?.userAgent,
    });
  }

  return getTransactionById(reviewer, txn.id);
}

/**
 * 13. EVALUATE CLOSING READINESS
 */
export async function evaluateClosingReadiness(
  user: AuthenticatedUser,
  transactionId: string
): Promise<ClosingReadinessView> {
  const { transaction: txn } = await assertTransactionMember(user, transactionId);

  const conditionsRes = await query<TransactionConditionRecord>(
    `SELECT * FROM transaction_conditions WHERE transaction_id = $1`,
    [txn.id]
  );
  const conditions = conditionsRes.rows;

  const blockingReasons: string[] = [];

  // Check mandatory conditions
  const mandatoryConditions = conditions.filter((c) => c.is_mandatory);
  const satisfiedMandatory = mandatoryConditions.filter(
    (c) => c.status === "SATISFIED" || c.status === "WAIVED"
  );

  for (const c of mandatoryConditions) {
    if (c.status !== "SATISFIED" && c.status !== "WAIVED") {
      blockingReasons.push(`Mandatory closing condition pending: ${c.title}`);
    }
  }

  // Check bilateral confirmations
  if (!txn.buyer_confirmed) {
    blockingReasons.push("Buyer formal confirmation of transaction terms is pending.");
  }
  if (!txn.seller_confirmed) {
    blockingReasons.push("Seller formal confirmation of transaction terms is pending.");
  }

  // Check platform reviewer approval
  if (!txn.reviewer_approved) {
    blockingReasons.push("Platform financial/legal reviewer approval is pending.");
  }

  // Check unresolved critical due diligence findings
  const findingsRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM diligence_findings 
     WHERE case_id = $1 AND severity = 'CRITICAL' AND status NOT IN ('REMEDIATED', 'ACCEPTED_RISK')`,
    [txn.diligence_case_id]
  );
  const unresolvedFindingsCount = parseInt(findingsRes.rows[0]?.count || "0", 10);
  if (unresolvedFindingsCount > 0) {
    blockingReasons.push(
      `Due diligence case has ${unresolvedFindingsCount} unresolved CRITICAL risk finding(s). Must be remediated or accepted before closing.`
    );
  }

  const isReadyForClosing = blockingReasons.length === 0;

  return {
    transactionId: txn.id,
    referenceCode: txn.reference_code,
    isReadyForClosing,
    blockingReasons,
    totalMandatoryConditions: mandatoryConditions.length,
    satisfiedMandatoryConditions: satisfiedMandatory.length,
    buyerConfirmed: txn.buyer_confirmed,
    sellerConfirmed: txn.seller_confirmed,
    reviewerApproved: txn.reviewer_approved,
    unresolvedDiligenceFindingsCount: unresolvedFindingsCount,
  };
}

/**
 * 14. ATOMIC TRANSACTION CLOSING (Strict Concurrency & Integrity Enforcement)
 */
export async function closeTransaction(
  closer: AuthenticatedUser,
  transactionId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<TransactionClosingRecord> {
  // Authorization: Only Admin or Lead Reviewer with transaction.close permission can execute closing
  const isAdmin = closer.roles.includes("SUPER_ADMIN") || closer.roles.includes("ADMIN");
  const hasClosePerm = closer.permissions.includes("transaction.close");

  if (!isAdmin && !hasClosePerm) {
    throw new ForbiddenError(
      "Only platform transaction administrators can execute the authoritative transaction closing."
    );
  }

  // Perform closing in atomic database transaction with row-level locking
  return await dbTransaction(async (db) => {
    // 1. SELECT transaction FOR UPDATE to prevent race conditions & duplicate closing
    const lockRes = await db.query<TransactionRecord>(
      `SELECT * FROM transactions WHERE id = $1 FOR UPDATE`,
      [transactionId]
    );

    if (lockRes.rows.length === 0) {
      throw new NotFoundError("Transaction workspace not found.");
    }

    const txn = lockRes.rows[0];

    // Idempotency: If already closed, return existing record
    if (txn.status === "CLOSED") {
      const existingCloseRes = await db.query<TransactionClosingRecord>(
        `SELECT * FROM transaction_closing_records WHERE transaction_id = $1`,
        [txn.id]
      );
      if (existingCloseRes.rows.length > 0) {
        return existingCloseRes.rows[0];
      }
      throw new TransactionClosedError("Transaction is already marked CLOSED.");
    }

    // 2. Re-validate ALL closing readiness gates at closing time
    const readiness = await evaluateClosingReadiness(closer, txn.id);
    if (!readiness.isReadyForClosing) {
      // Record failed closing attempt
      await auditLog({
        action: "CLOSING_ATTEMPT_FAILED",
        resourceType: "TRANSACTION",
        resourceId: txn.id,
        actorId: closer.id,
        metadata: { blockingReasons: readiness.blockingReasons },
        ip: context?.ip,
        userAgent: context?.userAgent,
      });

      throw new ClosingConditionUnsatisfiedError(
        `Cannot execute closing. Blocking conditions exist:\n${readiness.blockingReasons.join("\n")}`
      );
    }

    // 3. Collect Snapshots for Permanent Immutable Record
    const conditionsRes = await db.query(
      `SELECT * FROM transaction_conditions WHERE transaction_id = $1`,
      [txn.id]
    );
    const documentsRes = await db.query(
      `SELECT id, document_type, title, file_name, file_size, sha256_hash, signing_status 
       FROM transaction_documents WHERE transaction_id = $1`,
      [txn.id]
    );

    const conditionsSnapshot = conditionsRes.rows;
    const documentHashes = documentsRes.rows;
    const confirmationsSnapshot = {
      buyerId: txn.buyer_id,
      buyerConfirmed: txn.buyer_confirmed,
      buyerConfirmedAt: txn.buyer_confirmed_at,
      sellerId: txn.seller_id,
      sellerConfirmed: txn.seller_confirmed,
      sellerConfirmedAt: txn.seller_confirmed_at,
      reviewerId: txn.reviewer_id,
      reviewerApproved: txn.reviewer_approved,
      reviewerApprovedAt: txn.reviewer_approved_at,
    };

    const closingRef = await generateClosingReference();

    // 4. Transition Transaction state to CLOSED
    await db.query(
      `UPDATE transactions SET 
        status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, closed_by = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [closer.id, txn.id]
    );

    await db.query(
      `UPDATE transaction_versions SET status = 'CLOSED' 
       WHERE transaction_id = $1 AND version_number = $2`,
      [txn.id, txn.current_version_number]
    );

    // 5. Create Immutable Closing Record
    const closingRecordRes = await db.query<TransactionClosingRecord>(
      `INSERT INTO transaction_closing_records (
        closing_reference, transaction_id, version_number, opportunity_id,
        buyer_id, seller_id, mou_id, diligence_case_id, valuation_case_id, valuation_version_id,
        transaction_type, final_consideration, currency, payment_reference,
        conditions_snapshot, document_hashes, confirmations_snapshot, audit_reference,
        closed_by, closed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        closingRef,
        txn.id,
        txn.current_version_number,
        txn.opportunity_id,
        txn.buyer_id,
        txn.seller_id,
        txn.mou_id,
        txn.diligence_case_id,
        txn.valuation_case_id,
        txn.valuation_version_id,
        txn.transaction_type,
        txn.agreed_amount,
        txn.currency,
        txn.payment_intent_id || txn.token_deposit_id || null,
        JSON.stringify(conditionsSnapshot),
        JSON.stringify(documentHashes),
        JSON.stringify(confirmationsSnapshot),
        `AUDIT-${closingRef}`,
        closer.id,
      ]
    );

    const closingRecord = closingRecordRes.rows[0];

    // 6. Record Immutable Audit Event
    await auditLog({
      action: "TRANSACTION_CLOSED",
      resourceType: "TRANSACTION",
      resourceId: txn.id,
      actorId: closer.id,
      metadata: {
        closingReference: closingRef,
        finalConsideration: txn.agreed_amount,
        currency: txn.currency,
      },
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    // 7. Send In-App Notifications
    await createNotification({
      userId: txn.buyer_id,
      type: "TRANSACTION_CLOSED",
      title: "Transaction Deal Successfully Closed",
      message: `Your transaction (Ref: ${txn.reference_code}, Closing Ref: ${closingRef}) has successfully executed and closed.`,
      resourceType: "TRANSACTION",
      resourceId: txn.id,
    });

    await createNotification({
      userId: txn.seller_id,
      type: "TRANSACTION_CLOSED",
      title: "Transaction Deal Successfully Closed",
      message: `Your business acquisition transaction (Ref: ${txn.reference_code}, Closing Ref: ${closingRef}) has successfully executed and closed.`,
      resourceType: "TRANSACTION",
      resourceId: txn.id,
    });

    return closingRecord;
  });
}

/**
 * 15. GET CLOSING RECORD
 */
export async function getClosingRecord(
  user: AuthenticatedUser,
  transactionId: string
): Promise<TransactionClosingRecord> {
  await assertTransactionMember(user, transactionId);

  const res = await query<TransactionClosingRecord>(
    `SELECT * FROM transaction_closing_records WHERE transaction_id = $1`,
    [transactionId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Closing record not found. Transaction has not been closed.");
  }

  return res.rows[0];
}
