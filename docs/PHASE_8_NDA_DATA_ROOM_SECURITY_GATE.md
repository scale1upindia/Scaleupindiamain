# Scale-up India — Phase 8 Security Gate & Final Verification Report
## Bilateral NDA & Secure Virtual Data Room (VDR)

**Document Reference**: `docs/PHASE_8_NDA_DATA_ROOM_SECURITY_GATE.md`  
**Execution Timestamp**: 2026-11-14T22:12:00+05:30  
**Phase**: Phase 8 — Bilateral NDA & Secure Data Room  
**Security Gate Result**: `61/61 ASSERTIONS PASSED`  
**Vitest Suite Result**: `33/33 TESTS PASSED` (24 Suites Total, 267 Tests Total)  
**Final Verdict**: `READY_FOR_PHASE_9`

---

### 1. Primary Objectives & Invariants

Phase 8 implements a production-grade confidentiality and diligence framework bridging accepted Expressions of Interest (EOI) and high-stakes acquisition diligence on Scale-up India.

#### Critical Invariants Established:
1. **ACCEPTED EOI DOES NOT UNLOCK THE DATA ROOM**:
   - An accepted commercial EOI does **NOT** grant data room access.
   - Access to confidential diligence materials requires formal execution of a bilateral Non-Disclosure Agreement (NDA).
2. **BILATERAL COUNTERSIGNATURE INVARIANT**:
   - Single-party acceptance transitions the agreement to `BUYER_ACCEPTED` or `SELLER_ACCEPTED`.
   - The agreement is `EXECUTED` **ONLY** after BOTH principals have formally accepted.
   - The virtual data room remains non-existent or locked in `PENDING_NDA` until bilateral execution occurs.
3. **EXPLICIT SERVER-SIDE ROOM MEMBERSHIP**:
   - Merely owning or discovering an opportunity does not grant data room access.
   - Users are explicitly authorized in `data_room_members` with roles (`BUYER`, `SELLER`, `ADMIN`) and active access status.
4. **FILE SECURITY & ZERO PUBLIC EXPOSURE**:
   - Private documents are stored strictly outside the web root in `data/vault/datarooms/[dataRoomId]/`.
   - Magic-byte verification (`%PDF-`, PNG, JPEG headers) defeats MIME-type spoofing.
   - Strict 15MB size ceiling and path traversal defenses (`../../../` prohibited).
5. **CRYPTOGRAPHIC SHORT-LIVED SIGNED DOWNLOAD URLS**:
   - HMAC-SHA256 signed access tokens with short TTL (default 300 seconds).
   - Re-verified in constant time (`crypto.timingSafeEqual`) on download.
   - Database membership and room status are re-verified on every download request (defense-in-depth).
6. **NO FRAUDULENT DIGITAL SIGNATURE CLAIMS**:
   - System records structured bilateral acknowledgement covenants logging timestamp, IP, user-agent, and legal version reference. No fake cryptographic certificate authorities are claimed.

---

### 2. Database Schema & Migration (008)

Migration script: `src/lib/migrations/008_nda_and_data_room.sql`

#### 2.1 Sequences
- `nda_ref_seq`: Generates human-readable reference codes `NDA-2026-10001+`.
- `vdr_ref_seq`: Generates virtual data room codes `VDR-2026-10001+`.

#### 2.2 Table: `nda_agreements`
- `id` (UUID PK, default `gen_random_uuid()`)
- `reference_code` (VARCHAR(50) UNIQUE NOT NULL)
- `opportunity_id` (UUID FK $\to$ `opportunities.id` ON DELETE CASCADE)
- `eoi_id` (UUID FK $\to$ `expressions_of_interest.id` ON DELETE CASCADE)
- `buyer_id` (UUID FK $\to$ `users.id` ON DELETE CASCADE)
- `seller_id` (UUID FK $\to$ `users.id` ON DELETE CASCADE)
- `nda_version` (VARCHAR(20) DEFAULT `'v1.0'`)
- `document_reference` (VARCHAR(100) NOT NULL)
- `status` (`'NDA_DRAFT'`, `'NDA_SENT'`, `'BUYER_VIEWED'`, `'BUYER_ACCEPTED'`, `'SELLER_ACCEPTED'`, `'EXECUTED'`, `'DECLINED'`, `'REVOKED'`, `'EXPIRED'`)
- `buyer_viewed_at`, `seller_viewed_at` (TIMESTAMPTZ)
- `buyer_accepted_at`, `buyer_ip`, `buyer_user_agent` (TIMESTAMPTZ, VARCHAR)
- `seller_accepted_at`, `seller_ip`, `seller_user_agent` (TIMESTAMPTZ, VARCHAR)
- `executed_at`, `declined_at`, `declined_by`, `decline_reason`
- `revoked_at`, `revoked_by`, `revoke_reason`
- `expires_at` (TIMESTAMPTZ DEFAULT NOW() + 30 days)

