// Scale-up India — Phase 9: Secure Deal Communication Domain Service
// Path: src/domains/messaging/service.ts

import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import {
  DealConversationStatus,
  DealParticipantRole,
  DealConversationRecord,
  DealConversationParticipantRecord,
  DealMessageRecord,
  DealConversationView,
  DealMessageView,
  PaginatedMessagesResponse,
} from "@/types/messaging";
import { AuthenticatedUser } from "@/types/auth";
import {
  CreateDealMessageInput,
  InitiateDealConversationInput,
  CloseDealConversationInput,
  RevokeDealConversationInput,
  GetMessagesQueryInput,
} from "@/schemas/messaging";
import { auditLog } from "@/domains/audit/logger";
import { createNotification } from "@/domains/notifications/service";

// Rate limiting sliding window: userId -> timestamps[]
const messageRateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_MESSAGES_PER_MINUTE = 30;

function checkMessageRateLimit(userId: string): void {
  const now = Date.now();
  const timestamps = messageRateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (validTimestamps.length >= MAX_MESSAGES_PER_MINUTE) {
    throw new ValidationError(
      "Message rate limit exceeded. Please wait a moment before sending more messages."
    );
  }

  validTimestamps.push(now);
  messageRateLimitMap.set(userId, validTimestamps);
}

// Reset helper for testing rate limits
export function resetMessageRateLimits(): void {
  messageRateLimitMap.clear();
}

/**
 * 1. INITIATE OR RESOLVE DEAL CONVERSATION
 * Precondition: Bilateral NDA must be fully EXECUTED and not REVOKED.
 */
