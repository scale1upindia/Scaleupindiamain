import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";
import { ValidationError } from "@/lib/errors";

describe("Phase 4: Opportunity State Machine Invariants", () => {
  let seller: AuthenticatedUser;
  let admin: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const regSeller = await registerUser({
      email: "promoter@pharma.in",
      firstName: "Amit",
      lastName: "Verma",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller = regSeller.user;

    const regAdmin = await registerUser({
      email: "admin@scaleup.in",
      firstName: "Admin",
      lastName: "Officer",
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
        "opportunities.suspend",
      ],
    };
  });

  it("completes full legitimate lifecycle: DRAFT -> SUBMITTED -> UNDER_REVIEW -> VERIFIED -> PUBLISHED -> UNPUBLISHED", async () => {
    const opp = await createOpportunity(seller, {
      title: "WHO-GMP Formulations Unit in Baddi Industrial Corridor",
      teaserSummary: "Formulations unit with tableting, capsule, and liquid oral lines serving leading domestic pharma brands.",
      businessCategory: "HEALTHCARE",
      industry: "Pharmaceuticals",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Himachal Pradesh",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "CONTRACT_MANUFACTURING",
    });
    expect(opp.status).toBe("DRAFT");

    // 1. Submit
    const s1 = await submitOpportunity(opp.id, seller);
    expect(s1.status).toBe("SUBMITTED");

    // 2. Start Review
    const s2 = await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);
    expect(s2.status).toBe("UNDER_REVIEW");

    // 3. Verify
    const s3 = await executeAdminOpportunityReview(opp.id, "VERIFY", {}, admin);
    expect(s3.status).toBe("VERIFIED");

    // 4. Publish
    const s4 = await executeAdminOpportunityReview(opp.id, "PUBLISH", {}, admin);
    expect(s4.status).toBe("PUBLISHED");

    // 5. Unpublish (reverts to VERIFIED)
    const s5 = await executeAdminOpportunityReview(opp.id, "UNPUBLISH", {}, admin);
    expect(s5.status).toBe("VERIFIED");
  });

  it("handles rejection with mandatory reason requirement", async () => {
    const opp = await createOpportunity(seller, {
      title: "Legacy Sugar Mill Undertaking in Uttar Pradesh",
      teaserSummary: "Operational crushing mill with 2,500 TCD capacity and co-gen power facility.",
      businessCategory: "MANUFACTURING",
      industry: "Agro Processing",
      operatingRegion: "NORTH_INDIA",
      registeredState: "Uttar Pradesh",
      approximateAgeBracket: "OVER_20_YRS",
      revenueBracket: "100CR_TO_250CR",
      transactionType: "ASSET_SALE",
      businessModel: "B2B",
    });

    await submitOpportunity(opp.id, seller);
    await executeAdminOpportunityReview(opp.id, "START_REVIEW", {}, admin);

    // Reject without reason must fail
    await expect(
      executeAdminOpportunityReview(opp.id, "REJECT", {}, admin)
    ).rejects.toThrow(ValidationError);

    // Reject with reason succeeds
    const rejected = await executeAdminOpportunityReview(
      opp.id,
      "REJECT",
      { rejectionReason: "Active insolvency dispute prevents legal asset transfer." },
      admin
    );
    expect(rejected.status).toBe("REJECTED");
  });
});
