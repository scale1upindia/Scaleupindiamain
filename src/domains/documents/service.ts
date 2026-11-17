import fs from "fs";
import path from "path";
import crypto from "crypto";
import { query, transaction } from "@/lib/db";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { SellerDocumentRecord, SellerDocumentType } from "@/types/seller";
import { BuyerDocumentRecord, BuyerDocumentType } from "@/types/buyer";
import { AuthenticatedUser } from "@/types/auth";
import { auditLog } from "@/domains/audit/logger";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_EXTENSIONS = new Set([".pdf", ".png", ".jpg", ".jpeg"]);

// Magic byte signatures
const MAGIC_BYTES = {
  PDF: [0x25, 0x50, 0x44, 0x46], // %PDF
  PNG: [0x89, 0x50, 0x4e, 0x47], // .PNG
  JPEG: [0xff, 0xd8, 0xff],       // JPEG SOI
};

/**
 * Validates binary magic bytes against declared MIME type and extension
 */
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

/**
 * Stores a document in private vault with checksum and magic-byte inspection
 */
export async function uploadSellerDocument(
  sellerProfileId: string,
  user: AuthenticatedUser,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
    documentType: SellerDocumentType;
  },
  context?: { ip?: string; userAgent?: string }
): Promise<SellerDocumentRecord> {
  // 1. Validate file size
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }

  // 2. Validate file extension
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG documents are permitted.`
    );
  }

  // 3. Prevent path traversal and sanitize filename
  const baseFilename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (baseFilename.includes("..") || baseFilename.startsWith(".")) {
    throw new ValidationError("Malicious or invalid filename detected.");
  }

  // 4. Inspect magic bytes
  const isMagicValid = validateMagicBytes(file.buffer, ext);
  if (!isMagicValid) {
    throw new ValidationError(
      "File content does not match its declared format. Potential MIME-spoofing detected."
    );
  }

  // 5. Compute SHA-256 hash
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 6. Generate safe internal storage path
  const storageDir = path.resolve(process.cwd(), "data/vault/sellers", sellerProfileId);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const safeStorageKey = `vault/sellers/${sellerProfileId}/${file.documentType}_${crypto.randomUUID()}${ext}`;
  const diskPath = path.resolve(process.cwd(), "data", safeStorageKey);

  // Ensure target folder exists
  const targetDir = path.dirname(diskPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Write file to private disk
  fs.writeFileSync(diskPath, file.buffer);

  // 7. Insert metadata into database
  const res = await query<any>(
    `INSERT INTO seller_documents (
      seller_profile_id, owner_id, document_type, original_filename,
      storage_key, mime_type, file_size_bytes, checksum_sha256, verification_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
    RETURNING *`,
    [
      sellerProfileId,
      user.id,
      file.documentType,
      baseFilename,
      safeStorageKey,
      file.mimeType,
      file.buffer.length,
      checksum,
    ]
  );

  const doc = res.rows[0];

  await auditLog({
    actorId: user.id,
    action: "DOCUMENT_UPLOADED",
    resourceType: "seller_documents",
    resourceId: doc.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      documentType: file.documentType,
      filename: baseFilename,
      sizeBytes: file.buffer.length,
      checksum,
    },
  });

  return {
    id: doc.id,
    sellerProfileId: doc.seller_profile_id,
    ownerId: doc.owner_id,
    documentType: doc.document_type,
    originalFilename: doc.original_filename,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    fileSizeBytes: Number(doc.file_size_bytes),
    checksumSha256: doc.checksum_sha256,
    verificationStatus: doc.verification_status,
    rejectionReason: doc.rejection_reason,
    reviewedBy: doc.reviewed_by,
    reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at) : null,
    createdAt: new Date(doc.created_at),
    updatedAt: new Date(doc.updated_at),
  };
}

/**
 * Anti-IDOR Document Download Stream / Inspection:
 * Authorizes user (must be owner OR admin with 'documents.read_all' / 'sellers.read')
 */
export async function getDocumentForDownload(
  documentId: string,
  user: AuthenticatedUser
): Promise<{ record: SellerDocumentRecord; buffer: Buffer }> {
  const res = await query<any>(
    `SELECT * FROM seller_documents WHERE id = $1 AND deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];

  // ANTI-IDOR AUTHORIZATION CHECK:
  const isOwner = doc.owner_id === user.id;
  const isAuthorizedAdmin =
    user.roles.includes("SUPER_ADMIN") ||
    user.permissions.includes("documents.read_all") ||
    user.permissions.includes("sellers.read");

  if (!isOwner && !isAuthorizedAdmin) {
    throw new ForbiddenError("You are not authorized to view or download this document.");
  }

  const diskPath = path.resolve(process.cwd(), "data", doc.storage_key);
  if (!fs.existsSync(diskPath)) {
    throw new NotFoundError("Document binary file not found on storage.");
  }

  const buffer = fs.readFileSync(diskPath);

  return {
    record: {
      id: doc.id,
      sellerProfileId: doc.seller_profile_id,
      ownerId: doc.owner_id,
      documentType: doc.document_type,
      originalFilename: doc.original_filename,
      storageKey: doc.storage_key,
      mimeType: doc.mime_type,
      fileSizeBytes: Number(doc.file_size_bytes),
      checksumSha256: doc.checksum_sha256,
      verificationStatus: doc.verification_status,
      rejectionReason: doc.rejection_reason,
      reviewedBy: doc.reviewed_by,
      reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at) : null,
      createdAt: new Date(doc.created_at),
      updatedAt: new Date(doc.updated_at),
    },
    buffer,
  };
}

