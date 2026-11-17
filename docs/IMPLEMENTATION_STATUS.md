# Scale-up India — Implementation Status (IMPLEMENTATION_STATUS.md)
*Status as of Phase 10 Completion (2026-11-15)*

---

## 1. Phase Progress Summary

| Phase | Description | Status | Verification Result |
| :--- | :--- | :---: | :--- |
| **Phase 0** | Architecture, Database Schema, Security Model, RBAC Matrix, State Machine, Test Plan | **COMPLETED** | All 8 specification files written and verified in `/docs` and root |
| **Phase 1** | Enterprise Authentication, Multi-Role User Model, Sessions, Email Verification, Password Reset, RBAC Foundation, Server-Side Authorization & Anti-IDOR | **COMPLETED** | 19 / 19 Tests Passed (`typecheck`, `lint`, `vitest`, `build` clean) |
| **Phase 2** | Seller / Promoter Onboarding & Business Profiling (Dossier drafts, company details, multi-year financials, ownership cap table, preferences, document vault, admin review) | **COMPLETED** | 41 / 41 Tests Passed across 5 suites (`typecheck`, `lint`, `vitest`, `build` clean) |
| **Phase 3** | Buyer & Investor Onboarding (Acquisition mandates, financial capacity, target industries/geographies, governance preferences, document vault, admin review) | **COMPLETED** | 70 / 70 Tests Passed across 9 suites (`typecheck`, `lint`, `vitest`, `build` clean) |
| **Phase 4** | Opportunity Management & Progressive Data Masking (Tier 0 to Tier 3, Seller Opportunity Wizard, Document Vault with magic bytes, Multi-Factor Discovery Catalog, Admin Curation Desk) | **COMPLETED** | 106 / 106 Tests Passed across 19 suites (`typecheck`, `lint`, `vitest`, `build` clean) |
| **Phase 5** | Deterministic Matching Engine (Structured Buyer Mandate vs. Published Opportunity evaluation, 7 weighted dimensions, hard gates, zero AI/LLM, Anti-IDOR, confidential masking) | **COMPLETED** | 141 / 141 Tests Passed across 21 suites (`typecheck`, `lint`, `vitest`, `build`, security gate clean) |
| **Phase 5.1** | Match Integrity Gate (Anti-staleness guarantees, Cases A-I cache invalidation, referential integrity cascades, tamper defense) | **COMPLETED** | 151 / 151 Tests Passed across 22 suites, 46/46 security gate assertions passed (`typecheck`, `lint`, `vitest`, `build` clean) |
| **Phase 6** | Search, High-Throughput Filtering & Confidential Catalog (Migration 006, Whitelisted multi-factor search, safe pagination, match-aware sorting, Anti-IDOR, anti-enumeration, responsive UI) | **COMPLETED** | 192 / 192 Tests Passed across 23 suites, 24/24 security gate assertions passed (100%), Next.js 55/55 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 7** | Expression of Interest (EOI) & Bilateral Interest Workflow (Migration 007, FSM state machine, partial unique anti-duplication index, safe buyer/seller views, zero premature statutory unlocking, in-app notifications) | **COMPLETED** | 234 / 234 Tests Passed across 24 suites, 36/36 security gate assertions passed (100%), Next.js 60/60 routes PASS (`typecheck`, `lint`, `vitest`, `build`, live smoke clean) |
| **Phase 8** | Bilateral NDA & Secure Data Room (Migration 008, Bilateral countersignature FSM, PENDING_NDA -> ACTIVE, Explicit server-side room members, Private storage vault outside web root, Magic byte verification, HMAC-SHA256 short-lived signed URLs, Anti-IDOR, Soft-deletion, Admin room revocation, Immutable audit trail, In-app notifications) | **COMPLETED** | 267 / 267 Tests Passed across 25 suites, 61/61 security gate assertions passed (100%), Next.js 64/64 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 9** | Secure Deal Communication / Messaging (Migration 009, Bilateral conversation FSM, strict bilateral NDA execution gate, Anti-IDOR, safe plain-text XSS immunity, cursor pagination, sliding-window rate limit, immutable privacy-preserving audit logging) | **COMPLETED** | 301 / 301 Tests Passed across 26 suites, 57/57 security gate assertions passed (100%), Next.js 67/67 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 10**| Deal Intent & Bilateral MOU Workflow (Migration 010, FSM: DRAFT/PROPOSED/COUNTERED/ACCEPTED/REJECTED/WITHDRAWN, strict bilateral NDA execution gate, immutable version history in mou_versions, Anti-IDOR, safe progressive disclosure, non-binding disclaimer, in-app notifications, immutable privacy audit) | **COMPLETED** | 320 / 320 Tests Passed across 27 suites, 55/55 security gate assertions passed (100%), Next.js 70/70 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 11**| Payment / Token Architecture (Migration 011, Escrow/earnest deposit intent, token ledger, provider abstraction, webhook verification, immutable double-entry ledger, reconciliation) | **COMPLETED** | 343 / 343 Tests Passed across 28 suites, 64/64 security gate assertions passed (100%), Next.js 73/73 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 12**| Due Diligence Workspace & Evidence Management (Migration 012, 12-category diligence room, strict 4-gate precondition, cryptographic vault, HMAC-SHA256 download tokens, severity issue tracker) | **COMPLETED** | 369 / 369 Tests Passed across 29 suites, 54/54 security gate assertions passed (100%), Next.js 77/77 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 13**| Valuation Engine & Verified Valuation Workspace (Migration 013, 5 deterministic methodologies, 6-factor confidence score, strict 5-gate precondition, immutable versioning, progressive confidentiality) | **COMPLETED** | 401 / 401 Tests Passed across 30 suites, 61/61 security gate assertions passed (100%), Next.js 83/83 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 14**| Transaction / Deal Room & Closing Engine (Migration 014, 7-gate precondition, 10 deterministic closing conditions, closing document vault with magic bytes, bilateral confirmations, row-locked atomic closing, immutable closing records) | **COMPLETED** | 426 / 426 Tests Passed across 31 suites, 66/66 security gate assertions passed (100%), Next.js 87/87 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 15**| Notifications & Communication Platform (Migration 015, Transactional outbox pattern, deterministic idempotency, progressive confidentiality, email provider abstraction, truthful delivery state machine, bounded retries & dead letter, webhook replay protection, notification center UI) | **COMPLETED** | 446 / 446 Tests Passed across 32 suites, 55/55 security gate assertions passed (100%), Next.js 94/94 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 16**| Enterprise Security Hardening (Migration 016, MFA TOTP encryption & recovery codes, security telemetry, SSRF defense, magic-byte inspection, signed download tokens, sliding-window rate limit, anti-self-approval matrix, OWASP security headers, CSRF origin defense) | **COMPLETED** | 465 / 465 Tests Passed across 33 suites, 65/65 security gate assertions passed (100%), Next.js 95/95 routes PASS (`typecheck`, `lint`, `vitest`, `build`, smoke tests clean) |
| **Phase 17**| Full End-to-End, Security, Workflow & Production Validation (Complete 23-stage platform lifecycle, 26 security categories, multi-tenant isolation, global Anti-IDOR, financial integrity, post-closing immutability, automated security gate) | **COMPLETED** | 473 / 473 Tests Passed across 34 suites (100%), 53/53 security gate assertions passed (100%), Next.js build PASS (7.8s), live smoke clean (`typecheck 0`, `lint 0`) |
| **Phase 18**| End-to-End Deal Room Playwright Journeys (FLOW 1 to 5) (Chromium Headless, real Next.js sessions, multi-tenant isolation, 5 complete continuous deal room journeys, security & role matrix, zero-leakage masking, magic-byte inspection, directory traversal neutralization, atomic closing & post-closing immutability) | **COMPLETED** | 34 / 34 Browser Tests Passed across 6 suites (100%), 17/17 Playwright gate assertions passed (100%), Full regression 473/473 PASS, Next.js build clean (9.0s), Typecheck 0, Lint 0 |
| **Phase 19**| Production Hardening & Cloud Deployment | *Queued* | Final Phase |

---

## 2. Phase 1 Implementation Summary
- **Database**: `001_initial_auth_rbac.sql` (`roles`, `permissions`, `role_permissions`, `users`, `user_roles`, `sessions`, `verification_tokens`, `audit_logs`).
- **Authentication**: Bcrypt 12 rounds, constant-time comparisons, HTTP-only SameSite=Lax cookies, brute-force lockout (5 attempts $\to$ 15m lockout), global session invalidation.
- **Frontend Pages**: Home, Login, Register, Forgot Password, Reset Password, Verify Email, Protected Dashboard.
- **Tests**: 19 tests passing across `tests/auth.test.ts` and `tests/authorization_idor.test.ts`.

---

## 3. Phase 2 Implementation Details: Seller / Promoter Onboarding & Business Profiling

