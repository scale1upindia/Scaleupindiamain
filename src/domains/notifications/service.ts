// Scale-up India — Phase 15: Notifications & Communication Orchestration Layer
// Path: src/domains/notifications/service.ts

import crypto from "crypto";
import { query, getDb, DbClient } from "@/lib/db";
import { auditLog } from "@/domains/audit/logger";
import {
  NotificationRecord,
  NotificationDeliveryRecord,
  NotificationPreferenceRecord,
  NotificationEventRecord,
  NotificationCategory,
  NotificationChannel,
  NotificationSeverity,
  NotificationDispatchInput,
  OutboxEventInput,
  UserNotificationListResponse,
} from "@/types/notification";
import { InAppNotificationRecord } from "@/types/eoi";
import { AuthenticatedUser } from "@/types/auth";
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  NotificationNotFoundError,
  MandatoryNotificationError,
  InvalidWebhookError,
  NotificationRateLimitError,
  DomainError,
} from "@/lib/errors";
import { emailProviderRegistry } from "./provider";
import { renderEmailTemplate } from "./templates";
import { ListNotificationsQueryInput, UpdatePreferenceInput } from "@/schemas/notification";

// Mandatory notification categories that can never be disabled by users
export const MANDATORY_CATEGORIES: NotificationCategory[] = [
  "SECURITY",
  "TRANSACTION",
  "PAYMENT",
];

// All supported categories
export const ALL_CATEGORIES: NotificationCategory[] = [
  "SECURITY",
  "TRANSACTION",
  "PAYMENT",
  "DILIGENCE",
  "DEAL_ACTIVITY",
  "MESSAGING",
  "MARKETING_INFORMATIONAL",
];

// Sliding-window rate limit maps
const notificationRateLimitMap = new Map<string, number[]>();

export function checkNotificationRateLimit(userId: string, isQuery = false): void {
  const windowMs = 60 * 1000;
  const maxRequests = isQuery ? 120 : 60; // 120 reads/min, 60 mutations/min
  const now = Date.now();
  const key = `${userId}:${isQuery ? "query" : "mutation"}`;

  const timestamps = notificationRateLimitMap.get(key) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    throw new NotificationRateLimitError();
  }

  validTimestamps.push(now);
  notificationRateLimitMap.set(key, validTimestamps);
}

export function resetNotificationRateLimits(): void {
  notificationRateLimitMap.clear();
}

// =============================================================================
// 1. BACKWARD-COMPATIBLE API (Supports Phases 7–14)
// =============================================================================

export interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
}