#### 2.3 Partial Unique Index
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_nda_active_buyer_opp 
ON nda_agreements (buyer_id, opportunity_id) 
WHERE status IN ('NDA_DRAFT', 'NDA_SENT', 'BUYER_VIEWED', 'BUYER_ACCEPTED', 'SELLER_ACCEPTED', 'EXECUTED');
```
Guarantees at the database level that no buyer can spawn multiple concurrent active NDAs for the same business listing.

#### 2.4 Table: `data_rooms`
- `id` (UUID PK)
- `reference_code` (VARCHAR(50) UNIQUE NOT NULL)
- `opportunity_id` (UUID FK $\to$ `opportunities.id` ON DELETE CASCADE)
- `nda_id` (UUID FK $\to$ `nda_agreements.id` ON DELETE CASCADE)
- `seller_id` (UUID FK $\to$ `users.id`)
- `buyer_id` (UUID FK $\to$ `users.id`)
- `title` (VARCHAR(255) NOT NULL)
- `status` (`'PENDING_NDA'`, `'ACTIVE'`, `'SUSPENDED'`, `'REVOKED'`, `'EXPIRED'`)
- `activated_at`, `suspended_at`, `revoked_at`, `expires_at`

#### 2.5 Table: `data_room_members`
- `id` (UUID PK)
- `data_room_id` (UUID FK $\to$ `data_rooms.id` ON DELETE CASCADE)
- `user_id` (UUID FK $\to$ `users.id` ON DELETE CASCADE)
- `role` (`'BUYER'`, `'SELLER'`, `'ADMIN'`)
- `access_status` (`'ACTIVE'`, `'SUSPENDED'`, `'REVOKED'`)
- `granted_at`, `revoked_at`, `revocation_reason`
- Unique constraint: `UNIQUE (data_room_id, user_id)`

#### 2.6 Table: `data_room_documents`
- `id` (UUID PK)
- `data_room_id` (UUID FK $\to$ `data_rooms.id` ON DELETE CASCADE)
- `uploaded_by` (UUID FK $\to$ `users.id`)
- `document_category` (`'FINANCIAL'`, `'LEGAL'`, `'TAX'`, `'CORPORATE'`, `'OPERATIONAL'`, `'COMMERCIAL'`, `'HR'`, `'TECHNICAL'`, `'OTHER'`)
- `access_level` (`'ROOM_MEMBER'`, `'AUTHORIZED_BUYER'`, `'AUTHORIZED_SELLER'`, `'ADMIN'`)
- `title`, `original_filename`, `storage_key`, `mime_type`, `file_size`, `checksum` (SHA-256)
- `status` (`'ACTIVE'`, `'DELETED'`, `'REVOKED'`)
- `download_count` (INT DEFAULT 0)
- `deleted_at`, `deleted_by`

---

### 3. State Machine Specifications

```
             [ Accepted EOI ]
                    │
                    ▼
               [ NDA_SENT ]
                    │
                    ▼ (First Principal Inspection)
             [ BUYER_VIEWED ]
              │             │
(Buyer Accept)│             │(Seller Accept)
              ▼             ▼
      [ BUYER_ACCEPTED ]   [ SELLER_ACCEPTED ]
              │             │
(Seller Accept)│             │(Buyer Accept)
              └──────┬──────┘
                     ▼
               [ EXECUTED ]
                     │
                     ▼
          [ DATA ROOM ACTIVATED ]
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
     [ REVOKED ]           [ EXPIRED ]
  (Admin Intervention)   (Term Exceeded)
