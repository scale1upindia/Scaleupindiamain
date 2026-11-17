# SCALE-UP INDIA — PHASE 6 DISCOVERY & SEARCH RULES
## Whitelist Matrix, Query Semantics, Confidentiality Boundaries & Match-Aware Sorting Rules

**Date**: 2026-11-14  
**Classification**: Platform Specification & Security Model  

---

## 1. Search Query Parameters & Whitelist Matrix

The endpoint `GET /api/v1/opportunities` accepts exclusively the following validated query parameters:

| Field Name | Type | Allowed Values / Formats | Evaluation Strategy | Security Boundary |
| :--- | :--- | :--- | :--- | :--- |
| `q` or `search` | `string` (1–100 chars) | Alphanumeric, spaces, common punctuation | Server-side `ILIKE` across `title`, `teaser_summary`, `detailed_description`, `industry`, `sub_sector`, `reference_code`, `registered_state` | Strict: Never evaluated against statutory or financial fields |
| `industry` | `string` (1–100 chars) | Free text industry names | Server-side `ILIKE %val%` | Non-confidential |
| `businessCategory` | `enum` | `MANUFACTURING`, `SERVICES`, `TECHNOLOGY`, `HEALTHCARE`, `CONSUMER_RETAIL`, `LOGISTICS`, `AGRITECH`, `OTHER` | Exact match | Non-confidential |
| `subSector` | `string` (1–100 chars) | Free text sub-sector | Server-side `ILIKE %val%` | Non-confidential |
| `region` | `enum` | `PAN_INDIA`, `NORTH_INDIA`, `WEST_INDIA`, `SOUTH_INDIA`, `EAST_INDIA`, `CENTRAL_INDIA`, `GLOBAL` | Exact match | Non-confidential |
| `transactionType` | `enum` | `FULL_ACQUISITION`, `MAJORITY_STAKE`, `MINORITY_STAKE`, `JOINT_VENTURE`, `STRATEGIC_PARTNERSHIP`, `ASSET_SALE` | Exact match | Non-confidential |
| `businessModel` | `enum` | `B2B`, `B2C`, `B2B2C`, `D2C`, `CONTRACT_MANUFACTURING`, `SAAS`, `FRANCHISE`, `HYBRID` | Exact match | Non-confidential |
| `revenueBracket` | `enum` | `UNDER_5CR`, `5CR_TO_15CR`, `15CR_TO_25CR`, `25CR_TO_50CR`, `50CR_TO_100CR`, `100CR_TO_250CR`, `OVER_250CR` | Exact match | Standardized Tier 0 bracket |
| `ebitdaBracket` | `enum` | `NEGATIVE`, `0_TO_10_PCT`, `10_TO_20_PCT`, `20_TO_30_PCT`, `OVER_30_PCT` | Exact match | Standardized Tier 1 bracket |
| `askingPriceBracket` | `enum` | `UNDER_10CR`, `10CR_TO_25CR`, `25CR_TO_50CR`, `50CR_TO_100CR`, `100CR_TO_250CR`, `NEGOTIABLE` | Exact match | Standardized Tier 1 bracket |
| `sort` | `enum` | `newest`, `oldest`, `revenue_desc`, `revenue_asc`, `match` | Controlled SQL `ORDER BY` clause | Rejects arbitrary SQL identifiers |
| `page` | `integer` | $\ge 1$ (Default: 1) | Offset calculation `(page - 1) * limit` | Negative numbers rejected |
| `limit` / `pageSize`| `integer` | $1 \le \text{limit} \le 50$ (Default: 12) | SQL `LIMIT` clause | Values $>50$ capped or rejected |

---

## 2. Hard Exclusion Invariant

Any opportunity with any of the following attributes is **strictly excluded** from discovery queries:
1. `status != 'PUBLISHED'` (Excludes `DRAFT`, `READY_FOR_REVIEW`, `SUBMITTED`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `VERIFIED`, `REJECTED`, `SUSPENDED`, `ARCHIVED`).
2. `deleted_at IS NOT NULL` (Excludes all soft-deleted records).

