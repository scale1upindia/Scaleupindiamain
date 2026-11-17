import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  getSellerOpportunityById,
  updateOpportunity,
  submitOpportunity,
} from "@/domains/opportunity/service";
import { uploadOpportunityDocument, deleteOpportunityDocument } from "@/domains/documents/service";
import { AuthenticatedUser } from "@/types/auth";
import { ForbiddenError } from "@/lib/errors";

describe("Phase 4: Opportunity Authorization & Anti-IDOR Protections", () => {
  let sellerA: AuthenticatedUser;
  let sellerB: AuthenticatedUser;
  let oppAId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // Seller A
    const regA = await registerUser({
      email: "seller.a@mfg.in",
      firstName: "Seller",
      lastName: "Alpha",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerA = regA.user;

    // Seller B
    const regB = await registerUser({
      email: "seller.b@tech.in",
      firstName: "Seller",
      lastName: "Beta",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    sellerB = regB.user;

    // Create Opportunity belonging to Seller A
    const oppA = await createOpportunity(sellerA, {
      title: "Seller A Precision Automotive Manufacturing Listing",
      teaserSummary: "High-precision components supplier with 25 years of tier-1 manufacturing relationships.",
      businessCategory: "MANUFACTURING",
      industry: "Automotive Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "OVER_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
      exactLegalName: "Alpha Machining Pvt Ltd",
    });
    oppAId = oppA.id;
  });

  it("ANTI-IDOR: Allows Seller A to view their own opportunity record", async () => {
    const fetched = await getSellerOpportunityById(oppAId, sellerA);
    expect(fetched.id).toBe(oppAId);
    expect(fetched.title).toBe("Seller A Precision Automotive Manufacturing Listing");
  });

  it("ANTI-IDOR: BLOCKS Seller B from accessing Seller A's opportunity record", async () => {
    await expect(getSellerOpportunityById(oppAId, sellerB)).rejects.toThrow(ForbiddenError);
  });

  it("ANTI-IDOR: BLOCKS Seller B from modifying Seller A's opportunity draft", async () => {
    await expect(
      updateOpportunity(oppAId, sellerB, {
        title: "Malicious Tampered Title by Competitor",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("ANTI-IDOR: BLOCKS Seller B from submitting Seller A's opportunity for review", async () => {
    await expect(submitOpportunity(oppAId, sellerB)).rejects.toThrow(ForbiddenError);
  });

  it("ANTI-IDOR: BLOCKS Seller B from uploading documents to Seller A's opportunity", async () => {
    const dummyPdf = Buffer.from("%PDF-1.4 sample content for test");

    await expect(
      uploadOpportunityDocument(oppAId, sellerB, {
        originalFilename: "pitch_deck.pdf",
        mimeType: "application/pdf",
        buffer: dummyPdf,
        documentType: "TEASER_DECK",
      })
    ).rejects.toThrow(ForbiddenError);
  });

  it("ANTI-IDOR: BLOCKS Seller B from deleting Seller A's uploaded opportunity document", async () => {
    const dummyPdf = Buffer.from("%PDF-1.4 sample content for test");

    const doc = await uploadOpportunityDocument(oppAId, sellerA, {
      originalFilename: "authentic_deck.pdf",
      mimeType: "application/pdf",
      buffer: dummyPdf,
      documentType: "TEASER_DECK",
    });

    await expect(deleteOpportunityDocument(doc.id, sellerB)).rejects.toThrow(ForbiddenError);
  });
});
