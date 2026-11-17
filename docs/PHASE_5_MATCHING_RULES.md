# SCALE-UP INDIA — PHASE 5 DETERMINISTIC MATCHING RULES & SPECIFICATION
## Mathematical Model, Hard/Soft Constraints, Scoring Weights, and Explanation Codes

**Version**: 1.0.0  
**Algorithm ID**: `v1.0.0-deterministic`  
**Status**: APPROVED SPECIFICATION  

---

## 1. Architectural Philosophy

The matching engine evaluates an active **Buyer Acquisition Mandate** against a published, verified **Business Opportunity**.

The engine operates in two strictly separated phases:
1. **Phase A: Hard Gate Verification (Binary Feasibility)**
   - If any hard constraint fails $\to$ `isEligible = false`, `score = 0`, `classification = 'POOR_MATCH'`.
   - The engine logs the exact blocking reason code in `blockingCriteria` and `reasons`.
2. **Phase B: Soft Preference Scoring (Weighted Sum)**
   - If all hard gates pass $\to$ `isEligible = true`.
   - The engine computes a weighted score between $0$ and $100$ across 7 independent dimensions.
   - Each dimension contributes a deterministic partial score according to strict mathematical rules.

---

## 2. Hard Constraints (Binary Exclusion Gates)

| Gate ID | Hard Constraint Name | Mandate Field | Opportunity Field | Rejection Condition | Blocking Reason Code |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **HG-01** | **Publication Status** | — | `opportunities.status` | `status !== 'PUBLISHED'` or `deleted_at IS NOT NULL` | `OPPORTUNITY_NOT_PUBLISHED` |
| **HG-02** | **Industry Alignment** | `mandate_target_industries.industry` | `opportunities.industry` | Mandate has $\ge 1$ target industries AND opportunity `industry` is NOT in target set | `INDUSTRY_MISMATCH` |
| **HG-03** | **Transaction Type Alignment** | `acquisition_mandates.transaction_types` | `opportunities.transaction_type` | Mandate has $\ge 1$ transaction types AND opportunity `transaction_type` is NOT in list | `TRANSACTION_TYPE_MISMATCH` |
| **HG-04** | **Profitability Requirement** | `acquisition_mandates.profitable_businesses_only` | `opportunities.ebitda_margin_bracket` | `profitable_businesses_only === true` AND `ebitda_margin_bracket === 'NEGATIVE'` | `UNPROFITABLE_BUSINESS` |
| **HG-05** | **Extreme Capital Ceiling** | `acquisition_mandates.max_investment` | `opportunities.asking_price_bracket` | Opportunity minimum asking price exceeds buyer `max_investment` by $> 100\%$ | `CAPITAL_CAPACITY_EXCEEDED` |

*Note: If an opportunity fails any Hard Gate, score calculation terminates immediately with `score = 0`.*

---

## 3. Scoring Weights Configuration (`MATCHING_WEIGHTS`)

When an opportunity satisfies all Hard Gates, it is evaluated across 7 weighted dimensions totaling exactly 100 points:

```typescript
export const MATCHING_WEIGHTS = {
  GEOGRAPHY: 20,           // Regional and state footprint alignment
  REVENUE: 20,             // Revenue scale & financial turnover overlap
  INVESTMENT_CAPACITY: 15, // Ticket size vs asking price compatibility
  EBITDA_MARGIN: 15,       // Operational profitability & margin health
  SUB_SECTOR_DEPTH: 10,    // Niche sub-sector and specialization match
  BUSINESS_MODEL: 10,      // Commercial business model alignment (B2B/Contract/SaaS)
  OPERATIONAL_SCALE: 10,   // Headcount scale & business track record/age
} as const;

// Strict Invariant: Sum of weights must equal 100
// 20 + 20 + 15 + 15 + 10 + 10 + 10 = 100
```

---

## 4. Dimension-by-Dimension Scoring Rules

### Dimension 1: Geographic Alignment (Max: 20 Points)
Mandates specify target geographies via `mandate_target_geographies` (`region`, `states`, `cities`). Opportunities specify `operating_region` and `registered_state`.

- **Condition 1 (Universal Footprint)**:
  - If mandate contains `region = 'PAN_INDIA'` or `region = 'GLOBAL'` $\implies$ **20 Points**
  - *Reason*: `"Target geography matches national acquisition criteria (Pan-India)"`
- **Condition 2 (Direct State Match)**:
  - If opportunity `registered_state` is in mandate's `states` array $\implies$ **20 Points**
  - *Reason*: `"Registered state [State] matches buyer priority location"`
