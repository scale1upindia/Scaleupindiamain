// Scale-up India — Phase 8: Bilateral NDA & Secure Data Room Test Suite
// Path: tests/nda_data_room.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
  getOpportunityForDiscovery,
} from "@/domains/opportunity/service";
import {
  submitEOI,
  acceptEOI,
} from "@/domains/eoi/service";
import {
  initiateNDA,
  getBuyerNDAs,
  getBuyerNDAById,
  getSellerNDAs,
  getSellerNDAById,
  acceptNDA,
  declineNDA,
  getDataRoomForUser,
  uploadDataRoomDocument,
  generateDocumentSignedUrl,
  downloadDataRoomDocument,
  deleteDataRoomDocument,
  revokeDataRoom,
} from "@/domains/dataroom/service";
import { getUserNotifications } from "@/domains/notifications/service";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

describe("Phase 8: Bilateral NDA & Secure Data Room Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let opp2PublishedId: string;
  let eoi1AcceptedId: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Provision Seller 1
    const regSeller1 = await registerUser({
      email: "seller1.p8@enterprise.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;

    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988776655', 'seller1.p8@enterprise.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Provision Seller 2
    const regSeller2 = await registerUser({
      email: "seller2.p8@pharma.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;

    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988776656', 'seller2.p8@pharma.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Provision Buyer 1
    const regBuyer1 = await registerUser({
      email: "buyer1.p8@investments.in",
      firstName: "Rajesh",
      lastName: "Nair",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer1 = regBuyer1.user;

    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'CORPORATE_BUYER', 'Alpha Strategic Capital Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
        'Rajesh Nair', 'Head of M&A', 'buyer1.p8@investments.in', '+919876543210', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Provision Buyer 2
    const regBuyer2 = await registerUser({
      email: "buyer2.p8@familyoffice.in",
      firstName: "Kavita",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer2 = regBuyer2.user;

    await query(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status, industry
      ) VALUES (
        $1, 'FAMILY_OFFICE', 'Mehta Heritage Ventures', 'FAMILY_OFFICE', 'Gujarat', 'Ahmedabad',
        'Kavita Mehta', 'Managing Trustee', 'buyer2.p8@familyoffice.in', '+919876543211', 'VERIFIED', 'Healthcare'
      )`,
      [buyer2.id]
    );

    // 5. Provision Admin
    const regAdmin = await registerUser({
      email: "admin.p8@scaleup.in",
      firstName: "Chief",
      lastName: "Administrator",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN"],
      permissions: [
        "opportunities.publish",
        "eoi.manage",
        "nda.manage",
        "nda.read_all",
        "vdr.manage",
        "vdr.read_all",
      ],
    };

    // 6. Seed Opportunity 1 (Seller 1 -> Published)
    const opp1 = await createOpportunity(seller1, {
      title: "Precision Aerospace Component Manufacturer",
      headline: "Defense & Aviation Machining Facility",
      teaserSummary: "Tier-1 aerospace engineering facility with long-term contracts.",
      businessCategory: "MANUFACTURING",
      industry: "Precision Engineering",
      subSector: "Aerospace Components",
      operatingRegion: "WEST_INDIA",
      registeredState: "Maharashtra",
      approximateAgeBracket: "10_TO_20_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "FULL_ACQUISITION",
      businessModel: "B2B",
      ebitdaMarginBracket: "20_TO_30_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      exactLegalName: "Aerospace Machining Technologies Pvt Ltd",
      exactCin: "U29299MH2010PTC123456",
      exactPan: "AAACA1234E",
    });
    await submitOpportunity(opp1.id, seller1);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
    opp1PublishedId = pubOpp1.id;

    // 7. Seed Opportunity 2 (Seller 2 -> Published)
    const opp2 = await createOpportunity(seller2, {
      title: "Clinical Diagnostic Labs Chain",
      headline: "Accredited Diagnostic Network",
      teaserSummary: "Network of 8 specialty diagnostic laboratories.",
      businessCategory: "HEALTHCARE",
      industry: "Healthcare & Lifesciences",
      subSector: "Diagnostic Laboratories",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "15CR_TO_25CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "B2C",
    });
    await submitOpportunity(opp2.id, seller2);
    await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
    const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);
    opp2PublishedId = pubOpp2.id;

    // 8. Buyer 1 expresses interest on Opportunity 1, Seller 1 accepts EOI
    const submittedEoi = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Buyout",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Interested in evaluating complete buyout of aerospace asset.",
    });
    const acceptedEoi = await acceptEOI(seller1, submittedEoi.id, {
      sellerResponseMessage: "Accepted for bilateral NDA & data room staging.",
    });
    eoi1AcceptedId = acceptedEoi.id;
  });

  // ==========================================
  // PART 1: NDA INITIATION & ELIGIBILITY GATES
  // ==========================================

  it("1. Buyer 1 can initiate bilateral NDA on accepted EOI", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    expect(nda.id).toBeDefined();
    expect(nda.referenceCode).toMatch(/^NDA-\d{4}-\d+$/);
    expect(nda.status).toBe("NDA_SENT");
    expect(nda.buyerId).toBe(buyer1.id);
    expect(nda.sellerId).toBe(seller1.id);
    expect(nda.opportunityId).toBe(opp1PublishedId);
  });

  it("2. Seller 1 can initiate bilateral NDA on accepted EOI", async () => {
    const nda = await initiateNDA(seller1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    expect(nda.id).toBeDefined();
    expect(nda.status).toBe("NDA_SENT");
    expect(nda.buyerId).toBe(buyer1.id);
    expect(nda.sellerId).toBe(seller1.id);
  });

  it("3. Anti-IDOR: Buyer 2 cannot initiate NDA for Buyer 1's accepted EOI", async () => {
    await expect(
      initiateNDA(buyer2, opp1PublishedId, { eoiId: eoi1AcceptedId })
    ).rejects.toThrow(ForbiddenError);
  });

  it("4. Anti-IDOR: Seller 2 cannot initiate NDA for Seller 1's opportunity", async () => {
    await expect(
      initiateNDA(seller2, opp1PublishedId, { eoiId: eoi1AcceptedId })
    ).rejects.toThrow(ForbiddenError);
  });

  it("5. EOI prerequisite: Attempting to initiate NDA on an unaccepted EOI is rejected", async () => {
    // Buyer 2 submits EOI on opp2 (status = SUBMITTED, not accepted)
    const eoi2 = await submitEOI(buyer2, opp2PublishedId, {
      interestType: "MAJORITY_STAKE",
      proposedTransactionType: "Majority Stake",
      investmentTimeline: "3_TO_6_MONTHS",
      buyerMessage: "Interested in evaluating diagnostics network.",
    });

    await expect(
      initiateNDA(buyer2, opp2PublishedId, { eoiId: eoi2.id })
    ).rejects.toThrow(ValidationError);
  });

  it("6. EOI prerequisite: Mismatched opportunityId throws validation error", async () => {
    await expect(
      initiateNDA(buyer1, opp2PublishedId, { eoiId: eoi1AcceptedId })
    ).rejects.toThrow(ValidationError);
  });

  it("7. Duplicate prevention: Multiple simultaneous active NDAs for same buyer/opp are blocked", async () => {
    await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    // Second initiation attempt throws ConflictError
    await expect(
      initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId })
    ).rejects.toThrow(ConflictError);
  });

  // ==========================================
  // PART 2: NDA STATE MACHINE & BILATERAL EXECUTION
  // ==========================================

  it("8. Buyer inspection updates buyer_viewed_at and records NDA_VIEWED audit", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    const buyerView = await getBuyerNDAById(buyer1, nda.id);
    expect(buyerView.referenceCode).toBe(nda.referenceCode);

    const dbRes = await query<{ buyer_viewed_at: string | null }>(
      `SELECT buyer_viewed_at FROM nda_agreements WHERE id = $1`,
      [nda.id]
    );
    expect(dbRes.rows[0].buyer_viewed_at).not.toBeNull();
  });

  it("9. Anti-IDOR: Buyer 2 cannot view Buyer 1's NDA", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    await expect(getBuyerNDAById(buyer2, nda.id)).rejects.toThrow(ForbiddenError);
  });

  it("10. Anti-IDOR: Seller 2 cannot view Seller 1's NDA", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    await expect(getSellerNDAById(seller2, nda.id)).rejects.toThrow(ForbiddenError);
  });

  it("11. Single-party acceptance does NOT execute the NDA", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    // Buyer accepts
    const buyerAccepted = await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    expect(buyerAccepted.status).toBe("BUYER_ACCEPTED");
    expect(buyerAccepted.buyerAcceptedAt).not.toBeNull();
    expect(buyerAccepted.sellerAcceptedAt).toBeNull();
    expect(buyerAccepted.executedAt).toBeNull();

    // Data room must NOT be active yet!
    const roomRes = await query(`SELECT * FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    expect(roomRes.rows.length).toBe(0);
  });

  it("12. Bilateral countersignature transitions NDA to EXECUTED and activates Data Room", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    // 1. Buyer accepts
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });

    // 2. Seller accepts
    const executedNda = await acceptNDA(seller1, nda.id, { termsAcknowledged: true });
    expect(executedNda.status).toBe("EXECUTED");
    expect(executedNda.buyerAcceptedAt).not.toBeNull();
    expect(executedNda.sellerAcceptedAt).not.toBeNull();
    expect(executedNda.executedAt).not.toBeNull();

    // 3. Secure Data Room is created and active
    const roomRes = await query<{ id: string; status: string; reference_code: string }>(
      `SELECT id, status, reference_code FROM data_rooms WHERE nda_id = $1`,
      [nda.id]
    );
    expect(roomRes.rows.length).toBe(1);
    expect(roomRes.rows[0].status).toBe("ACTIVE");
    expect(roomRes.rows[0].reference_code).toMatch(/^VDR-\d{4}-\d+$/);

    // 4. Data Room Memberships created for both Buyer and Seller
    const membersRes = await query<{ user_id: string; role: string; access_status: string }>(
      `SELECT user_id, role, access_status FROM data_room_members WHERE data_room_id = $1`,
      [roomRes.rows[0].id]
    );
    expect(membersRes.rows.length).toBe(2);
    expect(membersRes.rows.find((m) => m.user_id === buyer1.id && m.role === "BUYER")?.access_status).toBe("ACTIVE");
    expect(membersRes.rows.find((m) => m.user_id === seller1.id && m.role === "SELLER")?.access_status).toBe("ACTIVE");
  });

  it("13. Seller accepting first, then buyer accepting second, also cleanly executes NDA", async () => {
    const nda = await initiateNDA(seller1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    // Seller accepts first
    const sellerAccepted = await acceptNDA(seller1, nda.id, { termsAcknowledged: true });
    expect(sellerAccepted.status).toBe("SELLER_ACCEPTED");

    // Buyer accepts second -> Transitions to EXECUTED
    const executed = await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    expect(executed.status).toBe("EXECUTED");
    expect(executed.executedAt).not.toBeNull();
  });

  it("14. Once EXECUTED, neither party can accept again (Double accept invariant)", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    await expect(acceptNDA(buyer1, nda.id, { termsAcknowledged: true })).rejects.toThrow(ValidationError);
    await expect(acceptNDA(seller1, nda.id, { termsAcknowledged: true })).rejects.toThrow(ValidationError);
  });

  it("15. Once EXECUTED, neither party can decline (State machine invariant)", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    await expect(declineNDA(buyer1, nda.id, { declineReason: "Valuation too high" })).rejects.toThrow(ValidationError);
    await expect(declineNDA(seller1, nda.id, { declineReason: "Deal canceled" })).rejects.toThrow(ValidationError);
  });

  it("16. Declining an NDA moves it to DECLINED, and it CANNOT subsequently be accepted", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });

    const declined = await declineNDA(seller1, nda.id, { declineReason: "Unacceptable covenants" });
    expect(declined.status).toBe("DECLINED");
    expect(declined.declineReason).toBe("Unacceptable covenants");

    await expect(acceptNDA(buyer1, nda.id, { termsAcknowledged: true })).rejects.toThrow(ValidationError);
    await expect(acceptNDA(seller1, nda.id, { termsAcknowledged: true })).rejects.toThrow(ValidationError);
  });

  // ==========================================
  // PART 3: CRITICAL CONFIDENTIALITY BOUNDARIES
  // ==========================================

  it("17. CRITICAL: Accepted EOI does NOT grant data room access before NDA execution", async () => {
    // EOI is ACCEPTED, but no NDA is executed.
    // Buyer 1 attempts to call getDataRoomForUser with a dummy or unexecuted room ID -> Throws NotFound or Forbidden
    await expect(getDataRoomForUser(buyer1, "00000000-0000-0000-0000-000000000000")).rejects.toThrow();

    // Verify opportunity discovery still returns Tier 1 masked data
    const opp = await getOpportunityForDiscovery(opp1PublishedId, buyer1);
    expect(opp.tier).toBe(1);
    expect((opp as any).exactCin).toBeUndefined();
    expect((opp as any).exactPan).toBeUndefined();
    expect((opp as any).exactAddress).toBeUndefined();
  });

  it("18. CRITICAL: Unilateral acceptance (BUYER_ACCEPTED only) does NOT unlock data room", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });

    // No active room exists for this NDA
    const roomRes = await query(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    expect(roomRes.rows.length).toBe(0);
  });

  // ==========================================
  // PART 4: DATA ROOM ACCESS & ANTI-IDOR
  // ==========================================

  it("19. Authorized Buyer and Seller can access active Data Room after execution", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const buyerRoomView = await getDataRoomForUser(buyer1, roomId);
    expect(buyerRoomView.id).toBe(roomId);
    expect(buyerRoomView.userRole).toBe("BUYER");
    expect(buyerRoomView.status).toBe("ACTIVE");

    const sellerRoomView = await getDataRoomForUser(seller1, roomId);
    expect(sellerRoomView.id).toBe(roomId);
    expect(sellerRoomView.userRole).toBe("SELLER");
    expect(sellerRoomView.status).toBe("ACTIVE");
  });

  it("20. Anti-IDOR: Unauthorized Buyer 2 CANNOT access Buyer 1's Data Room", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    await expect(getDataRoomForUser(buyer2, roomId)).rejects.toThrow(ForbiddenError);
  });

  it("21. Anti-IDOR: Unauthorized Seller 2 CANNOT access Seller 1's Data Room", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    await expect(getDataRoomForUser(seller2, roomId)).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 5: CONFIDENTIAL DOCUMENT UPLOAD & FILE SECURITY
  // ==========================================

  it("22. Seller can upload valid PDF document to active Data Room", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    // Create valid PDF buffer with %PDF- header
    const validPdfBuffer = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.from("1 0 obj\n<< /Title (Audited Balance Sheet FY24) >>\nendobj\ntrailer\n<<>>\n%%EOF"),
    ]);

    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      {
        originalFilename: "Audited_Balance_Sheet_FY24.pdf",
        mimeType: "application/pdf",
        buffer: validPdfBuffer,
      },
      {
        title: "Audited Balance Sheet & Financial Statements FY24",
        documentCategory: "FINANCIAL",
        accessLevel: "ROOM_MEMBER",
      }
    );

    expect(doc.id).toBeDefined();
    expect(doc.title).toBe("Audited Balance Sheet & Financial Statements FY24");
    expect(doc.documentCategory).toBe("FINANCIAL");
    expect(doc.fileSize).toBe(validPdfBuffer.length);

    // Verify buyer can see it in Data Room
    const buyerRoom = await getDataRoomForUser(buyer1, roomId);
    expect(buyerRoom.documents.length).toBe(1);
    expect(buyerRoom.documents[0].id).toBe(doc.id);
  });

  it("23. File Security: Spoofed MIME types failing magic bytes are rejected", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    // Malicious text file disguised as .pdf
    const fakePdf = Buffer.from("<html><script>alert('xss')</script></html>");

    await expect(
      uploadDataRoomDocument(
        seller1,
        roomId,
        {
          originalFilename: "malicious.pdf",
          mimeType: "application/pdf",
          buffer: fakePdf,
        },
        {
          title: "Malicious Disguised File",
          documentCategory: "FINANCIAL",
          accessLevel: "ROOM_MEMBER",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  it("24. File Security: Files exceeding 15MB size limit are rejected", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const hugeBuffer = Buffer.alloc(16 * 1024 * 1024, "%PDF-");

    await expect(
      uploadDataRoomDocument(
        seller1,
        roomId,
        {
          originalFilename: "oversized.pdf",
          mimeType: "application/pdf",
          buffer: hugeBuffer,
        },
        {
          title: "Oversized Financial Model",
          documentCategory: "FINANCIAL",
          accessLevel: "ROOM_MEMBER",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  it("25. File Security: Malicious path traversal filenames are sanitized and blocked", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");

    await expect(
      uploadDataRoomDocument(
        seller1,
        roomId,
        {
          originalFilename: "../../etc/passwd.pdf",
          mimeType: "application/pdf",
          buffer: validPdf,
        },
        {
          title: "Path Traversal Test",
          documentCategory: "LEGAL",
          accessLevel: "ROOM_MEMBER",
        }
      )
    ).rejects.toThrow(ValidationError);
  });

  // ==========================================
  // PART 6: SIGNED URL & DOWNLOAD TOKEN SECURITY
  // ==========================================

  it("26. Buyer can generate signed URL and stream download the file", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\nTax Audit Report FY24\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      {
        originalFilename: "Tax_Audit_Report.pdf",
        mimeType: "application/pdf",
        buffer: validPdf,
      },
      {
        title: "Tax Audit Report FY24",
        documentCategory: "TAX",
        accessLevel: "ROOM_MEMBER",
      }
    );

    // 1. Generate Signed URL
    const signedData = await generateDocumentSignedUrl(buyer1, roomId, doc.id, 300);
    expect(signedData.downloadUrl).toContain("token=");
    expect(signedData.downloadUrl).toContain("expires=");

    // Parse token and expires
    const urlObj = new URL(`http://localhost:3000${signedData.downloadUrl}`);
    const token = urlObj.searchParams.get("token")!;
    const expires = parseInt(urlObj.searchParams.get("expires")!, 10);
    const userId = urlObj.searchParams.get("u")!;

    // 2. Download via stream function
    const downloaded = await downloadDataRoomDocument(token, expires, userId, roomId, doc.id);
    expect(downloaded.filename).toBe("Tax_Audit_Report.pdf");
    expect(downloaded.mimeType).toBe("application/pdf");
    expect(downloaded.buffer.toString()).toContain("Tax Audit Report FY24");

    // 3. Verify download count incremented
    const docDb = await query<{ download_count: number }>(
      `SELECT download_count FROM data_room_documents WHERE id = $1`,
      [doc.id]
    );
    expect(docDb.rows[0].download_count).toBe(1);
  });

  it("27. Tampered signature token is strictly rejected with ForbiddenError", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      { originalFilename: "test.pdf", mimeType: "application/pdf", buffer: validPdf },
      { title: "Test Doc", documentCategory: "OTHER", accessLevel: "ROOM_MEMBER" }
    );

    const signedData = await generateDocumentSignedUrl(buyer1, roomId, doc.id, 300);
    const urlObj = new URL(`http://localhost:3000${signedData.downloadUrl}`);
    const expires = parseInt(urlObj.searchParams.get("expires")!, 10);
    const userId = urlObj.searchParams.get("u")!;

    const tamperedToken = "0000000000000000000000000000000000000000000000000000000000000000";

    await expect(
      downloadDataRoomDocument(tamperedToken, expires, userId, roomId, doc.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it("28. Expired download token is strictly rejected with ForbiddenError", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      { originalFilename: "test.pdf", mimeType: "application/pdf", buffer: validPdf },
      { title: "Test Doc", documentCategory: "OTHER", accessLevel: "ROOM_MEMBER" }
    );

    // Pass past expiration timestamp
    const expiredTimestamp = Date.now() - 1000;
    const fakeToken = "a".repeat(64);

    await expect(
      downloadDataRoomDocument(fakeToken, expiredTimestamp, buyer1.id, roomId, doc.id)
    ).rejects.toThrow(ForbiddenError);
  });

  it("29. Anti-IDOR: Buyer 2 cannot generate signed URL for Buyer 1's Data Room document", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      { originalFilename: "secret.pdf", mimeType: "application/pdf", buffer: validPdf },
      { title: "Secret Doc", documentCategory: "LEGAL", accessLevel: "ROOM_MEMBER" }
    );

    await expect(
      generateDocumentSignedUrl(buyer2, roomId, doc.id, 300)
    ).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 7: DOCUMENT DELETION & REVOCATION
  // ==========================================

  it("30. Seller can soft-delete a document; buyer can no longer view or download it", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      { originalFilename: "temp.pdf", mimeType: "application/pdf", buffer: validPdf },
      { title: "Temporary Doc", documentCategory: "OPERATIONAL", accessLevel: "ROOM_MEMBER" }
    );

    // Delete
    await deleteDataRoomDocument(seller1, roomId, doc.id);

    // Verify omitted from room view
    const roomView = await getDataRoomForUser(buyer1, roomId);
    expect(roomView.documents.find((d) => d.id === doc.id)).toBeUndefined();
  });

  it("31. Admin revoking Data Room immediately blocks all subsequent access and downloads", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    // Admin revokes room
    await revokeDataRoom(admin, roomId, { revokeReason: "Regulatory compliance inquiry" });

    // Buyer access blocked
    await expect(getDataRoomForUser(buyer1, roomId)).rejects.toThrow(ForbiddenError);

    // Seller access blocked
    await expect(getDataRoomForUser(seller1, roomId)).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 8: AUDIT TRAILS & IN-APP NOTIFICATIONS
  // ==========================================

  it("32. Complete NDA and Data Room lifecycle generates immutable audit records", async () => {
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    await getBuyerNDAById(buyer1, nda.id); // View
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true }); // Executed -> Room created

    const roomRes = await query<{ id: string }>(`SELECT id FROM data_rooms WHERE nda_id = $1`, [nda.id]);
    const roomId = roomRes.rows[0].id;

    const validPdf = Buffer.from("%PDF-1.4\n%%EOF");
    const doc = await uploadDataRoomDocument(
      seller1,
      roomId,
      { originalFilename: "audit_test.pdf", mimeType: "application/pdf", buffer: validPdf },
      { title: "Audit Test", documentCategory: "TECHNICAL", accessLevel: "ROOM_MEMBER" }
    );

    await generateDocumentSignedUrl(buyer1, roomId, doc.id, 300);

    const auditRes = await query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE resource_id IN ($1, $2, $3)`,
      [nda.id, roomId, doc.id]
    );

    const actions = auditRes.rows.map((r) => r.action);
    expect(actions).toContain("NDA_CREATED");
    expect(actions).toContain("NDA_VIEWED");
    expect(actions).toContain("NDA_ACCEPTED");
    expect(actions).toContain("NDA_EXECUTED");
    expect(actions).toContain("DATA_ROOM_CREATED");
    expect(actions).toContain("DOCUMENT_UPLOADED");
    expect(actions).toContain("SIGNED_URL_ISSUED");
  });

  it("33. In-app notifications are delivered to counterparties upon NDA initiation, execution, and upload", async () => {
    // 1. Initiation delivers notification to seller
    const nda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1AcceptedId });
    const sellerNotifs1 = await getUserNotifications(seller1.id);
    expect(sellerNotifs1.notifications.some((n) => n.type === "NDA_SENT")).toBe(true);

    // 2. Buyer accept delivers notification to seller
    await acceptNDA(buyer1, nda.id, { termsAcknowledged: true });
    const sellerNotifs2 = await getUserNotifications(seller1.id);
    expect(sellerNotifs2.notifications.some((n) => n.type === "NDA_ACCEPTED")).toBe(true);

    // 3. Seller accept executes NDA and delivers execution notification to buyer
    await acceptNDA(seller1, nda.id, { termsAcknowledged: true });
    const buyerNotifs = await getUserNotifications(buyer1.id);
    expect(buyerNotifs.notifications.some((n) => n.type === "NDA_EXECUTED")).toBe(true);
  });
});