---

## 3. Match-Aware Discovery Rules

### Server-Side Buyer Match Incorporation
1. When a request includes an authenticated session cookie, the server inspects `users` and queries `buyer_profiles WHERE user_id = $userId AND deleted_at IS NULL`.
2. If the user is an active buyer, the discovery engine attaches a `LEFT JOIN`:
   ```sql
   LEFT JOIN buyer_opportunity_matches bom 
     ON bom.opportunity_id = o.id 
    AND bom.buyer_id = $buyerId 
    AND bom.matching_version = 'v1.0.0-deterministic'
   ```
3. The catalog response augments each opportunity with:
   - `matchScore`: Numeric score (0–100) or `null` if uncomputed
   - `matchClassification`: E.g., `HIGH_COMPATIBILITY`, `MODERATE_COMPATIBILITY`, or `null`
   - `isEligible`: Boolean or `null`

### Anti-IDOR Invariants for Matching
- **Client Parameter Ignored**: Clients cannot submit `?buyerId=...`.
- If an attacker submits `?buyerId=other-buyer`, the parameter is rejected or sanitized away.
- Anonymous visitors and non-buyers querying the catalog receive `matchScore: undefined`.
- If an unauthorized user submits `?sort=match`, the engine gracefully defaults to `newest` sorting without returning an error or leaking data.

---

## 4. Sorting Implementation Rules

All queries include a secondary tiebreaker `o.id DESC` to ensure deterministic pagination.

| Sort Key | SQL Order By Expression | Notes |
| :--- | :--- | :--- |
| `newest` (default) | `o.published_at DESC NULLS LAST, o.created_at DESC, o.id DESC` | Standard catalog feed |
| `oldest` | `o.published_at ASC NULLS LAST, o.created_at ASC, o.id ASC` | Chronological |
| `revenue_desc` | `CASE o.revenue_bracket WHEN 'OVER_250CR' THEN 7 WHEN '100CR_TO_250CR' THEN 6 WHEN '50CR_TO_100CR' THEN 5 WHEN '25CR_TO_50CR' THEN 4 WHEN '15CR_TO_25CR' THEN 3 WHEN '5CR_TO_15CR' THEN 2 WHEN 'UNDER_5CR' THEN 1 ELSE 0 END DESC, o.id DESC` | Standardized bracket ordinal |
| `revenue_asc` | `CASE o.revenue_bracket WHEN 'UNDER_5CR' THEN 1 WHEN '5CR_TO_15CR' THEN 2 WHEN '15CR_TO_25CR' THEN 3 WHEN '25CR_TO_50CR' THEN 4 WHEN '50CR_TO_100CR' THEN 5 WHEN '100CR_TO_250CR' THEN 6 WHEN 'OVER_250CR' THEN 7 ELSE 8 END ASC, o.id DESC` | Standardized bracket ordinal |
| `match` | `COALESCE(bom.score, 0) DESC, o.published_at DESC NULLS LAST, o.id DESC` | Available to authenticated buyers only |

---

## 5. Anti-Enumeration & Zero Leakage Defenses

1. **Detail Route Uniformity**:
   `GET /api/v1/opportunities/[identifier]`
   - If `id` does not exist $\to$ `404 Not Found` ("Opportunity not found.")
   - If `id` exists but `status != 'PUBLISHED'` and user is not owner/admin $\to$ `404 Not Found` ("Opportunity not found.")
   - Error messages are identical to prevent timing and distinction attacks.
2. **Page Boundaries**:
   - `page < 1` $\to$ Returns validation error (`400 Bad Request`).
   - `page` exceeding total pages $\to$ Returns empty `items: []` with accurate pagination metadata (`page: 999`, `totalPages: 3`, `total: 25`).
3. **No Aggregate Private Counts**:
   - `SELECT COUNT(*)` counts strictly eligible published opportunities.
