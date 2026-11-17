import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  discoverOpportunities,
} from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 4: Opportunity Discovery & Deterministic Filtering", () => {
  let seller: AuthenticatedUser;
  let admin: AuthenticatedUser;
  let buyer: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const regSeller = await registerUser({
      email: "promoter@enterprise.in",
      firstName: "Ramesh",
      lastName: "Gupta",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller = regSeller.user;

    const regAdmin = await registerUser({
      email: "admin@scaleup.in",
      firstName: "Admin",
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

    const regBuyer = await registerUser({
      email: "investor@capital.in",
      firstName: "Sanjay",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer = regBuyer.user;

    // Create 3 opportunities:
    // Opp 1: Auto Mfg in West India (PUBLISHED)
    const opp1 = await createOpportunity(seller, {
      title: "Tier-1 Automotive Die Casting Facility in Pune",
      teaserSummary: "High pressure aluminium die casting unit serving major two-wheeler and commercial vehicle manufacturers.",
      businessCategory: "MANUFACTURING",
      industry: "Automotive Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    await submitOpportunity(opp1.id, seller);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);

    // Opp 2: Healthcare Diagnostic Chain in South India (PUBLISHED)
    const opp2 = await createOpportunity(seller, {
      title: "Network of NABL Accredited Pathology Labs in Bengaluru",
      teaserSummary: "Established diagnostic lab chain with 14 collection centres and automated clinical chemistry analyzers.",
      businessCategory: "HEALTHCARE",
      industry: "Healthcare & Diagnostics",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "B2C",
    });
    await submitOpportunity(opp2.id, seller);
    await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);

    // Opp 3: SaaS Platform (DRAFT - NOT published)
    await createOpportunity(seller, {
      title: "Enterprise Logistics SaaS Platform (DRAFT)",
      teaserSummary: "Cloud TMS and route optimization platform with ARR of 4.5Cr.",
      businessCategory: "TECHNOLOGY",
      industry: "Enterprise Software",
      operatingRegion: "PAN_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "3_TO_5_YRS",
      revenueBracket: "UNDER_5CR",
      transactionType: "STRATEGIC_PARTNERSHIP",
      businessModel: "SAAS",
    });
  });

  it("discovers only PUBLISHED opportunities, strictly excluding drafts and unpublished listings", async () => {
    const res = await discoverOpportunities({ page: 1, limit: 10 });
    expect(res.total).toBe(2); // Only Opp 1 and Opp 2
    expect(res.items.some((i) => i.title.includes("Die Casting"))).toBe(true);
    expect(res.items.some((i) => i.title.includes("Pathology Labs"))).toBe(true);
    expect(res.items.some((i) => i.title.includes("DRAFT"))).toBe(false);
  });

  it("filters deterministically by industry", async () => {
    const res = await discoverOpportunities({ industry: "Automotive Components", page: 1, limit: 10 });
    expect(res.total).toBe(1);
    expect(res.items[0].industry).toBe("Automotive Components");
  });

  it("filters deterministically by operating region", async () => {
    const res = await discoverOpportunities({ region: "SOUTH_INDIA", page: 1, limit: 10 });
    expect(res.total).toBe(1);
    expect(res.items[0].operatingRegion).toBe("SOUTH_INDIA");
  });

  it("searches across titles and summaries", async () => {
    const res = await discoverOpportunities({ search: "Pathology", page: 1, limit: 10 });
    expect(res.total).toBe(1);
    expect(res.items[0].title).toContain("Pathology");
  });
});
