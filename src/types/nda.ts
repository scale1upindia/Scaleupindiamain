// Scale-up India — Phase 8: Bilateral NDA & Secure Data Room Domain Types
// Path: src/types/nda.ts

export type NDAStatus =
  | "NDA_DRAFT"
  | "NDA_SENT"
  | "BUYER_VIEWED"
  | "BUYER_ACCEPTED"
  | "SELLER_ACCEPTED"
  | "EXECUTED"
  | "DECLINED"
  | "EXPIRED"
  | "REVOKED";

export type DataRoomStatus =
  | "PENDING_NDA"
  | "ACTIVE"
  | "SUSPENDED"
  | "REVOKED"
  | "EXPIRED";

export type DataRoomMemberRole = "BUYER" | "SELLER" | "ADMIN";

export type DataRoomMemberAccess = "ACTIVE" | "REVOKED" | "SUSPENDED";

export type DataRoomDocumentCategory =
  | "FINANCIAL"
  | "TAX"
  | "LEGAL"
  | "CORPORATE"
  | "OPERATIONAL"
  | "COMMERCIAL"
  | "HR"
  | "TECHNICAL"
  | "OTHER";

export type DataRoomDocumentAccessLevel =
  | "ROOM_MEMBER"
  | "AUTHORIZED_BUYER"
  | "AUTHORIZED_SELLER"
  | "ADMIN";

export interface NDARecord {
  id: string;
  referenceCode: string;
  opportunityId: string;
  eoiId: string;
  buyerId: string;
  sellerId: string;
  ndaVersion: string;
  documentReference: string;
  status: NDAStatus;
  createdBy: string;
  buyerViewedAt: string | null;
  sellerViewedAt: string | null;
  buyerAcceptedAt: string | null;
  buyerIp: string | null;
  buyerUserAgent: string | null;
  sellerAcceptedAt: string | null;
  sellerIp: string | null;
  sellerUserAgent: string | null;
  executedAt: string | null;
  declinedAt: string | null;
  declinedBy: string | null;
  declineReason: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revokeReason: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  dataRoomId?: string | null;
  dataRoomStatus?: string | null;
}

export interface BuyerNDAView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  eoiId: string;
  eoiReference: string;
  ndaVersion: string;
  documentReference: string;
  status: NDAStatus;
  buyerAcceptedAt: string | null;
  sellerAcceptedAt: string | null;
  executedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  expiresAt: string;
  createdAt: string;
  dataRoomId?: string | null;
  dataRoomStatus?: DataRoomStatus | null;
}

export interface SellerNDAView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  eoiId: string;
  eoiReference: string;
  buyerEntityType: string;
  buyerLocation: string;
  ndaVersion: string;
  documentReference: string;
  status: NDAStatus;
  buyerAcceptedAt: string | null;
  sellerAcceptedAt: string | null;
  executedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  expiresAt: string;
  createdAt: string;
  dataRoomId?: string | null;
  dataRoomStatus?: DataRoomStatus | null;
}

export interface DataRoomRecord {
  id: string;
  referenceCode: string;
  opportunityId: string;
  ndaId: string;
  sellerId: string;
  buyerId: string;
  title: string;
  status: DataRoomStatus;
  activatedAt: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  dataRoomId?: string | null;
  dataRoomStatus?: string | null;
}

export interface DataRoomMemberRecord {
  id: string;
  dataRoomId: string;
  userId: string;
  role: DataRoomMemberRole;
  accessStatus: DataRoomMemberAccess;
  grantedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  expiresAt: string | null;
}

export interface DataRoomDocumentRecord {
  id: string;
  dataRoomId: string;
  uploadedBy: string;
  documentCategory: DataRoomDocumentCategory;
  accessLevel: DataRoomDocumentAccessLevel;
  title: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  checksum: string;
  status: "ACTIVE" | "DELETED" | "REVOKED";
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedBy: string | null;
}

export interface DataRoomDocumentView {
  id: string;
  dataRoomId: string;
  documentCategory: DataRoomDocumentCategory;
  accessLevel: DataRoomDocumentAccessLevel;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: "ACTIVE" | "DELETED" | "REVOKED";
  downloadCount: number;
  createdAt: string;
}

export interface DataRoomView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  ndaId: string;
  ndaReference: string;
  title: string;
  status: DataRoomStatus;
  userRole: DataRoomMemberRole;
  documents: DataRoomDocumentView[];
  activatedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface SignedUrlResponse {
  documentId: string;
  downloadUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
}
