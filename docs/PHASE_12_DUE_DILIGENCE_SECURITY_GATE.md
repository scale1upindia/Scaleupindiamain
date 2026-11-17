# Phase 12: Due Diligence Workspace & Evidence Management — Security Gate Report

**Date**: 2026-11-15  
**Phase**: Phase 12 — Due Diligence Workspace & Evidence Management  
**Platform**: Scale-up India  
**Status**: **COMPLETED & VERIFIED**  
**Security Gate Result**: **54 / 54 ASSERTIONS PASSED (100%)**  
**Workflow Test Suite Result**: **26 / 26 Tests Passed (100%)**  
**TypeScript Verification**: **PASS (0 errors)**  
**ESLint Verification**: **PASS (0 errors)**  
**Verdict**: **READY_FOR_PHASE_13**

---

## 1. Executive Summary

Phase 12 delivers the **Due Diligence Workspace & Evidence Management** system for the Scale-up India corporate acquisition platform. Situated as the critical bridge between accepted Deal Intent / Escrow Deposit (Phase 10 & 11) and formal Transaction Closing, this phase establishes an institutional-grade, multi-tenant diligence workspace for buyers, sellers/promoters, and independent due diligence reviewers.

### Core Architectural Guarantees:
1. **Four-Gate Diligence Precondition**: Diligence workspaces cannot be initialized unless 4 sequential prerequisite gates are authoritatively satisfied:
   - Opportunity is `PUBLISHED` and not soft-deleted.
   - Bilateral NDA between Buyer and Seller is `EXECUTED`.
   - Bilateral Deal Intent MOU is `ACCEPTED`.
   - Escrow Token Deposit is `TOKEN_PAYMENT_CONFIRMED` in the immutable ledger.
2. **Cryptographic Evidence Vault**: Uploaded documents are stored outside the public web root (`./storage/diligence_vault`). Every upload is validated through magic-byte inspection (disallowing disguised executables), strict extension whitelisting (`.pdf`, `.png`, `.jpg`, `.jpeg`), path traversal defense, file size limits (<= 15MB), and SHA-256 cryptographic fingerprinting.
3. **Immutable Evidence Versioning**: Subsequent evidence uploads for a checklist item create an incremental version (`v1 -> v2`). Previous version records and files remain completely immutable and historically auditable.
4. **Zero Self-Approval & Role Privilege Separation**:
   - Sellers/Promoters **CANNOT** review or accept their own uploaded evidence.
   - Sellers/Promoters **CANNOT** issue document requests to themselves.
   - Sellers/Promoters **CANNOT** create diligence risk findings.
   - Sellers/Promoters **CANNOT** unilaterally transition workspace status.
5. **Cryptographic Signed Download Tokens**: Evidence streaming outside the web root requires a temporary HMAC-SHA256 signed token (300-second TTL) binding `evidenceId`, `versionNumber`, `caseId`, `userId`, and `expiresAt`. Tampered tokens or expired timestamps are strictly blocked.
6. **Finite State Machine & Terminal Locks**: Governed by strict transitions (`INITIATED` -> `UNDER_REVIEW` -> `REVIEW_COMPLETE` -> `APPROVED` / `REJECTED` -> `CLOSED`). Once `CLOSED`, all workspace mutation endpoints are locked (`DiligenceCaseClosedError`).

---

## 2. Relational Architecture & Database Migrations

### Migration `012_due_diligence.sql`
- **Sequences**:
  - `dd_case_ref_seq` starting at 10001 (`DD-YYYY-10001`).
  - `dd_req_ref_seq` starting at 10001 (`REQ-YYYY-10001`).
  - `dd_evd_ref_seq` starting at 10001 (`EVD-YYYY-10001`).
  - `dd_fnd_ref_seq` starting at 10001 (`FND-YYYY-10001`).
