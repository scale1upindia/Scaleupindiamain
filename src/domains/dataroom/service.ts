// Scale-up India — Phase 8: Bilateral NDA & Secure Data Room Domain Service
// Path: src/domains/dataroom/service.ts

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import {
  NDARecord,
  BuyerNDAView,
  SellerNDAView,
  DataRoomRecord,
  DataRoomMemberRecord,
  DataRoomDocumentRecord,
  DataRoomView,
  DataRoomDocumentView,
  SignedUrlResponse,
  NDAStatus,
  DataRoomStatus,
  DataRoomDocumentCategory,
  DataRoomDocumentAccessLevel,
  DataRoomMemberRole,
} from "@/types/nda";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateNDAInput,
  AcceptNDAInput,
  DeclineNDAInput,
  RevokeNDAInput,
  UploadDataRoomDocumentInput,
} from "@/schemas/nda";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "@/lib/security/downloadToken";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4e, 0x47], // .PNG
  JPEG: [0xff, 0xd8, 0xff], // JPEG SOI
};

// In-memory sliding-window rate limiter for signed URL requests: userId -> timestamps[]
const signedUrlRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SIGNED_URLS_PER_WINDOW = 30;

function checkRateLimit(userId: string): void {
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

// ==========================================
// 1. BILATERAL NDA CREATION & LIFECYCLE
// ==========================================

export async function initiateNDA(
  initiator: AuthenticatedUser,
  opportunityId: string,
  input: CreateNDAInput,
  context?: { ip?: string; userAgent?: string }
): Promise<NDARecord> {
  // 1. Verify opportunity exists and is published
  const oppRes = await query<any>(
    `SELECT id, status, deleted_at FROM opportunities WHERE id = $1`,
    [opportunityId]
  );
  if (oppRes.rows.length === 0 || oppRes.rows[0].deleted_at !== null) {
    throw new NotFoundError("Business opportunity not found.");
  }
  if (oppRes.rows[0].status !== "PUBLISHED") {
    throw new NotFoundError("Business opportunity not found.");
  }

  // 2. Verify Expression of Interest prerequisite
  const eoiRes = await query<any>(
    `SELECT id, opportunity_id, buyer_id, seller_id, status 
     FROM expressions_of_interest 
     WHERE id = $1`,
    [input.eoiId]
  );
  if (eoiRes.rows.length === 0) {
    throw new NotFoundError("Associated Expression of Interest not found.");
  }

  const eoi = eoiRes.rows[0];

  // Must belong to the exact opportunity
  if (eoi.opportunity_id !== opportunityId) {
    throw new ValidationError("Expression of Interest does not match the specified opportunity.");
  }

  // CRITICAL GATE: EOI must be in ACCEPTED state
  if (eoi.status !== "ACCEPTED") {
    throw new ValidationError(
      `Cannot initiate bilateral NDA. Expression of Interest must be in ACCEPTED status (Current status: ${eoi.status}).`
    );
  }

  // Anti-IDOR Authorization Check: Initiator must be the buyer or seller of the EOI (or super admin)
  const isBuyer = initiator.id === eoi.buyer_id;
  const isSeller = initiator.id === eoi.seller_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not authorized to initiate an NDA for this transaction.");
  }

  // 3. Concurrency & Duplication Guard
  const activeNdaRes = await query<any>(
    `SELECT id, reference_code FROM nda_agreements 
     WHERE buyer_id = $1 AND opportunity_id = $2 
     AND status IN ('NDA_DRAFT', 'NDA_SENT', 'BUYER_VIEWED', 'BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXECUTED')`,
    [eoi.buyer_id, opportunityId]
  );

  if (activeNdaRes.rows.length > 0) {
    throw new ConflictError(
      `An active bilateral NDA agreement already exists for this counterparty (${activeNdaRes.rows[0].reference_code}).`
    );
  }

  // 4. Generate Sequence Reference Code (e.g. NDA-2026-10001)
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('nda_ref_seq') as nextval`);
  const seqNumber = seqRes.rows[0]?.nextval || "10001";
  const currentYear = new Date().getFullYear();
  const referenceCode = `NDA-${currentYear}-${seqNumber}`;

  // 5. Insert NDA Record
  const insertRes = await query<any>(
    `INSERT INTO nda_agreements (
      reference_code, opportunity_id, eoi_id, buyer_id, seller_id,
      nda_version, document_reference, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, 'v1.0-standard', 'SCALEUP-STANDARD-BILATERAL-NDA-2026', 'NDA_SENT', $6
    ) RETURNING *`,
    [referenceCode, opportunityId, eoi.id, eoi.buyer_id, eoi.seller_id, initiator.id]
  );

  const nda = mapNDARecord(insertRes.rows[0]);

  // 6. Audit Log
  await auditLog({
    actorId: initiator.id,
    action: "NDA_CREATED",
    resourceType: "nda_agreement",
    resourceId: nda.id,
    metadata: { referenceCode: nda.referenceCode, opportunityId },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // 7. Notify Counterparty
  const recipientId = isBuyer ? eoi.seller_id : eoi.buyer_id;
  await createNotification({
    userId: recipientId,
    type: "NDA_SENT",
    title: "Bilateral NDA Initiated",
    message: `A bilateral Non-Disclosure Agreement (${nda.referenceCode}) has been initiated for your transaction.`,
    resourceType: "nda_agreement",
    resourceId: nda.id,
  });

  return nda;
}

export async function getBuyerNDAs(buyerUser: AuthenticatedUser): Promise<BuyerNDAView[]> {
  const res = await query<any>(
    `SELECT 
      n.*,
      o.reference_code as opp_ref, o.title as opp_title,
      e.reference_code as eoi_ref,
      dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     JOIN expressions_of_interest e ON n.eoi_id = e.id
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.buyer_id = $1
     ORDER BY n.created_at DESC`,
    [buyerUser.id]
  );

  return res.rows.map((row) => ({
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    eoiId: row.eoi_id,
    eoiReference: row.eoi_ref,
    ndaVersion: row.nda_version,
    documentReference: row.document_reference,
    status: row.status as NDAStatus,
    buyerAcceptedAt: row.buyer_accepted_at,
    sellerAcceptedAt: row.seller_accepted_at,
    executedAt: row.executed_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dataRoomId: row.data_room_id || null,
    dataRoomStatus: row.data_room_status || null,
  }));
}

export async function getBuyerNDAById(buyerUser: AuthenticatedUser, ndaId: string): Promise<BuyerNDAView> {
  const res = await query<any>(
    `SELECT 
      n.*,
      o.reference_code as opp_ref, o.title as opp_title,
      e.reference_code as eoi_ref,
      dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     JOIN expressions_of_interest e ON n.eoi_id = e.id
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.id = $1`,
    [ndaId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("NDA agreement not found.");
  }

  const row = res.rows[0];

  // Anti-IDOR Authorization Check
  if (row.buyer_id !== buyerUser.id && !buyerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to view this NDA agreement.");
  }

  // Update viewed timestamp on first inspection
  if (!row.buyer_viewed_at) {
    const shouldUpdateStatus = row.status === "NDA_SENT";
    await query(
      `UPDATE nda_agreements 
       SET buyer_viewed_at = CURRENT_TIMESTAMP,
           status = CASE WHEN status = 'NDA_SENT' THEN 'BUYER_VIEWED' ELSE status END
       WHERE id = $1`,
      [ndaId]
    );
    row.buyer_viewed_at = new Date().toISOString();
    if (shouldUpdateStatus) {
      row.status = "BUYER_VIEWED";
    }

    await auditLog({
      actorId: buyerUser.id,
      action: "NDA_VIEWED",
      resourceType: "nda_agreement",
      resourceId: ndaId,
      metadata: { role: "BUYER", referenceCode: row.reference_code },
    });
  }

  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    eoiId: row.eoi_id,
    eoiReference: row.eoi_ref,
    ndaVersion: row.nda_version,
    documentReference: row.document_reference,
    status: row.status as NDAStatus,
    buyerAcceptedAt: row.buyer_accepted_at,
    sellerAcceptedAt: row.seller_accepted_at,
    executedAt: row.executed_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dataRoomId: row.data_room_id || null,
    dataRoomStatus: row.data_room_status || null,
  };
}

export async function getSellerNDAs(sellerUser: AuthenticatedUser): Promise<SellerNDAView[]> {
  const res = await query<any>(
    `SELECT 
      n.*,
      o.reference_code as opp_ref, o.title as opp_title,
      e.reference_code as eoi_ref,
      bp.entity_type as buyer_entity_type, bp.state as buyer_state, bp.country as buyer_country,
      dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     JOIN expressions_of_interest e ON n.eoi_id = e.id
     JOIN buyer_profiles bp ON bp.user_id = n.buyer_id
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.seller_id = $1
     ORDER BY n.created_at DESC`,
    [sellerUser.id]
  );

  return res.rows.map((row) => ({
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    eoiId: row.eoi_id,
    eoiReference: row.eoi_ref,
    buyerEntityType: row.buyer_entity_type || "CORPORATE",
    buyerLocation: `${row.buyer_state || ""}, ${row.buyer_country || "India"}`.trim(),
    ndaVersion: row.nda_version,
    documentReference: row.document_reference,
    status: row.status as NDAStatus,
    buyerAcceptedAt: row.buyer_accepted_at,
    sellerAcceptedAt: row.seller_accepted_at,
    executedAt: row.executed_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dataRoomId: row.data_room_id || null,
    dataRoomStatus: row.data_room_status || null,
  }));
}

export async function getSellerNDAById(sellerUser: AuthenticatedUser, ndaId: string): Promise<SellerNDAView> {
  const res = await query<any>(
    `SELECT 
      n.*,
      o.reference_code as opp_ref, o.title as opp_title,
      e.reference_code as eoi_ref,
      bp.entity_type as buyer_entity_type, bp.state as buyer_state, bp.country as buyer_country,
      dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     JOIN expressions_of_interest e ON n.eoi_id = e.id
     JOIN buyer_profiles bp ON bp.user_id = n.buyer_id
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.id = $1`,
    [ndaId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("NDA agreement not found.");
  }

  const row = res.rows[0];

  // Anti-IDOR Authorization Check
  if (row.seller_id !== sellerUser.id && !sellerUser.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to view this NDA agreement.");
  }

  // Update viewed timestamp on first inspection
  if (!row.seller_viewed_at) {
    await query(
      `UPDATE nda_agreements SET seller_viewed_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [ndaId]
    );
    row.seller_viewed_at = new Date().toISOString();

    await auditLog({
      actorId: sellerUser.id,
      action: "NDA_VIEWED",
      resourceType: "nda_agreement",
      resourceId: ndaId,
      metadata: { role: "SELLER", referenceCode: row.reference_code },
    });
  }

  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref,
    opportunityTitle: row.opp_title,
    eoiId: row.eoi_id,
    eoiReference: row.eoi_ref,
    buyerEntityType: row.buyer_entity_type || "CORPORATE",
    buyerLocation: `${row.buyer_state || ""}, ${row.buyer_country || "India"}`.trim(),
    ndaVersion: row.nda_version,
    documentReference: row.document_reference,
    status: row.status as NDAStatus,
    buyerAcceptedAt: row.buyer_accepted_at,
    sellerAcceptedAt: row.seller_accepted_at,
    executedAt: row.executed_at,
    declinedAt: row.declined_at,
    declineReason: row.decline_reason,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    dataRoomId: row.data_room_id || null,
    dataRoomStatus: row.data_room_status || null,
  };
}

