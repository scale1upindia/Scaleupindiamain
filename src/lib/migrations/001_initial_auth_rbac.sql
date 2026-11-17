-- Scale-up India — Initial Auth & RBAC Migration
-- Migration: 001_initial_auth_rbac.sql

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROLE_PERMISSIONS
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    failed_login_attempts INT DEFAULT 0,
    lockout_until TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ
);

-- 5. USER_ROLES (Multi-role support)
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_by UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_id)
);

-- 6. SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    ip_hash VARCHAR(64),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ
);

-- 7. VERIFICATION_TOKENS (Email verification & Password Reset)
CREATE TABLE IF NOT EXISTS verification_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'EMAIL_VERIFICATION', 'PASSWORD_RESET'
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 8. AUDIT_LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    ip_hash VARCHAR(64),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_lookup ON verification_tokens(token_hash, type) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id, created_at DESC);

-- SEED FOUNDATIONAL ROLES
INSERT INTO roles (code, name, description, is_internal) VALUES
('SUPER_ADMIN', 'Super Administrator', 'Full platform operational & administrative authority', TRUE),
('ADMIN', 'Platform Administrator', 'Day-to-day administrative operations and verification', TRUE),
('VERIFICATION_MANAGER', 'Verification Manager', 'Review of promoter KYC, business records and company profiles', TRUE),
('RELATIONSHIP_MANAGER', 'Relationship Manager', 'Facilitation of deal matchmaking and seller responsiveness', TRUE),
('LEGAL', 'Legal Counsel', 'Review and drafting of NDA, Tripartite MOU, and Share Transfer Agreements', TRUE),
('DUE_DILIGENCE', 'Due Diligence Lead', 'Investigation of 12-category DD checklist and valuation review', TRUE),
('FINANCE', 'Finance Lead', 'Reconciliation of token payments, fees, and custodial disbursements', TRUE),
('SUPPORT', 'Support Desk', 'Customer service and ticket resolution', TRUE),
('VIEW_ONLY', 'View-Only Auditor', 'Read-only access for compliance and statutory audits', TRUE),
('PROMOTER', 'Business Promoter / Seller', 'Entity seeking company stake sale, equity dilution, or asset sale', FALSE),
('BUYER', 'Buyer / Acquirer', 'Entity seeking business acquisition or strategic buyout', FALSE),
('INVESTOR', 'Investor', 'Angel, PE, VC, or family office seeking equity investment', FALSE),
('PARTNER', 'Strategic Partner / JV', 'Entity seeking joint venture or strategic partnership', FALSE)
ON CONFLICT (code) DO NOTHING;

-- SEED GRANULAR PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('users.read', 'users', 'View user profiles and statuses'),
('users.manage_roles', 'users', 'Assign or revoke roles'),
('users.suspend', 'users', 'Suspend or reactivate accounts'),
('profiles.verify', 'verification', 'Verify user KYC credentials'),
('opportunities.create', 'opportunities', 'Draft and submit new listings'),
('opportunities.read_all', 'opportunities', 'Read all listings without masking'),
('opportunities.verify', 'verification', 'Mark listing as verified'),
('opportunities.publish', 'opportunities', 'Publish listing to catalog'),
('opportunities.archive', 'opportunities', 'Archive or withdraw listing'),
('documents.upload', 'documents', 'Upload documents to vault'),
('documents.read_own', 'documents', 'Access own uploaded documents'),
('documents.read_deal', 'documents', 'Access deal documents under active NDA'),
('documents.read_all', 'documents', 'Internal access to all documents'),
('documents.approve', 'verification', 'Approve or reject verification documents'),
('interests.submit', 'interests', 'Submit expression of interest'),
('interests.respond', 'interests', 'Respond to received interest within 24h'),
('interests.escalate', 'interests', 'Intervene on overdue interest response'),
('nda.sign', 'legal', 'Execute bilateral NDA'),
('mou.draft', 'legal', 'Draft and configure Tripartite MOU'),
('mou.sign', 'legal', 'Sign Tripartite MOU'),
('payments.initiate', 'payments', 'Initiate token or facilitation payment'),
('payments.verify', 'payments', 'Verify payment confirmation'),
('payments.refund', 'payments', 'Process token fee refund'),
('due_diligence.manage', 'due_diligence', 'Manage DD checklist and report issues'),
('valuation.manage', 'valuation', 'Assign valuation advisors and reports'),
('agreements.sign', 'legal', 'Sign Share Transfer Agreement'),
('transactions.close', 'transactions', 'Close deal and authorize fund release'),
('audit.read', 'audit', 'Read audit trail logs'),
('settings.manage', 'admin', 'Manage platform configurations and weights')
ON CONFLICT (code) DO NOTHING;

-- SEED ROLE-PERMISSIONS
-- SUPER_ADMIN gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

-- ADMIN gets all except settings.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'ADMIN' AND p.code != 'settings.manage'
ON CONFLICT DO NOTHING;

-- VERIFICATION_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'VERIFICATION_MANAGER' AND p.code IN (
    'users.read', 'profiles.verify', 'opportunities.verify', 'opportunities.publish',
    'documents.read_all', 'documents.approve'
)
ON CONFLICT DO NOTHING;

-- RELATIONSHIP_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'RELATIONSHIP_MANAGER' AND p.code IN (
    'users.read', 'opportunities.read_all', 'documents.read_deal', 'interests.escalate'
)
ON CONFLICT DO NOTHING;

-- LEGAL
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'LEGAL' AND p.code IN (
    'users.read', 'opportunities.read_all', 'documents.read_all', 'nda.sign', 'mou.draft', 'mou.sign', 'agreements.sign'
)
ON CONFLICT DO NOTHING;

-- DUE_DILIGENCE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'DUE_DILIGENCE' AND p.code IN (
    'users.read', 'opportunities.read_all', 'documents.read_all', 'due_diligence.manage', 'valuation.manage'
)
ON CONFLICT DO NOTHING;

-- FINANCE
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'FINANCE' AND p.code IN (
    'users.read', 'opportunities.read_all', 'documents.read_all', 'payments.verify', 'payments.refund', 'transactions.close'
)
ON CONFLICT DO NOTHING;

-- VIEW_ONLY
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'VIEW_ONLY' AND p.code IN (
    'users.read', 'opportunities.read_all', 'documents.read_all', 'audit.read'
)
ON CONFLICT DO NOTHING;

-- PROMOTER (External Persona)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'PROMOTER' AND p.code IN (
    'opportunities.create', 'documents.upload', 'documents.read_own', 'interests.respond', 'nda.sign', 'mou.sign', 'agreements.sign', 'payments.initiate'
)
ON CONFLICT DO NOTHING;

-- BUYER (External Persona)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'BUYER' AND p.code IN (
    'interests.submit', 'documents.read_deal', 'nda.sign', 'mou.sign', 'payments.initiate', 'agreements.sign'
)
ON CONFLICT DO NOTHING;

-- INVESTOR (External Persona)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'INVESTOR' AND p.code IN (
    'interests.submit', 'documents.read_deal', 'nda.sign', 'mou.sign', 'payments.initiate', 'agreements.sign'
)
ON CONFLICT DO NOTHING;

-- PARTNER (External Persona)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code = 'PARTNER' AND p.code IN (
    'interests.submit', 'documents.read_deal', 'nda.sign', 'mou.sign'
)
ON CONFLICT DO NOTHING;
