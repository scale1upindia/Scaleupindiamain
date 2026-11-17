-- Scale-up India — Phase 11: Payment & Token Architecture
-- Migration: 011_payment_token_architecture.sql

-- 1. REFERENCE SEQUENCES
CREATE SEQUENCE IF NOT EXISTS payment_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS token_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS ledger_ref_seq START WITH 10001;

-- 2. PAYMENT INTENTS TABLE
CREATE TABLE IF NOT EXISTS payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE CASCADE,
    payer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payer_role VARCHAR(50) NOT NULL DEFAULT 'BUYER',
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    purpose VARCHAR(50) NOT NULL DEFAULT 'EARNEST_DEPOSIT',
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    provider VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    provider_payment_reference VARCHAR(255),
    idempotency_key VARCHAR(255),
    refunded_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00 CHECK (refunded_amount >= 0),
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_payment_intent_purpose CHECK (purpose IN ('EARNEST_DEPOSIT', 'PLATFORM_FEE', 'ESCROW_TOKEN')),
    CONSTRAINT chk_payment_intent_status CHECK (status IN ('CREATED', 'REQUIRES_ACTION', 'PENDING', 'AUTHORIZED', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'PARTIALLY_REFUNDED'))
);

-- Partial Unique Index: Idempotency Key per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_idempotency 
ON payment_intents (payer_user_id, idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- Partial Unique Index: Unique provider payment reference per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_intents_provider_ref 
ON payment_intents (provider, provider_payment_reference) 
WHERE provider_payment_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_intents_mou ON payment_intents (mou_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_intents_payer ON payment_intents (payer_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_opp ON payment_intents (opportunity_id, status);

-- 3. TOKEN DEPOSITS TABLE (Transaction Earnest Deposit / Token Intent Model)
CREATE TABLE IF NOT EXISTS token_deposits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
    deposit_amount NUMERIC(18, 2) NOT NULL CHECK (deposit_amount > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'TOKEN_INTENT_CREATED',
    confirmed_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_token_deposit_status CHECK (status IN ('TOKEN_INTENT_CREATED', 'TOKEN_PAYMENT_PENDING', 'TOKEN_PAYMENT_CONFIRMED', 'TOKEN_PAYMENT_FAILED', 'TOKEN_CANCELLED', 'TOKEN_REFUND_PENDING', 'TOKEN_REFUNDED'))
);

-- Partial Unique Index: At most one CONFIRMED token deposit per MOU
CREATE UNIQUE INDEX IF NOT EXISTS idx_token_deposits_active_mou 
ON token_deposits (mou_id) 
WHERE status = 'TOKEN_PAYMENT_CONFIRMED';

CREATE INDEX IF NOT EXISTS idx_token_deposits_buyer ON token_deposits (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_token_deposits_seller ON token_deposits (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_token_deposits_opp ON token_deposits (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_token_deposits_intent ON token_deposits (payment_intent_id);

-- 4. PAYMENT LEDGER TABLE (Append-Only Immutable Financial Journal)
CREATE TABLE IF NOT EXISTS payment_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_reference VARCHAR(50) NOT NULL UNIQUE,
    payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    status VARCHAR(50) NOT NULL DEFAULT 'RECORDED',
    provider_reference VARCHAR(255),
    provider_event_reference VARCHAR(255),
    related_opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    related_mou_id UUID REFERENCES deal_mous(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50),
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ledger_tx_type CHECK (transaction_type IN ('PAYMENT_CREATED', 'PAYMENT_AUTHORIZED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'REFUND_FAILED', 'RECONCILIATION_CORRECTION')),
    CONSTRAINT chk_ledger_status CHECK (status IN ('RECORDED', 'CLEARED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_payment_ledger_intent ON payment_ledger (payment_intent_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_mou ON payment_ledger (related_mou_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_ledger_opp ON payment_ledger (related_opportunity_id);

-- 5. PAYMENT WEBHOOK EVENTS TABLE (Replay Protection & Event Deduplication)
CREATE TABLE IF NOT EXISTS payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
    payload_hash VARCHAR(64) NOT NULL,
    raw_payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_payment_webhook_provider_event UNIQUE (provider, event_id),
    CONSTRAINT chk_webhook_event_status CHECK (status IN ('PROCESSED', 'IGNORED', 'REJECTED', 'FAILED', 'DUPLICATE'))
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_provider ON payment_webhook_events (provider, status);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_intent ON payment_webhook_events (payment_intent_id);

-- 6. SEED PHASE 11 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('payments.create', 'payments', 'Create payment intents for accepted deal MOUs'),
('payments.read_own', 'payments', 'View own payment intents and earnest deposit status'),
('payments.cancel', 'payments', 'Cancel pending payment intents'),
('payments.read_all', 'payments', 'Administrative view of all payment intents and ledger'),
('payments.manage', 'payments', 'Administrative management and oversight of payments'),
('payments.reconcile', 'payments', 'Perform payment reconciliation and correction')
ON CONFLICT (code) DO NOTHING;

-- Grant to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('payments.create', 'payments.read_own', 'payments.cancel', 'payments.initiate')
ON CONFLICT DO NOTHING;

-- Grant to Seller roles (read_own only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('payments.read_own')
ON CONFLICT DO NOTHING;

-- Grant to Finance roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('FINANCE')
AND p.code IN ('payments.verify', 'payments.refund', 'payments.read_all', 'payments.manage', 'payments.reconcile')
ON CONFLICT DO NOTHING;

-- Grant to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN ('payments.create', 'payments.initiate', 'payments.verify', 'payments.refund', 'payments.cancel', 'payments.read_all', 'payments.manage', 'payments.reconcile')
ON CONFLICT DO NOTHING;
