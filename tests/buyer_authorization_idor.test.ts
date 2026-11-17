import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  getOrCreateBuyerProfile,
  getBuyerDossier,
  updateBuyerProfile,
  createAcquisitionMandate,
  updateAcquisitionMandate,
  deleteAcquisitionMandate,
  executeAdminBuyerReviewAction,
} from "@/domains/buyer/service";
import { uploadBuyerDocument, getBuyerDocumentForDownload } from "@/domains/documents/service";
import { ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 3: Buyer Authorization, Anti-IDOR & Privilege Escalation", () => {
  let buyerA: AuthenticatedUser;
  let buyerB: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // Buyer A
    const regA = await registerUser({
      email: "buyer.a@holdings.in",
      firstName: "Buyer",
      lastName: "Alpha",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerA = regA.user;

    // Buyer B
    const regB = await registerUser({
      email: "buyer.b@capital.in",
      firstName: "Buyer",
      lastName: "Beta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerB = regB.user;

    // Admin
    const regAdmin = await registerUser({
      email: "admin@scaleup.in",
      firstName: "Compliance",
      lastName: "Admin",
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

    // Setup initial profiles
    await getOrCreateBuyerProfile(buyerA);
    await getOrCreateBuyerProfile(buyerB);
  });

  it("allows a buyer to access their own dossier", async () => {
    const dossier = await getBuyerDossier(buyerA.id, buyerA);
    expect(dossier).toBeDefined();
    expect(dossier.profile.userId).toBe(buyerA.id);
  });

  it("PREVENTS Buyer A from accessing Buyer B's dossier (Anti-IDOR)", async () => {
    await expect(getBuyerDossier(buyerB.id, buyerA)).rejects.toThrow(ForbiddenError);
  });

  it("PREVENTS Buyer B from accessing Buyer A's dossier (Anti-IDOR)", async () => {
    await expect(getBuyerDossier(buyerA.id, buyerB)).rejects.toThrow(ForbiddenError);
  });

  it("allows internal Admin with 'buyers.read' permission to inspect any buyer dossier", async () => {
    const dossier = await getBuyerDossier(buyerA.id, adminUser);
    expect(dossier.profile.userId).toBe(buyerA.id);
  });

  it("PREVENTS Buyer B from modifying Buyer A's acquisition mandate (Anti-IDOR)", async () => {
    const mandateA = await createAcquisitionMandate(buyerA, {
      name: "Buyer A Mandate",
      minInvestment: 50000000,
      maxInvestment: 100000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["MARKET_EXPANSION"],
      targetIndustries: [{ industry: "Manufacturing" }],
      targetGeographies: [{ region: "PAN_INDIA" }],
    });

    await expect(
      updateAcquisitionMandate(mandateA.id, buyerB, {
        name: "Malicious Edit Attempt",
        minInvestment: 10000000,
        maxInvestment: 20000000,
        transactionTypes: ["FULL_ACQUISITION"],
        controlPreference: "FULL_CONTROL",
        strategicObjectives: ["MARKET_EXPANSION"],
        targetIndustries: [{ industry: "Manufacturing" }],
        targetGeographies: [{ region: "PAN_INDIA" }],
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("PREVENTS Buyer B from deleting Buyer A's acquisition mandate (Anti-IDOR)", async () => {
    const mandateA = await createAcquisitionMandate(buyerA, {
      name: "Buyer A Mandate",
      minInvestment: 50000000,
      maxInvestment: 100000000,
      transactionTypes: ["FULL_ACQUISITION"],
      controlPreference: "FULL_CONTROL",
      strategicObjectives: ["MARKET_EXPANSION"],
      targetIndustries: [{ industry: "Manufacturing" }],
      targetGeographies: [{ region: "PAN_INDIA" }],
    });

    await expect(deleteAcquisitionMandate(mandateA.id, buyerB)).rejects.toThrow(ForbiddenError);
  });

  it("BLOCKS Buyer B from downloading Buyer A's private vault documents (Anti-IDOR)", async () => {
    const profileA = await getOrCreateBuyerProfile(buyerA);
    const pdfBuffer = Buffer.from("%PDF-1.4 Mock Private Buyer Financial Statement");

    const docA = await uploadBuyerDocument(profileA.id, buyerA, {
      originalFilename: "Confidential_Proof_Of_Funds.pdf",
      mimeType: "application/pdf",
      buffer: pdfBuffer,
      documentType: "PROOF_OF_FUNDS",
    });

    // Owner can access
    const ownerAccess = await getBuyerDocumentForDownload(docA.id, buyerA);
    expect(ownerAccess.record.id).toBe(docA.id);

    // Foreign user Buyer B MUST be blocked
    await expect(getBuyerDocumentForDownload(docA.id, buyerB)).rejects.toThrow(ForbiddenError);

    // Admin CAN access
    const adminAccess = await getBuyerDocumentForDownload(docA.id, adminUser);
    expect(adminAccess.record.id).toBe(docA.id);
  });

  it("PREVENTS external commercial buyers from calling administrative verification actions", async () => {
    const profileA = await getOrCreateBuyerProfile(buyerA);

    await expect(
      executeAdminBuyerReviewAction(profileA.id, "VERIFY", {}, buyerA)
    ).rejects.toThrow(ForbiddenError);
  });

  it("FREEZES suspended buyer from creating new mandates", async () => {
    const profileA = await getOrCreateBuyerProfile(buyerA);

    // Admin suspends buyer
    await executeAdminBuyerReviewAction(
      profileA.id,
      "SUSPEND",
      { suspensionReason: "Failure to verify source of funds." },
      adminUser
    );

    // Buyer A attempts to create a new mandate while suspended
    await expect(
      createAcquisitionMandate(buyerA, {
        name: "Attempted Mandate Post-Suspension",
        minInvestment: 10000000,
        maxInvestment: 50000000,
        transactionTypes: ["MINORITY_STAKE"],
        controlPreference: "MINORITY",
        strategicObjectives: ["MARKET_EXPANSION"],
        targetIndustries: [{ industry: "Technology" }],
        targetGeographies: [{ region: "PAN_INDIA" }],
      })
    ).rejects.toThrow(/Suspended accounts cannot create new acquisition mandates/i);
  });
});
