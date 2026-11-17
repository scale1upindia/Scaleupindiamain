// Scale-up India — Phase 9: Secure Deal Communication & Messaging Test Suite
// Path: tests/deal_messaging.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  createOpportunity,
  submitOpportunity,
  executeAdminOpportunityReview,
} from "@/domains/opportunity/service";
import {
  submitEOI,
  acceptEOI,
} from "@/domains/eoi/service";
import {
  initiateNDA,
  acceptNDA,
} from "@/domains/dataroom/service";
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
} from "@/domains/messaging/service";
import { getUserNotifications } from "@/domains/notifications/service";
import { AuthenticatedUser } from "@/types/auth";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from "@/lib/errors";

describe("Phase 9: Secure Deal Communication & Messaging Workflow", () => {
  let seller1: AuthenticatedUser;
  let seller2: AuthenticatedUser;
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let admin: AuthenticatedUser;

  let opp1PublishedId: string;
  let opp2PublishedId: string;
  let nda1ExecutedId: string;
  let dataRoom1Id: string;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();
    resetMessageRateLimits();

    // 1. Provision Seller 1
    const regSeller1 = await registerUser({
      email: "seller1.p9@apexengineering.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Managing Director', '+919988771122', 'seller1.p9@apexengineering.in', 'VERIFIED', 100)`,
      [seller1.id]
    );

    // 2. Provision Seller 2 (Unrelated Promoter)
    const regSeller2 = await registerUser({
      email: "seller2.p9@pharmatech.in",
      firstName: "Anita",
      lastName: "Deshmukh",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller2 = regSeller2.user;
    await query(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status, completion_percentage)
       VALUES ($1, 'Director', '+919988771123', 'seller2.p9@pharmatech.in', 'VERIFIED', 100)`,
      [seller2.id]
    );

    // 3. Provision Buyer 1 (Acquirer)
    const regBuyer1 = await registerUser({
      email: "buyer1.p9@alphainvestments.in",
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
        'Rajesh Nair', 'Head of M&A', 'buyer1.p9@alphainvestments.in', '+919876541122', 'VERIFIED', 'Precision Engineering'
      )`,
      [buyer1.id]
    );

    // 4. Provision Buyer 2 (Unrelated Acquirer)
    const regBuyer2 = await registerUser({
      email: "buyer2.p9@heritagefamily.in",
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
        'Kavita Mehta', 'Managing Trustee', 'buyer2.p9@heritagefamily.in', '+919876541123', 'VERIFIED', 'Healthcare'
      )`,
      [buyer2.id]
    );

    // 5. Provision Admin
    const regAdmin = await registerUser({
      email: "admin.p9@scaleup.in",
      firstName: "Compliance",
      lastName: "Officer",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
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

    // 6. Seed Published Opportunity 1 (Seller 1)
    const opp1 = await createOpportunity(seller1, {
      title: "Apex Precision Aerospace Ltd",
      headline: "AS9100 Certified Avionics Component Facility",
      teaserSummary: "High-precision manufacturing facility with multi-year tier-1 aerospace contracts.",
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
      exactLegalName: "Apex Aerospace Components Pvt Ltd",
      exactCin: "U29299MH2008PTC038192",
      exactGstin: "27AABCA1234F1Z8",
      exactPan: "AABCA1234F",
      exactAddress: "Plot 101, Chakan Phase II, Pune, Maharashtra",
    });
    await submitOpportunity(opp1.id, seller1);
    await executeAdminOpportunityReview(opp1.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp1.id, "VERIFY", {}, admin);
    const pubOpp1 = await executeAdminOpportunityReview(opp1.id, "PUBLISH", {}, admin);
    opp1PublishedId = pubOpp1.id;

    // 7. Seed Published Opportunity 2 (Seller 2)
    const opp2 = await createOpportunity(seller2, {
      title: "BioPharma Diagnostic Network",
      headline: "NABL Accredited Diagnostics Chain",
      teaserSummary: "Network of diagnostic laboratories with strong B2B hospital tie-ups.",
      businessCategory: "HEALTHCARE",
      industry: "Healthcare & Lifesciences",
      subSector: "Diagnostics",
      operatingRegion: "SOUTH_INDIA",
      registeredState: "Karnataka",
      approximateAgeBracket: "5_TO_10_YRS",
      revenueBracket: "25CR_TO_50CR",
      transactionType: "MAJORITY_STAKE",
      businessModel: "B2B",
      ebitdaMarginBracket: "10_TO_20_PCT",
      askingPriceBracket: "25CR_TO_50CR",
      exactLegalName: "BioPharma Lab Diagnostics Pvt Ltd",
      exactCin: "U85110KA2015PTC049182",
      exactGstin: "29AABCB5678F1Z2",
      exactPan: "AABCB5678F",
      exactAddress: "4th Block, Koramangala, Bangalore, Karnataka",
    });
    await submitOpportunity(opp2.id, seller2);
    await executeAdminOpportunityReview(opp2.id, "START_REVIEW", {}, admin);
    await executeAdminOpportunityReview(opp2.id, "VERIFY", {}, admin);
    const pubOpp2 = await executeAdminOpportunityReview(opp2.id, "PUBLISH", {}, admin);
    opp2PublishedId = pubOpp2.id;

    // 8. EOI -> Bilateral NDA Execution between Buyer 1 & Seller 1
    const eoi1 = await submitEOI(buyer1, opp1PublishedId, {
      interestType: "FULL_ACQUISITION",
      proposedTransactionType: "100% Equity Buyout",
      indicativeOfferRange: "50CR_TO_100CR",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Interested in evaluating complete buyout of aerospace asset.",
    });
    await acceptEOI(seller1, eoi1.id, {
      sellerResponseMessage: "Accepted for bilateral NDA & diligence exchange.",
    });

    const initNda = await initiateNDA(buyer1, opp1PublishedId, { eoiId: eoi1.id });
    await acceptNDA(buyer1, initNda.id, { termsAcknowledged: true });
    const executedNda = await acceptNDA(seller1, initNda.id, { termsAcknowledged: true });
    nda1ExecutedId = executedNda.id;

    // Get active data room ID created upon bilateral execution
    const roomRes = await query<{ id: string }>(
      `SELECT id FROM data_rooms WHERE nda_id = $1`,
      [nda1ExecutedId]
    );
    dataRoom1Id = roomRes.rows[0].id;
  });

  // ==========================================
  // PART 1: CONVERSATION INITIALIZATION & GATES
  // ==========================================

  it("1. Buyer 1 can initiate deal conversation on executed bilateral NDA", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
      title: "Valuation & Cap Table Discussion",
    });

    expect(conv.id).toBeDefined();
    expect(conv.referenceCode).toMatch(/^CONV-2026-\d+$/);
    expect(conv.status).toBe("ACTIVE");
    expect(conv.userRole).toBe("BUYER");
    expect(conv.counterpartyRole).toBe("SELLER");
    expect(conv.counterpartyLabel).toBe("Verified Promoter");
    expect(conv.opportunityTitle).toBe("Apex Precision Aerospace Ltd");
  });

  it("2. Seller 1 can initiate deal conversation on executed bilateral NDA", async () => {
    const conv = await initiateDealConversation(seller1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
    });

    expect(conv.id).toBeDefined();
    expect(conv.status).toBe("ACTIVE");
    expect(conv.userRole).toBe("SELLER");
    expect(conv.counterpartyRole).toBe("BUYER");
    expect(conv.counterpartyLabel).toBe("Acquisition Principal");
  });

  it("3. Initiation is idempotent: calling initiate twice returns the same conversation", async () => {
    const conv1 = await initiateDealConversation(buyer1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
    });
    const conv2 = await initiateDealConversation(seller1, opp1PublishedId, {
      ndaId: nda1ExecutedId,
    });

    expect(conv1.id).toBe(conv2.id);
    expect(conv1.referenceCode).toBe(conv2.referenceCode);
  });

  it("4. Cannot initiate conversation on unexecuted NDA (Bilateral NDA Execution Gate)", async () => {
    // Create an EOI + Unilateral NDA (not executed yet)
    const eoi2 = await submitEOI(buyer1, opp2PublishedId, {
      interestType: "MAJORITY_STAKE",
      proposedTransactionType: "Majority Investment",
      investmentTimeline: "1_TO_3_MONTHS",
      buyerMessage: "Evaluating diagnostic network.",
    });
    await acceptEOI(seller2, eoi2.id, { sellerResponseMessage: "Proceed to NDA." });
    const draftNda = await initiateNDA(buyer1, opp2PublishedId, { eoiId: eoi2.id });
    await acceptNDA(buyer1, draftNda.id, { termsAcknowledged: true });
    // draftNda is now BUYER_ACCEPTED, but NOT EXECUTED by seller2

    await expect(
      initiateDealConversation(buyer1, opp2PublishedId, { ndaId: draftNda.id })
    ).rejects.toThrow(ValidationError);
  });

  it("5. Anti-IDOR: Buyer 2 cannot initiate conversation for Buyer 1's deal", async () => {
    await expect(
      initiateDealConversation(buyer2, opp1PublishedId, { ndaId: nda1ExecutedId })
    ).rejects.toThrow(ForbiddenError);
  });

  it("6. Anti-IDOR: Seller 2 cannot initiate conversation for Seller 1's deal", async () => {
    await expect(
      initiateDealConversation(seller2, opp1PublishedId, { ndaId: nda1ExecutedId })
    ).rejects.toThrow(ForbiddenError);
  });

  it("7. Mismatched opportunityId and ndaId throws validation error", async () => {
    await expect(
      initiateDealConversation(buyer1, opp2PublishedId, { ndaId: nda1ExecutedId })
    ).rejects.toThrow(ValidationError);
  });

  // ==========================================
  // PART 2: CONVERSATION RETRIEVAL & ANTI-IDOR
  // ==========================================

  it("8. Authorized participants can retrieve their deal conversation", async () => {
    const created = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const buyerView = await getDealConversationById(buyer1, created.id);
    expect(buyerView.id).toBe(created.id);
    expect(buyerView.userRole).toBe("BUYER");

    const sellerView = await getDealConversationById(seller1, created.id);
    expect(sellerView.id).toBe(created.id);
    expect(sellerView.userRole).toBe("SELLER");
  });

  it("9. Anti-IDOR: Buyer 2 CANNOT access Buyer 1's deal conversation", async () => {
    const created = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(getDealConversationById(buyer2, created.id)).rejects.toThrow(ForbiddenError);
  });

  it("10. Anti-IDOR: Seller 2 CANNOT access Seller 1's deal conversation", async () => {
    const created = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(getDealConversationById(seller2, created.id)).rejects.toThrow(ForbiddenError);
  });

  it("11. Requesting non-existent conversation returns NotFoundError", async () => {
    await expect(
      getDealConversationById(buyer1, "00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(NotFoundError);
  });

  it("12. Listing conversations scopes strictly to authenticated user's active memberships", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const buyerList = await getDealConversationsForUser(buyer1);
    expect(buyerList.some((c) => c.id === conv.id)).toBe(true);

    const buyer2List = await getDealConversationsForUser(buyer2);
    expect(buyer2List.some((c) => c.id === conv.id)).toBe(false);

    const seller2List = await getDealConversationsForUser(seller2);
    expect(seller2List.some((c) => c.id === conv.id)).toBe(false);
  });

  // ==========================================
  // PART 3: MESSAGE PERSISTENCE & VALIDATION
  // ==========================================

  it("13. Buyer can send valid message and seller receives it", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const msg = await sendDealMessage(buyer1, conv.id, {
      content: "We would like to schedule a management meeting for next Tuesday.",
    });

    expect(msg.id).toBeDefined();
    expect(msg.senderRole).toBe("BUYER");
    expect(msg.isMine).toBe(true);
    expect(msg.content).toBe("We would like to schedule a management meeting for next Tuesday.");
    expect(msg.status).toBe("SENT");

    // Verify persisted in database
    const dbRes = await query<any>(`SELECT * FROM deal_messages WHERE id = $1`, [msg.id]);
    expect(dbRes.rows.length).toBe(1);
    expect(dbRes.rows[0].sender_user_id).toBe(buyer1.id);
  });

  it("14. Seller can send reply in the conversation", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await sendDealMessage(buyer1, conv.id, { content: "First inquiry." });
    const reply = await sendDealMessage(seller1, conv.id, {
      content: "Confirmed. Tuesday 2 PM IST works for our executive team.",
    });

    expect(reply.senderRole).toBe("SELLER");
    expect(reply.content).toContain("Tuesday 2 PM");

    const history = await getPaginatedMessages(buyer1, conv.id, { limit: 10 });
    expect(history.messages.length).toBe(2);
    expect(history.messages[1].isMine).toBe(false); // Seller's reply viewed by buyer
  });

  it("15. Anti-IDOR: Unauthorized Buyer 2 cannot send message in Buyer 1's conversation", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(
      sendDealMessage(buyer2, conv.id, { content: "Malicious injection attempt" })
    ).rejects.toThrow(ForbiddenError);
  });

  it("16. Empty message is strictly rejected with validation error", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(
      sendDealMessage(buyer1, conv.id, { content: "    " })
    ).rejects.toThrow(ValidationError);
  });

  it("17. Oversized message exceeding 4000 characters is rejected", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const hugeContent = "A".repeat(4001);
    await expect(
      sendDealMessage(buyer1, conv.id, { content: hugeContent })
    ).rejects.toThrow(ValidationError);
  });

  it("18. Null bytes and unprintable control characters are rejected", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(
      sendDealMessage(buyer1, conv.id, { content: "Hello\0World" })
    ).rejects.toThrow(ValidationError);

    await expect(
      sendDealMessage(buyer1, conv.id, { content: "Dangerous\x07Bell" })
    ).rejects.toThrow(ValidationError);
  });

  it("19. Sender identity is strictly derived from session (cannot be spoofed)", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    // Client passes arbitrary body with spoofed sender
    const msg = await sendDealMessage(buyer1, conv.id, {
      content: "Checking spoof defense",
      ...({ senderUserId: seller1.id, senderRole: "SELLER" } as any),
    });

    // In DB, sender_user_id must be buyer1.id
    const dbRes = await query<any>(`SELECT sender_user_id FROM deal_messages WHERE id = $1`, [msg.id]);
    expect(dbRes.rows[0].sender_user_id).toBe(buyer1.id);
  });

  it("20. XSS payload is safely handled as safe plain text", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const xssPayload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>";
    const msg = await sendDealMessage(buyer1, conv.id, { content: xssPayload });

    // Stored safely as raw string, never rendered dangerously
    expect(msg.content).toBe(xssPayload);
  });

  // ==========================================
  // PART 4: READ STATE & PAGINATION
  // ==========================================

  it("21. Unread count increments for recipient and resets upon read update", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    // Buyer sends 2 messages
    await sendDealMessage(buyer1, conv.id, { content: "Question 1" });
    await sendDealMessage(buyer1, conv.id, { content: "Question 2" });

    // Seller's unread count should be 2
    const sellerConvBefore = await getDealConversationById(seller1, conv.id);
    expect(sellerConvBefore.unreadCount).toBe(2);

    // Seller marks read
    await markConversationRead(seller1, conv.id);

    // Seller's unread count is now 0
    const sellerConvAfter = await getDealConversationById(seller1, conv.id);
    expect(sellerConvAfter.unreadCount).toBe(0);
  });

  it("22. Anti-IDOR: User cannot update read state in another user's conversation", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(markConversationRead(buyer2, conv.id)).rejects.toThrow(ForbiddenError);
  });

  it("23. Cursor-based pagination correctly bounds pages and streams history", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    // Seed 5 messages
    for (let i = 1; i <= 5; i++) {
      await sendDealMessage(buyer1, conv.id, { content: `Message #${i}` });
    }

    // Page 1: limit 2
    const page1 = await getPaginatedMessages(buyer1, conv.id, { limit: 2 });
    expect(page1.messages.length).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeDefined();

    // Page 2: with cursor
    const page2 = await getPaginatedMessages(buyer1, conv.id, {
      limit: 2,
      cursor: page1.nextCursor || undefined,
    });
    expect(page2.messages.length).toBe(2);
  });

  it("24. Messages do NOT leak across different conversations", async () => {
    const conv1 = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });
    await sendDealMessage(buyer1, conv1.id, { content: "Confidential to Deal 1" });

    // Querying non-existent conversation or different ID returns 404 or 403
    await expect(
      getPaginatedMessages(buyer2, conv1.id, { limit: 10 })
    ).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 5: MESSAGE SOFT DELETION
  // ==========================================

  it("25. Author can soft-delete their own message", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });
    const msg = await sendDealMessage(buyer1, conv.id, { content: "Typo in valuation figure." });

    await softDeleteDealMessage(buyer1, conv.id, msg.id);

    const history = await getPaginatedMessages(seller1, conv.id, { limit: 10 });
    const deletedMsg = history.messages.find((m) => m.id === msg.id);
    expect(deletedMsg?.status).toBe("SOFT_DELETED");
    expect(deletedMsg?.content).toContain("deleted by the sender");
  });

  it("26. Participant CANNOT delete another participant's message", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });
    const msg = await sendDealMessage(buyer1, conv.id, { content: "Buyer statement." });

    // Seller attempts to delete buyer's message -> Forbidden
    await expect(softDeleteDealMessage(seller1, conv.id, msg.id)).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 6: CONVERSATION LIFECYCLE & STATE MACHINE
  // ==========================================

  it("27. Closing conversation moves it to CLOSED and prevents new messages", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const closed = await closeDealConversation(buyer1, conv.id, {
      closeReason: "Discussion concluded. Proceeding to formal MOU staging.",
    });
    expect(closed.status).toBe("CLOSED");
    expect(closed.closeReason).toContain("Proceeding to formal MOU");

    // Attempting to send message in CLOSED conversation throws ValidationError
    await expect(
      sendDealMessage(seller1, conv.id, { content: "Attempt after close." })
    ).rejects.toThrow(ValidationError);
  });

  it("28. Cannot close an already closed conversation", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });
    await closeDealConversation(buyer1, conv.id, {});

    await expect(closeDealConversation(seller1, conv.id, {})).rejects.toThrow(ValidationError);
  });

  it("29. Admin revoking conversation sets status to REVOKED and blocks all access", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await revokeDealConversation(admin, conv.id, {
      revokeReason: "Regulatory inspection stop-order on promoter.",
    });

    // Both parties are blocked from sending messages
    await expect(
      sendDealMessage(buyer1, conv.id, { content: "Blocked post-revocation" })
    ).rejects.toThrow(ForbiddenError);
  });

  it("30. Non-admin cannot call revokeDealConversation", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await expect(
      revokeDealConversation(buyer1, conv.id, { revokeReason: "Unauthorized" })
    ).rejects.toThrow(ForbiddenError);
  });

  // ==========================================
  // PART 7: NOTIFICATIONS, AUDIT & RATE LIMITING
  // ==========================================

  it("31. Sending a message generates truthful in-app notification for counterparty", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    await sendDealMessage(buyer1, conv.id, { content: "Reviewing Schedule 3." });

    const notifs = await getUserNotifications(seller1.id);
    const msgNotif = notifs.notifications.find((n) => n.type === "DEAL_MESSAGE_RECEIVED");
    expect(msgNotif).toBeDefined();
    // Notification text does NOT contain sensitive message body
    expect(msgNotif?.message).not.toContain("Reviewing Schedule 3");
    expect(msgNotif?.message).toContain(conv.referenceCode);
  });

  it("32. Audit log records DEAL_MESSAGE_SENT with metadata and ZERO message content", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    const msg = await sendDealMessage(buyer1, conv.id, {
      content: "CONFIDENTIAL_FINANCIAL_PROPOSAL_100CR",
    });

    const auditRes = await query<any>(
      `SELECT * FROM audit_logs WHERE resource_id = $1 AND action = 'DEAL_MESSAGE_SENT'`,
      [msg.id]
    );

    expect(auditRes.rows.length).toBe(1);
    const rawMeta = auditRes.rows[0].metadata;
    const metadata = typeof rawMeta === "string" ? JSON.parse(rawMeta) : rawMeta;
    expect(metadata.contentLength).toBe(37);
    // CRITICAL: message content must NOT be logged in audit logs
    expect(JSON.stringify(auditRes.rows[0])).not.toContain("CONFIDENTIAL_FINANCIAL_PROPOSAL_100CR");
  });

  it("33. High-frequency flooding triggers rate limit protection", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    // Send 30 messages (the limit)
    for (let i = 0; i < 30; i++) {
      await sendDealMessage(buyer1, conv.id, { content: `Flood test message #${i}` });
    }

    // 31st message must throw ValidationError due to rate limit
    await expect(
      sendDealMessage(buyer1, conv.id, { content: "Flooding message 31" })
    ).rejects.toThrow(ValidationError);
  });

  it("34. Confidentiality: API response does not expose seller CIN, PAN, or raw identity", async () => {
    const conv = await initiateDealConversation(buyer1, opp1PublishedId, { ndaId: nda1ExecutedId });

    // Check conversation view
    expect((conv as any).exactCin).toBeUndefined();
    expect((conv as any).exactPan).toBeUndefined();
    expect((conv as any).exactAddress).toBeUndefined();
    expect(conv.counterpartyLabel).toBe("Verified Promoter");
  });
});