- **Condition 3 (Direct Regional Match)**:
  - If opportunity `operating_region === mandate.region` $\implies$ **16 Points**
  - *Reason*: `"Operating region [Region] matches target mandate geography"`
- **Condition 4 (Adjacent / Flexible)**:
  - If mandate is state-specific but opportunity is in same region $\implies$ **10 Points**
  - *Reason*: `"Opportunity is within adjacent regional corridor"`
- **Condition 5 (Geographic Outlier)**:
  - Otherwise $\implies$ **4 Points**
  - *Reason*: `"Operating region is outside primary geographic preference"`

---

### Dimension 2: Revenue Scale Compatibility (Max: 20 Points)
Opportunities define turnover through `revenue_bracket`:
- `UNDER_5CR`: [₹0, ₹5 Cr]
- `5CR_TO_15CR`: [₹5 Cr, ₹15 Cr]
- `15CR_TO_25CR`: [₹15 Cr, ₹25 Cr]
- `25CR_TO_50CR`: [₹25 Cr, ₹50 Cr]
- `50CR_TO_100CR`: [₹50 Cr, ₹100 Cr]
- `100CR_TO_250CR`: [₹100 Cr, ₹250 Cr]
- `OVER_250CR`: [₹250 Cr, $\infty$)

The buyer mandate specifies `revenue_min` and `revenue_max` (in INR).

- **Condition 1 (Full Range Containment)**:
  - The opportunity revenue bracket falls entirely within `[revenue_min, revenue_max]` $\implies$ **20 Points**
  - *Reason*: `"Annual revenue bracket falls squarely within buyer acquisition mandate"`
- **Condition 2 (Substantial Overlap)**:
  - The opportunity bracket intersects $\ge 50\%$ with `[revenue_min, revenue_max]` $\implies$ **15 Points**
  - *Reason*: `"Annual revenue bracket substantially overlaps target turnover range"`
- **Condition 3 (Marginal Overlap / Proximity)**:
  - The bracket intersects or is within $25\%$ of boundary $\implies$ **8 Points**
  - *Reason*: `"Annual revenue is within acceptable tolerance margin of mandate"`
- **Condition 4 (Scale Discrepancy)**:
  - Completely outside target range $\implies$ **0 Points**
  - *Reason*: `"Business turnover bracket is outside buyer preferred scale"`

---

### Dimension 3: Investment / Ticket Size Compatibility (Max: 15 Points)
Opportunities define asking valuation via `asking_price_bracket`:
- `UNDER_10CR`: [₹0, ₹10 Cr]
- `10CR_TO_25CR`: [₹10 Cr, ₹25 Cr]
- `25CR_TO_50CR`: [₹25 Cr, ₹50 Cr]
- `50CR_TO_100CR`: [₹50 Cr, ₹100 Cr]
- `100CR_TO_250CR`: [₹100 Cr, ₹250 Cr]
- `NEGOTIABLE`: Flexible

The buyer mandate specifies `min_investment` and `max_investment` (and optional `preferred_ticket_size`).

- **Condition 1 (Exact Sweetspot)**:
  - Asking price bracket aligns with buyer's `preferred_ticket_size` $\implies$ **15 Points**
  - *Reason*: `"Asking price bracket matches buyer's optimal ticket size"`
- **Condition 2 (Budget Enclosed)**:
  - Asking price bracket is fully within `[min_investment, max_investment]` or is `NEGOTIABLE` $\implies$ **12 Points**
  - *Reason*: `"Valuation expectations fall within committed capital capacity"`
- **Condition 3 (Tolerance Band)**:
  - Asking price overlaps with buyer capital with minor adjustment needed $\implies$ **6 Points**
  - *Reason*: `"Valuation bracket requires capital co-investment or syndication"`
- **Condition 4 (Capital Gap)**:
  - Asking price exceeds capacity $\implies$ **0 Points**
  - *Reason*: `"Valuation expectations exceed buyer's stated capital allocation"`

---

### Dimension 4: EBITDA & Margin Quality (Max: 15 Points)
Evaluated against `ebitda_margin_bracket`:
- `OVER_30_PCT`: Super-normal margins $\implies$ **15 Points**
  - *Reason*: `"Superior operating profitability (EBITDA margin > 30%)"`
- `20_TO_30_PCT`: High institutional margins $\implies$ **13 Points**
  - *Reason*: `"Strong operating profitability (EBITDA margin 20% to 30%)"`
- `10_TO_20_PCT`: Healthy industry standard margins $\implies$ **10 Points**
  - *Reason*: `"Healthy industry EBITDA margin (10% to 20%)"`
