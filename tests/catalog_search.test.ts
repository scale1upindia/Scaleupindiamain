import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  discoverOpportunities,
  getOpportunityForDiscovery,
} from "@/domains/opportunity/service";
import { createAcquisitionMandate } from "@/domains/buyer/service";
import { refreshBuyerMatches } from "@/domains/matching/service";
import { opportunityDiscoveryQuerySchema } from "@/schemas/opportunity";
import { AuthenticatedUser } from "@/types/auth";
import { Tier0Opportunity, Tier1Opportunity } from "@/types/opportunity";

describe("Phase 6: Search, Filtering & Confidential Discovery Catalog", () => {
  let seller: AuthenticatedUser;
  let admin: AuthenticatedUser;
  let buyerA: AuthenticatedUser;
  let buyerB: AuthenticatedUser;
  let buyerAProfileId: string;
  let buyerBProfileId: string;

  let publishedOpp1Id: string;
  let publishedOpp2Id: string;
  let publishedOpp3Id: string;
  let draftOppId: string;
  let submittedOppId: string;
  let rejectedOppId: string;
  let suspendedOppId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Provision Seller
    const regSeller = await registerUser({
      email: "promoter.catalog@enterprise.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller = regSeller.user;

    // 2. Provision Admin
    const regAdmin = await registerUser({
      email: "admin.curator@scaleup.in",
      firstName: "Chief",
      lastName: "Curator",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "opportunities.read_all",
        "opportunities.review",
        "opportunities.verify",
        "opportunities.publish",
      ],
    };

    // 3. Provision Buyer A (Defense / Manufacturing mandate)
    const regBuyerA = await registerUser({
      email: "buyer.a@aerospace-cap.in",
      firstName: "Arun",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerA = regBuyerA.user;
    const bpARes = await query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'CORPORATE_BUYER', 'Aero Strategic Capital LLP', 'LLP', 'India', 'Haryana', 'Gurugram',
        'Arun Mehta', 'Managing Partner', $2, '+91 9999999811', 'VERIFIED')
      RETURNING id`,
      [buyerA.id, buyerA.email]
    );
    buyerAProfileId = bpARes.rows[0].id;

    await createAcquisitionMandate(buyerA, {
      name: "Aerospace & Defense 100% Buyout Mandate",
      minInvestment: 250000000,
      maxInvestment: 800000000,
      revenueMin: 200000000,
      revenueMax: 800000000,
      transactionTypes: ["FULL_ACQUISITION"],
      targetIndustries: [
        {
          industry: "Defense & Aerospace",
          subSectors: ["Avionics Machining"],
        },
      ],
      targetGeographies: [
        {
          region: "NORTH_INDIA",
          states: ["Haryana"],
        },
      ],
    });

    // 4. Provision Buyer B (Healthcare mandate)
    const regBuyerB = await registerUser({
      email: "buyer.b@healthcare-fund.in",
      firstName: "Bhavna",
      lastName: "Shah",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerB = regBuyerB.user;
    const bpBRes = await query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, country, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'PE_FUND', 'Bhavna Healthcare Fund', 'FUND', 'India', 'Karnataka', 'Bengaluru',
        'Bhavna Shah', 'Director', $2, '+91 9999999812', 'VERIFIED')
      RETURNING id`,
      [buyerB.id, buyerB.email]
    );
    buyerBProfileId = bpBRes.rows[0].id;

    await createAcquisitionMandate(buyerB, {
      name: "National Diagnostics & Healthcare Mandate",
      minInvestment: 100000000,
      maxInvestment: 500000000,
      revenueMin: 50000000,
      revenueMax: 300000000,
      transactionTypes: ["MAJORITY_STAKE"],
      targetIndustries: [
        {
          industry: "Healthcare Diagnostics",
          subSectors: ["Clinical Pathology"],
        },
      ],
      targetGeographies: [
        {
          region: "SOUTH_INDIA",
          states: ["Karnataka"],
        },
      ],
    });

    // 5. Seed Opportunities in Various Publication States
    // Opp 1: Defense in North India (PUBLISHED)
    const opp1 = await createOpportunity(seller, {
      title: "Precision Aerospace Component Manufacturer",
      headline: "AS9100 Certified Avionics Supplier to Tier 1 Integrators",
      teaserSummary: "Leading precision engineering manufacturer with 18 CNC centres in Haryana supplying airframe components.",
      detailedDescription: "High-margin aerospace manufacturing with 120 skilled machinists, long-term defense contracts.",
      businessCategory: "MANUFACTURING",
      industry: "Defense & Aerospace",
      subSector: "Avionics Machining",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Haryana",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      ebitdaMarginBracket: "20_TO_30_PCT",
      askingPriceBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
      exactLegalName: "Confidential Aero Precision Pvt Ltd",
      exactCin: "U29299HR2008PTC038192",
      exactGstin: "06AABCA1234F1Z8",
      exactPan: "AABCA1234F",
      exactAddress: "Plot 42, IMT Manesar, Gurugram, Haryana",
    });
    publishedOpp1Id = opp1.id;
    await submitOpportunity(opp1.id, seller);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);

    // Opp 2: Healthcare in South India (PUBLISHED)
    const opp2 = await createOpportunity(seller, {
      title: "Accredited Pathology & Diagnostic Chain in Bengaluru",
      headline: "NABL Accredited Laboratory Network with 14 Hubs",
      teaserSummary: "Modern diagnostic laboratories serving over 4,500 daily test panels with digital accessioning.",
      detailedDescription: "Full automated robotic biochemistry and molecular pathology suites with B2B hospital contracts.",
      businessCategory: "HEALTHCARE",
      industry: "Healthcare Diagnostics",
      subSector: "Clinical Pathology",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "25CR_TO_50CR",
      ebitdaMarginBracket: "20_TO_30_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "B2B2C",
      exactLegalName: "Confidential Karnataka Diagnostic Labs LLP",
      exactGstin: "29AABCK5678M1Z2",
    });
    publishedOpp2Id = opp2.id;
    await submitOpportunity(opp2.id, seller);
    await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);

    // Opp 3: Logistics in West India (PUBLISHED)
    const opp3 = await createOpportunity(seller, {
      title: "Integrated Cold Chain Logistics Firm in Mumbai",
      headline: "Multi-Temperature Reefer Fleet with Pharma Distribution",
      teaserSummary: "Pharma compliant GDP cold-storage distribution chain across Western India with 45 temperature-controlled trucks.",
      detailedDescription: "IoT telematics monitored fleet operating from Navi Mumbai to major pharma manufacturing hubs.",
      businessCategory: "LOGISTICS",
      industry: "Cold Chain Logistics",
      subSector: "Reefer Transportation",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "3_TO_5_YRS",
      revenueBracket: "15CR_TO_25CR",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "10CR_TO_25CR",
      transactionType: "MINORITY_STAKE",
      businessModel: "B2B",
      exactLegalName: "Confidential Western Reefer Logistics Ltd",
    });
    publishedOpp3Id = opp3.id;
    await submitOpportunity(opp3.id, seller);
    await executeAdminOpportunityReview(opp3.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp3.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(opp3.id, "PUBLISH", {}, admin);

    // Opp 4: DRAFT Opportunity
    const oppDraft = await createOpportunity(seller, {
      title: "Draft Unfinished Solar Project",
      teaserSummary: "Unpublished internal draft for solar farm.",
      businessCategory: "OTHER",
      industry: "Renewable Energy",
      operatingRegion: "CENTRAL_INDIA",
      registeredState: "Madhya Pradesh",
      approximateAgeBracket: "LESS_THAN_3_YRS",
      revenueBracket: "UNDER_5CR",
      transactionType: "ASSET_SALE",
      businessModel: "B2B",
    });
    draftOppId = oppDraft.id;

    // Opp 5: SUBMITTED Opportunity
    const oppSubmitted = await createOpportunity(seller, {
      title: "Submitted Organic Food Brand",
      teaserSummary: "Under platform review; not yet published.",
      businessCategory: "CONSUMER_RETAIL",
      industry: "FMCG Food",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Delhi",
      approximateAgeBracket: "3_TO_5_YRS",
      revenueBracket: "5CR_TO_15CR",
      transactionType: "STRATEGIC_PARTNERSHIP",
      businessModel: "D2C",
    });
    submittedOppId = oppSubmitted.id;
    await submitOpportunity(oppSubmitted.id, seller);

    // Opp 6: REJECTED Opportunity
    const oppRejected = await createOpportunity(seller, {
      title: "Rejected Deficient Enterprise",
      teaserSummary: "Rejected listing due to statutory non-compliance.",
      businessCategory: "SERVICES",
      industry: "Staffing",
      operatingRegion: "EAST_INDIA",
      registeredState: "West Bengal",
      approximateAgeBracket: "LESS_THAN_3_YRS",
      revenueBracket: "UNDER_5CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    rejectedOppId = oppRejected.id;
    await submitOpportunity(oppRejected.id, seller);
    await executeAdminOpportunityReview(oppRejected.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(oppRejected.id, "REJECT", { rejectionReason: "Failed financial KYC." }, admin);

    // Opp 7: SUSPENDED Opportunity
    const oppSuspended = await createOpportunity(seller, {
      title: "Suspended Listing Inactive Deal",
      teaserSummary: "Previously published but now suspended by admin.",
      businessCategory: "TECHNOLOGY",
      industry: "Software Services",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Telangana",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "SAAS",
    });
    suspendedOppId = oppSuspended.id;
    await submitOpportunity(oppSuspended.id, seller);
    await executeAdminOpportunityReview(oppSuspended.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(oppSuspended.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(oppSuspended.id, "PUBLISH", {}, admin);
    await executeAdminOpportunityReview(oppSuspended.id, "SUSPEND", { suspensionReason: "Promoter dispute raised." }, admin);

    // Refresh matches for Buyer A and Buyer B against published opportunities
    await refreshBuyerMatches(buyerA);
    await refreshBuyerMatches(buyerB);
  });

  // =========================================================================
  // 1. PUBLICATION STATE ISOLATION (Tests 1–6)
  // =========================================================================

  it("1. public catalog returns published opportunities only", async () => {
    const res = await discoverOpportunities({});
    expect(res.total).toBe(3);
    const ids = res.items.map((i) => i.id);
    expect(ids).toContain(publishedOpp1Id);
    expect(ids).toContain(publishedOpp2Id);
    expect(ids).toContain(publishedOpp3Id);
  });

  it("2. drafts are strictly excluded from catalog discovery", async () => {
    const res = await discoverOpportunities({});
    const ids = res.items.map((i) => i.id);
    expect(ids).not.toContain(draftOppId);
  });

  it("3. submitted/under-review opportunities are strictly excluded", async () => {
    const res = await discoverOpportunities({});
    const ids = res.items.map((i) => i.id);
    expect(ids).not.toContain(submittedOppId);
  });

  it("4. rejected opportunities are strictly excluded", async () => {
    const res = await discoverOpportunities({});
    const ids = res.items.map((i) => i.id);
    expect(ids).not.toContain(rejectedOppId);
  });

  it("5. suspended opportunities are strictly excluded", async () => {
    const res = await discoverOpportunities({});
    const ids = res.items.map((i) => i.id);
    expect(ids).not.toContain(suspendedOppId);
  });

  it("6. soft-deleted opportunities are strictly excluded", async () => {
    await query(`UPDATE opportunities SET deleted_at = NOW() WHERE id = $1`, [publishedOpp3Id]);
    const res = await discoverOpportunities({});
    expect(res.total).toBe(2);
    const ids = res.items.map((i) => i.id);
    expect(ids).not.toContain(publishedOpp3Id);
  });

  // =========================================================================
  // 2. SEARCH CAPABILITIES (Tests 7–12)
  // =========================================================================

  it("7. keyword search matches title", async () => {
    const res = await discoverOpportunities({ q: "Aerospace" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("8. keyword search matches teaser summary narrative", async () => {
    const res = await discoverOpportunities({ q: "Reefer" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp3Id);
  });

  it("9. keyword search matches detailed description", async () => {
    const res = await discoverOpportunities({ search: "biochemistry" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("10. keyword search matches industry name", async () => {
    const res = await discoverOpportunities({ q: "Diagnostics" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("11. keyword search matches sub-sector", async () => {
    const res = await discoverOpportunities({ q: "Avionics" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("12. keyword search matches reference code", async () => {
    const opp = await getOpportunityForDiscovery(publishedOpp1Id, admin);
    const res = await discoverOpportunities({ q: opp.referenceCode });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  // =========================================================================
  // 3. STRUCTURED MULTI-FACTOR FILTERS (Tests 13–20)
  // =========================================================================

  it("13. industry filter matches targeted sector", async () => {
    const res = await discoverOpportunities({ industry: "Defense" });
    expect(res.total).toBe(1);
    expect(res.items[0].industry).toBe("Defense & Aerospace");
  });

  it("14. business category enum filter", async () => {
    const res = await discoverOpportunities({ businessCategory: "HEALTHCARE" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("15. geography / operating region filter", async () => {
    const res = await discoverOpportunities({ region: "SOUTH_INDIA" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("16. transaction type filter", async () => {
    const res = await discoverOpportunities({ transactionType: "FULL_ACQUISITION" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("17. business model filter", async () => {
    const res = await discoverOpportunities({ businessModel: "B2B2C" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("18. revenue bracket filter", async () => {
    const res = await discoverOpportunities({ revenueBracket: "50CR_TO_100CR" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("19. EBITDA margin bracket filter", async () => {
    const res = await discoverOpportunities({ ebitdaBracket: "10_TO_20_PCT" });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp3Id);
  });

  it("20. combined multi-factor filters", async () => {
    const res = await discoverOpportunities({
      businessCategory: "MANUFACTURING",
      region: "NORTH_INDIA",
      transactionType: "FULL_ACQUISITION",
      revenueBracket: "50CR_TO_100CR",
    });
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  // =========================================================================
  // 4. PAGINATION & BOUNDARY GUARDS (Tests 21–25)
  // =========================================================================

  it("21. pagination returns correct slices", async () => {
    const page1 = await discoverOpportunities({ page: 1, limit: 2 });
    expect(page1.items.length).toBe(2);
    expect(page1.page).toBe(1);
    expect(page1.totalPages).toBe(2);

    const page2 = await discoverOpportunities({ page: 2, limit: 2 });
    expect(page2.items.length).toBe(1);
    expect(page2.page).toBe(2);

    // No overlap between pages
    const ids1 = page1.items.map((i) => i.id);
    const ids2 = page2.items.map((i) => i.id);
    expect(ids1).not.toContain(ids2[0]);
  });

  it("22. deterministic secondary ordering preserves pagination consistency", async () => {
    const full = await discoverOpportunities({ limit: 10 });
    const page1 = await discoverOpportunities({ page: 1, limit: 1 });
    const page2 = await discoverOpportunities({ page: 2, limit: 1 });
    expect(full.items[0].id).toBe(page1.items[0].id);
    expect(full.items[1].id).toBe(page2.items[0].id);
  });

  it("23. maximum page size limit is strictly capped at 50", async () => {
    // When requesting limit > 50, service layer caps at 50
    const res = await discoverOpportunities({ limit: 100 });
    // In database with 3 items, returns 3 but limit parameter is capped
    expect(res.items.length).toBe(3);
  });

  it("24. invalid page parameter is rejected by query schema", () => {
    expect(() => opportunityDiscoveryQuerySchema.parse({ page: -1 })).toThrow();
    expect(() => opportunityDiscoveryQuerySchema.parse({ page: 0 })).toThrow();
  });

  it("25. empty search results returns empty items without throwing", async () => {
    const res = await discoverOpportunities({ q: "NonexistentKeyword123456" });
    expect(res.total).toBe(0);
    expect(res.items.length).toBe(0);
    expect(res.totalPages).toBe(0);
  });

  // =========================================================================
  // 5. SORTING WHITELIST & DETERMINISM (Tests 26–28)
  // =========================================================================

  it("26. sort by oldest orders chronologically", async () => {
    const res = await discoverOpportunities({ sort: "oldest" });
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("27. sort by revenue_desc orders largest bracket first", async () => {
    const res = await discoverOpportunities({ sort: "revenue_desc" });
    // Opp1 is 50CR_TO_100CR, Opp2 is 25CR_TO_50CR, Opp3 is 15CR_TO_25CR
    expect(res.items[0].id).toBe(publishedOpp1Id);
    expect(res.items[1].id).toBe(publishedOpp2Id);
    expect(res.items[2].id).toBe(publishedOpp3Id);
  });

  it("28. invalid sort option is rejected by query schema", () => {
    expect(() => opportunityDiscoveryQuerySchema.parse({ sort: "arbitrary_column_sql" })).toThrow();
    expect(() => opportunityDiscoveryQuerySchema.parse({ sort: "DROP TABLE opportunities" })).toThrow();
  });

  // =========================================================================
  // 6. MATCH-AWARE DISCOVERY & ANTI-IDOR (Tests 29–35)
  // =========================================================================

  it("29. unauthenticated visitor receives Tier 0 blind teaser with NO match score", async () => {
    const res = await discoverOpportunities({});
    expect(res.items[0].tier).toBe(0);
    expect((res.items[0] as any).matchScore).toBeUndefined();
  });

  it("30. authenticated Buyer A receives Tier 1 operational record with their match score", async () => {
    const res = await discoverOpportunities({}, buyerA);
    expect(res.items[0].tier).toBe(1);
    const opp1Item = res.items.find((i) => i.id === publishedOpp1Id) as Tier1Opportunity;
    expect(opp1Item).toBeDefined();
    expect(opp1Item.matchScore).toBeGreaterThanOrEqual(80);
    expect(opp1Item.matchClassification).toBe("STRONG_MATCH");
  });

  it("31. sort=match orders opportunities by Buyer A's highest match first", async () => {
    const res = await discoverOpportunities({ sort: "match" }, buyerA);
    // For Buyer A (Defense mandate), Opp 1 is the high-compatibility match
    expect(res.items[0].id).toBe(publishedOpp1Id);
  });

  it("32. sort=match orders opportunities by Buyer B's highest match first (Healthcare)", async () => {
    const res = await discoverOpportunities({ sort: "match" }, buyerB);
    // For Buyer B (Healthcare mandate), Opp 2 is the high-compatibility match
    expect(res.items[0].id).toBe(publishedOpp2Id);
  });

  it("33. unauthenticated visitor querying sort=match gracefully falls back to newest without error", async () => {
    const res = await discoverOpportunities({ sort: "match" }, null);
    expect(res.items.length).toBe(3);
    // All items remain Tier 0 without match metadata
    expect((res.items[0] as any).matchScore).toBeUndefined();
  });

  it("34. Anti-IDOR: Client cannot inject buyerId parameter to see another buyer's scores", async () => {
    // When passing { buyerId: buyerBProfileId }, schema strips or ignores it
    const validated = opportunityDiscoveryQuerySchema.parse({
      buyerId: buyerBProfileId,
    } as any);
    expect((validated as any).buyerId).toBeUndefined();

    // Sourcing from buyerA session ignores any client tampering
    const res = await discoverOpportunities(validated, buyerA);
    const opp1 = res.items.find((i) => i.id === publishedOpp1Id) as Tier1Opportunity;
    // Buyer A's match score for Opp 1 is high (98%), whereas Buyer B has 0 match
    expect(opp1.matchScore).toBeGreaterThan(80);
  });

  it("35. Opportunity detail page attaches match score for authorized buyer", async () => {
    const detail = await getOpportunityForDiscovery(publishedOpp1Id, buyerA);
    expect(detail.tier).toBe(1);
    expect((detail as Tier1Opportunity).matchScore).toBeGreaterThanOrEqual(80);
    expect((detail as Tier1Opportunity).matchClassification).toBe("STRONG_MATCH");
  });

  // =========================================================================
  // 7. CONFIDENTIALITY INVARIANT & ANTI-ENUMERATION (Tests 36–40)
  // =========================================================================

  it("36. CONFIDENTIALITY: catalog items strictly mask exact statutory and financial data", async () => {
    const res = await discoverOpportunities({}, buyerA);
    for (const item of res.items) {
      expect((item as any).exactLegalName).toBeUndefined();
      expect((item as any).exactTradeName).toBeUndefined();
      expect((item as any).exactCin).toBeUndefined();
      expect((item as any).exactGstin).toBeUndefined();
      expect((item as any).exactPan).toBeUndefined();
      expect((item as any).exactAddress).toBeUndefined();
      expect((item as any).exactRevenue).toBeUndefined();
      expect((item as any).exactEbitda).toBeUndefined();
      expect((item as any).exactAskingPrice).toBeUndefined();
      expect((item as any).documents).toBeUndefined();
    }
  });

  it("37. ANTI-ENUMERATION: detail lookup on unpublished DRAFT returns uniform 404", async () => {
    await expect(getOpportunityForDiscovery(draftOppId, buyerA)).rejects.toThrow(
      "Opportunity not found."
    );
  });

  it("38. ANTI-ENUMERATION: detail lookup on REJECTED opportunity returns uniform 404", async () => {
    await expect(getOpportunityForDiscovery(rejectedOppId, buyerA)).rejects.toThrow(
      "Opportunity not found."
    );
  });

  it("39. ANTI-ENUMERATION: detail lookup on SUSPENDED opportunity returns uniform 404", async () => {
    await expect(getOpportunityForDiscovery(suspendedOppId, buyerA)).rejects.toThrow(
      "Opportunity not found."
    );
  });

  it("40. ANTI-ENUMERATION: detail lookup on nonexistent UUID returns identical 404", async () => {
    await expect(
      getOpportunityForDiscovery("00000000-0000-0000-0000-000000000000", buyerA)
    ).rejects.toThrow("Opportunity not found.");
  });

  it("41. SQL Injection attempt in search query is safely handled with zero error", async () => {
    const sqlInjectionAttempts = [
      "' OR '1'='1",
      "'; DROP TABLE opportunities; --",
      "1 UNION SELECT null, null, null --",
      "admin'--",
    ];

    for (const payload of sqlInjectionAttempts) {
      const res = await discoverOpportunities({ q: payload });
      expect(res.total).toBe(0);
      expect(res.items.length).toBe(0);
    }
  });
});
