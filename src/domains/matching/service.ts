// Scale-up India — Phase 5: Matching Engine Domain Service
// Orchestration, Database Persistence, Anti-IDOR Guards, and Masked Teaser Delivery

import { query, transaction } from "@/lib/db";
import { AuthenticatedUser } from "@/types/auth";
import {
  MatchFilterInput,
  BuyerMatchListResult,
  BuyerMatchItem,
  BuyerOpportunityMatchRecord,
  MatchClassification,
} from "@/types/matching";
import { AcquisitionMandateRecord } from "@/types/buyer";
import { OpportunityRecord, OpportunityStatus } from "@/types/opportunity";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { evaluateOpportunityMatch } from "./evaluator";
import { MATCHING_ALGORITHM_VERSION } from "./weights";
import {
  mapOpportunityRecord,
  maskOpportunityForUser,
} from "@/domains/opportunity/service";
import { mapAcquisitionMandate } from "@/domains/buyer/service";
import { auditLog } from "@/domains/audit/logger";

/**
 * On-demand or scheduled recalculation of matches for a buyer's mandates
 */
export async function refreshBuyerMatches(
  user: AuthenticatedUser,
  mandateId?: string,
  context?: { ip?: string; userAgent?: string }
): Promise<{ refreshedCount: number; eligibleCount: number; topScore: number }> {
  // 1. Resolve Buyer Profile
  const profileRes = await query<any>(
    `SELECT id, onboarding_status FROM buyer_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [user.id]
  );

  if (profileRes.rows.length === 0) {
    throw new NotFoundError(
      "Buyer profile not found. Please complete buyer registration first."
    );
  }

  const profile = profileRes.rows[0];
  if (profile.onboarding_status === "SUSPENDED") {
    throw new ForbiddenError(
      "Suspended buyer accounts cannot perform matching operations."
    );
  }

  // 2. Fetch Buyer's Mandates (Active or Draft only, never Archived or Expired)
  let mandatesQuery = `SELECT * FROM acquisition_mandates WHERE buyer_profile_id = $1 AND deleted_at IS NULL AND status NOT IN ('ARCHIVED', 'EXPIRED')`;
  const params: any[] = [profile.id];

  if (mandateId) {
    mandatesQuery += ` AND id = $2`;
    params.push(mandateId);
  }

  const mandatesRes = await query<any>(mandatesQuery, params);
  if (mandateId && mandatesRes.rows.length === 0) {
    throw new NotFoundError("Acquisition mandate not found or does not belong to you.");
  }

  const mandates: AcquisitionMandateRecord[] = [];
  for (const mRow of mandatesRes.rows) {
    const indRes = await query<any>(
      `SELECT * FROM mandate_target_industries WHERE mandate_id = $1`,
      [mRow.id]
    );
    const geoRes = await query<any>(
      `SELECT * FROM mandate_target_geographies WHERE mandate_id = $1`,
      [mRow.id]
    );

    const industries = indRes.rows.map((r: any) => ({
      id: r.id,
      mandateId: r.mandate_id,
      industry: r.industry,
      subSectors:
        typeof r.sub_sectors === "string"
          ? JSON.parse(r.sub_sectors)
          : r.sub_sectors || [],
      otherSubSector: r.other_sub_sector,
      createdAt: new Date(r.created_at),
    }));

    const geographies = geoRes.rows.map((r: any) => ({
      id: r.id,
      mandateId: r.mandate_id,
      region: r.region,
      countries:
        typeof r.countries === "string"
          ? JSON.parse(r.countries)
          : r.countries || [],
      states:
        typeof r.states === "string" ? JSON.parse(r.states) : r.states || [],
      cities:
        typeof r.cities === "string" ? JSON.parse(r.cities) : r.cities || [],
      createdAt: new Date(r.created_at),
    }));

    mandates.push(mapAcquisitionMandate(mRow, industries, geographies));
  }

  // 3. Fetch All Eligible Published Opportunities
  const oppsRes = await query<any>(
    `SELECT * FROM opportunities WHERE status = 'PUBLISHED' AND deleted_at IS NULL ORDER BY created_at DESC`
  );
  const publishedOpportunities: OpportunityRecord[] = oppsRes.rows.map((r: any) =>
    mapOpportunityRecord(r)
  );

  let refreshedCount = 0;
  let eligibleCount = 0;
  let topScore = 0;

  // Purge stale match records for opportunities no longer published or mandates no longer active
  await query(
    `DELETE FROM buyer_opportunity_matches
     WHERE buyer_id = $1
       AND (
         opportunity_id NOT IN (SELECT id FROM opportunities WHERE status = 'PUBLISHED' AND deleted_at IS NULL)
         OR mandate_id NOT IN (SELECT id FROM acquisition_mandates WHERE deleted_at IS NULL AND status NOT IN ('ARCHIVED', 'EXPIRED'))
       )`,
    [user.id]
  );

  // 4. Deterministic Evaluation Loop
  for (const mandate of mandates) {
    for (const opportunity of publishedOpportunities) {
      const match = evaluateOpportunityMatch(mandate, opportunity, {
        buyerId: user.id,
        buyerProfileId: profile.id,
      });

      await query(
        `INSERT INTO buyer_opportunity_matches (
          buyer_id, buyer_profile_id, mandate_id, opportunity_id,
          is_eligible, score, classification, matched_criteria, unmatched_criteria,
          blocking_criteria, reasons, matching_version, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (mandate_id, opportunity_id) DO UPDATE SET
          is_eligible = EXCLUDED.is_eligible,
          score = EXCLUDED.score,
          classification = EXCLUDED.classification,
          matched_criteria = EXCLUDED.matched_criteria,
          unmatched_criteria = EXCLUDED.unmatched_criteria,
          blocking_criteria = EXCLUDED.blocking_criteria,
          reasons = EXCLUDED.reasons,
          matching_version = EXCLUDED.matching_version,
          updated_at = NOW()`,
        [
          user.id,
          profile.id,
          mandate.id,
          opportunity.id,
          match.isEligible,
          match.score,
          match.classification,
          JSON.stringify(match.matchedCriteria),
          JSON.stringify(match.unmatchedCriteria),
          JSON.stringify(match.blockingCriteria),
          JSON.stringify(match.reasons),
          MATCHING_ALGORITHM_VERSION,
        ]
      );

      refreshedCount++;
      if (match.isEligible) {
        eligibleCount++;
        if (match.score > topScore) {
          topScore = match.score;
        }
      }
    }
  }

  await auditLog({
    actorId: user.id,
    action: "MATCHES_REFRESHED",
    resourceType: "buyer_opportunity_matches",
    resourceId: profile.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: {
      mandatesEvaluated: mandates.length,
      opportunitiesEvaluated: publishedOpportunities.length,
      refreshedCount,
      eligibleCount,
      topScore,
      matchingVersion: MATCHING_ALGORITHM_VERSION,
    },
  });

  return { refreshedCount, eligibleCount, topScore };
}

/**
 * Lists matches for the authenticated buyer (Anti-IDOR protected)
 */
export async function listBuyerMatches(
  user: AuthenticatedUser,
  filters: MatchFilterInput = {}
): Promise<BuyerMatchListResult> {
  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(50, Math.max(1, Number(filters.limit || 10)));
  const offset = (page - 1) * limit;

  // Build query: strictly WHERE bom.buyer_id = $1 AND matching_version = $2 AND o.status = 'PUBLISHED' AND am is active
  let whereClause = `WHERE bom.buyer_id = $1 AND bom.matching_version = $2 AND o.status = 'PUBLISHED' AND o.deleted_at IS NULL AND am.deleted_at IS NULL AND am.status NOT IN ('ARCHIVED', 'EXPIRED')`;
  const queryParams: any[] = [user.id, MATCHING_ALGORITHM_VERSION];

  if (filters.mandateId) {
    queryParams.push(filters.mandateId);
    whereClause += ` AND bom.mandate_id = $${queryParams.length}`;
  }

  if (filters.classification) {
    queryParams.push(filters.classification);
    whereClause += ` AND bom.classification = $${queryParams.length}`;
  }

  if (filters.minScore !== undefined) {
    queryParams.push(Number(filters.minScore));
    whereClause += ` AND bom.score >= $${queryParams.length}`;
  }

  if (filters.isEligibleOnly !== false) {
    whereClause += ` AND bom.is_eligible = true`;
  }

  if (filters.industry) {
    queryParams.push(`%${filters.industry}%`);
    whereClause += ` AND o.industry ILIKE $${queryParams.length}`;
  }

  // Count total matches
  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM buyer_opportunity_matches bom
     JOIN opportunities o ON bom.opportunity_id = o.id
     JOIN acquisition_mandates am ON bom.mandate_id = am.id
     ${whereClause}`,
    queryParams
  );
  const total = Number(countRes.rows[0]?.count || 0);

  // Sorting
  const sortCol = filters.sortBy === "createdAt" ? "bom.created_at" : "bom.score";
  const sortDir = filters.sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

  // Data query
  queryParams.push(limit, offset);
  const dataRes = await query<any>(
    `SELECT 
       bom.id as match_id,
       bom.mandate_id,
       am.name as mandate_name,
       bom.opportunity_id,
       bom.score,
       bom.classification,
       bom.is_eligible,
       bom.matched_criteria,
       bom.unmatched_criteria,
       bom.blocking_criteria,
       bom.reasons,
       bom.matching_version,
       bom.created_at as match_created_at,
       o.*
     FROM buyer_opportunity_matches bom
     JOIN opportunities o ON bom.opportunity_id = o.id
     JOIN acquisition_mandates am ON bom.mandate_id = am.id
     ${whereClause}
     ORDER BY ${sortCol} ${sortDir}, bom.created_at DESC
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams
  );

  const items: BuyerMatchItem[] = dataRes.rows.map((row) => {
    const oppRecord = mapOpportunityRecord(row);
    // STRICT SECURITY INVARIANT: Pass through server-side progressive masking
    const maskedOpp = maskOpportunityForUser(oppRecord, user);

    return {
      id: row.match_id,
      mandateId: row.mandate_id,
      mandateName: row.mandate_name,
      opportunityId: row.opportunity_id,
      score: Number(row.score),
      classification: row.classification as MatchClassification,
      isEligible: Boolean(row.is_eligible),
      matchedCriteria:
        typeof row.matched_criteria === "string"
          ? JSON.parse(row.matched_criteria)
          : row.matched_criteria || [],
      unmatchedCriteria:
        typeof row.unmatched_criteria === "string"
          ? JSON.parse(row.unmatched_criteria)
          : row.unmatched_criteria || [],
      blockingCriteria:
        typeof row.blocking_criteria === "string"
          ? JSON.parse(row.blocking_criteria)
          : row.blocking_criteria || [],
      reasons:
        typeof row.reasons === "string"
          ? JSON.parse(row.reasons)
          : row.reasons || [],
      matchingVersion: row.matching_version,
      createdAt: new Date(row.match_created_at),
      opportunity: maskedOpp,
    };
  });

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Retrieves a single match detail by ID with progressive masking
 */
export async function getBuyerMatchById(
  matchId: string,
  user: AuthenticatedUser
): Promise<BuyerMatchItem> {
  const res = await query<any>(
    `SELECT 
       bom.id as match_id,
       bom.buyer_id,
       bom.mandate_id,
       am.name as mandate_name,
       am.status as mandate_status,
       am.deleted_at as mandate_deleted_at,
       bom.opportunity_id,
       bom.score,
       bom.classification,
       bom.is_eligible,
       bom.matched_criteria,
       bom.unmatched_criteria,
       bom.blocking_criteria,
       bom.reasons,
       bom.matching_version,
       bom.created_at as match_created_at,
       o.*
     FROM buyer_opportunity_matches bom
     JOIN opportunities o ON bom.opportunity_id = o.id
     JOIN acquisition_mandates am ON bom.mandate_id = am.id
     WHERE bom.id = $1`,
    [matchId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Match record not found.");
  }

  const row = res.rows[0];

  // Anti-IDOR: Must be the owning buyer or an authorized admin
  const isOwner = row.buyer_id === user.id;
  const isAdmin =
    user.roles.includes("SUPER_ADMIN") ||
    user.roles.includes("ADMIN") ||
    user.permissions.includes("matches.read_all");

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("You are not authorized to access this match record.");
  }

  // Check opportunity publication status
  if (row.status !== OpportunityStatus.PUBLISHED || row.deleted_at !== null) {
    throw new NotFoundError(
      "Matched opportunity is no longer published on the platform."
    );
  }

  // Check mandate active status
  if (row.mandate_deleted_at !== null || ["ARCHIVED", "EXPIRED"].includes(row.mandate_status)) {
    throw new NotFoundError("Associated acquisition mandate is no longer active.");
  }

  // Check matching algorithm version
  if (row.matching_version !== MATCHING_ALGORITHM_VERSION) {
    throw new NotFoundError("Match record was computed by a legacy algorithm version and has expired.");
  }

  const oppRecord = mapOpportunityRecord(row);
  const maskedOpp = maskOpportunityForUser(oppRecord, user);

  return {
    id: row.match_id,
    mandateId: row.mandate_id,
    mandateName: row.mandate_name,
    opportunityId: row.opportunity_id,
    score: Number(row.score),
    classification: row.classification as MatchClassification,
    isEligible: Boolean(row.is_eligible),
    matchedCriteria:
      typeof row.matched_criteria === "string"
        ? JSON.parse(row.matched_criteria)
        : row.matched_criteria || [],
    unmatchedCriteria:
      typeof row.unmatched_criteria === "string"
        ? JSON.parse(row.unmatched_criteria)
        : row.unmatched_criteria || [],
    blockingCriteria:
      typeof row.blocking_criteria === "string"
        ? JSON.parse(row.blocking_criteria)
        : row.blocking_criteria || [],
    reasons:
      typeof row.reasons === "string"
        ? JSON.parse(row.reasons)
        : row.reasons || [],
    matchingVersion: row.matching_version,
    createdAt: new Date(row.match_created_at),
    opportunity: maskedOpp,
  };
}

/**
 * Admin view of all matches across buyers (Audited)
 */
export async function listAdminMatches(
  adminUser: AuthenticatedUser,
  filters: MatchFilterInput = {},
  context?: { ip?: string; userAgent?: string }
): Promise<any> {
  const isAdmin =
    adminUser.roles.includes("SUPER_ADMIN") ||
    adminUser.roles.includes("ADMIN") ||
    adminUser.permissions.includes("matches.read_all");

  if (!isAdmin) {
    throw new ForbiddenError(
      "Administrative privileges required to inspect global match directory."
    );
  }

  const page = Math.max(1, Number(filters.page || 1));
  const limit = Math.min(50, Math.max(1, Number(filters.limit || 20)));
  const offset = (page - 1) * limit;

  let whereClause = `WHERE o.deleted_at IS NULL`;
  const queryParams: any[] = [];

  if (filters.classification) {
    queryParams.push(filters.classification);
    whereClause += ` AND bom.classification = $${queryParams.length}`;
  }

  if (filters.minScore !== undefined) {
    queryParams.push(Number(filters.minScore));
    whereClause += ` AND bom.score >= $${queryParams.length}`;
  }

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*) as count 
     FROM buyer_opportunity_matches bom
     JOIN opportunities o ON bom.opportunity_id = o.id
     JOIN buyer_profiles bp ON bom.buyer_profile_id = bp.id
     ${whereClause}`,
    queryParams
  );
  const total = Number(countRes.rows[0]?.count || 0);

  queryParams.push(limit, offset);
  const dataRes = await query<any>(
    `SELECT 
       bom.id as match_id,
       bom.score,
       bom.classification,
       bom.is_eligible,
       bom.matching_version,
       bom.created_at,
       bp.id as buyer_profile_id,
       bp.legal_name as buyer_legal_name,
       bp.buyer_type,
       am.id as mandate_id,
       am.name as mandate_name,
       o.id as opportunity_id,
       o.reference_code,
       o.title as opportunity_title,
       o.industry as opportunity_industry,
       o.status as opportunity_status
     FROM buyer_opportunity_matches bom
     JOIN opportunities o ON bom.opportunity_id = o.id
     JOIN buyer_profiles bp ON bom.buyer_profile_id = bp.id
     JOIN acquisition_mandates am ON bom.mandate_id = am.id
     ${whereClause}
     ORDER BY bom.score DESC, bom.created_at DESC
     LIMIT $${queryParams.length - 1} OFFSET $${queryParams.length}`,
    queryParams
  );

  await auditLog({
    actorId: adminUser.id,
    action: "ADMIN_INSPECT_MATCHES",
    resourceType: "buyer_opportunity_matches",
    resourceId: "global",
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: { page, limit, total },
  });

  return {
    items: dataRes.rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
