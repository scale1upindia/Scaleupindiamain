// Scale-up India — Phase 15: Notifications & Communication Types
// Path: src/types/notification.ts

export type NotificationCategory =
  | "SECURITY"
  | "TRANSACTION"
  | "PAYMENT"
  | "DILIGENCE"
  | "DEAL_ACTIVITY"
  | "MESSAGING"
  | "MARKETING_INFORMATIONAL";

export type NotificationSeverity = "INFO" | "WARNING" | "CRITICAL" | "SUCCESS";

export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP";

export type NotificationDeliveryStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SENT"
  | "DELIVERED"
  | "FAILED"
  | "RETRYING"
  | "DEAD_LETTER";

export type NotificationEventStatus = "PENDING" | "PROCESSED" | "FAILED" | "CANCELLED";

export interface NotificationRecord {
  id: string;
  tenantId: string;
  recipientUserId: string;
  eventId?: string | null;
  category: NotificationCategory;
  title: string;
  safeBody: string;
  severity: NotificationSeverity;
  actionType?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  readAt?: string | null;
  idempotencyKey?: string | null;
  expiresAt?: string | null;
  createdAt: string;
}

export interface NotificationDeliveryRecord {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  provider: string;
  providerMessageId?: string | null;
  status: NotificationDeliveryStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string | null;
  deliveredAt?: string | null;
  failedAt?: string | null;
  failureCode?: string | null;
  failureReason?: string | null;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceRecord {
  id: string;
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  isEnabled: boolean;
  isMandatory: boolean;
  updatedAt: string;
}

export interface NotificationEventRecord {
  id: string;
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId?: string | null;
  payload: Record<string, any>;
  idempotencyKey: string;
  status: NotificationEventStatus;
  createdAt: string;
  processedAt?: string | null;
}

export interface NotificationDispatchInput {
  recipientUserId: string;
  tenantId?: string;
  category: NotificationCategory;
  title: string;
  safeBody: string;
  severity?: NotificationSeverity;
  actionType?: string;
  actionUrl?: string;
  idempotencyKey?: string;
  eventId?: string;
}

export interface OutboxEventInput {
  tenantId?: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  actorUserId?: string | null;
  payload: Record<string, any>;
  idempotencyKey: string;
}

export interface UserNotificationListResponse {
  notifications: NotificationRecord[];
  unreadCount: number;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}