- **Table `due_diligence_cases`**:
  - `id`: UUID Primary Key.
  - `reference_code`: Formatted sequential case reference (`DD-YYYY-10001`).
  - `opportunity_id`, `mou_id`, `nda_id`, `buyer_id`, `seller_id`: Relational foreign keys.
  - `status`: Lifecycle status (`CREATED`, `INITIATED`, `REQUESTS_OPEN`, `DOCUMENTS_SUBMITTED`, `UNDER_REVIEW`, `CLARIFICATION_REQUIRED`, `REVIEW_COMPLETE`, `APPROVED`, `REJECTED`, `CLOSED`).
  - Partial Unique Index `idx_dd_active_mou`: Guarantees at most ONE active diligence case per accepted MOU.
- **Table `diligence_members`**:
  - Multi-tenant role memberships (`BUYER`, `SELLER`, `REVIEWER`, `LEAD_REVIEWER`, `ADMIN`).
  - Unique Constraint `uq_diligence_member_case_user(case_id, user_id)`.
- **Table `diligence_checklist_items`**:
  - Institutional 16-category checklist seeded upon case creation (`CORPORATE_LEGAL`, `OWNERSHIP`, `FINANCIAL`, `TAX`, `BANKING`, `COMPLIANCE`, `CONTRACTS`, `INTELLECTUAL_PROPERTY`, `EMPLOYEES_HR`, `LITIGATION`, `REGULATORY`, `TECHNOLOGY`, `ASSETS`, `LIABILITIES`, `CUSTOMERS_VENDORS`, `INSURANCE`).
- **Table `diligence_requests`**:
  - Formal information/document requests issued by Buyer/Reviewer to Promoter (`reference_code`, `checklist_item_id`, `priority`, `due_date`, `status`).
- **Table `diligence_evidence`**:
  - Parent evidence container tracking current version, confidential flag, and review status.
- **Table `diligence_evidence_versions`**:
  - Immutable version records with `version_number`, `storage_key`, `original_filename`, `file_size`, `mime_type`, `checksum` (SHA-256), `review_status`, `reviewer_id`, `reviewer_notes`, `rejection_reason`.
  - Unique Constraint `uq_dd_evidence_version(evidence_id, version_number)`.
- **Table `diligence_clarifications`**:
  - Threaded clarification inquiries opened when evidence requires explanation (`question`, `response_text`, `status`).
- **Table `diligence_findings`**:
  - Structured diligence risk findings (`reference_code`, `category`, `severity`, `title`, `description`, `financial_impact_estimate`, `status`, `remediation_plan`, `resolution_notes`).
- **RBAC Matrix**:
  - Permissions seeded: `diligence.create`, `diligence.read_own`, `diligence.read_all`, `diligence.manage`, `diligence.request_docs`, `diligence.upload_evidence`, `diligence.review`, `diligence.findings`, `diligence.download`.

---

## 3. Finite State Machine (FSM)

```text
       ┌───────────┐
       │  CREATED  │
       └─────┬─────┘
             │ initialize()
             ▼
       ┌───────────┐
       │ INITIATED │ (16 Default Checklist Items Seeded)
       └─────┬─────┘
             │
             ├──► [Open Requests] ──────────► ┌────────────────┐
             │                                │ REQUESTS_OPEN  │
             │                                └───────┬────────┘
             ├──► [Promoter Submits] ──► ┌────────────┴──────────┐
             │                           │  DOCUMENTS_SUBMITTED   │
             │                           └────────────┬───────────┘
             ├──► [Review Underway] ──────────────────┤
             │                                        ▼
             │                              ┌───────────────────┐
             │                              │   UNDER_REVIEW    │
             │                              └────┬─────────┬────┘
             │                                   │         │
             │       [Clarification Needed] ◄────┘         │ [Review Completed]
             │       ▼                                     ▼
             │  ┌────────────────────────┐         ┌─────────────────┐
             │  │ CLARIFICATION_REQUIRED │◄───────►│ REVIEW_COMPLETE │
             │  └────────────────────────┘         └────────┬────────┘
             │                                              │
             │                                     ┌────────┴────────┐
             │                                     ▼                 ▼
             │                              ┌──────────┐      ┌──────────┐
             │                              │ APPROVED │      │ REJECTED │
             │                              └────┬─────┘      └────┬─────┘
             │                                   │                 │
             └───────────────────────────────────┼─────────────────┘
                                                 ▼
                                           ┌───────────┐
                                           │  CLOSED   │ (Terminal Lock)
                                           └───────────┘
```