/**
 * Soft deletes a document (owner only, prior to profile verification)
 */
export async function deleteSellerDocument(
  documentId: string,
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const res = await query<any>(
    `SELECT sd.*, sp.onboarding_status 
     FROM seller_documents sd
     JOIN seller_profiles sp ON sd.seller_profile_id = sp.id
     WHERE sd.id = $1 AND sd.deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];

  // Anti-IDOR ownership check
  if (doc.owner_id !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot delete documents belonging to another user.");
  }

  // Once submitted or verified, documents cannot be deleted arbitrarily by seller
  if (doc.onboarding_status === "VERIFIED" && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("Verified dossier documents cannot be deleted.");
  }

  await query(`UPDATE seller_documents SET deleted_at = NOW() WHERE id = $1`, [documentId]);

  await auditLog({
    actorId: user.id,
    action: "DOCUMENT_DELETED",
    resourceType: "seller_documents",
    resourceId: documentId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Stores a buyer/investor document in private vault with checksum and magic-byte inspection
 */
export async function uploadBuyerDocument(
  buyerProfileId: string,
  user: AuthenticatedUser,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
    documentType: BuyerDocumentType;
    mandateId?: string | null;
  },
  context?: { ip?: string; userAgent?: string }
): Promise<BuyerDocumentRecord> {
  // 1. Validate file size
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }

  // 2. Validate file extension
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG documents are permitted.`
    );
  }

  // 3. Prevent path traversal and sanitize filename
  const baseFilename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (baseFilename.includes("..") || baseFilename.startsWith(".")) {
    throw new ValidationError("Malicious or invalid filename detected.");
  }

  // 4. Inspect magic bytes
  const isMagicValid = validateMagicBytes(file.buffer, ext);
  if (!isMagicValid) {
    throw new ValidationError(
      "File content does not match its declared format. Potential MIME-spoofing detected."
    );
  }

  // 5. Compute SHA-256 hash
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 6. Generate safe internal storage path
  const safeStorageKey = `vault/buyers/${buyerProfileId}/${file.documentType}_${crypto.randomUUID()}${ext}`;
  const diskPath = path.resolve(process.cwd(), "data", safeStorageKey);

  const targetDir = path.dirname(diskPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(diskPath, file.buffer);

  // 7. Insert metadata into database
  const res = await query<any>(
    `INSERT INTO buyer_documents (
      buyer_profile_id, owner_id, mandate_id, document_type, original_filename,
      storage_key, mime_type, file_size_bytes, checksum_sha256, verification_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
    RETURNING *`,
    [
      buyerProfileId,
      user.id,
      file.mandateId || null,
      file.documentType,
      baseFilename,
      safeStorageKey,
      file.mimeType,
      file.buffer.length,
      checksum,
    ]
  );

  const doc = res.rows[0];

  await auditLog({
    actorId: user.id,
    action: "BUYER_DOCUMENT_UPLOADED",
    resourceType: "buyer_documents",
    resourceId: doc.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      documentType: file.documentType,
      filename: baseFilename,
      sizeBytes: file.buffer.length,
      checksum,
    },
  });

  return {
    id: doc.id,
    buyerProfileId: doc.buyer_profile_id,
    ownerId: doc.owner_id,
    mandateId: doc.mandate_id,
    documentType: doc.document_type,
    originalFilename: doc.original_filename,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    fileSizeBytes: Number(doc.file_size_bytes),
    checksumSha256: doc.checksum_sha256,
    verificationStatus: doc.verification_status,
    rejectionReason: doc.rejection_reason,
    reviewedBy: doc.reviewed_by,
    reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at) : null,
    createdAt: new Date(doc.created_at),
    updatedAt: new Date(doc.updated_at),
  };
}

/**
 * Anti-IDOR Buyer Document Download Stream
 */