### Database & Migrations
- Migration script: `src/lib/migrations/002_seller_onboarding.sql`
- Relational schema tables created:
  * `seller_profiles`: Primary promoter profile and dossier status tracking (`onboarding_status`, `completion_percentage`, `changes_requested_notes`, `rejection_reason`, `assigned_reviewer_id`, `submitted_at`, `verified_at`, `verified_by`).
  * `business_profiles`: Business overview, statutory identifiers (CIN, GSTIN, PAN), industry, sub-sector, year established, location, employees, description, website, MSME status.
  * `business_financial_profiles`: Multi-year audited financial records (revenue, EBITDA, PAT, net worth, debt, assets, liabilities, cash flow, audit status).
  * `business_ownerships`: Shareholding cap table with owner types, percentages, holding entities, and control rights.
  * `seller_transaction_preferences`: Deal intents (full sale, partial stake, JV, investment), valuation expectations, deal sizes, buyer profiles, and strategic objectives.
  * `seller_documents`: Anti-tamper private document vault (storage key, MIME type, file size, SHA-256 checksum, review status).
  * `seller_internal_notes`: Strict confidential notes desk for verification staff (categories: `GENERAL`, `COMPLIANCE`, `FINANCIAL`, `VALUATION`, `RISK`), hidden from sellers.
  * `onboarding_progress`: Server-side draft autosave storage (`draft_payload`, `last_active_section`, `sections_completed`).
- Granular administrative permissions seeded:
  * `sellers.read`, `sellers.review`, `sellers.verify` granted to `SUPER_ADMIN`, `ADMIN`, `VERIFICATION_MANAGER`.

