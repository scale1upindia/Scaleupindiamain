import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import { getOrCreateSellerProfile } from "@/domains/seller/service";
import {
  uploadSellerDocument,
  getDocumentForDownload,
  deleteSellerDocument,
} from "@/domains/documents/service";
import { ValidationError, ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 2: Seller Document Security & Anti-IDOR Protection", () => {
  let userA: AuthenticatedUser;
  let userB: AuthenticatedUser;
  let adminUser: AuthenticatedUser;
  let profileAId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // User A (Promoter A)
    const regA = await registerUser({
      email: "promoterA@vault.in",
      firstName: "Anil",
      lastName: "Ambani",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    userA = regA.user;
    const profileA = await getOrCreateSellerProfile(userA);
    profileAId = profileA.id;

    // User B (Promoter B)
    const regB = await registerUser({
      email: "promoterB@vault.in",
      firstName: "Mukesh",
      lastName: "Shah",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    userB = regB.user;
    await getOrCreateSellerProfile(userB);

    // Admin User
    const regAdmin = await registerUser({
      email: "compliance@scaleupindia.co.in",
      firstName: "Compliance",
      lastName: "Officer",
      password: "Password@123",
      roles: ["PROMOTER"], // Temp registered
    });
    adminUser = {
      ...regAdmin.user,
      roles: ["VERIFICATION_MANAGER"],
      permissions: ["sellers.read", "documents.read_all", "documents.approve"],
      isInternal: true,
    };
  });

  it("uploads a valid PDF document with authentic magic bytes", async () => {
    // Valid PDF buffer (%PDF-1.4 header)
    const validPdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF");

    const doc = await uploadSellerDocument(profileAId, userA, {
      originalFilename: "audited_balance_sheet_fy24.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      documentType: "AUDITED_FINANCIALS",
    });

    expect(doc).toBeDefined();
    expect(doc.originalFilename).toBe("audited_balance_sheet_fy24.pdf");
    expect(doc.documentType).toBe("AUDITED_FINANCIALS");
    expect(doc.verificationStatus).toBe("PENDING");
    expect(doc.checksumSha256).toBeDefined();
  });

  it("REJECTS a file when magic bytes do not match the declared extension (MIME spoofing)", async () => {
    // Fake PDF with plain text content
    const spoofedBuffer = Buffer.from("THIS IS JUST PLAIN TEXT NOT A REAL PDF FILE");

    await expect(
      uploadSellerDocument(profileAId, userA, {
        originalFilename: "malicious_payload.pdf",
        mimeType: "application/pdf",
        buffer: spoofedBuffer,
        documentType: "AUDITED_FINANCIALS",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("REJECTS an oversized file exceeding 15MB limit", async () => {
    // 16MB buffer
    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024, 0x25); // Starts with %

    await expect(
      uploadSellerDocument(profileAId, userA, {
        originalFilename: "giant_file.pdf",
        mimeType: "application/pdf",
        buffer: oversizedBuffer,
        documentType: "AUDITED_FINANCIALS",
      })
    ).rejects.toThrow(ValidationError);
  });

  it("ANTI-IDOR: Prevents User B from downloading User A's uploaded documents", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.4\nSample balance sheet");
    const doc = await uploadSellerDocument(profileAId, userA, {
      originalFilename: "private_itr_acknowledgement.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      documentType: "ITR_ACKNOWLEDGEMENT",
    });

    // 1. User A (Owner) CAN download
    const ownerDownload = await getDocumentForDownload(doc.id, userA);
    expect(ownerDownload.record.id).toBe(doc.id);
    expect(ownerDownload.buffer).toBeDefined();

    // 2. User B (Unauthorized Third Party) CANNOT download (throws ForbiddenError)
    await expect(getDocumentForDownload(doc.id, userB)).rejects.toThrow(ForbiddenError);

    // 3. Admin WITH permission CAN download for review
    const adminDownload = await getDocumentForDownload(doc.id, adminUser);
    expect(adminDownload.record.id).toBe(doc.id);
  });

  it("ANTI-IDOR: Prevents User B from deleting User A's documents", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.4\nTax filing");
    const doc = await uploadSellerDocument(profileAId, userA, {
      originalFilename: "form_26as.pdf",
      mimeType: "application/pdf",
      buffer: validPdfBuffer,
      documentType: "FORM_26AS",
    });

    // User B attempts to delete User A's document -> Must fail
    await expect(deleteSellerDocument(doc.id, userB)).rejects.toThrow(ForbiddenError);

    // User A deletes own document -> Succeeds
    await expect(deleteSellerDocument(doc.id, userA)).resolves.not.toThrow();
  });
});