- `0_TO_10_PCT`: Thin or turnaround margins $\implies$ **5 Points**
  - *Reason*: `"Moderate operating profitability (EBITDA margin under 10%)"`
- `NEGATIVE`: Operating loss (allowed only if `profitable_businesses_only = false`) $\implies$ **0 Points**
  - *Reason*: `"Turnaround profile with negative operating margin"`

---

### Dimension 5: Sub-Sector / Specialization Depth (Max: 10 Points)
Evaluated between `mandate_target_industries.sub_sectors` and `opportunities.sub_sector`:
- **Condition 1 (Exact Sub-Sector Match)**:
  - Opportunity `sub_sector` matches one of the mandate's target `sub_sectors` $\implies$ **10 Points**
  - *Reason*: `"Specialized sub-sector directly matches priority strategic interest"`
- **Condition 2 (Base Industry Fit)**:
  - Base industry matches, but specific sub-sector is general or unlisted $\implies$ **6 Points**
  - *Reason*: `"Industry sector aligns with broad acquisition scope"`
- **Condition 3 (Generic Cross-Sector)**:
  - Otherwise $\implies$ **2 Points**
  - *Reason*: `"Sector matches broad commercial profile"`

---

### Dimension 6: Commercial Business Model (Max: 10 Points)
Evaluated between opportunity `business_model` and buyer preference:
- Opportunity models: `B2B`, `CONTRACT_MANUFACTURING`, `SAAS`, `B2C`, `B2B2C`, `D2C`, `FRANCHISE`, `HYBRID`.
- Institutional buyers (PE Funds, Corporate Acquirers) typically favor defensible models (`B2B`, `CONTRACT_MANUFACTURING`, `SAAS`):
  - Defensible institutional model (`B2B`, `CONTRACT_MANUFACTURING`, `SAAS`) $\implies$ **10 Points**
  - Scalable consumer / hybrid model (`B2B2C`, `HYBRID`, `FRANCHISE`) $\implies$ **7 Points**
  - Direct retail / consumer (`B2C`, `D2C`) $\implies$ **5 Points**
  - *Reason*: `"Commercial business model ([Model]) aligns with acquirer operating thesis"`

---

### Dimension 7: Operational Scale & Track Record (Max: 10 Points)
Evaluated against `employee_range` and `approximate_age_bracket`:
- **Workforce Scale (Max: 5 Points)**:
  - Aligns with mandate `[employee_min, employee_max]` $\implies$ **5 Points**
  - Within 1 adjacent bracket $\implies$ **3 Points**
  - Otherwise $\implies$ **1 Point**
- **Track Record / Age (Max: 5 Points)**:
  - Established business (`OVER_20_YRS` or `10_TO_20_YRS`) $\implies$ **5 Points**
  - Mature growth (`5_TO_10_YRS`) $\implies$ **4 Points**
  - Early scale (`3_TO_5_YRS`) $\implies$ **3 Points**
  - Early stage (`LESS_THAN_3_YRS`) $\implies$ **2 Points**
  - *Reason*: `"Operational headcount and vintage demonstrate established market presence"`

---

## 5. Match Classifications

| Score Range | Classification Code | Human Label | Strategic Action |
| :---: | :--- | :--- | :--- |
| **90 – 100** | **`EXCELLENT_MATCH`** | Excellent Match | Immediate priority for bilateral Expression of Interest (EOI). |
| **75 – 89** | **`STRONG_MATCH`** | Strong Match | High strategic compatibility; recommend buyer review. |
| **60 – 74** | **`POTENTIAL_MATCH`** | Potential Match | Synergies exist with minor parameter variance. |
| **40 – 59** | **`WEAK_MATCH`** | Weak Match | Substantial parameter deviation; lower priority. |
| **0 – 39** | **`POOR_MATCH`** | Poor Match | Material mismatches; not recommended for outreach. |

---

## 6. Confidentiality Invariants

Under no circumstances may any explanation or reason code expose:
- Corporate legal name (e.g., "Bharat Dynamics Precision Private Limited")
- Ministry of Corporate Affairs CIN / LLPIN
- GSTIN registration numbers
- Permanent Account Number (PAN)
- Physical address, building number, industrial plot details
- Unaudited ledgers, bank balances, or exact cash figures
- Seller director names or promoter contact details

All reasons must reference **blind structured categories** (e.g., `"Western India"`, `"₹25 Cr to ₹50 Cr revenue bracket"`, `"Defense & Aerospace"`).
