# Scale-up India — Matching Engine Data Contract (MATCHING_DATA_CONTRACT.md)
*Standardized Interface Between Phase 2 (Sellers), Phase 3 (Buyers), and Future Phase 7 (10-Factor Matching Engine)*

---

## 1. Overview & Objective

The Scale-up India matchmaking architecture operates on a bilateral confidential model. The matching engine evaluates verified Commercial Seller Listings against verified Buyer Acquisition Mandates across deterministic and weighted strategic dimensions.

This contract defines the structured attributes captured in Phase 2 and Phase 3 that feed the matching engine.

---

## 2. Match Dimensions & Data Mapping

| # | Match Factor | Seller Profile Attribute (Source) | Buyer Mandate Attribute (Target) | Evaluation Operator | Strict Filter or Score? |
| :-: | :--- | :--- | :--- | :--- | :---: |
| **01** | **Industry & Sector** | `business_profiles.industry` & `sub_sector` | `mandate_target_industries.industry` & `sub_sectors` | Exact or Sub-sector hierarchy match | **Strict Gate** |
| **02** | **Geography & Footprint** | `business_profiles.registered_state`, `operating_locations` | `mandate_target_geographies.region`, `states`, `cities` | Geographic containment (Pan India $\supset$ Region $\supset$ State) | **Strict Gate / High Weight** |
| **03** | **Transaction Intent & Structure** | `seller_transaction_preferences.intents` (e.g. `FULL_SALE`, `PARTIAL_STAKE_SALE`, `JV`, `INVESTMENT`) | `acquisition_mandates.transaction_types` | Set intersection $\ne \emptyset$ | **Strict Gate** |
| **04** | **Financial Ticket & Valuation** | `seller_transaction_preferences.expected_valuation` or `expected_transaction_value` | `acquisition_mandates.min_investment` to `max_investment` | `min_investment` $\le \text{Value} \le$ `max_investment` | **Weighted Score** (Tolerance band) |
| **05** | **Business Scale: Revenue** | `business_financial_profiles.revenue` (Latest FY) | `acquisition_mandates.revenue_min` to `revenue_max` | `revenue_min` $\le \text{Rev} \le$ `revenue_max` | **Weighted Score** |
| **06** | **Profitability: EBITDA & PAT** | `business_financial_profiles.ebitda` & `pat` | `acquisition_mandates.profitable_businesses_only`, `ebitda_min` to `ebitda_max` | Positive check + range match | **Strict Gate if `profitable_only = true`** |
| **07** | **Headcount & Operational Scale** | `business_profiles.employee_count` | `acquisition_mandates.employee_min` to `employee_max` | Range containment | **Weighted Score** |
| **08** | **Governance & Control** | `business_ownerships.ownership_percentage` & `seller_transaction_preferences.stake_offered_percentage` | `acquisition_mandates.control_preference` (`FULL_CONTROL`, `MAJORITY`, `MINORITY`, `JOINT`) | Stake compatibility | **Weighted Score** |
| **09** | **Track Record & Age** | `business_profiles.year_established` | `acquisition_mandates.business_age_min` to `business_age_max` | Age check | **Weighted Score** |
| **10** | **Strategic Objectives & Synergy** | `seller_transaction_preferences.strategic_objectives` | `acquisition_mandates.strategic_objectives` | Jaccard similarity index on strategic tags | **Weighted Score** |

---

## 3. Confidentiality & Progressive Disclosure Levels

The matching engine will compute match scores on masked dossiers:
1. **Tier 0 (Pre-NDA Teaser)**:
   - Industry, broad location (Region/State only), revenue bracket (e.g., ₹25Cr–₹50Cr), transaction type, match score %.
   - **Hidden**: Legal name, CIN, GSTIN, promoter names, exact addresses, detailed cap table, uploaded audit documents.
2. **Tier 1 (Post-Expression of Interest & Consent)**:
   - Aggregated multi-year financial trends, employee count, MSME status.
3. **Tier 2 (Post-Bilateral Executed NDA)**:
   - Identity unlocked, exact audited financials, cap table, private document vault access.

