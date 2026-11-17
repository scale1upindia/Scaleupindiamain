-- Scale-up India — Phase 4: Opportunity Management & Progressive Data Masking Migration
-- Migration: 004_opportunity_management.sql

-- 1. REFERENCE SEQUENCE FOR BLIND TEASER CODES
CREATE SEQUENCE IF NOT EXISTS opportunity_ref_seq START WITH 1001;

-- 2. OPPORTUNITIES TABLE
CREATE TABLE IF NOT EXISTS opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Public / Teaser Information (Tier 0)
    title VARCHAR(255) NOT NULL,
    headline TEXT,
    teaser_summary TEXT NOT NULL,
    business_category VARCHAR(100) NOT NULL, 
    -- 'MANUFACTURING', 'SERVICES', 'TECHNOLOGY', 'HEALTHCARE', 'CONSUMER_RETAIL', 'LOGISTICS', 'AGRITECH', 'OTHER'
    industry VARCHAR(100) NOT NULL,
    sub_sector VARCHAR(100),
    operating_region VARCHAR(50) NOT NULL, 
    -- 'PAN_INDIA', 'NORTH_INDIA', 'WEST_INDIA', 'SOUTH_INDIA', 'EAST_INDIA', 'CENTRAL_INDIA', 'GLOBAL'
    registered_state VARCHAR(100) NOT NULL,
    registered_city VARCHAR(100), -- Masked from Tier 0/1; unlocked in Tier 2
    approximate_age_bracket VARCHAR(50) NOT NULL, 
    -- 'LESS_THAN_3_YRS', '3_TO_5_YRS', '5_TO_10_YRS', '10_TO_20_YRS', 'OVER_20_YRS'
    revenue_bracket VARCHAR(50) NOT NULL, 
    -- 'UNDER_5CR', '5CR_TO_15CR', '15CR_TO_25CR', '25CR_TO_50CR', '50CR_TO_100CR', '100CR_TO_250CR', 'OVER_250CR'
    transaction_type VARCHAR(100) NOT NULL, 
    -- 'FULL_ACQUISITION', 'MAJORITY_STAKE', 'MINORITY_STAKE', 'JOINT_VENTURE', 'STRATEGIC_PARTNERSHIP', 'ASSET_SALE'

    -- Authenticated Buyer Information (Tier 1)
    detailed_description TEXT,
    business_model VARCHAR(100) NOT NULL DEFAULT 'B2B', 
    -- 'B2B', 'B2C', 'B2B2C', 'D2C', 'CONTRACT_MANUFACTURING', 'SAAS', 'FRANCHISE', 'HYBRID'
    year_established INT,
    employee_range VARCHAR(50), 
    -- '1_TO_10', '11_TO_50', '51_TO_200', '201_TO_500', 'OVER_500'
    customer_scale VARCHAR(255),
    ebitda_margin_bracket VARCHAR(50), 
    -- 'NEGATIVE', '0_TO_10_PCT', '10_TO_20_PCT', '20_TO_30_PCT', 'OVER_30_PCT'
    asking_price_bracket VARCHAR(50), 
    -- 'UNDER_10CR', '10CR_TO_25CR', '25CR_TO_50CR', '50CR_TO_100CR', '100CR_TO_250CR', 'NEGOTIABLE'
    growth_rate_bracket VARCHAR(50), 
    -- 'STABLE', '10_TO_25_PCT', '25_TO_50_PCT', 'OVER_50_PCT'
    facility_details TEXT,
    stake_offered_percentage NUMERIC(5, 2) CHECK (stake_offered_percentage IS NULL OR (stake_offered_percentage >= 0 AND stake_offered_percentage <= 100)),
    promoter_retention_preference VARCHAR(100), 
    -- 'FULL_EXIT', '1_YEAR_TRANSITION', '2_YEAR_TRANSITION', 'RETAIN_MINORITY_STAKE', 'STRATEGIC_ADVISOR', 'OPEN_TO_DISCUSS'
    reason_for_sale TEXT,
    transaction_objective TEXT,

    -- Confidential Underlying Data (Strictly Tier 3 / Staff Review Only)
    exact_legal_name VARCHAR(255),
    exact_trade_name VARCHAR(255),
    exact_cin VARCHAR(21),
    exact_gstin VARCHAR(15),
    exact_pan VARCHAR(10),
    exact_address TEXT,
    exact_revenue NUMERIC(15, 2),
    exact_ebitda NUMERIC(15, 2),
    exact_asking_price NUMERIC(15, 2),

    -- Workflow & State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', 
    -- 'DRAFT', 'READY_FOR_REVIEW', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'VERIFIED', 'PUBLISHED', 'REJECTED', 'SUSPENDED', 'ARCHIVED'
    rejection_reason TEXT,
    changes_requested_notes TEXT,
    suspension_reason TEXT,
    assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ,
    published_by UUID REFERENCES users(id) ON DELETE SET NULL,
    suspended_at TIMESTAMPTZ,
    suspended_by UUID REFERENCES users(id) ON DELETE SET NULL,
    view_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 3. OPPORTUNITY DOCUMENTS (Private Storage Vault with Tier Access Control)
