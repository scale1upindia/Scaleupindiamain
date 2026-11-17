import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  getOrCreateBuyerProfile,
  getBuyerDossier,
  updateBuyerProfile,
  createAcquisitionMandate,
  saveBuyerDraft,
  submitBuyerForVerification,
} from "@/domains/buyer/service";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 3: Buyer Onboarding & Acquisition Profile", () => {
  let buyerUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const reg = await registerUser({
      email: "investor@apexcap.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["BUYER", "INVESTOR"],
    });
    buyerUser = reg.user;
  });

  it("initializes a draft buyer profile and draft progress record on first visit", async () => {
    const profile = await getOrCreateBuyerProfile(buyerUser);
    expect(profile).toBeDefined();
    expect(profile.userId).toBe(buyerUser.id);
    expect(profile.onboardingStatus).toBe("DRAFT");
    expect(profile.completionPercentage).toBe(0);

    const dossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(dossier.profile.id).toBe(profile.id);
    expect(dossier.mandates).toHaveLength(0);
    expect(dossier.documents).toHaveLength(0);
  });

  it("updates buyer organization profile and contact representative details", async () => {
    const updated = await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Apex Strategic Holdings Private Limited",
      tradeName: "Apex Strategic",
      entityType: "COMPANY",
      registrationNumber: "U74140MH2016PTC288991",
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      website: "https://apexholdings.in",
      yearEstablished: 2016,
      industry: "Manufacturing & Diversified Conglomerate",
      description: "Diversified industrial group acquiring mid-market manufacturing assets.",
      contactName: "Vikram Singhania",
      designation: "Managing Director",
      email: "vikram@apexholdings.in",
      phone: "+919820012345",
      preferredCommMethod: "IN_APP",
    });

    expect(updated.legalName).toBe("Apex Strategic Holdings Private Limited");
    expect(updated.buyerType).toBe("CORPORATE_BUYER");
    expect(updated.completionPercentage).toBeGreaterThanOrEqual(50);

    const dossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(dossier.profile.legalName).toBe("Apex Strategic Holdings Private Limited");
    expect(dossier.profile.city).toBe("Mumbai");
  });

  it("supports PE/VC fund metrics in profile", async () => {
    const updated = await updateBuyerProfile(buyerUser, {
      buyerType: "PE_FUND",
      legalName: "Apex India Growth Fund II",
      entityType: "FUND",
      country: "India",
      state: "Karnataka",
      city: "Bengaluru",
      contactName: "Vikram Singhania",
      designation: "Managing Partner",
      email: "vikram@apexholdings.in",
      phone: "+919820012345",
      preferredCommMethod: "EMAIL",
      fundSize: 1500000000, // 150 Cr
      aum: 5000000000,      // 500 Cr
      currentVintage: 2022,
      typicalTicketSize: 500000000, // 50 Cr
    });

    expect(updated.buyerType).toBe("PE_FUND");
    expect(updated.fundSize).toBe(1500000000);
    expect(updated.aum).toBe(5000000000);
    expect(updated.currentVintage).toBe(2022);
  });

  it("autosaves and restores incomplete buyer draft payload", async () => {
    await saveBuyerDraft(buyerUser, {
      lastActiveStep: 3,
      draftPayload: {
        legalName: "Draft Acquirer LLP",
        state: "Haryana",
        city: "Gurugram",
        minBudgetCr: 10,
      },
      sectionsCompleted: ["persona", "organization"],
    });

    const dossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(dossier.lastActiveStep).toBe(3);
    expect(dossier.draftPayload?.legalName).toBe("Draft Acquirer LLP");
    expect(dossier.sectionsCompleted).toContain("organization");
  });

  it("REJECTS formal submission if no acquisition mandates are defined", async () => {
    await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Apex Strategic Holdings",
      entityType: "COMPANY",
      state: "Maharashtra",
      city: "Mumbai",
      contactName: "Vikram Singhania",
      designation: "Director",
      email: "vikram@apexholdings.in",
      phone: "+919820012345",
    });

    await expect(submitBuyerForVerification(buyerUser)).rejects.toThrow(
      /At least one Acquisition Mandate is required before submission/i
    );
  });

  it("submits complete buyer dossier and transitions status to SUBMITTED", async () => {
    // 1. Update profile
    await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Apex Strategic Holdings Private Limited",
      entityType: "COMPANY",
      state: "Maharashtra",
      city: "Mumbai",
      contactName: "Vikram Singhania",
      designation: "Managing Director",
      email: "vikram@apexholdings.in",
      phone: "+919820012345",
    });

    // 2. Create Mandate
    await createAcquisitionMandate(buyerUser, {
      name: "Mid-Market Engineering Acquisition",
      minInvestment: 200000000, // 20 Cr
      maxInvestment: 500000000, // 50 Cr
      transactionTypes: ["FULL_ACQUISITION", "MAJORITY_STAKE"],
      controlPreference: "MAJORITY_CONTROL",
      strategicObjectives: ["MARKET_EXPANSION", "CAPACITY_EXPANSION"],
      targetIndustries: [
        { industry: "Manufacturing", subSectors: ["Precision Engineering", "Automotive Components"] },
      ],
      targetGeographies: [{ region: "PAN_INDIA" }],
    });

    // 3. Submit
    const submitted = await submitBuyerForVerification(buyerUser);
    expect(submitted.onboardingStatus).toBe("SUBMITTED");
    expect(submitted.completionPercentage).toBe(100);
    expect(submitted.submittedAt).not.toBeNull();
  });

  it("LOCKS buyer dossier from modification once in SUBMITTED state", async () => {
    await updateBuyerProfile(buyerUser, {
      buyerType: "CORPORATE_BUYER",
      legalName: "Apex Strategic Holdings Private Limited",
      entityType: "COMPANY",
      state: "Maharashtra",
      city: "Mumbai",
      contactName: "Vikram Singhania",
      designation: "Managing Director",
      email: "vikram@apexholdings.in",
      phone: "+919820012345",
    });

    await createAcquisitionMandate(buyerUser, {
      name: "Logistics Investment Mandate",
      minInvestment: 50000000,
      maxInvestment: 150000000,
      transactionTypes: ["STRATEGIC_INVESTMENT"],
      controlPreference: "JOINT_CONTROL",
      strategicObjectives: ["GEOGRAPHIC_EXPANSION"],
      targetIndustries: [{ industry: "Logistics" }],
      targetGeographies: [{ region: "WEST_INDIA" }],
    });

    await submitBuyerForVerification(buyerUser);

    // Attempting to update profile while SUBMITTED must throw ForbiddenError
    await expect(
      updateBuyerProfile(buyerUser, {
        buyerType: "CORPORATE_BUYER",
        legalName: "Attempted Modification",
        entityType: "COMPANY",
        state: "Maharashtra",
        city: "Mumbai",
        contactName: "Vikram Singhania",
        designation: "Managing Director",
        email: "vikram@apexholdings.in",
        phone: "+919820012345",
      })
    ).rejects.toThrow(ForbiddenError);
  });
});

