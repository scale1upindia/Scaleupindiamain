-- Scale-up India — Phase 9: Secure Deal Communication & Messaging Migration
-- Migration: 009_secure_deal_communication.sql

-- 1. REFERENCE SEQUENCE FOR CONVERSATIONS
CREATE SEQUENCE IF NOT EXISTS conv_ref_seq START WITH 10001;

-- 2. DEAL CONVERSATIONS TABLE
CREATE TABLE IF NOT EXISTS deal_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    eoi_id UUID NOT NULL REFERENCES expressions_of_interest(id) ON DELETE CASCADE,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE CASCADE,
    data_room_id UUID REFERENCES data_rooms(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    title VARCHAR(255) NOT NULL DEFAULT 'Confidential Deal Discussion',
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    -- 'ACTIVE', 'CLOSED', 'REVOKED'
    
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    close_reason TEXT,
    
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revocation_reason TEXT,
    
    last_message_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Index: Exactly ONE active or closed conversation per bilateral NDA
CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_conv_active_nda 
ON deal_conversations (nda_id) 
WHERE status IN ('ACTIVE', 'CLOSED');

CREATE INDEX IF NOT EXISTS idx_deal_conv_opp ON deal_conversations (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_conv_buyer ON deal_conversations (buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_conv_seller ON deal_conversations (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_conv_eoi ON deal_conversations (eoi_id);

-- 3. DEAL CONVERSATION PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS deal_conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES deal_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'BUYER', 'SELLER', 'ADMIN'
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'MUTED', 'REVOKED'
    
    last_read_message_id UUID,
    last_read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_deal_conv_participant UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_participants_user ON deal_conversation_participants (user_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_participants_conv ON deal_conversation_participants (conversation_id);

-- 4. DEAL MESSAGES TABLE
CREATE TABLE IF NOT EXISTS deal_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES deal_conversations(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    content TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT', -- 'SENT', 'SOFT_DELETED'
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_deal_messages_conv_created ON deal_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_messages_sender ON deal_messages (sender_user_id);

-- 5. SEED PHASE 9 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('messaging.read', 'messaging', 'Read authorized confidential deal conversations and messages'),
('messaging.send', 'messaging', 'Send messages in authorized deal conversations'),
('messaging.close', 'messaging', 'Close an active deal conversation'),
('messaging.manage', 'messaging', 'Administrative management and revocation of deal conversations'),
('messaging.read_all', 'messaging', 'Administrative compliance view of all deal conversations')
ON CONFLICT (code) DO NOTHING;

-- Grant to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('messaging.read', 'messaging.send', 'messaging.close')
ON CONFLICT DO NOTHING;

-- Grant to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('messaging.read', 'messaging.send', 'messaging.close')
ON CONFLICT DO NOTHING;

-- Grant to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN ('messaging.read', 'messaging.send', 'messaging.close', 'messaging.manage', 'messaging.read_all')
ON CONFLICT DO NOTHING;