/**
 * Bilateral Acceptance Workflow
 * CRITICAL RULE: EXECUTED status is reached ONLY when BOTH parties have formally accepted.
 */
export async function acceptNDA(
  user: AuthenticatedUser,
  ndaId: string,
  input: AcceptNDAInput,
  context?: { ip?: string; userAgent?: string }
): Promise<NDARecord> {
  if (!input.termsAcknowledged) {
    throw new ValidationError("Terms must be explicitly acknowledged to accept the bilateral NDA.");
  }

  const res = await query<any>(`SELECT * FROM nda_agreements WHERE id = $1`, [ndaId]);
  if (res.rows.length === 0) {
    throw new NotFoundError("NDA agreement not found.");
  }

  const nda = mapNDARecord(res.rows[0]);

  // Terminal State Validations
  if (nda.status === "EXECUTED") {
    throw new ValidationError("Bilateral NDA agreement has already been executed.");
  }
  if (nda.status === "DECLINED") {
    throw new ValidationError("Cannot accept an NDA agreement that has been declined.");
  }
  if (nda.status === "REVOKED") {
    throw new ValidationError("Cannot accept a revoked NDA agreement.");
  }
  if (nda.status === "EXPIRED") {
    throw new ValidationError("Cannot accept an expired NDA agreement.");
  }

  const isBuyer = user.id === nda.buyerId;
  const isSeller = user.id === nda.sellerId;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not a bilateral principal to this NDA agreement.");
  }

  let newStatus: NDAStatus = nda.status;
  let isNowExecuted = false;

  if (isBuyer) {
    if (nda.buyerAcceptedAt) {
      throw new ValidationError("Buyer has already accepted this NDA agreement.");
    }

    const sellerAccepted = Boolean(nda.sellerAcceptedAt);
    isNowExecuted = sellerAccepted;
    newStatus = isNowExecuted ? "EXECUTED" : "BUYER_ACCEPTED";

    await query(
      `UPDATE nda_agreements 
       SET buyer_accepted_at = CURRENT_TIMESTAMP,
           buyer_ip = $1,
           buyer_user_agent = $2,
           status = $3,
           executed_at = CASE WHEN $4 = TRUE THEN CURRENT_TIMESTAMP ELSE executed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [context?.ip || null, context?.userAgent || null, newStatus, isNowExecuted, ndaId]
    );
  } else if (isSeller) {
    if (nda.sellerAcceptedAt) {
      throw new ValidationError("Seller has already accepted this NDA agreement.");
    }

    const buyerAccepted = Boolean(nda.buyerAcceptedAt);
    isNowExecuted = buyerAccepted;
    newStatus = isNowExecuted ? "EXECUTED" : "SELLER_ACCEPTED";

    await query(
      `UPDATE nda_agreements 
       SET seller_accepted_at = CURRENT_TIMESTAMP,
           seller_ip = $1,
           seller_user_agent = $2,
           status = $3,
           executed_at = CASE WHEN $4 = TRUE THEN CURRENT_TIMESTAMP ELSE executed_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5`,
      [context?.ip || null, context?.userAgent || null, newStatus, isNowExecuted, ndaId]
    );
  }

  // Audit Log Acceptance
  await auditLog({
    actorId: user.id,
    action: "NDA_ACCEPTED",
    resourceType: "nda_agreement",
    resourceId: ndaId,
    metadata: { referenceCode: nda.referenceCode, status: newStatus },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // IF BOTH PARTIES HAVE ACCEPTED -> PROVISION SECURE DATA ROOM
  if (isNowExecuted) {
    await auditLog({
      actorId: user.id,
      action: "NDA_EXECUTED",
      resourceType: "nda_agreement",
      resourceId: ndaId,
      metadata: { referenceCode: nda.referenceCode },
    });

    // 1. Allocate VDR sequence
    const vdrSeqRes = await query<{ nextval: string }>(`SELECT nextval('vdr_ref_seq') as nextval`);
    const vdrSeq = vdrSeqRes.rows[0]?.nextval || "10001";
    const vdrRef = `VDR-${new Date().getFullYear()}-${vdrSeq}`;

    // 2. Create and Activate Data Room
    const roomRes = await query<any>(
      `INSERT INTO data_rooms (
        reference_code, opportunity_id, nda_id, seller_id, buyer_id,
        title, status, activated_at
      ) VALUES (
        $1, $2, $3, $4, $5, 'Confidential Diligence Room', 'ACTIVE', CURRENT_TIMESTAMP
      ) RETURNING id`,
      [vdrRef, nda.opportunityId, nda.id, nda.sellerId, nda.buyerId]
    );
    const dataRoomId = roomRes.rows[0].id;

    // 3. Grant Explicit Server-Side Membership
    await query(
      `INSERT INTO data_room_members (data_room_id, user_id, role, access_status)
       VALUES 
        ($1, $2, 'SELLER', 'ACTIVE'),
        ($1, $3, 'BUYER', 'ACTIVE')
       ON CONFLICT (data_room_id, user_id) DO UPDATE SET access_status = 'ACTIVE'`,
      [dataRoomId, nda.sellerId, nda.buyerId]
    );

    // 4. Audit Data Room Creation
    await auditLog({
      actorId: user.id,
      action: "DATA_ROOM_CREATED",
      resourceType: "data_room",
      resourceId: dataRoomId,
      metadata: { referenceCode: vdrRef, ndaId: nda.id },
    });

    // 5. In-App Notifications
    await createNotification({
      userId: nda.buyerId,
      type: "NDA_EXECUTED",
      title: "Bilateral NDA Executed",
      message: `Bilateral NDA (${nda.referenceCode}) has been executed by both principals. Your Secure Data Room is now active.`,
      resourceType: "data_room",
      resourceId: dataRoomId,
    });

    await createNotification({
      userId: nda.sellerId,
      type: "NDA_EXECUTED",
      title: "Bilateral NDA Executed",
      message: `Bilateral NDA (${nda.referenceCode}) has been executed by both principals. Your Secure Data Room is now active.`,
      resourceType: "data_room",
      resourceId: dataRoomId,
    });
  } else {
    // Notify counterparty that other party has accepted
    const counterpartyId = isBuyer ? nda.sellerId : nda.buyerId;
    await createNotification({
      userId: counterpartyId,
      type: "NDA_ACCEPTED",
      title: "Counterparty Accepted Bilateral NDA",
      message: `The counterparty has acknowledged and accepted NDA ${nda.referenceCode}. Your countersignature is required to execute.`,
      resourceType: "nda_agreement",
      resourceId: nda.id,
    });
  }

  const updatedRes = await query<any>(
    `SELECT n.*, dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.id = $1`,
    [ndaId]
  );
  return mapNDARecord(updatedRes.rows[0]);
}

export async function declineNDA(
  user: AuthenticatedUser,
  ndaId: string,
  input: DeclineNDAInput,
  context?: { ip?: string; userAgent?: string }
): Promise<NDARecord> {
  const res = await query<any>(`SELECT * FROM nda_agreements WHERE id = $1`, [ndaId]);
  if (res.rows.length === 0) {
    throw new NotFoundError("NDA agreement not found.");
  }

  const nda = mapNDARecord(res.rows[0]);

  if (nda.status === "EXECUTED") {
    throw new ValidationError("Cannot decline an already executed NDA agreement.");
  }
  if (nda.status === "DECLINED") {
    throw new ValidationError("NDA agreement is already declined.");
  }
  if (nda.status === "REVOKED") {
    throw new ValidationError("Cannot decline a revoked NDA agreement.");
  }

  const isBuyer = user.id === nda.buyerId;
  const isSeller = user.id === nda.sellerId;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not authorized to decline this NDA agreement.");
  }

  await query(
    `UPDATE nda_agreements 
     SET status = 'DECLINED', declined_at = CURRENT_TIMESTAMP, declined_by = $1, decline_reason = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [user.id, input.declineReason, ndaId]
  );

  // If a data room existed in pending state, revoke it
  await query(
    `UPDATE data_rooms SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = 'Associated NDA declined' WHERE nda_id = $1`,
    [ndaId]
  );

  await auditLog({
    actorId: user.id,
    action: "NDA_DECLINED",
    resourceType: "nda_agreement",
    resourceId: ndaId,
    metadata: { referenceCode: nda.referenceCode, reason: input.declineReason },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  const counterpartyId = isBuyer ? nda.sellerId : nda.buyerId;
  await createNotification({
    userId: counterpartyId,
    type: "NDA_DECLINED",
    title: "NDA Declined",
    message: `The bilateral NDA (${nda.referenceCode}) has been declined.`,
    resourceType: "nda_agreement",
    resourceId: ndaId,
  });

  const updatedRes = await query<any>(
    `SELECT n.*, dr.id as data_room_id, dr.status as data_room_status
     FROM nda_agreements n
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status IN ('PENDING_NDA', 'ACTIVE')
     WHERE n.id = $1`,
    [ndaId]
  );
  return mapNDARecord(updatedRes.rows[0]);
}

// ==========================================
// 2. SECURE DATA ROOM ACCESS & PERMISSIONS
// ==========================================

export async function getDataRoomForUser(
  user: AuthenticatedUser,
  dataRoomId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<DataRoomView> {
  const roomRes = await query<any>(
    `SELECT dr.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref, n.status as nda_status
     FROM data_rooms dr
     JOIN opportunities o ON dr.opportunity_id = o.id
     JOIN nda_agreements n ON dr.nda_id = n.id
     WHERE dr.id = $1`,
    [dataRoomId]
  );

  if (roomRes.rows.length === 0) {
    throw new NotFoundError("Data Room not found.");
  }

  const room = roomRes.rows[0];

  // 1. Data Room Status Gate
  if (room.status !== "ACTIVE") {
    throw new ForbiddenError(`Data Room is not accessible (Status: ${room.status}).`);
  }

  // 2. NDA Execution Gate: Must be fully EXECUTED
  if (room.nda_status !== "EXECUTED") {
    throw new ForbiddenError(
      "Data Room is locked. Bilateral NDA must be fully executed by both parties before accessing the room."
    );
  }

  // 3. Member Authorization Gate
  const memberRes = await query<any>(
    `SELECT role, access_status FROM data_room_members 
     WHERE data_room_id = $1 AND user_id = $2`,
    [dataRoomId, user.id]
  );

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.permissions.includes("vdr.read_all");

  if (memberRes.rows.length === 0 && !isAdmin) {
    throw new ForbiddenError("You are not an authorized member of this Data Room.");
  }

  const member = memberRes.rows[0];
  if (member && member.access_status !== "ACTIVE" && !isAdmin) {
    throw new ForbiddenError("Your access to this Data Room has been revoked or suspended.");
  }

  const userRole: DataRoomMemberRole = member?.role || (isAdmin ? "ADMIN" : "BUYER");

  // 4. Fetch Permitted Documents
  let docSql = `
    SELECT id, data_room_id, document_category, access_level, title, original_filename,
           mime_type, file_size, status, download_count, created_at
    FROM data_room_documents
    WHERE data_room_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
  `;
  const docParams: any[] = [dataRoomId];

  // Role-based document access filtering
  if (userRole === "BUYER") {
    docSql += ` AND access_level IN ('ROOM_MEMBER', 'AUTHORIZED_BUYER')`;
  } else if (userRole === "SELLER") {
    docSql += ` AND access_level IN ('ROOM_MEMBER', 'AUTHORIZED_SELLER')`;
  }

  docSql += ` ORDER BY created_at DESC`;

  const docRes = await query<any>(docSql, docParams);

  // 5. Audit Log Room Access
  await auditLog({
    actorId: user.id,
    action: "DATA_ROOM_ACCESSED",
    resourceType: "data_room",
    resourceId: dataRoomId,
    metadata: { referenceCode: room.reference_code, role: userRole },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return {
    id: room.id,
    referenceCode: room.reference_code,
    opportunityId: room.opportunity_id,
    opportunityReference: room.opp_ref,
    opportunityTitle: room.opp_title,
    ndaId: room.nda_id,
    ndaReference: room.nda_ref,
    title: room.title,
    status: room.status as DataRoomStatus,
    userRole,
    activatedAt: room.activated_at,
    expiresAt: room.expires_at,
    createdAt: room.created_at,
    documents: docRes.rows.map((d) => ({
      id: d.id,
      dataRoomId: d.data_room_id,
      documentCategory: d.document_category,
      accessLevel: d.access_level,
      title: d.title,
      originalFilename: d.original_filename,
      mimeType: d.mime_type,
      fileSize: parseInt(d.file_size, 10),
      status: d.status,
      downloadCount: d.download_count,
      createdAt: d.created_at,
    })),
  };
}

// ==========================================
// 3. CONFIDENTIAL DOCUMENT UPLOAD & STORAGE
// ==========================================

export async function uploadDataRoomDocument(
  user: AuthenticatedUser,
  dataRoomId: string,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
  },
  metadata: UploadDataRoomDocumentInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DataRoomDocumentView> {
  // 1. Data Room Status & NDA Gate
  const roomRes = await query<any>(
    `SELECT dr.*, n.status as nda_status 
     FROM data_rooms dr
     JOIN nda_agreements n ON dr.nda_id = n.id
     WHERE dr.id = $1`,
    [dataRoomId]
  );

  if (roomRes.rows.length === 0) {
    throw new NotFoundError("Data Room not found.");
  }

  const room = roomRes.rows[0];
  if (room.status !== "ACTIVE" || room.nda_status !== "EXECUTED") {
    throw new ForbiddenError("Cannot upload documents. Data Room or bilateral NDA is not active.");
  }

  // 2. Authorization: Only SELLER of room or SUPER_ADMIN may upload
  const isSeller = room.seller_id === user.id;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isSeller && !isAdmin) {
    throw new ForbiddenError("Only authorized promoters/sellers may upload documents to this Data Room.");
  }

  // 3. File Security: Size check
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file cannot be empty.");
  }

  // 4. File Security: Extension check
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG files are permitted.`
    );
  }

  // 5. File Security: Path traversal & filename sanitization
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

  // 6. File Security: Magic-byte inspection
  if (!validateMagicBytes(file.buffer, ext)) {
    throw new ValidationError("MIME spoofing detected: file contents do not match declared file extension.");
  }

  // 7. SHA-256 Checksum Calculation
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 8. Secure Storage outside web root
  const vaultDir = path.join(process.cwd(), "data", "vault", "datarooms", dataRoomId);
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });
  }

  const storageKey = path.join(vaultDir, `${crypto.randomUUID()}_${safeFilename}`);
  fs.writeFileSync(storageKey, file.buffer);

  // 9. Persist Record
  const insertRes = await query<any>(
    `INSERT INTO data_room_documents (
      data_room_id, uploaded_by, document_category, access_level,
      title, original_filename, storage_key, mime_type, file_size, checksum, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE'
    ) RETURNING *`,
    [
      dataRoomId,
      user.id,
      metadata.documentCategory,
      metadata.accessLevel || "ROOM_MEMBER",
      metadata.title,
      safeFilename,
      storageKey,
      file.mimeType,
      file.buffer.length,
      checksum,
    ]
  );

  const doc = insertRes.rows[0];

  // 10. Audit Log
  await auditLog({
    actorId: user.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "data_room_document",
    resourceId: doc.id,
    metadata: {
      dataRoomId,
      category: metadata.documentCategory,
      filename: safeFilename,
      fileSize: file.buffer.length,
      checksum,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // 11. Notify Buyer
  await createNotification({
    userId: room.buyer_id,
    type: "DOCUMENT_UPLOADED",
    title: "New Document in Data Room",
    message: `A new ${metadata.documentCategory.toLowerCase()} document ("${metadata.title}") has been uploaded to your Data Room.`,
    resourceType: "data_room",
    resourceId: dataRoomId,
  });

  return {
    id: doc.id,
    dataRoomId: doc.data_room_id,
    documentCategory: doc.document_category,
    accessLevel: doc.access_level,
    title: doc.title,
    originalFilename: doc.original_filename,
    mimeType: doc.mime_type,
    fileSize: parseInt(doc.file_size, 10),
    status: doc.status,
    downloadCount: doc.download_count,
    createdAt: doc.created_at,
  };
}

// ==========================================
// 4. SHORT-LIVED SIGNED DOWNLOAD URLS
// ==========================================

export async function generateDocumentSignedUrl(
  user: AuthenticatedUser,
  dataRoomId: string,
  documentId: string,
  expiresInSeconds = 300,
  context?: { ip?: string; userAgent?: string }
): Promise<SignedUrlResponse> {
  // 1. Rate Limiting Defense
  checkRateLimit(user.id);

  // 2. Data Room & NDA Validation
  const roomRes = await query<any>(
    `SELECT dr.*, n.status as nda_status 
     FROM data_rooms dr
     JOIN nda_agreements n ON dr.nda_id = n.id
     WHERE dr.id = $1`,
    [dataRoomId]
  );

  if (roomRes.rows.length === 0) {
    throw new NotFoundError("Data Room not found.");
  }

  const room = roomRes.rows[0];
  if (room.status !== "ACTIVE" || room.nda_status !== "EXECUTED") {
    throw new ForbiddenError("Cannot generate download URL. Data Room or bilateral NDA is not active.");
  }

  // 3. User Membership Check
  const memberRes = await query<any>(
    `SELECT role, access_status FROM data_room_members WHERE data_room_id = $1 AND user_id = $2`,
    [dataRoomId, user.id]
  );

  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.permissions.includes("vdr.read_all");
  if (memberRes.rows.length === 0 && !isAdmin) {
    throw new ForbiddenError("You are not authorized to download files from this Data Room.");
  }

  const member = memberRes.rows[0];
  if (member && member.access_status !== "ACTIVE" && !isAdmin) {
    throw new ForbiddenError("Your access to this Data Room has been revoked.");
  }

  const role: DataRoomMemberRole = member?.role || "BUYER";

  // 4. Document Check & Access Level Validation
  const docRes = await query<any>(
    `SELECT id, access_level, status FROM data_room_documents 
     WHERE id = $1 AND data_room_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [documentId, dataRoomId]
  );

  if (docRes.rows.length === 0) {
    throw new NotFoundError("Document not found in this Data Room.");
  }

  const doc = docRes.rows[0];
  if (role === "BUYER" && doc.access_level === "AUTHORIZED_SELLER") {
    throw new ForbiddenError("You do not have permission to download this document.");
  }
  if (role === "SELLER" && doc.access_level === "AUTHORIZED_BUYER") {
    throw new ForbiddenError("You do not have permission to download this document.");
  }

  // 5. Generate Cryptographic Signed Token
  const tokenData = createSignedDownloadToken(documentId, dataRoomId, user.id, expiresInSeconds);

  // 6. Audit Signed URL Issuance
  await auditLog({
    actorId: user.id,
    action: "SIGNED_URL_ISSUED",
    resourceType: "data_room_document",
    resourceId: documentId,
    metadata: {
      dataRoomId,
      expiresAt: new Date(tokenData.expiresAt).toISOString(),
      expiresInSeconds: tokenData.expiresInSeconds,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  const downloadUrl = `/api/v1/data-rooms/${dataRoomId}/documents/${documentId}/download?token=${tokenData.token}&expires=${tokenData.expiresAt}&u=${user.id}`;

  return {
    documentId,
    downloadUrl,
    expiresAt: new Date(tokenData.expiresAt).toISOString(),
    expiresInSeconds: tokenData.expiresInSeconds,
  };
}

export async function downloadDataRoomDocument(
  token: string,
  expiresAt: number,
  userId: string,
  dataRoomId: string,
  documentId: string
): Promise<{ buffer: Buffer; filename: string; mimeType: string; fileSize: number }> {
  // 1. Verify Cryptographic Signature & Expiry
  const isValid = verifySignedDownloadToken(token, documentId, dataRoomId, userId, expiresAt);
  if (!isValid) {
    throw new ForbiddenError("Invalid, expired, or tampered download token.");
  }

  // 2. Re-verify Data Room Status & NDA state in Database (Defense-in-depth)
  const roomRes = await query<any>(
    `SELECT dr.status as room_status, n.status as nda_status
     FROM data_rooms dr
     JOIN nda_agreements n ON dr.nda_id = n.id
     WHERE dr.id = $1`,
    [dataRoomId]
  );

  if (
    roomRes.rows.length === 0 ||
    roomRes.rows[0].room_status !== "ACTIVE" ||
    roomRes.rows[0].nda_status !== "EXECUTED"
  ) {
    throw new ForbiddenError("Data Room or bilateral NDA is not currently active.");
  }

  // 3. Re-verify Membership
  const memberRes = await query<any>(
    `SELECT access_status FROM data_room_members WHERE data_room_id = $1 AND user_id = $2`,
    [dataRoomId, userId]
  );
  if (memberRes.rows.length === 0 || memberRes.rows[0].access_status !== "ACTIVE") {
    throw new ForbiddenError("User is not an active member of this Data Room.");
  }

  // 4. Query Document
  const docRes = await query<any>(
    `SELECT * FROM data_room_documents 
     WHERE id = $1 AND data_room_id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
    [documentId, dataRoomId]
  );

  if (docRes.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = docRes.rows[0];

  // 5. Read Binary File
  if (!fs.existsSync(doc.storage_key)) {
    throw new NotFoundError("Document binary not found on storage vault.");
  }

  const buffer = fs.readFileSync(doc.storage_key);

  // 6. Increment download counter & record audit log
  await query(`UPDATE data_room_documents SET download_count = download_count + 1 WHERE id = $1`, [
    documentId,
  ]);

  await auditLog({
    actorId: userId,
    action: "DOCUMENT_DOWNLOADED",
    resourceType: "data_room_document",
    resourceId: documentId,
    metadata: {
      dataRoomId,
      filename: doc.original_filename,
      fileSize: buffer.length,
    },
  });

  return {
    buffer,
    filename: doc.original_filename,
    mimeType: doc.mime_type,
    fileSize: buffer.length,
  };
}

// ==========================================
// 5. DOCUMENT DELETION & REVOCATION
// ==========================================

export async function deleteDataRoomDocument(
  user: AuthenticatedUser,
  dataRoomId: string,
  documentId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const roomRes = await query<any>(`SELECT seller_id FROM data_rooms WHERE id = $1`, [dataRoomId]);
  if (roomRes.rows.length === 0) {
    throw new NotFoundError("Data Room not found.");
  }

  const isSeller = roomRes.rows[0].seller_id === user.id;
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  if (!isSeller && !isAdmin) {
    throw new ForbiddenError("You are not authorized to delete documents from this Data Room.");
  }

  const docRes = await query<any>(
    `SELECT id, original_filename FROM data_room_documents WHERE id = $1 AND data_room_id = $2`,
    [documentId, dataRoomId]
  );

  if (docRes.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  await query(
    `UPDATE data_room_documents 
     SET status = 'DELETED', deleted_at = CURRENT_TIMESTAMP, deleted_by = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [user.id, documentId]
  );

  await auditLog({
    actorId: user.id,
    action: "DOCUMENT_DELETED",
    resourceType: "data_room_document",
    resourceId: documentId,
    metadata: { dataRoomId, filename: docRes.rows[0].original_filename },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

export async function revokeDataRoom(
  adminUser: AuthenticatedUser,
  dataRoomId: string,
  input: RevokeNDAInput,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const isAdmin = adminUser.roles.includes("SUPER_ADMIN") || adminUser.permissions.includes("vdr.manage");
  if (!isAdmin) {
    throw new ForbiddenError("Only administrative officers may revoke Data Room access.");
  }

  const roomRes = await query<any>(`SELECT id, nda_id, reference_code FROM data_rooms WHERE id = $1`, [
    dataRoomId,
  ]);
  if (roomRes.rows.length === 0) {
    throw new NotFoundError("Data Room not found.");
  }

  const room = roomRes.rows[0];

  // 1. Revoke Data Room
  await query(
    `UPDATE data_rooms 
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = $1, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $2`,
    [input.revokeReason, dataRoomId]
  );

  // 2. Revoke NDA
  await query(
    `UPDATE nda_agreements 
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $1, revoke_reason = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [adminUser.id, input.revokeReason, room.nda_id]
  );

  // 3. Revoke Memberships
  await query(
    `UPDATE data_room_members 
     SET access_status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revocation_reason = $1 
     WHERE data_room_id = $2`,
    [input.revokeReason, dataRoomId]
  );

  // 4. Audit Log
  await auditLog({
    actorId: adminUser.id,
    action: "DATA_ROOM_REVOKED",
    resourceType: "data_room",
    resourceId: dataRoomId,
    metadata: { referenceCode: room.reference_code, reason: input.revokeReason },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

function mapNDARecord(row: any): NDARecord {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    eoiId: row.eoi_id,
    buyerId: row.buyer_id,
    sellerId: row.seller_id,
    ndaVersion: row.nda_version,
    documentReference: row.document_reference,
    status: row.status as NDAStatus,
    createdBy: row.created_by,
    buyerViewedAt: row.buyer_viewed_at,
    sellerViewedAt: row.seller_viewed_at,
    buyerAcceptedAt: row.buyer_accepted_at,
    buyerIp: row.buyer_ip,
    buyerUserAgent: row.buyer_user_agent,
    sellerAcceptedAt: row.seller_accepted_at,
    sellerIp: row.seller_ip,
    sellerUserAgent: row.seller_user_agent,
    executedAt: row.executed_at,
    declinedAt: row.declined_at,
    declinedBy: row.declined_by,
    declineReason: row.decline_reason,
    revokedAt: row.revoked_at,
    revokedBy: row.revoked_by,
    revokeReason: row.revoke_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    dataRoomId: row.data_room_id || null,
    dataRoomStatus: row.data_room_status || null,
  };
}
