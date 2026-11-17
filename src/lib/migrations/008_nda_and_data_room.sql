-- Scale-up India — Phase 8: Bilateral NDA & Secure Data Room Migration
-- Migration: 008_nda_and_data_room.sql

-- 1. REFERENCE SEQUENCES
CREATE SEQUENCE IF NOT EXISTS nda_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS vdr_ref_seq START WITH 10001;

-- 2. BILATERAL NDA AGREEMENTS TABLE
CREATE TABLE IF NOT EXISTS nda_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    eoi_id UUID NOT NULL REFERENCES expressions_of_interest(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Versioning & Legal Document Reference
    nda_version VARCHAR(50) NOT NULL DEFAULT 'v1.0-standard',
    document_reference VARCHAR(255) NOT NULL DEFAULT 'SCALEUP-STANDARD-BILATERAL-NDA-2026',
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'NDA_SENT',
    -- 'NDA_DRAFT', 'NDA_SENT', 'BUYER_VIEWED', 'BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXECUTED', 'DECLINED', 'EXPIRED', 'REVOKED'
    
    -- Workflow Metadata
    created_by UUID NOT NULL REFERENCES users(id),
    buyer_viewed_at TIMESTAMPTZ,
    seller_viewed_at TIMESTAMPTZ,
    
    -- Bilateral Acceptance Metadata (Zero homemade crypto signature claims)
    buyer_accepted_at TIMESTAMPTZ,
    buyer_ip VARCHAR(100),
    buyer_user_agent TEXT,
    
    seller_accepted_at TIMESTAMPTZ,
    seller_ip VARCHAR(100),
    seller_user_agent TEXT,
    
    executed_at TIMESTAMPTZ,
    
    -- Terminal Actions
    declined_at TIMESTAMPTZ,
    declined_by UUID REFERENCES users(id),
    decline_reason TEXT,
    
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Partial Unique Index: Only ONE active NDA per buyer and opportunity
CREATE UNIQUE INDEX IF NOT EXISTS idx_nda_active_buyer_opp 
ON nda_agreements (buyer_id, opportunity_id) 
WHERE status IN ('NDA_DRAFT', 'NDA_SENT', 'BUYER_VIEWED', 'BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXECUTED');

CREATE INDEX IF NOT EXISTS idx_nda_opportunity ON nda_agreements (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_nda_buyer ON nda_agreements (buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nda_seller ON nda_agreements (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nda_eoi ON nda_agreements (eoi_id);

-- 3. SECURE DATA ROOMS TABLE
CREATE TABLE IF NOT EXISTS data_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_NDA',
    -- 'PENDING_NDA', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED'
    
    activated_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days')
);

-- Only ONE active data room per NDA agreement
CREATE UNIQUE INDEX IF NOT EXISTS idx_vdr_active_nda 
ON data_rooms (nda_id) 
WHERE status IN ('PENDING_NDA', 'ACTIVE');

CREATE INDEX IF NOT EXISTS idx_vdr_opportunity ON data_rooms (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_vdr_seller ON data_rooms (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_vdr_buyer ON data_rooms (buyer_id, status);

-- 4. DATA ROOM MEMBERS TABLE (Explicit Server-Side Authorization Boundary)
CREATE TABLE IF NOT EXISTS data_room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_room_id UUID NOT NULL REFERENCES data_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'BUYER', 'SELLER', 'ADMIN'
    access_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'SUSPENDED'
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    expires_at TIMESTAMPTZ,
    UNIQUE (data_room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vdr_members_user ON data_room_members (user_id, access_status);
CREATE INDEX IF NOT EXISTS idx_vdr_members_room ON data_room_members (data_room_id, access_status);

-- 5. DATA ROOM CONFIDENTIAL DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS data_room_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_room_id UUID NOT NULL REFERENCES data_rooms(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    
    -- Whitelisted Categories
    document_category VARCHAR(100) NOT NULL,
    -- 'FINANCIAL', 'TAX', 'LEGAL', 'CORPORATE', 'OPERATIONAL', 'COMMERCIAL', 'HR', 'TECHNICAL', 'OTHER'
    
    -- Access Level
    access_level VARCHAR(50) NOT NULL DEFAULT 'ROOM_MEMBER',
    -- 'ROOM_MEMBER', 'AUTHORIZED_BUYER', 'AUTHORIZED_SELLER', 'ADMIN'
    
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL, -- SHA-256
    
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'DELETED', 'REVOKED'
    download_count INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_vdr_docs_room ON data_room_documents (data_room_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vdr_docs_category ON data_room_documents (data_room_id, document_category);

-- 6. SEED PHASE 8 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('nda.create', 'nda', 'Initiate bilateral non-disclosure agreement on accepted EOI'),
('nda.read_own', 'nda', 'Read own bilateral NDA agreements'),
('nda.accept', 'nda', 'Formally acknowledge and accept bilateral NDA terms'),
('nda.decline', 'nda', 'Decline bilateral NDA terms'),
('nda.read_all', 'nda', 'Administrative diligence view of all NDA agreements'),
('nda.manage', 'nda', 'Administrative management and revocation of NDA agreements'),
('vdr.access', 'dataroom', 'Access authorized virtual data rooms'),
('vdr.upload', 'dataroom', 'Upload confidential business documents to data room'),
('vdr.download', 'dataroom', 'Download documents and generate signed access URLs in data room'),
('vdr.manage', 'dataroom', 'Manage data room members and confidential files'),
('vdr.read_all', 'dataroom', 'Administrative audit access to all virtual data rooms')
ON CONFLICT (code) DO NOTHING;

-- Grant to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('nda.create', 'nda.read_own', 'nda.accept', 'nda.decline', 'vdr.access', 'vdr.download')
ON CONFLICT DO NOTHING;

-- Grant to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('nda.read_own', 'nda.accept', 'nda.decline', 'vdr.access', 'vdr.upload', 'vdr.download', 'vdr.manage')
ON CONFLICT DO NOTHING;

-- Grant to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN (
    'nda.create', 'nda.read_own', 'nda.accept', 'nda.decline', 'nda.read_all', 'nda.manage',
    'vdr.access', 'vdr.upload', 'vdr.download', 'vdr.manage', 'vdr.read_all'
)
ON CONFLICT DO NOTHING;
