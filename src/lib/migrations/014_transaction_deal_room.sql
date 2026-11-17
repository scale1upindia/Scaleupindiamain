-- Scale-up India — Phase 14: Transaction / Deal Room & Closing Engine
-- Migration: 014_transaction_deal_room.sql

-- 1. SEQUENCES
CREATE SEQUENCE IF NOT EXISTS txn_ref_seq START WITH 10001;
CREATE SEQUENCE IF NOT EXISTS txn_close_ref_seq START WITH 10001;

-- 2. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE RESTRICT,
    nda_id UUID NOT NULL REFERENCES nda_agreements(id) ON DELETE RESTRICT,
    token_deposit_id UUID REFERENCES token_deposits(id) ON DELETE SET NULL,
    payment_intent_id UUID REFERENCES payment_intents(id) ON DELETE SET NULL,
    diligence_case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE RESTRICT,
    valuation_case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE RESTRICT,
    valuation_version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE RESTRICT,
    
    transaction_type VARCHAR(50) NOT NULL DEFAULT 'SHARE_ACQUISITION',
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED',
    agreed_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_structure VARCHAR(50) NOT NULL DEFAULT 'FULL_ESCROW',
    token_deposit_treatment VARCHAR(50) NOT NULL DEFAULT 'CREDITED_TOWARD_CONSIDERATION',
    target_closing_date TIMESTAMPTZ,
    governing_law VARCHAR(100) DEFAULT 'Indian Law',
    dispute_resolution VARCHAR(150) DEFAULT 'Arbitration in New Delhi',
    current_version_number INT NOT NULL DEFAULT 1,
    
    -- Bilateral Confirmations & Governance
    buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    buyer_confirmed_at TIMESTAMPTZ,
    seller_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    seller_confirmed_at TIMESTAMPTZ,
    reviewer_approved BOOLEAN NOT NULL DEFAULT FALSE,
    reviewer_approved_at TIMESTAMPTZ,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Confidential Progressive Notes
    buyer_notes TEXT,
    seller_notes TEXT,
    reviewer_notes TEXT,
    
    -- Closing Lifecycle
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_txn_status CHECK (status IN (
        'ELIGIBLE', 'INITIATED', 'TERMS_FINALIZATION', 'CLOSING_CONDITIONS', 
        'DOCUMENTS_PENDING', 'READY_FOR_CLOSING', 'CLOSING_IN_PROGRESS', 
        'CLOSED', 'CANCELLED', 'TERMINATED', 'FAILED_TO_CLOSE'
    )),
    CONSTRAINT chk_txn_type CHECK (transaction_type IN (
        'SHARE_ACQUISITION', 'ASSET_ACQUISITION', 'BUSINESS_TRANSFER'
    )),
    CONSTRAINT chk_payment_structure CHECK (payment_structure IN (
        'FULL_ESCROW', 'TRANCHE_BASED', 'LUMP_SUM_AT_CLOSING'
    )),
    CONSTRAINT chk_token_treatment CHECK (token_deposit_treatment IN (
        'CREDITED_TOWARD_CONSIDERATION', 'REFUNDED_TO_BUYER', 'RELEASED_TO_SELLER'
    ))
);

-- Partial Unique Index: at most ONE active transaction per valuation case
CREATE UNIQUE INDEX IF NOT EXISTS idx_txn_active_val 
ON transactions (valuation_case_id) 
WHERE status NOT IN ('CANCELLED', 'TERMINATED', 'FAILED_TO_CLOSE');

CREATE INDEX IF NOT EXISTS idx_txn_opp ON transactions (opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_txn_buyer ON transactions (buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_txn_seller ON transactions (seller_id, status);
CREATE INDEX IF NOT EXISTS idx_txn_mou ON transactions (mou_id);
CREATE INDEX IF NOT EXISTS idx_txn_dd ON transactions (diligence_case_id);

-- 3. TRANSACTION VERSIONS TABLE (Immutable Terms Snapshots)
CREATE TABLE IF NOT EXISTS transaction_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    agreed_amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    payment_structure VARCHAR(50) NOT NULL,
    token_deposit_treatment VARCHAR(50) NOT NULL,
    valuation_case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE RESTRICT,
    valuation_version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE RESTRICT,
    target_closing_date TIMESTAMPTZ,
    governing_law VARCHAR(100),
    dispute_resolution VARCHAR(150),
    special_conditions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    
    buyer_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    buyer_confirmed_at TIMESTAMPTZ,
    seller_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    seller_confirmed_at TIMESTAMPTZ,
    reviewer_approved BOOLEAN NOT NULL DEFAULT FALSE,
    reviewer_approved_at TIMESTAMPTZ,
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unq_txn_version UNIQUE (transaction_id, version_number),
    CONSTRAINT chk_txn_ver_status CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'FROZEN', 'SUPERSEDED', 'CLOSED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_txn_ver_txn ON transaction_versions (transaction_id, version_number);

-- 4. TRANSACTION CLOSING CONDITIONS TABLE
CREATE TABLE IF NOT EXISTS transaction_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    condition_type VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    responsible_party VARCHAR(50) NOT NULL DEFAULT 'BOTH',
    evidence_document_id UUID,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    waiver_reason TEXT,
    waived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    waived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT unq_txn_condition UNIQUE (transaction_id, condition_type),
    CONSTRAINT chk_txn_cond_status CHECK (status IN (
        'PENDING', 'SATISFIED', 'WAIVED', 'FAILED', 'BLOCKED'
    )),
    CONSTRAINT chk_txn_cond_party CHECK (responsible_party IN (
        'BUYER', 'SELLER', 'PLATFORM', 'BOTH'
    ))
);

CREATE INDEX IF NOT EXISTS idx_txn_cond_txn ON transaction_conditions (transaction_id, status);

-- 5. TRANSACTION DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS transaction_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    condition_id UUID REFERENCES transaction_conditions(id) ON DELETE SET NULL,
    document_type VARCHAR(60) NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    version_number INT NOT NULL DEFAULT 1,
    signing_status VARCHAR(50) NOT NULL DEFAULT 'NOT_REQUIRED',
    signer_identity VARCHAR(255),
    signed_at TIMESTAMPTZ,
    signature_reference VARCHAR(255),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_txn_doc_type CHECK (document_type IN (
        'FINAL_TRANSACTION_AGREEMENT', 'BOARD_RESOLUTION', 'CLOSING_CERTIFICATE',
        'REGULATORY_APPROVAL', 'SETTLEMENT_RECEIPT', 'TRANSFER_DOCUMENT', 'OTHER_CLOSING_EVIDENCE'
    )),
    CONSTRAINT chk_txn_doc_signing CHECK (signing_status IN (
        'NOT_REQUIRED', 'PENDING_SIGNATURE', 'SIGNATURE_RECORDED', 'VERIFIED'
    ))
);