/**
 * Creates an in-app notification preserving legacy interface for Phases 7–14,
 * and bridges it into the Phase 15 canonical notifications & delivery tracking.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<InAppNotificationRecord> {
  // 1. Insert into legacy in_app_notifications table
  const res = await query<InAppNotificationRecord>(
    `INSERT INTO in_app_notifications (
      user_id, type, title, message, resource_type, resource_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING 
      id, user_id as "userId", type, title, message, 
      resource_type as "resourceType", resource_id as "resourceId", 
      is_read as "isRead", read_at as "readAt", created_at as "createdAt"`,
    [
      params.userId,
      params.type,
      params.title,
      params.message,
      params.resourceType || null,
      params.resourceId || null,
    ]
  );

  const legacyNotif = res.rows[0];

  // 2. Map legacy type to canonical notification category
  let category: NotificationCategory = "DEAL_ACTIVITY";
  const upperType = params.type.toUpperCase();
  if (upperType.includes("SECURITY") || upperType.includes("AUTH")) {
    category = "SECURITY";
  } else if (upperType.includes("TRANSACTION") || upperType.includes("CLOSING")) {
    category = "TRANSACTION";
  } else if (upperType.includes("PAYMENT") || upperType.includes("TOKEN") || upperType.includes("ESCROW")) {
    category = "PAYMENT";
  } else if (upperType.includes("DILIGENCE")) {
    category = "DILIGENCE";
  } else if (upperType.includes("MESSAGE")) {
    category = "MESSAGING";
  }

  // 3. Mirror into canonical notifications table
  try {
    const notifRes = await query<{ id: string }>(
      `INSERT INTO notifications (
        id, tenant_id, recipient_user_id, category, title, safe_body,
        severity, action_type, is_read, idempotency_key
      ) VALUES (
        $1, 'DEFAULT', $2, $3, $4, $5, 'INFO', $6, FALSE, $7
      ) ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id`,
      [
        legacyNotif.id,
        params.userId,
        category,
        params.title,
        params.message,
        params.resourceType || null,
        `legacy:${legacyNotif.id}`,
      ]
    );

    if (notifRes.rows.length > 0) {
      // Record IN_APP delivery as DELIVERED
      await query(
        `INSERT INTO notification_deliveries (
          notification_id, channel, provider, status, attempts, delivered_at
        ) VALUES ($1, 'IN_APP', 'INTERNAL', 'DELIVERED', 1, CURRENT_TIMESTAMP)`,
        [notifRes.rows[0].id]
      );
    }
  } catch (err) {
    // Non-fatal fallback for legacy mirror
  }

  return legacyNotif;
}

export async function getUserNotifications(
  userId: string,
  limit = 20,
  unreadOnly = false
): Promise<{ notifications: InAppNotificationRecord[]; unreadCount: number }> {
  let sql = `SELECT 
      id, user_id as "userId", type, title, message, 
      resource_type as "resourceType", resource_id as "resourceId", 
      is_read as "isRead", read_at as "readAt", created_at as "createdAt"
    FROM in_app_notifications 
    WHERE user_id = $1`;
  const params: any[] = [userId];

  if (unreadOnly) {
    sql += ` AND is_read = FALSE`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $2`;
  params.push(limit);

  const [listRes, countRes] = await Promise.all([
    query<InAppNotificationRecord>(sql, params),
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    ),
  ]);

  return {
    notifications: listRes.rows,
    unreadCount: parseInt(countRes.rows[0]?.count || "0", 10),
  };
}

export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const res = await query(
    `UPDATE in_app_notifications 
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [notificationId, userId]
  );

  // Also update canonical notifications table
  await query(
    `UPDATE notifications
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND recipient_user_id = $2`,
    [notificationId, userId]
  );

  return res.rows.length > 0;
}

// =============================================================================
// 2. TRANSACTIONAL OUTBOX & EVENT ORCHESTRATION
// =============================================================================

/**
 * Enqueues an outbox event. Can accept a transaction client (DbClient)
 * ensuring business state mutations and outbox entries commit or roll back together.
 */
export async function enqueueOutboxEvent(
  input: OutboxEventInput,
  txClient?: DbClient
): Promise<NotificationEventRecord> {
  const client = txClient || (await getDb());
  const tenantId = input.tenantId || "DEFAULT";

  // Deduplication check by idempotencyKey
  const existingRes = await client.query<any>(
    `SELECT * FROM notification_events WHERE idempotency_key = $1`,
    [input.idempotencyKey]
  );

  if (existingRes.rows.length > 0) {
    const row = existingRes.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      eventType: row.event_type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      actorUserId: row.actor_user_id,
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      processedAt: row.processed_at ? new Date(row.processed_at).toISOString() : null,
    };
  }

  const res = await client.query<any>(
    `INSERT INTO notification_events (
      tenant_id, event_type, aggregate_type, aggregate_id,
      actor_user_id, payload, idempotency_key, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
    RETURNING *`,
    [
      tenantId,
      input.eventType,
      input.aggregateType,
      input.aggregateId,
      input.actorUserId || null,
      JSON.stringify(input.payload || {}),
      input.idempotencyKey,
    ]
  );

  const row = res.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    actorUserId: row.actor_user_id,
    payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    processedAt: null,
  };
}

/**
 * Processes pending outbox events and dispatches notifications to target recipients.
 */
