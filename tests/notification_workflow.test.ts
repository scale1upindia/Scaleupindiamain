// Scale-up India — Phase 15: Notifications & Communication Workflow Tests
// Path: tests/notification_workflow.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { query, resetTestDb, transaction } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  dispatchNotification,
  enqueueOutboxEvent,
  processOutboxEvents,
  listUserNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUserPreferences,
  updateUserPreferences,
  processEmailWebhook,
  retryDelivery,
  listDeliveriesAdmin,
  resetNotificationRateLimits,
  MANDATORY_CATEGORIES,
} from "@/domains/notifications/service";
import {
  emailProviderRegistry,
  TestSimulatedEmailProvider,
} from "@/domains/notifications/provider";
import { escapeHtml, sanitizeUrl, renderEmailTemplate } from "@/domains/notifications/templates";
import { AuthenticatedUser } from "@/types/auth";
import {
  NotificationNotFoundError,
  MandatoryNotificationError,
  InvalidWebhookError,
  ForbiddenError,
  NotFoundError,
  NotificationRateLimitError,
} from "@/lib/errors";

describe("Phase 15: Notifications & Communication Platform", () => {
  let buyer1: AuthenticatedUser;
  let buyer2: AuthenticatedUser;
  let seller1: AuthenticatedUser;
  let admin: AuthenticatedUser;
  let testEmailProvider: TestSimulatedEmailProvider;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    (process.env as any).ENABLE_TEST_EMAIL_PROVIDER = "true";
    resetNotificationRateLimits();
    await resetTestDb();

    testEmailProvider = emailProviderRegistry.getTestProvider();
    testEmailProvider.clearSentEmails();

    // 1. Register Buyer 1
    const regBuyer1 = await registerUser({
      email: "buyer1.p15@alphainvest.in",
      firstName: "Rahul",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer1 = regBuyer1.user;

    // 2. Register Buyer 2 (Unrelated Counterparty)
    const regBuyer2 = await registerUser({
      email: "buyer2.p15@betacapital.in",
      firstName: "Sameer",
      lastName: "Verma",
      password: "Password@123",
      roles: ["BUYER"],
    });
    buyer2 = regBuyer2.user;

    // 3. Register Seller 1
    const regSeller1 = await registerUser({
      email: "seller1.p15@apexeng.in",
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    seller1 = regSeller1.user;

    // 4. Register Admin
    const regAdmin = await registerUser({
      email: "admin.p15@scaleupindia.gov.in",
      firstName: "Suresh",
      lastName: "Rao",
      password: "Password@123",
      roles: ["BUYER"],
    });
    admin = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN", "ADMIN"],
      permissions: [
        "notification.read_all",
        "notification.manage",
        "notification.admin",
        "notification.audit",
      ],
    };
  });

  // ===========================================================================
  // SECTION 1: TRANSACTIONAL OUTBOX & ROLLBACK DEFENSE
  // ===========================================================================
  describe("1. Transactional Outbox Pattern", () => {
    it("persists outbox event and dispatches notification on outbox processing", async () => {
      const aggregateId = crypto.randomUUID();
      const idempotencyKey = `outbox:test:${aggregateId}:buyer1`;

      const outboxEvent = await enqueueOutboxEvent({
        eventType: "TRANSACTION_INITIATED",
        aggregateType: "TRANSACTION",
        aggregateId,
        actorUserId: seller1.id,
        payload: {
          recipientUserId: buyer1.id,
          title: "Deal Room Initialized",
          safeBody: "A new transaction deal room workspace has been initialized.",
          actionType: "OPEN_DEAL_ROOM",
          actionUrl: `/buyer/deal-room/${aggregateId}`,
        },
        idempotencyKey,
      });

      expect(outboxEvent.status).toBe("PENDING");
      expect(outboxEvent.idempotencyKey).toBe(idempotencyKey);

      // Process pending outbox events
      const result = await processOutboxEvents();
      expect(result.processed).toBe(1);

      // Verify canonical notification was generated
      const list = await listUserNotifications(buyer1.id, { page: 1, limit: 10, unreadOnly: false });
      expect(list.totalCount).toBe(1);
      expect(list.notifications[0].title).toBe("Deal Room Initialized");
      expect(list.notifications[0].category).toBe("TRANSACTION");
      expect(list.notifications[0].isRead).toBe(false);

      // Verify email was sent via simulated email provider
      const sentEmails = testEmailProvider.getSentEmails();
      expect(sentEmails.length).toBe(1);
      expect(sentEmails[0].to).toBe(buyer1.email);
      expect(sentEmails[0].subject).toContain("Transaction Deal Room Initialized");
    });

    it("ensures rolled-back transactions produce ZERO outbox events and ZERO notifications", async () => {
      const aggregateId = crypto.randomUUID();
      const idempotencyKey = `outbox:rollback:${aggregateId}:buyer1`;

      try {
        await transaction(async (tx) => {
          // 1. Enqueue outbox event inside transaction
          await enqueueOutboxEvent(
            {
              eventType: "PAYMENT_CONFIRMED",
              aggregateType: "PAYMENT",
              aggregateId,
              payload: {
                recipientUserId: buyer1.id,
                title: "Earnest Token Deposit Confirmed",
                safeBody: "Your token deposit has been confirmed in escrow.",
              },
              idempotencyKey,
            },
            tx
          );

          // 2. Simulate transaction failure and rollback
          throw new Error("Simulated database failure during payment reconciliation");
        });
      } catch (err: any) {
        expect(err.message).toBe("Simulated database failure during payment reconciliation");
      }

      // Verify outbox table has zero events for this key
      const outboxCheck = await query(
        `SELECT * FROM notification_events WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      expect(outboxCheck.rows.length).toBe(0);

      // Process outbox to verify nothing is processed
      const outboxResult = await processOutboxEvents();
      expect(outboxResult.processed).toBe(0);

      // Verify recipient received zero notifications
      const list = await listUserNotifications(buyer1.id, { page: 1, limit: 10, unreadOnly: false });
      expect(list.totalCount).toBe(0);
      expect(testEmailProvider.getSentEmails().length).toBe(0);
    });
  });

  // ===========================================================================
  // SECTION 2: IDEMPOTENCY & DEDUPLICATION
  // ===========================================================================
  describe("2. Idempotency & Deduplication", () => {
    it("deduplicates identical notification dispatch calls without creating duplicate rows", async () => {
      const idempotencyKey = `idem:test:${crypto.randomUUID()}:buyer1`;

      const notif1 = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Closing Condition Verified",
        safeBody: "Definitive Agreement has been executed and verified.",
        idempotencyKey,
      });

      const notif2 = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Closing Condition Verified (Retry)",
        safeBody: "Definitive Agreement has been executed and verified.",
        idempotencyKey,
      });

      expect(notif1.id).toBe(notif2.id);

      // Check database rows
      const dbCheck = await query(`SELECT COUNT(*) as count FROM notifications WHERE idempotency_key = $1`, [
        idempotencyKey,
      ]);
      expect(parseInt(dbCheck.rows[0].count, 10)).toBe(1);

      // Verify only one email was sent
      expect(testEmailProvider.getSentEmails().length).toBe(1);
    });
  });

  // ===========================================================================
  // SECTION 3: NOTIFICATION PREFERENCES & MANDATORY COMPLIANCE INVARIANTS
  // ===========================================================================
  describe("3. Notification Preferences & Mandatory Invariants", () => {
    it("returns standard default matrix across all categories and channels", async () => {
      const prefs = await getUserPreferences(buyer1.id);
      expect(prefs.length).toBe(14); // 7 categories * 2 channels

      const securityEmail = prefs.find((p) => p.category === "SECURITY" && p.channel === "EMAIL");
      expect(securityEmail?.isMandatory).toBe(true);
      expect(securityEmail?.isEnabled).toBe(true);

      const txnInApp = prefs.find((p) => p.category === "TRANSACTION" && p.channel === "IN_APP");
      expect(txnInApp?.isMandatory).toBe(true);
    });

    it("strictly blocks user attempts to disable mandatory categories (Security / Transaction / Payment)", async () => {
      for (const mandatoryCat of MANDATORY_CATEGORIES) {
        await expect(
          updateUserPreferences(buyer1.id, [
            { category: mandatoryCat, channel: "EMAIL", isEnabled: false },
          ])
        ).rejects.toThrow(MandatoryNotificationError);

        await expect(
          updateUserPreferences(buyer1.id, [
            { category: mandatoryCat, channel: "IN_APP", isEnabled: false },
          ])
        ).rejects.toThrow(MandatoryNotificationError);
      }
    });

    it("allows disabling optional categories and honors preference on dispatch", async () => {
      // Disable marketing informational emails
      await updateUserPreferences(buyer1.id, [
        { category: "MARKETING_INFORMATIONAL", channel: "EMAIL", isEnabled: false },
        { category: "MARKETING_INFORMATIONAL", channel: "IN_APP", isEnabled: true },
      ]);

      const notif = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "MARKETING_INFORMATIONAL",
        title: "Platform Feature Announcement",
        safeBody: "New valuation analytics capabilities are now live.",
      });

      // Verify IN_APP delivery was created
      const inAppDelivery = await query(
        `SELECT * FROM notification_deliveries WHERE notification_id = $1 AND channel = 'IN_APP'`,
        [notif.id]
      );
      expect(inAppDelivery.rows.length).toBe(1);
      expect(inAppDelivery.rows[0].status).toBe("DELIVERED");

      // Verify EMAIL delivery was suppressed
      const emailDelivery = await query(
        `SELECT * FROM notification_deliveries WHERE notification_id = $1 AND channel = 'EMAIL'`,
        [notif.id]
      );
      expect(emailDelivery.rows.length).toBe(0);
      expect(testEmailProvider.getSentEmails().length).toBe(0);
    });
  });

  // ===========================================================================
  // SECTION 4: DELIVERY STATE MACHINE & TRUTHFUL STATE REPORTING
  // ===========================================================================
  describe("4. Channel Routing & Truthful Delivery States", () => {
    it("records IN_APP as DELIVERED and EMAIL as SENT upon provider acceptance", async () => {
      const notif = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "PAYMENT",
        title: "Escrow Deposit Confirmed",
        safeBody: "Your transaction earnest token deposit has been verified in escrow.",
      });

      const deliveriesRes = await query(
        `SELECT channel, status FROM notification_deliveries WHERE notification_id = $1 ORDER BY channel`,
        [notif.id]
      );

      const inApp = deliveriesRes.rows.find((r) => r.channel === "IN_APP");
      const email = deliveriesRes.rows.find((r) => r.channel === "EMAIL");

      expect(inApp?.status).toBe("DELIVERED");
      // Truthful invariant: Provider has accepted the email, but webhook has not yet confirmed receipt
      expect(email?.status).toBe("SENT");
    });
  });

  // ===========================================================================
  // SECTION 5: PROVIDER WEBHOOK SECURITY & REPLAY DEFENSE
  // ===========================================================================
  describe("5. Provider Webhook Security & Replay Defense", () => {
    it("updates email delivery status to DELIVERED upon valid provider webhook callback", async () => {
      const notif = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Transaction Closed",
        safeBody: "Transaction deal room has been authoritatively closed.",
      });

      const sentEmail = testEmailProvider.getLastSentEmail();
      expect(sentEmail).toBeDefined();

      const webhookPayload = {
        eventId: `evt_test_${Date.now()}_001`,
        eventType: "DELIVERED",
        providerMessageId: sentEmail!.providerMessageId,
        recipient: buyer1.email,
        timestamp: new Date().toISOString(),
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const signature = testEmailProvider.generateSignature(rawPayload);

      const result = await processEmailWebhook("TEST_SIMULATED", rawPayload, signature);
      expect(result.success).toBe(true);
      expect(result.duplicate).toBe(false);

      // Verify delivery record status updated to DELIVERED
      const deliveryRes = await query(
        `SELECT status, delivered_at FROM notification_deliveries WHERE notification_id = $1 AND channel = 'EMAIL'`,
        [notif.id]
      );
      expect(deliveryRes.rows[0].status).toBe("DELIVERED");
      expect(deliveryRes.rows[0].delivered_at).toBeDefined();
    });

    it("rejects webhook with invalid signature", async () => {
      const payload = JSON.stringify({ eventId: "fake_evt", eventType: "DELIVERED" });
      const badSignature = "t=12345,v1=bad_hex_signature";

      await expect(
        processEmailWebhook("TEST_SIMULATED", payload, badSignature)
      ).rejects.toThrow(InvalidWebhookError);
    });

    it("rejects webhook with expired timestamp (>300 seconds old)", async () => {
      const payload = JSON.stringify({ eventId: "old_evt", eventType: "DELIVERED" });
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes old
      const signature = testEmailProvider.generateSignature(payload, oldTimestamp);

      await expect(
        processEmailWebhook("TEST_SIMULATED", payload, signature, { timestamp: oldTimestamp })
      ).rejects.toThrow(InvalidWebhookError);
    });

    it("enforces replay protection on duplicate webhook callbacks without duplicating state", async () => {
      const webhookPayload = {
        eventId: `evt_replay_${Date.now()}_002`,
        eventType: "DELIVERED",
        providerMessageId: "msg_sim_fake_123",
        recipient: buyer1.email,
        timestamp: new Date().toISOString(),
      };
      const rawPayload = JSON.stringify(webhookPayload);
      const signature = testEmailProvider.generateSignature(rawPayload);

      // First webhook call
      const res1 = await processEmailWebhook("TEST_SIMULATED", rawPayload, signature);
      expect(res1.success).toBe(true);
      expect(res1.duplicate).toBe(false);

      // Second identical webhook call
      const res2 = await processEmailWebhook("TEST_SIMULATED", rawPayload, signature);
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(res2.message).toContain("Replay protected");
    });
  });

  // ===========================================================================
  // SECTION 6: BOUNDED RETRIES & DEAD LETTER QUEUE
  // ===========================================================================
  describe("6. Bounded Retries & Dead Letter Behavior", () => {
    it("handles provider failure, transitions to RETRYING, and advances to DEAD_LETTER after max attempts", async () => {
      testEmailProvider.simulateFailureNext("SMTP_TIMEOUT", "Connection to mail exchange timed out");

      const notif = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Closing Confirmation Required",
        safeBody: "Please confirm the final terms of acquisition.",
      });

      const deliveryRes = await query(
        `SELECT * FROM notification_deliveries WHERE notification_id = $1 AND channel = 'EMAIL'`,
        [notif.id]
      );
      const delivery = deliveryRes.rows[0];
      expect(delivery.status).toBe("RETRYING");
      expect(delivery.attempts).toBe(1);
      expect(delivery.failure_code).toBe("SMTP_TIMEOUT");

      // Admin manual retry 1 (fails again)
      testEmailProvider.simulateFailureNext("SMTP_UNAVAILABLE", "Mail exchange unavailable");
      const retried1 = await retryDelivery(delivery.id, admin);
      expect(retried1.status).toBe("RETRYING");
      expect(retried1.attempts).toBe(2);

      // Admin manual retry 2 (fails for 3rd time -> DEAD_LETTER)
      testEmailProvider.simulateFailureNext("SMTP_REFUSED", "Connection refused permanently");
      const retried2 = await retryDelivery(delivery.id, admin);
      expect(retried2.status).toBe("DEAD_LETTER");
      expect(retried2.attempts).toBe(3);
    });
  });

  // ===========================================================================
  // SECTION 7: ANTI-IDOR & MULTI-TENANT ISOLATION
  // ===========================================================================
  describe("7. Anti-IDOR & Recipient Authorization", () => {
    it("blocks unrelated Buyer 2 from reading or mutating Buyer 1's notifications", async () => {
      const notif = await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "SECURITY",
        title: "New Session Signed In",
        safeBody: "A new session was authenticated for your account.",
      });

      // Buyer 1 can access
      const b1Access = await getNotificationById(notif.id, buyer1.id);
      expect(b1Access.id).toBe(notif.id);

      // Buyer 2 cannot access (throws NotificationNotFoundError 404)
      await expect(getNotificationById(notif.id, buyer2.id)).rejects.toThrow(NotificationNotFoundError);

      // Buyer 2 cannot mark Buyer 1's notification as read
      await expect(markNotificationAsRead(notif.id, buyer2.id)).rejects.toThrow(NotificationNotFoundError);

      // Buyer 2's notification list returns zero
      const b2List = await listUserNotifications(buyer2.id, { page: 1, limit: 10, unreadOnly: false });
      expect(b2List.totalCount).toBe(0);
    });

    it("marks all notifications as read only for the authenticated principal", async () => {
      await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Notice 1",
        safeBody: "Notice 1 body",
      });
      await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Notice 2",
        safeBody: "Notice 2 body",
      });
      await dispatchNotification({
        recipientUserId: buyer2.id,
        category: "TRANSACTION",
        title: "Notice Buyer 2",
        safeBody: "Notice Buyer 2 body",
      });

      // Buyer 1 marks all as read
      const markResult = await markAllNotificationsAsRead(buyer1.id);
      expect(markResult.updatedCount).toBe(2);

      // Verify Buyer 1 unread count is 0
      const b1List = await listUserNotifications(buyer1.id, { page: 1, limit: 10, unreadOnly: true });
      expect(b1List.unreadCount).toBe(0);

      // Verify Buyer 2 notification remains UNREAD
      const b2List = await listUserNotifications(buyer2.id, { page: 1, limit: 10, unreadOnly: true });
      expect(b2List.unreadCount).toBe(1);
    });
  });

  // ===========================================================================
  // SECTION 8: SAFE TEMPLATES & SENSITIVE DATA PROTECTION
  // ===========================================================================
  describe("8. Safe Templates & Progressive Confidentiality Invariants", () => {
    it("escapes malicious HTML injection and XSS payloads in titles and messages", () => {
      const maliciousScript = "<script>alert('pwned')</script>";
      const escapedScript = escapeHtml(maliciousScript);
      expect(escapedScript).toBe("&lt;script&gt;alert(&#39;pwned&#39;)&lt;&#x2F;script&gt;");

      const maliciousImg = '<img src="x" onerror="stealCookies()"/>';
      const escapedImg = escapeHtml(maliciousImg);
      expect(escapedImg).not.toContain("<img");
      expect(escapedImg).toContain("&lt;img");
    });

    it("neutralizes dangerous javascript: URLs", () => {
      expect(sanitizeUrl("javascript:alert(1)")).toBe("/dashboard");
      expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("/dashboard");
      expect(sanitizeUrl("/buyer/deal-room/123")).toBe("/buyer/deal-room/123");
      expect(sanitizeUrl("https://scaleupindia.gov.in/deal")).toBe("https://scaleupindia.gov.in/deal");
    });

    it("renders email templates without leaking confidential seller data into subject", () => {
      const rendered = renderEmailTemplate("TRANSACTION_INITIATED", {
        title: "Confidential Transaction Deal Room Initialized",
        body: "A deal room has been created for your acquisition.",
        actionUrl: "/buyer/deal-room/101",
        recipientName: "Rahul",
      });

      // Subject must be generic and institutional
      expect(rendered.subject).toBe("Action Required: Transaction Deal Room Initialized");
      // Must not leak raw financial statements, CIN, PAN
      expect(rendered.subject).not.toContain("₹");
      expect(rendered.subject).not.toContain("Crore");
      expect(rendered.html).toContain("SCALE-UP INDIA");
      expect(rendered.html).toContain("CONFIDENTIALITY NOTICE");
    });
  });

  // ===========================================================================
  // SECTION 9: RATE LIMITING
  // ===========================================================================
  describe("9. Sliding-Window Rate Limiting", () => {
    it("triggers NotificationRateLimitError when request volume exceeds threshold", async () => {
      // 60 mutations allowed per minute
      for (let i = 0; i < 60; i++) {
        markNotificationAsRead("fake-id", buyer1.id).catch(() => {});
      }

      await expect(
        markNotificationAsRead("fake-id", buyer1.id)
      ).rejects.toThrow(NotificationRateLimitError);
    });
  });

  // ===========================================================================
  // SECTION 10: ADMINISTRATIVE RBAC PROTECTION
  // ===========================================================================
  describe("10. Administrative RBAC Controls", () => {
    it("strictly blocks non-admin users from viewing delivery records or triggering manual retries", async () => {
      await expect(listDeliveriesAdmin(buyer1)).rejects.toThrow(ForbiddenError);
      await expect(listDeliveriesAdmin(seller1)).rejects.toThrow(ForbiddenError);

      await expect(retryDelivery("any-delivery-id", buyer1)).rejects.toThrow(ForbiddenError);
    });

    it("allows authorized administrators to inspect deliveries", async () => {
      await dispatchNotification({
        recipientUserId: buyer1.id,
        category: "TRANSACTION",
        title: "Test Notice",
        safeBody: "Test notice body",
      });

      const deliveries = await listDeliveriesAdmin(admin);
      expect(deliveries.length).toBeGreaterThan(0);
    });
  });
});