```

Terminal Invariants:
- Once `EXECUTED`, neither party can decline or re-accept.
- Once `DECLINED`, neither party can accept.
- Revoking a Data Room cascades revocation to the associated bilateral NDA agreement.

---

### 4. Security Gate Results (`scripts/phase8_security_gate.ts`)

| # | Assertion | Result |
|---|---|---|
| 1 | Migration `008_nda_and_data_room.sql` recorded in `_schema_migrations` | **PASS** |
| 2 | Sequences `nda_ref_seq` and `vdr_ref_seq` exist in database | **PASS** |
| 3 | Tables `nda_agreements`, `data_rooms`, `data_room_members`, `data_room_documents` exist | **PASS** |
| 4 | Partial unique and member/document indexes exist in database | **PASS** |
| 5 | Phase 8 RBAC permissions correctly seeded in permissions table | **PASS** |
| 6 | Principals and compliance actors provisioned successfully | **PASS** |
| 7 | Bilateral EOI accepted by seller | **PASS** |
| 8 | ACCEPTED EOI DOES NOT unlock data room. No room exists before formal NDA initiation | **PASS** |
| 9 | Cannot initiate bilateral NDA on unaccepted EOI (Enforces ACCEPTED EOI prerequisite) | **PASS** |
| 10 | Initiating NDA sets status to `NDA_SENT` | **PASS** |
| 11 | Reference code formatted: `NDA-2026-10067` | **PASS** |
| 12 | Zero Data Rooms exist prior to bilateral execution (Boundary strictly enforced) | **PASS** |
| 13 | Anti-IDOR: Buyer 2 CANNOT read Buyer 1's NDA agreement (Throws `ForbiddenError`) | **PASS** |
| 14 | Anti-IDOR: Seller 2 CANNOT read Seller 1's NDA agreement (Throws `ForbiddenError`) | **PASS** |
| 15 | Authorized Buyer can view NDA (Transitioned to `BUYER_VIEWED`) | **PASS** |
| 16 | Authorized Seller can view NDA | **PASS** |
| 17 | Unilateral acceptance by buyer moves status to `BUYER_ACCEPTED` | **PASS** |
| 18 | Buyer accepted timestamp set; seller timestamp null | **PASS** |
| 19 | CRITICAL: Unilateral acceptance (`BUYER_ACCEPTED`) does NOT unlock or create Data Room | **PASS** |
| 20 | Party cannot accept an already accepted NDA twice (Double accept invariant) | **PASS** |
| 21 | Countersignature by seller transitions NDA to `EXECUTED` | **PASS** |
| 22 | Executed timestamp recorded upon bilateral agreement | **PASS** |
| 23 | Data Room record created upon bilateral execution | **PASS** |
| 24 | Data Room automatically transitions to `ACTIVE` upon bilateral execution | **PASS** |
| 25 | Data Room `activated_at` timestamp populated | **PASS** |
| 26 | Explicit memberships created for both buyer and seller in `data_room_members` | **PASS** |
| 27 | Buyer 1 is registered as `ACTIVE` `BUYER` member | **PASS** |
| 28 | Seller 1 is registered as `ACTIVE` `SELLER` member | **PASS** |
| 29 | Terminal state invariant: Cannot decline an already `EXECUTED` NDA | **PASS** |
| 30 | Authorized Buyer can access `ACTIVE` Data Room | **PASS** |
| 31 | Authorized Seller can access `ACTIVE` Data Room | **PASS** |
| 32 | Anti-IDOR: Unauthorized Buyer 2 CANNOT access Buyer 1's Data Room (Throws `ForbiddenError`) | **PASS** |
| 33 | Anti-IDOR: Unauthorized Seller 2 CANNOT access Seller 1's Data Room (Throws `ForbiddenError`) | **PASS** |
| 34 | Only authorized Promoters / Sellers can upload documents to Data Room | **PASS** |
| 35 | File security: Files exceeding 15MB limit are strictly rejected | **PASS** |
| 36 | File security: Spoofed MIME types failing magic bytes (`%PDF-`) are rejected | **PASS** |
| 37 | File security: Malicious path traversal filenames are blocked | **PASS** |
| 38 | Seller can upload genuine confidential PDF document | **PASS** |
| 39 | Private storage verified outside web root (`data/vault/datarooms/`) | **PASS** |
| 40 | Binary file physically exists on encrypted server vault | **PASS** |
| 41 | Anti-IDOR: Buyer 2 CANNOT generate signed URL for Buyer 1's Data Room document | **PASS** |
| 42 | Authorized Buyer generates short-lived signed URL | **PASS** |
| 43 | Buyer streams binary file via valid cryptographic signed download token | **PASS** |
| 44 | Tampered download token is strictly rejected (HMAC constant-time verification) | **PASS** |
| 45 | Expired download token is strictly rejected (TTL expiration check) | **PASS** |
| 46 | Soft-deleted document is no longer listed in Data Room for buyer | **PASS** |
| 47 | Downloading soft-deleted document is strictly blocked | **PASS** |
| 48 | Admin revoking room sets data room status to `REVOKED` | **PASS** |
| 49 | Admin revoking room cascades status to `REVOKED` on NDA agreement | **PASS** |
| 50 | Accessing revoked Data Room is immediately blocked for all parties | **PASS** |
| 51-59 | Full immutable audit trail: `NDA_CREATED`, `NDA_VIEWED`, `NDA_ACCEPTED`, `NDA_EXECUTED`, `DATA_ROOM_CREATED`, `DOCUMENT_UPLOADED`, `SIGNED_URL_ISSUED`, `DOCUMENT_DOWNLOADED`, `DATA_ROOM_REVOKED` | **PASS** |
| 60-61 | In-app notifications delivered to both buyer and seller | **PASS** |

**Summary**: 61 / 61 assertions passed (100%).

---

### 5. Automated Vitest Suite (`tests/nda_data_room.test.ts`)

33 comprehensive unit/integration tests:
- 7 Lifecycle initiation and prerequisite tests: **PASS**
- 9 State machine and bilateral countersignature tests: **PASS**
- 5 Anti-IDOR and confidentiality boundary tests: **PASS**
- 4 Private storage, magic byte inspection, and 15MB file ceiling tests: **PASS**
- 4 Short-lived cryptographic HMAC-SHA256 signed URL tests: **PASS**
- 2 Soft deletion and administrative revocation tests: **PASS**
- 2 Immutable audit log and notification delivery tests: **PASS**

---

### 6. Verification Verdict

```text
=================================================================
PHASE 8 SECURITY GATE COMPLETE: 61/61 ASSERTIONS PASSED
VITEST SUITE: 33/33 TESTS PASSED
TYPESCRIPT: 0 ERRORS
ESLINT: 0 ERRORS
NEXT.JS BUILD: PRODUCTION READY
=================================================================

>>> PHASE 8 FINAL VERDICT: READY_FOR_PHASE_9 <<<
```
