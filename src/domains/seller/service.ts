import { query, transaction } from "@/lib/db";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "@/lib/errors";
import {
  SellerProfileRecord,
  BusinessProfileRecord,
  BusinessFinancialRecord,
  BusinessOwnershipRecord,
  SellerTransactionPreferenceRecord,
  SellerDocumentRecord,
  SellerInternalNoteRecord,
  OnboardingDossier,
  OnboardingStatus,
} from "@/types/seller";
import { AuthenticatedUser } from "@/types/auth";
import { auditLog } from "@/domains/audit/logger";

/**
 * Calculates profile completion percentage across the 7 onboarding sections
 */
export function calculateCompletion(sections: string[]): number {
  const sectionWeights: Record<string, number> = {
    promoter: 15,
    identity: 15,
    overview: 15,
    financials: 20,
    ownership: 15,
    intent: 10,
    documents: 10,
  };

  let total = 0;
  for (const s of sections) {
    if (sectionWeights[s]) {
      total += sectionWeights[s];
    }
  }
  return Math.min(100, total);
}

/**
 * Retrieves or initializes a seller profile for the authenticated user
 */
export async function getOrCreateSellerProfile(
  user: AuthenticatedUser
): Promise<SellerProfileRecord> {
  const existing = await query<any>(
    `SELECT * FROM seller_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [user.id]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    return mapSellerProfile(row);
  }

  // Initialize new draft seller profile
  return await transaction(async (tx) => {
    const res = await tx.query<any>(
      `INSERT INTO seller_profiles (
        user_id, designation, mobile, email, preferred_comm_method,
        onboarding_status, current_step, completion_percentage
      ) VALUES ($1, 'Promoter / Owner', $2, $3, 'IN_APP', 'DRAFT', 1, 0)
      RETURNING *`,
      [user.id, user.phone || "+919999999999", user.email]
    );

    const profile = res.rows[0];

    // Initialize progress tracking record
    await tx.query(
      `INSERT INTO onboarding_progress (seller_profile_id, sections_completed, last_active_section, draft_payload)
       VALUES ($1, '[]'::jsonb, 'promoter', '{}'::jsonb)`,
      [profile.id]
    );

    await auditLog({
      actorId: user.id,
      action: "SELLER_ONBOARDING_STARTED",
      resourceType: "seller_profiles",
      resourceId: profile.id,
    });

    return mapSellerProfile(profile);
  });
}

/**
 * Retrieves the full seller dossier (Anti-IDOR protected)
 */
export async function getSellerDossier(
  targetUserId: string,
  requestingUser: AuthenticatedUser
): Promise<OnboardingDossier> {
  // ANTI-IDOR CHECK: Requesting user MUST be the owner OR an authorized admin with 'sellers.read'
  const isOwner = requestingUser.id === targetUserId;
  const isAuthorizedAdmin =
    requestingUser.roles.includes("SUPER_ADMIN") ||
    requestingUser.permissions.includes("sellers.read") ||
    requestingUser.permissions.includes("profiles.verify");

  if (!isOwner && !isAuthorizedAdmin) {
    throw new ForbiddenError("You are not authorized to access this seller dossier.");
  }

  const profileRes = await query<any>(
    `SELECT * FROM seller_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [targetUserId]
  );

  if (profileRes.rows.length === 0) {
    throw new NotFoundError("Seller profile not found.");
  }

  const profile = mapSellerProfile(profileRes.rows[0]);

  // Load business profile
  const bizRes = await query<any>(
    `SELECT * FROM business_profiles WHERE seller_profile_id = $1`,
    [profile.id]
  );
  const business = bizRes.rows.length > 0 ? mapBusinessProfile(bizRes.rows[0]) : null;

  // Load financials
  const finRes = await query<any>(
    `SELECT * FROM business_financial_profiles WHERE seller_profile_id = $1 ORDER BY financial_year DESC`,
    [profile.id]
  );
  const financials = finRes.rows.map(mapFinancialRecord);

  // Load ownerships
  const ownRes = await query<any>(
    `SELECT * FROM business_ownerships WHERE seller_profile_id = $1 ORDER BY ownership_percentage DESC`,
    [profile.id]
  );
  const ownership = ownRes.rows.map(mapOwnershipRecord);

  // Load transaction preferences
  const prefRes = await query<any>(
    `SELECT * FROM seller_transaction_preferences WHERE seller_profile_id = $1`,
    [profile.id]
  );
  const transactionPreferences =
    prefRes.rows.length > 0 ? mapTransactionPreference(prefRes.rows[0]) : null;

  // Load documents
  const docRes = await query<any>(
    `SELECT * FROM seller_documents WHERE seller_profile_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [profile.id]
  );
  const documents = docRes.rows.map(mapDocumentRecord);

  // Load progress & draft
  const progRes = await query<any>(
    `SELECT * FROM onboarding_progress WHERE seller_profile_id = $1`,
    [profile.id]
  );

  let draftPayload = {};
  let lastActiveSection = "promoter";
  let sectionsCompleted: string[] = [];

  if (progRes.rows.length > 0) {
    draftPayload = progRes.rows[0].draft_payload || {};
    lastActiveSection = progRes.rows[0].last_active_section || "promoter";
    sectionsCompleted = progRes.rows[0].sections_completed || [];
  }

  // If requesting user is admin, also fetch internal notes
  let internalNotes: SellerInternalNoteRecord[] | undefined = undefined;
  if (isAuthorizedAdmin) {
    const notesRes = await query<any>(
      `SELECT sin.*, u.first_name, u.last_name 
       FROM seller_internal_notes sin
       JOIN users u ON sin.author_id = u.id
       WHERE sin.seller_profile_id = $1 
       ORDER BY sin.created_at DESC`,
      [profile.id]
    );
    internalNotes = notesRes.rows.map((n) => ({
      id: n.id,
      sellerProfileId: n.seller_profile_id,
      authorId: n.author_id,
      authorName: `${n.first_name} ${n.last_name}`,
      content: n.content,
      category: n.category,
      createdAt: new Date(n.created_at),
    }));
  }

  return {
    profile,
    business,
    financials,
    ownership,
    transactionPreferences,
    documents,
    internalNotes,
    draftPayload,
    lastActiveSection,
    sectionsCompleted,
  };
}

/**
 * Updates Section 1: Promoter Profile
 */
export async function updateSellerProfile(
  user: AuthenticatedUser,
  data: {
    designation: string;
    mobile: string;
    email: string;
    preferredCommMethod: "IN_APP" | "EMAIL" | "PHONE" | "WHATSAPP";
  },
  context?: { ip?: string; userAgent?: string }
): Promise<SellerProfileRecord> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  return await transaction(async (tx) => {
    // 1. Update seller_profiles
    const res = await tx.query<any>(
      `UPDATE seller_profiles 
       SET designation = $1, mobile = $2, email = $3, preferred_comm_method = $4, updated_at = NOW() 
       WHERE id = $5 
       RETURNING *`,
      [data.designation, data.mobile, data.email, data.preferredCommMethod, profile.id]
    );

    // 2. Mark 'promoter' section completed
    await markSectionComplete(tx, profile.id, "promoter");

    await auditLog({
      actorId: user.id,
      action: "SELLER_PROFILE_UPDATED",
      resourceType: "seller_profiles",
      resourceId: profile.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    return mapSellerProfile(res.rows[0]);
  });
}

/**
 * Updates Sections 2 & 3: Business Identity & Overview
 */
export async function updateBusinessProfile(
  user: AuthenticatedUser,
  data: any,
  context?: { ip?: string; userAgent?: string }
): Promise<BusinessProfileRecord> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  // Check unique constraints for CIN, GSTIN, PAN if provided across other businesses
  if (data.cin) {
    const existingCin = await query(
      `SELECT id FROM business_profiles WHERE cin = $1 AND seller_profile_id != $2`,
      [data.cin, profile.id]
    );
    if (existingCin.rows.length > 0) {
      throw new ConflictError("A business with this CIN is already registered on Scale-up India.");
    }
  }

  return await transaction(async (tx) => {
    // Upsert business_profiles
    const res = await tx.query<any>(
      `INSERT INTO business_profiles (
        seller_profile_id, legal_name, trade_name, business_type, cin, gstin, pan,
        industry, sub_sector, year_established, registered_state, registered_city,
        operating_locations, employee_count, business_description, website,
        msme_status, other_registrations
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (seller_profile_id) DO UPDATE SET
        legal_name = EXCLUDED.legal_name,
        trade_name = EXCLUDED.trade_name,
        business_type = EXCLUDED.business_type,
        cin = EXCLUDED.cin,
        gstin = EXCLUDED.gstin,
        pan = EXCLUDED.pan,
        industry = EXCLUDED.industry,
        sub_sector = EXCLUDED.sub_sector,
        year_established = EXCLUDED.year_established,
        registered_state = EXCLUDED.registered_state,
        registered_city = EXCLUDED.registered_city,
        operating_locations = EXCLUDED.operating_locations,
        employee_count = EXCLUDED.employee_count,
        business_description = EXCLUDED.business_description,
        website = EXCLUDED.website,
        msme_status = EXCLUDED.msme_status,
        other_registrations = EXCLUDED.other_registrations,
        updated_at = NOW()
      RETURNING *`,
      [
        profile.id,
        data.legalName,
        data.tradeName || null,
        data.businessType,
        data.cin || null,
        data.gstin || null,
        data.pan || null,
        data.industry,
        data.subSector || null,
        data.yearEstablished,
        data.registeredState,
        data.registeredCity,
        JSON.stringify(data.operatingLocations || []),
        data.employeeCount,
        data.businessDescription,
        data.website || null,
        data.msmeStatus || "NONE",
        JSON.stringify(data.otherRegistrations || []),
      ]
    );

    // Mark 'identity' and 'overview' complete
    await markSectionComplete(tx, profile.id, "identity");
    await markSectionComplete(tx, profile.id, "overview");

    await auditLog({
      actorId: user.id,
      action: "BUSINESS_PROFILE_UPDATED",
      resourceType: "business_profiles",
      resourceId: res.rows[0].id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { legalName: data.legalName, industry: data.industry },
    });

    return mapBusinessProfile(res.rows[0]);
  });
}

/**
 * Updates Section 4: Multi-Year Financial Records
 */
export async function saveBusinessFinancials(
  user: AuthenticatedUser,
  financials: any[],
  context?: { ip?: string; userAgent?: string }
): Promise<BusinessFinancialRecord[]> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  return await transaction(async (tx) => {
    // Delete existing financial years not present in new payload
    const incomingYears = financials.map((f) => f.financialYear);
    await tx.query(
      `DELETE FROM business_financial_profiles 
       WHERE seller_profile_id = $1 AND NOT (financial_year = ANY($2::varchar[]))`,
      [profile.id, incomingYears]
    );

    const saved: BusinessFinancialRecord[] = [];

    for (const f of financials) {
      const res = await tx.query<any>(
        `INSERT INTO business_financial_profiles (
          seller_profile_id, financial_year, revenue, ebitda, pat, net_worth,
          debt, assets, liabilities, cash_flow, is_audited
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (seller_profile_id, financial_year) DO UPDATE SET
          revenue = EXCLUDED.revenue,
          ebitda = EXCLUDED.ebitda,
          pat = EXCLUDED.pat,
          net_worth = EXCLUDED.net_worth,
          debt = EXCLUDED.debt,
          assets = EXCLUDED.assets,
          liabilities = EXCLUDED.liabilities,
          cash_flow = EXCLUDED.cash_flow,
          is_audited = EXCLUDED.is_audited,
          updated_at = NOW()
        RETURNING *`,
        [
          profile.id,
          f.financialYear,
          f.revenue,
          f.ebitda,
          f.pat,
          f.netWorth,
          f.debt ?? 0,
          f.assets,
          f.liabilities,
          f.cashFlow ?? null,
          f.isAudited ?? true,
        ]
      );
      saved.push(mapFinancialRecord(res.rows[0]));
    }

    await markSectionComplete(tx, profile.id, "financials");

    await auditLog({
      actorId: user.id,
      action: "FINANCIAL_PROFILE_UPDATED",
      resourceType: "seller_profiles",
      resourceId: profile.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { count: saved.length },
    });

    return saved;
  });
}

/**
 * Updates Section 5: Ownership Cap Table
 */
export async function saveBusinessOwnership(
  user: AuthenticatedUser,
  ownerships: any[],
  context?: { ip?: string; userAgent?: string }
): Promise<BusinessOwnershipRecord[]> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  // Validate total percentage does not exceed 100%
  const totalPercentage = ownerships.reduce(
    (sum, o) => sum + Number(o.ownershipPercentage),
    0
  );
  if (totalPercentage > 100.0001) {
    throw new ValidationError(
      `Total ownership percentage (${totalPercentage}%) cannot exceed 100%.`
    );
  }

  return await transaction(async (tx) => {
    // Clear previous ownerships for clean atomic rewrite
    await tx.query(`DELETE FROM business_ownerships WHERE seller_profile_id = $1`, [
      profile.id,
    ]);

    const saved: BusinessOwnershipRecord[] = [];
    for (const o of ownerships) {
      const res = await tx.query<any>(
        `INSERT INTO business_ownerships (
          seller_profile_id, owner_type, owner_name, ownership_percentage,
          holding_entity, role, control_rights
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [
          profile.id,
          o.ownerType,
          o.ownerName,
          o.ownershipPercentage,
          o.holdingEntity || null,
          o.role || null,
          o.controlRights || null,
        ]
      );
      saved.push(mapOwnershipRecord(res.rows[0]));
    }

    await markSectionComplete(tx, profile.id, "ownership");

    await auditLog({
      actorId: user.id,
      action: "OWNERSHIP_UPDATED",
      resourceType: "seller_profiles",
      resourceId: profile.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { ownersCount: saved.length, totalPercentage },
    });

    return saved;
  });
}

