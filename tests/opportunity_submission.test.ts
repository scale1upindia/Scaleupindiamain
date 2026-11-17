import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { createOpportunity, submitOpportunity } from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";
import { ValidationError } from "@/lib/errors";

describe("Phase 4: Opportunity Submission Gates", () => {
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

  it("submits a completed opportunity draft and sets status to SUBMITTED", async () => {
    const opp = await createOpportunity(sellerUser, {
      title: "Profitable Specialty Chemicals Manufacturer",
      teaserSummary: "ISO 9001 certified specialty chemical formulation unit catering to agrochemical and pharmaceutical clients.",
      businessCategory: "MANUFACTURING",
      industry: "Specialty Chemicals",
      operatingRegion: "WEST_INDIA",
      registeredState: "Gujarat",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });

    const submitted = await submitOpportunity(opp.id, sellerUser);
    expect(submitted.status).toBe("SUBMITTED");
  });

  it("rejects resubmitting an opportunity already under active review", async () => {
    const opp = await createOpportunity(sellerUser, {
      title: "Commercial Cold Storage Chain in Central India",
      teaserSummary: "Modern multi-commodity cold chain network with 15,000 MT capacity across key agricultural hubs.",
      businessCategory: "LOGISTICS",
      industry: "Cold Storage & Logistics",
      operatingRegion: "CENTRAL_INDIA",
      registeredState: "Madhya Pradesh",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "STRATEGIC_PARTNERSHIP",
      businessModel: "B2B",
    });

    await submitOpportunity(opp.id, sellerUser);

    await expect(submitOpportunity(opp.id, sellerUser)).rejects.toThrow(ValidationError);
  });
});