export async function processOutboxEvents(
  batchSize = 20
): Promise<{ processed: number; errors: number }> {
  const pendingEventsRes = await query<any>(
    `SELECT * FROM notification_events 
     WHERE status = 'PENDING' 
     ORDER BY created_at ASC 
     LIMIT $1`,
    [batchSize]
  );

  let processed = 0;
  let errors = 0;

  for (const eventRow of pendingEventsRes.rows) {
    try {
      const payload = typeof eventRow.payload === "string" ? JSON.parse(eventRow.payload) : eventRow.payload;
      const recipientUserId = payload.recipientUserId || payload.targetUserId;

      if (recipientUserId) {
        let category: NotificationCategory = "DEAL_ACTIVITY";
        if (eventRow.event_type.includes("SECURITY")) category = "SECURITY";
        else if (eventRow.event_type.includes("TRANSACTION") || eventRow.event_type.includes("CLOSING")) category = "TRANSACTION";
        else if (eventRow.event_type.includes("PAYMENT")) category = "PAYMENT";
        else if (eventRow.event_type.includes("DILIGENCE")) category = "DILIGENCE";
        else if (eventRow.event_type.includes("MESSAGE")) category = "MESSAGING";

        const idempotencyKey = `${eventRow.tenant_id}:${eventRow.event_type}:${eventRow.aggregate_type}:${eventRow.aggregate_id}:${recipientUserId}`;

        await dispatchNotification({
          recipientUserId,
          tenantId: eventRow.tenant_id,
          category,
          title: payload.title || `Update for ${eventRow.aggregate_type}`,
          safeBody: payload.safeBody || payload.message || "An action requires your attention in your workspace.",
          severity: payload.severity || "INFO",
          actionType: payload.actionType,
          actionUrl: payload.actionUrl,
          idempotencyKey,
          eventId: eventRow.id,
        });
      }

      await query(
        `UPDATE notification_events 
         SET status = 'PROCESSED', processed_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [eventRow.id]
      );
      processed++;
    } catch (err) {
      errors++;
      await query(
        `UPDATE notification_events 
         SET status = 'FAILED' 
         WHERE id = $1`,
        [eventRow.id]
      );
    }
  }

  return { processed, errors };
}

// =============================================================================
// 3. CANONICAL NOTIFICATION DISPATCHING & DELIVERY STATE MACHINE
// =============================================================================

/**
 * Dispatches a notification to target channels based on recipient preferences.
 * Implements deterministic deduplication and bounded retries.
 */
export async function dispatchNotification(
  input: NotificationDispatchInput,
  options?: { providerName?: string }
): Promise<NotificationRecord> {
  const tenantId = input.tenantId || "DEFAULT";

  // 1. Verify recipient exists
  const userRes = await query<{ id: string; email: string; first_name: string }>(
    `SELECT id, email, first_name FROM users WHERE id = $1 AND is_active = TRUE`,
    [input.recipientUserId]
  );

  if (userRes.rows.length === 0) {
    throw new NotFoundError("Recipient user not found or inactive.");
  }
  const recipientUser = userRes.rows[0];

  // 2. Deduplication check via idempotencyKey
  if (input.idempotencyKey) {
    const existingNotifRes = await query<any>(
      `SELECT * FROM notifications WHERE idempotency_key = $1`,
      [input.idempotencyKey]
    );

    if (existingNotifRes.rows.length > 0) {
      const row = existingNotifRes.rows[0];
      return {
        id: row.id,
        tenantId: row.tenant_id,
        recipientUserId: row.recipient_user_id,
        eventId: row.event_id,
        category: row.category,
        title: row.title,
        safeBody: row.safe_body,
        severity: row.severity,
        actionType: row.action_type,
        actionUrl: row.action_url,
        isRead: row.is_read,
        readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
        idempotencyKey: row.idempotency_key,
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
      };
    }
  }

  // 3. Check Notification Preferences
  const prefRes = await query<{ channel: string; is_enabled: boolean; is_mandatory: boolean }>(
    `SELECT channel, is_enabled, is_mandatory FROM notification_preferences 
     WHERE user_id = $1 AND category = $2`,
    [input.recipientUserId, input.category]
  );

  const prefMap = new Map<string, boolean>();
  for (const r of prefRes.rows) {
    prefMap.set(r.channel, r.is_enabled);
  }

  // Mandatory categories are ALWAYS enabled
  const isMandatory = MANDATORY_CATEGORIES.includes(input.category);
  const inAppEnabled = isMandatory ? true : prefMap.get("IN_APP") ?? true;
  const emailEnabled = isMandatory ? true : prefMap.get("EMAIL") ?? true;

  // 4. Create Notification Record
  const notifInsertRes = await query<any>(
    `INSERT INTO notifications (
      tenant_id, recipient_user_id, event_id, category, title, safe_body,
      severity, action_type, action_url, idempotency_key
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
    [
      tenantId,
      input.recipientUserId,
      input.eventId || null,
      input.category,
      input.title,
      input.safeBody,
      input.severity || "INFO",
      input.actionType || null,
      input.actionUrl || null,
      input.idempotencyKey || null,
    ]
  );

  const notif = notifInsertRes.rows[0];

  // Mirror into in_app_notifications for backward compatibility
  await query(
    `INSERT INTO in_app_notifications (
      id, user_id, type, title, message, resource_type, is_read
    ) VALUES ($1, $2, $3, $4, $5, $6, FALSE)
    ON CONFLICT (id) DO NOTHING`,
    [notif.id, notif.recipient_user_id, notif.category, notif.title, notif.safe_body, notif.action_type]
  );

  // 5. Channel Routing: IN_APP Delivery
  if (inAppEnabled) {
    await query(
      `INSERT INTO notification_deliveries (
        notification_id, channel, provider, status, attempts, delivered_at
      ) VALUES ($1, 'IN_APP', 'INTERNAL', 'DELIVERED', 1, CURRENT_TIMESTAMP)`,
      [notif.id]
    );
  }

  // 6. Channel Routing: EMAIL Delivery
  if (emailEnabled && recipientUser.email) {
    const deliveryRes = await query<{ id: string }>(
      `INSERT INTO notification_deliveries (
        notification_id, channel, provider, status, attempts, max_attempts
      ) VALUES ($1, 'EMAIL', $2, 'QUEUED', 0, 3)
      RETURNING id`,
      [notif.id, options?.providerName || (process.env.NODE_ENV === "production" ? "SENDGRID" : "TEST_SIMULATED")]
    );
    const deliveryId = deliveryRes.rows[0].id;

    // Dispatch email asynchronously/immediately
    const emailProvider = emailProviderRegistry.getProvider(options?.providerName);
    const rendered = renderEmailTemplate(input.actionType || input.category, {
      title: input.title,
      body: input.safeBody,
      actionUrl: input.actionUrl,
      recipientName: recipientUser.first_name,
    });

    try {
      await query(
        `UPDATE notification_deliveries 
         SET status = 'PROCESSING', last_attempt_at = CURRENT_TIMESTAMP, attempts = attempts + 1 
         WHERE id = $1`,
        [deliveryId]
      );

      const sendResult = await emailProvider.sendEmail({
        to: recipientUser.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        metadata: { notificationId: notif.id, deliveryId },
      });

      // Truthful status: Email accepted by provider is SENT (not DELIVERED until webhook confirms)
      await query(
        `UPDATE notification_deliveries 
         SET status = 'SENT', provider_message_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [sendResult.providerMessageId, deliveryId]
      );
    } catch (err: any) {
      const failureReason = err?.message || "Email provider dispatch failure";
      const failureCode = err?.code || "DISPATCH_FAILED";
      const nextRetry = new Date(Date.now() + 60 * 1000).toISOString(); // 1 minute backoff

      await query(
        `UPDATE notification_deliveries 
         SET status = 'RETRYING', failure_code = $1, failure_reason = $2, 
             next_retry_at = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [failureCode, failureReason, nextRetry, deliveryId]
      );
    }
  }

  // Audit Log
  await auditLog({
    actorId: input.recipientUserId,
    action: "NOTIFICATION_DISPATCHED",
    resourceType: "NOTIFICATION",
    resourceId: notif.id,
    metadata: {
      category: notif.category,
      inAppEnabled,
      emailEnabled,
      hasIdempotencyKey: Boolean(input.idempotencyKey),
    },
  });

  return {
    id: notif.id,
    tenantId: notif.tenant_id,
    recipientUserId: notif.recipient_user_id,
    eventId: notif.event_id,
    category: notif.category,
    title: notif.title,
    safeBody: notif.safe_body,
    severity: notif.severity,
    actionType: notif.action_type,
    actionUrl: notif.action_url,
    isRead: notif.is_read,
    readAt: notif.read_at ? new Date(notif.read_at).toISOString() : null,
    idempotencyKey: notif.idempotency_key,
    expiresAt: notif.expires_at ? new Date(notif.expires_at).toISOString() : null,
    createdAt: new Date(notif.created_at).toISOString(),
  };
}

// =============================================================================
// 4. USER NOTIFICATION QUERIES & MUTATIONS (Strict Anti-IDOR & Tenancy)
// =============================================================================

export async function listUserNotifications(
  userId: string,
  params: Partial<ListNotificationsQueryInput> = {},
  tenantId = "DEFAULT"
): Promise<UserNotificationListResponse> {
  checkNotificationRateLimit(userId, true);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const offset = (page - 1) * limit;

  let whereSql = `WHERE recipient_user_id = $1 AND tenant_id = $2`;
  const queryParams: any[] = [userId, tenantId];

  if (params.unreadOnly) {
    whereSql += ` AND is_read = FALSE`;
  }

  if (params.category) {
    queryParams.push(params.category);
    whereSql += ` AND category = $${queryParams.length}`;
  }

  const countSql = `SELECT COUNT(*) as count FROM notifications ${whereSql}`;
  const unreadCountSql = `SELECT COUNT(*) as count FROM notifications WHERE recipient_user_id = $1 AND tenant_id = $2 AND is_read = FALSE`;

  const listSql = `
    SELECT * FROM notifications 
    ${whereSql} 
    ORDER BY created_at DESC 
    LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
  `;

  queryParams.push(limit, offset);

  const [listRes, countRes, unreadRes] = await Promise.all([
    query<any>(listSql, queryParams),
    query<{ count: string }>(countSql, queryParams.slice(0, queryParams.length - 2)),
    query<{ count: string }>(unreadCountSql, [userId, tenantId]),
  ]);

  const totalCount = parseInt(countRes.rows[0]?.count || "0", 10);
  const unreadCount = parseInt(unreadRes.rows[0]?.count || "0", 10);
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const notifications: NotificationRecord[] = listRes.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    recipientUserId: row.recipient_user_id,
    eventId: row.event_id,
    category: row.category,
    title: row.title,
    safeBody: row.safe_body,
    severity: row.severity,
    actionType: row.action_type,
    actionUrl: row.action_url,
    isRead: row.is_read,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  return {
    notifications,
    unreadCount,
    totalCount,
    page,
    limit,
    totalPages,
  };
}

export async function getNotificationById(
  notificationId: string,
  userId: string,
  tenantId = "DEFAULT"
): Promise<NotificationRecord> {
  checkNotificationRateLimit(userId, true);

  const res = await query<any>(
    `SELECT * FROM notifications 
     WHERE id = $1 AND recipient_user_id = $2 AND tenant_id = $3`,
    [notificationId, userId, tenantId]
  );

  if (res.rows.length === 0) {
    throw new NotificationNotFoundError();
  }

  const row = res.rows[0];
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recipientUserId: row.recipient_user_id,
    eventId: row.event_id,
    category: row.category,
    title: row.title,
    safeBody: row.safe_body,
    severity: row.severity,
    actionType: row.action_type,
    actionUrl: row.action_url,
    isRead: row.is_read,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
  tenantId = "DEFAULT"
): Promise<NotificationRecord> {
  checkNotificationRateLimit(userId, false);

  const res = await query<any>(
    `UPDATE notifications 
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND recipient_user_id = $2 AND tenant_id = $3
     RETURNING *`,
    [notificationId, userId, tenantId]
  );

  if (res.rows.length === 0) {
    throw new NotificationNotFoundError();
  }

  // Also mirror to in_app_notifications
  await query(
    `UPDATE in_app_notifications 
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );

  const row = res.rows[0];

  await auditLog({
    actorId: userId,
    action: "NOTIFICATION_READ",
    resourceType: "NOTIFICATION",
    resourceId: notificationId,
  });

  return {
    id: row.id,
    tenantId: row.tenant_id,
    recipientUserId: row.recipient_user_id,
    eventId: row.event_id,
    category: row.category,
    title: row.title,
    safeBody: row.safe_body,
    severity: row.severity,
    actionType: row.action_type,
    actionUrl: row.action_url,
    isRead: row.is_read,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    idempotencyKey: row.idempotency_key,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function markAllNotificationsAsRead(
  userId: string,
  tenantId = "DEFAULT"
): Promise<{ updatedCount: number }> {
  checkNotificationRateLimit(userId, false);

  const res = await query(
    `UPDATE notifications 
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
     WHERE recipient_user_id = $1 AND tenant_id = $2 AND is_read = FALSE
     RETURNING id`,
    [userId, tenantId]
  );

  await query(
    `UPDATE in_app_notifications 
     SET is_read = TRUE, read_at = CURRENT_TIMESTAMP 
     WHERE user_id = $1 AND is_read = FALSE`,
    [userId]
  );

  await auditLog({
    actorId: userId,
    action: "NOTIFICATIONS_ALL_READ",
    resourceType: "NOTIFICATION",
    resourceId: userId,
    metadata: { count: res.rowCount },
  });

  return { updatedCount: res.rowCount };
}

// =============================================================================
// 5. NOTIFICATION PREFERENCES (Anti-Tampering & Mandatory Protection)
// =============================================================================

export async function getUserPreferences(userId: string): Promise<NotificationPreferenceRecord[]> {
  checkNotificationRateLimit(userId, true);

  const res = await query<any>(
    `SELECT * FROM notification_preferences WHERE user_id = $1 ORDER BY category, channel`,
    [userId]
  );

  // If user has not customized preferences, construct standard default matrix
  const existingMap = new Map<string, NotificationPreferenceRecord>();
  for (const r of res.rows) {
    existingMap.set(`${r.category}:${r.channel}`, {
      id: r.id,
      userId: r.user_id,
      category: r.category,
      channel: r.channel,
      isEnabled: r.is_enabled,
      isMandatory: r.is_mandatory,
      updatedAt: new Date(r.updated_at).toISOString(),
    });
  }

  const channels: NotificationChannel[] = ["IN_APP", "EMAIL"];
  const result: NotificationPreferenceRecord[] = [];

  for (const cat of ALL_CATEGORIES) {
    const isMandatory = MANDATORY_CATEGORIES.includes(cat);
    for (const ch of channels) {
      const key = `${cat}:${ch}`;
      if (existingMap.has(key)) {
        result.push(existingMap.get(key)!);
      } else {
        result.push({
          id: `default_${cat}_${ch}`,
          userId,
          category: cat,
          channel: ch,
          isEnabled: true,
          isMandatory,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return result;
}

export async function updateUserPreferences(
  userId: string,
  preferences: UpdatePreferenceInput[]
): Promise<NotificationPreferenceRecord[]> {
  checkNotificationRateLimit(userId, false);

  // Check mandatory protection
  for (const pref of preferences) {
    if (MANDATORY_CATEGORIES.includes(pref.category) && pref.isEnabled === false) {
      throw new MandatoryNotificationError(
        `Mandatory ${pref.category} notifications cannot be disabled on any channel.`
      );
    }
  }

  // Upsert preferences
  for (const pref of preferences) {
    const isMandatory = MANDATORY_CATEGORIES.includes(pref.category);
    await query(
      `INSERT INTO notification_preferences (
        user_id, category, channel, is_enabled, is_mandatory, updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, category, channel) 
      DO UPDATE SET is_enabled = EXCLUDED.is_enabled, updated_at = CURRENT_TIMESTAMP`,
      [userId, pref.category, pref.channel, pref.isEnabled, isMandatory]
    );
  }

  await auditLog({
    actorId: userId,
    action: "NOTIFICATION_PREFERENCES_UPDATED",
    resourceType: "NOTIFICATION_PREFERENCES",
    resourceId: userId,
    metadata: { updatedCount: preferences.length },
  });

  return getUserPreferences(userId);
}

// =============================================================================
// 6. PROVIDER WEBHOOK PROCESSING & REPLAY DEFENSE
// =============================================================================

export async function processEmailWebhook(
  providerName: string,
  rawPayload: string | Buffer,
  signature: string,
  headers?: Record<string, string>
): Promise<{ success: boolean; duplicate?: boolean; status?: string; message: string }> {
  const provider = emailProviderRegistry.getProvider(providerName);

  // 1. Verify Cryptographic Signature
  const timestampHeader = headers?.["timestamp"] || headers?.["x-timestamp"];
  const isValid = provider.verifyWebhookSignature(rawPayload, signature, timestampHeader);
  if (!isValid) {
    await auditLog({
      action: "NOTIFICATION_WEBHOOK_REJECTED",
      resourceType: "EMAIL_WEBHOOK",
      resourceId: provider.name,
      metadata: { reason: "INVALID_SIGNATURE", provider: provider.name },
    });
    throw new InvalidWebhookError("Email webhook signature verification failed.");
  }

  // 2. Parse Event
  const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
  const payloadHash = crypto.createHash("sha256").update(payloadStr).digest("hex");
  const event = provider.parseWebhookEvent(rawPayload);

  // 3. Replay Protection: Check if eventId already processed
  const existingRes = await query<{ id: string; status: string }>(
    `SELECT id, status FROM notification_webhook_events WHERE provider = $1 AND event_id = $2`,
    [provider.name, event.eventId]
  );

  if (existingRes.rows.length > 0) {
    await auditLog({
      action: "NOTIFICATION_WEBHOOK_REPLAY",
      resourceType: "EMAIL_WEBHOOK",
      resourceId: event.eventId,
      metadata: { provider: provider.name, eventId: event.eventId },
    });
    return {
      success: true,
      duplicate: true,
      status: existingRes.rows[0].status,
      message: "Webhook event has already been processed (Replay protected).",
    };
  }

  // 4. Record Webhook Event
  await query(
    `INSERT INTO notification_webhook_events (
      provider, event_id, event_type, payload_hash, raw_payload, status
    ) VALUES ($1, $2, $3, $4, $5, 'PROCESSED')`,
    [provider.name, event.eventId, event.eventType, payloadHash, JSON.stringify(event.rawPayload)]
  );

  // 5. Update Delivery Record
  if (event.providerMessageId) {
    const deliveryRes = await query<{ id: string; status: string }>(
      `SELECT id, status FROM notification_deliveries 
       WHERE provider_message_id = $1 AND provider = $2`,
      [event.providerMessageId, provider.name]
    );

    if (deliveryRes.rows.length > 0) {
      const deliveryId = deliveryRes.rows[0].id;
      if (event.eventType === "DELIVERED") {
        await query(
          `UPDATE notification_deliveries 
           SET status = 'DELIVERED', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [deliveryId]
        );
      } else if (event.eventType === "BOUNCED" || event.eventType === "FAILED") {
        await query(
          `UPDATE notification_deliveries 
           SET status = 'FAILED', failed_at = CURRENT_TIMESTAMP, 
               failure_code = $1, failure_reason = 'Upstream provider bounce or drop',
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [event.eventType, deliveryId]
        );
      }
    }
  }

  await auditLog({
    action: "NOTIFICATION_WEBHOOK_PROCESSED",
    resourceType: "EMAIL_WEBHOOK",
    resourceId: event.eventId,
    metadata: { provider: provider.name, eventType: event.eventType },
  });

  return {
    success: true,
    duplicate: false,
    status: "PROCESSED",
    message: "Webhook successfully verified and delivery state updated.",
  };
}

// =============================================================================
// 7. ADMINISTRATIVE CONTROLS & RETRIES (Strict RBAC Protection)
// =============================================================================

function assertAdminRole(actor: AuthenticatedUser): void {
  const isAdmin =
    actor.roles.includes("SUPER_ADMIN") ||
    actor.roles.includes("ADMIN") ||
    actor.permissions.includes("notification.admin") ||
    actor.permissions.includes("notification.manage");

  if (!isAdmin) {
    throw new ForbiddenError("Administrative privilege required to manage notification deliveries.");
  }
}

export async function retryDelivery(
  deliveryId: string,
  actor: AuthenticatedUser
): Promise<NotificationDeliveryRecord> {
  assertAdminRole(actor);

  const deliveryRes = await query<any>(
    `SELECT nd.*, n.title, n.safe_body, n.action_type, n.action_url, n.category, u.email, u.first_name
     FROM notification_deliveries nd
     JOIN notifications n ON n.id = nd.notification_id
     JOIN users u ON u.id = n.recipient_user_id
     WHERE nd.id = $1`,
    [deliveryId]
  );

  if (deliveryRes.rows.length === 0) {
    throw new NotFoundError("Notification delivery record not found.");
  }

  const row = deliveryRes.rows[0];

  if (row.status === "DELIVERED") {
    return {
      id: row.id,
      notificationId: row.notification_id,
      channel: row.channel,
      provider: row.provider,
      providerMessageId: row.provider_message_id,
      status: row.status,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
      failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
      failureCode: row.failure_code,
      failureReason: row.failure_reason,
      nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at).toISOString() : null,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  if (row.channel === "EMAIL" && row.email) {
    const emailProvider = emailProviderRegistry.getProvider(row.provider);
    const rendered = renderEmailTemplate(row.action_type || row.category, {
      title: row.title,
      body: row.safe_body,
      actionUrl: row.action_url,
      recipientName: row.first_name,
    });

    try {
      await query(
        `UPDATE notification_deliveries 
         SET status = 'PROCESSING', last_attempt_at = CURRENT_TIMESTAMP, attempts = attempts + 1 
         WHERE id = $1`,
        [row.id]
      );

      const sendResult = await emailProvider.sendEmail({
        to: row.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });

      await query(
        `UPDATE notification_deliveries 
         SET status = 'SENT', provider_message_id = $1, failure_code = NULL, 
             failure_reason = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [sendResult.providerMessageId, row.id]
      );
    } catch (err: any) {
      const isDeadLetter = row.attempts + 1 >= row.max_attempts;
      const nextStatus = isDeadLetter ? "DEAD_LETTER" : "RETRYING";
      const nextRetry = isDeadLetter ? null : new Date(Date.now() + 120 * 1000).toISOString();

      await query(
        `UPDATE notification_deliveries 
         SET status = $1, failure_code = $2, failure_reason = $3, 
             next_retry_at = $4, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5`,
        [nextStatus, err?.code || "MANUAL_RETRY_FAILED", err?.message, nextRetry, row.id]
      );
    }
  }

  const updatedRes = await query<any>(`SELECT * FROM notification_deliveries WHERE id = $1`, [deliveryId]);
  const updatedRow = updatedRes.rows[0];

  await auditLog({
    actorId: actor.id,
    action: "NOTIFICATION_DELIVERY_RETRIED",
    resourceType: "NOTIFICATION_DELIVERY",
    resourceId: deliveryId,
    metadata: { status: updatedRow.status, attempts: updatedRow.attempts },
  });

  return {
    id: updatedRow.id,
    notificationId: updatedRow.notification_id,
    channel: updatedRow.channel,
    provider: updatedRow.provider,
    providerMessageId: updatedRow.provider_message_id,
    status: updatedRow.status,
    attempts: updatedRow.attempts,
    maxAttempts: updatedRow.max_attempts,
    lastAttemptAt: updatedRow.last_attempt_at ? new Date(updatedRow.last_attempt_at).toISOString() : null,
    deliveredAt: updatedRow.delivered_at ? new Date(updatedRow.delivered_at).toISOString() : null,
    failedAt: updatedRow.failed_at ? new Date(updatedRow.failed_at).toISOString() : null,
    failureCode: updatedRow.failure_code,
    failureReason: updatedRow.failure_reason,
    nextRetryAt: updatedRow.next_retry_at ? new Date(updatedRow.next_retry_at).toISOString() : null,
    createdAt: new Date(updatedRow.created_at).toISOString(),
    updatedAt: new Date(updatedRow.updated_at).toISOString(),
  };
}

export async function listDeliveriesAdmin(
  actor: AuthenticatedUser,
  options?: { status?: string; limit?: number }
): Promise<NotificationDeliveryRecord[]> {
  assertAdminRole(actor);

  let sql = `SELECT * FROM notification_deliveries`;
  const params: any[] = [];

  if (options?.status) {
    params.push(options.status);
    sql += ` WHERE status = $1`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(options?.limit || 50);

  const res = await query<any>(sql, params);

  return res.rows.map((row) => ({
    id: row.id,
    notificationId: row.notification_id,
    channel: row.channel,
    provider: row.provider,
    providerMessageId: row.provider_message_id,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at).toISOString() : null,
    deliveredAt: row.delivered_at ? new Date(row.delivered_at).toISOString() : null,
    failedAt: row.failed_at ? new Date(row.failed_at).toISOString() : null,
    failureCode: row.failure_code,
    failureReason: row.failure_reason,
    nextRetryAt: row.next_retry_at ? new Date(row.next_retry_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}
