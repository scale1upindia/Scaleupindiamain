// Scale-up India — Phase 15: Notifications & Communication Security Gate
// Script: scripts/phase15_security_gate.ts

import crypto from "crypto";
import { getDb, query, transaction } from "../src/lib/db";
import { registerUser } from "../src/domains/auth/service";
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
} from "../src/domains/notifications/service";
import {
  emailProviderRegistry,
  TestSimulatedEmailProvider,
} from "../src/domains/notifications/provider";
import { escapeHtml, sanitizeUrl, renderEmailTemplate } from "../src/domains/notifications/templates";
import { AuthenticatedUser } from "../src/types/auth";
import {
  NotificationNotFoundError,
  MandatoryNotificationError,
  InvalidWebhookError,
  ForbiddenError,
  NotFoundError,
  NotificationRateLimitError,
  DomainError,
} from "../src/lib/errors";

process.env.ENABLE_TEST_EMAIL_PROVIDER = "true";

async function runSecurityGate() {
  console.log("=================================================================");
  console.log("SCALE-UP INDIA — PHASE 15 NOTIFICATIONS & COMMUNICATION SECURITY GATE");
  console.log("=================================================================\n");

  let totalPassed = 0;
  let totalFailed = 0;

  function assert(condition: boolean, code: string, message: string) {
    if (condition) {
      console.log(`  [PASS] ${code}: ${message}`);
      totalPassed++;
    } else {
      console.error(`  [FAIL] ${code}: ${message}`);
      totalFailed++;
    }
  }

  try {
    const db = await getDb();
    resetNotificationRateLimits();
    const testEmailProvider = emailProviderRegistry.getTestProvider();
    testEmailProvider.clearSentEmails();

    // =========================================================================
    // SECTION 1: DATABASE SCHEMA & MIGRATION INTEGRITY (Assertions 1-10)
    // =========================================================================
    console.log("--- SECTION 1: DATABASE SCHEMA & MIGRATION INTEGRITY ---");

    const eventsTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_events') as exists`
    );
    assert(eventsTable.rows[0]?.exists === true, "SEC-15-MIG-EVENTS", "Table notification_events exists in schema");

    const notifTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notifications') as exists`
    );
    assert(notifTable.rows[0]?.exists === true, "SEC-15-MIG-NOTIFICATIONS", "Table notifications exists in schema");

    const deliveriesTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_deliveries') as exists`
    );
    assert(deliveriesTable.rows[0]?.exists === true, "SEC-15-MIG-DELIVERIES", "Table notification_deliveries exists in schema");

    const prefsTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_preferences') as exists`
    );
    assert(prefsTable.rows[0]?.exists === true, "SEC-15-MIG-PREFERENCES", "Table notification_preferences exists in schema");

    const webhookTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_webhook_events') as exists`
    );
    assert(webhookTable.rows[0]?.exists === true, "SEC-15-MIG-WEBHOOKS", "Table notification_webhook_events exists in schema");

    const templatesTable = await query<{ exists: boolean }>(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'notification_templates') as exists`
    );
    assert(templatesTable.rows[0]?.exists === true, "SEC-15-MIG-TEMPLATES", "Table notification_templates exists in schema");

    const permsRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM permissions WHERE module = 'notification'`
    );
    assert(parseInt(permsRes.rows[0]?.count || "0", 10) >= 6, "SEC-15-PERMS-SEEDED", "At least 6 notification RBAC permissions seeded");

    const templatesCount = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM notification_templates WHERE is_active = TRUE`
    );
    assert(parseInt(templatesCount.rows[0]?.count || "0", 10) >= 5, "SEC-15-TEMPLATES-SEEDED", "Safe standard notification templates seeded");

    const webhookUnq = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_notification_webhook_provider_event'
      ) as exists`
    );
    assert(webhookUnq.rows[0]?.exists === true, "SEC-15-UNQ-WEBHOOK", "Webhook replay protection constraint exists");

    const prefUnq = await query<{ exists: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_user_category_channel'
      ) as exists`
    );
    assert(prefUnq.rows[0]?.exists === true, "SEC-15-UNQ-PREFERENCES", "Unique constraint on user notification preferences exists");

    // =========================================================================
    // SECTION 2: ACTOR REGISTRATION & SETUP (Assertions 11-15)
    // =========================================================================
    console.log("\n--- SECTION 2: ACTOR REGISTRATION & SETUP ---");

    const ts = Date.now();
    const regBuyer1 = await registerUser({
      email: `buyer1.sec15.${ts}@alphainvest.in`,
      firstName: "Rahul",
      lastName: "Mehta",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const buyer1: AuthenticatedUser = regBuyer1.user;

    const regBuyer2 = await registerUser({
      email: `buyer2.sec15.${ts}@betacapital.in`,
      firstName: "Sameer",
      lastName: "Verma",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const buyer2: AuthenticatedUser = regBuyer2.user;

    const regSeller1 = await registerUser({
      email: `seller1.sec15.${ts}@apexeng.in`,
      firstName: "Vikram",
      lastName: "Singhania",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    const seller1: AuthenticatedUser = regSeller1.user;

    const regAdmin = await registerUser({
      email: `admin.sec15.${ts}@scaleupindia.gov.in`,
      firstName: "Suresh",
      lastName: "Rao",
      password: "Password@123",
      roles: ["BUYER"],
    });
    const admin: AuthenticatedUser = {
      ...regAdmin.user,
      roles: ["SUPER_ADMIN", "ADMIN"],
      permissions: [
        "notification.read_all",
        "notification.manage",
        "notification.admin",
        "notification.audit",
      ],
    };

    assert(Boolean(buyer1 && buyer2 && seller1 && admin), "SEC-15-ACTORS-INIT", "All 4 security gate actors registered");

    // =========================================================================
    // SECTION 3: TRANSACTIONAL OUTBOX PATTERN & ROLLBACK INTEGRITY (Assertions 16-20)
    // =========================================================================
    console.log("\n--- SECTION 3: TRANSACTIONAL OUTBOX & ROLLBACK DEFENSE ---");

    const aggId1 = crypto.randomUUID();
    const idemOutbox1 = `outbox:sec15:${aggId1}:b1`;

    const outboxEvent = await enqueueOutboxEvent({
      eventType: "TRANSACTION_INITIATED",
      aggregateType: "TRANSACTION",
      aggregateId: aggId1,
      actorUserId: seller1.id,
      payload: {
        recipientUserId: buyer1.id,
        title: "Transaction Deal Room Initialized",
        safeBody: "A new transaction deal room workspace has been initialized.",
        actionType: "OPEN_DEAL_ROOM",
        actionUrl: `/buyer/deal-room/${aggId1}`,
      },
      idempotencyKey: idemOutbox1,
    });
    assert(outboxEvent.status === "PENDING", "SEC-15-OUTBOX-PENDING", "Outbox event staged with status PENDING");

    const outboxProc = await processOutboxEvents();
    assert(outboxProc.processed >= 1, "SEC-15-OUTBOX-PROCESSED", "Outbox dispatcher processed pending event");

    // Rollback test: transaction that rolls back MUST leave 0 outbox events
    const aggId2 = crypto.randomUUID();
    const idemRollback = `outbox:rollback:${aggId2}:b1`;
    try {
      await transaction(async (tx) => {
        await enqueueOutboxEvent(
          {
            eventType: "PAYMENT_CONFIRMED",
            aggregateType: "PAYMENT",
            aggregateId: aggId2,
            payload: { recipientUserId: buyer1.id, title: "Rollback Test" },
            idempotencyKey: idemRollback,
          },
          tx
        );
        throw new Error("Intentional rollback for security test");
      });
    } catch {
      // Expected rollback
    }

    const rollbackCheck = await query(
      `SELECT * FROM notification_events WHERE idempotency_key = $1`,
      [idemRollback]
    );
    assert(rollbackCheck.rows.length === 0, "SEC-15-OUTBOX-ROLLBACK", "Rolled-back transaction left ZERO outbox events in database");

    const buyer1List = await listUserNotifications(buyer1.id, { page: 1, limit: 10, unreadOnly: false });
    assert(buyer1List.totalCount >= 1, "SEC-15-NOTIF-CANONICAL-CREATED", "Canonical notification delivered from committed outbox event");

    const sentEmails = testEmailProvider.getSentEmails();
    assert(sentEmails.some((e) => e.to === buyer1.email), "SEC-15-EMAIL-DISPATCHED", "Outbound email dispatched to recipient");

    // =========================================================================
    // SECTION 4: IDEMPOTENCY & DEDUPLICATION (Assertions 21-25)
    // =========================================================================
    console.log("\n--- SECTION 4: IDEMPOTENCY & DEDUPLICATION ---");

    const idemKey = `idem:sec15:${crypto.randomUUID()}:b1`;
    const notifA = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "TRANSACTION",
      title: "Closing Condition Verified",
      safeBody: "Definitive Agreement has been executed.",
      idempotencyKey: idemKey,
    });

    const notifB = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "TRANSACTION",
      title: "Closing Condition Verified (Duplicate Call)",
      safeBody: "Definitive Agreement has been executed.",
      idempotencyKey: idemKey,
    });

    assert(notifA.id === notifB.id, "SEC-15-IDEMPOTENT-DISPATCH", "Repeated dispatch with same key returns identical notification ID");

    const countRes = await query(`SELECT COUNT(*) as count FROM notifications WHERE idempotency_key = $1`, [
      idemKey,
    ]);
    assert(parseInt(countRes.rows[0].count, 10) === 1, "SEC-15-DEDUPLICATED-ROWS", "Deduplication guarantees exactly one notification row in database");

    // Outbox idempotency
    const outboxA = await enqueueOutboxEvent({
      eventType: "SECURITY_ALERT",
      aggregateType: "SECURITY",
      aggregateId: crypto.randomUUID(),
      payload: { recipientUserId: buyer1.id },
      idempotencyKey: `outbox:idem:${crypto.randomUUID()}`,
    });
    const outboxB = await enqueueOutboxEvent({
      eventType: "SECURITY_ALERT",
      aggregateType: "SECURITY",
      aggregateId: crypto.randomUUID(),
      payload: { recipientUserId: buyer1.id },
      idempotencyKey: outboxA.idempotencyKey,
    });
    assert(outboxA.id === outboxB.id, "SEC-15-OUTBOX-DEDUP", "Outbox enqueuing is idempotent by idempotencyKey");

    // =========================================================================
    // SECTION 5: NOTIFICATION PREFERENCES & MANDATORY PROTECTION (Assertions 26-30)
    // =========================================================================
    console.log("\n--- SECTION 5: NOTIFICATION PREFERENCES & MANDATORY PROTECTION ---");

    const userPrefs = await getUserPreferences(buyer1.id);
    assert(userPrefs.length === 14, "SEC-15-PREFS-MATRIX", "Default preferences matrix generated across all 7 categories");

    let blockedMandatorySecurity = false;
    try {
      await updateUserPreferences(buyer1.id, [
        { category: "SECURITY", channel: "EMAIL", isEnabled: false },
      ]);
    } catch (err: any) {
      if (err instanceof MandatoryNotificationError) blockedMandatorySecurity = true;
    }
    assert(blockedMandatorySecurity, "SEC-15-MANDATORY-SECURITY", "Blocking disabled SECURITY notifications throws MandatoryNotificationError");

    let blockedMandatoryTxn = false;
    try {
      await updateUserPreferences(buyer1.id, [
        { category: "TRANSACTION", channel: "IN_APP", isEnabled: false },
      ]);
    } catch (err: any) {
      if (err instanceof MandatoryNotificationError) blockedMandatoryTxn = true;
    }
    assert(blockedMandatoryTxn, "SEC-15-MANDATORY-TXN", "Blocking disabled TRANSACTION notifications throws MandatoryNotificationError");

    let blockedMandatoryPayment = false;
    try {
      await updateUserPreferences(buyer1.id, [
        { category: "PAYMENT", channel: "EMAIL", isEnabled: false },
      ]);
    } catch (err: any) {
      if (err instanceof MandatoryNotificationError) blockedMandatoryPayment = true;
    }
    assert(blockedMandatoryPayment, "SEC-15-MANDATORY-PAYMENT", "Blocking disabled PAYMENT notifications throws MandatoryNotificationError");

    // Optional preference disable works
    await updateUserPreferences(buyer1.id, [
      { category: "MARKETING_INFORMATIONAL", channel: "EMAIL", isEnabled: false },
    ]);
    testEmailProvider.clearSentEmails();
    const optNotif = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "MARKETING_INFORMATIONAL",
      title: "Market Insights",
      safeBody: "New market insights report is available.",
    });
    const optEmailDelivery = await query(
      `SELECT * FROM notification_deliveries WHERE notification_id = $1 AND channel = 'EMAIL'`,
      [optNotif.id]
    );
    assert(optEmailDelivery.rows.length === 0, "SEC-15-OPTIONAL-SUPPRESSED", "Disabled optional category suppressed email delivery accurately");

    // =========================================================================
    // SECTION 6: DELIVERY STATE MACHINE & TRUTHFUL STATES (Assertions 31-35)
    // =========================================================================
    console.log("\n--- SECTION 6: DELIVERY STATE MACHINE & TRUTHFUL STATES ---");

    const truthfulNotif = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "TRANSACTION",
      title: "Closing Ready",
      safeBody: "Transaction has reached READY_FOR_CLOSING state.",
    });

    const deliveriesRes = await query<{ channel: string; status: string }>(
      `SELECT channel, status FROM notification_deliveries WHERE notification_id = $1`,
      [truthfulNotif.id]
    );
    const inAppStatus = deliveriesRes.rows.find((r) => r.channel === "IN_APP")?.status;
    const emailStatus = deliveriesRes.rows.find((r) => r.channel === "EMAIL")?.status;

    assert(inAppStatus === "DELIVERED", "SEC-15-INAPP-DELIVERED", "IN_APP delivery state recorded as DELIVERED");
    assert(emailStatus === "SENT", "SEC-15-EMAIL-TRUTHFUL-SENT", "EMAIL delivery state recorded truthfully as SENT (not falsely DELIVERED)");

    // =========================================================================
    // SECTION 7: PROVIDER WEBHOOK SECURITY & REPLAY PROTECTION (Assertions 36-45)
    // =========================================================================
    console.log("\n--- SECTION 7: PROVIDER WEBHOOK SECURITY & REPLAY PROTECTION ---");

    const lastEmail = testEmailProvider.getLastSentEmail();
    assert(Boolean(lastEmail?.providerMessageId), "SEC-15-PROVIDER-MSG-ID", "Provider message ID generated on outbound email");

    const webhookPayload = {
      eventId: `sec15_evt_${Date.now()}_01`,
      eventType: "DELIVERED",
      providerMessageId: lastEmail!.providerMessageId,
      recipient: buyer1.email,
      timestamp: new Date().toISOString(),
    };
    const validRaw = JSON.stringify(webhookPayload);
    const validSig = testEmailProvider.generateSignature(validRaw);

    const webhookRes = await processEmailWebhook("TEST_SIMULATED", validRaw, validSig);
    assert(webhookRes.success === true && webhookRes.duplicate === false, "SEC-15-WEBHOOK-VERIFIED", "Webhook signature verified and processed");

    const updatedDelivery = await query<{ status: string; delivered_at: any }>(
      `SELECT status, delivered_at FROM notification_deliveries WHERE provider_message_id = $1`,
      [lastEmail!.providerMessageId]
    );
    assert(updatedDelivery.rows[0]?.status === "DELIVERED", "SEC-15-WEBHOOK-STATUS-UPDATE", "Webhook transitioned delivery status to DELIVERED");

    // Invalid signature rejected
    let rejectedBadSig = false;
    try {
      await processEmailWebhook("TEST_SIMULATED", validRaw, "t=123,v1=bad_signature");
    } catch (err: any) {
      if (err instanceof InvalidWebhookError) rejectedBadSig = true;
    }
    assert(rejectedBadSig, "SEC-15-WEBHOOK-BAD-SIG", "Invalid webhook signature rejected with InvalidWebhookError");

    // Expired timestamp (>300s) rejected
    let rejectedExpired = false;
    try {
      const oldTs = (Math.floor(Date.now() / 1000) - 500).toString();
      const expiredSig = testEmailProvider.generateSignature(validRaw, oldTs);
      await processEmailWebhook("TEST_SIMULATED", validRaw, expiredSig, { timestamp: oldTs });
    } catch (err: any) {
      if (err instanceof InvalidWebhookError) rejectedExpired = true;
    }
    assert(rejectedExpired, "SEC-15-WEBHOOK-EXPIRED-TS", "Expired webhook timestamp (>300s) rejected");

    // Tampered payload rejected
    let rejectedTampered = false;
    try {
      const tamperedPayload = JSON.stringify({ ...webhookPayload, eventType: "FAILED" });
      await processEmailWebhook("TEST_SIMULATED", tamperedPayload, validSig);
    } catch (err: any) {
      if (err instanceof InvalidWebhookError) rejectedTampered = true;
    }
    assert(rejectedTampered, "SEC-15-WEBHOOK-TAMPER-REJECTED", "Tampered webhook payload with original signature rejected");

    // Webhook replay rejected
    const replayRes = await processEmailWebhook("TEST_SIMULATED", validRaw, validSig);
    assert(replayRes.duplicate === true, "SEC-15-WEBHOOK-REPLAY-PROTECT", "Replayed webhook recognized and duplicate prevented");

    // =========================================================================
    // SECTION 8: BOUNDED RETRIES & DEAD LETTER QUEUE (Assertions 46-50)
    // =========================================================================
    console.log("\n--- SECTION 8: BOUNDED RETRIES & DEAD LETTER QUEUE ---");

    testEmailProvider.simulateFailureNext("SMTP_TIMEOUT", "Simulated gateway connection timeout");
    const failingNotif = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "TRANSACTION",
      title: "Signature Required",
      safeBody: "Please execute the closing certificate.",
    });

    const failedDeliveryRes = await query<any>(
      `SELECT * FROM notification_deliveries WHERE notification_id = $1 AND channel = 'EMAIL'`,
      [failingNotif.id]
    );
    const failedDelivery = failedDeliveryRes.rows[0];
    assert(failedDelivery.status === "RETRYING", "SEC-15-RETRYING-STATE", "Failed email delivery transitioned to RETRYING state");
    assert(failedDelivery.attempts === 1, "SEC-15-ATTEMPTS-TRACKED", "Delivery attempts incremented to 1");

    // Retry 1
    testEmailProvider.simulateFailureNext("SMTP_TIMEOUT", "Second failure");
    const retried1 = await retryDelivery(failedDelivery.id, admin);
    assert(retried1.status === "RETRYING" && retried1.attempts === 2, "SEC-15-RETRY-ATTEMPT-2", "Second retry attempt executed and tracked");

    // Retry 2 (third failure -> DEAD_LETTER)
    testEmailProvider.simulateFailureNext("SMTP_REFUSED", "Permanent rejection");
    const retried2 = await retryDelivery(failedDelivery.id, admin);
    assert(retried2.status === "DEAD_LETTER" && retried2.attempts === 3, "SEC-15-DEAD-LETTER-TRANSITION", "Exhaustion of max retries transitioned status to DEAD_LETTER");

    // =========================================================================
    // SECTION 9: ANTI-IDOR & RECIPIENT AUTHORIZATION (Assertions 51-55)
    // =========================================================================
    console.log("\n--- SECTION 9: ANTI-IDOR & RECIPIENT AUTHORIZATION ---");

    const b1SecretNotif = await dispatchNotification({
      recipientUserId: buyer1.id,
      category: "SECURITY",
      title: "Security Alert: Login Attempt",
      safeBody: "New IP address detected.",
    });

    let b2BlockedRead = false;
    try {
      await getNotificationById(b1SecretNotif.id, buyer2.id);
    } catch (err: any) {
      if (err instanceof NotificationNotFoundError) b2BlockedRead = true;
    }
    assert(b2BlockedRead, "SEC-15-IDOR-READ-BLOCKED", "Anti-IDOR: Buyer 2 blocked from reading Buyer 1's notification");

    let b2BlockedMarkRead = false;
    try {
      await markNotificationAsRead(b1SecretNotif.id, buyer2.id);
    } catch (err: any) {
      if (err instanceof NotificationNotFoundError) b2BlockedMarkRead = true;
    }
    assert(b2BlockedMarkRead, "SEC-15-IDOR-MARK-READ-BLOCKED", "Anti-IDOR: Buyer 2 blocked from marking Buyer 1's notification read");

    const b2List = await listUserNotifications(buyer2.id, { page: 1, limit: 10, unreadOnly: false });
    assert(
      !b2List.notifications.some((n) => n.id === b1SecretNotif.id),
      "SEC-15-IDOR-LIST-SCOPED",
      "Anti-IDOR: Listing notifications strictly scoped to authenticated principal"
    );

    // Guessed UUID rejected
    let guessedIdBlocked = false;
    try {
      await getNotificationById(crypto.randomUUID(), buyer1.id);
    } catch (err: any) {
      if (err instanceof NotificationNotFoundError) guessedIdBlocked = true;
    }
    assert(guessedIdBlocked, "SEC-15-IDOR-GUESSED-ID-BLOCKED", "Guessed random UUID rejected with NotificationNotFoundError (404)");

    // Multi-tenant cross-access blocked
    let crossTenantBlocked = false;
    try {
      await getNotificationById(b1SecretNotif.id, buyer1.id, "TENANT_ORANGE");
    } catch (err: any) {
      if (err instanceof NotificationNotFoundError) crossTenantBlocked = true;
    }
    assert(crossTenantBlocked, "SEC-15-TENANT-ISOLATION", "Cross-tenant notification access strictly blocked");

    // =========================================================================
    // SECTION 10: SAFE TEMPLATES & XSS INJECTION DEFENSE (Assertions 56-62)
    // =========================================================================
    console.log("\n--- SECTION 10: SAFE TEMPLATES & SENSITIVE DATA DEFENSE ---");

    const xssScript = "<script>alert('xss')</script>";
    const escapedScript = escapeHtml(xssScript);
    assert(escapedScript.includes("&lt;script&gt;"), "SEC-15-XSS-SCRIPT-ESCAPED", "HTML script tags safely escaped");

    const xssImg = '<img src=x onerror="alert(1)">';
    const escapedImg = escapeHtml(xssImg);
    assert(!escapedImg.includes("<img") && escapedImg.includes("&lt;img"), "SEC-15-XSS-IMG-ESCAPED", "HTML image event handlers safely escaped");

    const badUrl = "javascript:alert(document.cookie)";
    const safeUrl = sanitizeUrl(badUrl);
    assert(safeUrl === "/dashboard", "SEC-15-SAFE-URL-FALLBACK", "Dangerous javascript: URL sanitized to safe /dashboard");

    const sstiPayload = "{{7*7}} ${7*7} <%= 7*7 %>";
    const renderedSsti = renderEmailTemplate("GENERIC_NOTIFICATION", {
      body: sstiPayload,
      recipientName: "Rahul",
    });
    assert(!renderedSsti.html.includes("49") && renderedSsti.html.includes("{{7*7}}"), "SEC-15-TEMPLATE-INJECTION-DEFENSE", "Template injection payloads are rendered safely as literal text");

    const rendered = renderEmailTemplate("TRANSACTION_INITIATED", {
      title: "Confidential Aerospace Acquisition Initialized",
      body: "Deal room has been initialized.",
      recipientName: "Rahul",
    });
    assert(rendered.subject === "Action Required: Transaction Deal Room Initialized", "SEC-15-GENERIC-EMAIL-SUBJECT", "Email subject is generic and institutional without leaking trade secrets");
    assert(rendered.html.includes("CONFIDENTIALITY NOTICE"), "SEC-15-CONFIDENTIALITY-DISCLAIMER", "Email template includes mandatory confidentiality notice");

    const auditRes = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE resource_type IN ('NOTIFICATION', 'EMAIL_WEBHOOK', 'NOTIFICATION_PREFERENCES')`
    );
    assert(parseInt(auditRes.rows[0].count, 10) >= 3, "SEC-15-AUDIT-LOGGED", "Immutable audit log records persisted for notification actions");

    const auditLeaksRes = await query<{ metadata: any }>(
      `SELECT metadata FROM audit_logs WHERE resource_type = 'NOTIFICATION'`
    );
    const hasLeakedSecrets = auditLeaksRes.rows.some((r) => {
      const str = JSON.stringify(r.metadata || {});
      return str.includes("password") || str.includes("secret") || str.includes("token_hash");
    });
    assert(!hasLeakedSecrets, "SEC-15-PRIVACY-AUDIT-CLEAN", "Audit log metadata contains zero raw secrets or passwords");

    // =========================================================================
    // SECTION 11: RATE LIMITING & ADMINISTRATIVE RBAC (Assertions 61-65)
    // =========================================================================
    console.log("\n--- SECTION 11: RATE LIMITING & ADMINISTRATIVE RBAC ---");

    // Rapid burst rate limiting test
    let rateLimitTriggered = false;
    try {
      for (let i = 0; i < 65; i++) {
        markNotificationAsRead("any-id", buyer1.id).catch(() => {});
      }
      await markNotificationAsRead("any-id", buyer1.id);
    } catch (err: any) {
      if (err instanceof NotificationRateLimitError) rateLimitTriggered = true;
    }
    assert(rateLimitTriggered, "SEC-15-RATE-LIMIT-TRIGGERED", "Sliding-window rate limiter triggered on excessive mutation bursts");
    resetNotificationRateLimits();

    let nonAdminBlockedDeliveries = false;
    try {
      await listDeliveriesAdmin(buyer1);
    } catch (err: any) {
      if (err instanceof ForbiddenError) nonAdminBlockedDeliveries = true;
    }
    assert(nonAdminBlockedDeliveries, "SEC-15-RBAC-NON-ADMIN-DELIVERIES", "Non-admin blocked from listing system deliveries");

    let nonAdminBlockedRetry = false;
    try {
      await retryDelivery(failedDelivery.id, buyer1);
    } catch (err: any) {
      if (err instanceof ForbiddenError) nonAdminBlockedRetry = true;
    }
    assert(nonAdminBlockedRetry, "SEC-15-RBAC-NON-ADMIN-RETRY", "Non-admin blocked from triggering delivery retry");

    const adminDeliveries = await listDeliveriesAdmin(admin, { limit: 10 });
    assert(adminDeliveries.length > 0, "SEC-15-RBAC-ADMIN-AUTHORIZED", "Platform Administrator authorized to inspect system deliveries");

    // Final Assertion: Production Test Provider Guard
    let prodGuardFired = false;
    try {
      const prevEnv = process.env.NODE_ENV;
      const prevEnable = process.env.ENABLE_TEST_EMAIL_PROVIDER;
      (process.env as any).NODE_ENV = "production";
      (process.env as any).ENABLE_TEST_EMAIL_PROVIDER = "false";
      try {
        emailProviderRegistry.getProvider("TEST_SIMULATED");
      } finally {
        (process.env as any).NODE_ENV = prevEnv;
        (process.env as any).ENABLE_TEST_EMAIL_PROVIDER = prevEnable;
      }
    } catch (err: any) {
      if (err instanceof DomainError && err.code === "PRODUCTION_PROVIDER_REQUIRED") {
        prodGuardFired = true;
      }
    }
    assert(prodGuardFired, "SEC-15-PROD-TEST-PROVIDER-GUARD", "Production environment strictly prohibits simulated test email provider");

    // =========================================================================
    // FINAL VERDICT
    // =========================================================================
    console.log("\n=================================================================");
    console.log(`PHASE 15 SECURITY GATE RESULTS: ${totalPassed} PASSED, ${totalFailed} FAILED`);
    console.log("=================================================================\n");

    if (totalFailed === 0) {
      console.log(">>> FINAL VERDICT: READY_FOR_PHASE_16 <<<\n");
      process.exit(0);
    } else {
      console.error(`>>> FINAL VERDICT: BLOCKED — PHASE_15_REMEDIATION_REQUIRED (${totalFailed} failures) <<<\n`);
      process.exit(1);
    }
  } catch (fatalErr: any) {
    console.error("FATAL ERROR in Phase 15 Security Gate:", fatalErr);
    process.exit(1);
  }
}

runSecurityGate();
