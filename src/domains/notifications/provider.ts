// Scale-up India — Phase 15: Email Provider Abstraction
// Path: src/domains/notifications/provider.ts

import crypto from "crypto";
import {
  EmailProviderNotConfiguredError,
  InvalidWebhookError,
  DomainError,
} from "@/lib/errors";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  metadata?: Record<string, string>;
}

export interface EmailSendResult {
  provider: string;
  providerMessageId: string;
  status: "SENT" | "QUEUED";
  timestamp: string;
}

export interface EmailWebhookEvent {
  provider: string;
  eventId: string;
  eventType: "DELIVERED" | "BOUNCED" | "FAILED" | "OPENED";
  providerMessageId: string;
  recipient: string;
  timestamp: string;
  rawPayload: any;
}

export interface EmailProvider {
  readonly name: string;
  sendEmail(msg: EmailMessage): Promise<EmailSendResult>;
  verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string,
    timestamp?: string
  ): boolean;
  parseWebhookEvent(rawPayload: string | Buffer): EmailWebhookEvent;
}

/**
 * 1. TEST / SIMULATED EMAIL PROVIDER
 * Dedicated for deterministic CI, Vitest, and security gate testing.
 * Strictly blocked in production mode.
 */
export class TestSimulatedEmailProvider implements EmailProvider {
  public readonly name = "TEST_SIMULATED";
  private sentEmails: Array<EmailMessage & { providerMessageId: string; timestamp: string }> = [];
  private failNextSend: { code: string; reason: string } | null = null;
  private secret = "test_email_webhook_secret_key_scaleup";

  public getSecret(): string {
    return this.secret;
  }

  public simulateFailureNext(code = "TRANSIENT_SMTP_TIMEOUT", reason = "Simulated upstream mail server timeout"): void {
    this.failNextSend = { code, reason };
  }

  public clearSentEmails(): void {
    this.sentEmails = [];
    this.failNextSend = null;
  }

  public getSentEmails(): Array<EmailMessage & { providerMessageId: string; timestamp: string }> {
    return [...this.sentEmails];
  }

