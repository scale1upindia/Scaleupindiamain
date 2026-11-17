-- ============================================================================
-- SCALE-UP INDIA — MIGRATION 006: CATALOG & SEARCH PERFORMANCE INDEXES
-- Purpose: Optimize multi-factor confidential catalog discovery, filtering,
--          and match-aware sorting across published opportunities.
-- ============================================================================

-- 1. Composite Covering Index for Default Publication Discovery & Pagination
-- Accelerates `WHERE status = 'PUBLISHED' AND deleted_at IS NULL ORDER BY published_at DESC, created_at DESC, id DESC`
CREATE INDEX IF NOT EXISTS idx_opportunities_discovery_pub 
  ON opportunities(status, deleted_at, published_at DESC NULLS LAST, created_at DESC, id DESC);

-- 2. Partial Index for Business Category Filter
CREATE INDEX IF NOT EXISTS idx_opportunities_biz_category 
  ON opportunities(business_category) 
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

-- 3. Partial Index for Business Model Filter
CREATE INDEX IF NOT EXISTS idx_opportunities_biz_model 
  ON opportunities(business_model) 
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

-- 4. Partial Index for EBITDA Margin Bracket Filter
CREATE INDEX IF NOT EXISTS idx_opportunities_ebitda_margin 
  ON opportunities(ebitda_margin_bracket) 
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;

-- 5. Partial Index for Asking Price Bracket Filter
CREATE INDEX IF NOT EXISTS idx_opportunities_asking_price 
  ON opportunities(asking_price_bracket) 
  WHERE status = 'PUBLISHED' AND deleted_at IS NULL;
