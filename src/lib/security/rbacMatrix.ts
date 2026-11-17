// Scale-up India — Phase 16: Centralized RBAC Matrix & Separation of Duties
// Path: src/lib/security/rbacMatrix.ts

import { AuthenticatedUser } from "@/types/auth";
import { ForbiddenError } from "@/lib/errors";

export interface RbacRule {
  role: string;
  module: string;
  action: string;
  allowed: boolean;
  requiresSeparationOfDuties?: boolean;
}

/**
 * Platform Canonical RBAC Matrix
 */
export const RBAC_MATRIX: RbacRule[] = [
  // Super Admin
  { role: "SUPER_ADMIN", module: "all", action: "*", allowed: true },

  // Admin
  { role: "ADMIN", module: "opportunity", action: "review", allowed: true },
  { role: "ADMIN", module: "opportunity", action: "publish", allowed: true },
  { role: "ADMIN", module: "transaction", action: "review", allowed: true },
  { role: "ADMIN", module: "transaction", action: "close", allowed: true },
  { role: "ADMIN", module: "notifications", action: "retry", allowed: true },
  { role: "ADMIN", module: "payments", action: "reconcile", allowed: true },

  // Reviewer / Due Diligence / Legal
  { role: "REVIEWER", module: "diligence", action: "review_evidence", allowed: true, requiresSeparationOfDuties: true },
  { role: "REVIEWER", module: "diligence", action: "create_findings", allowed: true },
  { role: "REVIEWER", module: "valuation", action: "review_model", allowed: true, requiresSeparationOfDuties: true },
  { role: "REVIEWER", module: "transaction", action: "verify_conditions", allowed: true },
  { role: "REVIEWER", module: "transaction", action: "approve", allowed: true, requiresSeparationOfDuties: true },

  // Finance
  { role: "FINANCE", module: "payments", action: "view_ledger", allowed: true },
  { role: "FINANCE", module: "payments", action: "reconcile", allowed: true },
  { role: "FINANCE", module: "transaction", action: "verify_escrow_conditions", allowed: true },

  // Buyer
  { role: "BUYER", module: "opportunity", action: "explore_catalog", allowed: true },
  { role: "BUYER", module: "eoi", action: "submit", allowed: true },
  { role: "BUYER", module: "nda", action: "sign", allowed: true },
  { role: "BUYER", module: "mou", action: "propose", allowed: true },
  { role: "BUYER", module: "payments", action: "deposit_token", allowed: true },
  { role: "BUYER", module: "diligence", action: "request_docs", allowed: true },
  { role: "BUYER", module: "valuation", action: "create_model", allowed: true },
  { role: "BUYER", module: "transaction", action: "confirm_terms", allowed: true },

  // Seller / Promoter
  { role: "PROMOTER", module: "opportunity", action: "create_dossier", allowed: true },
  { role: "PROMOTER", module: "opportunity", action: "submit_for_review", allowed: true },
  { role: "PROMOTER", module: "eoi", action: "respond", allowed: true },
  { role: "PROMOTER", module: "nda", action: "sign", allowed: true },
  { role: "PROMOTER", module: "mou", action: "respond", allowed: true },
  { role: "PROMOTER", module: "diligence", action: "upload_evidence", allowed: true },
  { role: "PROMOTER", module: "transaction", action: "confirm_terms", allowed: true },
];

/**
 * Enforces strict Separation of Duties invariants:
 * - Anti-Self-Approval: Creator of a valuation model or transaction cannot approve/review their own submission
 * - Promoters cannot review their own uploaded evidence
 * - Counterparties cannot sign or confirm on behalf of each other
 */
export function assertSeparationOfDuties(
  action: "REVIEW_VALUATION" | "APPROVE_TRANSACTION" | "REVIEW_DILIGENCE_EVIDENCE" | "CONFIRM_TRANSACTION_TERMS",
  actorId: string,
  targetCreatorId: string,
  counterpartyId?: string
): void {
  // 1. Anti-Self-Approval
  if (action === "REVIEW_VALUATION" && actorId === targetCreatorId) {
    throw new ForbiddenError(
      "Separation of Duties Violation: Model creator is prohibited from approving their own valuation model (Anti-Self-Approval)."
    );
  }

  if (action === "APPROVE_TRANSACTION" && actorId === targetCreatorId) {
    throw new ForbiddenError(
      "Separation of Duties Violation: Transaction creator is prohibited from approving their own transaction for closing (Anti-Self-Approval)."
    );
  }

  if (action === "REVIEW_DILIGENCE_EVIDENCE" && actorId === targetCreatorId) {
    throw new ForbiddenError(
      "Separation of Duties Violation: Promoter is prohibited from reviewing or approving their own uploaded evidence."
    );
  }

  // 2. Counterparty Spoofing Defense
  if (action === "CONFIRM_TRANSACTION_TERMS" && counterpartyId && actorId === counterpartyId) {
    throw new ForbiddenError(
      "Separation of Duties Violation: Principal cannot execute terms confirmation on behalf of counterparty."
    );
  }
}

/**
 * Checks whether any of the user's active roles grants the requested permission
 */
export function hasPermission(roles: string[], permissionCode: string): boolean {
  if (roles.includes("SUPER_ADMIN")) {
    return true;
  }
  if (permissionCode.startsWith("security.")) {
    return roles.includes("ADMIN");
  }
  return false;
}