export async function getBuyerDocumentForDownload(
  documentId: string,
  user: AuthenticatedUser
): Promise<{ record: BuyerDocumentRecord; buffer: Buffer }> {
  const res = await query<any>(
    `SELECT * FROM buyer_documents WHERE id = $1 AND deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];

  const isOwner = doc.owner_id === user.id;
  const isAuthorizedAdmin =
    user.roles.includes("SUPER_ADMIN") ||
    user.permissions.includes("documents.read_all") ||
    user.permissions.includes("buyers.read");

  if (!isOwner && !isAuthorizedAdmin) {
    throw new ForbiddenError("You are not authorized to view or download this document.");
  }

  const diskPath = path.resolve(process.cwd(), "data", doc.storage_key);
  if (!fs.existsSync(diskPath)) {
    throw new NotFoundError("Document binary file not found on storage.");
  }

  const buffer = fs.readFileSync(diskPath);

  return {
    record: {
      id: doc.id,
      buyerProfileId: doc.buyer_profile_id,
      ownerId: doc.owner_id,
      mandateId: doc.mandate_id,
      documentType: doc.document_type,
      originalFilename: doc.original_filename,
      storageKey: doc.storage_key,
      mimeType: doc.mime_type,
      fileSizeBytes: Number(doc.file_size_bytes),
      checksumSha256: doc.checksum_sha256,
      verificationStatus: doc.verification_status,
      rejectionReason: doc.rejection_reason,
      reviewedBy: doc.reviewed_by,
      reviewedAt: doc.reviewed_at ? new Date(doc.reviewed_at) : null,
      createdAt: new Date(doc.created_at),
      updatedAt: new Date(doc.updated_at),
    },
    buffer,
  };
}

/**
 * Soft deletes a buyer document (owner only, prior to profile verification)
 */
export async function deleteBuyerDocument(
  documentId: string,
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const res = await query<any>(
    `SELECT bd.*, bp.onboarding_status 
     FROM buyer_documents bd
     JOIN buyer_profiles bp ON bd.buyer_profile_id = bp.id
     WHERE bd.id = $1 AND bd.deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];

  if (doc.owner_id !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot delete documents belonging to another user.");
  }

  if (doc.onboarding_status === "VERIFIED" && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("Verified dossier documents cannot be deleted.");
  }

  await query(`UPDATE buyer_documents SET deleted_at = NOW() WHERE id = $1`, [documentId]);

  await auditLog({
    actorId: user.id,
    action: "BUYER_DOCUMENT_DELETED",
    resourceType: "buyer_documents",
    resourceId: documentId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Uploads an Opportunity document into the private vault with magic-byte check and checksum
 */
export async function uploadOpportunityDocument(
  opportunityId: string,
  user: AuthenticatedUser,
  file: {
    originalFilename: string;
    mimeType: string;
    buffer: Buffer;
    documentType: string;
    accessTier?: number;
  },
  context?: { ip?: string; userAgent?: string }
): Promise<any> {
  // 1. Verify opportunity ownership
  const oppRes = await query<any>(
    `SELECT id, seller_profile_id, user_id, status FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (oppRes.rows.length === 0) {
    throw new NotFoundError("Opportunity not found.");
  }

  const opp = oppRes.rows[0];
  if (opp.user_id !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot upload documents to an opportunity belonging to another seller.");
  }

  // 2. Validate file size
  if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError("File size exceeds maximum permitted limit of 15MB.");
  }
  if (file.buffer.length === 0) {
    throw new ValidationError("Uploaded file is empty.");
  }

  // 3. Validate file extension
  const ext = path.extname(file.originalFilename).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `Disallowed file type (${ext}). Only PDF, PNG, and JPEG documents are permitted.`
    );
  }

  // 4. Prevent path traversal and sanitize filename
  const baseFilename = path.basename(file.originalFilename).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (baseFilename.includes("..") || baseFilename.startsWith(".")) {
    throw new ValidationError("Malicious or invalid filename detected.");
  }

  // 5. Inspect magic bytes
  const isMagicValid = validateMagicBytes(file.buffer, ext);
  if (!isMagicValid) {
    throw new ValidationError(
      "File content does not match its declared format. Potential MIME-spoofing detected."
    );
  }

  // 6. Compute SHA-256 hash
  const checksum = crypto.createHash("sha256").update(file.buffer).digest("hex");

  // 7. Generate safe internal storage path
  const safeStorageKey = `vault/opportunities/${opportunityId}/${file.documentType}_${crypto.randomUUID()}${ext}`;
  const diskPath = path.resolve(process.cwd(), "data", safeStorageKey);

  const targetDir = path.dirname(diskPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(diskPath, file.buffer);

  // 8. Insert metadata into database
  const res = await query<any>(
    `INSERT INTO opportunity_documents (
      opportunity_id, seller_profile_id, owner_id, document_type,
      access_tier, original_filename, storage_key, mime_type, file_size_bytes, checksum_sha256
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      opportunityId,
      opp.seller_profile_id,
      user.id,
      file.documentType,
      file.accessTier || 2,
      baseFilename,
      safeStorageKey,
      file.mimeType,
      file.buffer.length,
      checksum,
    ]
  );

  const doc = res.rows[0];

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_DOCUMENT_UPLOADED",
    resourceType: "opportunity_documents",
    resourceId: doc.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      opportunityId,
      documentType: file.documentType,
      filename: baseFilename,
      sizeBytes: file.buffer.length,
      checksum,
    },
  });

  return {
    id: doc.id,
    opportunityId: doc.opportunity_id,
    sellerProfileId: doc.seller_profile_id,
    ownerId: doc.owner_id,
    documentType: doc.document_type,
    accessTier: Number(doc.access_tier),
    originalFilename: doc.original_filename,
    storageKey: doc.storage_key,
    mimeType: doc.mime_type,
    fileSizeBytes: Number(doc.file_size_bytes),
    checksumSha256: doc.checksum_sha256,
    verificationStatus: doc.verification_status,
    createdAt: new Date(doc.created_at),
    updatedAt: new Date(doc.updated_at),
  };
}