CREATE TABLE IF NOT EXISTS opportunity_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL, 
    -- 'TEASER_DECK', 'EXECUTIVE_SUMMARY', 'FINANCIAL_MODEL', 'STATUTORY_AUDIT', 'FACILITY_PICTURES', 'OTHER'
    access_tier INT NOT NULL DEFAULT 2 CHECK (access_tier IN (1, 2, 3)),
    -- 1 = Authenticated Buyer, 2 = Authorized Buyer (Post-EOI), 3 = Confidential DD Room (Post-NDA)
    original_filename VARCHAR(255) NOT NULL,
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    mime_type VARCHAR(100) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 15728640),
    checksum_sha256 VARCHAR(64) NOT NULL,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'VERIFIED', 'REJECTED'
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 4. OPPORTUNITY INTERNAL NOTES (Staff Reviewer Only)
CREATE TABLE IF NOT EXISTS opportunity_internal_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'CURATION', -- 'CURATION', 'FINANCIAL', 'LEGAL', 'RISK', 'VALUATION'
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. OPPORTUNITY ACCESS GRANTS (Abstraction for Future Workflow Authorization)
CREATE TABLE IF NOT EXISTS opportunity_access_grants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    granted_tier INT NOT NULL CHECK (granted_tier IN (1, 2, 3)),
    granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(opportunity_id, buyer_user_id, granted_tier)
);

-- 6. SEED PHASE 4 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('opportunities.review', 'opportunities', 'Review submitted opportunity listings and manage internal notes'),
('opportunities.update', 'opportunities', 'Update opportunity parameters and curation metadata'),
('opportunities.suspend', 'opportunities', 'Suspend published or active opportunity listings')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to SUPER_ADMIN, ADMIN, VERIFICATION_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'VERIFICATION_MANAGER')
AND p.code IN (
    'opportunities.create',
    'opportunities.read_all',
    'opportunities.review',
    'opportunities.verify',
    'opportunities.publish',
    'opportunities.suspend',
    'opportunities.archive',
    'opportunities.update'
)
ON CONFLICT DO NOTHING;

-- 7. INDEXES FOR HIGH-PERFORMANCE DISCOVERY & FILTERING
CREATE INDEX IF NOT EXISTS idx_opportunities_seller ON opportunities(seller_profile_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_user ON opportunities(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON opportunities(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_ref ON opportunities(reference_code);
CREATE INDEX IF NOT EXISTS idx_opportunities_industry ON opportunities(industry) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_region ON opportunities(operating_region) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_revenue ON opportunities(revenue_bracket) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_trans_type ON opportunities(transaction_type) WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_docs_opp ON opportunity_documents(opportunity_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunity_grants_lookup ON opportunity_access_grants(opportunity_id, buyer_user_id);
