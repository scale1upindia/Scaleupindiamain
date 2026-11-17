-- Scale-up India — Phase 16: Enterprise Security Hardening
-- Migration: 016_enterprise_security_hardening.sql

-- 1. ADD MFA READINESS COLUMNS TO USERS
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_recovery_codes_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enrolled_at TIMESTAMPTZ;

-- 2. CREATE SECURITY AUDIT EVENTS TABLE FOR CRITICAL COMPLIANCE EVENTS
CREATE TABLE IF NOT EXISTS security_compliance_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    threat_severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
    ip_hash VARCHAR(64),
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_threat_severity CHECK (threat_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_sec_events_actor 
    ON security_compliance_events (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sec_events_severity 
    ON security_compliance_events (threat_severity, created_at DESC);

-- 3. SEED SECURITY COMPLIANCE PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('security.admin', 'security', 'Administrative management of security controls, sessions, and lockouts'),
('security.audit', 'security', 'View security compliance logs and tamper detection records')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to Super Admin and Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN')
AND p.code IN ('security.admin', 'security.audit')
ON CONFLICT DO NOTHING;
