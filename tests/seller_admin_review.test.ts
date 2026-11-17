import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  getOrCreateSellerProfile,
  updateSellerProfile,
  updateBusinessProfile,
  saveBusinessFinancials,
  saveBusinessOwnership,
  saveTransactionPreferences,
  submitSellerForVerification,
  listSellersForAdmin,
  executeAdminReviewAction,
  addSellerInternalNote,
  getSellerDossier,
} from "@/domains/seller/service";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 2: Seller Admin Review, State Machine & Internal Notes", () => {
  let sellerUser: AuthenticatedUser;
  let unauthorizedUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let sellerProfileId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Seller User
    const regSeller = await registerUser({
      email: "promoter@steelworks.in",
      firstName: "Deepak",
      lastName: "Singhal",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = regSeller.user;
    const profile = await getOrCreateSellerProfile(sellerUser);
    sellerProfileId = profile.id;

    // 2. Unauthorized Commercial User (Buyer)
    const regBuyer = await registerUser({
      email: "buyer@fund.in",
      firstName: "Karan",
      lastName: "Kapoor",
      password: "Password@123",
      roles: ["BUYER"],
    });
    unauthorizedUser = regBuyer.user;

    // 3. Admin User (Verification Manager)
    const regAdmin = await registerUser({
      email: "verifier@scaleupindia.co.in",
      firstName: "Verification",
      lastName: "Officer",
      password: "Password@123",
      roles: ["PROMOTER"], // Temp registered
    });
    adminUser = {
      ...regAdmin.user,
      roles: ["VERIFICATION_MANAGER"],
      permissions: [
        "sellers.read",
        "sellers.review",
        "sellers.verify",
        "profiles.verify",
        "documents.read_all",
      ],
      isInternal: true,
    };

    // Complete seller dossier
    await updateSellerProfile(sellerUser, {
      designation: "Chairman & Promoter",
      mobile: "+919876543210",
      email: "deepak@steelworks.in",
      preferredCommMethod: "IN_APP",
    });

    await updateBusinessProfile(sellerUser, {
      legalName: "Singhal Alloy & Steel Works Pvt Ltd",
      businessType: "PRIVATE_LIMITED",
      industry: "Metals & Mining",
      yearEstablished: 2008,
      registeredState: "Chhattisgarh",
      registeredCity: "Raipur",
      employeeCount: 220,
      businessDescription: "Integrated steel fabrication plant with continuous casting lines.",
    });

    await saveBusinessFinancials(sellerUser, [
      {
        financialYear: "2023-24",
        revenue: 850000000,
        ebitda: 110000000,
        pat: 72000000,
        netWorth: 340000000,
        debt: 120000000,
        assets: 460000000,
        liabilities: 120000000,
      },
    ]);

    await saveBusinessOwnership(sellerUser, [
      {
        ownerType: "INDIVIDUAL_PROMOTER",
        ownerName: "Deepak Singhal",
        ownershipPercentage: 100,
      },
    ]);

    await saveTransactionPreferences(sellerUser, {
      intents: ["FULL_SALE"],
      expectedValuation: 600000000,
    });
  });

  it("lists submitted sellers for admin inspection", async () => {
    // Before submission: status is DRAFT
    const listBefore = await listSellersForAdmin(adminUser, { status: "SUBMITTED" });
    expect(listBefore.total).toBe(0);

    // Submit profile
    await submitSellerForVerification(sellerUser);

    const listAfter = await listSellersForAdmin(adminUser, { status: "SUBMITTED" });
    expect(listAfter.total).toBe(1);
    expect(listAfter.items[0].businessName).toBe("Singhal Alloy & Steel Works Pvt Ltd");
  });

  it("enforces state machine transition from SUBMITTED to UNDER_REVIEW", async () => {
    await submitSellerForVerification(sellerUser);

    const underReviewProfile = await executeAdminReviewAction(
      sellerProfileId,
      "START_REVIEW",
      { notes: "Assigned for statutory and financial review" },
      adminUser
    );

    expect(underReviewProfile.onboardingStatus).toBe("UNDER_REVIEW");
    expect(underReviewProfile.assignedReviewerId).toBe(adminUser.id);
  });

  it("supports REQUEST_CHANGES and enables promoter to edit and resubmit", async () => {
    await submitSellerForVerification(sellerUser);
    await executeAdminReviewAction(
      sellerProfileId,
      "START_REVIEW",
      {},
      adminUser
    );

    // Admin requests changes
    const changesRequested = await executeAdminReviewAction(
      sellerProfileId,
      "REQUEST_CHANGES",
      { changesRequestedNotes: "Please upload audited Form 26AS matching latest turnover." },
      adminUser
    );

    expect(changesRequested.onboardingStatus).toBe("CHANGES_REQUESTED");
    expect(changesRequested.changesRequestedNotes).toContain("Form 26AS");

    // Promoter can now edit again
    await updateSellerProfile(sellerUser, {
      designation: "Promoter & Executive Chairman",
      mobile: "+919876543210",
      email: "deepak@steelworks.in",
      preferredCommMethod: "IN_APP",
    });

    // Promoter can resubmit
    const resubmitted = await submitSellerForVerification(sellerUser);
    expect(resubmitted.onboardingStatus).toBe("SUBMITTED");
  });

  it("enforces VERIFY transition and records verification timestamp and verifier", async () => {
    await submitSellerForVerification(sellerUser);
    await executeAdminReviewAction(
      sellerProfileId,
      "START_REVIEW",
      {},
      adminUser
    );

    const verified = await executeAdminReviewAction(
      sellerProfileId,
      "VERIFY",
      { notes: "CIN, audited balance sheets, and GST verified against MCA." },
      adminUser
    );

    expect(verified.onboardingStatus).toBe("VERIFIED");
    expect(verified.verifiedAt).not.toBeNull();
    expect(verified.verifiedBy).toBe(adminUser.id);
  });

  it("enforces REJECT transition with mandatory reason", async () => {
    await submitSellerForVerification(sellerUser);
    await executeAdminReviewAction(
      sellerProfileId,
      "START_REVIEW",
      {},
      adminUser
    );

    const rejected = await executeAdminReviewAction(
      sellerProfileId,
      "REJECT",
      { rejectionReason: "Severe discrepancies in statutory filings." },
      adminUser
    );

    expect(rejected.onboardingStatus).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Severe discrepancies in statutory filings.");
  });

  it("REJECTS invalid state transitions (e.g. attempting to verify a DRAFT profile)", async () => {
    // Current status is DRAFT (not submitted)
    await expect(
      executeAdminReviewAction(
        sellerProfileId,
        "VERIFY",
        { notes: "Attempting to verify draft directly" },
        adminUser
      )
    ).rejects.toThrow(ValidationError);
  });

  it("PREVENTS unauthorized commercial users from calling verification actions", async () => {
    await submitSellerForVerification(sellerUser);

    await expect(
      executeAdminReviewAction(
        sellerProfileId,
        "VERIFY",
        { notes: "Hacker attempt" },
        unauthorizedUser
      )
    ).rejects.toThrow(ForbiddenError);
  });

  it("maintains internal review notes that are NEVER exposed to the seller", async () => {
    // Admin adds internal note
    await addSellerInternalNote(
      sellerProfileId,
      {
        content: "CONFIDENTIAL: Checked MCA database. Company has no pending charge or litigation.",
        category: "COMPLIANCE",
      },
      adminUser
    );

    // 1. Admin dossier query CONTAINS internal notes
    const adminDossier = await getSellerDossier(sellerUser.id, adminUser);
    expect(adminDossier.internalNotes).toBeDefined();
    expect(adminDossier.internalNotes).toHaveLength(1);
    expect(adminDossier.internalNotes![0].content).toContain("CONFIDENTIAL");

    // 2. Seller dossier query DOES NOT expose internal notes
    const sellerDossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(sellerDossier.internalNotes).toBeUndefined();
  });
});

