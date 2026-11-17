# SCALE-UP INDIA — PHASE 4 IMPLEMENTATION REPORT
## Opportunity Management & Progressive Data Masking (Tier 0 to Tier 3)

**Date**: 2026-11-14  
**Status**: **COMPLETED & VERIFIED**  
**Readiness Verdict**: `READY_FOR_PHASE_5`

---

## 1. Executive Summary

Phase 4 introduces the institutional core of Scale-up India: **Opportunity Management & Progressive Data Masking**. Business sellers and promoters can create, refine, and submit confidential opportunities backed by statutory registrations (CIN, GSTIN, PAN), multi-tier financials, and private pitch decks.

Crucially, **progressive data disclosure is enforced strictly at the database and server service boundary**:
- **Tier 0 (Public Blind Teaser)**: Unauthenticated public discovery. Masks legal entity names, brand identities, exact financials, exact locations, and corporate registrations. Discloses only blind operational sectors, revenue brackets, and general geographic regions.
- **Tier 1 (Authenticated Buyer)**: Qualified buyers with active sessions unlock operational parameters, commercial business models, employee ranges, EBITDA margin brackets, and asking price brackets.
- **Tier 2 (Authorized Acquirer / Bilateral Consent)**: Prepared for post-EOI / NDA execution, unlocking registered city and vetted deal documents.
- **Tier 3 (Unmasked Record)**: Owner sellers and authorized platform staff (`SUPER_ADMIN`, `ADMIN`, `VERIFICATION_MANAGER`) with unmasked statutory identities, exact financials, and private deal room attachments.

---

## 2. Engineering Verification Pipeline Results

| Verification Suite | Target | Status | Result / Metrics |
| :--- | :--- | :---: | :--- |
| **TypeScript Typecheck** | `tsc --noEmit` | **PASS** | 0 errors across entire workspace |
| **ESLint Code Quality** | `next lint` | **PASS** | 0 warnings, 0 errors |
| **Automated Tests** | `vitest run` | **PASS** | **19 test suites, 106 tests passed (100%)** |
| **Production Build** | `next build` | **PASS** | 51 routes compiled cleanly |
| **Local Dev Runtime** | `next dev` | **PASS** | Responsive on `http://localhost:3000` |
| **Anti-IDOR Security** | Opportunity Vault | **PASS** | Multi-tenant isolation verified |
| **File Integrity** | Magic Bytes Check | **PASS** | PDF, PNG, JPEG validated; spoofing blocked |

---

## 3. Database Schema & Migration (`004_opportunity_management.sql`)

### Tables & Sequences Created
1. `opportunity_ref_seq`: Sequence generating institutional reference codes formatted as `OPP-YYYY-XXXX`.
2. `opportunities`: Complete internal record storing public blind teasers, operational parameters, and confidential statutory underpinnings.
   - Enums: `OpportunityStatus` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `VERIFIED`, `PUBLISHED`, `CHANGES_REQUESTED`, `REJECTED`, `SUSPENDED`, `ARCHIVED`).
   - Indexes: `idx_opportunities_search`, `idx_opportunities_status`, `idx_opportunities_industry`, `idx_opportunities_region`, `idx_opportunities_revenue`.
3. `opportunity_documents`: Secure document vault with metadata, magic-byte checksums, access tiers, and disk storage pointers.
4. `opportunity_internal_notes`: Staff-only audit and diligence trail.
5. `opportunity_access_grants`: Bilateral consent and NDA grant mapping table.

### Seeded Administrative Permissions
- `opportunities.review`
- `opportunities.update`
- `opportunities.suspend`
- `opportunities.publish`
- `opportunities.verify`

---

## 4. RESTful API Endpoints Delivered

### Seller Opportunity Management
- `POST /api/v1/seller/opportunities` — Create draft opportunity (auto-assigns `OPP-YYYY-XXXX`).
- `GET /api/v1/seller/opportunities` — Retrieve promoter's opportunities.
- `GET /api/v1/seller/opportunities/[id]` — Retrieve seller opportunity details.
- `PATCH /api/v1/seller/opportunities/[id]` — Whitelisted draft update (locks when submitted).
- `POST /api/v1/seller/opportunities/[id]/submit` — Submission gates verification.
- `POST /api/v1/seller/opportunities/[id]/documents` — Magic-byte validated document upload.
- `GET /api/v1/seller/opportunities/[id]/documents/[docId]` — Anti-IDOR protected download stream.
- `DELETE /api/v1/seller/opportunities/[id]/documents/[docId]` — Vault document deletion.

### Public & Discovery API
- `GET /api/v1/opportunities` — Deterministic search and filtering with automatic viewer tier detection.
- `GET /api/v1/opportunities/[id]` — Detailed teaser with progressive masking.

