# SCALE-UP INDIA — PHASE 5 IMPLEMENTATION PLAN
## Deterministic, Server-Side Business Matching Engine

**Version**: 1.0.0  
**Phase**: Phase 5  
**Author**: Senior Product Architect, UX Designer, Security Engineer & Lead DevOps  
**Target Delivery**: Deterministic, Explainable, Server-Side Matching Architecture  
**Dependencies**: Phase 1 (Auth/RBAC), Phase 2 (Seller Profiles), Phase 3 (Buyer Mandates), Phase 4 (Opportunities & Progressive Masking)

---

## 1. Architectural Mission & Principles

Phase 5 delivers the core matchmaking algorithm of Scale-up India. It deterministically answers:
> *"Which published, verified business opportunities are compatible with this buyer's acquisition mandate, and why?"*

### Core Architectural Invariants:
1. **Zero Black-Box / No AI/LLM**:
   - Matching is 100% deterministic, explainable, and reproducible.
   - Same inputs $\to$ Identical output, identical score, identical explanation codes.
2. **Strict Hard Constraints vs. Soft Preferences**:
   - Hard constraints (e.g. publication status, industry incompatibility, transaction type misalignment) act as immediate binary gates. An opportunity failing a hard constraint is marked `eligible = false`, `score = 0`.
   - Soft preferences (e.g. geographic proximity, revenue scale, EBITDA margin, workforce size) are scored through a transparent, weighted algorithm totaling 100 points.
3. **Sealed Confidentiality & Progressive Disclosure**:
   - Match calculations execute on authoritative server-side structured data.
   - Match results and explanations **NEVER** leak sensitive seller data (CIN, GSTIN, PAN, exact legal name, exact address, exact financial ledgers, private documents).
   - Any opportunity payload delivered to a buyer is passed through the Phase 4 `maskOpportunityForUser` tier filter (Tier 1 for authenticated buyers).
4. **Anti-IDOR & Multi-Tenant Isolation**:
   - Matches are private to the buyer. Buyer A cannot see Buyer B's matches.
   - Sellers cannot enumerate buyer mandates or inspect which buyers matched their listings.
   - Admin access is role-restricted (`SUPER_ADMIN`, `ADMIN`, `buyers.read`) and strictly audit-logged.
5. **No Scattered Magic Numbers**:
   - All weights, bracket thresholds, tolerance margins, and classification tiers are stored in one centralized configuration module (`src/domains/matching/weights.ts`).

---

## 2. Relational Database Schema (`005_matching_engine.sql`)

To prevent expensive $O(M \times N)$ table scans on every buyer discovery page request, Phase 5 introduces a persistent match cache table with relational integrity and automatic version tracking:

```sql
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
    
    -- Algorithm Versioning for Future Calibration
    matching_version VARCHAR(20) NOT NULL DEFAULT 'v1.0.0',
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(mandate_id, opportunity_id)
);
```

### Strategic Indexes:
- `idx_matches_buyer_score`: `(buyer_id, score DESC)` for lightning-fast paginated buyer discovery.
- `idx_matches_mandate`: `(mandate_id)` for batch recalculation when mandates are updated.
- `idx_matches_opportunity`: `(opportunity_id)` for invalidation if an opportunity is unpublished or suspended.
- `idx_matches_classification`: `(buyer_id, classification)` for UI filter tabs.

---

## 3. Pure Deterministic Evaluator Engine

The core scoring logic is housed in a pure function:
`evaluateOpportunityMatch(mandate: AcquisitionMandateRecord, opportunity: OpportunityRecord): MatchResult`

### A. Binary Hard Gates:
1. **Publication Eligibility Gate**: `opportunity.status === 'PUBLISHED'` and `deleted_at IS NULL`. (Hard check: non-published opportunities are never evaluated).
2. **Industry Compatibility Gate**: If mandate specifies target industries, opportunity `industry` must be in the target set. If mismatched $\to$ `blockingCriteria.push("INDUSTRY_MISMATCH")`, `score = 0`, `eligible = false`.
3. **Transaction Structure Gate**: If mandate specifies permitted `transaction_types`, opportunity `transaction_type` must be present. If mismatched $\to$ `blockingCriteria.push("TRANSACTION_TYPE_MISMATCH")`, `score = 0`, `eligible = false`.
4. **Profitability Gate**: If mandate specifies `profitable_businesses_only === true`, opportunity `ebitda_margin_bracket` cannot be `'NEGATIVE'`. If negative $\to$ `blockingCriteria.push("UNPROFITABLE_BUSINESS")`, `score = 0`, `eligible = false`.

