-- Scale-up India — Phase 7: Expression of Interest (EOI) & Bilateral Interest Migration
-- Migration: 007_expression_of_interest.sql

-- 1. REFERENCE SEQUENCE FOR EOI CODES
CREATE SEQUENCE IF NOT EXISTS eoi_ref_seq START WITH 10001;

-- 2. EXPRESSIONS OF INTEREST TABLE
CREATE TABLE IF NOT EXISTS expressions_of_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_code VARCHAR(50) NOT NULL UNIQUE,
    opportunity_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    buyer_profile_id UUID NOT NULL REFERENCES buyer_profiles(id) ON DELETE CASCADE,
    mandate_id UUID REFERENCES acquisition_mandates(id) ON DELETE SET NULL,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_profile_id UUID NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE,
    
    -- State Machine
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
    -- 'SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'EXPIRED'
    
    -- Bilateral Structured Content
    interest_type VARCHAR(100) NOT NULL,
    -- 'FULL_ACQUISITION', 'MAJORITY_STAKE', 'MINORITY_STAKE', 'STRATEGIC_INVESTMENT', 'JOINT_VENTURE', 'PARTNERSHIP', 'OTHER'
    proposed_transaction_type VARCHAR(100) NOT NULL,
    indicative_offer_range VARCHAR(50),
    -- 'UNDER_10CR', '10CR_TO_25CR', '25CR_TO_50CR', '50CR_TO_100CR', 'OVER_100CR', 'NEGOTIABLE'
    investment_timeline VARCHAR(50) NOT NULL,
    -- 'IMMEDIATE_30_DAYS', '1_TO_3_MONTHS', '3_TO_6_MONTHS', 'FLEXIBLE'
    buyer_message TEXT NOT NULL,
    
    -- Seller Response & Dialogue
    seller_response_message TEXT,
    seller_decline_reason VARCHAR(100),
    -- 'VALUATION_MISMATCH', 'STRATEGY_MISMATCH', 'CAPACITY_CONCERN', 'ALREADY_COMMITTED', 'NOT_ACCEPTING_OFFERS', 'OTHER'
    clarification_questions TEXT,
    clarification_answers TEXT,
    
    -- Audit Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '14 days')
);

-- 3. UNIQUE ACTIVE EOI CONSTRAINT
-- Only ONE active EOI per buyer and opportunity. Withdrawn, declined, or expired EOIs do not block re-submission.
CREATE UNIQUE INDEX IF NOT EXISTS idx_eoi_active_buyer_opp 
ON expressions_of_interest (buyer_id, opportunity_id) 
WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ACCEPTED');

-- 4. PERFORMANCE & INBOX INDEXES
CREATE INDEX IF NOT EXISTS idx_eoi_buyer_inbox ON expressions_of_interest (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eoi_seller_inbox ON expressions_of_interest (seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eoi_opportunity ON expressions_of_interest (opportunity_id, status);

-- 5. IN-APP NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS in_app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    -- 'EOI_RECEIVED', 'EOI_ACCEPTED', 'EOI_DECLINED', 'EOI_WITHDRAWN', 'EOI_CLARIFICATION_REQUESTED', 'EOI_CLARIFICATION_PROVIDED', 'SYSTEM'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON in_app_notifications (user_id, is_read, created_at DESC);

-- 6. SEED PHASE 7 RBAC PERMISSIONS
INSERT INTO permissions (code, module, description) VALUES
('eoi.create', 'eoi', 'Submit expressions of interest for published business opportunities'),
('eoi.read_own', 'eoi', 'Read own submitted expressions of interest'),
('eoi.withdraw_own', 'eoi', 'Withdraw own submitted expressions of interest'),
('eoi.read_received', 'eoi', 'Read expressions of interest received for own opportunities'),
('eoi.respond', 'eoi', 'Accept, decline, or clarify received expressions of interest'),
('eoi.read_all', 'eoi', 'Administrative diligence view of all expressions of interest across the platform'),
('eoi.manage', 'eoi', 'Administrative management and dispute resolution of expressions of interest')
ON CONFLICT (code) DO NOTHING;

-- Grant to Buyer roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('BUYER', 'INDIVIDUAL_INVESTOR', 'INSTITUTIONAL_BUYER')
AND p.code IN ('eoi.create', 'eoi.read_own', 'eoi.withdraw_own')
ON CONFLICT DO NOTHING;

-- Grant to Seller roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SELLER', 'PROMOTER')
AND p.code IN ('eoi.read_received', 'eoi.respond')
ON CONFLICT DO NOTHING;

-- Grant to Admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.code IN ('SUPER_ADMIN', 'ADMIN', 'VERIFICATION_MANAGER')
AND p.code IN ('eoi.create', 'eoi.read_own', 'eoi.withdraw_own', 'eoi.read_received', 'eoi.respond', 'eoi.read_all', 'eoi.manage')
ON CONFLICT DO NOTHING;
