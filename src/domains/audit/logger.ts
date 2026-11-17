import { query } from "@/lib/db";
import { hashIp } from "@/lib/security/crypto";

export interface AuditLogEntry {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Appends an immutable structured audit log entry to the database
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const ipHashed = hashIp(entry.ip);
  const metadataJson = JSON.stringify(entry.metadata || {});

  try {
    await query(
      `INSERT INTO audit_logs 
       (actor_id, action, resource_type, resource_id, ip_hash, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actorId || null,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        ipHashed,
        entry.userAgent || null,
        metadataJson,
      ]
    );
  } catch (err) {
    // Audit logging failure should be logged to stderr without leaking secrets
    console.error("[CRITICAL] Failed to persist audit log:", entry.action, err);
  }
}

