import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  getOrCreateSellerProfile,
  getSellerDossier,
  updateSellerProfile,
  updateBusinessProfile,
  saveBusinessFinancials,
  saveBusinessOwnership,
  saveTransactionPreferences,
  saveDraftProgress,
  submitSellerForVerification,
} from "@/domains/seller/service";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 2: Seller Onboarding & Business Profiling", () => {
  let sellerUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const reg = await registerUser({
      email: "promoter@manufacturing.in",
      firstName: "Rajesh",
      lastName: "Agarwal",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerUser = reg.user;
  });

  it("initializes a draft seller profile and onboarding progress record on first visit", async () => {
    const profile = await getOrCreateSellerProfile(sellerUser);
    expect(profile).toBeDefined();
    expect(profile.userId).toBe(sellerUser.id);
    expect(profile.onboardingStatus).toBe("DRAFT");
    expect(profile.completionPercentage).toBe(0);

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.profile.id).toBe(profile.id);
    expect(dossier.business).toBeNull();
    expect(dossier.financials).toHaveLength(0);
    expect(dossier.ownership).toHaveLength(0);
    expect(dossier.transactionPreferences).toBeNull();
  });

  it("updates promoter profile and marks 'promoter' section complete", async () => {
    const updated = await updateSellerProfile(sellerUser, {
      designation: "Managing Director & Founder",
      mobile: "+919876543210",
      email: "rajesh@agarwalind.in",
      preferredCommMethod: "EMAIL",
    });

    expect(updated.designation).toBe("Managing Director & Founder");
    expect(updated.email).toBe("rajesh@agarwalind.in");

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.sectionsCompleted).toContain("promoter");
    expect(dossier.profile.completionPercentage).toBeGreaterThanOrEqual(15);
  });

  it("persists business identity and overview data with validation", async () => {
    const biz = await updateBusinessProfile(sellerUser, {
      legalName: "Agarwal Precision Engineering Pvt Ltd",
      tradeName: "Agarwal Precision",
      businessType: "PRIVATE_LIMITED",
      cin: "U28910MH2012PTC234567",
      gstin: "27AAPFU0939F1ZV",
      pan: "AAPFU0939F",
      industry: "Manufacturing & Heavy Engineering",
      subSector: "Precision Auto Components",
      yearEstablished: 2012,
      registeredState: "Maharashtra",
      registeredCity: "Pune",
      operatingLocations: ["Pune", "Aurangabad"],
      employeeCount: 145,
      businessDescription:
        "Tier-1 precision auto component manufacturer supplying major commercial vehicle OEMs across Western India.",
      website: "https://agarwalprecision.in",
      msmeStatus: "MEDIUM",
      otherRegistrations: ["ISO 9001:2015", "IATF 16949"],
    });

    expect(biz.legalName).toBe("Agarwal Precision Engineering Pvt Ltd");
    expect(biz.cin).toBe("U28910MH2012PTC234567");
    expect(biz.employeeCount).toBe(145);

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.business).not.toBeNull();
    expect(dossier.sectionsCompleted).toContain("identity");
    expect(dossier.sectionsCompleted).toContain("overview");
  });

  it("saves multi-year financial profiles with normalized fields", async () => {
    const financials = await saveBusinessFinancials(sellerUser, [
      {
        financialYear: "2023-24",
        revenue: 425000000, // 42.5 Cr
        ebitda: 68000000,   // 6.8 Cr
        pat: 41000000,      // 4.1 Cr
        netWorth: 185000000,
        debt: 52000000,
        assets: 237000000,
        liabilities: 52000000,
        cashFlow: 35000000,
        isAudited: true,
      },
      {
        financialYear: "2022-23",
        revenue: 360000000,
        ebitda: 54000000,
        pat: 32000000,
        netWorth: 144000000,
        debt: 60000000,
        assets: 204000000,
        liabilities: 60000000,
        cashFlow: 28000000,
        isAudited: true,
      },
    ]);

    expect(financials).toHaveLength(2);
    expect(financials[0].financialYear).toBe("2023-24");
    expect(financials[0].revenue).toBe(425000000);

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.financials).toHaveLength(2);
    expect(dossier.sectionsCompleted).toContain("financials");
  });

  it("saves ownership cap table and prevents ownership percentage exceeding 100%", async () => {
    // Valid cap table (sum = 100%)
    const owners = await saveBusinessOwnership(sellerUser, [
      {
        ownerType: "INDIVIDUAL_PROMOTER",
        ownerName: "Rajesh Agarwal",
        ownershipPercentage: 70.0,
        role: "Promoter & MD",
        controlRights: "Full operational and voting control",
      },
      {
        ownerType: "INDIVIDUAL_PROMOTER",
        ownerName: "Sunita Agarwal",
        ownershipPercentage: 30.0,
        role: "Director",
        controlRights: "Equal board representation",
      },
    ]);

    expect(owners).toHaveLength(2);

    // Invalid cap table (sum = 105% -> must fail validation)
    await expect(
      saveBusinessOwnership(sellerUser, [
        {
          ownerType: "INDIVIDUAL_PROMOTER",
          ownerName: "Rajesh Agarwal",
          ownershipPercentage: 80.0,
        },
        {
          ownerType: "INDIVIDUAL_PROMOTER",
          ownerName: "Sunita Agarwal",
          ownershipPercentage: 25.0,
        },
      ])
    ).rejects.toThrow(ValidationError);
  });

  it("saves transaction preferences with commercial requirements", async () => {
    const pref = await saveTransactionPreferences(sellerUser, {
      intents: ["FULL_SALE", "STRATEGIC_PARTNERSHIP"],
      stakeOfferedPercentage: 100.0,
      expectedValuation: 250000000, // 25 Cr
      expectedTransactionValue: 250000000,
      minAcceptableTerms: "Promoter willing to stay on for 12 months transition period.",
      preferredTimeline: "3-6 Months",
      preferredBuyerType: ["STRATEGIC_ACQUIRER", "PE_FUND"],
      strategicObjectives: "Seeking exit due to lack of family succession.",
      reasonForTransaction: "Promoter retirement and succession transition.",
    });

    expect(pref.intents).toContain("FULL_SALE");
    expect(pref.expectedValuation).toBe(250000000);

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.transactionPreferences).not.toBeNull();
    expect(dossier.sectionsCompleted).toContain("intent");
  });

  it("persists uncommitted draft progress server-side without data loss", async () => {
    await saveDraftProgress(sellerUser, {
      lastActiveSection: "financials",
      draftPayload: {
        tempRevenue: "450000000",
        tempNotes: "Draft notes before final audit verification",
      },
    });

    const dossier = await getSellerDossier(sellerUser.id, sellerUser);
    expect(dossier.lastActiveSection).toBe("financials");
    expect(dossier.draftPayload?.tempRevenue).toBe("450000000");
  });

  it("prevents submission if required dossier sections are missing", async () => {
    // Attempting to submit incomplete profile should throw ValidationError
    await expect(submitSellerForVerification(sellerUser)).rejects.toThrow(
      ValidationError
    );
  });

  it("successfully transitions status to SUBMITTED when all sections are complete", async () => {
    // Fill all required sections
    await updateSellerProfile(sellerUser, {
      designation: "Promoter",
      mobile: "+919876543210",
      email: "rajesh@agarwalind.in",
      preferredCommMethod: "EMAIL",
    });

    await updateBusinessProfile(sellerUser, {
      legalName: "Complete Business Ltd",
      businessType: "PUBLIC_LIMITED",
      industry: "Manufacturing",
      yearEstablished: 2015,
      registeredState: "Gujarat",
      registeredCity: "Ahmedabad",
      employeeCount: 50,
      businessDescription: "Complete description for testing full submission flow.",
    });

    await saveBusinessFinancials(sellerUser, [
      {
        financialYear: "2023-24",
        revenue: 100000000,
        ebitda: 15000000,
        pat: 10000000,
        netWorth: 50000000,
        debt: 10000000,
        assets: 60000000,
        liabilities: 10000000,
      },
    ]);

    await saveBusinessOwnership(sellerUser, [
      {
        ownerType: "INDIVIDUAL_PROMOTER",
        ownerName: "Rajesh Agarwal",
        ownershipPercentage: 100,
      },
    ]);

    await saveTransactionPreferences(sellerUser, {
      intents: ["FULL_SALE"],
      stakeOfferedPercentage: 100,
      expectedValuation: 100000000,
    });

    // Execute submission
    const submittedProfile = await submitSellerForVerification(sellerUser);
    expect(submittedProfile.onboardingStatus).toBe("SUBMITTED");
    expect(submittedProfile.submittedAt).not.toBeNull();
    expect(submittedProfile.completionPercentage).toBe(100);

    // Profile fields should now be locked against modifications by the seller
    await expect(
      updateSellerProfile(sellerUser, {
        designation: "Attempted Update While Submitted",
        mobile: "+919876543210",
        email: "rajesh@agarwalind.in",
        preferredCommMethod: "EMAIL",
      })
    ).rejects.toThrow(ForbiddenError);
  });
});