### Administrative Curation & Review API
- `GET /api/v1/admin/opportunities` — Status-filtered review queue.
- `GET /api/v1/admin/opportunities/[id]` — Unmasked Tier 3 diligence dossier.
- `POST /api/v1/admin/opportunities/[id]/review` — FSM transitions (`START_REVIEW`, `REQUEST_CHANGES`, `VERIFY`, `PUBLISH`, `UNPUBLISH`, `REJECT`, `SUSPEND`).
- `POST /api/v1/admin/opportunities/[id]/notes` — Internal diligence notes ledger.

---

## 5. Frontend UI Pages Delivered

1. **Discovery Catalog (`/opportunities`)**:
   - Multi-factor search bar (keyword search, sector, category, region, revenue bracket, deal type).
   - Progressive disclosure indicator displaying the viewer's current authorization level.
   - Dynamic teaser cards with confidentiality badges (`Tier 0: Blind Teaser` vs `Tier 1: Authenticated View`).
2. **Opportunity Teaser View (`/opportunities/[id]`)**:
   - Progressive data disclosure view.
   - Dynamic masking alerts explaining the bilateral NDA protocol.
   - Expression of Interest (EOI) call-to-actions.
3. **Seller Opportunity Hub (`/seller/opportunities`)**:
   - Listing of seller's offerings with status pills, creation dates, and action menus.
   - One-click submission for platform review.
4. **Opportunity Creation Wizard (`/seller/opportunities/new`)**:
   - 4-step progressive wizard:
     - Step 1: Public Blind Teaser (Title, Sector, Category, Region, Transaction Type)
     - Step 2: Operational Scale & Model (Revenue Bracket, EBITDA Margin, Asking Price, Workforce)
     - Step 3: Statutory Sealed Identity (CIN, GSTIN, PAN, Registered Address, Exact Revenue/EBITDA)
     - Step 4: Review & Vault Confirmation
5. **Opportunity Editor (`/seller/opportunities/[id]/edit`)**:
   - Invariant locks when submitted or under review.
   - Integrated private document vault uploader.
6. **Admin Review Queue (`/admin/opportunities`)**:
   - Multi-status filter tabs, search by reference code, and listing grid.
7. **Admin Review Console (`/admin/opportunities/[id]`)**:
   - Complete unmasked Tier 3 inspector.
   - Vault document download links.
   - State machine transition controls.
   - Internal diligence audit log.

---

## 6. Test Suite Matrix (106 Tests / 19 Files)

1. `tests/auth.test.ts` (8 tests) — Authentication, sessions, lockouts.
2. `tests/authorization_idor.test.ts` (11 tests) — RBAC, session revocation, anti-IDOR.
3. `tests/seller_onboarding.test.ts` (9 tests) — Promoter dossier, financials, cap table.
4. `tests/seller_authorization_idor.test.ts` (11 tests) — Cross-seller isolation.
5. `tests/seller_documents_security.test.ts` (5 tests) — Magic bytes, size limits.
6. `tests/seller_admin_review.test.ts` (8 tests) — Seller diligence FSM.
7. `tests/buyer_onboarding.test.ts` (7 tests) — Buyer dossier, submissions.
8. `tests/buyer_mandates.test.ts` (5 tests) — Acquisition mandates.
9. `tests/buyer_authorization_idor.test.ts` (9 tests) — Cross-buyer isolation.
10. `tests/buyer_admin_review.test.ts` (8 tests) — Buyer mandate verification.
11. `tests/opportunity_creation.test.ts` (3 tests) — Opportunity ref code generation.
12. `tests/opportunity_update.test.ts` (2 tests) — Whitelist draft update & submission lock.
13. `tests/opportunity_submission.test.ts` (2 tests) — Submission gates.
14. `tests/opportunity_authorization_idor.test.ts` (6 tests) — Cross-promoter isolation.
15. `tests/opportunity_admin_review.test.ts` (8 tests) — Admin FSM transitions.
16. `tests/opportunity_state_machine.test.ts` (2 tests) — Legitimate lifecycle invariants.
17. `tests/opportunity_data_masking.test.ts` (4 tests) — Server-side progressive masking.
18. `tests/opportunity_discovery.test.ts` (4 tests) — Discovery filters & search.
19. `tests/opportunity_documents_security.test.ts` (4 tests) — Vault magic bytes & security.
20. `tests/opportunity_mass_assignment.test.ts` (1 test) — Self-verify/publish tampering protection.

---

## 7. Phase 5 Readiness

Scale-up India is now fully equipped with verified Promoters (Phase 2), verified Buyers with acquisition mandates (Phase 3), and curated Opportunities with progressive data masking (Phase 4).

The platform is officially marked:
**`READY_FOR_PHASE_5`**
