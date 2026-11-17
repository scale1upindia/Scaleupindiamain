# Phase 10: Deal Intent & Bilateral Memorandum of Understanding (MOU) — Security Gate Report

**Date**: 2026-11-15  
**Phase**: Phase 10 — MOU / Deal Intent  
**Platform**: Scale-up India  
**Status**: **COMPLETED & VERIFIED**  
**Security Gate Result**: **55 / 55 ASSERTIONS PASSED (100%)**  
**Test Suite Result**: **27 / 27 Suites Passed, 320 / 320 Tests Passed (100%)**  
**TypeScript Verification**: **PASS (0 errors)**  
**ESLint Verification**: **PASS (0 errors)**  
**Production Build**: **PASS (70 / 70 routes generated)**  
**Verdict**: **READY_FOR_PHASE_11**

---

## 1. Executive Summary

Phase 10 implements the formal bilateral Deal Intent / Memorandum of Understanding (MOU) workflow for the Scale-up India platform. Following bilateral execution of NDAs and data room access in Phase 8 and deal communication in Phase 9, Phase 10 enables prospective acquirers and verified business promoters to formalize preliminary commercial terms, proposed valuations, exclusivity periods, and diligence timelines.

Crucially, in compliance with the Confidentiality and Legal Framework:
- **Non-Binding Deal Intent**: The MOU is explicitly structured and legally anchored as a preliminary expression of commercial intent and not a final sale or transfer agreement.
- **Bilateral NDA Execution Gate**: MOUs cannot be initiated or accessed unless an underlying bilateral NDA is fully `EXECUTED`. Unexecuted, draft, declined, or revoked NDAs strictly block MOU creation with server-side validation.
- **Zero-Trust Anti-IDOR**: All operations (creation, proposal, countering, acceptance, rejection, withdrawal, listing, inspection) derive participant identities strictly from the authenticated server session. Cross-deal tampering or snooping by unauthorized buyers or sellers is thwarted with HTTP 403 `ForbiddenError`.
- **Immutable Version History**: Every revision or counterproposal increments the version number (`v1`, `v2`, `v3`...), marks preceding versions as `SUPERSEDED`, and preserves historical terms in an append-only relational table `mou_versions`.
- **Privacy-Preserving Audit Trail**: Audit events (`MOU_CREATED`, `MOU_PROPOSED`, `MOU_COUNTERED`, `MOU_ACCEPTED`, `MOU_REJECTED`, `MOU_WITHDRAWN`) record only safe operational metadata (actor, MOU reference, version number, proposed valuation, exclusivity days), strictly omitting private PII, statutory identifiers (CIN/PAN), and confidential notes.

---

## 2. Relational Architecture & Database Migrations

### Migration `010_mou_deal_intent.sql`
- **Sequence**: `mou_ref_seq` starting at 10001 (`MOU-YYYY-10001`).
- **Table `deal_mous`**:
  - `id`: UUID Primary Key.
  - `reference_code`: Formatted human-readable unique code.
  - `opportunity_id`: UUID Foreign Key to `opportunities(id)` ON DELETE CASCADE.
  - `eoi_id`: UUID Foreign Key to `expressions_of_interest(id)` ON DELETE CASCADE.
  - `nda_id`: UUID Foreign Key to `nda_agreements(id)` ON DELETE CASCADE.
  - `conversation_id`: UUID Foreign Key to `deal_conversations(id)` ON DELETE SET NULL.
  - `buyer_id`, `seller_id`: UUID Foreign Keys to `users(id)` ON DELETE CASCADE.
  - `created_by`: UUID Foreign Key to `users(id)`.
  - `current_version_number`: Integer tracking active terms version.
  - `status`: State machine status (`DRAFT`, `PROPOSED`, `COUNTERED`, `ACCEPTED`, `REJECTED`, `WITHDRAWN`, `EXPIRED`).
  - `valid_until`: Timestamp marking proposal expiry.
  - `last_proposed_by`, `last_proposed_at`: Tracks proposing party for strict turn enforcement.
  - `accepted_at`, `accepted_by_buyer_at`, `accepted_by_seller_at`: Bilateral acceptance timestamps.
  - `rejected_at`, `rejected_by`, `rejection_reason`: Rejection metadata.
  - `withdrawn_at`, `withdrawn_by`, `withdrawal_reason`: Withdrawal metadata.
- **Partial Unique Index `idx_mou_active_nda`**:
  - Enforces `UNIQUE (nda_id) WHERE status IN ('DRAFT', 'PROPOSED', 'COUNTERED', 'ACCEPTED')`. Guarantees exactly one active or agreed deal intent MOU per bilateral deal.
- **Table `mou_versions`**:
  - Stores immutable historical versions (`version_number`, `proposed_by`, `proposed_by_role`, `status`).
  - Commercial terms: `proposed_valuation`, `currency`, `proposed_structure`, `cash_consideration`, `equity_consideration`, `earnest_deposit_amount`, `exclusivity_period_days`, `due_diligence_window_days`, `target_closing_date`, `conditions_precedent`, `key_assumptions`, `summary_notes`, `non_binding_disclaimer`.
  - Unique constraint `uq_mou_version(mou_id, version_number)` prevents version collisions.
