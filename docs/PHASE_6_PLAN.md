# SCALE-UP INDIA — PHASE 6 ARCHITECTURAL SPECIFICATION & IMPLEMENTATION PLAN
## Confidential Business Opportunity Discovery, Search, Filtering & Match-Aware Catalog

**Date**: 2026-11-14  
**Author**: Lead Product Architect, Security Engineer, Senior Systems Engineer  
**Status**: APPROVED FOR EXECUTION  
**Target Environment**: Node.js 20+ / Next.js 15.5.29 / PGlite Embedded PostgreSQL  

---

## 1. Executive Summary & Objective

Phase 6 implements a confidential, high-throughput business opportunity discovery and catalog engine for Scale-up India.

The primary architectural mandate is:
> **Scale-up India is NOT an open public business directory.**
> It is an institutional transaction orchestration platform. The catalog must strictly expose only approved, published opportunities (`status = 'PUBLISHED'`, not deleted, not suspended, not rejected, not withdrawn).
> All discovery operations must uphold server-side progressive data masking (Tier 0 for public anonymous visitors, Tier 1 for authenticated buyers, Tier 2/3 for authorized participants).
> Authenticated buyers can seamlessly leverage their Phase 5 deterministic matching scores to rank opportunities without leaking their identities, criteria, or cross-tenant match records.

---

## 2. Catalog Eligibility Invariants

Every catalog query unconditionally enforces:
```sql
status = 'PUBLISHED' AND deleted_at IS NULL
```
- **Drafts (`DRAFT`)**: Never discoverable.
- **Under Review / Ready for Review (`READY_FOR_REVIEW`, `UNDER_REVIEW`, `CHANGES_REQUESTED`)**: Never discoverable.
- **Verified (`VERIFIED`)**: Not yet published; never discoverable until published by admin.
- **Suspended (`SUSPENDED`)**: Inactive; never discoverable.
- **Rejected (`REJECTED`)**: Inactive; never discoverable.
- **Archived / Withdrawn (`ARCHIVED`)**: Inactive; never discoverable.
- **Soft Deleted (`deleted_at IS NOT NULL`)**: Never discoverable.

Frontend filtering is never trusted. All visibility guarantees are enforced at the SQL service layer.

---

## 3. Whitelisted Searchable Fields vs. Confidential Boundaries

### Allowed Searchable Fields (Server-Side Full-Text / Pattern Matching)
1. `title` (Curated institutional title, e.g., "Precision Defense Dynamics Undertaking")
2. `teaser_summary` (Curated blind teaser narrative)
3. `detailed_description` (Tier 1 operational narrative)
4. `industry` (Sector, e.g., "Defense & Aerospace", "Specialty Chemicals")
5. `sub_sector` (Niche domain)
6. `registered_state` (Generalized geographic jurisdiction, e.g., "Maharashtra", "Tamil Nadu")
7. `reference_code` (Public institutional code, e.g., "SUI-OPP-...")

### Strictly Prohibited Confidential Fields (Zero Search Surface)
The search engine MUST NEVER match against or index:
- `exact_legal_name`
- `exact_trade_name`
- `exact_cin`
- `exact_gstin`
- `exact_pan`
- `exact_address`
- `exact_revenue`
- `exact_ebitda`
- `exact_asking_price`
- Seller identity (`user_id`, `seller_profile_id`)
- Unapproved private documents or internal reviewer notes

---

## 4. Query Validation & Whitelist Schema

All discovery parameters are parsed and strictly validated server-side using Zod:

| Parameter | Type / Constraints | Default | Behavior / Defense |
| :--- | :--- | :---: | :--- |
| `q` / `search` | String, max 100 chars | `undefined` | Sanitized, pattern-matched against allowed fields only |
| `industry` | String, max 100 chars | `undefined` | Case-insensitive pattern match |
| `businessCategory` | `BusinessCategory` Enum | `undefined` | Exact enum check |
| `subSector` | String, max 100 chars | `undefined` | Case-insensitive pattern match |
| `region` | `OperatingRegion` Enum | `undefined` | Exact enum check |
| `transactionType` | `OpportunityTransactionType` Enum | `undefined` | Exact enum check |
| `businessModel` | `BusinessModel` Enum | `undefined` | Exact enum check |
| `revenueBracket` | `RevenueBracket` Enum | `undefined` | Exact enum check |
| `ebitdaBracket` | `EbitdaMarginBracket` Enum | `undefined` | Exact enum check |
| `askingPriceBracket`| `AskingPriceBracket` Enum | `undefined` | Exact enum check |
| `sort` | Whitelisted Enum (`newest`, `oldest`, `revenue_desc`, `revenue_asc`, `match`) | `newest` | Rejects arbitrary SQL column names |
| `page` | Integer $\ge 1$ | `1` | Enforces positive integer pagination |
| `pageSize` / `limit`| Integer between 1 and 50 | `12` | Hard cap at 50 to prevent scraping & memory exhaustion |

