-- Scale-up India — Phase 2: Seller / Promoter Onboarding & Business Profiling Migration
-- Migration: 002_seller_onboarding.sql

-- 1. SELLER PROFILES
CREATE TABLE IF NOT EXISTS seller_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    designation VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    preferred_comm_method VARCHAR(50) NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL', 'PHONE', 'WHATSAPP'
    onboarding_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', 
    -- 'NOT_STARTED', 'DRAFT', 'PROFILE_INCOMPLETE', 'READY_FOR_REVIEW', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VERIFIED', 'REJECTED'
    current_step INT NOT NULL DEFAULT 1,
    completion_percentage INT NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    changes_requested_notes TEXT,
    assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 2. BUSINESS PROFILES
CREATE TABLE IF NOT EXISTS business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL UNIQUE REFERENCES seller_profiles(id) ON DELETE CASCADE,
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    business_type VARCHAR(100) NOT NULL, -- 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'LLP', 'PARTNERSHIP_FIRM', 'SOLE_PROPRIETORSHIP', 'OTHER'
    cin VARCHAR(21),
    gstin VARCHAR(15),
    pan VARCHAR(10),
    industry VARCHAR(100) NOT NULL,
    sub_sector VARCHAR(100),
    year_established INT NOT NULL,
    registered_state VARCHAR(100) NOT NULL,
    registered_city VARCHAR(100) NOT NULL,
    operating_locations JSONB DEFAULT '[]'::jsonb,
    employee_count INT NOT NULL DEFAULT 0 CHECK (employee_count >= 0),
    business_description TEXT NOT NULL,
    website VARCHAR(255),
    msme_status VARCHAR(50) DEFAULT 'NONE', -- 'MICRO', 'SMALL', 'MEDIUM', 'NONE'
    other_registrations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. BUSINESS FINANCIAL PROFILES (Normalized multiple financial years)
CREATE TABLE IF NOT EXISTS business_financial_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    financial_year VARCHAR(20) NOT NULL, -- e.g., '2023-24'
    revenue NUMERIC(15, 2) NOT NULL CHECK (revenue >= 0),
    ebitda NUMERIC(15, 2) NOT NULL,
    pat NUMERIC(15, 2) NOT NULL,
    net_worth NUMERIC(15, 2) NOT NULL,
    debt NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (debt >= 0),
    assets NUMERIC(15, 2) NOT NULL CHECK (assets >= 0),
    liabilities NUMERIC(15, 2) NOT NULL CHECK (liabilities >= 0),
    cash_flow NUMERIC(15, 2),
    is_audited BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(seller_profile_id, financial_year)
);

-- 4. BUSINESS OWNERSHIP
CREATE TABLE IF NOT EXISTS business_ownerships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    owner_type VARCHAR(50) NOT NULL, -- 'INDIVIDUAL_PROMOTER', 'CORPORATE_ENTITY', 'PE_VC_FUND', 'ESOP_POOL', 'OTHER'
    owner_name VARCHAR(255) NOT NULL,
    ownership_percentage NUMERIC(5, 2) NOT NULL CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
    holding_entity VARCHAR(255),
    role VARCHAR(100),
    control_rights TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. SELLER TRANSACTION PREFERENCES
CREATE TABLE IF NOT EXISTS seller_transaction_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL UNIQUE REFERENCES seller_profiles(id) ON DELETE CASCADE,
    intents JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['FULL_SALE', 'PARTIAL_STAKE_SALE', 'INVESTMENT', 'JOINT_VENTURE', 'STRATEGIC_PARTNERSHIP', 'ASSET_SALE']
    stake_offered_percentage NUMERIC(5, 2) CHECK (stake_offered_percentage IS NULL OR (stake_offered_percentage >= 0 AND stake_offered_percentage <= 100)),
    expected_valuation NUMERIC(15, 2) CHECK (expected_valuation IS NULL OR expected_valuation >= 0),
    expected_transaction_value NUMERIC(15, 2) CHECK (expected_transaction_value IS NULL OR expected_transaction_value >= 0),
    min_acceptable_terms TEXT,
    preferred_timeline VARCHAR(100),
    preferred_buyer_type JSONB DEFAULT '[]'::jsonb,
    strategic_objectives TEXT,
    reason_for_transaction TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. SELLER DOCUMENTS (Secure Private Storage Metadata)
CREATE TABLE IF NOT EXISTS seller_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, -- 'INCORPORATION_CERT', 'PAN_CARD', 'GST_REGISTRATION', 'AUDITED_FINANCIALS', 'ITR_ACKNOWLEDGEMENT', 'FORM_26AS', 'SHAREHOLDING_PATTERN', 'REGULATORY_APPROVAL', 'OTHER'
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 15728640),
    checksum_sha256 VARCHAR(64) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REJECTED'
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 7. SELLER INTERNAL NOTES (Never exposed to sellers)
CREATE TABLE IF NOT EXISTS seller_internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL', -- 'GENERAL', 'COMPLIANCE', 'FINANCIAL', 'VALUATION', 'RISK'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. ONBOARDING PROGRESS (Server-side draft store)
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_profile_id UUID NOT NULL UNIQUE REFERENCES seller_profiles(id) ON DELETE CASCADE,
    sections_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_active_section VARCHAR(50) NOT NULL DEFAULT 'promoter',
    draft_payload JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. SEED PHASE 2 PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('sellers.read', 'sellers', 'Inspect seller onboarding profiles and sensitive data'),
('sellers.review', 'sellers', 'Review submitted seller dossiers and add internal notes'),
('sellers.verify', 'sellers', 'Approve and verify seller onboarding submissions')
ON CONFLICT (code) DO NOTHING;

-- Grant to SUPER_ADMIN, ADMIN, VERIFICATION_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'VERIFICATION_MANAGER')
AND p.code IN ('sellers.read', 'sellers.review', 'sellers.verify')
ON CONFLICT DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_seller_profiles_user ON seller_profiles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON seller_profiles(onboarding_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_business_profiles_seller ON business_profiles(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_financials_seller ON business_financial_profiles(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_business_ownership_seller ON business_ownerships(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_seller_documents_seller ON seller_documents(seller_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seller_documents_owner ON seller_documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_seller_internal_notes_seller ON seller_internal_notes(seller_profile_id);

