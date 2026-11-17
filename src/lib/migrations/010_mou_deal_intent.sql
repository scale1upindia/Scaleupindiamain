-- Scale-up India — Phase 10: Deal Intent & Bilateral Memorandum of Understanding (MOU)
-- Migration: 010_mou_deal_intent.sql

-- 1. REFERENCE SEQUENCE FOR MOUS
CREATE SEQUENCE IF NOT EXISTS mou_ref_seq START WITH 10001;

-- 2. DEAL MOUS TABLE
CREATE TABLE IF NOT EXISTS deal_mous (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    eoi_id UUID NOT NULL REFERENCES expressions_of_interest(id) ON DELETE CASCADE,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES deal_conversations(id) ON DELETE SET NULL,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    current_version_number INT NOT NULL DEFAULT 1,
    
    -- State Machine: DRAFT, PROPOSED, COUNTERED, ACCEPTED, REJECTED, WITHDRAWN, EXPIRED
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    
    valid_until TIMESTAMPTZ,
    last_proposed_by UUID REFERENCES users(id),
    last_proposed_at TIMESTAMPTZ,
    
    accepted_at TIMESTAMPTZ,
    accepted_by_buyer_at TIMESTAMPTZ,
    accepted_by_seller_at TIMESTAMPTZ,
    
    rejected_at TIMESTAMPTZ,
    rejected_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    withdrawn_at TIMESTAMPTZ,
    withdrawn_by UUID REFERENCES users(id),
    withdrawal_reason TEXT,
    
    expired_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Index: Exactly ONE active or accepted deal intent MOU per bilateral NDA
CREATE UNIQUE INDEX IF NOT EXISTS idx_mou_active_nda 
ON deal_mous (nda_id) 
WHERE status IN ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_deal_mous_opp ON deal_mous (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_deal_mous_buyer ON deal_mous (buyer_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_mous_seller ON deal_mous (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deal_mous_eoi ON deal_mous (eoi_id);

-- 3. MOU VERSIONS TABLE (Immutable Version History)
CREATE TABLE IF NOT EXISTS mou_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    proposed_by UUID NOT NULL REFERENCES users(id),
    proposed_by_role VARCHAR(50) NOT NULL, -- 'BUYER', 'SELLER'
    status VARCHAR(50) NOT NULL, -- 'DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED', 'REJECTED', 'SUPERSEDED'
    
    -- Commercial Terms
    proposed_valuation NUMERIC(15, 2) NOT NULL CHECK (proposed_valuation > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    proposed_structure VARCHAR(100) NOT NULL, -- 'FULL_ACQUISITION', 'MAJORITY_STAKE', 'MINORITY_STAKE', 'ASSET_PURCHASE', 'JOINT_VENTURE'
    cash_consideration NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (cash_consideration >= 0),
    equity_consideration NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (equity_consideration >= 0),
    earnest_deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (earnest_deposit_amount >= 0),
    exclusivity_period_days INT NOT NULL DEFAULT 30 CHECK (exclusivity_period_days >= 0),
    due_diligence_window_days INT NOT NULL DEFAULT 45 CHECK (due_diligence_window_days >= 0),
    target_closing_date DATE,
    conditions_precedent TEXT[] DEFAULT ARRAY[]::TEXT[],
    key_assumptions TEXT,
    summary_notes TEXT,
    non_binding_disclaimer TEXT NOT NULL DEFAULT 'This Deal Intent / Memorandum of Understanding is an expression of commercial intent and preliminary terms only. It does not constitute a legally binding agreement for the sale or acquisition of the business under applicable law, save for agreed confidentiality and exclusivity obligations.',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_mou_version UNIQUE (mou_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_mou_versions_mou ON mou_versions (mou_id, version_number DESC);

-- 4. SEED PHASE 10 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('mou.create', 'mou', 'Create deal intent drafts for authorized opportunities'),
('mou.read_own', 'mou', 'View authorized deal intent MOUs and versions'),
('mou.propose', 'mou', 'Formally submit deal intent proposals to counterparty'),
('mou.counter', 'mou', 'Submit counterproposals with modified commercial terms'),
('mou.accept', 'mou', 'Bilaterally accept proposed deal intent terms'),
('mou.reject', 'mou', 'Reject proposed deal intent'),
('mou.withdraw', 'mou', 'Withdraw active deal intent proposal'),
('mou.read_all', 'mou', 'Administrative compliance view of all deal intent MOUs'),
('mou.manage', 'mou', 'Administrative management and oversight of deal intent MOUs')
ON CONFLICT (code) DO NOTHING;

-- Grant to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('mou.create', 'mou.read_own', 'mou.propose', 'mou.counter', 'mou.accept', 'mou.reject', 'mou.withdraw')
ON CONFLICT DO NOTHING;

-- Grant to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('mou.create', 'mou.read_own', 'mou.propose', 'mou.counter', 'mou.accept', 'mou.reject', 'mou.withdraw')
ON CONFLICT DO NOTHING;

-- Grant to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN ('mou.create', 'mou.read_own', 'mou.propose', 'mou.counter', 'mou.accept', 'mou.reject', 'mou.withdraw', 'mou.read_all', 'mou.manage')
ON CONFLICT DO NOTHING;