- **RBAC Matrix**:
  - Permissions seeded: `mou.create`, `mou.read_own`, `mou.propose`, `mou.counter`, `mou.accept`, `mou.reject`, `mou.withdraw`, `mou.read_all`, `mou.manage`.

---

## 3. Finite State Machine (FSM) & Turn Enforcement

```text
       ┌───────────┐
       │   DRAFT   │ (Created by authorized initiator)
       └─────┬─────┘
             │ proposeMOUDraft()
             ▼
       ┌───────────┐
       │ PROPOSED  │ (Submitted for counterparty review)
       └──┬───┬───┬┘
          │   │   └───────────────┬────────────────────────┐
          │   │ withdrawMOU()     │ counterMOU()           │ acceptMOU()
          │   ▼                   ▼                        ▼
          │ ┌───────────┐   ┌───────────┐            ┌───────────┐
          │ │ WITHDRAWN │   │ COUNTERED │ (v2, v3...)│ ACCEPTED  │ (Terminal Agreement)
          │ └───────────┘   └─┬───┬───┬─┘            └───────────┘
          │ rejectMOU()       │   │   │ acceptMOU()        ▲
          ▼                   │   │   └────────────────────┘
    ┌───────────┐             │   └──────────┐
    │ REJECTED  │◄────────────┘              ▼
    └───────────┘                      ┌───────────┐
          ▲                            │  EXPIRED  │ (Deadline reached)
          └────────────────────────────┴───────────┘
```

### Turn Enforcement Rules
1. **Self-Acceptance Defense**: The party that submitted the active proposal or counterproposal cannot accept their own terms. Acceptance is strictly reserved for the counterparty.
2. **Self-Countering Defense**: A party cannot submit consecutive counterproposals without a counterparty response. They must either wait or withdraw their proposal.
3. **Withdrawal Authorization**: Only the party that submitted the active proposal may withdraw it.
4. **Terminal Invariants**: Once `ACCEPTED`, `REJECTED`, or `WITHDRAWN`, the MOU cannot be modified, countered, accepted, or reopened.

---

## 4. Security Gate Assertions Breakdown (55 / 55)

| Section | Assertions Passed | Verification Scope |
| :--- | :---: | :--- |
| **1. Migration & Schema** | 5 / 5 | Migration 010 recorded, sequence exists, tables exist, indexes verified, RBAC seeded |
| **2. Principals Provisioning** | 1 / 1 | Seller 1, Seller 2, Buyer 1, Buyer 2, Super Admin verified |
| **3. Opportunity & Bilateral NDA** | 1 / 1 | Opportunity published, bilateral NDA executed |
| **4. Bilateral NDA Gate** | 1 / 1 | Rejects MOU creation on unexecuted draft NDA (ValidationError) |
| **5. Anti-IDOR Creation** | 2 / 2 | Unauthorized Buyer 2 and Seller 2 cannot create MOU for deal (ForbiddenError) |
| **6. Draft Terms Integrity** | 9 / 9 | Reference code format, version 1, terms numerical accuracy, non-binding disclaimer |
| **7. Proposal Submission** | 4 / 4 | Transitions to PROPOSED, validity deadline set, proposing role recorded, notification |
| **8. Turn Enforcement** | 2 / 2 | Self-acceptance and self-countering blocked (ValidationError) |
| **9. Negotiation & Countering** | 9 / 9 | Version 2 generated, previous superseded, immutability verified, counterparty notified |
| **10. Bilateral Acceptance** | 6 / 6 | Status ACCEPTED, acceptedAt recorded, terminal state invariants verified |
| **11. Single Active Constraint** | 1 / 1 | Duplicate active MOU blocked by partial unique index (ConflictError) |
| **12. Anti-IDOR Viewing** | 2 / 2 | Unauthorized Buyer 2 and Seller 2 cannot view deal MOU (ForbiddenError) |
| **13. Confidentiality Masking** | 5 / 5 | Safe counterparty labels, zero exposure of CIN, PAN, exact street address |
| **14. Rejection & Withdrawal** | 2 / 2 | Proposer can withdraw, terminal state invariants verified |
| **15. Immutable Audit Trail** | 5 / 5 | `MOU_CREATED`, `MOU_PROPOSED`, `MOU_COUNTERED`, `MOU_ACCEPTED`, safe metadata only |
| **TOTAL** | **55 / 55** | **100% PASS** |

---

## 5. Next Steps

With Phase 10 fully verified and all quality gates passing:
- **Phase 10 Status**: `COMPLETED`
- **Verdict**: `READY_FOR_PHASE_11`
- **Awaiting User Authorization**: Do NOT start Phase 11 (Payment / Token) until explicitly authorized.
