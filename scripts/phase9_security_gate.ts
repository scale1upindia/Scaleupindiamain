// Scale-up India — Phase 9 Security & Confidential Deal Communication Gate
// Script: scripts/phase9_security_gate.ts

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
  acceptNDA,
} from "../src/domains/dataroom/service";
import {
  initiateDealConversation,
  getDealConversationsForUser,
  getDealConversationById,
  sendDealMessage,
  getPaginatedMessages,
  markConversationRead,
  softDeleteDealMessage,
  closeDealConversation,
  revokeDealConversation,
  resetMessageRateLimits,
} from "../src/domains/messaging/service";
import { getUserNotifications } from "../src/domains/notifications/service";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "../src/lib/errors";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 9 SECURE DEAL COMMUNICATION GATE");
  console.log("=================================================================\n");

  resetMessageRateLimits();
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
  // 1. VERIFYING MIGRATION 009, TABLES, INDEXES & PERMISSIONS
  // ============================================================================
  console.log("--- 1. VERIFYING MIGRATION 009 & DATABASE INTEGRITY ---");
  const migRes = await db.query(
    `SELECT id FROM _schema_migrations WHERE id = '009_secure_deal_communication.sql'`
  );
  assert(migRes.rows.length === 1, "Migration 009_secure_deal_communication.sql recorded in _schema_migrations");

  const seqRes = await db.query(
    `SELECT sequence_name FROM information_schema.sequences WHERE sequence_name = 'conv_ref_seq'`
  );
  assert(seqRes.rows.length === 1, "Sequence conv_ref_seq exists in database");

  const tablesRes = await db.query(
    `SELECT table_name FROM information_schema.tables WHERE table_name IN ('deal_conversations', 'deal_conversation_participants', 'deal_messages')`
  );
  assert(tablesRes.rows.length === 3, "Tables deal_conversations, deal_conversation_participants, and deal_messages exist");

  const idxRes = await db.query(
    `SELECT indexname FROM pg_indexes WHERE indexname IN ('idx_deal_conv_active_nda', 'idx_deal_participants_conv', 'idx_deal_messages_conv_created')`
  );
  assert(idxRes.rows.length === 3, "Partial unique and message ordering indexes exist in database");

  const permRes = await db.query(
    `SELECT code FROM permissions WHERE code IN ('messaging.read', 'messaging.send', 'messaging.close', 'messaging.manage', 'messaging.read_all')`
  );
  assert(permRes.rows.length === 5, "Phase 9 RBAC permissions correctly seeded in permissions table");

  // ============================================================================
  // 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES
  // ============================================================================
  console.log("\n--- 2. PROVISIONING PRINCIPALS & VERIFIED PROFILES ---");
  const rand = Math.floor(Math.random() * 1000000);

  // Seller 1 (Promoter)
  const regSeller1 = await registerUser({
    email: `seller1.gate.${rand}@aeroengines.in`,
    firstName: "Vikram",
    lastName: "Singhania",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller1 = regSeller1.user;
  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Managing Director', '+919988772233', $2, 'VERIFIED', 100)`,
    [seller1.id, seller1.email]
  );

  // Seller 2 (Unrelated Promoter)
  const regSeller2 = await registerUser({
    email: `seller2.gate.${rand}@pharmatech.in`,
    firstName: "Anita",
    lastName: "Deshmukh",
    password: "Password@123",
    roles: ["PROMOTER"],
  });
  const seller2 = regSeller2.user;
  await db.query(
    `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
     VALUES ($1, 'Director', '+919988772234', $2, 'VERIFIED', 100)`,
    [seller2.id, seller2.email]
  );

  // Buyer 1 (Acquirer)
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
      'Rajesh Nair', 'Head of M&A', $2, '+919876542233', 'VERIFIED', 'Precision Engineering'
    )`,
    [buyer1.id, buyer1.email]
  );

  // Buyer 2 (Unrelated Acquirer)
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
      'Kavita Mehta', 'Managing Trustee', $2, '+919876542234', 'VERIFIED', 'Healthcare'
    )`,
    [buyer2.id, buyer2.email]
  );

  // Compliance Admin
  const regAdmin = await registerUser({
    email: `admin.gate.${rand}@scaleup.in`,
    firstName: "Chief",
    lastName: "Compliance",
    password: "Password@123",
    roles: ["BUYER"],
  });
  const admin = {
    ...regAdmin.user,
    roles: ["SUPER_ADMIN"],
    permissions: [
      "opportunities.read_all",
      "opportunities.review",
      "opportunities.publish",
      "eoi.read_all",
      "nda.read_all",
      "vdr.read_all",
      "messaging.read_all",
      "messaging.manage",
    ],
  };

  assert(Boolean(seller1.id && seller2.id && buyer1.id && buyer2.id && admin.id), "Principals and compliance actors provisioned successfully");

  // ============================================================================
  // 3. SEEDING PUBLISHED OPPORTUNITIES & BILATERAL NDA EXECUTION
  // ============================================================================
  console.log("\n--- 3. OPPORTUNITY PUBLICATION & BILATERAL NDA EXECUTION ---");
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

  // Buyer 1 submits EOI and Seller 1 accepts
  const eoiRecord = await submitEOI(buyer1, publishedOppId, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Acquisition",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Strategic bolt-on fit for precision component division.",
  });
  await acceptEOI(seller1, eoiRecord.id, {
    sellerResponseMessage: "Profile aligns with our succession plan. Ready to exchange bilateral NDA.",
  });

  // Bilateral NDA Execution
  const initNda = await initiateNDA(buyer1, publishedOppId, { eoiId: eoiRecord.id });
  await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
  const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });
  assert(executedNda.status === "EXECUTED", "Bilateral NDA fully EXECUTED by both principals");

  // ============================================================================
  // 4. CRITICAL PREREQUISITE: UNEXECUTED NDA CANNOT INITIATE DISCUSSION
  // ============================================================================
  console.log("\n--- 4. WORKFLOW PREREQUISITE & EXECUTION GATE ---");
  const oppRecord2 = await createOpportunity(seller1, {
    title: "Second Aerospace Line",
    headline: "Tooling Division",
    teaserSummary: "Second line aerospace tooling currently unreleased.",
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
  await acceptEOI(seller1, unacceptedEoi.id, { sellerResponseMessage: "Accepted for NDA." });
  const unexecutedNda = await initiateNDA(buyer1, oppRecord2.id, { eoiId: unacceptedEoi.id });

  let unexecutedConvBlocked = false;
  try {
    await initiateDealConversation(buyer1, oppRecord2.id, { ndaId: unexecutedNda.id });
  } catch (err: any) {
    unexecutedConvBlocked = err instanceof ValidationError;
  }
  assert(unexecutedConvBlocked, "Bilateral NDA Execution Gate: Cannot initiate conversation on unexecuted NDA");

  // ============================================================================
  // 5. CONVERSATION CREATION & IDEMPOTENCY
  // ============================================================================
  console.log("\n--- 5. CONVERSATION INITIALIZATION & IDEMPOTENCY ---");
  const conv = await initiateDealConversation(buyer1, publishedOppId, {
    ndaId: executedNda.id,
    title: "Apex Aerospace Acquisition Diligence Discussion",
  });
  assert(conv.status === "ACTIVE", "Conversation status is ACTIVE");
  assert(conv.referenceCode.startsWith("CONV-"), `Reference code formatted: ${conv.referenceCode}`);
  assert(conv.userRole === "BUYER" && conv.counterpartyRole === "SELLER", "Participant roles correctly resolved");

  // Idempotency: Seller initiating returns existing conversation
  const sellerConvInit = await initiateDealConversation(seller1, publishedOppId, {
    ndaId: executedNda.id,
  });
  assert(sellerConvInit.id === conv.id, "Idempotent initiation: Counterparty receives existing conversation record");

  // DB verification: Exactly 1 conversation record exists for this NDA
  const dbConvCount = await db.query(
    `SELECT COUNT(*) as count FROM deal_conversations WHERE nda_id = $1`,
    [executedNda.id]
  );
  assert(parseInt(dbConvCount.rows[0].count, 10) === 1, "Partial unique index guarantees exactly ONE conversation per bilateral NDA");

  // Explicit server-controlled participants in database
  const partRes = await db.query(
    `SELECT user_id, role, status FROM deal_conversation_participants WHERE conversation_id = $1 ORDER BY role ASC`,
    [conv.id]
  );
  assert(partRes.rows.length === 2, "Exactly 2 explicit participants registered in deal_conversation_participants");
  assert(
    partRes.rows.some((p) => p.user_id === buyer1.id && p.role === "BUYER" && p.status === "ACTIVE"),
    "Buyer 1 explicitly registered as ACTIVE BUYER participant"
  );
  assert(
    partRes.rows.some((p) => p.user_id === seller1.id && p.role === "SELLER" && p.status === "ACTIVE"),
    "Seller 1 explicitly registered as ACTIVE SELLER participant"
  );

  // ============================================================================
  // 6. ANTI-IDOR AUTHORIZATION DECISIONS
  // ============================================================================
  console.log("\n--- 6. ANTI-IDOR VERIFICATION ON CONVERSATIONS ---");
  let buyer2AccessBlocked = false;
  try {
    await getDealConversationById(buyer2, conv.id);
  } catch (err: any) {
    buyer2AccessBlocked = err instanceof ForbiddenError;
  }
  assert(buyer2AccessBlocked, "Anti-IDOR: Unauthorized Buyer 2 CANNOT read Buyer 1's deal conversation (Throws ForbiddenError)");

  let seller2AccessBlocked = false;
  try {
    await getDealConversationById(seller2, conv.id);
  } catch (err: any) {
    seller2AccessBlocked = err instanceof ForbiddenError;
  }
  assert(seller2AccessBlocked, "Anti-IDOR: Unauthorized Seller 2 CANNOT read Seller 1's deal conversation (Throws ForbiddenError)");

  let buyer2MsgBlocked = false;
  try {
    await sendDealMessage(buyer2, conv.id, { content: "Unauthorized injection attempt." });
  } catch (err: any) {
    buyer2MsgBlocked = err instanceof ForbiddenError;
  }
  assert(buyer2MsgBlocked, "Anti-IDOR: Unauthorized Buyer 2 CANNOT send messages in Buyer 1's conversation (Throws ForbiddenError)");

  let seller2MsgBlocked = false;
  try {
    await sendDealMessage(seller2, conv.id, { content: "Unauthorized injection attempt." });
  } catch (err: any) {
    seller2MsgBlocked = err instanceof ForbiddenError;
  }
  assert(seller2MsgBlocked, "Anti-IDOR: Unauthorized Seller 2 CANNOT send messages in Seller 1's conversation (Throws ForbiddenError)");

  // Authorized participants CAN retrieve their conversation view
  const buyerView = await getDealConversationById(buyer1, conv.id);
  assert(buyerView.id === conv.id && buyerView.userRole === "BUYER", "Authorized Buyer can view deal conversation");

  const sellerView = await getDealConversationById(seller1, conv.id);
  assert(sellerView.id === conv.id && sellerView.userRole === "SELLER", "Authorized Seller can view deal conversation");

  // ============================================================================
  // 7. MESSAGE PERSISTENCE & INPUT VALIDATION GATES
  // ============================================================================
  console.log("\n--- 7. MESSAGE PERSISTENCE & VALIDATION GATES ---");
  // Empty message rejected
  let emptyBlocked = false;
  try {
    await sendDealMessage(buyer1, conv.id, { content: "     " });
  } catch (err: any) {
    emptyBlocked = err instanceof ValidationError;
  }
  assert(emptyBlocked, "Input validation: Whitespace-only or empty message rejected with ValidationError");

  // Oversized message rejected (>4000 characters)
  let oversizedBlocked = false;
  try {
    const bigContent = "M".repeat(4001);
    await sendDealMessage(buyer1, conv.id, { content: bigContent });
  } catch (err: any) {
    oversizedBlocked = err instanceof ValidationError;
  }
  assert(oversizedBlocked, "Input validation: Message exceeding 4000 characters rejected with ValidationError");

  // Null bytes rejected
  let nullByteBlocked = false;
  try {
    await sendDealMessage(buyer1, conv.id, { content: "Malicious\0Payload" });
  } catch (err: any) {
    nullByteBlocked = err instanceof ValidationError;
  }
  assert(nullByteBlocked, "Input validation: Null bytes strictly rejected with ValidationError");

  // Mass-assignment protection: Sender is strictly derived from session
  const validBuyerMsg = await sendDealMessage(buyer1, conv.id, {
    content: "We have reviewed the audited accounts and would like to clarify FY24 debtor days.",
    ...({ senderUserId: seller1.id, senderRole: "SELLER" } as any),
  });
  assert(validBuyerMsg.id !== undefined && validBuyerMsg.status === "SENT", "Authorized Buyer sends valid deal message");
  const msgDbRes = await db.query(`SELECT sender_user_id FROM deal_messages WHERE id = $1`, [validBuyerMsg.id]);
  assert(msgDbRes.rows[0].sender_user_id === buyer1.id, "Mass-assignment defense: Sender ID strictly derived from session");

  // XSS Defense: Content preserved as plain text, no raw HTML execution
  const xssPayload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>";
  const xssMsg = await sendDealMessage(seller1, conv.id, { content: xssPayload });
  assert(xssMsg.content === xssPayload, "XSS defense: Content safely preserved as safe plain text");

  // ============================================================================
  // 8. READ STATE ISOLATION & UNREAD COUNT TRACKING
  // ============================================================================
  console.log("\n--- 8. READ STATE ISOLATION & UNREAD COUNT TRACKING ---");
  // Buyer has 1 unread message from seller (the XSS message)
  const buyerConvBeforeRead = await getDealConversationById(buyer1, conv.id);
  assert(buyerConvBeforeRead.unreadCount >= 1, "Unread count accurately tracked for recipient");

  // Buyer marks read
  await markConversationRead(buyer1, conv.id);
  const buyerConvAfterRead = await getDealConversationById(buyer1, conv.id);
  assert(buyerConvAfterRead.unreadCount === 0, "Marking read resets unread count for authenticated participant");

  // Anti-IDOR on read state
  let unauthorizedReadBlocked = false;
  try {
    await markConversationRead(buyer2, conv.id);
  } catch (err: any) {
    unauthorizedReadBlocked = err instanceof ForbiddenError;
  }
  assert(unauthorizedReadBlocked, "Anti-IDOR: Unauthorized user CANNOT modify read state in another deal conversation");

  // ============================================================================
  // 9. CURSOR-BASED PAGINATION
  // ============================================================================
  console.log("\n--- 9. CURSOR-BASED PAGINATION ---");
  const page1 = await getPaginatedMessages(buyer1, conv.id, { limit: 1 });
  assert(page1.messages.length === 1, "Cursor pagination respects bounded page limit");
  assert(page1.hasMore === true && Boolean(page1.nextCursor), "Pagination returns stable next cursor when more items exist");

  const page2 = await getPaginatedMessages(buyer1, conv.id, {
    limit: 10,
    cursor: page1.nextCursor || undefined,
  });
  assert(page2.messages.length >= 1, "Cursor pagination fetches successive chronological stream");

  // Tampered cursor handled safely
  let tamperedCursorHandled = false;
  try {
    await getPaginatedMessages(buyer1, conv.id, { limit: 10, cursor: "INVALID_BASE64_GARBAGE" });
    tamperedCursorHandled = true;
  } catch (err: any) {
    tamperedCursorHandled = err instanceof ValidationError;
  }
  assert(tamperedCursorHandled, "Tampered pagination cursor handled safely without crashes");

  // ============================================================================
  // 10. SOFT DELETION & AUDIT PRESERVATION
  // ============================================================================
  console.log("\n--- 10. SOFT DELETION & AUDIT PRESERVATION ---");
  // Non-author cannot delete message
  let unauthorizedDeleteBlocked = false;
  try {
    await softDeleteDealMessage(seller1, conv.id, validBuyerMsg.id);
  } catch (err: any) {
    unauthorizedDeleteBlocked = err instanceof ForbiddenError;
  }
  assert(unauthorizedDeleteBlocked, "Anti-IDOR: Participant CANNOT delete another participant's message");

  // Author soft-deletes message
  await softDeleteDealMessage(buyer1, conv.id, validBuyerMsg.id);
  const historyAfterDelete = await getPaginatedMessages(seller1, conv.id, { limit: 10 });
  const deletedView = historyAfterDelete.messages.find((m) => m.id === validBuyerMsg.id);
  assert(deletedView?.status === "SOFT_DELETED", "Message status updated to SOFT_DELETED in database");
  assert(Boolean(deletedView?.content.includes("deleted by the sender")), "Soft-deleted content safely masked with audit placeholder");

  // ============================================================================
  // 11. STATE MACHINE ENFORCEMENT (CLOSE & REVOKE)
  // ============================================================================
  console.log("\n--- 11. STATE MACHINE ENFORCEMENT ---");
  const closedConv = await closeDealConversation(buyer1, conv.id, {
    closeReason: "Preliminary commercial discussion concluded. Proceeding to formal MOU staging.",
  });
  assert(closedConv.status === "CLOSED", "Closing conversation moves status to CLOSED");

  // Message creation rejected in CLOSED conversation
  let msgInClosedBlocked = false;
  try {
    await sendDealMessage(seller1, conv.id, { content: "Attempting message in closed conversation." });
  } catch (err: any) {
    msgInClosedBlocked = err instanceof ValidationError;
  }
  assert(msgInClosedBlocked, "State machine: Cannot send messages in a CLOSED deal conversation (Throws ValidationError)");

  // Administrative revocation
  await revokeDealConversation(admin, conv.id, {
    revokeReason: "Regulatory inspection stop-order on promoter entities.",
  });
  const revokedDb = await db.query(`SELECT status FROM deal_conversations WHERE id = $1`, [conv.id]);
  assert(revokedDb.rows[0].status === "REVOKED", "Admin revoking conversation sets status to REVOKED");

  // Message creation rejected in REVOKED conversation
  let msgInRevokedBlocked = false;
  try {
    await sendDealMessage(buyer1, conv.id, { content: "Attempting message in revoked conversation." });
  } catch (err: any) {
    msgInRevokedBlocked = err instanceof ForbiddenError;
  }
  assert(msgInRevokedBlocked, "State machine: Cannot send messages in a REVOKED deal conversation (Throws ForbiddenError)");

  // ============================================================================
  // 12. RATE LIMITING & FLOOD PROTECTION
  // ============================================================================
  console.log("\n--- 12. RATE LIMITING PROTECTION ---");
  resetMessageRateLimits();
  // Create a second clean conversation for rate-limit test
  const oppRecord3 = await createOpportunity(seller1, {
    title: "Aerospace Precision Unit 3",
    headline: "Unit 3",
    teaserSummary: "Unit 3 high precision line.",
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
    exactLegalName: "Confidential Aero 3 Pvt Ltd",
    exactCin: "U29299MH2008PTC038195",
    exactGstin: "27AABCA1234F1Z5",
    exactPan: "AABCA1234J",
    exactAddress: "Plot 103, Chakan Phase II, Pune, Maharashtra",
  });
  await submitOpportunity(oppRecord3.id, seller1);
  await executeAdminOpportunityReview(oppRecord3.id, "START_REVIEW", {}, admin);
  await executeAdminOpportunityReview(oppRecord3.id, "VERIFY", {}, admin);
  await executeAdminOpportunityReview(oppRecord3.id, "PUBLISH", {}, admin);

  const eoi3 = await submitEOI(buyer1, oppRecord3.id, {
    interestType: "FULL_ACQUISITION",
    proposedTransactionType: "100% Equity Buyout",
    indicativeOfferRange: "50CR_TO_100CR",
    investmentTimeline: "1_TO_3_MONTHS",
    buyerMessage: "Interested in unit 3 buyout.",
  });
  await acceptEOI(seller1, eoi3.id, { sellerResponseMessage: "Accepted." });
  const nda3 = await initiateNDA(buyer1, oppRecord3.id, { eoiId: eoi3.id });
  await acceptNDA(buyer1, nda3.id, { termsAcknowledged: true });
  await acceptNDA(seller1, nda3.id, { termsAcknowledged: true });
  const floodConv = await initiateDealConversation(buyer1, oppRecord3.id, { ndaId: nda3.id });

  // Send 30 messages (the window capacity)
  for (let i = 0; i < 30; i++) {
    await sendDealMessage(buyer1, floodConv.id, { content: `Flood test message #${i}` });
  }

  // 31st message must throw rate limit ValidationError
  let rateLimitBlocked = false;
  try {
    await sendDealMessage(buyer1, floodConv.id, { content: "Rate limit exceeded attempt 31." });
  } catch (err: any) {
    rateLimitBlocked = err instanceof ValidationError;
  }
  assert(rateLimitBlocked, "Rate limiting: High-frequency message flooding blocked with ValidationError");

  // ============================================================================
  // 13. CONFIDENTIALITY & DATA LEAKAGE PREVENTION
  // ============================================================================
  console.log("\n--- 13. CONFIDENTIALITY & LEAKAGE PREVENTION ---");
  const leakCheckConv = await getDealConversationById(buyer1, floodConv.id);
  assert((leakCheckConv as any).exactCin === undefined, "Zero data leakage: Seller CIN not exposed in conversation view");
  assert((leakCheckConv as any).exactPan === undefined, "Zero data leakage: Seller PAN not exposed in conversation view");
  assert((leakCheckConv as any).exactAddress === undefined, "Zero data leakage: Seller exact address not exposed in conversation view");
  assert(leakCheckConv.counterpartyLabel === "Verified Promoter", "Counterparty identity masked with safe commercial label");

  // ============================================================================
  // 14. IMMUTABLE AUDIT LOGGING & NOTIFICATIONS
  // ============================================================================
  console.log("\n--- 14. IMMUTABLE AUDIT LOGGING & NOTIFICATIONS ---");
  const auditRes = await db.query(
    `SELECT action, resource_type, metadata FROM audit_logs 
     WHERE resource_id IN ($1, $2) OR metadata::text LIKE $3
     ORDER BY created_at ASC`,
    [conv.id, validBuyerMsg.id, `%${conv.id}%`]
  );
  const actions = auditRes.rows.map((r) => r.action);
  assert(actions.includes("DEAL_CONVERSATION_CREATED"), "Audit log recorded: DEAL_CONVERSATION_CREATED");
  assert(actions.includes("DEAL_CONVERSATION_ACCESSED"), "Audit log recorded: DEAL_CONVERSATION_ACCESSED");
  assert(actions.includes("DEAL_MESSAGE_SENT"), "Audit log recorded: DEAL_MESSAGE_SENT");
  assert(actions.includes("DEAL_MESSAGE_DELETED"), "Audit log recorded: DEAL_MESSAGE_DELETED");
  assert(actions.includes("DEAL_CONVERSATION_CLOSED"), "Audit log recorded: DEAL_CONVERSATION_CLOSED");
  assert(actions.includes("DEAL_CONVERSATION_REVOKED"), "Audit log recorded: DEAL_CONVERSATION_REVOKED");

  // Verify that audit log does NOT contain raw message body text
  const msgAudit = auditRes.rows.find((r) => r.action === "DEAL_MESSAGE_SENT");
  assert(
    msgAudit && !JSON.stringify(msgAudit).includes("We have reviewed the audited accounts"),
    "CRITICAL: Audit log stores safe metadata only (ZERO message body content logged)"
  );

  // Notifications
  const buyerNotifs = await getUserNotifications(buyer1.id, 100);
  const sellerNotifs = await getUserNotifications(seller1.id, 100);
  assert(buyerNotifs.notifications.some((n) => n.type === "DEAL_MESSAGE_RECEIVED"), "Buyer received DEAL_MESSAGE_RECEIVED in-app notification");
  assert(sellerNotifs.notifications.some((n) => n.type === "DEAL_CONVERSATION_STARTED"), "Seller received DEAL_CONVERSATION_STARTED in-app notification");

  // Verify notifications do NOT leak raw message body
  const sampleNotif = buyerNotifs.notifications.find((n) => n.type === "DEAL_MESSAGE_RECEIVED");
  assert(
    Boolean(sampleNotif && !sampleNotif.message.includes("<script>")),
    "In-app notifications do not expose confidential message body content"
  );

  // ============================================================================
  // SUMMARY RESULTS
  // ============================================================================
  console.log("\n=================================================================");
  console.log(`PHASE 9 SECURITY GATE COMPLETE: ${passedCount}/${totalCount} ASSERTIONS PASSED`);
  console.log("=================================================================");

  if (passedCount === totalCount) {
    console.log("\n>>> PHASE 9 FINAL VERDICT: READY_FOR_PHASE_10 <<<\n");
    process.exit(0);
  } else {
    console.error(`\n>>> PHASE 9 GATE FAILED: ${totalCount - passedCount} assertions failed <<<\n`);
    process.exit(1);
  }
}

runSecurityGate().catch((err) => {
  console.error("FATAL ERROR IN PHASE 9 SECURITY GATE:", err);
  process.exit(1);
});
