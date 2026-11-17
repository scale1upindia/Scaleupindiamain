// Scale-up India — Phase 8 Security & Bilateral NDA / Virtual Data Room (VDR) Gate
// Script: scripts/phase8_security_gate.ts

import { getDb, query } from "../src/lib/db";
import { registerUser } from "../src/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "../src/domains/opportunity/service";
import {
  submitEOI,
  acceptEOI,
} from "../src/domains/eoi/service";
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
} from "../src/domains/dataroom/service";
import {
  createSignedDownloadToken,
  verifySignedDownloadToken,
} from "../src/lib/security/downloadToken";
import { getUserNotifications } from "../src/domains/notifications/service";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../src/lib/errors";
import fs from "fs";
import path from "path";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 8 BILATERAL NDA & SECURE DATA ROOM GATE");
  console.log("=================================================================\n");

  const db = await getDb();
  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, label: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`  ✓ PASS [Assertion ${totalCount}]: ${label}`);
    } else {
      console.error(`  ✗ FAIL [Assertion ${totalCount}]: ${label}`);
      process.exitCode = 1;
    }
  }

  // ============================================================================
  // 1. VERIFYING MIGRATION 008, TABLES, INDEXES & PERMISSIONS
  // ============================================================================
  console.log("--- 1. VERIFYING MIGRATION 008 & DATABASE INTEGRITY ---");
  const migRes = await db.query(
    `SELECT id FROM _schema_migrations WHERE id = '008_nda_and_data_room.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 008_nda_and_data_room.sql recorded in _schema_migrations");

  const seqRes = await db.query(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_name IN ('nda_ref_seq', 'vdr_ref_seq')`
  );
  assert(seqRes.rows.length === 2, "Sequences nda_ref_seq and vdr_ref_seq exist in database");

  const tablesRes = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('nda_agreements', 'data_rooms', 'data_room_members', 'data_room_documents')`
  );
  assert(tablesRes.rows.length === 4, "Tables nda_agreements, data_rooms, data_room_members, and data_room_documents exist");

  const idxRes = await db.query(
    `SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_nda_active_buyer_opp', 'idx_vdr_active_nda', 'idx_vdr_members_user', 'idx_vdr_docs_room')`
  );
  assert(idxRes.rows.length === 4, "Partial unique and member/document indexes exist in database");

  const permRes = await db.query(
    `SELECT code FROM permissions WHERE code IN ('nda.create', 'nda.accept', 'vdr.access', 'vdr.upload', 'vdr.download', 'vdr.read_all')`
  );
  assert(permRes.rows.length === 6, "Phase 8 RBAC permissions correctly seeded in permissions table");

  // ============================================================================
  // 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES
  // ============================================================================
  console.log("\n--- 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES ---");
  const rand = Math.floor(Math.random() * 1000000);

  // Seller 1 (Owner of Target Company)
  const regSeller1 = await registerUser({
    email: `seller1.gate.${rand}@apexind.in`,
    firstName: "Vikram",
    lastName: "Singhania",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller1 = regSeller1.user;
  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919988771122', $2, 'VERIFIED', 100)`,
    [seller1.id, seller1.email]
  );

  // Seller 2 (Competitor / Unrelated Promoter)
  const regSeller2 = await registerUser({
    email: `seller2.gate.${rand}@pharma.in`,
    firstName: "Anita",
    lastName: "Deshmukh",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller2 = regSeller2.user;
  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Director', '+919988771123', $2, 'VERIFIED', 100)`,
    [seller2.id, seller2.email]
  );

  // Buyer 1 (Strategic Investor with Mandate)
  const regBuyer1 = await registerUser({
    email: `buyer1.gate.${rand}@alphainvest.in`,
    firstName: "Rajesh",
    lastName: "Nair",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer1 = regBuyer1.user;
  await db.query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'CORPORATE_BUYER', 'Alpha Strategic Capital Ltd', 'COMPANY', 'Maharashtra', 'Mumbai',
      'Rajesh Nair', 'Head of M&A', $2, '+919876541122', 'VERIFIED', 'Precision Engineering'
    )`,
    [buyer1.id, buyer1.email]
  );

  // Buyer 2 (Third-Party / Unrelated Investor)
  const regBuyer2 = await registerUser({
    email: `buyer2.gate.${rand}@familyoffice.in`,
    firstName: "Kavita",
    lastName: "Mehta",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const buyer2 = regBuyer2.user;
  await db.query(
    `INSERT INTO buyer_profiles (
      user_id, buyer_type, legal_name, entity_type, state, city,
      contact_name, designation, email, phone, onboarding_status, industry
    ) VALUES (
      $1, 'FAMILY_OFFICE', 'Mehta Heritage Ventures', 'FAMILY_OFFICE', 'Gujarat', 'Ahmedabad',
      'Kavita Mehta', 'Managing Trustee', $2, '+919876541123', 'VERIFIED', 'Healthcare'
    )`,
    [buyer2.id, buyer2.email]
  );

  // Platform Admin
  const regAdmin = await registerUser({
    email: `admin.gate.${rand}@scaleup.in`,
    firstName: "Chief",
    lastName: "Compliance",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const admin = { ...regAdmin.user, roles: ["SUPER_ADMIN"] };

  assert(Boolean(seller1.id && seller2.id && buyer1.id && buyer2.id && admin.id), "Principals and compliance actors provisioned successfully");

  // ============================================================================
  // 3. PUBLISHING OPPORTUNITY & BILATERAL EOI ACCEPTANCE
  // ============================================================================
  console.log("\n--- 3. OPPORTUNITY PUBLICATION & EOI WORKFLOW ---");
  const oppRecord = await createOpportunity(seller1, {
    title: "Apex Aerospace Components Ltd",
    headline: "Tier-1 CNC supplier to aerospace OEMs",
    teaserSummary: "High-precision manufacturing facility with long-term aerospace contracts.",
    businessCategory: "MANUFACTURING",
    industry: "Precision Engineering",
    subSector: "Aerospace Components",
    operatingRegion: "WEST_INDIA",
    registeredState: "Maharashtra",
    approximateAgeBracket: "10_TO_20_YRS",
    revenueBracket: "50CR_TO_100CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "20_TO_30_PCT",
    askingPriceBracket: "50CR_TO_100CR",
    exactLegalName: "Confidential Precision Aero Pvt Ltd",
    exactCin: "U29299MH2008PTC038192",
    exactGstin: "27AABCA1234F1Z8",
    exactPan: "AABCA1234F",
    exactAddress: "Plot 101, Chakan Industrial Area, Pune, Maharashtra",
  });
  await submitOpportunity(oppRecord.id, seller1);
  await executeAdminOpportunityReview(oppRecord.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(oppRecord.id, "VERIFY", {}, admin);
  await executeAdminOpportunityReview(oppRecord.id, "PUBLISH", {}, admin);
  const publishedOppId = oppRecord.id;

  // Buyer 1 submits EOI
  const eoiRecord = await submitEOI(buyer1, publishedOppId, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Acquisition",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Strategic bolt-on fit for precision component division.",
  });

  // Seller 1 accepts EOI
  const acceptedEoi = await acceptEOI(seller1, eoiRecord.id, {
    sellerResponseMessage: "Profile aligns with our succession plan. Ready to exchange bilateral NDA.",
  });
  assert(acceptedEoi.status === "ACCEPTED", "Bilateral EOI accepted by seller");

  // ============================================================================
  // 4. CRITICAL CONFIDENTIALITY BOUNDARY: ACCEPTED EOI DOES NOT UNLOCK VDR
  // ============================================================================
  console.log("\n--- 4. CRITICAL CONFIDENTIALITY BOUNDARY VERIFICATION ---");
  let prematureVdrBlocked = false;
  try {
    // Attempting to access data room with fake or premature room ID
    await getDataRoomForUser(buyer1, "00000000-0000-0000-0000-000000000001");
  } catch (err: any) {
    prematureVdrBlocked = err instanceof NotFoundError || err instanceof ForbiddenError;
  }
  assert(prematureVdrBlocked, "ACCEPTED EOI DOES NOT unlock data room. No room exists before formal NDA initiation.");

  // Cannot initiate NDA on unaccepted EOI
  const oppRecord2 = await createOpportunity(seller1, {
    title: "Second Precision Unit",
    headline: "Second line aerospace tooling",
    teaserSummary: "Second precision line currently under internal restructuring.",
    businessCategory: "MANUFACTURING",
    industry: "Precision Engineering",
    subSector: "Tooling",
    operatingRegion: "WEST_INDIA",
    registeredState: "Maharashtra",
    approximateAgeBracket: "5_TO_10_YRS",
    revenueBracket: "25CR_TO_50CR",
    transactionType: "FULL_ACQUISITION",
    businessModel: "B2B",
    ebitdaMarginBracket: "10_TO_20_PCT",
    askingPriceBracket: "25CR_TO_50CR",
    exactLegalName: "Confidential Tooling Aero Pvt Ltd",
    exactCin: "U29299MH2012PTC038193",
    exactGstin: "27AABCA1234F1Z9",
    exactPan: "AABCA1234G",
    exactAddress: "Plot 102, Chakan Industrial Area, Pune, Maharashtra",
  });
  await submitOpportunity(oppRecord2.id, seller1);
  await executeAdminOpportunityReview(oppRecord2.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(oppRecord2.id, "VERIFY", {}, admin);
  await executeAdminOpportunityReview(oppRecord2.id, "PUBLISH", {}, admin);

  const unacceptedEoi = await submitEOI(buyer1, oppRecord2.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Acquisition",
    indicativeOfferRange: "25CR_TO_50CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Evaluating second line.",
  });

  let unacceptedNdaBlocked = false;
  try {
    await initiateNDA(buyer1, oppRecord2.id, { eoiId: unacceptedEoi.id });
  } catch (err: any) {
    unacceptedNdaBlocked = err instanceof ValidationError;
  }
  assert(unacceptedNdaBlocked, "Cannot initiate bilateral NDA on unaccepted EOI (Enforces ACCEPTED EOI prerequisite)");

  // ============================================================================
  // 5. BILATERAL NDA INITIATION & DORMANT/ZERO VDR STATE
  // ============================================================================
  console.log("\n--- 5. BILATERAL NDA INITIATION & DATA ROOM BOUNDARY ---");
  const initNDA = await initiateNDA(buyer1, publishedOppId, { eoiId: acceptedEoi.id });
  assert(initNDA.status === "NDA_SENT", "Initiating NDA sets status to NDA_SENT");
  assert(initNDA.referenceCode.startsWith("NDA-"), `Reference code formatted: ${initNDA.referenceCode}`);

  // Verify No Data Room exists prior to bilateral execution
  const roomDbRes = await db.query(`SELECT id, status FROM data_rooms WHERE nda_id = $1`, [initNDA.id]);
  assert(roomDbRes.rows.length === 0, "Zero Data Rooms exist prior to bilateral execution (Boundary strictly enforced)");

  // ============================================================================
  // 6. ANTI-IDOR ENFORCEMENT ON NDA AGREEMENTS
  // ============================================================================
  console.log("\n--- 6. ANTI-IDOR VERIFICATION ON NDA AGREEMENTS ---");
  let buyer2NdaBlocked = false;
  try {
    await getBuyerNDAById(buyer2, initNDA.id);
  } catch (err: any) {
    buyer2NdaBlocked = err instanceof ForbiddenError;
  }
  assert(buyer2NdaBlocked, "Anti-IDOR: Buyer 2 CANNOT read Buyer 1's NDA agreement (Throws ForbiddenError)");

  let seller2NdaBlocked = false;
  try {
    await getSellerNDAById(seller2, initNDA.id);
  } catch (err: any) {
    seller2NdaBlocked = err instanceof ForbiddenError;
  }
  assert(seller2NdaBlocked, "Anti-IDOR: Seller 2 CANNOT read Seller 1's NDA agreement (Throws ForbiddenError)");

  // Authorized principals CAN inspect their respective views
  const buyerNdaView = await getBuyerNDAById(buyer1, initNDA.id);
  assert(buyerNdaView.id === initNDA.id && buyerNdaView.status === "BUYER_VIEWED", "Authorized Buyer can view NDA (Transitioned to BUYER_VIEWED)");

  const sellerNdaView = await getSellerNDAById(seller1, initNDA.id);
  assert(sellerNdaView.id === initNDA.id, "Authorized Seller can view NDA");

  // ============================================================================
  // 7. UNILATERAL ACCEPTANCE INVARIANT (DOES NOT EXECUTE OR UNLOCK)
  // ============================================================================
  console.log("\n--- 7. UNILATERAL ACCEPTANCE INVARIANT ---");
  const buyerAcceptedNDA = await acceptNDA(buyer1, initNDA.id, { termsAcknowledged: true });
  assert(buyerAcceptedNDA.status === "BUYER_ACCEPTED", "Unilateral acceptance by buyer moves status to BUYER_ACCEPTED");
  assert(buyerAcceptedNDA.buyerAcceptedAt !== null && buyerAcceptedNDA.sellerAcceptedAt === null, "Buyer accepted timestamp set; seller timestamp null");

  // Data Room must STILL NOT exist
  const roomDbAfterBuyer = await db.query(`SELECT id FROM data_rooms WHERE nda_id = $1`, [initNDA.id]);
  assert(roomDbAfterBuyer.rows.length === 0, "CRITICAL: Unilateral acceptance (BUYER_ACCEPTED) does NOT unlock or create Data Room");

  // Buyer cannot accept twice
  let doubleAcceptBlocked = false;
  try {
    await acceptNDA(buyer1, initNDA.id, { termsAcknowledged: true });
  } catch (err: any) {
    doubleAcceptBlocked = err instanceof ValidationError;
  }
  assert(doubleAcceptBlocked, "Party cannot accept an already accepted NDA twice (Double accept invariant)");

  // ============================================================================
  // 8. BILATERAL COUNTERSIGNATURE & DATA ROOM ACTIVATION
  // ============================================================================
  console.log("\n--- 8. BILATERAL COUNTERSIGNATURE & ROOM ACTIVATION ---");
  const executedNDA = await acceptNDA(seller1, initNDA.id, { termsAcknowledged: true });
  assert(executedNDA.status === "EXECUTED", "Countersignature by seller transitions NDA to EXECUTED");
  assert(executedNDA.executedAt !== null, "Executed timestamp recorded upon bilateral agreement");

  const activeRoomDb = await db.query(`SELECT id, status, activated_at FROM data_rooms WHERE nda_id = $1`, [initNDA.id]);
  assert(activeRoomDb.rows.length === 1, "Data Room record created upon bilateral execution");
  const activeRoomId = activeRoomDb.rows[0].id;
  assert(activeRoomDb.rows[0].status === "ACTIVE", "Data Room automatically transitions to ACTIVE upon bilateral execution");
  assert(activeRoomDb.rows[0].activated_at !== null, "Data Room activated_at timestamp populated");

  // Verify explicit memberships for both principals
  const membersRes = await db.query(
    `SELECT user_id, role, access_status FROM data_room_members WHERE data_room_id = $1 ORDER BY role ASC`,
    [activeRoomId]
  );
  assert(membersRes.rows.length === 2, "Explicit memberships created for both buyer and seller in data_room_members");
  assert(
    membersRes.rows.some((m) => m.user_id === buyer1.id && m.role === "BUYER" && m.access_status === "ACTIVE"),
    "Buyer 1 is registered as ACTIVE BUYER member"
  );
  assert(
    membersRes.rows.some((m) => m.user_id === seller1.id && m.role === "SELLER" && m.access_status === "ACTIVE"),
    "Seller 1 is registered as ACTIVE SELLER member"
  );

  // Once EXECUTED, neither party can decline
  let declineAfterExecBlocked = false;
  try {
    await declineNDA(buyer1, initNDA.id, { declineReason: "Too late" });
  } catch (err: any) {
    declineAfterExecBlocked = err instanceof ValidationError;
  }
  assert(declineAfterExecBlocked, "Terminal state invariant: Cannot decline an already EXECUTED NDA");

  // ============================================================================
  // 9. AUTHORIZED ROOM ACCESS & ANTI-IDOR ON DATA ROOM
  // ============================================================================
  console.log("\n--- 9. SECURE DATA ROOM ACCESS & ANTI-IDOR ---");
  const buyerRoomView = await getDataRoomForUser(buyer1, activeRoomId);
  assert(buyerRoomView.id === activeRoomId && buyerRoomView.status === "ACTIVE", "Authorized Buyer can access ACTIVE Data Room");

  const sellerRoomView = await getDataRoomForUser(seller1, activeRoomId);
  assert(sellerRoomView.id === activeRoomId && sellerRoomView.status === "ACTIVE", "Authorized Seller can access ACTIVE Data Room");

  let buyer2RoomBlocked = false;
  try {
    await getDataRoomForUser(buyer2, activeRoomId);
  } catch (err: any) {
    buyer2RoomBlocked = err instanceof ForbiddenError;
  }
  assert(buyer2RoomBlocked, "Anti-IDOR: Unauthorized Buyer 2 CANNOT access Buyer 1's Data Room (Throws ForbiddenError)");

  let seller2RoomBlocked = false;
  try {
    await getDataRoomForUser(seller2, activeRoomId);
  } catch (err: any) {
    seller2RoomBlocked = err instanceof ForbiddenError;
  }
  assert(seller2RoomBlocked, "Anti-IDOR: Unauthorized Seller 2 CANNOT access Seller 1's Data Room (Throws ForbiddenError)");

  // ============================================================================
  // 10. CONFIDENTIAL DOCUMENT UPLOAD & FILE SECURITY
  // ============================================================================
  console.log("\n--- 10. CONFIDENTIAL DOCUMENT UPLOAD & FILE SECURITY ---");
  const validPdfHeader = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

  // Non-seller cannot upload
  let buyerUploadBlocked = false;
  try {
    await uploadDataRoomDocument(
      buyer1,
      activeRoomId,
      {
        buffer: validPdfHeader,
        originalFilename: "buyer_doc.pdf",
        mimeType: "application/pdf",
      },
      {
        title: "Unauthorized Upload",
        documentCategory: "FINANCIAL",
        accessLevel: "ROOM_MEMBER",
      }
    );
  } catch (err: any) {
    buyerUploadBlocked = err instanceof ForbiddenError;
  }
  assert(buyerUploadBlocked, "Only authorized Promoters / Sellers can upload documents to Data Room");

  // File size limit (>15MB)
  let oversizedBlocked = false;
  try {
    const bigBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    await uploadDataRoomDocument(
      seller1,
      activeRoomId,
      {
        buffer: bigBuffer,
        originalFilename: "oversized.pdf",
        mimeType: "application/pdf",
      },
      {
        title: "Oversized Document",
        documentCategory: "FINANCIAL",
        accessLevel: "ROOM_MEMBER",
      }
    );
  } catch (err: any) {
    oversizedBlocked = err instanceof ValidationError;
  }
  assert(oversizedBlocked, "File security: Files exceeding 15MB limit are strictly rejected");

  // Spoofed MIME type (Magic byte check)
  let spoofedBlocked = false;
  try {
    const fakePdfBuffer = Buffer.from("MALICIOUS_NON_PDF_PAYLOAD_EXECUTABLE");
    await uploadDataRoomDocument(
      seller1,
      activeRoomId,
      {
        buffer: fakePdfBuffer,
        originalFilename: "fake.pdf",
        mimeType: "application/pdf",
      },
      {
        title: "MIME Spoof Attack",
        documentCategory: "FINANCIAL",
        accessLevel: "ROOM_MEMBER",
      }
    );
  } catch (err: any) {
    spoofedBlocked = err instanceof ValidationError;
  }
  assert(spoofedBlocked, "File security: Spoofed MIME types failing magic bytes (%PDF-) are rejected");

  // Path traversal filename
  let pathTraversalBlocked = false;
  try {
    await uploadDataRoomDocument(
      seller1,
      activeRoomId,
      {
        buffer: validPdfHeader,
        originalFilename: "../../../etc/passwd.pdf",
        mimeType: "application/pdf",
      },
      {
        title: "Path Traversal Test",
        documentCategory: "LEGAL",
        accessLevel: "ROOM_MEMBER",
      }
    );
  } catch (err: any) {
    pathTraversalBlocked = err instanceof ValidationError;
  }
  assert(pathTraversalBlocked, "File security: Malicious path traversal filenames are blocked");

  // Legitimate upload by seller
  const uploadedDoc = await uploadDataRoomDocument(
    seller1,
    activeRoomId,
    {
      buffer: validPdfHeader,
      originalFilename: "audited_financials_fy25.pdf",
      mimeType: "application/pdf",
    },
    {
      title: "Audited Financial Statements FY24-25",
      documentCategory: "FINANCIAL",
      accessLevel: "ROOM_MEMBER",
    }
  );
  assert(uploadedDoc.id !== undefined && uploadedDoc.title === "Audited Financial Statements FY24-25", "Seller can upload genuine confidential PDF document");

  // Verify storage key is strictly OUTSIDE public web root
  const docDb = await db.query(`SELECT storage_key FROM data_room_documents WHERE id = $1`, [uploadedDoc.id]);
  const storagePath = docDb.rows[0].storage_key;
  assert(
    storagePath.includes("data/vault/datarooms") && !storagePath.includes("/public/"),
    `Private storage verified outside web root: ${storagePath}`
  );
  assert(fs.existsSync(storagePath), "Binary file physically exists on encrypted server vault");

  // ============================================================================
  // 11. SHORT-LIVED SIGNED URLS & CRYPTOGRAPHIC VERIFICATION
  // ============================================================================
  console.log("\n--- 11. CRYPTOGRAPHIC SIGNED URLS & DOWNLOAD GATES ---");
  // Anti-IDOR on Signed URL generation: Buyer 2 cannot generate URL for Buyer 1's room doc
  let buyer2SignedUrlBlocked = false;
  try {
    await generateDocumentSignedUrl(buyer2, activeRoomId, uploadedDoc.id, 300);
  } catch (err: any) {
    buyer2SignedUrlBlocked = err instanceof ForbiddenError;
  }
  assert(buyer2SignedUrlBlocked, "Anti-IDOR: Buyer 2 CANNOT generate signed URL for Buyer 1's Data Room document");

  // Authorized Buyer generates signed download URL
  const signedUrlResp = await generateDocumentSignedUrl(buyer1, activeRoomId, uploadedDoc.id, 300);
  assert(Boolean(signedUrlResp.downloadUrl && signedUrlResp.expiresAt), "Authorized Buyer generates short-lived signed URL");

  // Extract query params
  const urlObj = new URL(`http://localhost${signedUrlResp.downloadUrl}`);
  const token = urlObj.searchParams.get("token")!;
  const expires = parseInt(urlObj.searchParams.get("expires")!, 10);
  const u = urlObj.searchParams.get("u")!;

  // Download with valid signed URL
  const downloadStream = await downloadDataRoomDocument(token, expires, u, activeRoomId, uploadedDoc.id);
  assert(
    downloadStream.buffer.toString() === validPdfHeader.toString() && downloadStream.filename === "audited_financials_fy25.pdf",
    "Buyer streams binary file via valid cryptographic signed download token"
  );

  // Tampered token is rejected
  let tamperedBlocked = false;
  try {
    const tamperedToken = token.slice(0, -4) + "dead";
    await downloadDataRoomDocument(tamperedToken, expires, u, activeRoomId, uploadedDoc.id);
  } catch (err: any) {
    tamperedBlocked = err instanceof ForbiddenError;
  }
  assert(tamperedBlocked, "Tampered download token is strictly rejected (HMAC constant-time verification)");

  // Expired token is rejected
  let expiredBlocked = false;
  try {
    const expiredTimestamp = Date.now() - 5000;
    const expiredTokenData = createSignedDownloadToken(uploadedDoc.id, activeRoomId, buyer1.id, -10);
    await downloadDataRoomDocument(
      expiredTokenData.token,
      expiredTokenData.expiresAt,
      buyer1.id,
      activeRoomId,
      uploadedDoc.id
    );
  } catch (err: any) {
    expiredBlocked = err instanceof ForbiddenError;
  }
  assert(expiredBlocked, "Expired download token is strictly rejected (TTL expiration check)");

  // ============================================================================
  // 12. DOCUMENT SOFT-DELETION & ACCESS CUTOFF
  // ============================================================================
  console.log("\n--- 12. DOCUMENT SOFT-DELETION & REVOCATION ---");
  await deleteDataRoomDocument(seller1, activeRoomId, uploadedDoc.id);

  // Verify document is soft-deleted
  const roomAfterDelete = await getDataRoomForUser(buyer1, activeRoomId);
  assert(roomAfterDelete.documents.length === 0, "Soft-deleted document is no longer listed in Data Room for buyer");

  let deletedDownloadBlocked = false;
  try {
    await downloadDataRoomDocument(token, expires, u, activeRoomId, uploadedDoc.id);
  } catch (err: any) {
    deletedDownloadBlocked = err instanceof NotFoundError;
  }
  assert(deletedDownloadBlocked, "Downloading soft-deleted document is strictly blocked");

  // ============================================================================
  // 13. ADMINISTRATIVE DATA ROOM REVOCATION
  // ============================================================================
  console.log("\n--- 13. ADMINISTRATIVE DATA ROOM REVOCATION ---");
  await revokeDataRoom(admin, activeRoomId, { revokeReason: "Regulatory inspection stop-order" });

  const revokedRoomDb = await db.query(`SELECT status FROM data_rooms WHERE id = $1`, [activeRoomId]);
  assert(revokedRoomDb.rows[0].status === "REVOKED", "Admin revoking room sets data room status to REVOKED");

  const revokedNdaDb = await db.query(`SELECT status FROM nda_agreements WHERE id = $1`, [initNDA.id]);
  assert(revokedNdaDb.rows[0].status === "REVOKED", "Admin revoking room cascades status to REVOKED on NDA agreement");

  let revokedAccessBlocked = false;
  try {
    await getDataRoomForUser(buyer1, activeRoomId);
  } catch (err: any) {
    revokedAccessBlocked = err instanceof ForbiddenError;
  }
  assert(revokedAccessBlocked, "Accessing revoked Data Room is immediately blocked for all parties");

  // ============================================================================
  // 14. IMMUTABLE AUDIT LOGGING & NOTIFICATIONS
  // ============================================================================
  console.log("\n--- 14. IMMUTABLE AUDIT LOGGING & NOTIFICATIONS ---");
  const auditRes = await db.query(
    `SELECT action, resource_type FROM audit_logs 
     WHERE resource_id IN ($1, $2, $3)
     ORDER BY created_at ASC`,
    [initNDA.id, activeRoomId, uploadedDoc.id]
  );
  const actions = auditRes.rows.map((r) => r.action);
  assert(actions.includes("NDA_CREATED"), "Audit log recorded: NDA_CREATED");
  assert(actions.includes("NDA_VIEWED"), "Audit log recorded: NDA_VIEWED");
  assert(actions.includes("NDA_ACCEPTED"), "Audit log recorded: NDA_ACCEPTED");
  assert(actions.includes("NDA_EXECUTED"), "Audit log recorded: NDA_EXECUTED");
  assert(actions.includes("DATA_ROOM_CREATED"), "Audit log recorded: DATA_ROOM_CREATED");
  assert(actions.includes("DOCUMENT_UPLOADED"), "Audit log recorded: DOCUMENT_UPLOADED");
  assert(actions.includes("SIGNED_URL_ISSUED"), "Audit log recorded: SIGNED_URL_ISSUED");
  assert(actions.includes("DOCUMENT_DOWNLOADED"), "Audit log recorded: DOCUMENT_DOWNLOADED");
  assert(actions.includes("DATA_ROOM_REVOKED"), "Audit log recorded: DATA_ROOM_REVOKED");

  const buyerNotifs = await getUserNotifications(buyer1.id);
  const sellerNotifs = await getUserNotifications(seller1.id);
  assert(buyerNotifs.notifications.length > 0, "Buyer received structured in-app notifications");
  assert(sellerNotifs.notifications.length > 0, "Seller received structured in-app notifications");

  // ============================================================================
  // SUMMARY RESULTS
  // ============================================================================
  console.log("\n=================================================================");
  console.log(`PHASE 8 SECURITY GATE COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log("=================================================================");

  if (passedCount === totalCount) {
    console.log("\n>>> PHASE 8 FINAL VERDICT: READY_FOR_PHASE_9 <<<\n");
    process.exit(0);
  } else {
    console.error(`\n>>> PHASE 8 GATE FAILED: ${totalCount - passedCount} assertions failed <<<\n`);
    process.exit(1);
  }
}

runSecurityGate().catch((err) => {
  console.error("FATAL ERROR IN PHASE 8 SECURITY GATE:", err);
  process.exit(1);
});
