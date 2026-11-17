import { describe, it, expect, beforeEach } from "vitest";
import { resetTestDb, query } from "@/lib/db";
import { registerUser } from "@/domains/auth/service";
import {
  assertPermission,
  assertAnyRole,
  assertCanAccessUser,
  assertCanAccessDocumentRecord,
} from "@/lib/security/authorization";
import { ForbiddenError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";

describe("Phase 1: Authorization, RBAC & Anti-IDOR Protections", () => {
  let userA: AuthenticatedUser;
  let userB: AuthenticatedUser;
  let adminUser: AuthenticatedUser;

  beforeEach(async () => {
    (process.env as any).NODE_ENV = "test";
    await resetTestDb();

    // 1. Create User A (Promoter)
    const resA = await registerUser({
      email: "promoterA@deal.in",
      firstName: "Promoter",
      lastName: "A",
      password: "Password@123",
      roles: ["PROMOTER"],
    });
    userA = resA.user;

    // 2. Create User B (Buyer)
    const resB = await registerUser({
      email: "buyerB@deal.in",
      firstName: "Buyer",
      lastName: "B",
      password: "Password@123",
      roles: ["BUYER"],
    });
    userB = resB.user;

    // 3. Create Internal Verification Manager Admin
    const adminRes = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, first_name, last_name, is_email_verified)
       VALUES ('admin@scaleupindia.co.in', 'dummy_hash', 'Admin', 'Officer', TRUE)
       RETURNING id`
    );
    const adminId = adminRes.rows[0].id;

    // Assign VERIFICATION_MANAGER role
    const vmRole = await query<{ id: string }>(`SELECT id FROM roles WHERE code = 'VERIFICATION_MANAGER'`);
    await query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [adminId, vmRole.rows[0].id]);

    adminUser = {
      id: adminId,
      email: "admin@scaleupindia.co.in",
      phone: null,
      firstName: "Admin",
      lastName: "Officer",
      isEmailVerified: true,
      isPhoneVerified: false,
      isActive: true,
      isSuspended: false,
      suspensionReason: null,
      failedLoginAttempts: 0,
      lockoutUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      roles: ["VERIFICATION_MANAGER"],
      permissions: [
        "users.read",
        "profiles.verify",
        "opportunities.verify",
        "opportunities.publish",
        "documents.read_all",
        "documents.approve",
      ],
      isInternal: true,
    };
  });

  describe("Anti-IDOR User Resource Access", () => {
    it("allows a user to access their own account record", () => {
      expect(() => assertCanAccessUser(userA, userA.id)).not.toThrow();
      expect(() => assertCanAccessUser(userB, userB.id)).not.toThrow();
    });

    it("PREVENTS User A from accessing User B's account (Anti-IDOR)", () => {
      expect(() => assertCanAccessUser(userA, userB.id)).toThrow(ForbiddenError);
    });

    it("PREVENTS User B from accessing User A's account (Anti-IDOR)", () => {
      expect(() => assertCanAccessUser(userB, userA.id)).toThrow(ForbiddenError);
    });

    it("allows internal Admin with 'users.read' permission to access any user account", () => {
      expect(() => assertCanAccessUser(adminUser, userA.id)).not.toThrow();
      expect(() => assertCanAccessUser(adminUser, userB.id)).not.toThrow();
    });
  });

  describe("RBAC Permissions & Privilege Escalation Prevention", () => {
    it("enforces role-specific permissions correctly", () => {
      // Promoter has opportunities.create
      expect(() => assertPermission(userA, "opportunities.create")).not.toThrow();

      // Buyer DOES NOT have opportunities.create
      expect(() => assertPermission(userB, "opportunities.create")).toThrow(ForbiddenError);

      // Buyer has interests.submit
      expect(() => assertPermission(userB, "interests.submit")).not.toThrow();

      // Promoter DOES NOT have interests.submit
      expect(() => assertPermission(userA, "interests.submit")).toThrow(ForbiddenError);
    });

    it("prevents external commercial users from calling administrative verification permissions", () => {
      expect(() => assertPermission(userA, "opportunities.verify")).toThrow(ForbiddenError);
      expect(() => assertPermission(userB, "opportunities.verify")).toThrow(ForbiddenError);

      // Verification Manager can verify
      expect(() => assertPermission(adminUser, "opportunities.verify")).not.toThrow();
    });

    it("validates role requirements correctly", () => {
      expect(() => assertAnyRole(userA, ["PROMOTER", "INVESTOR"])).not.toThrow();
      expect(() => assertAnyRole(userB, ["PROMOTER"])).toThrow(ForbiddenError);
    });
  });

  describe("Document Authorization & Confidentiality Anti-IDOR", () => {
    const docOwnerId = "owner-uuid-123";

    it("allows the owner full access to their uploaded document", () => {
      const ownerUser = { ...userA, id: docOwnerId };
      expect(() =>
        assertCanAccessDocumentRecord(ownerUser, docOwnerId, "PRIVATE")
      ).not.toThrow();
    });

    it("BLOCKS unauthorized third party from accessing confidential document", () => {
      expect(() =>
        assertCanAccessDocumentRecord(userB, docOwnerId, "PRIVATE", false)
      ).toThrow(ForbiddenError);
    });

    it("allows internal Admin with 'documents.read_all' to inspect documents", () => {
      expect(() =>
        assertCanAccessDocumentRecord(adminUser, docOwnerId, "PRIVATE", false)
      ).not.toThrow();
    });

    it("allows counterparty to access NDA-level documents only when active NDA is executed", () => {
      // Without signed NDA: BLOCKED
      expect(() =>
        assertCanAccessDocumentRecord(userB, docOwnerId, "NDA_REQUIRED", false)
      ).toThrow(ForbiddenError);

      // With signed NDA: PERMITTED
      expect(() =>
        assertCanAccessDocumentRecord(userB, docOwnerId, "NDA_REQUIRED", true)
      ).not.toThrow();
    });
  });
});
