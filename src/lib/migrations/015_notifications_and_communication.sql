-- Scale-up India — Phase 15: Notifications & Communication Platform
-- Migration: 015_notifications_and_communication.sql

-- 1. NOTIFICATION EVENTS (Transactional Outbox)
CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'DEFAULT',
    event_type VARCHAR(100) NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ,

    CONSTRAINT chk_event_status CHECK (status IN ('PENDING', 'PROCESSED', 'FAILED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_notif_events_pending 
    ON notification_events (status, created_at) 
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_notif_events_aggregate 
    ON notification_events (aggregate_type, aggregate_id);

-- 2. NOTIFICATIONS (Canonical Canonical Notification Store)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(100) NOT NULL DEFAULT 'DEFAULT',
    recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    safe_body TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
    action_type VARCHAR(50),
    action_url VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    idempotency_key VARCHAR(255) UNIQUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_notif_category CHECK (category IN (
        'SECURITY', 'TRANSACTION', 'PAYMENT', 'DILIGENCE', 
        'DEAL_ACTIVITY', 'MESSAGING', 'MARKETING_INFORMATIONAL'
    )),
    CONSTRAINT chk_notif_severity CHECK (severity IN (
        'INFO', 'WARNING', 'CRITICAL', 'SUCCESS'
    ))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON notifications (recipient_user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tenant_recipient 
    ON notifications (tenant_id, recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_category 
    ON notifications (recipient_user_id, category, created_at DESC);

-- 3. NOTIFICATION DELIVERIES (Channel Delivery Tracking & State Machine)
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_code VARCHAR(100),
    failure_reason TEXT,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_delivery_channel CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP')),
    CONSTRAINT chk_delivery_status CHECK (status IN (
        'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'DEAD_LETTER'
    ))
);

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_pending 
    ON notification_deliveries (status, next_retry_at) 
    WHERE status IN ('QUEUED', 'RETRYING');

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_notification 
    ON notification_deliveries (notification_id, channel);

CREATE INDEX IF NOT EXISTS idx_notif_deliveries_provider_msg 
    ON notification_deliveries (provider, provider_message_id);

-- 4. NOTIFICATION PREFERENCES (User Category & Channel Configurations)
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_user_category_channel UNIQUE (user_id, category, channel),
    CONSTRAINT chk_pref_category CHECK (category IN (
        'SECURITY', 'TRANSACTION', 'PAYMENT', 'DILIGENCE', 
        'DEAL_ACTIVITY', 'MESSAGING', 'MARKETING_INFORMATIONAL'
    )),
    CONSTRAINT chk_pref_channel CHECK (channel IN ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'))
);

CREATE INDEX IF NOT EXISTS idx_notif_preferences_user 
    ON notification_preferences (user_id);

-- 5. NOTIFICATION WEBHOOK EVENTS (Idempotent Webhook Replay Protection)
CREATE TABLE IF NOT EXISTS notification_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    raw_payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    received_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    error_message TEXT,

    CONSTRAINT uq_notification_webhook_provider_event UNIQUE (provider, event_id),
    CONSTRAINT chk_webhook_status CHECK (status IN ('PROCESSED', 'IGNORED', 'FAILED'))
);

-- 6. NOTIFICATION TEMPLATES (Safe Standard Communication Templates)
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    subject_template VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_template_key_channel_version UNIQUE (template_key, channel, version)
);

-- Seed Default Safe Templates
INSERT INTO notification_templates (template_key, channel, version, subject_template, body_template) VALUES
('TRANSACTION_INITIATED', 'EMAIL', 1, 'Action Required: Transaction Deal Room Initialized', 'A new transaction deal room workspace has been initialized for your confidential deal. Please sign in to Scale-up India to review the transaction terms.'),
('TRANSACTION_CLOSED', 'EMAIL', 1, 'Notification: Transaction Authoritatively Closed', 'The transaction deal room has authoritatively closed and the final closing record has been created. Access your workspace for the executed records.'),
('PAYMENT_CONFIRMED', 'EMAIL', 1, 'Escrow Update: Earnest Deposit Confirmed', 'The required transaction earnest token deposit has been confirmed in escrow. Your deal workspace is updated.'),
('DUE_DILIGENCE_REQUESTED', 'EMAIL', 1, 'Action Required: Due Diligence Information Requested', 'A new document request has been submitted in your due diligence workspace. Please review and provide the requested evidence.'),
('SECURITY_ALERT', 'EMAIL', 1, 'Scale-up India Security Notice', 'A security-sensitive event was recorded on your account. If this was not you, please verify your credentials immediately.'),
('GENERIC_NOTIFICATION', 'EMAIL', 1, 'Update from Scale-up India', 'You have a new update in your Scale-up India workspace. Please sign in to review.')
ON CONFLICT (template_key, channel, version) DO NOTHING;

-- 7. SEED RBAC PERMISSIONS FOR PHASE 15
INSERT INTO permissions (code, module, description) VALUES
('notification.read_own', 'notification', 'Read own user notifications and unread badges'),
('notification.manage_own_preferences', 'notification', 'Update own notification preferences and channel subscriptions'),
('notification.read_all', 'notification', 'View all system notifications across the platform'),
('notification.manage', 'notification', 'Manage notifications and trigger deliveries'),
('notification.admin', 'notification', 'Administrative control over delivery retries, outbox queues, and templates'),
('notification.audit', 'notification', 'View audit logs of notification deliveries and webhooks')
ON CONFLICT (code) DO NOTHING;

-- Assign to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('notification.read_own', 'notification.manage_own_preferences')
ON CONFLICT DO NOTHING;

-- Assign to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('notification.read_own', 'notification.manage_own_preferences')
ON CONFLICT DO NOTHING;

-- Assign to Reviewer / Legal / Finance roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('DUE_DILIGENCE', 'FINANCE', 'LEGAL', 'REVIEWER')
AND p.code IN ('notification.read_own', 'notification.manage_own_preferences')
ON CONFLICT DO NOTHING;

-- Assign to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN (
    'notification.read_own', 'notification.manage_own_preferences',
    'notification.read_all', 'notification.manage', 'notification.admin', 'notification.audit'
)
ON CONFLICT DO NOTHING;
