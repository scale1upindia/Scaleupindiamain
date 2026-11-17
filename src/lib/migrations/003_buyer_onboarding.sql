-- Scale-up India — Phase 3: Buyer / Investor Onboarding & Acquisition Mandate Migration
-- Migration: 003_buyer_onboarding.sql

-- 1. BUYER / INVESTOR PROFILES
CREATE TABLE IF NOT EXISTS buyer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    buyer_type VARCHAR(100) NOT NULL, 
    -- 'INDIVIDUAL_INVESTOR', 'CORPORATE_BUYER', 'PE_FUND', 'VC_FUND', 'FAMILY_OFFICE', 'STRATEGIC_PARTNER', 'OTHER'
    
    -- Organization & Entity Details
    legal_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    entity_type VARCHAR(100) NOT NULL, -- 'COMPANY', 'FUND', 'FAMILY_OFFICE', 'INDIVIDUAL', 'LLP', 'PARTNERSHIP', 'OTHER'
    registration_number VARCHAR(100),
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    state VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    website VARCHAR(255),
    year_established INT,
    industry VARCHAR(100),
    description TEXT,
    
    -- Fund / Financial Scale Metrics (Optional for corporate/individual, relevant for PE/VC/Funds)
    fund_size NUMERIC(15, 2),
    aum NUMERIC(15, 2),
    current_vintage INT,
    typical_ticket_size NUMERIC(15, 2),

    -- Authorized Representative / Contact Person
    contact_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    preferred_comm_method VARCHAR(50) NOT NULL DEFAULT 'IN_APP', -- 'IN_APP', 'EMAIL', 'PHONE', 'WHATSAPP'

    -- Workflow & State Machine
    onboarding_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    -- 'NOT_STARTED', 'DRAFT', 'PROFILE_INCOMPLETE', 'MANDATE_INCOMPLETE', 'READY_FOR_REVIEW', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VERIFIED', 'REJECTED', 'SUSPENDED'
    completion_percentage INT NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    changes_requested_notes TEXT,
    suspension_reason TEXT,
    assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    suspended_at TIMESTAMPTZ,
    suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 2. ACQUISITION MANDATES (Multiple per buyer)
CREATE TABLE IF NOT EXISTS acquisition_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED'
    
    -- Financial Capacity & Parameters
    min_investment NUMERIC(15, 2) NOT NULL CHECK (min_investment >= 0),
    max_investment NUMERIC(15, 2) NOT NULL CHECK (max_investment >= min_investment),
    preferred_ticket_size NUMERIC(15, 2) CHECK (preferred_ticket_size IS NULL OR (preferred_ticket_size >= min_investment AND preferred_ticket_size <= max_investment)),
    available_capital NUMERIC(15, 2) CHECK (available_capital IS NULL OR available_capital >= 0),
    financing_requirement VARCHAR(100),
    debt_equity_preference VARCHAR(100),

    -- Target Business Size
    revenue_min NUMERIC(15, 2) DEFAULT 0 CHECK (revenue_min >= 0),
    revenue_max NUMERIC(15, 2) CHECK (revenue_max IS NULL OR revenue_max >= revenue_min),
    ebitda_min NUMERIC(15, 2),
    ebitda_max NUMERIC(15, 2) CHECK (ebitda_max IS NULL OR ebitda_min IS NULL OR ebitda_max >= ebitda_min),
    employee_min INT DEFAULT 0 CHECK (employee_min >= 0),
    employee_max INT CHECK (employee_max IS NULL OR employee_max >= employee_min),
    business_age_min INT DEFAULT 0 CHECK (business_age_min >= 0),
    business_age_max INT CHECK (business_age_max IS NULL OR business_age_max >= business_age_min),
    net_worth_min NUMERIC(15, 2),
    net_worth_max NUMERIC(15, 2) CHECK (net_worth_max IS NULL OR net_worth_min IS NULL OR net_worth_max >= net_worth_min),

    -- Transaction Preferences & Governance
    transaction_types JSONB NOT NULL DEFAULT '[]'::jsonb, 
    -- ['FULL_ACQUISITION', 'MAJORITY_STAKE', 'MINORITY_STAKE', 'STRATEGIC_INVESTMENT', 'PRIVATE_EQUITY', 'VENTURE_INVESTMENT', 'JOINT_VENTURE', 'STRATEGIC_PARTNERSHIP', 'ASSET_ACQUISITION']
    control_preference VARCHAR(100) NOT NULL DEFAULT 'MAJORITY_CONTROL', 
    -- 'FULL_CONTROL', 'MAJORITY_CONTROL', 'JOINT_CONTROL', 'MINORITY', 'NO_CONTROL_FINANCIAL'
    
    -- Strategic Objectives
    strategic_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    other_strategic_objective TEXT,

    -- Seller / Target Preferences
    preferred_business_age VARCHAR(100),
    promoter_involvement VARCHAR(100),
    promoter_exit_preference VARCHAR(100),
    existing_management_retention VARCHAR(100),
    turnaround_opportunities BOOLEAN DEFAULT FALSE,
    profitable_businesses_only BOOLEAN DEFAULT TRUE,
    growth_stage BOOLEAN DEFAULT TRUE,
    distressed_opportunities BOOLEAN DEFAULT FALSE,
    asset_preference VARCHAR(50) DEFAULT 'FLEXIBLE', -- 'ASSET_HEAVY', 'ASSET_LIGHT', 'FLEXIBLE'

    -- Investment Horizon & Funding
    investment_horizon VARCHAR(50) NOT NULL DEFAULT 'MEDIUM_TERM', -- 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'
    expected_holding_period_years INT,
    funding_source VARCHAR(100) NOT NULL DEFAULT 'OWN_CAPITAL', -- 'OWN_CAPITAL', 'FUND_CAPITAL', 'BANK_DEBT', 'INSTITUTIONAL_DEBT', 'CO_INVESTMENT', 'COMBINATION'

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 3. MANDATE TARGET INDUSTRIES (Taxonomy with sub-sectors)
CREATE TABLE IF NOT EXISTS mandate_target_industries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandate_id UUID NOT NULL REFERENCES acquisition_mandates(id) ON DELETE CASCADE,
    industry VARCHAR(100) NOT NULL,
    sub_sectors JSONB NOT NULL DEFAULT '[]'::jsonb,
    other_sub_sector VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mandate_id, industry)
);

