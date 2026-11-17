-- Scale-up India — Phase 12: Due Diligence Workspace & Evidence Management Migration
-- Migration: 012_due_diligence.sql

-- 1. REFERENCE SEQUENCES
CREATE SEQUENCE IF NOT EXISTS dd_case_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS dd_req_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS dd_evd_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS dd_fnd_ref_seq START WITH 10001;

-- 2. DUE DILIGENCE CASES TABLE
CREATE TABLE IF NOT EXISTS due_diligence_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE CASCADE,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE CASCADE,
    token_deposit_id UUID REFERENCES token_deposits(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    lead_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'CREATED',
    scope_description TEXT,
    target_completion_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    closure_reason TEXT,
    verdict VARCHAR(50), -- 'APPROVED', 'REJECTED', 'CONDITIONAL_APPROVAL'
    verdict_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_case_status CHECK (status IN (
        'CREATED', 'INITIATED', 'REQUESTS_OPEN', 'DOCUMENTS_SUBMITTED', 
        'UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'REVIEW_COMPLETE', 
        'APPROVED', 'REJECTED', 'CLOSED'
    )),
    CONSTRAINT chk_dd_case_verdict CHECK (verdict IS NULL OR verdict IN (
        'APPROVED', 'REJECTED', 'CONDITIONAL_APPROVAL'
    ))
);

-- Partial Unique Index: At most ONE active diligence case per accepted MOU
CREATE UNIQUE INDEX IF NOT EXISTS idx_dd_active_mou 
ON due_diligence_cases (mou_id) 
WHERE status NOT IN ('CLOSED', 'REJECTED');