/**
 * Updates Section 6: Transaction Intent & Commercial Preferences
 */
export async function saveTransactionPreferences(
  user: AuthenticatedUser,
  data: any,
  context?: { ip?: string; userAgent?: string }
): Promise<SellerTransactionPreferenceRecord> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  return await transaction(async (tx) => {
    const res = await tx.query<any>(
      `INSERT INTO seller_transaction_preferences (
        seller_profile_id, intents, stake_offered_percentage, expected_valuation,
        expected_transaction_value, min_acceptable_terms, preferred_timeline,
        preferred_buyer_type, strategic_objectives, reason_for_transaction
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (seller_profile_id) DO UPDATE SET
        intents = EXCLUDED.intents,
        stake_offered_percentage = EXCLUDED.stake_offered_percentage,
        expected_valuation = EXCLUDED.expected_valuation,
        expected_transaction_value = EXCLUDED.expected_transaction_value,
        min_acceptable_terms = EXCLUDED.min_acceptable_terms,
        preferred_timeline = EXCLUDED.preferred_timeline,
        preferred_buyer_type = EXCLUDED.preferred_buyer_type,
        strategic_objectives = EXCLUDED.strategic_objectives,
        reason_for_transaction = EXCLUDED.reason_for_transaction,
        updated_at = NOW()
      RETURNING *`,
      [
        profile.id,
        JSON.stringify(data.intents),
        data.stakeOfferedPercentage ?? null,
        data.expectedValuation ?? null,
        data.expectedTransactionValue ?? null,
        data.minAcceptableTerms || null,
        data.preferredTimeline || null,
        JSON.stringify(data.preferredBuyerType || []),
        data.strategicObjectives || null,
        data.reasonForTransaction || null,
      ]
    );

    await markSectionComplete(tx, profile.id, "intent");

    await auditLog({
      actorId: user.id,
      action: "TRANSACTION_PREFERENCE_UPDATED",
      resourceType: "seller_transaction_preferences",
      resourceId: res.rows[0].id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { intents: data.intents },
    });

    return mapTransactionPreference(res.rows[0]);
  });
}

