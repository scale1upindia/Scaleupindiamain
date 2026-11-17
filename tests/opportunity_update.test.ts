import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { createOpportunity, updateOpportunity, submitOpportunity } from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";
import { ForbiddenError } from "@/lib/errors";

describe("Phase 4: Opportunity Update & Invariant Locks", () => {
  let sellerUser: AuthenticatedUser;
  let opportunityId: string;

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

    const opp = await createOpportunity(sellerUser, {
      title: "Specialized Precision Auto-Components Manufacturer",
      teaserSummary: "Established Tier-1 automotive OEM supplier with 20+ years of operational history.",
      businessCategory: "MANUFACTURING",
      industry: "Automotive Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "OVER_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    opportunityId = opp.id;
  });

  it("updates whitelisted draft fields successfully", async () => {
    const updated = await updateOpportunity(opportunityId, sellerUser, {
      headline: "Profitable CNC machining undertaking with prime MIDC industrial land",
      detailedDescription: "Full precision manufacturing facility equipped with 18 CNC machines and long-term supply agreements.",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      employeeRange: "51_TO_200",
    });

    expect(updated.headline).toBe("Profitable CNC machining undertaking with prime MIDC industrial land");
    expect(updated.detailedDescription).toContain("Full precision manufacturing facility");
    expect(updated.employeeRange).toBe("51_TO_200");
  });

  it("locks opportunity modifications once submitted for platform review", async () => {
    await submitOpportunity(opportunityId, sellerUser);

    await expect(
      updateOpportunity(opportunityId, sellerUser, {
        title: "Attempting to change title after submission",
      })
    ).rejects.toThrow(ForbiddenError);
  });
});