### Backend Domain Services
- `src/domains/documents/service.ts`:
  * Magic-byte validation (`%PDF-`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`).
  * 15MB file size limit enforcement.
  * SHA-256 checksum calculation and anti-tamper storage outside web root (`data/vault/sellers/`).
  * Anti-IDOR download streamer and soft deletion.
- `src/domains/seller/service.ts`:
  * Zero-client-trust dossier loader and autosave processor.
  * Business profile validations (CIN, GSTIN, PAN format checks, non-negative employee counts).
  * Cap table equity distributor (enforces total ownership $\le 100\%$).
  * Multi-year financial record upserts.
  * Formal submission workflow (`SUBMITTED`) with completeness checks.
  * Strict Finite State Machine: `DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `VERIFIED` / `CHANGES_REQUESTED` / `REJECTED`.
  * Administrative dossier listing with pagination, status filtering, and multi-field search.
  * Confidential internal note logging.

### APIs Created
- `GET  /api/v1/seller/onboarding`: Load full seller dossier and draft progress.
- `POST /api/v1/seller/onboarding`: Save draft payload without validation hurdles.
- `POST /api/v1/seller/profile`: Save Section 1 promoter details.
- `POST /api/v1/seller/business`: Save Sections 2 & 3 statutory identifiers and operations.
- `POST /api/v1/seller/financials`: Save Section 4 multi-year financials.
- `POST /api/v1/seller/ownership`: Save Section 5 ownership cap table.
- `POST /api/v1/seller/transaction-preferences`: Save Section 6 deal intent and preferences.
- `POST /api/v1/seller/documents`: Multipart document upload with magic-byte verification.
- `GET  /api/v1/seller/documents/[documentId]`: Anti-IDOR private document download stream.
- `DELETE /api/v1/seller/documents/[documentId]`: Safe document deletion.
- `POST /api/v1/seller/onboarding/submit`: Submit complete dossier for verification (`SUBMITTED`).
- `GET  /api/v1/admin/sellers`: Admin listing of seller submissions with filters and pagination.
- `GET  /api/v1/admin/sellers/[sellerId]`: Admin full dossier inspection.
- `POST /api/v1/admin/sellers/[sellerId]/review`: Admin state machine transitions (`START_REVIEW`, `REQUEST_CHANGES`, `VERIFY`, `REJECT`).
- `POST /api/v1/admin/sellers/[sellerId]/notes`: Admin internal review notes logging.

### Frontend Pages
- `src/app/(dashboard)/onboarding/seller/page.tsx`:
  * 7-step onboarding wizard with progress tracker and completion percentage.
  * Server-side draft autosave with instant recovery.
  * Real-time cap table equity validator (sum check).
  * Private document vault uploader with magic byte check, size, checksum, and deletion.
  * Read-only lock mode once in `SUBMITTED`, `UNDER_REVIEW`, or `VERIFIED` state.
- `src/app/admin/sellers/page.tsx`:
  * Administrative listing of commercial seller dossiers.
  * Status filter tabs (`ALL`, `SUBMITTED`, `UNDER_REVIEW`, `CHANGES_REQUESTED`, `VERIFIED`, `REJECTED`, `DRAFT`).
  * Live search by business name, promoter name, email, or industry.
  * Summary metrics strip and pagination.
- `src/app/admin/sellers/[sellerId]/page.tsx`:
  * Complete dossier inspection console.
  * Action controls: "Start Review", "Request Changes" (with promoter instructions), "Verify Dossier", "Reject Dossier" (with mandatory reason).
  * Direct document downloads.
  * Confidential internal notes desk with categorized logging (`GENERAL`, `COMPLIANCE`, `FINANCIAL`, `VALUATION`, `RISK`).

---

## 4. Phase 3 Implementation Details: Buyer / Investor Onboarding & Acquisition Mandates

### Database & Migrations
- Migration script: `src/lib/migrations/003_buyer_onboarding.sql`
- Relational schema tables created:
  * `buyer_profiles`: Buyer entity & persona (`INDIVIDUAL_INVESTOR`, `CORPORATE_BUYER`, `PE_FUND`, `VC_FUND`, `FAMILY_OFFICE`, `STRATEGIC_PARTNER`), legal name, registration number, location, website, fund metrics (fund size, AUM, vintage), contact person, onboarding status, completion percentage.
  * `acquisition_mandates`: Multiple acquisition mandates per buyer (`min_investment`, `max_investment`, `preferred_ticket_size`, `available_capital`, `revenue_min/max`, `ebitda_min/max`, `employee_min/max`, `transaction_types`, `control_preference`, `strategic_objectives`, `turnaround/profitable/growth` preferences, `investment_horizon`, `funding_source`).
  * `mandate_target_industries`: Industry taxonomy and sub-sector mappings.
  * `mandate_target_geographies`: Geographic targeting (`PAN_INDIA`, `NORTH_INDIA`, `SOUTH_INDIA`, `WEST_INDIA`, `EAST_INDIA`, `GLOBAL`, states, cities).
  * `buyer_documents`: Private document vault for company registration, fund profile, proof of funds, and authorization letters with magic-byte verification and SHA-256 checksums.
  * `buyer_internal_notes`: Strictly confidential staff diligence notes desk (`GENERAL`, `COMPLIANCE`, `FINANCIAL`, `MANDATE`, `RISK`).
  * `buyer_onboarding_progress`: Server-side draft autosave storage.
- Seeded Permissions:
  * `buyers.read`, `buyers.review`, `buyers.verify`, `buyers.suspend` granted to `SUPER_ADMIN`, `ADMIN`, `VERIFICATION_MANAGER`.

### Backend Domain Services
- `src/domains/buyer/service.ts`:
  * Profile lifecycle management (`getOrCreateBuyerProfile`, `updateBuyerProfile`, `getBuyerDossier`).
  * Multiple acquisition mandates CRUD with mathematical validation (`min <= max`) and normalization.
  * Finite State Machine: `DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `VERIFIED` / `CHANGES_REQUESTED` / `REJECTED` / `SUSPENDED`.
  * Administrative queue listing with pagination, search, and status filtering.
  * Internal review notes management.
- `src/domains/documents/service.ts`:
  * Extended to support `uploadBuyerDocument`, `getBuyerDocumentForDownload`, and `deleteBuyerDocument` with identical anti-tamper and Anti-IDOR guards.

### APIs Created
- `GET/POST/PATCH /api/v1/buyer/profile`: Buyer entity and contact profile.
- `GET/POST /api/v1/buyer/mandates`: List and create acquisition mandates.
- `GET/PATCH/DELETE /api/v1/buyer/mandates/[mandateId]`: Inspect, update, or archive mandate.
- `POST /api/v1/buyer/mandates/[mandateId]/submit`: Submit mandate for review.
- `GET/POST /api/v1/buyer/onboarding/draft`: Draft autosave and resumption.
- `POST /api/v1/buyer/onboarding/submit`: Submit complete dossier for verification.
- `POST /api/v1/buyer/documents`: Multipart document upload with magic byte check.
- `GET/DELETE /api/v1/buyer/documents/[documentId]`: Anti-IDOR download stream and deletion.
- `GET /api/v1/admin/buyers`: Admin listing of buyers with filters and pagination.
- `GET /api/v1/admin/buyers/[buyerId]`: Admin full dossier inspection.
- `POST /api/v1/admin/buyers/[buyerId]/review`: State transitions (`START_REVIEW`, `REQUEST_CHANGES`, `VERIFY`, `REJECT`, `SUSPEND`).
- `POST /api/v1/admin/buyers/[buyerId]/notes`: Record internal diligence notes.

### Frontend Pages
- `src/app/(dashboard)/onboarding/buyer/page.tsx`: 6-step onboarding wizard for buyer profiles, multiple acquisition mandates manager, document vault uploader, and review submission.
- `src/app/admin/buyers/page.tsx`: Administrative queue with status tabs, search, metrics, and pagination.
- `src/app/admin/buyers/[buyerId]/page.tsx`: Complete buyer inspection console with review modals and confidential notes desk.

---

## 5. Verification & Test Metrics

```
Test Files  9 passed (9)
Tests       70 passed (70)
Duration    21.77s

✓ tests/auth.test.ts (8 tests)
✓ tests/authorization_idor.test.ts (11 tests)
✓ tests/seller_onboarding.test.ts (9 tests)
✓ tests/seller_documents_security.test.ts (5 tests)
✓ tests/seller_admin_review.test.ts (8 tests)
✓ tests/buyer_onboarding.test.ts (7 tests)
✓ tests/buyer_mandates.test.ts (5 tests)
✓ tests/buyer_authorization_idor.test.ts (9 tests)
✓ tests/buyer_admin_review.test.ts (8 tests)

Pipeline Quality Gates:
- TypeScript (tsc --noEmit): PASS (0 errors)
- ESLint (next lint): PASS (0 warnings, 0 errors)
- Production Build (next build): PASS (45/45 routes compiled cleanly)
- Test Suites: 9 passed, 70/70 tests passed (0 failures, 0 skipped)
- Dev Server: Running cleanly on http://localhost:3000 (0 runtime errors, 0 broken assets)
```

---

## 6. Public Marketing & Legal Pages (Stabilization)

To ensure zero dead buttons or 404 links anywhere across the platform:
- `src/app/opportunities/page.tsx`: Curated confidential opportunities desk & Phase 4 progressive masking preview.
- `src/app/services/page.tsx`: Institutional transaction advisory & 12-category DD room overview.
- `src/app/about/page.tsx`: Platform background, mission, and operating charter.
- `src/app/contact/page.tsx`: Transaction support desk & office coordinates.
- `src/app/confidentiality/page.tsx`: Confidentiality charter & tripartite NDA policy.
- `src/app/disclaimer/page.tsx`: Statutory regulatory disclaimer (non-NBFC, non-SEBI broker).
- `src/app/privacy/page.tsx`: DPDP Act & Indian IT Act data protection policy.
- `src/app/terms/page.tsx`: Bilateral commercial terms of platform use.

---

## 7. Phase 5 & 5.1: Deterministic Matching Engine & Integrity Gate
- 7-dimension weighted deterministic evaluator (`industry`, `location`, `dealSize`, `transactionType`, `businessModel`, `ebitdaMargin`, `timeline`).
- Strict hard gates (disqualification for deal size divergence or transaction type mismatch).
- Automatic match invalidation on mandate or opportunity modification (Cases A-I).
- 22 test suites, 151/151 tests passed.
- 46/46 security gate assertions passed.

---

## 8. Phase 6: Search, High-Throughput Filtering & Confidential Discovery Catalog
- **Migration 006**: Partial and composite indexes (`idx_opportunities_discovery_pub`, `idx_opportunities_biz_category`, `idx_opportunities_biz_model`, `idx_opportunities_ebitda_margin`, `idx_opportunities_asking_price`).
- **Whitelisted Search**: Parameterized search across non-confidential fields (`title`, `teaser_summary`, `detailed_description`, `industry`, `sub_sector`, `reference_code`, `registered_state`).
- **Structured Multi-Factor Filters**: `industry`, `subSector`, `businessCategory`, `region`, `transactionType`, `businessModel`, `revenueBracket`, `ebitdaBracket`, `askingPriceBracket`.
- **Match-Aware Sorting**: Authenticated buyers transparently receive their deterministic match scores via server-side JOIN.
- **Anti-IDOR Security**: Client query parameters cannot specify `buyerId`; buyer identity is derived exclusively from session.
- **Anti-Enumeration Defense**: Draft, rejected, suspended, and nonexistent opportunities return uniform `404 Not Found`.
- **Progressive Data Masking**: Strict Tier 0 (public) and Tier 1 (authenticated buyer) scrubbing of CIN, GSTIN, PAN, exact address, and raw documents.
- **Quality Gates**:
  - TypeScript: PASS (0 errors)
  - ESLint: PASS (0 warnings, 0 errors)
  - Vitest: 23 test suites passed, 192 / 192 tests passed (41 Phase 6 catalog tests)
  - Security Gate: 24 / 24 assertions passed (100%)
  - Production Build: 55 / 55 routes compiled cleanly
  - Live HTTP Smoke Tests: All key routes return 200 (and 401 unauthenticated)
- **Status**: **READY_FOR_PHASE_7**

---

## 9. Phase 7: Expression of Interest (EOI) & Bilateral Interest Workflow
- **Migration 007 (`007_expression_of_interest.sql`)**:
  - Sequence `eoi_ref_seq START WITH 10001` for human-readable codes (`EOI-2026-10001`).
  - Table `expressions_of_interest` with bilateral fields, audit timestamps, and decline/clarification columns.
  - Partial Unique Index `idx_eoi_active_buyer_opp` (`WHERE status IN ('SUBMITTED', 'UNDER_REVIEW', 'CLARIFICATION_REQUESTED', 'ACCEPTED')`) enforcing database-level anti-duplication and race condition defense.
  - Table `in_app_notifications` with indexed unread querying.
  - Permissions: `eoi.create`, `eoi.read_own`, `eoi.withdraw_own`, `eoi.read_received`, `eoi.respond`, `eoi.read_all`, `eoi.manage`.
- **Finite State Machine**:
  - `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `ACCEPTED` / `DECLINED` / `CLARIFICATION_REQUESTED` / `WITHDRAWN` / `EXPIRED`.
  - Rejection of forbidden transitions: `ACCEPTED` cannot be withdrawn or declined; `DECLINED` cannot be accepted; `WITHDRAWN` cannot be accepted.
- **Progressive Data Masking & Critical Confidentiality Gate**:
  - Seller receives Safe Buyer Summary (entity type, target sector, region, timeline, message, match score) with zero buyer CIN/PAN/AUM/documents.
  - Buyer receives masked opportunity teaser with zero seller CIN/GSTIN/PAN/exact address/audited accounts.
  - Explicit regression assertion verifies accepting an EOI does NOT grant Tier 2/3 data or unlock documents.
- **Zero-Client-Trust Anti-IDOR & Mass-Assignment Defense**:
  - All buyer and seller actions validated against session-derived user ID.
  - Client attempts to inject `status`, `buyerId`, `sellerId`, or timestamps are sanitized and rejected.
- **Truthful Audit & Notifications**:
  - Actions recorded in immutable `audit_logs` (`EOI_SUBMITTED`, `EOI_VIEWED`, `EOI_ACCEPTED`, `EOI_DECLINED`, `EOI_WITHDRAWN`).
  - Real database in-app notifications generated for counterparties.
- **Quality Gates**:
  - TypeScript: PASS (0 errors)
  - ESLint: PASS (0 warnings, 0 errors)
  - Vitest: 24 test suites passed, 234 / 234 tests passed (42 Phase 7 EOI tests)
  - Security Gate (`scripts/phase7_security_gate.ts`): 36 / 36 assertions passed (100%)
  - Production Build: 60 / 60 routes compiled cleanly
  - Live HTTP Smoke Tests: All key UI routes return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_8**

---

## 10. Phase 8: Bilateral NDA & Secure Virtual Data Room (VDR)
- **Migration 008 (`008_nda_and_data_room.sql`)**:
  - Sequences `nda_ref_seq` and `vdr_ref_seq` starting at 10001 (`NDA-2026-10001`, `VDR-2026-10001`).
  - Relational schema tables: `nda_agreements`, `data_rooms`, `data_room_members`, `data_room_documents`.
  - Partial Unique Index `idx_nda_active_buyer_opp` (`WHERE status IN ('NDA_DRAFT', 'NDA_SENT', 'BUYER_VIEWED', 'BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXECUTED')`) preventing simultaneous active NDAs for same buyer/listing.
  - Partial Unique Index `idx_vdr_active_nda` on `data_rooms(nda_id)` (`WHERE status IN ('PENDING_NDA', 'ACTIVE')`).
  - Permissions: `nda.create`, `nda.read_own`, `nda.accept`, `nda.decline`, `nda.read_all`, `nda.manage`, `vdr.access`, `vdr.upload`, `vdr.download`, `vdr.manage`, `vdr.read_all`.
- **Bilateral Countersignature State Machine**:
  - `NDA_SENT` $\to$ `BUYER_VIEWED` $\to$ `BUYER_ACCEPTED` / `SELLER_ACCEPTED` $\to$ `EXECUTED` (or `DECLINED` / `REVOKED` / `EXPIRED`).
  - Data room status remains non-existent or `PENDING_NDA` until both parties have accepted.
  - Bilateral execution activates the virtual data room and registers explicit memberships (`BUYER`, `SELLER`).
- **Strict Confidentiality & Storage Invariants**:
  - **ACCEPTED EOI DOES NOT UNLOCK THE DATA ROOM**: Data room access is blocked (403 Forbidden) until bilateral NDA reaches `EXECUTED`.
  - Unilateral acceptance does not unlock data room.
  - Non-members cannot access data room or generate signed download tokens (Anti-IDOR).
  - Storage strictly outside web root in `data/vault/datarooms/[dataRoomId]/`.
  - Magic-byte inspection (`%PDF-`, PNG, JPEG headers) defeats MIME-type spoofing attacks.
  - Strict 15MB file ceiling and path traversal defenses (`../../../` prohibited).
- **HMAC-SHA256 Signed URLs**:
  - Constant-time verification (`crypto.timingSafeEqual`).
  - Short-lived TTL (default 300s).
  - Re-verifies data room, NDA status, membership, and document status in DB on download.
  - Soft deletion and administrative revocation instantly cut off access.
- **Truthful Audit & Notifications**:
  - Full audit trail: `NDA_CREATED`, `NDA_VIEWED`, `NDA_ACCEPTED`, `NDA_EXECUTED`, `DATA_ROOM_CREATED`, `DOCUMENT_UPLOADED`, `SIGNED_URL_ISSUED`, `DOCUMENT_DOWNLOADED`, `DATA_ROOM_REVOKED`.
  - Real database in-app notifications generated for counterparties.
- **Quality Gates**:
  - TypeScript: PASS (0 errors)
  - ESLint: PASS (0 errors)
  - Vitest: 25 test suites passed, 267 / 267 tests passed (33 Phase 8 NDA/VDR tests)
  - Security Gate (`scripts/phase8_security_gate.ts`): 61 / 61 assertions passed (100%)
  - Production Build: 64 / 64 routes compiled cleanly
  - Live HTTP Smoke Tests: All key UI routes return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_9**

---

## 11. Phase 9: Secure Deal Communication / Messaging
- **Migration 009 (`009_secure_deal_communication.sql`)**:
  - Sequence `conv_ref_seq` starting at 10001 (`CONV-2026-10001`).
  - Relational schema tables: `deal_conversations`, `deal_conversation_participants`, `deal_messages`.
  - Partial Unique Index `idx_deal_conv_active_nda` on `deal_conversations(nda_id)` (`WHERE status IN ('ACTIVE', 'CLOSED')`) enforcing exactly one conversation per bilateral NDA.
  - Unique Constraint `uq_deal_conv_participant` on `deal_conversation_participants(conversation_id, user_id)` preventing duplicate membership.
  - Performance composite indexes: `idx_deal_messages_conv_created` on `deal_messages(conversation_id, created_at DESC)`.
  - Granular RBAC permissions seeded: `messaging.read`, `messaging.send`, `messaging.close`, `messaging.manage`, `messaging.read_all` for `BUYER`, `SELLER`, `SUPER_ADMIN`.
- **Strict Bilateral NDA Execution Gate**:
  - Deals conversations cannot be initiated unless the linked bilateral NDA has reached `EXECUTED` state.
  - Conversations cannot be initiated or messages sent on unexecuted, draft, declined, or revoked NDAs.
- **Server-Side Authorization & Anti-IDOR Defense**:
  - Every message read, list, send, mark-read, soft-delete, and close action strictly derives participant membership and sender identity from session auth (`ctx.user.id`).
  - Zero trust in client payload for sender identity; mass-assignment attempts to impersonate counterparties or manipulate foreign keys are completely thwarted.
  - Direct object reference probes by unauthorized buyers/sellers to read, send, or delete in other conversations throw strict `ForbiddenError` (HTTP 403).
- **Anti-XSS & Content Security**:
  - Content safely preserved in DB and rendered as standard DOM text nodes (`whitespace-pre-wrap break-words text-slate-800`), completely immune to HTML/script injection. Zero `dangerouslySetInnerHTML`.
- **Truthful Read State Isolation**:
  - Per-participant `last_read_at` tracking in `deal_conversation_participants`.
  - Recipient unread count calculated accurately on server via SQL count. Marking conversation as read updates recipient's timestamp without leaking counterparty read status.
- **Cursor-Based Pagination & Rate Limiting**:
  - Bounded pagination (default 20, max 50) using ISO timestamp cursor.
  - Sliding-window rate limiter (30 messages per minute per user) mitigating automated message flooding.
- **Soft Deletion with Audit Placeholder**:
  - Soft deletion transitions message status to `SOFT_DELETED`.
  - Replaces text in paginated responses with audit placeholder `"This message was deleted by the sender."` while preserving database record for regulatory audit.
- **Privacy-Preserving Audit Logging & Notifications**:
  - Immutable audit logs: `DEAL_CONVERSATION_CREATED`, `DEAL_CONVERSATION_ACCESSED`, `DEAL_MESSAGE_SENT`, `DEAL_MESSAGE_DELETED`, `DEAL_CONVERSATION_CLOSED`, `DEAL_CONVERSATION_REVOKED`.
  - **CRITICAL PRIVACY INVARIANT**: Zero message body content or commercial secrets are logged in `audit_logs` (only metadata: sender, conversation ID, message ID, content length).
  - In-app notification triggers (`DEAL_CONVERSATION_STARTED`, `DEAL_MESSAGE_RECEIVED`) alerting counterparty without exposing confidential message text in notification payloads.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 26 test suites passed, 301 / 301 tests passed (34 Phase 9 deal messaging tests)
  - Security Gate (`scripts/phase9_security_gate.ts`): 57 / 57 assertions passed (100%)
  - Production Build: 67 / 67 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: All UI pages return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_10**

---

## 12. Phase 10: Deal Intent & Bilateral MOU Workflow
- **Migration 010 (`010_mou_deal_intent.sql`)**:
  - Sequence `mou_ref_seq` starting at 10001 (`MOU-2026-10001`).
  - Relational schema tables: `deal_mous`, `mou_versions`.
  - Partial Unique Index `idx_mou_active_nda` on `deal_mous(nda_id)` (`WHERE status IN ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED')`) enforcing at most one active or accepted deal intent MOU per bilateral deal.
  - Unique Constraint `uq_mou_version` on `mou_versions(mou_id, version_number)` enforcing immutable version numbering.
  - Composite index `idx_mou_versions_mou_ver` on `mou_versions(mou_id, version_number DESC)`.
  - Granular RBAC permissions seeded: `mou.create`, `mou.read_own`, `mou.propose`, `mou.counter`, `mou.accept`, `mou.reject`, `mou.withdraw`, `mou.read_all`, `mou.manage` for `BUYER`, `SELLER`, `SUPER_ADMIN`.
- **Strict Bilateral NDA Execution Gate**:
  - Deals intent MOUs cannot be initiated, drafted, proposed, countered, accepted, or viewed unless the linked bilateral NDA has reached `EXECUTED` state.
  - Unexecuted, draft, declined, or revoked NDAs strictly block MOU creation and operations with `ForbiddenError` (HTTP 403).
- **Server-Side Authorization & Anti-IDOR Defense**:
  - Every MOU read, create, propose, counter, accept, reject, withdraw, and version fetch action strictly checks participant ownership against session auth (`ctx.user.id`).
  - Third-party buyers and sellers attempting to inspect or mutate foreign MOUs receive `ForbiddenError` (HTTP 403).
- **Finite State Machine & Turn Enforcement**:
  - Lifecycle: `DRAFT` $\to$ `PROPOSED` $\to$ `COUNTERED` $\longleftrightarrow$ `COUNTERED` $\to$ `ACCEPTED` / `REJECTED` / `WITHDRAWN` / `EXPIRED`.
  - Turn enforcement prevents a party from accepting or countering their own active proposal.
  - Proposers may withdraw active proposals before counterparty acceptance.
  - Acceptance freezes terms, sets `accepted_at` and `accepted_by`, transitioning status to `ACCEPTED`.
- **Immutable Version History**:
  - Every proposed revision or counter increments `version_number` and appends an immutable row in `mou_versions`.
  - Prior active version marked `SUPERSEDED`.
  - Complete revision diff and changelog preserved for regulatory and audit compliance.
- **Progressive Disclosure & Non-Binding Notice**:
  - Non-binding commercial disclaimer prominently displayed across all workspaces:
    *"THIS DOCUMENT IS A NON-BINDING STATEMENT OF MUTUAL INTENT. IT DOES NOT CONSTITUTE A BINDING SHARE PURCHASE AGREEMENT, BUSINESS TRANSFER AGREEMENT, OR ASSET ACQUISITION CONTRACT."*
  - Exclusivity and confidentiality clauses highlighted.
- **Privacy-Preserving Audit Logging & Notifications**:
  - Immutable audit logs: `MOU_CREATED`, `MOU_PROPOSED`, `MOU_VIEWED`, `MOU_COUNTERED`, `MOU_ACCEPTED`, `MOU_REJECTED`, `MOU_WITHDRAWN`.
  - Zero sensitive commercial terms or deal text stored in `audit_logs` (only operational metadata: actor, MOU reference, version number, proposed valuation, exclusivity days).
  - In-app notifications generated for counterparties on all key transitions (`MOU_PROPOSED`, `MOU_COUNTERED`, `MOU_ACCEPTED`, `MOU_REJECTED`, `MOU_WITHDRAWN`).
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 27 test suites passed, 320 / 320 tests passed (19 Phase 10 MOU tests in `tests/mou_workflow.test.ts`)
  - Security Gate (`scripts/phase10_security_gate.ts`): 55 / 55 assertions passed (100%)
  - Production Build: 70 / 70 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: All UI pages return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_11**

---

## 13. Phase 11: Payment / Token Architecture
- **Migration 011 (`011_payment_token_architecture.sql`)**:
  - Sequences: `payment_ref_seq`, `token_ref_seq`, `ledger_ref_seq` starting at 10001 (`PI-2026-10001`, `TOK-2026-10001`, `TX-2026-10001`).
  - Relational schema tables: `payment_intents`, `token_deposits`, `payment_ledger`, `payment_webhook_events`.
  - Partial Unique Index `idx_payment_intents_idempotency` on `(payer_user_id, idempotency_key)` preventing duplicate payments.
  - Partial Unique Index `idx_payment_intents_provider_ref` on `(provider, provider_payment_reference)`.
  - Partial Unique Index `idx_token_deposits_active_mou` on `(mou_id)` (`WHERE status = 'TOKEN_PAYMENT_CONFIRMED'`) enforcing at most one confirmed token deposit per MOU.
  - Unique Constraint `uq_payment_webhook_provider_event` on `(provider, event_id)` guaranteeing webhook replay protection.
  - Granular RBAC permissions seeded: `payments.create`, `payments.read_own`, `payments.cancel`, `payments.read_all`, `payments.manage`, `payments.reconcile` across `BUYER`, `SELLER`, `SUPER_ADMIN`, `ADMIN`, `FINANCE`.
- **Strict MOU Gate Precondition Enforcement**:
  - Payment intent creation requires that the linked Deal Intent MOU is in `ACCEPTED` state and that the underlying bilateral NDA is `EXECUTED`.
  - Draft, proposed, countered, rejected, or withdrawn MOUs strictly block payment intent creation with `ValidationError`.
- **Server-Side Authorization & Anti-IDOR Defense**:
  - Initiating earnest deposits is restricted strictly to the verified buyer (`payer_user_id === user.id`).
  - Sellers cannot initiate buyer earnest deposit intents.
  - Raw payment intent details containing checkout tokens are restricted to the payer or compliance admin.
  - Prospective sellers inspect confirmed earnest deposits through `getTokenDepositForMOU`, strictly masking buyer banking details.
- **Authoritative Amount & Currency Invariant**:
  - Authoritative earnest deposit amount is determined server-side from the accepted MOU terms version.
  - Client attempts to alter amount or pass non-INR currencies are blocked with `PaymentAmountMismatchError` or `PaymentCurrencyMismatchError`.
- **Payment Provider Abstraction & Gateway Security**:
  - `PaymentProvider` interface abstracting Razorpay for production and TestSimulated for test suites.
  - Production guard: in production mode (`NODE_ENV=production`), missing gateway credentials throw `PaymentProviderNotConfiguredError`; simulated test providers are strictly rejected.
  - Constant-time HMAC SHA-256 webhook signature verification.
  - Inbound webhook amount mismatch defense.
- **Append-Only Immutable Double-Entry Ledger**:
  - Every financial transaction appends an immutable row in `payment_ledger` with double-entry directions (`CREDIT` on payment, `DEBIT` on refund), references (`TX-YYYY-10001`), amounts, and audit notes.
  - Mutation or deletion of ledger entries is strictly prohibited.
- **Automated Reconciliation Engine**:
  - Administrative reconciliation detects discrepancies between gateway status and internal records and auto-heals state with `RECONCILIATION_CORRECTION` ledger entries.
- **Privacy-Preserving Audit Logging & Notifications**:
  - Immutable audit logs: `PAYMENT_INTENT_CREATED`, `PAYMENT_SUCCEEDED`, `REFUND_SUCCEEDED`, `PAYMENT_RECONCILED`.
  - Zero PII, raw secrets, or bank identifiers in audit metadata.
  - In-app notification triggers delivering deposit confirmations to buyer and seller counterparties.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 28 test suites passed, 343 / 343 tests passed (23 Phase 11 payment tests in `tests/payment_workflow.test.ts`)
  - Security Gate (`scripts/phase11_security_gate.ts`): 64 / 64 assertions passed (100%)
  - Production Build: 73 / 73 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: All UI pages return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_12**

---

## 14. Phase 12: Due Diligence Workspace & Evidence Management
- **Migration 012 (`012_due_diligence.sql`)**:
  - Sequences: `dd_case_ref_seq`, `dd_req_ref_seq`, `dd_evd_ref_seq`, `dd_fnd_ref_seq` starting at 10001 (`DD-2026-10001`, `REQ-2026-10001`, `EVD-2026-10001`, `FND-2026-10001`).
  - Relational schema tables: `due_diligence_cases`, `diligence_members`, `diligence_checklist_items`, `diligence_requests`, `diligence_evidence`, `diligence_evidence_versions`, `diligence_clarifications`, `diligence_findings`.
  - Partial Unique Index `idx_dd_active_mou` on `(mou_id)` (`WHERE status NOT IN ('CLOSED', 'REJECTED')`) enforcing at most one active due diligence case per accepted MOU.
  - Unique Constraint `uq_diligence_member_case_user` on `(case_id, user_id)`.
  - Unique Constraint `uq_dd_evidence_version` on `(evidence_id, version_number)`.
  - Granular RBAC permissions seeded: `diligence.create`, `diligence.read_own`, `diligence.read_all`, `diligence.manage`, `diligence.request_docs`, `diligence.upload_evidence`, `diligence.review`, `diligence.findings`, `diligence.download`.
- **Strict 4-Gate Diligence Precondition Enforcement**:
  - Workspace initialization requires:
    1. Linked Opportunity is `PUBLISHED` and not soft-deleted.
    2. Bilateral NDA between Buyer and Seller is `EXECUTED`.
    3. Bilateral Deal Intent MOU is `ACCEPTED`.
    4. Escrow Token Deposit is `TOKEN_PAYMENT_CONFIRMED` in the immutable ledger.
  - Attempting to initialize without satisfying all 4 gates throws `DiligenceGateError` or uniform 404 `NotFoundError`.
- **Cryptographic Evidence Upload & Storage Security**:
  - Uploaded documents stored securely outside web root (`./storage/diligence_vault`).
  - Strict magic-byte validation (`%PDF-1.`, PNG, JPEG headers) blocking disguised executables.
  - Extension whitelisting (`.pdf`, `.png`, `.jpg`, `.jpeg`).
  - Path traversal defense rejecting directory traversal characters.
  - 15MB file size limit.
  - SHA-256 cryptographic checksum calculation and binding.
- **Immutable Evidence Versioning**:
  - Subsequent uploads for a checklist item create an incremental version (`v1 -> v2`).
  - Previous version records in `diligence_evidence_versions` and stored files remain completely immutable and historically auditable.
- **Role Privilege Separation & Zero Self-Approval**:
  - Sellers/Promoters are strictly blocked from reviewing or accepting their own uploaded evidence (`ForbiddenError`).
  - Sellers/Promoters cannot issue document requests to themselves (`ForbiddenError`).
  - Sellers/Promoters cannot create diligence risk findings (`ForbiddenError`).
  - Sellers/Promoters cannot unilaterally transition workspace status (`ForbiddenError`).
  - Document requests, evidence review decisions, clarifications, risk findings, and verdict transitions are reserved for authorized Buyer, Reviewer, or Admin principals.
- **Cryptographic Signed Download Tokens**:
  - Temporary HMAC-SHA256 signed download tokens (300-second TTL) binding `evidenceId`, `versionNumber`, `caseId`, `userId`, and `expiresAt`.
  - Constant-time verification (`crypto.timingSafeEqual`) preventing timing side-channel attacks.
  - Tampered signatures or expired timestamps are rejected with `ForbiddenError`.
- **Finite State Machine & Terminal Locks**:
  - Valid transitions: `INITIATED` $\to$ `REQUESTS_OPEN` / `DOCUMENTS_SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `CLARIFICATION_REQUIRED` $\to$ `REVIEW_COMPLETE` $\to$ `APPROVED` / `REJECTED` $\to$ `CLOSED`.
  - Invalid state jumps throw `InvalidDiligenceStateError`.
  - Terminal lock on `CLOSED` strictly rejects subsequent mutations (`DiligenceCaseClosedError`).
- **Comprehensive Frontends & REST APIs**:
  - Buyer/Reviewer Diligence Workspace: `/buyer/diligence` and `/buyer/diligence/[caseId]`.
  - Promoter Diligence Desk: `/seller/diligence` and `/seller/diligence/[caseId]`.
  - Diligence launcher cards in `/buyer/mous/[mouId]` and `/seller/mous/[mouId]`.
  - 15 server-side API routes under `/api/v1/diligence-cases/...`.
- **Privacy-Preserving Audit Logging & Notifications**:
  - Audit actions: `DILIGENCE_CASE_CREATED`, `DILIGENCE_EVIDENCE_UPLOADED`, `DILIGENCE_EVIDENCE_REVIEWED`, `DILIGENCE_FINDING_CREATED`, `DILIGENCE_DOCUMENT_DOWNLOADED`.
  - Real-time in-app notifications dispatched for request creation, evidence upload, review decisions, and clarification inquiries.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 29 test suites, 369 / 369 tests passed (26 Phase 12 diligence tests in `tests/diligence_workflow.test.ts`)
  - Security Gate (`scripts/phase12_security_gate.ts`): 54 / 54 assertions passed (100%)
  - Production Build: 77 / 77 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: All UI pages return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_13**

### 15. Phase 13: Valuation Engine & Verified Valuation Workspace
- **Authoritative Implementation Date**: 2026-11-15
- **Database Architecture**:
  - Migration: `src/lib/migrations/013_valuation_engine.sql`.
  - 4 sequences: `val_case_ref_seq`, `val_ver_ref_seq`, `val_inp_ref_seq`, `val_adj_ref_seq`.
  - 5 tables: `valuation_cases`, `valuation_versions`, `valuation_inputs`, `valuation_adjustments`, `valuation_comparables`.
  - 9 granular permissions seeded: `valuation.create`, `valuation.read_own`, `valuation.read_all`, `valuation.read_sensitive`, `valuation.update`, `valuation.submit`, `valuation.review`, `valuation.approve`, `valuation.lock`.
- **Server-Side 5-Gate Precondition Enforcement**:
  - Gate 1: Target Opportunity published & not soft-deleted (unpublished returns uniform 404).
  - Gate 2: Bilateral Non-Disclosure Agreement (NDA) executed (`EXECUTED`).
  - Gate 3: Deal Intent MOU accepted (`ACCEPTED`).
  - Gate 4: Escrow Earnest Token Deposit confirmed in immutable payment ledger (`TOKEN_PAYMENT_CONFIRMED`).
  - Gate 5: Due Diligence Case exists and is eligible (`status != 'REJECTED'`).
  - Initiator Gate: Only verified Buyer or Administrator can initiate valuation workspace.
- **Deterministic Valuation Methodologies & Controlled Non-Fabrication**:
  - Revenue Multiple: $EV = \text{Revenue} \times \text{Multiple}$, $Eq = \max(0, EV - \text{Total Debt} + \text{Cash})$.
  - EBITDA Multiple with non-positive EBITDA guard: $EV = \text{EBITDA} \times \text{Multiple}$. If $\text{EBITDA} \le 0$, EV is returned as `null` with `isNegativeEbitdaUnsuitable: true` flag.
  - Discounted Cash Flow (DCF): Multi-year free cash flows, WACC discount factors, present values, and Gordon Growth terminal value. Invariant guard: $WACC \le g$ triggers `INVALID_WACC_TERMINAL_GROWTH` with explanation, completely avoiding division by zero.
  - Asset-Based Valuation (Adjusted NAV): Net Asset Value = Adjusted Assets - Adjusted Liabilities with asset additions, liability additions, and risk haircuts.
  - Comparable Companies Analysis: Peer median and average revenue and EBITDA multiples. If comparables count is 0, returns `INSUFFICIENT_COMPARABLE_DATA` with `null` EV.
  - Weighted Blended Valuation: Configured weights must be non-negative and sum to 100% within $\pm 0.001$ precision.
  - Scenario Analysis & Indicative Range: Concurrent evaluation of CONSERVATIVE, BASE, and OPTIMISTIC scenarios; computes Low EV, Base EV, High EV, and Spread %.
- **Evidence Provenance & 6-Factor Confidence Model**:
  - Every financial input links to Phase 12 due diligence evidence with verification flags.
  - Valuation adjustments link to Phase 12 due diligence risk findings.
  - Transparent 6-factor confidence score (0-100) and rating (`LOW`, `MEDIUM`, `HIGH`).
- **Immutable Versioning & Governance State Machine**:
  - Version lifecycle: `DRAFT` $\to$ `SUBMITTED` $\to$ `UNDER_REVIEW` $\to$ `APPROVED` $\to$ `LOCKED` (or `REVISION_REQUIRED`).
  - Strict Anti-Self-Approval: Model creator/buyer is strictly blocked from approving their own model (`ValuationGateError`).
  - Seller blocked from unilaterally approving buyer's valuation model (`ForbiddenError`).
  - Version increment: Creating next version increments version number (V1 $\to$ V2), copying previous inputs/configs, leaving previous versions immutable.
- **Progressive Confidentiality Disclosure**:
  - Seller summary exposes indicative enterprise value range, equity value range, confidence rating, and applied methodologies.
  - Buyer proprietary working papers, tactical sensitivity assumptions, raw line-item adjustments, and private notes are masked to `null` for Sellers.
  - Statutory and commercial disclaimer: Valuation models are indicative negotiation decision-support tools and do not constitute a formal fairness opinion or statutory valuation under Companies Act 2013 / FEMA.
- **Dedicated Frontends & REST APIs**:
  - Buyer Valuation Workspace: `/buyer/valuation` and `/buyer/valuation/[valuationId]`.
  - Seller Valuation Desk: `/seller/valuation` and `/seller/valuation/[valuationId]`.
  - 13 REST API endpoints under `/api/v1/valuations/...`.
  - Integration links embedded in `/buyer/diligence/[caseId]`, `/seller/diligence/[caseId]`, and `/dashboard`.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Security Gate (`scripts/phase13_security_gate.ts`): 61 / 61 assertions passed (100%)
  - Status: **READY_FOR_PHASE_14**

---

### 16. Phase 14: Transaction / Deal Room & Closing Engine
- **Authoritative Implementation Date**: 2026-11-15
- **Database Architecture**:
  - Migration: `src/lib/migrations/014_transaction_deal_room.sql`.
  - 2 sequences: `txn_ref_seq`, `txn_close_ref_seq` (`TXN-2026-10001`, `CLOSE-2026-10001`).
  - 5 tables: `transactions`, `transaction_versions`, `transaction_conditions`, `transaction_documents`, `transaction_closing_records`.
  - 14 granular permissions seeded: `transaction.create`, `transaction.read_own`, `transaction.read_all`, `transaction.read_sensitive`, `transaction.update`, `transaction.submit`, `transaction.review`, `transaction.approve`, `transaction.verify_conditions`, `transaction.waive_conditions`, `transaction.upload_docs`, `transaction.sign_docs`, `transaction.close`, `transaction.audit`.
- **Server-Side 7-Gate Precondition Enforcement**:
  - Gate 1: Target Opportunity published & not soft-deleted (unpublished returns uniform 404).
  - Gate 2: Bilateral Non-Disclosure Agreement (NDA) executed (`EXECUTED`).
  - Gate 3: Deal Intent MOU accepted (`ACCEPTED`).
  - Gate 4: Escrow Earnest Token Deposit confirmed in immutable payment ledger (`TOKEN_PAYMENT_CONFIRMED`).
  - Gate 5: Due Diligence Case exists and is eligible (`status != 'REJECTED'`).
  - Gate 6: Valuation model exists, is approved, and is locked (`LOCKED`).
  - Gate 7: Initiator authorization: restricted to verified Buyer or Administrator.
- **Deterministic Closing Conditions Engine**:
  - 10 standardized closing conditions spanning System Gates, Required Documents, and Statutory Clearances:
    * `ESCROW_DEPOSIT_CONFIRMED` (System: verified against immutable payment ledger)
    * `DILIGENCE_CLEARANCE` (System: verified against due diligence case status)
    * `VALUATION_CONSENSUS` (System: verified against approved & locked valuation)
    * `DEFINITIVE_AGREEMENT_EXECUTED` (Document: verified execution of SHA / BTA)
    * `BOARD_RESOLUTIONS_EXECUTED` (Document: verified buyer and seller board approvals)
    * `SHAREHOLDER_APPROVAL_OBTAINED` (Document: verified special resolutions under Companies Act 2013)
    * `REGULATORY_CLEARANCES_OBTAINED` (Statutory: verified CCI / sectoral clearances)
    * `TAX_CLEARANCE_OBTAINED` (Statutory: verified Section 281 / 195 IT Act certificate)
    * `ESCROW_FINAL_PAYMENT_CONFIRMED` (System: verified full purchase consideration escrow funding)
    * `CLOSING_CERTIFICATE_EXECUTED` (Document: bilateral closing certificate execution)
  - Zero mock checkboxes: System conditions verified against authoritative database records; document conditions verified against signed vault documents.
  - Condition waiver strictly requires Reviewer or Admin authority and mandatory rationale (`TransactionGateError` / `ForbiddenError`).
- **Secure Closing Document Vault**:
  - Uploaded closing documents stored securely outside web root (`./storage/transaction_vault`).
  - Magic-byte verification (`%PDF-1.`, PNG, JPEG headers) blocking disguised executables.
  - Extension whitelisting (`.pdf`, `.png`, `.jpg`, `.jpeg`).
  - Path traversal defense rejecting directory traversal sequences.
  - 15MB file size limit.
  - Cryptographic SHA-256 checksum calculation and binding.
  - Signing status tracking: `NOT_REQUIRED`, `PENDING_SIGNATURE`, `SIGNATURE_RECORDED`, `VERIFIED`.
- **Bilateral Terms Confirmation & Independent Governance Review**:
  - Counterparties independently confirm final transaction commercial terms:
    * Buyer confirmation records `buyer_confirmed_at` and `buyer_confirmed_by`.
    * Seller confirmation records `seller_confirmed_at` and `seller_confirmed_by`.
    * Counterparties cannot confirm on behalf of each other (`ForbiddenError`).
  - Strict Anti-Self-Approval: Transaction creator/buyer cannot review or approve own transaction (`TransactionGateError`).
  - Independent Reviewer / Admin approval required to advance transaction from `IN_REVIEW` to `READY_FOR_CLOSING`.
- **Atomic Closing Execution & Immutable Snapshot**:
  - Controlled database transaction with row-level locking (`SELECT ... FOR UPDATE`).
  - Re-evaluation of all 7 readiness gates at execution time.
  - Generation of unique closing reference (`CLOSE-YYYY-XXXXX`).
  - Status transition to `CLOSED` with recorded timestamp and closing officer ID.
  - Permanent immutable snapshot in `transaction_closing_records` preserving final consideration, currency, structure, share count, share price, condition outcomes, document hashes, and closing officer remarks.
- **Post-Closing Immutability**:
  - Mutating terms, conditions, documents, or status on a `CLOSED` transaction throws `TransactionClosedError`.
  - Duplicate close attempts safely return the existing closing record idempotently.
- **Dedicated Frontends & REST APIs**:
  - Buyer Deal Room: `/buyer/deal-room` and `/buyer/deal-room/[dealId]`.
  - Seller Deal Room: `/seller/deal-room` and `/seller/deal-room/[dealId]`.
  - 15 REST API endpoints under `/api/v1/transactions/...` and `/api/v1/valuations/[valuationId]/transactions`.
  - Seamless navigation links embedded in `/buyer/valuation/[valuationId]`, `/seller/valuation/[valuationId]`, and `/dashboard`.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 31 test suites passed, 426 / 426 tests passed (25 Phase 14 transaction tests in `tests/transaction_workflow.test.ts`)
  - Security Gate (`scripts/phase14_security_gate.ts`): 66 / 66 assertions passed (100%)
  - Production Build: 87 / 87 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: All UI pages return 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_15**

---

### 17. Phase 15: Notifications & Communication Platform
- **Authoritative Implementation Date**: 2026-11-16
- **Database Architecture**:
  - Migration: `src/lib/migrations/015_notifications_and_communication.sql`.
  - 6 tables: `notification_events`, `notifications`, `notification_deliveries`, `notification_preferences`, `notification_webhook_events`, `notification_templates`.
  - 6 granular RBAC permissions seeded: `notification.read_own`, `notification.manage_own_preferences`, `notification.read_all`, `notification.manage`, `notification.admin`, `notification.audit`.
  - Standard safe templates seeded (`TRANSACTION_INITIATED`, `TRANSACTION_CLOSED`, `PAYMENT_CONFIRMED`, `DUE_DILIGENCE_REQUESTED`, `SECURITY_ALERT`, `GENERIC_NOTIFICATION`).
- **Transactional Outbox Architecture**:
  - Business transactions and outbox events commit or roll back atomically (`enqueueOutboxEvent`).
  - Rolled-back business transactions produce ZERO outbox events and ZERO notifications.
  - Dedicated outbox dispatcher (`processOutboxEvents`) polls pending events, maps recipients/templates, and dispatches to delivery channels.
- **Deterministic Idempotency & Deduplication**:
  - Canonical notification deduplication via deterministic `idempotencyKey`.
  - Duplicate dispatch calls safely return existing notification record without row duplication.
- **Provider Abstraction & Delivery State Machine**:
  - Decoupled channel architecture supporting `IN_APP` and `EMAIL` channels.
  - `EmailProvider` interface abstracting `ProductionEmailProvider` (SendGrid) and `TestSimulatedEmailProvider`.
  - Production guard: `TEST_SIMULATED` provider strictly prohibited in production mode (`NODE_ENV === 'production'`).
  - Deterministic state transitions: `QUEUED` $\to$ `PROCESSING` $\to$ `SENT` $\to$ `DELIVERED`.
  - Truthful states: Acceptance by mail provider records status as `SENT`; only webhook confirmation transitions status to `DELIVERED`.
  - Bounded retries: Upstream failures transition to `RETRYING` with backoff; exhaustion after 3 attempts moves delivery to `DEAD_LETTER`.
- **Provider Webhook Security & Replay Defense**:
  - Constant-time HMAC-SHA256 signature verification (`crypto.timingSafeEqual`).
  - Timestamp verification rejecting expired webhooks (>300 seconds old).
  - Replay protection with unique constraint `uq_notification_webhook_provider_event` on `(provider, event_id)` preventing duplicate delivery mutations or audit logs.
- **Notification Preferences & Mandatory Compliance**:
  - Users can configure channel delivery for 7 event categories.
  - Mandatory compliance: `SECURITY`, `TRANSACTION`, and `PAYMENT` categories cannot be disabled (`MandatoryNotificationError` 422).
- **Progressive Confidentiality & Safe Template Rendering**:
  - Complete protection against HTML injection and XSS via `escapeHtml`.
  - Dangerous URLs (`javascript:`) sanitized to `/dashboard` via `sanitizeUrl`.
  - Email subjects and payloads strictly omit confidential trade secrets, CIN, PAN, promoter details, and financial figures.
  - Mandatory institutional confidentiality notices included in all rendered email outputs.
- **Dedicated Frontends & REST APIs**:
  - Full-featured Notification Center UI at `/notifications` with category filtering, unread count badge, mark as read, mark all as read, and preferences management.
  - Integrated notification bell icon in `Navbar.tsx` and quick card in `DashboardPage`.
  - 10 REST API endpoints under `/api/v1/notifications/...` and `/api/v1/admin/notifications/...`.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 32 test suites passed, 446 / 446 tests passed (20 Phase 15 notification tests in `tests/notification_workflow.test.ts`)
  - Security Gate (`scripts/phase15_security_gate.ts`): 55 / 55 assertions passed (100%)
  - Production Build: 94 / 94 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: UI page returns 200, unauthenticated API calls return 401 with clean JSON.
- **Status**: **READY_FOR_PHASE_16**

---

### 18. Phase 16: Enterprise Security Hardening
- **Authoritative Implementation Date**: 2026-11-16
- **Database Architecture**:
  - Migration: `src/lib/migrations/016_enterprise_security_hardening.sql`.
  - Added MFA readiness columns to `users`: `mfa_enabled`, `mfa_secret_encrypted`, `mfa_recovery_codes_hash`, `mfa_enrolled_at`.
  - Created `security_compliance_events` table for critical security event telemetry with B-tree indexes on `(actor_id, created_at DESC)` and `(threat_severity, created_at DESC)`.
  - Seeded 2 new granular RBAC permissions: `security.admin`, `security.audit` for `SUPER_ADMIN` and `ADMIN`.
- **Identity & Session Hardening**:
  - Atomic tracking of `failed_login_attempts` with 30-minute lockout after 5 consecutive failures (`lockout_until = NOW() + 30 min`). Locked accounts reject login even if supplied with valid password.
  - Constant-time dummy password verification on non-existent users prevents enumeration timing attacks.
  - Password reset immediately invalidates all active sessions across all devices (`UPDATE sessions SET revoked_at = NOW()`).
  - Strict block on self-assignment of administrative roles during registration (`SUPER_ADMIN`, `ADMIN`).
  - Passwords hashed with bcrypt cost factor 12.
- **MFA-Ready Architecture & Cryptographic Storage**:
  - TOTP base32 secret envelope encryption using AES-256-GCM (`iv:authTag:ciphertext`) with derived 32-byte key.
  - RFC 6238 compliant 6-digit TOTP generation and verification with $\pm 1$ time-step drift tolerance.
  - 8 cryptographically random alphanumeric single-use recovery codes stored exclusively as SHA-256 hashes.
  - Constant-time verification (`timingSafeEqual`) and immediate invalidation upon first use (replay defense).
- **Server-Side Request Forgery (SSRF) Defense**:
  - Centralized SSRF validator (`src/lib/security/ssrf.ts`) blocking loopback addresses (`127.0.0.1`, `localhost`, `[::1]`), cloud metadata (`169.254.169.254`, `metadata.google.internal`), RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), IPv6 link-local / ULA, Dword numeric IPs, and non-HTTP protocols.
- **Document Vault & File Upload Security**:
  - Centralized validator (`src/lib/security/fileValidator.ts`) inspecting magic bytes (`%PDF-`, PNG, JPEG SOI marker) and preventing MIME spoofing.
  - Comprehensive executable blocklist (`.exe`, `.sh`, `.bat`, `.cmd`, `.php`, `.js`, `.ts`, `.html`, `.svg`).
  - Path traversal sanitization neutralizing POSIX and Windows traversal sequences (`..`, `/`, `\`) to underscores.
  - Enforced 15MB file size limit.
- **Cryptographic Signed Download Tokens**:
  - HMAC-SHA256 signature binding `docId:roomId:userId:expiresAt` with 300-second TTL and constant-time verification.
- **Sliding-Window Rate Limiting**:
  - In-memory sliding-window bucket store (`src/lib/security/rateLimiter.ts`) enforcing configurable burst limits for auth, password reset, mutations, queries, and file uploads with HTTP 429 responses.
- **Separation of Duties & Anti-Self-Approval**:
  - Strict invariants in `src/lib/security/rbacMatrix.ts` preventing creators from approving their own valuation models or transaction closings, promoters from reviewing their own uploaded due diligence evidence, and counterparties from confirming terms on behalf of each other.
- **OWASP Security Headers & CSRF Defense**:
  - Next.js middleware enforcing CSP (`frame-ancestors 'none'`), HSTS (`max-age=31536000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and Origin validation on state-changing API mutations.
- **Admin Compliance Telemetry API**:
  - Scoped endpoint at `/api/v1/admin/security/compliance` reporting active sessions, locked accounts, MFA enrollment count, and security telemetry events.
- **Quality Gates**:
  - TypeScript: PASS (`tsc --noEmit`, 0 errors)
  - ESLint: PASS (`npm run lint`, 0 errors)
  - Vitest: 33 test suites passed, 465 / 465 tests passed (19 Phase 16 enterprise security tests in `tests/enterprise_security.test.ts`)
  - Security Gate (`scripts/phase16_security_gate.ts`): 65 / 65 assertions passed (100%)
  - Production Build: 95 / 95 routes compiled cleanly (`next build`)
  - Live HTTP Smoke Tests: Verified OWASP security headers, CSRF origin rejection (403), unauthenticated API protection (401), and protected route redirection (307).
- **Status**: **READY_FOR_PHASE_17**

---

### 19. Phase 17: Full End-to-End, Security, Workflow & Production Validation
- **Authoritative Certification Date**: 2026-11-17
- **Certification Scope**:
  - Full end-to-end multi-tenant lifecycle validation executed across 23 discrete platform stages (User Registration $\to$ Profile Onboarding $\to$ Profile Verification $\to$ Opportunity Draft $\to$ Opportunity Verification $\to$ Publication $\to$ Mandate Matching $\to$ Confidential Discovery Catalog $\to$ Expression of Interest $\to$ Bilateral NDA Execution $\to$ Secure Data Room $\to$ Deal Messaging $\to$ Non-Binding MOU $\to$ Earnest Deposit Token Payment $\to$ Due Diligence Workspace $\to$ Evidence Audit & Findings $\to$ Deterministic Valuation Engine $\to$ Transaction Deal Room $\to$ Closing Conditions & Evidence $\to$ Bilateral Terms Confirmation $\to$ Independent Reviewer Sign-Off $\to$ Row-Locked Atomic Closing $\to$ Post-Closing Immutability & Outbox Delivery).
- **Security Assertions Evaluated (26 Minimum Categories)**:
  - Evaluated 53 discrete assertions across all 26 mandatory categories defined in Section 31 of Phase 17 requirements:
    1. Multi-Tenant Isolation
    2. Global Anti-IDOR (26 object types)
    3. Progressive Disclosure & Data Masking (Tier 0 to Tier 3)
    4. Authoritative Role Matrix (9 platform roles)
    5. Anti-Self-Approval & Segregation of Duties
    6. State Machine Abuses & Invariant Guards
    7. Financial Integrity & Tamper Defense
    8. Webhook Security (HMAC verification & replay defense)
    9. Concurrency & Race Condition Defense
    10. Rollback Atomicity & Zero Orphaned Records
    11. Notification Integrity & Outbox Consistency
    12. Audit Trail Completeness & Immutability
    13. Input Validation & Strict Schema Typing
    14. Mass Assignment & Parameter Pollution
    15. SSRF Defense & Allowlist Enforcement
    16. Magic-Byte File Inspection & Path Traversal
    17. File Size Caps & Extension Allowlisting
    18. Signed Download Tokens & Tamper Protection
    19. Sliding-Window Rate Limiting
    20. Account Lockout & Brute-Force Defense
    21. Session Security & Token Invalidation
    22. CSRF Defense & Safe Origin Headers
    23. Content Security Policy & XSS Defenses
    24. SQL Injection Resistance & Parameterization
    25. Data Room Revocation & Access Cutoff
    26. Post-Closing Transaction Immutability
- **Quality Gates & Certification Metrics**:
  - **TypeScript**: PASS (`tsc --noEmit`, 0 errors)
  - **ESLint**: PASS (`npm run lint`, 0 errors)
  - **Automated Security Gate (`scripts/phase17_e2e_security_gate.ts`)**: 53 / 53 assertions passed (100% PASS)
  - **Dedicated Vitest E2E Suite (`tests/phase17_e2e_validation.test.ts`)**: 8 / 8 tests passed (100% PASS)
  - **Full Platform Regression (`npx vitest run`)**: 34 / 34 suites passed, 473 / 473 tests passed (100% PASS)
  - **Next.js Production Build (`npm run build`)**: Compiled successfully in 7.8s, 94+ production routes generated
  - **Live HTTP Smoke Tests (Port 3000)**: Clean 200 responses with full OWASP headers for `/login`, `/opportunities`, `/api/v1/opportunities` (Tier 0 progressive masking), and `/api/v1/auth/session`
  - **Dependency Security Audit**: 9 findings reviewed; compensating controls established for Next.js build-time PostCSS styling isolation and API request-body size cap / sliding-window rate limit against Zod collection exhaustion.
- **Status**: **READY_FOR_PHASE_18**

---

### 20. Phase 18: End-to-End Deal Room Playwright Journeys (FLOW 1 → FLOW 5)
- **Authoritative Certification Date**: 2026-11-17
- **Certification Scope**:
  - Full browser-level Playwright E2E certification across 5 continuous transaction journeys and a dedicated security/roles matrix:
    1. **Flow 1**: Seller Onboarding $\to$ Verification $\to$ Opportunity Draft $\to$ Admin Review $\to$ Publish $\to$ Confidential Catalog Discovery.
    2. **Flow 2**: Buyer Onboarding $\to$ Mandate $\to$ Matching $\to$ Discovery $\to$ Bilateral EOI $\to$ Seller Accept.
    3. **Flow 3**: Bilateral Interest $\to$ NDA Workspace $\to$ VDR Access & Signed Downloads $\to$ Deal Messaging $\to$ MOU Proposal, Counter & Acceptance.
    4. **Flow 4**: Accepted MOU $\to$ Payment Token Deposit & Settlement $\to$ Due Diligence Workspace & Evidence $\to$ Reviewer Findings $\to$ Valuation Engine & Lock.
    5. **Flow 5**: Approved Valuation $\to$ Deal Room $\to$ Closing Conditions $\to$ Bilateral Confirmations $\to$ Independent Compliance Review $\to$ Atomic Closing $\to$ Post-Closing Immutability.
    6. **Security & Role Matrix**: Multi-Tenant Isolation (Tenant A vs Tenant B), Progressive Disclosure Zero-Leakage (Tier 0/1 Masks CIN/PAN/GSTIN), Malicious File Magic-Bytes & Path Traversal Rejection, View-Only & RBAC Authorization, and Transactional In-App Notifications.
- **Architectural Implementation**:
  - Test framework: `@playwright/test` on Chromium headless engine.
  - Dedicated non-production test fixture route (`src/app/api/v1/test/fixture/route.ts`) resolving PGlite single-process concurrency constraints while validating live HTTP/browser operations.
  - Sequential reference validation: `OPP-YYYY-XXXX`, `EOI-YYYY-XXXXX`, `NDA-YYYY-XXXXX`, `VDR-YYYY-XXXXX`, `DDC-YYYY-XXXXX`, `VAL-YYYY-XXXXX`, `CLOSE-YYYY-XXXXX`.
  - Zero mock persistence, zero synthetic frontend states, zero client-side bypasses.
- **Quality Gates & Certification Metrics**:
  - **Playwright Browser Tests**: 34 / 34 tests passed across 6 journey suites (100% PASS, 145.0s)
  - **Automated Certification Gate (`scripts/phase18_playwright_gate.ts`)**: 17 / 17 assertions passed (100% PASS)
  - **TypeScript**: PASS (`tsc --noEmit`, 0 errors)
  - **ESLint**: PASS (`npm run lint`, 0 errors)
  - **Full Platform Regression (`npx vitest run`)**: 34 / 34 suites passed, 473 / 473 tests passed (100% PASS)
  - **Next.js Production Build (`npm run build`)**: Compiled successfully in 9.0s, 94+ production routes generated
- **Status**: **READY_FOR_PHASE_19**