### B. Weighted Soft Preferences (Sum = 100%):
1. **Geographic Alignment (20%)**: Pan-India / State / Regional match.
2. **Revenue Bracket Alignment (20%)**: Overlap between buyer turnover range and opportunity revenue bracket.
3. **Investment / Valuation Capacity (15%)**: Alignment between buyer ticket size and opportunity asking price bracket.
4. **EBITDA Margin Quality (15%)**: Margin health (Over 30%, 20-30%, 10-20%, 0-10%).
5. **Sub-Sector / Specialization Depth (10%)**: Exact match on sub-sectors within the industry.
6. **Business Model Synergy (10%)**: Institutional model alignment (B2B, Contract Manufacturing, SaaS, etc.).
7. **Operational Scale & Track Record (10%)**: Workforce bracket and business age alignment.

### C. Classifications:
- **`EXCELLENT_MATCH`**: 90 – 100
- **`STRONG_MATCH`**: 75 – 89
- **`POTENTIAL_MATCH`**: 60 – 74
- **`WEAK_MATCH`**: 40 – 59
- **`POOR_MATCH`**: 0 – 39

---

## 4. API Endpoints

1. `GET /api/v1/buyer/matches` — List matches for authenticated buyer with pagination, sorting (`score`, `created_at`), and filters (`classification`, `industry`, `minScore`).
2. `GET /api/v1/buyer/matches/[matchId]` — Retrieve detailed match result with criteria breakdown and Tier 1 masked opportunity preview.
3. `POST /api/v1/buyer/matches/refresh` — Trigger on-demand deterministic matching recalculation for buyer's active mandates against all published opportunities.
4. `GET /api/v1/admin/matches` — Administrative diligence view with buyer and opportunity correlation (requires `SUPER_ADMIN` or `ADMIN`, audit-logged).

---

## 5. Security & Anti-IDOR Protections

1. **Buyer Isolation**: Match lookup strictly enforces `WHERE buyer_id = requestingUser.id`.
2. **Seller Concealment**: Sellers are strictly forbidden from calling buyer matching endpoints.
3. **Zero Leaks in Explanations**: Generated reason strings are templates using blind metadata (e.g., *"Industry [Defense & Aerospace] matches target mandate sectors"*). Statutory values (CIN, PAN, GSTIN, legal names) are strictly forbidden in reason templates.
4. **Audit Logging**: All match generation and administrative inspections log immutable records to `audit_logs`.

---

## 6. Implementation Milestones

- [x] Phase 5 Plan (`docs/PHASE_5_PLAN.md`)
- [ ] Phase 5 Matching Rules Spec (`docs/PHASE_5_MATCHING_RULES.md`)
- [ ] Database Migration (`src/lib/migrations/005_matching_engine.sql`)
- [ ] Domain Models & Constants (`src/types/matching.ts`, `src/domains/matching/weights.ts`)
- [ ] Bracket & Range Math (`src/domains/matching/brackets.ts`)
- [ ] Deterministic Match Evaluator (`src/domains/matching/evaluator.ts`)
- [ ] Matching Orchestration Service (`src/domains/matching/service.ts`)
- [ ] REST API Route Handlers (`src/app/api/v1/buyer/matches/...`)
- [ ] Buyer Matches UI Dashboard (`src/app/(dashboard)/buyer/matches/page.tsx`)
- [ ] Comprehensive Unit & Anti-IDOR Test Matrix (30+ tests)
- [ ] Phase 5 Security Gate Script (`scripts/phase5_security_gate.ts`)
- [ ] Quality Verification (`typecheck`, `lint`, `vitest`, `build`, runtime smoke test)
- [ ] Documentation (`docs/PHASE_5_REPORT.md`, `docs/PHASE_5_FINAL_GATE.md`, `IMPLEMENTATION_STATUS.md`)
