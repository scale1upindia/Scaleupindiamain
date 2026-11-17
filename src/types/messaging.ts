// Scale-up India — Phase 9: Secure Deal Communication Types
// Path: src/types/messaging.ts

export type DealConversationStatus = "ACTIVE" | "CLOSED" | "REVOKED";
export type DealParticipantRole = "BUYER" | "SELLER" | "ADMIN";
export type DealParticipantStatus = "ACTIVE" | "MUTED" | "REVOKED";
export type DealMessageStatus = "SENT" | "SOFT_DELETED";

export interface DealConversationRecord {
  id: string;
  referenceCode: string;
  opportunityId: string;
  eoiId: string;
  ndaId: string;
  dataRoomId?: string | null;
  buyerId: string;
  sellerId: string;
  title: string;
  status: DealConversationStatus;
  closedAt?: string | null;
  closedBy?: string | null;
  closeReason?: string | null;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealConversationParticipantRecord {
  id: string;
  conversationId: string;
  userId: string;
  role: DealParticipantRole;
  status: DealParticipantStatus;
  lastReadMessageId?: string | null;
  lastReadAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealMessageRecord {
  id: string;
  conversationId: string;
  senderUserId: string;
  content: string;
  status: DealMessageStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
}

/**
 * Safe, progressive DTO for listing deal conversations
 * Never leaks raw promoter personal details, tax numbers, or buyer-private mandate data
 */
export interface DealConversationView {
  id: string;
  referenceCode: string;
  opportunityId: string;
  opportunityReference: string;
  opportunityTitle: string;
  ndaId: string;
  ndaReference: string;
  dataRoomId?: string | null;
  title: string;
  status: DealConversationStatus;
  userRole: DealParticipantRole;
  counterpartyRole: DealParticipantRole;
  counterpartyLabel: string;
  unreadCount: number;
  lastMessageSnippet?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  closedAt?: string | null;
  closeReason?: string | null;
  revokedAt?: string | null;
}

/**
 * Safe, sanitized message view for deal communication
 */
export interface DealMessageView {
  id: string;
  conversationId: string;
  senderRole: DealParticipantRole;
  isMine: boolean;
  content: string;
  status: DealMessageStatus;
  createdAt: string;
  deletedAt?: string | null;
}

/**
 * Deterministic cursor-based pagination response for deal message history
 */
export interface PaginatedMessagesResponse {
  messages: DealMessageView[];
  nextCursor?: string | null;
  hasMore: boolean;
  total: number;
}
