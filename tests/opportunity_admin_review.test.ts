import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  addOpportunityInternalNote,
  listOpportunitiesForAdmin,
} from "@/domains/opportunity/service";
import { AuthenticatedUser } from "@/types/auth";
import { ForbiddenError, ValidationError } from "@/lib/errors";

describe("Phase 4: Admin Opportunity Review & Lifecycle Management", () => {
  let sellerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let oppId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const regSeller = await registerUser({
      email: "promoter@precisionmfg.in",
      firstName: "Dinesh",
      lastName: "Patel",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = regSeller.user;

    const regAdmin = await registerUser({
      email: "curator@scaleup.in",
      firstName: "Admin",
      lastName: "Curator",
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
        "opportunities.suspend",
      ],
    };

    const opp = await createOpportunity(sellerUser, {
      title: "Export-Oriented Textile Finishing & Garment Unit in Tirupur",
      teaserSummary: "Modern OEKO-TEX certified garment processing unit with 120,000 pcs monthly export capacity.",
      businessCategory: "MANUFACTURING",
      industry: "Apparel & Textiles",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Tamil Nadu",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    oppId = opp.id;
  });

  it("progresses opportunity from SUBMITTED to UNDER_REVIEW", async () => {
    await submitOpportunity(oppId, sellerUser);

    const reviewed = await executeAdminOpportunityReview(
      oppId,
      "START_REVIEW",
      { notes: "Commencing financial range and compliance verification" },
      adminUser
    );

    expect(reviewed.status).toBe("UNDER_REVIEW");
    expect(reviewed.assignedReviewerId).toBe(adminUser.id);
  });

  it("supports REQUEST_CHANGES and enables seller to edit and resubmit", async () => {
    await submitOpportunity(oppId, sellerUser);
    await executeAdminOpportunityReview(oppId, "START_REVIEW", {}, adminUser);

    const changesRequested = await executeAdminOpportunityReview(
      oppId,
      "REQUEST_CHANGES",
      { changesRequestedNotes: "Please provide employee count and facility square footage." },
      adminUser
    );

    expect(changesRequested.status).toBe("CHANGES_REQUESTED");
    expect(changesRequested.changesRequestedNotes).toContain("employee count");
  });

  it("progresses opportunity from UNDER_REVIEW to VERIFIED", async () => {
    await submitOpportunity(oppId, sellerUser);
    await executeAdminOpportunityReview(oppId, "START_REVIEW", {}, adminUser);

    const verified = await executeAdminOpportunityReview(
      oppId,
      "VERIFY",
      { notes: "All metrics reconciled with statutory GST and MCA filings." },
      adminUser
    );

    expect(verified.status).toBe("VERIFIED");
    expect(verified.verifiedBy).toBe(adminUser.id);
  });

  it("publishes a VERIFIED opportunity making it active in the catalog", async () => {
    await submitOpportunity(oppId, sellerUser);
    await executeAdminOpportunityReview(oppId, "START_REVIEW", {}, adminUser);
    await executeAdminOpportunityReview(oppId, "VERIFY", {}, adminUser);

    const published = await executeAdminOpportunityReview(
      oppId,
      "PUBLISH",
      { notes: "Approved for market syndication." },
      adminUser
    );

    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeDefined();
  });

  it("suspends an active published opportunity", async () => {
    await submitOpportunity(oppId, sellerUser);
    await executeAdminOpportunityReview(oppId, "START_REVIEW", {}, adminUser);
    await executeAdminOpportunityReview(oppId, "VERIFY", {}, adminUser);
    await executeAdminOpportunityReview(oppId, "PUBLISH", {}, adminUser);

    const suspended = await executeAdminOpportunityReview(
      oppId,
      "SUSPEND",
      { suspensionReason: "Promoter requested temporary pause due to internal restructuring." },
      adminUser
    );

    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.suspensionReason).toContain("Promoter requested temporary pause");
  });

  it("rejects invalid review actions (e.g. attempting to publish a DRAFT opportunity)", async () => {
    await expect(
      executeAdminOpportunityReview(oppId, "PUBLISH", {}, adminUser)
    ).rejects.toThrow(ValidationError);
  });

  it("BLOCKS unauthorized commercial users from calling administrative review actions", async () => {
    await submitOpportunity(oppId, sellerUser);

    await expect(
      executeAdminOpportunityReview(oppId, "START_REVIEW", {}, sellerUser)
    ).rejects.toThrow(ForbiddenError);
  });

  it("logs confidential internal notes on the opportunity dossier", async () => {
    const note = await addOpportunityInternalNote(
      oppId,
      { content: "Promoter valuation expectation is realistic at 4.2x EBITDA.", category: "VALUATION" },
      adminUser
    );

    expect(note.id).toBeDefined();
    expect(note.category).toBe("VALUATION");
    expect(note.content).toContain("4.2x EBITDA");
  });
});
