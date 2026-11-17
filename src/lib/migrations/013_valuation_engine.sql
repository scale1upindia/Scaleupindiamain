-- Scale-up India — Phase 13: Valuation Engine & Verified Valuation Workspace
-- Migration: 013_valuation_engine.sql

-- 1. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS val_case_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS val_ver_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS val_inp_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS val_adj_ref_seq START WITH 10001;

-- 2. VALUATION CASES TABLE
CREATE TABLE IF NOT EXISTS valuation_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    diligence_case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE CASCADE,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE CASCADE,
    token_deposit_id UUID REFERENCES token_deposits(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    current_version_number INT NOT NULL DEFAULT 1,
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    locked_at TIMESTAMPTZ,

    CONSTRAINT chk_val_case_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'LOCKED', 'REJECTED'
    ))
);

-- Partial Unique Index: at most ONE active valuation case per diligence case
CREATE UNIQUE INDEX IF NOT EXISTS idx_val_active_case 
ON valuation_cases (diligence_case_id) 
WHERE status NOT IN ('REJECTED', 'CLOSED');

CREATE INDEX IF NOT EXISTS idx_val_case_mou ON valuation_cases (mou_id);
CREATE INDEX IF NOT EXISTS idx_val_case_opp ON valuation_cases (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_val_case_buyer ON valuation_cases (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_val_case_seller ON valuation_cases (seller_id, status);

-- 3. VALUATION VERSIONS TABLE (Immutable Valuation Snapshots)
CREATE TABLE IF NOT EXISTS valuation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    model_inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    methodology_configs JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculation_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    confidence_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    confidence_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    submitted_at TIMESTAMPTZ,
    submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approval_notes TEXT,
    locked_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_val_version UNIQUE (case_id, version_number),
    CONSTRAINT chk_val_version_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'REVISION_REQUIRED', 'APPROVED', 'LOCKED', 'REJECTED'
    )),
    CONSTRAINT chk_val_conf_level CHECK (confidence_level IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX IF NOT EXISTS idx_val_versions_case ON valuation_versions (case_id, version_number DESC);

-- 4. VALUATION FINANCIAL INPUTS TABLE (Provenance-linked to diligence evidence)
CREATE TABLE IF NOT EXISTS valuation_inputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    raw_value NUMERIC(18, 4) NOT NULL,
    normalized_value NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    unit VARCHAR(50) NOT NULL DEFAULT 'INR',
    source_period VARCHAR(50),
    provenance_type VARCHAR(50) NOT NULL DEFAULT 'MANUAL_INPUT',
    evidence_id UUID REFERENCES diligence_evidence(id) ON DELETE SET NULL,
    evidence_version_number INT,
    quality_flag VARCHAR(50) NOT NULL DEFAULT 'VERIFIED',
    notes TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_val_inp_provenance CHECK (provenance_type IN (
        'DILIGENCE_EVIDENCE', 'MANUAL_INPUT', 'AUDITED_STATEMENTS', 'TAX_FILINGS', 'MANAGEMENT_ACCOUNTS'
    )),
    CONSTRAINT chk_val_inp_quality CHECK (quality_flag IN (
        'VERIFIED', 'REVIEW_REQUIRED', 'MANUAL_INPUT', 'STALE', 'INCOMPLETE', 'CONFLICTING', 'UNAVAILABLE'
    )),
    CONSTRAINT chk_val_inp_unit CHECK (unit IN (
        'INR', 'USD', 'EUR', 'GBP', 'THOUSAND', 'LAKH', 'MILLION', 'CRORE', 'BILLION'
    ))
);

CREATE INDEX IF NOT EXISTS idx_val_inputs_version ON valuation_inputs (version_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_val_inputs_evidence ON valuation_inputs (evidence_id);

-- 5. VALUATION ADJUSTMENTS TABLE (Explicit adjustments with rationale & author)
CREATE TABLE IF NOT EXISTS valuation_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(18, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    rationale TEXT NOT NULL,
    source_finding_id UUID REFERENCES diligence_findings(id) ON DELETE SET NULL,
    source_evidence_id UUID REFERENCES diligence_evidence(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_val_adj_type CHECK (adjustment_type IN (
        'ASSET_ADDITION', 'LIABILITY_ADDITION', 'RISK_HAIRCUT', 'TAX_CONTINGENCY', 
        'WORKING_CAPITAL_NORM', 'PROMOTER_INDEMNITY', 'DEPRECIATION_ADJUSTMENT', 'OTHER'
    ))
);

CREATE INDEX IF NOT EXISTS idx_val_adjustments_version ON valuation_adjustments (version_id);
CREATE INDEX IF NOT EXISTS idx_val_adjustments_finding ON valuation_adjustments (source_finding_id);

-- 6. VALUATION COMPARABLES TABLE (Authorized peer/market multiples)
CREATE TABLE IF NOT EXISTS valuation_comparables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    period VARCHAR(50) NOT NULL,
    revenue NUMERIC(18, 4) NOT NULL,
    ebitda NUMERIC(18, 4),
    implied_ev NUMERIC(18, 4) NOT NULL,
    revenue_multiple NUMERIC(10, 4),
    ebitda_multiple NUMERIC(10, 4),
    source VARCHAR(255) NOT NULL,
    source_date DATE,
    confidence VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_val_comp_conf CHECK (confidence IN ('LOW', 'MEDIUM', 'HIGH'))
);

CREATE INDEX IF NOT EXISTS idx_val_comparables_version ON valuation_comparables (version_id);

-- 7. SEED PHASE 13 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('valuation.create', 'valuation', 'Create valuation workspace for eligible due diligence case'),
('valuation.read_own', 'valuation', 'View participating transaction valuation estimates and scenarios'),
('valuation.read_all', 'valuation', 'Administrative and compliance view of all valuation cases'),
('valuation.read_sensitive', 'valuation', 'View reviewer-only internal valuation notes, models, and adjustments'),
('valuation.update', 'valuation', 'Modify valuation assumptions, inputs, and methodologies in draft versions'),
('valuation.submit', 'valuation', 'Submit valuation version for formal counterparty or reviewer evaluation'),
('valuation.review', 'valuation', 'Review valuation version and request revisions'),
('valuation.approve', 'valuation', 'Formally approve valuation version'),
('valuation.lock', 'valuation', 'Lock approved valuation version into immutable permanent state')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('valuation.create', 'valuation.read_own', 'valuation.update', 'valuation.submit', 'valuation.read_sensitive')
ON CONFLICT DO NOTHING;

-- Grant permissions to Seller roles (Progressive disclosure: view approved/disclosed summaries, no sensitive buyer notes)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('valuation.read_own')
ON CONFLICT DO NOTHING;

-- Grant permissions to Diligence & Financial Reviewer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('DUE_DILIGENCE', 'FINANCE', 'LEGAL')
AND p.code IN (
    'valuation.read_own', 'valuation.read_all', 'valuation.read_sensitive',
    'valuation.review', 'valuation.approve', 'valuation.lock'
)
ON CONFLICT DO NOTHING;

-- Grant permissions to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN (
    'valuation.create', 'valuation.read_own', 'valuation.read_all', 'valuation.read_sensitive',
    'valuation.update', 'valuation.submit', 'valuation.review', 'valuation.approve', 'valuation.lock'
)
ON CONFLICT DO NOTHING;
