import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createAcquisitionMandate,
  updateAcquisitionMandate,
  deleteAcquisitionMandate,
  getBuyerDossier,
} from "@/domains/buyer/service";
import { AcquisitionMandateSchema } from "@/schemas/buyer";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 3: Acquisition Mandates Management", () => {
  let buyerUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const reg = await registerUser({
      email: "buyer@investments.in",
      firstName: "Sameer",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerUser = reg.user;
  });

  it("creates multiple independent acquisition mandates for a single buyer profile", async () => {
    // Mandate 1: Auto components buyout
    const mandate1 = await createAcquisitionMandate(buyerUser, {
      name: "Auto Components Full Buyout",
      description: "Targeting 100% acquisition of operating Tier-1 auto ancillary manufacturing units.",
      minInvestment: 500000000, // 50 Cr
      maxInvestment: 1200000000, // 120 Cr
      preferredTicketSize: 800000000,
      revenueMin: 800000000, // 80 Cr
      revenueMax: 2500000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["CAPACITY_EXPANSION", "VERTICAL_INTEGRATION"],
      targetIndustries: [
        {
          industry: "Manufacturing",
          subSectors: ["Automotive Components", "Industrial Machinery"],
        },
      ],
      targetGeographies: [
        {
          region: "WEST_INDIA",
          states: ["Maharashtra", "Gujarat"],
        },
      ],
      investmentHorizon: "LONG_TERM",
      fundingSource: "OWN_CAPITAL",
    });

    expect(mandate1.id).toBeDefined();
    expect(mandate1.name).toBe("Auto Components Full Buyout");
    expect(mandate1.targetIndustries).toHaveLength(1);
    expect(mandate1.targetGeographies).toHaveLength(1);

    // Mandate 2: SaaS minority growth investment
    const mandate2 = await createAcquisitionMandate(buyerUser, {
      name: "B2B SaaS Growth Investment",
      description: "Minority equity stake in enterprise SaaS businesses with ARR > ₹10 Cr.",
      minInvestment: 100000000, // 10 Cr
      maxInvestment: 250000000, // 25 Cr
      revenueMin: 100000000,
      transactionTypes: ["STRATEGIC_INVESTMENT", "MINORITY_STAKE"],
      controlPreference: "MINORITY",
      strategicObjectives: ["TECHNOLOGY_ACQUISITION", "DIVERSIFICATION"],
      targetIndustries: [
        {
          industry: "Technology",
          subSectors: ["SaaS", "Enterprise Software"],
        },
      ],
      targetGeographies: [{ region: "PAN_INDIA" }],
      investmentHorizon: "MEDIUM_TERM",
      fundingSource: "FUND_CAPITAL",
    });

    expect(mandate2.id).toBeDefined();
    expect(mandate2.name).toBe("B2B SaaS Growth Investment");

    // Verify dossier contains both independent mandates
    const dossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(dossier.mandates).toHaveLength(2);
    const names = dossier.mandates.map((m) => m.name);
    expect(names).toContain("Auto Components Full Buyout");
    expect(names).toContain("B2B SaaS Growth Investment");
  });

  it("REJECTS mandate when minInvestment exceeds maxInvestment", () => {
    expect(() =>
      AcquisitionMandateSchema.parse({
        name: "Invalid Investment Range",
        minInvestment: 500000000, // 50 Cr
        maxInvestment: 100000000, // 10 Cr (Less than min)
        transactionTypes: ["FULL_ACQUISITION"],
        controlPreference: "FULL_CONTROL",
        strategicObjectives: ["MARKET_EXPANSION"],
        targetIndustries: [{ industry: "Manufacturing" }],
        targetGeographies: [{ region: "PAN_INDIA" }],
      })
    ).toThrow(/Minimum investment cannot exceed maximum investment/i);
  });

  it("REJECTS mandate when revenueMin exceeds revenueMax", () => {
    expect(() =>
      AcquisitionMandateSchema.parse({
        name: "Invalid Revenue Range",
        minInvestment: 10000000,
        maxInvestment: 50000000,
        revenueMin: 100000000,
        revenueMax: 50000000, // Less than min
        transactionTypes: ["FULL_ACQUISITION"],
        controlPreference: "FULL_CONTROL",
        strategicObjectives: ["MARKET_EXPANSION"],
        targetIndustries: [{ industry: "Manufacturing" }],
        targetGeographies: [{ region: "PAN_INDIA" }],
      })
    ).toThrow(/Revenue minimum cannot exceed revenue maximum/i);
  });

  it("updates an existing acquisition mandate and replaces target sectors", async () => {
    const created = await createAcquisitionMandate(buyerUser, {
      name: "Initial Pharma Mandate",
      minInvestment: 50000000,
      maxInvestment: 100000000,
      transactionTypes: ["MAJORITY_STAKE"],
      controlPreference: "MAJORITY_CONTROL",
      strategicObjectives: ["MARKET_EXPANSION"],
      targetIndustries: [{ industry: "Pharma" }],
      targetGeographies: [{ region: "NORTH_INDIA" }],
    });

    const updated = await updateAcquisitionMandate(created.id, buyerUser, {
      name: "Expanded Healthcare & Diagnostics Mandate",
      minInvestment: 80000000,
      maxInvestment: 200000000,
      transactionTypes: ["MAJORITY_STAKE", "JOINT_VENTURE"],
      controlPreference: "MAJORITY_CONTROL",
      strategicObjectives: ["MARKET_EXPANSION", "DISTRIBUTION_EXPANSION"],
      targetIndustries: [
        { industry: "Healthcare", subSectors: ["Diagnostics", "Clinics"] },
        { industry: "Pharma", subSectors: ["Formulations"] },
      ],
      targetGeographies: [{ region: "PAN_INDIA" }],
    });

    expect(updated.name).toBe("Expanded Healthcare & Diagnostics Mandate");
    expect(updated.maxInvestment).toBe(200000000);
    expect(updated.targetIndustries).toHaveLength(2);
    expect(updated.targetGeographies?.[0].region).toBe("PAN_INDIA");
  });

  it("soft-deletes (archives) an acquisition mandate", async () => {
    const created = await createAcquisitionMandate(buyerUser, {
      name: "Temporary Mandate to Delete",
      minInvestment: 10000000,
      maxInvestment: 20000000,
      transactionTypes: ["MINORITY_STAKE"],
      controlPreference: "MINORITY",
      strategicObjectives: ["FINANCIAL_INVESTMENT"],
      targetIndustries: [{ industry: "Services" }],
      targetGeographies: [{ region: "PAN_INDIA" }],
    });

    await deleteAcquisitionMandate(created.id, buyerUser);

    const dossier = await getBuyerDossier(buyerUser.id, buyerUser);
    expect(dossier.mandates.find((m) => m.id === created.id)).toBeUndefined();
  });
});