/**
 * Saves uncommitted draft payload server-side
 */
export async function saveDraftProgress(
  user: AuthenticatedUser,
  data: { lastActiveSection: string; draftPayload: Record<string, any> }
): Promise<void> {
  const profile = await getOrCreateSellerProfile(user);
  assertSellerCanEdit(profile);

  await query(
    `UPDATE onboarding_progress 
     SET last_active_section = $1, draft_payload = $2, updated_at = NOW() 
     WHERE seller_profile_id = $3`,
    [data.lastActiveSection, JSON.stringify(data.draftPayload), profile.id]
  );
}

/**
 * Submits the complete seller dossier for internal administrative verification
 */
export async function submitSellerForVerification(
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<SellerProfileRecord> {
  // Ensure profile exists
  await getOrCreateSellerProfile(user);
  const dossier = await getSellerDossier(user.id, user);
  const profile = dossier.profile;

  // Enforce state machine invariants: only permitted states can submit
  const submittableStates: OnboardingStatus[] = [
    "DRAFT",
    "PROFILE_INCOMPLETE",
    "READY_FOR_REVIEW",
    "CHANGES_REQUESTED",
  ];
  if (!submittableStates.includes(profile.onboardingStatus)) {
    throw new ValidationError(
      `Cannot submit profile in current status: [${profile.onboardingStatus}].`
    );
  }

  // Completeness check before submission
  if (!dossier.business) {
    throw new ValidationError("Business Profile must be completed before submission.");
  }
  if (dossier.financials.length === 0) {
    throw new ValidationError("At least one financial year record is required before submission.");
  }
  if (dossier.ownership.length === 0) {
    throw new ValidationError("Ownership and cap table details are required before submission.");
  }
  if (!dossier.transactionPreferences) {
    throw new ValidationError("Transaction preferences must be completed before submission.");
  }

  return await transaction(async (tx) => {
    const res = await tx.query<any>(
      `UPDATE seller_profiles 
       SET onboarding_status = 'SUBMITTED', submitted_at = NOW(), completion_percentage = 100, updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [profile.id]
    );

    await auditLog({
      actorId: user.id,
      action: "SELLER_SUBMITTED",
      resourceType: "seller_profiles",
      resourceId: profile.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        legalName: dossier.business?.legalName,
        financialYears: dossier.financials.map((f) => f.financialYear),
      },
    });

    return mapSellerProfile(res.rows[0]);
  });
}

/**
 * Admin: Lists submitted seller dossiers with pagination and search
 */
export async function listSellersForAdmin(
  adminUser: AuthenticatedUser,
  filters: { status?: string; search?: string; page?: number; limit?: number }
): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 15));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["sp.deleted_at IS NULL"];
  const params: any[] = [];
  let pIdx = 1;

  if (filters.status) {
    conditions.push(`sp.onboarding_status = $${pIdx++}`);
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push(
      `(bp.legal_name ILIKE $${pIdx} OR bp.industry ILIKE $${pIdx} OR sp.email ILIKE $${pIdx} OR u.first_name ILIKE $${pIdx} OR u.last_name ILIKE $${pIdx})`
    );
    params.push(`%${filters.search}%`);
    pIdx++;
  }

  const whereClause = conditions.join(" AND ");

  const countRes = await query<{ count: string }>(
    `SELECT count(*) as count 
     FROM seller_profiles sp
     LEFT JOIN business_profiles bp ON sp.id = bp.seller_profile_id
     JOIN users u ON sp.user_id = u.id
     WHERE ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  const listRes = await query<any>(
    `SELECT sp.*, bp.legal_name, bp.industry, bp.registered_state, bp.employee_count,
            u.first_name, u.last_name, u.email as user_email
     FROM seller_profiles sp
     LEFT JOIN business_profiles bp ON sp.id = bp.seller_profile_id
     JOIN users u ON sp.user_id = u.id
     WHERE ${whereClause}
     ORDER BY sp.updated_at DESC
     LIMIT $${pIdx++} OFFSET $${pIdx++}`,
    [...params, limit, offset]
  );

  return {
    items: listRes.rows.map((r) => ({
      ...mapSellerProfile(r),
      businessName: r.legal_name || "Untitled Business",
      industry: r.industry || "Unspecified",
      state: r.registered_state || "Unspecified",
      promoterName: `${r.first_name} ${r.last_name}`,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Admin: Enforces finite state machine transitions for review, change requests, verification, and rejection
 */
export async function executeAdminReviewAction(
  sellerId: string,
  action: "START_REVIEW" | "REQUEST_CHANGES" | "VERIFY" | "REJECT",
  payload: { notes?: string; rejectionReason?: string; changesRequestedNotes?: string },
  adminUser: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<SellerProfileRecord> {
  const res = await query<any>(
    `SELECT * FROM seller_profiles WHERE id = $1 AND deleted_at IS NULL`,
    [sellerId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Seller dossier not found.");
  }

  const profile = mapSellerProfile(res.rows[0]);
  const currentStatus = profile.onboardingStatus;

  let newStatus: OnboardingStatus;
  let auditAction: string;

  return await transaction(async (tx) => {
    switch (action) {
      case "START_REVIEW":
        if (currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot start review on profile in [${currentStatus}] status. Status must be SUBMITTED.`
          );
        }
        newStatus = "UNDER_REVIEW";
        auditAction = "REVIEW_STARTED";
        await tx.query(
          `UPDATE seller_profiles 
           SET onboarding_status = $1, assigned_reviewer_id = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, adminUser.id, sellerId]
        );
        break;

      case "REQUEST_CHANGES":
        if (currentStatus !== "SUBMITTED" && currentStatus !== "UNDER_REVIEW") {
          throw new ValidationError(
            `Cannot request changes on profile in [${currentStatus}] status.`
          );
        }
        if (!payload.changesRequestedNotes) {
          throw new ValidationError("Must specify requested changes for the promoter.");
        }
        newStatus = "CHANGES_REQUESTED";
        auditAction = "CHANGES_REQUESTED";
        await tx.query(
          `UPDATE seller_profiles 
           SET onboarding_status = $1, changes_requested_notes = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, payload.changesRequestedNotes, sellerId]
        );
        break;

      case "VERIFY":
        // Security check: Must possess 'sellers.verify' or 'profiles.verify' permission
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("sellers.verify") &&
          !adminUser.permissions.includes("profiles.verify")
        ) {
          throw new ForbiddenError("Insufficient permission to verify seller dossiers.");
        }
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot verify dossier in [${currentStatus}] status. Must be under active review.`
          );
        }
        newStatus = "VERIFIED";
        auditAction = "SELLER_VERIFIED";
        await tx.query(
          `UPDATE seller_profiles 
           SET onboarding_status = $1, verified_at = NOW(), verified_by = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, adminUser.id, sellerId]
        );
        break;

      case "REJECT":
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot reject dossier in [${currentStatus}] status.`
          );
        }
        if (!payload.rejectionReason) {
          throw new ValidationError("Rejection reason is mandatory.");
        }
        newStatus = "REJECTED";
        auditAction = "SELLER_REJECTED";
        await tx.query(
          `UPDATE seller_profiles 
           SET onboarding_status = $1, rejection_reason = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, payload.rejectionReason, sellerId]
        );
        break;

      default:
        throw new ValidationError(`Unknown review action [${action}].`);
    }

    // Add internal note if provided
    if (payload.notes) {
      await tx.query(
        `INSERT INTO seller_internal_notes (seller_profile_id, author_id, content, category)
         VALUES ($1, $2, $3, 'COMPLIANCE')`,
        [sellerId, adminUser.id, payload.notes]
      );
    }

    await auditLog({
      actorId: adminUser.id,
      action: auditAction,
      resourceType: "seller_profiles",
      resourceId: sellerId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { fromStatus: currentStatus, toStatus: newStatus },
    });

    const updated = await tx.query<any>(
      `SELECT * FROM seller_profiles WHERE id = $1`,
      [sellerId]
    );
    return mapSellerProfile(updated.rows[0]);
  });
}

/**
 * Admin: Adds internal notes to seller profile (never exposed to sellers)
 */
export async function addSellerInternalNote(
  sellerId: string,
  data: { content: string; category?: "GENERAL" | "COMPLIANCE" | "FINANCIAL" | "VALUATION" | "RISK" },
  adminUser: AuthenticatedUser
): Promise<SellerInternalNoteRecord> {
  const res = await query<any>(
    `INSERT INTO seller_internal_notes (seller_profile_id, author_id, content, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [sellerId, adminUser.id, data.content, data.category || "GENERAL"]
  );

  return {
    id: res.rows[0].id,
    sellerProfileId: res.rows[0].seller_profile_id,
    authorId: res.rows[0].author_id,
    authorName: `${adminUser.firstName} ${adminUser.lastName}`,
    content: res.rows[0].content,
    category: res.rows[0].category,
    createdAt: new Date(res.rows[0].created_at),
  };
}

// ----------------------------------------------------------------------------
// Internal Helper Functions
// ----------------------------------------------------------------------------

function assertSellerCanEdit(profile: SellerProfileRecord): void {
  const editableStatuses: OnboardingStatus[] = [
    "NOT_STARTED",
    "DRAFT",
    "PROFILE_INCOMPLETE",
    "READY_FOR_REVIEW",
    "CHANGES_REQUESTED",
  ];
  if (!editableStatuses.includes(profile.onboardingStatus)) {
    throw new ForbiddenError(
      `Profile cannot be modified while in [${profile.onboardingStatus}] status.`
    );
  }
}

async function markSectionComplete(tx: any, profileId: string, sectionKey: string): Promise<void> {
  const progRes = await tx.query(
    `SELECT sections_completed FROM onboarding_progress WHERE seller_profile_id = $1`,
    [profileId]
  );

  let sections: string[] = [];
  if (progRes.rows.length > 0) {
    sections = progRes.rows[0].sections_completed || [];
  }

  if (!sections.includes(sectionKey)) {
    sections.push(sectionKey);
    const completion = calculateCompletion(sections);

    await tx.query(
      `UPDATE onboarding_progress SET sections_completed = $1, updated_at = NOW() WHERE seller_profile_id = $2`,
      [JSON.stringify(sections), profileId]
    );

    await tx.query(
      `UPDATE seller_profiles SET completion_percentage = $1, updated_at = NOW() WHERE id = $2`,
      [completion, profileId]
    );
  }
}

function mapSellerProfile(r: any): SellerProfileRecord {
  return {
    id: r.id,
    userId: r.user_id,
    designation: r.designation,
    mobile: r.mobile,
    email: r.email,
    preferredCommMethod: r.preferred_comm_method,
    onboardingStatus: r.onboarding_status,
    currentStep: r.current_step,
    completionPercentage: r.completion_percentage,
    rejectionReason: r.rejection_reason,
    changesRequestedNotes: r.changes_requested_notes,
    assignedReviewerId: r.assigned_reviewer_id,
    submittedAt: r.submitted_at ? new Date(r.submitted_at) : null,
    verifiedAt: r.verified_at ? new Date(r.verified_at) : null,
    verifiedBy: r.verified_by,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function mapBusinessProfile(r: any): BusinessProfileRecord {
  return {
    id: r.id,
    sellerProfileId: r.seller_profile_id,
    legalName: r.legal_name,
    tradeName: r.trade_name,
    businessType: r.business_type,
    cin: r.cin,
    gstin: r.gstin,
    pan: r.pan,
    industry: r.industry,
    subSector: r.sub_sector,
    yearEstablished: r.year_established,
    registeredState: r.registered_state,
    registeredCity: r.registered_city,
    operatingLocations: r.operating_locations || [],
    employeeCount: r.employee_count,
    businessDescription: r.business_description,
    website: r.website,
    msmeStatus: r.msme_status,
    otherRegistrations: r.other_registrations || [],
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function mapFinancialRecord(r: any): BusinessFinancialRecord {
  return {
    id: r.id,
    sellerProfileId: r.seller_profile_id,
    financialYear: r.financial_year,
    revenue: Number(r.revenue),
    ebitda: Number(r.ebitda),
    pat: Number(r.pat),
    netWorth: Number(r.net_worth),
    debt: Number(r.debt),
    assets: Number(r.assets),
    liabilities: Number(r.liabilities),
    cashFlow: r.cash_flow !== null ? Number(r.cash_flow) : null,
    isAudited: r.is_audited,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function mapOwnershipRecord(r: any): BusinessOwnershipRecord {
  return {
    id: r.id,
    sellerProfileId: r.seller_profile_id,
    ownerType: r.owner_type,
    ownerName: r.owner_name,
    ownershipPercentage: Number(r.ownership_percentage),
    holdingEntity: r.holding_entity,
    role: r.role,
    controlRights: r.control_rights,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function mapTransactionPreference(r: any): SellerTransactionPreferenceRecord {
  return {
    id: r.id,
    sellerProfileId: r.seller_profile_id,
    intents: r.intents || [],
    stakeOfferedPercentage:
      r.stake_offered_percentage !== null ? Number(r.stake_offered_percentage) : null,
    expectedValuation:
      r.expected_valuation !== null ? Number(r.expected_valuation) : null,
    expectedTransactionValue:
      r.expected_transaction_value !== null ? Number(r.expected_transaction_value) : null,
    minAcceptableTerms: r.min_acceptable_terms,
    preferredTimeline: r.preferred_timeline,
    preferredBuyerType: r.preferred_buyer_type || [],
    strategicObjectives: r.strategic_objectives,
    reasonForTransaction: r.reason_for_transaction,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}

function mapDocumentRecord(r: any): SellerDocumentRecord {
  return {
    id: r.id,
    sellerProfileId: r.seller_profile_id,
    ownerId: r.owner_id,
    documentType: r.document_type,
    originalFilename: r.original_filename,
    storageKey: r.storage_key,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    checksumSha256: r.checksum_sha256,
    verificationStatus: r.verification_status,
    rejectionReason: r.rejection_reason,
    reviewedBy: r.reviewed_by,
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at) : null,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
  };
}
