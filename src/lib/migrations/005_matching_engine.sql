-- Scale-up India — Phase 5: Deterministic Matching Engine Migration
-- Migration: 005_matching_engine.sql

-- 1. BUYER OPPORTUNITY MATCHES TABLE
CREATE TABLE IF NOT EXISTS buyer_opportunity_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    mandate_id UUID NOT NULL REFERENCES acquisition_mandates(id) ON DELETE CASCADE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    
    -- Deterministic Output
    is_eligible BOOLEAN NOT NULL DEFAULT TRUE,
    score INT NOT NULL CHECK (score >= 0 AND score <= 100),
    classification VARCHAR(50) NOT NULL, -- 'EXCELLENT_MATCH', 'STRONG_MATCH', 'POTENTIAL_MATCH', 'WEAK_MATCH', 'POOR_MATCH'
    
    -- Structured Explanations (Never contains statutory or unmasked seller data)
    matched_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    unmatched_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    blocking_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Algorithm Versioning for Future Audits
    matching_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_mandate_opportunity UNIQUE (mandate_id, opportunity_id)
);

-- 2. SEED PHASE 5 MATCHING PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('matches.read_own', 'matching', 'Read own calculated opportunity matches'),
('matches.refresh_own', 'matching', 'Recalculate and refresh matches for own acquisition mandates'),
('matches.read_all', 'matching', 'Administrative diligence view of all buyer-opportunity matches')
ON CONFLICT (code) DO NOTHING;

-- Grant permissions to appropriate roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('matches.read_own', 'matches.refresh_own')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'VERIFICATION_MANAGER')
AND p.code IN ('matches.read_own', 'matches.refresh_own', 'matches.read_all')
ON CONFLICT DO NOTHING;

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_matches_buyer ON buyer_opportunity_matches(buyer_id);
CREATE INDEX IF NOT EXISTS idx_matches_buyer_profile ON buyer_opportunity_matches(buyer_profile_id);
CREATE INDEX IF NOT EXISTS idx_matches_mandate ON buyer_opportunity_matches(mandate_id);
CREATE INDEX IF NOT EXISTS idx_matches_opportunity ON buyer_opportunity_matches(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_matches_buyer_score ON buyer_opportunity_matches(buyer_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_classification ON buyer_opportunity_matches(classification);
CREATE INDEX IF NOT EXISTS idx_matches_eligibility ON buyer_opportunity_matches(is_eligible);
