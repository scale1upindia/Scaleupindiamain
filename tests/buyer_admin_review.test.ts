import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  getOrCreateBuyerProfile,
  updateBuyerProfile,
  createAcquisitionMandate,
  submitBuyerForVerification,
  listBuyersForAdmin,
  executeAdminBuyerReviewAction,
  addBuyerInternalNote,
  getBuyerDossier,
} from "@/domains/buyer/service";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 3: Buyer Admin Review, State Machine & Internal Notes", () => {
  let buyerUser: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // Register Buyer
    const regBuyer = await registerUser({
      email: "promoter.buyer@fund.in",
      firstName: "Aditya",
      lastName: "Singhal",
      password: "Password@123",
      roles: ["BUYER", "INVESTOR"],
    });
    buyerUser = regBuyer.user;

    // Register Admin
    const regAdmin = await registerUser({
      email: "verification.desk@scaleup.in",
      firstName: "Verification",
      lastName: "Officer",
      password: "Password@123",
      roles: ["BUYER"],
    });
    adminUser = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "buyers.read",
        "buyers.review",
        "buyers.verify",
        "buyers.suspend",
        "documents.read_all",
      ],
      isInternal: true,
    };

    // Setup complete buyer profile
    await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Singhal Industrial Group",
      entityType: "COMPANY",
      state: "Karnataka",
      city: "Bengaluru",
      contactName: "Aditya Singhal",
      designation: "Managing Director",
      email: "aditya@singhalgroup.in",
      phone: "+919845012345",
    });

    // Create Mandate
    await createAcquisitionMandate(buyerUser, {
      name: "Engineering Ancillary Buyout",
      minInvestment: 150000000,
      maxInvestment: 400000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["CAPACITY_EXPANSION"],
      targetIndustries: [{ industry: "Manufacturing" }],
      targetGeographies: [{ region: "SOUTH_INDIA" }],
    });
  });

  it("lists submitted buyers for admin inspection with search and pagination", async () => {
    await submitBuyerForVerification(buyerUser);

    const result = await listBuyersForAdmin(adminUser, {
      search: "Singhal",
      status: "SUBMITTED",
      page: 1,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].legalName).toBe("Singhal Industrial Group");
    expect(result.items[0].mandateCount).toBe(1);
    expect(result.items[0].onboardingStatus).toBe("SUBMITTED");
  });

  it("enforces state machine transition from SUBMITTED to UNDER_REVIEW", async () => {
    await submitBuyerForVerification(buyerUser);
    const profile = await getOrCreateBuyerProfile(buyerUser);

    const updated = await executeAdminBuyerReviewAction(
      profile.id,
      "START_REVIEW",
      { notes: "Initial statutory review begun." },
      adminUser
    );

    expect(updated.onboardingStatus).toBe("UNDER_REVIEW");
    expect(updated.assignedReviewerId).toBe(adminUser.id);
  });

  it("supports REQUEST_CHANGES and enables buyer to edit and resubmit", async () => {
    await submitBuyerForVerification(buyerUser);
    const profile = await getOrCreateBuyerProfile(buyerUser);

    await executeAdminBuyerReviewAction(
      profile.id,
      "START_REVIEW",
      {},
      adminUser
    );

    const changes = await executeAdminBuyerReviewAction(
      profile.id,
      "REQUEST_CHANGES",
      { changesRequestedNotes: "Please upload certificate of incorporation and latest bank solvency letter." },
      adminUser
    );

    expect(changes.onboardingStatus).toBe("CHANGES_REQUESTED");
    expect(changes.changesRequestedNotes).toContain("Please upload certificate");

    // Buyer should now be able to edit again
    const reUpdated = await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Singhal Industrial Group Limited",
      entityType: "COMPANY",
      state: "Karnataka",
      city: "Bengaluru",
      contactName: "Aditya Singhal",
      designation: "Managing Director",
      email: "aditya@singhalgroup.in",
      phone: "+919845012345",
    });
    expect(reUpdated.legalName).toBe("Singhal Industrial Group Limited");

    // Buyer resubmits
    const resubmitted = await submitBuyerForVerification(buyerUser);
    expect(resubmitted.onboardingStatus).toBe("SUBMITTED");
  });

  it("enforces VERIFY transition and records verified timestamp and verifier", async () => {
    await submitBuyerForVerification(buyerUser);
    const profile = await getOrCreateBuyerProfile(buyerUser);

    await executeAdminBuyerReviewAction(profile.id, "START_REVIEW", {}, adminUser);

    const verified = await executeAdminBuyerReviewAction(
      profile.id,
      "VERIFY",
      { notes: "Diligence and capital solvency confirmed." },
      adminUser
    );

    expect(verified.onboardingStatus).toBe("VERIFIED");
    expect(verified.verifiedAt).not.toBeNull();
    expect(verified.verifiedBy).toBe(adminUser.id);
  });

  it("enforces REJECT transition with mandatory reason", async () => {
    await submitBuyerForVerification(buyerUser);
    const profile = await getOrCreateBuyerProfile(buyerUser);

    // Rejection without reason must fail
    await expect(
      executeAdminBuyerReviewAction(profile.id, "REJECT", {}, adminUser)
    ).rejects.toThrow(/Rejection reason is mandatory/i);

    const rejected = await executeAdminBuyerReviewAction(
      profile.id,
      "REJECT",
      { rejectionReason: "Entity failed statutory compliance check." },
      adminUser
    );

    expect(rejected.onboardingStatus).toBe("REJECTED");
    expect(rejected.rejectionReason).toBe("Entity failed statutory compliance check.");
  });

  it("enforces SUSPEND transition and freezes active mandates", async () => {
    await submitBuyerForVerification(buyerUser);
    const profile = await getOrCreateBuyerProfile(buyerUser);

    const suspended = await executeAdminBuyerReviewAction(
      profile.id,
      "SUSPEND",
      { suspensionReason: "Sanctions & AML flag raised." },
      adminUser
    );

    expect(suspended.onboardingStatus).toBe("SUSPENDED");
    expect(suspended.suspensionReason).toBe("Sanctions & AML flag raised.");

    // Verify mandates were frozen to 'PAUSED'
    const dossier = await getBuyerDossier(buyerUser.id, adminUser);
    expect(dossier.mandates[0].status).toBe("PAUSED");
  });

  it("REJECTS invalid state transitions (e.g. attempting to verify a DRAFT profile)", async () => {
    const profile = await getOrCreateBuyerProfile(buyerUser);
    // Currently in DRAFT
    await expect(
      executeAdminBuyerReviewAction(profile.id, "VERIFY", {}, adminUser)
    ).rejects.toThrow(/Cannot verify buyer in \[DRAFT\] status/i);
  });

  it("maintains internal review notes that are NEVER exposed to the buyer", async () => {
    const profile = await getOrCreateBuyerProfile(buyerUser);

    // Admin logs internal diligence remarks
    await addBuyerInternalNote(
      profile.id,
      {
        content: "Internal Note: Acquirer has ₹50Cr active credit line with SBI confirmed by relationship manager.",
        category: "FINANCIAL",
      },
      adminUser
    );

    // Admin inspection includes internal notes
    const adminDossier = await getBuyerDossier(buyerUser.id, adminUser);
    expect(adminDossier.internalNotes).toBeDefined();
    expect(adminDossier.internalNotes).toHaveLength(1);
    expect(adminDossier.internalNotes![0].content).toContain("SBI confirmed");

    // Buyer inspection MUST NOT contain internal notes
    const buyerDossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(buyerDossier.internalNotes).toBeUndefined();
  });
});