  public getLastSentEmail(): (EmailMessage & { providerMessageId: string; timestamp: string }) | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_EMAIL_PROVIDER !== "true") {
      throw new DomainError("Test simulated email provider cannot be executed in production environment.", 500);
    }

    if (this.failNextSend) {
      const err = new DomainError(this.failNextSend.reason, 500, this.failNextSend.code);
      this.failNextSend = null;
      throw err;
    }

    const providerMessageId = `msg_sim_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const timestamp = new Date().toISOString();

    this.sentEmails.push({
      ...msg,
      providerMessageId,
      timestamp,
    });

    return {
      provider: this.name,
      providerMessageId,
      status: "SENT",
      timestamp,
    };
  }

  public generateSignature(payload: string | Buffer, timestamp?: string): string {
    const payloadStr = typeof payload === "string" ? payload : payload.toString("utf-8");
    const ts = timestamp || Math.floor(Date.now() / 1000).toString();
    const dataToSign = `${ts}.${payloadStr}`;
    const hmac = crypto.createHmac("sha256", this.secret).update(dataToSign).digest("hex");
    return `t=${ts},v1=${hmac}`;
  }

  public verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string,
    timestamp?: string
  ): boolean {
    if (!signature) return false;
    try {
      const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
      
      // Parse signature header: e.g. "t=12345,v1=abcde" or raw hex
      let ts = timestamp;
      let sigHash = signature;

      if (signature.includes("t=") && signature.includes("v1=")) {
        const parts = signature.split(",");
        for (const part of parts) {
          if (part.startsWith("t=")) ts = part.substring(2);
          if (part.startsWith("v1=")) sigHash = part.substring(3);
        }
      }

      if (ts) {
        const nowSec = Math.floor(Date.now() / 1000);
        const eventSec = parseInt(ts, 10);
        // Reject webhooks older than 300 seconds (5 minutes)
        if (Math.abs(nowSec - eventSec) > 300) {
          return false;
        }
      }

      const dataToSign = ts ? `${ts}.${payloadStr}` : payloadStr;
      const expectedHmac = crypto.createHmac("sha256", this.secret).update(dataToSign).digest("hex");

      const bufExpected = Buffer.from(expectedHmac, "hex");
      const bufSig = Buffer.from(sigHash, "hex");

      if (bufExpected.length !== bufSig.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufExpected, bufSig);
    } catch {
      return false;
    }
  }

  public parseWebhookEvent(rawPayload: string | Buffer): EmailWebhookEvent {
    const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
    const parsed = JSON.parse(payloadStr);

    return {
      provider: this.name,
      eventId: parsed.eventId || parsed.id || `evt_${Date.now()}`,
      eventType: parsed.eventType || parsed.event || "DELIVERED",
      providerMessageId: parsed.providerMessageId || parsed.messageId || "",
      recipient: parsed.recipient || parsed.email || "",
      timestamp: parsed.timestamp || new Date().toISOString(),
      rawPayload: parsed,
    };
  }
}

/**
 * 2. PRODUCTION EMAIL PROVIDER (SendGrid / SMTP API)
 */
export class ProductionEmailProvider implements EmailProvider {
  public readonly name = "SENDGRID";

  private getApiKey(): string {
    const key = process.env.EMAIL_API_KEY || process.env.SENDGRID_API_KEY;
    if (!key && process.env.NODE_ENV === "production") {
      throw new EmailProviderNotConfiguredError(
        "Production EMAIL_API_KEY is missing. Real email operations cannot proceed."
      );
    }
    return key || "";
  }

  private getWebhookSecret(): string {
    const secret = process.env.EMAIL_WEBHOOK_SECRET;
    if (!secret && process.env.NODE_ENV === "production") {
      throw new EmailProviderNotConfiguredError(
        "Production EMAIL_WEBHOOK_SECRET is missing. Webhook verification cannot proceed."
      );
    }
    return secret || "";
  }

  public async sendEmail(msg: EmailMessage): Promise<EmailSendResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new EmailProviderNotConfiguredError();
    }

    const fromEmail = process.env.EMAIL_FROM || "notifications@scaleupindia.in";

    // Send via Resend API (India-compatible)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Scale-up India <${fromEmail}>`,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new DomainError(
        `Email delivery failed: ${response.status} ${errorBody}`,
        502,
        "EMAIL_DELIVERY_FAILED"
      );
    }

    const result = await response.json() as { id?: string };
    const providerMessageId = result.id || `resend_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    return {
      provider: this.name,
      providerMessageId,
      status: "SENT",
      timestamp: new Date().toISOString(),
    };
  }

  public verifyWebhookSignature(
    rawPayload: string | Buffer,
    signature: string,
    timestamp?: string
  ): boolean {
    const secret = this.getWebhookSecret();
    if (!secret || !signature) return false;

    try {
      const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
      
      let ts = timestamp;
      let sigHash = signature;

      if (signature.includes("t=") && signature.includes("v1=")) {
        const parts = signature.split(",");
        for (const part of parts) {
          if (part.startsWith("t=")) ts = part.substring(2);
          if (part.startsWith("v1=")) sigHash = part.substring(3);
        }
      }

      if (ts) {
        const nowSec = Math.floor(Date.now() / 1000);
        const eventSec = parseInt(ts, 10);
        if (Math.abs(nowSec - eventSec) > 300) {
          return false;
        }
      }

      const dataToSign = ts ? `${ts}.${payloadStr}` : payloadStr;
      const expectedHmac = crypto.createHmac("sha256", secret).update(dataToSign).digest("hex");

      const bufExpected = Buffer.from(expectedHmac, "hex");
      const bufSig = Buffer.from(sigHash, "hex");

      if (bufExpected.length !== bufSig.length) {
        return false;
      }

      return crypto.timingSafeEqual(bufExpected, bufSig);
    } catch {
      return false;
    }
  }

  public parseWebhookEvent(rawPayload: string | Buffer): EmailWebhookEvent {
    const payloadStr = typeof rawPayload === "string" ? rawPayload : rawPayload.toString("utf-8");
    const parsed = JSON.parse(payloadStr);

    let eventType: "DELIVERED" | "BOUNCED" | "FAILED" | "OPENED" = "DELIVERED";
    const rawType = (parsed.event || parsed.eventType || "").toLowerCase();
    if (rawType.includes("deliver")) eventType = "DELIVERED";
    else if (rawType.includes("bounce")) eventType = "BOUNCED";
    else if (rawType.includes("fail") || rawType.includes("drop")) eventType = "FAILED";
    else if (rawType.includes("open")) eventType = "OPENED";

    return {
      provider: this.name,
      eventId: parsed.sg_event_id || parsed.eventId || parsed.id || `evt_${Date.now()}`,
      eventType,
      providerMessageId: parsed.sg_message_id || parsed.providerMessageId || parsed.messageId || "",
      recipient: parsed.email || parsed.recipient || "",
      timestamp: parsed.timestamp ? new Date(parsed.timestamp * 1000).toISOString() : new Date().toISOString(),
      rawPayload: parsed,
    };
  }
}

/**
 * 3. EMAIL PROVIDER REGISTRY
 */
class EmailProviderRegistry {
  private providers = new Map<string, EmailProvider>();
  private testProvider = new TestSimulatedEmailProvider();

  constructor() {
    this.registerProvider(this.testProvider);
    this.registerProvider(new ProductionEmailProvider());
  }

  public registerProvider(provider: EmailProvider): void {
    this.providers.set(provider.name.toUpperCase(), provider);
  }

  public getProvider(name?: string): EmailProvider {
    const targetName = (name || (process.env.NODE_ENV === "production" ? "SENDGRID" : "TEST_SIMULATED")).toUpperCase();

    // Guard: Prevent simulated test provider in production unless explicitly enabled
    if (
      targetName === "TEST_SIMULATED" &&
      process.env.NODE_ENV === "production" &&
      process.env.ENABLE_TEST_EMAIL_PROVIDER !== "true"
    ) {
      throw new DomainError(
        "Simulated test email provider cannot be used in production environment.",
        403,
        "PRODUCTION_PROVIDER_REQUIRED"
      );
    }

    const provider = this.providers.get(targetName);
    if (!provider) {
      throw new DomainError(`Email provider '${targetName}' is not registered.`, 400);
    }
    return provider;
  }

  public getTestProvider(): TestSimulatedEmailProvider {
    return this.testProvider;
  }
}

export const emailProviderRegistry = new EmailProviderRegistry();