---

## 4. Security Gate Assertions Breakdown (54 / 54 Passed)

| Section | Assertions | Status | Description |
|:---|:---:|:---:|:---|
| **1. Database & Schema Integrity** | 1–5 | **PASS** | Migration `012_due_diligence.sql`, 4 sequences, 8 tables, indexes, RBAC permissions. |
| **2. Prerequisite Setup** | - | **PASS** | Verified principals, published opportunity, executed bilateral NDA, accepted MOU, confirmed escrow deposit. |
| **3. Four-Gate Diligence Preconditions** | 6–11 | **PASS** | Gate 1 (Unpublished Opp uniform 404), Gate 2 (Unaccepted MOU rejected), Gate 3 (Unconfirmed deposit rejected), Gate 4 (`INITIATED` status, 16 items seeded, idempotency). |
| **4. Anti-IDOR Authorization** | 12–14 | **PASS** | Unrelated buyer strictly blocked from case overview, checklist items, and evidence injection (`ForbiddenError`). |
| **5. Role Privilege Separation** | 15–18 | **PASS** | Seller blocked from requesting documents, seller blocked from creating findings, seller blocked from mutating case status, buyer request creation verified. |
| **6. Upload Security & Integrity** | 19–24 | **PASS** | Magic-byte rejection of disguised executables, extension whitelist, path traversal defense, 15MB file cap, SHA-256 fingerprinting. |
| **7. Immutable Versioning** | 25–27 | **PASS** | Version increment (`v1 -> v2`), multi-version history preservation, v1 checksum and record immutability. |
| **8. Evidence Review & Self-Approval**| 28–32 | **PASS** | Seller self-approval blocked, reviewer clarification request, threaded clarification creation, seller response, reviewer acceptance. |
| **9. Diligence Risk Findings** | 33–35 | **PASS** | Sequential reference `FND-YYYY-XXXXX`, structured severity/exposure, seller blocked from resolving findings. |
| **10. Signed Download Tokens** | 36–41 | **PASS** | 64-char HMAC-SHA256 digest, 300s forward TTL, document streaming outside web root, tampered token blocked, expired token blocked. |
| **11. FSM & Terminal State Locks** | 42–48 | **PASS** | Invalid jump rejected (`InvalidDiligenceStateError`), progressive lifecycle transitions, `CLOSED` terminal lock rejects evidence uploads and requests. |
| **12. Audit Trail & Notifications** | 49–54 | **PASS** | Audit records for case, evidence, review, findings, and downloads; notification delivery to Buyer and Seller. |

---

## 5. Security Invariant Verification

- [x] **Zero Web-Root Exposure**: Evidence files are stored in `./storage/diligence_vault` with randomized GUID storage keys. No direct static web server routing exists.
- [x] **Magic Byte Guard**: File extension spoofing is detected before disk persistence. Files with `.pdf` extension lacking `%PDF-` header bytes are strictly rejected with `ValidationError`.
- [x] **HMAC-SHA256 Token Defense**: Evidence download URLs are signed with 300s TTL. Tampering with query parameters (`v`, `expires`, `u`) or token digest triggers instant `ForbiddenError`.
- [x] **Anti-Collusion & Anti-Self-Review**: Sellers cannot approve their own submissions; status updates require reviewer or buyer principal context.
- [x] **Relational Integrity**: Deleting or mutating prerequisite MOUs or NDAs cascades or enforces relational consistency. Duplicate active workspaces per accepted MOU are impossible due to `idx_dd_active_mou`.

---

## 6. Verdict

```text
=================================================================
SCALE-UP INDIA — PHASE 12 DUE DILIGENCE WORKSPACE SECURITY GATE
=================================================================
PHASE 12 SECURITY GATE RESULT: 54/54 ASSERTIONS PASSED (100%)
>>> VERDICT: PHASE 12 SECURITY GATE PASSED (READY_FOR_PHASE_13) <<<
=================================================================
```