CREATE INDEX IF NOT EXISTS idx_txn_doc_txn ON transaction_documents (transaction_id);

-- 6. TRANSACTION CLOSING RECORDS TABLE (Immutable Permanent Post-Closing Snapshot)
CREATE TABLE IF NOT EXISTS transaction_closing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    closing_reference VARCHAR(50) NOT NULL UNIQUE,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT UNIQUE,
    version_number INT NOT NULL,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE RESTRICT,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    mou_id UUID NOT NULL REFERENCES deal_mous(id) ON DELETE RESTRICT,
    diligence_case_id UUID NOT NULL REFERENCES due_diligence_cases(id) ON DELETE RESTRICT,
    valuation_case_id UUID NOT NULL REFERENCES valuation_cases(id) ON DELETE RESTRICT,
    valuation_version_id UUID NOT NULL REFERENCES valuation_versions(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(50) NOT NULL,
    final_consideration NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    payment_reference VARCHAR(255),
    conditions_snapshot JSONB NOT NULL,
    document_hashes JSONB NOT NULL,
    confirmations_snapshot JSONB NOT NULL,
    audit_reference VARCHAR(255),
    closed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_txn_close_opp ON transaction_closing_records (opportunity_id);
CREATE INDEX IF NOT EXISTS idx_txn_close_buyer ON transaction_closing_records (buyer_id);
CREATE INDEX IF NOT EXISTS idx_txn_close_seller ON transaction_closing_records (seller_id);

-- 7. SEED RBAC PERMISSIONS FOR PHASE 14
INSERT INTO permissions (code, module, description) VALUES
('transaction.create', 'transaction', 'Create a new transaction deal room workspace'),
('transaction.read_own', 'transaction', 'View owned transaction deal room overview and conditions'),
('transaction.read_all', 'transaction', 'View all transaction deal rooms across platform'),
('transaction.read_sensitive', 'transaction', 'View private transaction notes and internal closing papers'),
('transaction.update', 'transaction', 'Update draft transaction settings'),
('transaction.terms_update', 'transaction', 'Update authoritative transaction terms and consideration'),
('transaction.submit', 'transaction', 'Submit transaction terms for formal review'),
('transaction.conditions_manage', 'transaction', 'Manage and verify closing conditions'),
('transaction.documents_manage', 'transaction', 'Upload and verify transaction closing documents'),
('transaction.confirm', 'transaction', 'Formally confirm transaction terms (buyer/seller)'),
('transaction.review', 'transaction', 'Review transaction terms and closing readiness'),
('transaction.approve', 'transaction', 'Formally approve transaction for closing'),
('transaction.close', 'transaction', 'Execute final atomic closing of transaction'),
('transaction.admin', 'transaction', 'Administrative oversight and post-closing correction')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN (
    'transaction.create', 'transaction.read_own', 'transaction.read_sensitive',
    'transaction.update', 'transaction.terms_update', 'transaction.submit',
    'transaction.documents_manage', 'transaction.confirm'
)
ON CONFLICT DO NOTHING;

-- Grant permissions to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN (
    'transaction.read_own', 'transaction.documents_manage', 'transaction.confirm'
)
ON CONFLICT DO NOTHING;

-- Grant permissions to Reviewer / Legal / Finance roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('DUE_DILIGENCE', 'FINANCE', 'LEGAL')
AND p.code IN (
    'transaction.read_own', 'transaction.read_all', 'transaction.read_sensitive',
    'transaction.conditions_manage', 'transaction.documents_manage',
    'transaction.review', 'transaction.approve'
)
ON CONFLICT DO NOTHING;

-- Grant permissions to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN (
    'transaction.create', 'transaction.read_own', 'transaction.read_all', 'transaction.read_sensitive',
    'transaction.update', 'transaction.terms_update', 'transaction.submit',
    'transaction.conditions_manage', 'transaction.documents_manage', 'transaction.confirm',
    'transaction.review', 'transaction.approve', 'transaction.close', 'transaction.admin'
)
ON CONFLICT DO NOTHING;