CREATE INDEX IF NOT EXISTS idx_dd_case_opp ON due_diligence_cases (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_case_buyer ON due_diligence_cases (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_case_seller ON due_diligence_cases (seller_id, status);

-- 3. DUE DILIGENCE MEMBERS / REVIEWERS TABLE
CREATE TABLE IF NOT EXISTS diligence_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'BUYER', 'SELLER', 'REVIEWER', 'LEAD_REVIEWER', 'ADMIN'
    access_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'SUSPENDED'
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT,
    
    CONSTRAINT uq_diligence_member_case_user UNIQUE (case_id, user_id),
    CONSTRAINT chk_dd_member_role CHECK (role IN ('BUYER', 'SELLER', 'REVIEWER', 'LEAD_REVIEWER', 'ADMIN')),
    CONSTRAINT chk_dd_member_status CHECK (access_status IN ('ACTIVE', 'REVOKED', 'SUSPENDED'))
);

CREATE INDEX IF NOT EXISTS idx_dd_members_case ON diligence_members (case_id, access_status);
CREATE INDEX IF NOT EXISTS idx_dd_members_user ON diligence_members (user_id, access_status);

-- 4. DUE DILIGENCE CHECKLIST ITEMS TABLE
CREATE TABLE IF NOT EXISTS diligence_checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    requested_evidence_type VARCHAR(255) NOT NULL,
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    due_date TIMESTAMPTZ,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    seller_notes TEXT,
    evidence_count INT NOT NULL DEFAULT 0,
    sort_order INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_item_category CHECK (category IN (
        'CORPORATE_LEGAL', 'OWNERSHIP', 'FINANCIAL', 'TAX', 'BANKING', 
        'COMPLIANCE', 'CONTRACTS', 'INTELLECTUAL_PROPERTY', 'EMPLOYEES_HR', 
        'LITIGATION', 'REGULATORY', 'TECHNOLOGY', 'ASSETS', 'LIABILITIES', 
        'CUSTOMERS_VENDORS', 'INSURANCE', 'OTHER'
    )),
    CONSTRAINT chk_dd_item_status CHECK (status IN (
        'PENDING', 'REQUESTED', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW', 
        'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUIRED', 'WAIVED'
    )),
    CONSTRAINT chk_dd_item_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_dd_items_case ON diligence_checklist_items (case_id, category, status);
CREATE INDEX IF NOT EXISTS idx_dd_items_status ON diligence_checklist_items (case_id, status);

-- 5. DUE DILIGENCE DOCUMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS diligence_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES diligence_checklist_items(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_party_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_description TEXT NOT NULL,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    due_date TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_req_status CHECK (status IN (
        'OPEN', 'SUBMITTED', 'IN_REVIEW', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUESTED', 'CANCELLED'
    )),
    CONSTRAINT chk_dd_req_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_dd_req_case ON diligence_requests (case_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_req_item ON diligence_requests (checklist_item_id);
CREATE INDEX IF NOT EXISTS idx_dd_req_assigned ON diligence_requests (assigned_party_id, status);

-- 6. DUE DILIGENCE EVIDENCE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS diligence_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES diligence_checklist_items(id) ON DELETE CASCADE,
    request_id UUID REFERENCES diligence_requests(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    current_version_number INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_confidential BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_evd_status CHECK (status IN (
        'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_dd_evd_case ON diligence_evidence (case_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_evd_item ON diligence_evidence (checklist_item_id);

-- 7. DUE DILIGENCE EVIDENCE VERSIONS TABLE (Immutable Versioning & Provenance)
CREATE TABLE IF NOT EXISTS diligence_evidence_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES diligence_evidence(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    storage_key VARCHAR(500) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    checksum VARCHAR(64) NOT NULL, -- SHA-256
    review_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_REVIEW',
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,
    rejection_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_dd_evidence_version UNIQUE (evidence_id, version_number),
    CONSTRAINT chk_dd_ver_status CHECK (review_status IN (
        'PENDING_REVIEW', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUIRED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_dd_ver_evidence ON diligence_evidence_versions (evidence_id, version_number DESC);

-- 8. DUE DILIGENCE CLARIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS diligence_clarifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES diligence_checklist_items(id) ON DELETE CASCADE,
    evidence_id UUID REFERENCES diligence_evidence(id) ON DELETE SET NULL,
    version_id UUID REFERENCES diligence_evidence_versions(id) ON DELETE SET NULL,
    raised_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    responded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    response_text TEXT,
    responded_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_clarification_status CHECK (status IN ('OPEN', 'ANSWERED', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_dd_clarifications_case ON diligence_clarifications (case_id, status);
CREATE INDEX IF NOT EXISTS idx_dd_clarifications_item ON diligence_clarifications (checklist_item_id);

-- 9. DUE DILIGENCE FINDINGS / ISSUES TABLE
CREATE TABLE IF NOT EXISTS diligence_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES diligence_checklist_items(id) ON DELETE SET NULL,
    evidence_id UUID REFERENCES diligence_evidence(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    severity VARCHAR(50) NOT NULL DEFAULT 'MEDIUM',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    financial_impact_estimate NUMERIC(18, 2),
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    remediation_plan TEXT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_dd_finding_category CHECK (category IN (
        'CORPORATE_LEGAL', 'OWNERSHIP', 'FINANCIAL', 'TAX', 'BANKING', 
        'COMPLIANCE', 'CONTRACTS', 'INTELLECTUAL_PROPERTY', 'EMPLOYEES_HR', 
        'LITIGATION', 'REGULATORY', 'TECHNOLOGY', 'ASSETS', 'LIABILITIES', 
        'CUSTOMERS_VENDORS', 'INSURANCE', 'OTHER'
    )),
    CONSTRAINT chk_dd_finding_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_dd_finding_status CHECK (status IN (
        'OPEN', 'UNDER_DISCUSSION', 'MITIGATED', 'ACCEPTED_RISK', 'RESOLVED', 'CLOSED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_dd_findings_case ON diligence_findings (case_id, severity, status);

-- 10. SEED PHASE 12 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('diligence.create', 'diligence', 'Initialize due diligence case for accepted MOU'),
('diligence.read_own', 'diligence', 'View participating due diligence workspace and checklist'),
('diligence.read_all', 'diligence', 'Administrative and audit view of all diligence cases'),
('diligence.manage', 'diligence', 'Administrative lifecycle management and verdict override'),
('diligence.request_docs', 'diligence', 'Request evidence on diligence checklist items'),
('diligence.upload_evidence', 'diligence', 'Upload and submit evidence documents for diligence requests'),
('diligence.review', 'diligence', 'Review, accept, reject, or request clarification on diligence evidence'),
('diligence.findings', 'diligence', 'Create, update, and resolve diligence risk findings'),
('diligence.download', 'diligence', 'Generate signed download tokens for authorized diligence evidence')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('diligence.create', 'diligence.read_own', 'diligence.request_docs', 'diligence.download', 'diligence.findings')
ON CONFLICT DO NOTHING;

-- Grant permissions to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('diligence.read_own', 'diligence.upload_evidence', 'diligence.download')
ON CONFLICT DO NOTHING;

-- Grant permissions to Diligence Reviewer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('DUE_DILIGENCE', 'LEGAL', 'FINANCE')
AND p.code IN ('diligence.read_own', 'diligence.read_all', 'diligence.request_docs', 'diligence.review', 'diligence.findings', 'diligence.download')
ON CONFLICT DO NOTHING;

-- Grant permissions to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN (
    'diligence.create', 'diligence.read_own', 'diligence.read_all', 'diligence.manage',
    'diligence.request_docs', 'diligence.upload_evidence', 'diligence.review', 
    'diligence.findings', 'diligence.download'
)
ON CONFLICT DO NOTHING;
