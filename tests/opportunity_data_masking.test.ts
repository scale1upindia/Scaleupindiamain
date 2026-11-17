import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  getOpportunityForDiscovery,
} from "@/domains/opportunity/service";
import { uploadOpportunityDocument } from "@/domains/documents/service";
import { AuthenticatedUser } from "@/types/auth";
import { Tier0Opportunity, Tier1Opportunity, Tier2Opportunity, Tier3Opportunity } from "@/types/opportunity";

describe("Phase 4: Progressive Data Masking (Tier 0 to Tier 3)", () => {
  let sellerUser: AuthenticatedUser;
  let buyerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let oppId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // Seller
    const regSeller = await registerUser({
      email: "promoter@apexvalves.in",
      firstName: "Rajesh",
      lastName: "Sharma",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = regSeller.user;

    // Buyer
    const regBuyer = await registerUser({
      email: "acquisitions@tata.com",
      firstName: "Karan",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerUser = regBuyer.user;

    // Admin
    const regAdmin = await registerUser({
      email: "admin@scaleup.in",
      firstName: "Chief",
      lastName: "Compliance",
      password: "Password@123",
      roles: ["BUYER"],
    });
    adminUser = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "opportunities.read_all",
        "opportunities.review",
        "opportunities.verify",
        "opportunities.publish",
      ],
    };

    // Create and Publish Opportunity
    const opp = await createOpportunity(sellerUser, {
      title: "Specialized Precision Auto-Components Manufacturer in Western India",
      headline: "Established Tier-1 supplier with 20+ years of operational history",
      teaserSummary: "High-precision components supplier catering to automotive and heavy equipment OEMs.",
      businessCategory: "MANUFACTURING",
      industry: "Automotive Components",
      subSector: "Precision Machining & Castings",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      registeredCity: "Pune", // Confidential city
      approximateAgeBracket: "OVER_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",

      // Tier 1 Authenticated Fields
      detailedDescription: "State-of-the-art manufacturing plant with 25 CNC and VMC machines operating across two shifts.",
      businessModel: "CONTRACT_MANUFACTURING",
      yearEstablished: 1998,
      employeeRange: "51_TO_200",
      customerScale: "40+ active OEM clients",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      growthRateBracket: "10_TO_25_PCT",
      facilityDetails: "45,000 sq ft industrial shed in Chakan MIDC",
      stakeOfferedPercentage: 100,
      promoterRetentionPreference: "1_YEAR_TRANSITION",
      reasonForSale: "Retirement and succession planning",
      transactionObjective: "100% buyout by strategic enterprise",

      // Confidential Underlying Fields
      exactLegalName: "Apex High Precision Engineering Pvt Ltd",
      exactCin: "U29299MH1998PTC123456",
      exactGstin: "27AABCA1234F1Z5",
      exactPan: "AABCA1234F",
      exactAddress: "Plot 42, Sector 10, MIDC Chakan, Pune, Maharashtra 410501",
      exactRevenue: 385000000,
      exactEbitda: 62000000,
      exactAskingPrice: 420000000,
    });
    oppId = opp.id;

    // Upload an opportunity document
    const dummyPdf = Buffer.from("%PDF-1.4 sample teaser deck");
    await uploadOpportunityDocument(oppId, sellerUser, {
      originalFilename: "teaser_overview.pdf",
      mimeType: "application/pdf",
      buffer: dummyPdf,
      documentType: "TEASER_DECK",
      accessTier: 2,
    });

    // Advance to PUBLISHED
    await submitOpportunity(oppId, sellerUser);
    await executeAdminOpportunityReview(oppId, "START_REVIEW", {}, adminUser);
    await executeAdminOpportunityReview(oppId, "VERIFY", {}, adminUser);
    await executeAdminOpportunityReview(oppId, "PUBLISH", {}, adminUser);
  });

  it("TIER 0 (Public / Unauthenticated): Strictly masks company name, promoter, exact financials, documents, and city", async () => {
    // Unauthenticated request (user is null)
    const result = (await getOpportunityForDiscovery(oppId, null)) as Tier0Opportunity;

    expect(result.tier).toBe(0);
    expect(result.referenceCode).toMatch(/^OPP-/);
    expect(result.title).toBe("Specialized Precision Auto-Components Manufacturer in Western India");
    expect(result.industry).toBe("Automotive Components");
    expect(result.operatingRegion).toBe("WEST_INDIA");
    expect(result.registeredState).toBe("Maharashtra");
    expect(result.revenueBracket).toBe("25CR_TO_50CR");
    expect(result.transactionType).toBe("FULL_ACQUISITION");

    // CRITICAL: Confidential fields MUST NOT EXIST in the returned object
    expect((result as any).exactLegalName).toBeUndefined();
    expect((result as any).exactCin).toBeUndefined();
    expect((result as any).exactGstin).toBeUndefined();
    expect((result as any).exactPan).toBeUndefined();
    expect((result as any).exactAddress).toBeUndefined();
    expect((result as any).exactRevenue).toBeUndefined();
    expect((result as any).exactEbitda).toBeUndefined();
    expect((result as any).exactAskingPrice).toBeUndefined();
    expect((result as any).registeredCity).toBeUndefined();
    expect((result as any).documents).toBeUndefined();
    expect((result as any).detailedDescription).toBeUndefined();
    expect((result as any).employeeRange).toBeUndefined();
  });

  it("TIER 1 (Authenticated Buyer): Discloses structured operational scale, but STILL strictly masks company identity and exact ledgers", async () => {
    // Authenticated Buyer request
    const result = (await getOpportunityForDiscovery(oppId, buyerUser)) as Tier1Opportunity;

    expect(result.tier).toBe(1);
    expect(result.title).toBe("Specialized Precision Auto-Components Manufacturer in Western India");

    // Tier 1 fields ARE visible
    expect(result.detailedDescription).toContain("State-of-the-art manufacturing plant");
    expect(result.businessModel).toBe("CONTRACT_MANUFACTURING");
    expect(result.employeeRange).toBe("51_TO_200");
    expect(result.customerScale).toBe("40+ active OEM clients");
    expect(result.askingPriceBracket).toBe("25CR_TO_50CR");
    expect(result.facilityDetails).toContain("Chakan MIDC");

    // CRITICAL: Confidential identity and exact numbers are STILL strictly undefined
    expect((result as any).exactLegalName).toBeUndefined();
    expect((result as any).exactCin).toBeUndefined();
    expect((result as any).exactGstin).toBeUndefined();
    expect((result as any).exactPan).toBeUndefined();
    expect((result as any).exactAddress).toBeUndefined();
    expect((result as any).exactRevenue).toBeUndefined();
    expect((result as any).exactEbitda).toBeUndefined();
    expect((result as any).registeredCity).toBeUndefined();
    expect((result as any).documents).toBeUndefined();
  });

  it("TIER 2 (Authorized Buyer with workflow grant): Unlocks registered city and approved documents", async () => {
    // Grant Tier 2 access to buyerUser
    await query(
      `INSERT INTO opportunity_access_grants (opportunity_id, buyer_user_id, granted_tier)
       VALUES ($1, $2, 2)`,
      [oppId, buyerUser.id]
    );

    const result = (await getOpportunityForDiscovery(oppId, buyerUser)) as Tier2Opportunity;

    expect(result.tier).toBe(2);
    expect(result.registeredCity).toBe("Pune");
    expect(result.documents).toBeDefined();
    expect(result.documents!.length).toBe(1);
    expect(result.documents![0].originalFilename).toBe("teaser_overview.pdf");

    // Still masks exact legal name and tax IDs
    expect((result as any).exactLegalName).toBeUndefined();
    expect((result as any).exactCin).toBeUndefined();
  });

  it("TIER 3 (Owner Seller & Admin): Full unmasked confidential access", async () => {
    // Owner request
    const ownerResult = (await getOpportunityForDiscovery(oppId, sellerUser)) as Tier3Opportunity;
    expect(ownerResult.tier).toBe(3);
    expect(ownerResult.exactLegalName).toBe("Apex High Precision Engineering Pvt Ltd");
    expect(ownerResult.exactCin).toBe("U29299MH1998PTC123456");
    expect(ownerResult.exactRevenue).toBe(385000000);
    expect(ownerResult.exactEbitda).toBe(62000000);

    // Admin request
    const adminResult = (await getOpportunityForDiscovery(oppId, adminUser)) as Tier3Opportunity;
    expect(adminResult.tier).toBe(3);
    expect(adminResult.exactLegalName).toBe("Apex High Precision Engineering Pvt Ltd");
    expect(adminResult.exactRevenue).toBe(385000000);
  });
});
