import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { createOpportunity, getSellerOpportunityById } from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";
import { ValidationError, ForbiddenError } from "@/lib/errors";

describe("Phase 4: Opportunity Creation & Reference Generation", () => {
  let sellerUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const reg = await registerUser({
      email: "promoter@apexvalves.in",
      firstName: "Rajesh",
      lastName: "Sharma",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = reg.user;
  });

  it("creates a new business opportunity draft with an auto-generated institutional reference code", async () => {
    const opp = await createOpportunity(sellerUser, {
      title: "Specialized Precision Auto-Components Manufacturer in Western India",
      teaserSummary: "Established Tier-1 automotive OEM supplier with 20+ years of operational history and high EBITDA margins.",
      businessCategory: "MANUFACTURING",
      industry: "Automotive Components",
      subSector: "Precision Machining & Castings",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "OVER_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });

    expect(opp.id).toBeDefined();
    expect(opp.referenceCode).toMatch(/^OPP-\d{4}-\d{4}$/);
    expect(opp.status).toBe("DRAFT");
    expect(opp.tier).toBe(3); // Owner sees tier 3
    expect(opp.title).toBe("Specialized Precision Auto-Components Manufacturer in Western India");
  });

  it("stores confidential underlying fields accessible only to the owner seller and administrators", async () => {
    const opp = await createOpportunity(sellerUser, {
      title: "High-Margin D2C Personal Care & Wellness Brand",
      teaserSummary: "Direct-to-consumer FMCG brand with omnichannel distribution across Tier-1 retail chains.",
      businessCategory: "CONSUMER_RETAIL",
      industry: "Consumer Goods",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Delhi",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "D2C",
      exactLegalName: "AyurVeda Consumer Products Pvt Ltd",
      exactCin: "U12345DL2018PTC123456",
      exactRevenue: 185000000,
      exactEbitda: 32000000,
      exactAskingPrice: 450000000,
    });

    expect(opp.exactLegalName).toBe("AyurVeda Consumer Products Pvt Ltd");
    expect(opp.exactCin).toBe("U12345DL2018PTC123456");
    expect(opp.exactRevenue).toBe(185000000);
    expect(opp.exactEbitda).toBe(32000000);
  });

  it("rejects creation when mandatory fields are missing or invalid", async () => {
    await expect(
      createOpportunity(sellerUser, {
        title: "Short", // Too short
        teaserSummary: "Too short teaser",
        businessCategory: "MANUFACTURING",
        industry: "Auto",
        operatingRegion: "WEST_INDIA",
        registeredState: "Maharashtra",
        approximateAgeBracket: "OVER_20_YRS",
        revenueBracket: "25CR_TO_50CR",
        transactionType: "FULL_ACQUISITION",
        businessModel: "B2B",
      } as any)
    ).rejects.toThrow();
  });
});