export async function initiateDealConversation(
  initiator: AuthenticatedUser,
  opportunityId: string,
  input: InitiateDealConversationInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealConversationView> {
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
    `SELECT n.*, o.reference_code as opp_ref, o.title as opp_title, dr.id as active_room_id
     FROM nda_agreements n
     JOIN opportunities o ON n.opportunity_id = o.id
     LEFT JOIN data_rooms dr ON dr.nda_id = n.id AND dr.status = 'ACTIVE'
     WHERE n.id = $1`,
    [input.ndaId]
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
      `Cannot initiate deal discussion. Bilateral NDA must be fully EXECUTED (Current status: ${nda.status}).`
    );
  }

  // Anti-IDOR Authorization Check: Initiator must be the buyer or seller of the bilateral NDA
  const isBuyer = initiator.id === nda.buyer_id;
  const isSeller = initiator.id === nda.seller_id;
  const isAdmin = initiator.roles.includes("SUPER_ADMIN");

  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError("You are not an authorized principal to this deal transaction.");
  }

  // 3. Check for existing conversation for this NDA
  const existingConvRes = await query<any>(
    `SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref
     FROM deal_conversations c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN nda_agreements n ON c.nda_id = n.id
     WHERE c.nda_id = $1 AND c.status IN ('ACTIVE', 'CLOSED')`,
    [input.ndaId]
  );

  if (existingConvRes.rows.length > 0) {
    return mapDealConversationView(existingConvRes.rows[0], initiator.id);
  }

  // 4. Allocate reference code: CONV-YYYY-seq
  const seqRes = await query<{ nextval: string }>(`SELECT nextval('conv_ref_seq') as nextval`);
  const seqVal = seqRes.rows[0]?.nextval || "10001";
  const referenceCode = `CONV-${new Date().getFullYear()}-${seqVal}`;

  const title = input.title || `Deal Discussion: ${nda.opp_title}`;

  // 5. Transactionally create conversation and participants
  const result = await transaction(async (tx) => {
    const convRes = await tx.query<any>(
      `INSERT INTO deal_conversations (
        reference_code, opportunity_id, eoi_id, nda_id, data_room_id,
        buyer_id, seller_id, title, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
      RETURNING *`,
      [
        referenceCode,
        opportunityId,
        nda.eoi_id,
        nda.id,
        nda.active_room_id || null,
        nda.buyer_id,
        nda.seller_id,
        title,
      ]
    );

    const conv = convRes.rows[0];

    // Explicit server-controlled participant registration
    await tx.query(
      `INSERT INTO deal_conversation_participants (conversation_id, user_id, role, status)
       VALUES 
        ($1, $2, 'BUYER', 'ACTIVE'),
        ($1, $3, 'SELLER', 'ACTIVE')`,
      [conv.id, nda.buyer_id, nda.seller_id]
    );

    return conv;
  });

  // 6. Audit Log
  await auditLog({
    actorId: initiator.id,
    action: "DEAL_CONVERSATION_CREATED",
    resourceType: "deal_conversation",
    resourceId: result.id,
    metadata: {
      referenceCode,
      opportunityId,
      ndaId: nda.id,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // 7. Notify Counterparty
  const counterpartyId = isBuyer ? nda.seller_id : nda.buyer_id;
  await createNotification({
    userId: counterpartyId,
    type: "DEAL_CONVERSATION_STARTED",
    title: "Secure Deal Communication Opened",
    message: `A secure confidential discussion thread (${referenceCode}) has been opened for your transaction.`,
    resourceType: "deal_conversation",
    resourceId: result.id,
  });

  const fullConvRes = await query<any>(
    `SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref
     FROM deal_conversations c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN nda_agreements n ON c.nda_id = n.id
     WHERE c.id = $1`,
    [result.id]
  );

  return mapDealConversationView(fullConvRes.rows[0], initiator.id);
}

/**
 * 2. LIST USER'S AUTHORIZED DEAL CONVERSATIONS
 */
export async function getDealConversationsForUser(
  user: AuthenticatedUser
): Promise<DealConversationView[]> {
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.permissions.includes("messaging.read_all");

  let sql = `
    SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref,
           p.role as user_participant_role, p.last_read_at, p.status as participant_status,
           (
             SELECT COUNT(*)
             FROM deal_messages m
             WHERE m.conversation_id = c.id
               AND m.sender_user_id != $1
               AND m.status = 'SENT'
               AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
           ) as unread_count,
           (
             SELECT m.content
             FROM deal_messages m
             WHERE m.conversation_id = c.id AND m.status = 'SENT'
             ORDER BY m.created_at DESC LIMIT 1
           ) as latest_message_snippet
    FROM deal_conversations c
    JOIN opportunities o ON c.opportunity_id = o.id
    JOIN nda_agreements n ON c.nda_id = n.id
  `;

  const params: any[] = [user.id];

  if (!isAdmin) {
    sql += `
      JOIN deal_conversation_participants p 
        ON p.conversation_id = c.id AND p.user_id = $1 AND p.status = 'ACTIVE'
      WHERE c.status IN ('ACTIVE', 'CLOSED')
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `;
  } else {
    sql += `
      LEFT JOIN deal_conversation_participants p 
        ON p.conversation_id = c.id AND p.user_id = $1
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
    `;
  }

  const res = await query<any>(sql, params);

  return res.rows.map((row) => mapDealConversationView(row, user.id));
}

/**
 * 3. GET SINGLE DEAL CONVERSATION (ANTI-IDOR PROTECTED)
 */
export async function getDealConversationById(
  user: AuthenticatedUser,
  conversationId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<DealConversationView> {
  const res = await query<any>(
    `SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref, n.status as nda_status,
            p.role as user_participant_role, p.last_read_at, p.status as participant_status,
            (
              SELECT COUNT(*)
              FROM deal_messages m
              WHERE m.conversation_id = c.id
                AND m.sender_user_id != $2
                AND m.status = 'SENT'
                AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
            ) as unread_count
     FROM deal_conversations c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN nda_agreements n ON c.nda_id = n.id
     LEFT JOIN deal_conversation_participants p ON p.conversation_id = c.id AND p.user_id = $2
     WHERE c.id = $1`,
    [conversationId, user.id]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Deal conversation not found.");
  }

  const row = res.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.permissions.includes("messaging.read_all");

  // Anti-IDOR Authorization Check
  if (!row.participant_status && !isAdmin) {
    throw new ForbiddenError("You are not an authorized participant in this deal conversation.");
  }

  if (row.participant_status === "REVOKED" && !isAdmin) {
    throw new ForbiddenError("Your communication access to this deal conversation has been revoked.");
  }

  // Check underlying NDA state: if revoked, conversation is also blocked
  if (row.nda_status === "REVOKED" && !isAdmin) {
    throw new ForbiddenError("Communication access is blocked because the underlying bilateral NDA was revoked.");
  }

  // Audit Conversation Inspection
  await auditLog({
    actorId: user.id,
    action: "DEAL_CONVERSATION_ACCESSED",
    resourceType: "deal_conversation",
    resourceId: conversationId,
    metadata: { referenceCode: row.reference_code },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return mapDealConversationView(row, user.id);
}

/**
 * 4. SEND MESSAGE IN DEAL CONVERSATION
 */
export async function sendDealMessage(
  user: AuthenticatedUser,
  conversationId: string,
  input: CreateDealMessageInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealMessageView> {
  // 1. Rate Limiting Defense
  checkMessageRateLimit(user.id);

  // 2. Validate input content at domain service boundary
  if (!input || typeof input.content !== "string") {
    throw new ValidationError("Message content is required.");
  }

  const trimmed = input.content.trim();
  if (trimmed.length === 0) {
    throw new ValidationError("Message content cannot be empty.");
  }
  if (trimmed.length > 4000) {
    throw new ValidationError("Message content cannot exceed 4000 characters.");
  }
  if (input.content.includes("\0")) {
    throw new ValidationError("Null bytes are prohibited in message content.");
  }
  if (/[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(input.content)) {
    throw new ValidationError("Unprintable control characters are prohibited.");
  }

  // 3. Load conversation and participant membership
  const convRes = await query<any>(
    `SELECT c.*, n.status as nda_status,
            p.role as sender_role, p.status as participant_status
     FROM deal_conversations c
     JOIN nda_agreements n ON c.nda_id = n.id
     LEFT JOIN deal_conversation_participants p ON p.conversation_id = c.id AND p.user_id = $2
     WHERE c.id = $1`,
    [conversationId, user.id]
  );

  if (convRes.rows.length === 0) {
    throw new NotFoundError("Deal conversation not found.");
  }

  const conv = convRes.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  // Anti-IDOR Check: Must be an authorized participant
  if (!conv.participant_status && !isAdmin) {
    throw new ForbiddenError("You are not authorized to send messages in this deal conversation.");
  }
  if (conv.participant_status !== "ACTIVE" && !isAdmin) {
    throw new ForbiddenError("Your messaging access to this deal conversation has been revoked.");
  }

  // Conversation Status Check
  if (conv.status === "CLOSED") {
    throw new ValidationError("Cannot send message. This deal conversation has been closed.");
  }
  if (conv.status === "REVOKED") {
    throw new ForbiddenError("Cannot send message. This deal conversation has been revoked.");
  }

  // Underlying NDA Check
  if (conv.nda_status !== "EXECUTED" && !isAdmin) {
    throw new ForbiddenError("Cannot send message. Underlying bilateral NDA is not active.");
  }

  const role: DealParticipantRole = conv.sender_role || (isAdmin ? "ADMIN" : "BUYER");

  // 3. Transactional Insert Message & Update Conversation
  const result = await transaction(async (tx) => {
    const msgRes = await tx.query<any>(
      `INSERT INTO deal_messages (conversation_id, sender_user_id, content, status)
       VALUES ($1, $2, $3, 'SENT')
       RETURNING *`,
      [conversationId, user.id, input.content]
    );

    const message = msgRes.rows[0];

    // Update conversation last_message_at
    await tx.query(
      `UPDATE deal_conversations 
       SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [conversationId]
    );

    // Auto mark read for sender
    await tx.query(
      `UPDATE deal_conversation_participants 
       SET last_read_message_id = $1, last_read_at = CURRENT_TIMESTAMP 
       WHERE conversation_id = $2 AND user_id = $3`,
      [message.id, conversationId, user.id]
    );

    return message;
  });

  // 4. Audit Log (CRITICAL: Do NOT store message body!)
  await auditLog({
    actorId: user.id,
    action: "DEAL_MESSAGE_SENT",
    resourceType: "deal_message",
    resourceId: result.id,
    metadata: {
      conversationId,
      referenceCode: conv.reference_code,
      senderRole: role,
      contentLength: input.content.length,
    },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  // 5. Notify Recipient Counterparty
  const recipientId = user.id === conv.buyer_id ? conv.seller_id : conv.buyer_id;
  await createNotification({
    userId: recipientId,
    type: "DEAL_MESSAGE_RECEIVED",
    title: "New Deal Message",
    message: `You have received a new confidential message in deal conversation (${conv.reference_code}).`,
    resourceType: "deal_conversation",
    resourceId: conversationId,
  });

  return {
    id: result.id,
    conversationId: result.conversation_id,
    senderRole: role,
    isMine: true,
    content: result.content,
    status: result.status,
    createdAt: result.created_at,
  };
}

/**
 * 5. GET PAGINATED MESSAGE HISTORY (CURSOR-BASED)
 */
export async function getPaginatedMessages(
  user: AuthenticatedUser,
  conversationId: string,
  params: Partial<GetMessagesQueryInput> = {}
): Promise<PaginatedMessagesResponse> {
  // 1. Verify participant authorization
  await getDealConversationById(user, conversationId);

  const limit = Math.min(Math.max(params.limit || 30, 1), 100);

  let sql = `
    SELECT m.*, p.role as sender_role
    FROM deal_messages m
    LEFT JOIN deal_conversation_participants p 
      ON p.conversation_id = m.conversation_id AND p.user_id = m.sender_user_id
    WHERE m.conversation_id = $1
  `;
  const queryArgs: any[] = [conversationId];

  // Cursor filter
  if (params.cursor) {
    try {
      const decoded = Buffer.from(params.cursor, "base64").toString("utf-8");
      const [cursorTime, cursorId] = decoded.split("::");
      if (cursorTime && cursorId) {
        queryArgs.push(cursorTime, cursorId);
        sql += ` AND (m.created_at, m.id) < ($${queryArgs.length - 1}, $${queryArgs.length})`;
      }
    } catch {
      throw new ValidationError("Invalid pagination cursor format.");
    }
  }

  sql += ` ORDER BY m.created_at DESC, m.id DESC LIMIT $${queryArgs.length + 1}`;
  queryArgs.push(limit + 1);

  const res = await query<any>(sql, queryArgs);

  const hasMore = res.rows.length > limit;
  const rawItems = hasMore ? res.rows.slice(0, limit) : res.rows;

  // Total count in conversation
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM deal_messages WHERE conversation_id = $1`,
    [conversationId]
  );
  const total = parseInt(countRes.rows[0]?.count || "0", 10);

  let nextCursor: string | null = null;
  if (hasMore && rawItems.length > 0) {
    const last = rawItems[rawItems.length - 1];
    nextCursor = Buffer.from(`${last.created_at.toISOString()}::${last.id}`).toString("base64");
  }

  // Reverse so client receives chronological stream
  const messages: DealMessageView[] = rawItems.reverse().map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderRole: (m.sender_role as DealParticipantRole) || "BUYER",
    isMine: m.sender_user_id === user.id,
    content: m.status === "SOFT_DELETED" ? "[This message was deleted by the sender]" : m.content,
    status: m.status,
    createdAt: m.created_at,
    deletedAt: m.deleted_at,
  }));

  return {
    messages,
    nextCursor,
    hasMore,
    total,
  };
}

/**
 * 6. MARK CONVERSATION AS READ
 */
export async function markConversationRead(
  user: AuthenticatedUser,
  conversationId: string,
  upToMessageId?: string
): Promise<{ success: boolean; lastReadAt: string }> {
  // Authorization check
  const memberRes = await query<any>(
    `SELECT id FROM deal_conversation_participants WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, user.id]
  );
  if (memberRes.rows.length === 0) {
    throw new ForbiddenError("You are not an authorized participant in this deal conversation.");
  }

  if (upToMessageId) {
    const msgCheck = await query<any>(
      `SELECT id FROM deal_messages WHERE id = $1 AND conversation_id = $2`,
      [upToMessageId, conversationId]
    );
    if (msgCheck.rows.length === 0) {
      throw new NotFoundError("Message not found in this deal conversation.");
    }
  }

  await query(
    `UPDATE deal_conversation_participants 
     SET last_read_message_id = COALESCE($1, (SELECT id FROM deal_messages WHERE conversation_id = $2 ORDER BY created_at DESC LIMIT 1)),
         last_read_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE conversation_id = $2 AND user_id = $3`,
    [upToMessageId || null, conversationId, user.id]
  );

  return { success: true, lastReadAt: new Date().toISOString() };
}

/**
 * 7. SOFT-DELETE DEAL MESSAGE
 */
export async function softDeleteDealMessage(
  user: AuthenticatedUser,
  conversationId: string,
  messageId: string,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const msgRes = await query<any>(
    `SELECT * FROM deal_messages WHERE id = $1 AND conversation_id = $2`,
    [messageId, conversationId]
  );

  if (msgRes.rows.length === 0) {
    throw new NotFoundError("Message not found.");
  }

  const msg = msgRes.rows[0];
  const isAdmin = user.roles.includes("SUPER_ADMIN");

  // Only the original author or super admin may soft delete
  if (msg.sender_user_id !== user.id && !isAdmin) {
    throw new ForbiddenError("You cannot delete another participant's message.");
  }

  await query(
    `UPDATE deal_messages 
     SET status = 'SOFT_DELETED', deleted_at = CURRENT_TIMESTAMP, deleted_by = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [user.id, messageId]
  );

  await auditLog({
    actorId: user.id,
    action: "DEAL_MESSAGE_DELETED",
    resourceType: "deal_message",
    resourceId: messageId,
    metadata: { conversationId },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * 8. CLOSE DEAL CONVERSATION
 */
export async function closeDealConversation(
  user: AuthenticatedUser,
  conversationId: string,
  input: CloseDealConversationInput,
  context?: { ip?: string; userAgent?: string }
): Promise<DealConversationView> {
  const convRes = await query<any>(
    `SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref
     FROM deal_conversations c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN nda_agreements n ON c.nda_id = n.id
     WHERE c.id = $1`,
    [conversationId]
  );

  if (convRes.rows.length === 0) {
    throw new NotFoundError("Deal conversation not found.");
  }

  const conv = convRes.rows[0];
  const isParticipant = conv.buyer_id === user.id || conv.seller_id === user.id;
  const isAdmin = user.roles.includes("SUPER_ADMIN") || user.permissions.includes("messaging.close");

  if (!isParticipant && !isAdmin) {
    throw new ForbiddenError("You are not authorized to close this deal conversation.");
  }

  if (conv.status === "CLOSED") {
    throw new ValidationError("Deal conversation is already closed.");
  }
  if (conv.status === "REVOKED") {
    throw new ValidationError("Cannot close a revoked deal conversation.");
  }

  await query(
    `UPDATE deal_conversations 
     SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP, closed_by = $1, close_reason = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [user.id, input.closeReason || "Deal communication concluded", conversationId]
  );

  await auditLog({
    actorId: user.id,
    action: "DEAL_CONVERSATION_CLOSED",
    resourceType: "deal_conversation",
    resourceId: conversationId,
    metadata: { referenceCode: conv.reference_code, reason: input.closeReason },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  const counterpartyId = user.id === conv.buyer_id ? conv.seller_id : conv.buyer_id;
  await createNotification({
    userId: counterpartyId,
    type: "DEAL_CONVERSATION_CLOSED",
    title: "Deal Conversation Closed",
    message: `Deal conversation (${conv.reference_code}) has been closed.`,
    resourceType: "deal_conversation",
    resourceId: conversationId,
  });

  const updatedRes = await query<any>(
    `SELECT c.*, o.reference_code as opp_ref, o.title as opp_title, n.reference_code as nda_ref
     FROM deal_conversations c
     JOIN opportunities o ON c.opportunity_id = o.id
     JOIN nda_agreements n ON c.nda_id = n.id
     WHERE c.id = $1`,
    [conversationId]
  );

  return mapDealConversationView(updatedRes.rows[0], user.id);
}

/**
 * 9. REVOKE DEAL CONVERSATION (ADMIN ONLY)
 */
export async function revokeDealConversation(
  adminUser: AuthenticatedUser,
  conversationId: string,
  input: RevokeDealConversationInput,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const isAdmin = adminUser.roles.includes("SUPER_ADMIN") || adminUser.permissions.includes("messaging.manage");
  if (!isAdmin) {
    throw new ForbiddenError("Only administrative officers may revoke deal conversations.");
  }

  const convRes = await query<any>(`SELECT id, reference_code FROM deal_conversations WHERE id = $1`, [
    conversationId,
  ]);
  if (convRes.rows.length === 0) {
    throw new NotFoundError("Deal conversation not found.");
  }

  await query(
    `UPDATE deal_conversations 
     SET status = 'REVOKED', revoked_at = CURRENT_TIMESTAMP, revoked_by = $1, revocation_reason = $2, updated_at = CURRENT_TIMESTAMP 
     WHERE id = $3`,
    [adminUser.id, input.revokeReason, conversationId]
  );

  // Revoke participants
  await query(
    `UPDATE deal_conversation_participants 
     SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP 
     WHERE conversation_id = $1`,
    [conversationId]
  );

  await auditLog({
    actorId: adminUser.id,
    action: "DEAL_CONVERSATION_REVOKED",
    resourceType: "deal_conversation",
    resourceId: conversationId,
    metadata: { referenceCode: convRes.rows[0].reference_code, reason: input.revokeReason },
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Maps raw database entity to safe, progressive DealConversationView
 * Guarantees zero leakage of statutory identifiers or private contact details
 */
function mapDealConversationView(row: any, currentUserId: string): DealConversationView {
  const isBuyer = row.buyer_id === currentUserId;
  const userRole: DealParticipantRole = isBuyer ? "BUYER" : "SELLER";
  const counterpartyRole: DealParticipantRole = isBuyer ? "SELLER" : "BUYER";
  const counterpartyLabel = isBuyer ? "Verified Promoter" : "Acquisition Principal";

  return {
    id: row.id,
    referenceCode: row.reference_code,
    opportunityId: row.opportunity_id,
    opportunityReference: row.opp_ref || "",
    opportunityTitle: row.opp_title || "",
    ndaId: row.nda_id,
    ndaReference: row.nda_ref || "",
    dataRoomId: row.data_room_id || null,
    title: row.title,
    status: row.status as DealConversationStatus,
    userRole,
    counterpartyRole,
    counterpartyLabel,
    unreadCount: parseInt(row.unread_count || "0", 10),
    lastMessageSnippet: row.latest_message_snippet
      ? row.latest_message_snippet.slice(0, 100)
      : null,
    lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    closeReason: row.close_reason || null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
  };
}