---

## 5. Match-Aware Discovery Architecture

### Authenticated Buyer Match Incorporation
When an authenticated buyer requests `/api/v1/opportunities` (or sets `sort=match`):
1. The server inspects the session cookie and verifies if `user.id` has an active `buyer_profiles` record.
2. The server executes a `LEFT JOIN` against `buyer_opportunity_matches`:
   ```sql
   LEFT JOIN buyer_opportunity_matches bom 
     ON bom.opportunity_id = o.id 
    AND bom.buyer_id = $buyerId 
    AND bom.matching_version = 'v1.0.0-deterministic'
   ```
3. The server attaches `matchScore`, `matchClassification`, and `isEligible` to the opportunity teaser in the response.
4. If `sort=match`, the query orders by:
   ```sql
   ORDER BY COALESCE(bom.score, 0) DESC, o.published_at DESC NULLS LAST, o.id DESC
   ```

### Anti-IDOR & Multi-Tenant Isolation
- **No Client-Supplied `buyerId`**: Any client attempt to send `?buyerId=xxx` is ignored or rejected. The buyer identity is sourced strictly from the authenticated server session.
- **No Cross-Tenant Score Leakage**: An anonymous visitor or commercial seller querying the catalog receives `undefined` for `matchScore`, and `sort=match` gracefully falls back to `newest`. Buyer A can never view or sort by Buyer B's matches.

---

## 6. Database Performance & Migration 006

To ensure sub-50ms query response times under high concurrency, Migration `006_catalog_search_indexes.sql` introduces targeted composite and partial indexes:
1. `idx_opportunities_discovery_pub`: `(status, deleted_at, published_at DESC NULLS LAST, created_at DESC, id DESC)`
2. `idx_opportunities_biz_category`: `(business_category) WHERE status = 'PUBLISHED' AND deleted_at IS NULL`
3. `idx_opportunities_biz_model`: `(business_model) WHERE status = 'PUBLISHED' AND deleted_at IS NULL`
4. `idx_opportunities_ebitda_margin`: `(ebitda_margin_bracket) WHERE status = 'PUBLISHED' AND deleted_at IS NULL`
5. `idx_opportunities_asking_price`: `(asking_price_bracket) WHERE status = 'PUBLISHED' AND deleted_at IS NULL`

---

## 7. Anti-Enumeration & Scraping Defenses

1. **Uniform 404 on Detail Lookup**: `GET /api/v1/opportunities/[id]` returns identical `404 Not Found` whether the ID is nonexistent, draft, under review, rejected, or suspended.
2. **Deterministic Secondary Sorting**: Every query sorts with a secondary `o.id DESC` tiebreaker to guarantee stable pagination without row skipping or duplicates.
3. **Hard Limit on Page Size**: Maximum 50 items per page.
4. **Zero Count Disclosures**: Aggregate total counts strictly reflect published opportunities matching the query. No count of private or internal listings is revealed.

---

## 8. Frontend Experience Upgrades (`/opportunities`)

1. **Instant Search Bar**: Debounced text search with clear action.
2. **Multi-Facet Filter Drawer**:
   - Industry & Business Category
   - Geographic Operating Region
   - Transaction Structure (100% Buyout, Majority Stake, Joint Venture, etc.)
   - Business Model (B2B, B2C, Contract Manufacturing, SaaS, etc.)
   - Revenue & EBITDA Margin Brackets
3. **Sorting Control**:
   - Newest Listed (Default)
   - Highest Revenue First
   - Lowest Revenue First
   - Best Match Score (Enabled for Authenticated Buyers)
4. **Enhanced Opportunity Cards**:
   - Institutional reference code
   - Verified badge with publication state
   - Match Score pill (`98% Match • Strong Compatibility`) for logged-in buyers
   - Structured key metrics (Revenue Bracket, Region, Deal Structure)
   - Action CTA: View Confidential Teaser & Request NDA

---

## 9. Verification & Gate Strategy

- **Test Suite**: `tests/catalog_search.test.ts` (30+ tests covering all search, filter, sort, pagination, Anti-IDOR, and confidentiality assertions).
- **Security Gate Script**: `scripts/phase6_security_gate.ts` (Validating live database queries, masking, enumeration resistance, and match isolation).
- **Quality Gates**: `npm run typecheck`, `npm run lint`, `npm run test`, `rm -rf .next && npm run build`, and live HTTP smoke tests.
- **Verdict**: `READY_FOR_PHASE_7`.