-- 4. MANDATE TARGET GEOGRAPHIES
CREATE TABLE IF NOT EXISTS mandate_target_geographies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mandate_id UUID NOT NULL REFERENCES acquisition_mandates(id) ON DELETE CASCADE,
    region VARCHAR(50) NOT NULL, -- 'PAN_INDIA', 'NORTH_INDIA', 'SOUTH_INDIA', 'EAST_INDIA', 'WEST_INDIA', 'GLOBAL', 'SPECIFIC_STATES'
    countries JSONB NOT NULL DEFAULT '["India"]'::jsonb,
    states JSONB NOT NULL DEFAULT '[]'::jsonb,
    cities JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. BUYER DOCUMENTS (Private Storage Vault)
CREATE TABLE IF NOT EXISTS buyer_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mandate_id UUID REFERENCES acquisition_mandates(id) ON DELETE SET NULL,
    document_type VARCHAR(100) NOT NULL, 
    -- 'COMPANY_REGISTRATION', 'FUND_PROFILE', 'AUTHORIZATION_LETTER', 'INVESTMENT_MANDATE', 'PROOF_OF_FUNDS', 'CORPORATE_PROFILE', 'OTHER'
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

-- 6. BUYER INTERNAL NOTES (Strictly Confidential, Staff Only)
CREATE TABLE IF NOT EXISTS buyer_internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL', -- 'GENERAL', 'COMPLIANCE', 'FINANCIAL', 'MANDATE', 'RISK'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. BUYER ONBOARDING PROGRESS (Server-side draft autosave)
CREATE TABLE IF NOT EXISTS buyer_onboarding_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_profile_id UUID NOT NULL UNIQUE REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    sections_completed JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_active_step INT NOT NULL DEFAULT 1,
    draft_payload JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. SEED PHASE 3 PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('buyers.read', 'buyers', 'Inspect buyer onboarding profiles, sensitive criteria, and mandates'),
('buyers.review', 'buyers', 'Review submitted buyer dossiers and log internal diligence notes'),
('buyers.verify', 'buyers', 'Approve and verify buyer and investor onboarding profiles'),
('buyers.suspend', 'buyers', 'Suspend buyer profile and mandate permissions')
ON CONFLICT (code) DO NOTHING;

-- Grant to SUPER_ADMIN, ADMIN, VERIFICATION_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'VERIFICATION_MANAGER')
AND p.code IN ('buyers.read', 'buyers.review', 'buyers.verify', 'buyers.suspend')
ON CONFLICT DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_user ON buyer_profiles(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_status ON buyer_profiles(onboarding_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acquisition_mandates_buyer ON acquisition_mandates(buyer_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_acquisition_mandates_status ON acquisition_mandates(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_mandate_industries_mandate ON mandate_target_industries(mandate_id);
CREATE INDEX IF NOT EXISTS idx_mandate_geographies_mandate ON mandate_target_geographies(mandate_id);
CREATE INDEX IF NOT EXISTS idx_buyer_documents_buyer ON buyer_documents(buyer_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_documents_owner ON buyer_documents(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_buyer_internal_notes_buyer ON buyer_internal_notes(buyer_profile_id);