/**
 * Anti-IDOR Opportunity Document Download Stream
 */
export async function getOpportunityDocumentForDownload(
  documentId: string,
  user: AuthenticatedUser
): Promise<{ record: any; buffer: Buffer }> {
  const res = await query<any>(
    `SELECT od.*, o.user_id as seller_user_id, o.status as opportunity_status
     FROM opportunity_documents od
     JOIN opportunities o ON od.opportunity_id = o.id
     WHERE od.id = $1 AND od.deleted_at IS NULL AND o.deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];
  const isOwner = doc.owner_id === user.id;
  const isAuthorizedAdmin =
    user.roles.includes("SUPER_ADMIN") ||
    user.permissions.includes("opportunities.read_all") ||
    user.permissions.includes("documents.read_all");

  // Check if buyer has an explicit Tier grant for this opportunity
  let isBuyerTierAuthorized = false;
  if (!isOwner && !isAuthorizedAdmin) {
    const grantRes = await query<any>(
      `SELECT id FROM opportunity_access_grants 
       WHERE opportunity_id = $1 AND buyer_user_id = $2 AND granted_tier >= $3 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [doc.opportunity_id, user.id, doc.access_tier]
    );
    isBuyerTierAuthorized = grantRes.rows.length > 0;
  }

  if (!isOwner && !isAuthorizedAdmin && !isBuyerTierAuthorized) {
    throw new ForbiddenError("You are not authorized to download this confidential opportunity document.");
  }

  const diskPath = path.resolve(process.cwd(), "data", doc.storage_key);
  if (!fs.existsSync(diskPath)) {
    throw new NotFoundError("Document binary file not found on storage.");
  }

  const buffer = fs.readFileSync(diskPath);

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_DOCUMENT_ACCESSED",
    resourceType: "opportunity_documents",
    resourceId: documentId,
    metadata: { opportunityId: doc.opportunity_id, documentType: doc.document_type },
  });

  return {
    record: {
      id: doc.id,
      opportunityId: doc.opportunity_id,
      sellerProfileId: doc.seller_profile_id,
      ownerId: doc.owner_id,
      documentType: doc.document_type,
      accessTier: Number(doc.access_tier),
      originalFilename: doc.original_filename,
      storageKey: doc.storage_key,
      mimeType: doc.mime_type,
      fileSizeBytes: Number(doc.file_size_bytes),
      checksumSha256: doc.checksum_sha256,
      verificationStatus: doc.verification_status,
      createdAt: new Date(doc.created_at),
      updatedAt: new Date(doc.updated_at),
    },
    buffer,
  };
}

/**
 * Soft deletes an opportunity document (Owner seller only)
 */
export async function deleteOpportunityDocument(
  documentId: string,
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const res = await query<any>(
    `SELECT od.*, o.status as opportunity_status
     FROM opportunity_documents od
     JOIN opportunities o ON od.opportunity_id = o.id
     WHERE od.id = $1 AND od.deleted_at IS NULL`,
    [documentId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Document not found.");
  }

  const doc = res.rows[0];

  if (doc.owner_id !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot delete an opportunity document belonging to another user.");
  }

  if (doc.opportunity_status === "PUBLISHED" && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("Published opportunity documents cannot be deleted directly.");
  }

  await query(`UPDATE opportunity_documents SET deleted_at = NOW() WHERE id = $1`, [documentId]);

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_DOCUMENT_DELETED",
    resourceType: "opportunity_documents",
    resourceId: documentId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

