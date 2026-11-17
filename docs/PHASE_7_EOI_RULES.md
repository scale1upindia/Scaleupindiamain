# SCALE-UP INDIA — PHASE 7 EOI WORKFLOW SPECIFICATION & SECURITY RULES
## Expression of Interest (EOI) & Bilateral Interest Governance

**Document Reference**: `docs/PHASE_7_EOI_RULES.md`  
**Version**: 1.0.0  
**Effective Date**: 2026-11-14  

---

### 1. Core Invariants & Legal Disclaimers

1. **Non-Binding Nature**:
   An Expression of Interest (EOI) is an initial, non-binding expression of serious interest in exploring a transaction. It does not constitute a letter of intent (LOI), a memorandum of understanding (MOU), or a share transfer agreement (STA).
2. **Confidentiality Wall**:
   An EOI submission or acceptance does **NOT** unlock confidential documents, legal credentials, statutory IDs (CIN, GSTIN, PAN), exact registered address, audited accounts, or bank statements.
3. **Bilateral Masking**:
   - **Buyer to Seller**: The seller only sees an anonymized/structured **Safe Buyer Summary** (Entity Type, Target Sector, Indicative Deal Size, Investment Horizon, Message, Match Score).
   - **Seller to Buyer**: The buyer only sees Tier 0 / Tier 1 masked opportunity data.
4. **Zero Client Trust**:
   The client may never provide `buyerId`, `sellerId`, `status`, or timestamps. These are strictly resolved from session and server logic.

---

### 2. State Machine Transitions Matrix

| Current State | Target State | Triggered By | Conditions & Rules |
| :--- | :--- | :--- | :--- |
| `[None]` | `SUBMITTED` | Buyer | Opportunity must be `PUBLISHED` & not deleted. Buyer must not own opportunity. No active EOI exists. |
| `SUBMITTED` | `UNDER_REVIEW` | Seller | Seller views/opens EOI for evaluation. |
| `SUBMITTED` / `UNDER_REVIEW` | `WITHDRAWN` | Buyer | Buyer may withdraw at any time prior to final acceptance/decline. Terminal. |
| `UNDER_REVIEW` | `CLARIFICATION_REQUESTED` | Seller | Seller submits structured questions. |
| `CLARIFICATION_REQUESTED` | `UNDER_REVIEW` | Buyer | Buyer submits structured answers. |
| `CLARIFICATION_REQUESTED` | `WITHDRAWN` | Buyer | Buyer withdraws. Terminal. |
| `UNDER_REVIEW` / `SUBMITTED` | `ACCEPTED` | Seller | Seller formally accepts EOI. Moves to Phase 8 bilateral NDA eligibility. |
| `UNDER_REVIEW` / `SUBMITTED` | `DECLINED` | Seller | Seller declines EOI with structured decline reason. Terminal. |
| `SUBMITTED` / `UNDER_REVIEW` | `EXPIRED` | System (SLA) | 14 calendar days elapsed without seller response. Terminal. |

#### Invalid Transitions (Strictly Rejected)
- `DECLINED -> ACCEPTED` (Forbidden)
- `ACCEPTED -> SUBMITTED` (Forbidden)
- `WITHDRAWN -> ACCEPTED` (Forbidden)
- `EXPIRED -> ACCEPTED` (Forbidden)
- `ACCEPTED -> DECLINED` (Forbidden)

---

### 3. Progressive Data Boundaries: Seller-Visible Buyer Summary

When an EOI is presented to a seller, only the following fields are serialized:

| Field | Source | Seller Visibility | Description |
| :--- | :--- | :---: | :--- |
| `eoiReference` | `expressions_of_interest.reference_code` | **YES** | System reference (e.g. `EOI-2026-10001`) |
| `buyerEntityType` | `buyer_profiles.entity_type` | **YES** | e.g. `COMPANY`, `FUND`, `FAMILY_OFFICE`, `INDIVIDUAL` |
| `buyerType` | `buyer_profiles.buyer_type` | **YES** | e.g. `CORPORATE_BUYER`, `PE_FUND`, `INDIVIDUAL_INVESTOR` |
| `buyerIndustry` | `buyer_profiles.industry` | **YES** | Target operating sector |
| `buyerLocation` | `buyer_profiles.state, country` | **YES** | State & Country (e.g. `Maharashtra, India`) |
| `interestType` | `expressions_of_interest.interest_type` | **YES** | e.g. `FULL_ACQUISITION`, `MAJORITY_STAKE` |
| `indicativeRange`| `expressions_of_interest.indicative_offer_range` | **YES** | Bracket range (e.g. `₹25Cr – ₹50Cr`) |
| `investmentTimeline`| `expressions_of_interest.investment_timeline` | **YES** | e.g. `1_TO_3_MONTHS` |
| `buyerMessage` | `expressions_of_interest.buyer_message` | **YES** | Direct acquisition message from buyer |
| `matchScore` | `buyer_opportunity_matches.score` | **YES** | Deterministic compatibility percentage |
| `matchClassification` | `buyer_opportunity_matches.classification` | **YES** | e.g. `STRONG_MATCH` |
| `buyerLegalName` | `buyer_profiles.legal_name` | **MASKED** | Concealed behind entity type |
| `buyerAum` | `buyer_profiles.aum` | **MASKED** | Concealed |
| `buyerDocuments`| `buyer_documents` | **MASKED** | Private vault strictly protected |
| `buyerMandateNotes`| `acquisition_mandates` | **MASKED** | Private strategy strictly protected |

---

### 4. Anti-IDOR & Concurrency Guarantees

1. **Unique Active EOI Constraint**:
   ```sql
   CREATE UNIQUE INDEX idx_eoi_active_buyer_opp 
   ON expressions_of_interest (buyer_id, opportunity_id) 
   WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ACCEPTED');
   ```
2. **Double-Submission Prevention**:
   Race conditions from simultaneous clicks are caught at the PostgreSQL transaction level via the unique index. Duplicate submissions throw an `ActiveEoiExistsError` with `HTTP 409 Conflict`.
3. **Actor Isolation**:
   - `buyer_id` is bound strictly to `session.user.id`.
   - `seller_id` is verified against `opportunities.user_id`.
   - Modifying or withdrawing another buyer's EOI returns `HTTP 403 Forbidden` / `404 Not Found`.
   - Accepting or declining another seller's EOI returns `HTTP 403 Forbidden` / `404 Not Found`.
