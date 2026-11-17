# Scale-up India — Architectural & Domain Conflicts Log (CONFLICTS.md)

---

## 1. Operating Legal Entity & Corporate Branding Ambiguity
- **Identified References**: 
  - Several source specification documents reference `Ideal Corporate Synergy LLP` (ICS) as the operating corporate entity (`Process_How does Scale-up India Operates.docx`, `Scale -up India Detailed Book.docx`, `ics-logo.svg`).
  - However, customer-facing interfaces, domain registrations, and brand trademarks predominantly feature **"Scale-up India"** as the primary operating brand name (`logo.svg`).
- **Policy & Invariant Adopted**:
  - In accordance with Section 2 of Phase 2 Execution Directives, the platform does NOT assume `Ideal Corporate Synergy LLP` is the sole or final statutory operating entity.
  - The platform strictly retains primary public branding as **"Scale-up India"** ("Trusted Business Matchmaking & Transaction Platform").
  - Any reference to operating entities in legal terms or footers remains configurable and is flagged for explicit confirmation by platform leadership prior to regulated financial releases.

---

## 2. Custodial & Escrow Terminology
- **Identified References**:
  - The business overview describes "Escrow-like Custodianship" for deal consideration and token payments.
- **Policy & Invariant Adopted**:
  - Scale-up India represents deal states (e.g., `FUNDS_IN_CUSTODY`, `TOKEN_PENDING`) via workflow state machines and integration-ready abstractions (`PaymentProvider`), without making unverified legal assertions that the platform itself possesses a direct banking or custodial license.

