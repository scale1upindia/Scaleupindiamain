import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { createOpportunity } from "@/domains/opportunity/service";
import {
  uploadOpportunityDocument,
  getOpportunityDocumentForDownload,
  deleteOpportunityDocument,
} from "@/domains/documents/service";
import { AuthenticatedUser } from "@/types/auth";
import { ValidationError, ForbiddenError } from "@/lib/errors";

describe("Phase 4: Opportunity Document Vault & Magic-Byte Security", () => {
  let sellerA: AuthenticatedUser;
  let buyerB: AuthenticatedUser;
  let oppId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    const regA = await registerUser({
      email: "promoter@valves.in",
      firstName: "Anil",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerA = regA.user;

    const regB = await registerUser({
      email: "buyer@fund.in",
      firstName: "Vikram",
      lastName: "Singhal",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyerB = regB.user;

    const opp = await createOpportunity(sellerA, {
      title: "Engineered Ball Valves & Actuators Manufacturer",
      teaserSummary: "API-certified industrial valve manufacturing facility supplying energy and refining projects.",
      businessCategory: "MANUFACTURING",
      industry: "Industrial Machinery",
      operatingRegion: "WEST_INDIA",
      registeredState: "Gujarat",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "50CR_TO_100CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
    });
    oppId = opp.id;
  });

  it("uploads a valid PDF document with authentic magic bytes", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.5 authentic binary content");

    const doc = await uploadOpportunityDocument(oppId, sellerA, {
      originalFilename: "corporate_teaser.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      documentType: "TEASER_DECK",
      accessTier: 2,
    });

    expect(doc.id).toBeDefined();
    expect(doc.checksumSha256).toBeDefined();
    expect(doc.accessTier).toBe(2);
  });

  it("REJECTS an uploaded file when magic bytes do not match the declared extension (MIME spoofing)", async () => {
    // Declared as .pdf but contains arbitrary malicious executable / text bytes
    const maliciousBuffer = Buffer.from("NOT_A_PDF_MALICIOUS_SCRIPT");

    await expect(
      uploadOpportunityDocument(oppId, sellerA, {
        originalFilename: "spoofed.pdf",
        mimeType: "application/pdf",
        buffer: maliciousBuffer,
        documentType: "TEASER_DECK",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("REJECTS an oversized file exceeding 15MB limit", async () => {
    // 16MB buffer
    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
    oversizedBuffer[0] = 0x25; // %
    oversizedBuffer[1] = 0x50; // P
    oversizedBuffer[2] = 0x44; // D
    oversizedBuffer[3] = 0x46; // F

    await expect(
      uploadOpportunityDocument(oppId, sellerA, {
        originalFilename: "oversized.pdf",
        mimeType: "application/pdf",
        buffer: oversizedBuffer,
        documentType: "TEASER_DECK",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("ANTI-IDOR: Prevents unauthorized buyer from downloading confidential opportunity documents", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.5 authentic confidential deck");

    const doc = await uploadOpportunityDocument(oppId, sellerA, {
      originalFilename: "confidential_deck.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      documentType: "TEASER_DECK",
      accessTier: 2,
    });

    // Buyer B has no workflow grant
    await expect(getOpportunityDocumentForDownload(doc.id, buyerB)).rejects.toThrow(ForbiddenError);
  });
});
