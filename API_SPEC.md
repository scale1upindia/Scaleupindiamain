# Scale-up India — API Specification (API_SPEC.md)
*Domain-Driven RESTful Contract with Standard Response DTOs*

---

## 1. Global API Conventions

### Base URL & Versioning
All domain endpoints reside under `/api/v1/`.

### Standard Response Envelope
All API endpoints return predictable JSON structures:

```json
// Success Response (HTTP 200 / 201)
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-11-13T10:15:30.000Z",
    "correlationId": "req_8f1a23b9c0"
  }
}

// Error Response (HTTP 400 / 401 / 403 / 404 / 422 / 500)
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "cin": "Invalid Corporate Identification Number format",
      "expectedPrice": "Price must be a positive number"
    }
  },
  "meta": {
    "timestamp": "2026-11-13T10:15:30.000Z",
    "correlationId": "req_8f1a23b9c0"
  }
}
```

### Pagination Contract
```json
{
  "items": [ ... ],
  "pagination": {
    "total": 142,
    "page": 1,
    "limit": 20,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## 2. Domain Endpoints Catalog

### 2.1 Authentication & Sessions (`/api/v1/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Initial multi-role registration | Public |
| `POST` | `/login` | Authenticate with email/password; sets HTTP-only cookie | Public |
| `POST` | `/logout` | Revoke active session cookie | Session |
| `POST` | `/logout-all` | Revoke all active sessions for the authenticated user | Session |
| `GET` | `/session` | Return current user context, roles, and profile completion | Session |
| `POST` | `/forgot-password` | Request password reset token via email | Public (Rate Limited) |
| `POST` | `/reset-password` | Submit reset token and new password | Public |

### 2.2 Profiles & Onboarding (`/api/v1/profiles`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/me` | Get complete profile details across all active roles | Session |
| `POST` | `/promoter` | Save or update promoter onboarding steps (Draft auto-save) | Promoter |
| `POST` | `/buyer` | Save or update buyer investment preferences | Buyer |
| `POST` | `/investor` | Save or update investor fund and ticket size criteria | Investor |
| `POST` | `/partner` | Save or update strategic JV objectives | Partner |
| `GET` | `/score/:opportunityId` | Fetch 100-point Profile Readiness Score & breakdown | Owner / Admin |

### 2.3 Opportunities & Listings (`/api/v1/opportunities`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Paginated search of published opportunities (Data-masked) | Public / Buyer |
| `GET` | `/:id` | Get opportunity details (Progressively masked by NDA status) | Public / Buyer |
| `POST` | `/` | Create new opportunity draft (Stake sale or asset sale) | Promoter |
| `PUT` | `/:id` | Update opportunity fields (Draft / Action Required state only) | Promoter (Owner) |
| `POST` | `/:id/submit` | Submit draft opportunity for Scale-up India admin review | Promoter (Owner) |
| `POST` | `/:id/withdraw` | Withdraw published or submitted opportunity | Promoter (Owner) |

### 2.4 Matching Engine (`/api/v1/matching`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/recommendations` | Get ranked opportunities tailored to buyer preferences | Buyer |
| `GET` | `/explain/:opportunityId` | Get compatibility breakdown (Industry, Price, Region, Intent)| Buyer |
| `POST` | `/shortlist/:opportunityId`| Bookmark / save an opportunity | Buyer |

### 2.5 Expression of Interest & 24h SLA (`/api/v1/interests`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/` | Submit Expression of Interest with investment capability | Verified Buyer |
| `GET` | `/received` | Get inbound interests for promoter's listings | Promoter |
| `GET` | `/sent` | Get outbound interests submitted by buyer | Buyer |
| `POST` | `/:id/respond` | Promoter accepts or declines interest within 24 hours | Promoter (Owner) |
| `POST` | `/:id/escalate` | RM initiates intervention on overdue 24h response | Relationship Mgr |

### 2.6 Confidentiality & Legal Workflows (`/api/v1/legal`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/nda/:interestId` | View bilateral NDA terms for accepted interest | Buyer / Promoter |
| `POST` | `/nda/:interestId/sign` | Sign and execute NDA (Captures hash, timestamp, IP) | Buyer / Promoter |
| `GET` | `/mou/:ndaId` | Retrieve Tripartite MOU draft with token fee terms | Deal Parties |
| `POST` | `/mou/:mouId/sign` | Execute Tripartite MOU (Buyer, Seller, or Scale-up India) | Deal Parties |
| `GET` | `/sta/:mouId` | Fetch Share Transfer Agreement draft | Deal Parties |
| `POST` | `/sta/:mouId/sign` | Sign formal Share Transfer Agreement | Deal Parties |

### 2.7 Payments & Token Fee Abstraction (`/api/v1/payments`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/create-order` | Create token fee or facilitation payment intent (Idempotent) | Deal Parties |
| `POST` | `/verify` | Verify payment gateway signature or submit NEFT/RTGS UTR | Deal Parties |
| `GET` | `/status/:paymentId` | Check transaction status in financial ledger | Deal Parties / Finance |
| `POST` | `/webhook` | Asynchronous payment gateway status webhook (HMAC signature) | Public (Signed) |

### 2.8 Due Diligence & Valuation (`/api/v1/deal-room`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/dd/:mouId` | Fetch 12-category DD checklist and item statuses | Deal Parties |
| `PATCH` | `/dd/item/:itemId` | Update checklist status or flag severity issues | DD Lead / Buyer |
| `POST` | `/valuation/request` | Submit formal valuation request | Buyer / DD Lead |
| `POST` | `/valuation/report` | Upload finalized valuation report | Valuation Advisor |

### 2.9 Secure Document Vault (`/api/v1/documents`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/upload` | Stream file to quarantine $\to$ magic byte validation | Session |
| `GET` | `/:id/url` | Request 15-minute signed download URL (Audited) | Authorized Party |
| `DELETE`| `/:id` | Soft delete an uncommitted document | Owner |

### 2.10 Secure Messaging (`/api/v1/conversations`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | List active deal room conversations | Participant |
| `GET` | `/:id/messages` | Paginated message history (Participant verification) | Participant |
| `POST` | `/:id/messages` | Send message or attachment in authorized room | Participant |

### 2.11 Internal Admin Console (`/api/v1/admin`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/stats` | Operational dashboard metrics (Pipeline, Funnel, Overdues) | Admin Staff |
| `GET` | `/reviews/opportunities` | Curation queue for pending listings | Verification Mgr |
| `POST` | `/reviews/opportunities/:id`| Approve, reject, or request changes on listing | Verification Mgr |
| `GET` | `/reviews/documents` | Inspection queue for pending company documents | Verification Mgr |
| `POST` | `/reviews/documents/:id` | Mark document as verified or rejected with notes | Verification Mgr |
| `GET` | `/audit-logs` | Filterable immutable audit trail with IP & Actor data | Auditor / Admin |
| `PATCH` | `/settings` | Update system configuration (token fees, SLA weights) | Super Admin |

