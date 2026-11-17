import { query, transaction } from "@/lib/db";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";
import {
  BuyerProfileRecord,
  AcquisitionMandateRecord,
  MandateTargetIndustryRecord,
  MandateTargetGeographyRecord,
  BuyerDocumentRecord,
  BuyerInternalNoteRecord,
  BuyerDossier,
  BuyerOnboardingStatus,
  MandateStatus,
} from "@/types/buyer";
import { auditLog } from "@/domains/audit/logger";

function mapBuyerProfile(row: any): BuyerProfileRecord {
  return {
    id: row.id,
    userId: row.user_id,
    buyerType: row.buyer_type,
    legalName: row.legal_name,
    tradeName: row.trade_name,
    entityType: row.entity_type,
    registrationNumber: row.registration_number,
    country: row.country || "India",
    state: row.state,
    city: row.city,
    website: row.website,
    yearEstablished: row.year_established ? Number(row.year_established) : null,
    industry: row.industry,
    description: row.description,
    fundSize: row.fund_size ? Number(row.fund_size) : null,
    aum: row.aum ? Number(row.aum) : null,
    currentVintage: row.current_vintage ? Number(row.current_vintage) : null,
    typicalTicketSize: row.typical_ticket_size ? Number(row.typical_ticket_size) : null,
    contactName: row.contact_name,
    designation: row.designation,
    email: row.email,
    phone: row.phone,
    preferredCommMethod: row.preferred_comm_method || "IN_APP",
    onboardingStatus: row.onboarding_status,
    completionPercentage: Number(row.completion_percentage || 0),
    rejectionReason: row.rejection_reason,
    changesRequestedNotes: row.changes_requested_notes,
    suspensionReason: row.suspension_reason,
    assignedReviewerId: row.assigned_reviewer_id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    verifiedBy: row.verified_by,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
    suspendedBy: row.suspended_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapAcquisitionMandate(
  row: any,
  industries: MandateTargetIndustryRecord[] = [],
  geographies: MandateTargetGeographyRecord[] = []
): AcquisitionMandateRecord {
  return {
    id: row.id,
    buyerProfileId: row.buyer_profile_id,
    name: row.name,
    description: row.description,
    status: row.status,
    minInvestment: Number(row.min_investment),
    maxInvestment: Number(row.max_investment),
    preferredTicketSize: row.preferred_ticket_size ? Number(row.preferred_ticket_size) : null,
    availableCapital: row.available_capital ? Number(row.available_capital) : null,
    financingRequirement: row.financing_requirement,
    debtEquityPreference: row.debt_equity_preference,
    revenueMin: Number(row.revenue_min || 0),
    revenueMax: row.revenue_max ? Number(row.revenue_max) : null,
    ebitdaMin: row.ebitda_min ? Number(row.ebitda_min) : null,
    ebitdaMax: row.ebitda_max ? Number(row.ebitda_max) : null,
    employeeMin: Number(row.employee_min || 0),
    employeeMax: row.employee_max ? Number(row.employee_max) : null,
    businessAgeMin: Number(row.business_age_min || 0),
    businessAgeMax: row.business_age_max ? Number(row.business_age_max) : null,
    netWorthMin: row.net_worth_min ? Number(row.net_worth_min) : null,
    netWorthMax: row.net_worth_max ? Number(row.net_worth_max) : null,
    transactionTypes: typeof row.transaction_types === "string" ? JSON.parse(row.transaction_types) : (row.transaction_types || []),
    controlPreference: row.control_preference || "MAJORITY_CONTROL",
    strategicObjectives: typeof row.strategic_objectives === "string" ? JSON.parse(row.strategic_objectives) : (row.strategic_objectives || []),
    otherStrategicObjective: row.other_strategic_objective,
    preferredBusinessAge: row.preferred_business_age,
    promoterInvolvement: row.promoter_involvement,
    promoterExitPreference: row.promoter_exit_preference,
    existingManagementRetention: row.existing_management_retention,
    turnaroundOpportunities: Boolean(row.turnaround_opportunities),
    profitableBusinessesOnly: Boolean(row.profitable_businesses_only),
    growthStage: Boolean(row.growth_stage),
    distressedOpportunities: Boolean(row.distressed_opportunities),
    assetPreference: row.asset_preference || "FLEXIBLE",
    investmentHorizon: row.investment_horizon || "MEDIUM_TERM",
    expectedHoldingPeriodYears: row.expected_holding_period_years ? Number(row.expected_holding_period_years) : null,
    fundingSource: row.funding_source || "OWN_CAPITAL",
    targetIndustries: industries,
    targetGeographies: geographies,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapBuyerDocument(row: any): BuyerDocumentRecord {
  return {
    id: row.id,
    buyerProfileId: row.buyer_profile_id,
    ownerId: row.owner_id,
    mandateId: row.mandate_id,
    documentType: row.document_type,
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    checksumSha256: row.checksum_sha256,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapBuyerInternalNote(row: any): BuyerInternalNoteRecord {
  return {
    id: row.id,
    buyerProfileId: row.buyer_profile_id,
    authorId: row.author_id,
    authorName: row.first_name ? `${row.first_name} ${row.last_name}` : undefined,
    content: row.content,
    category: row.category,
    createdAt: new Date(row.created_at),
  };
}

function assertBuyerCanEdit(profile: BuyerProfileRecord): void {
  const editableStates: BuyerOnboardingStatus[] = [
    "NOT_STARTED",
    "DRAFT",
    "PROFILE_INCOMPLETE",
    "MANDATE_INCOMPLETE",
    "READY_FOR_REVIEW",
    "CHANGES_REQUESTED",
  ];
  if (!editableStates.includes(profile.onboardingStatus)) {
    throw new ForbiddenError(
      `Buyer dossier is locked in [${profile.onboardingStatus}] status and cannot be modified.`
    );
  }
}

/**
 * Retrieves or lazily creates a BuyerProfileRecord for an authenticated user
 */
export async function getOrCreateBuyerProfile(user: AuthenticatedUser): Promise<BuyerProfileRecord> {
  const existing = await query<any>(
    `SELECT * FROM buyer_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [user.id]
  );

  if (existing.rows.length > 0) {
    return mapBuyerProfile(existing.rows[0]);
  }

  // Create default draft profile
  return await transaction(async (tx) => {
    const res = await tx.query<any>(
      `INSERT INTO buyer_profiles (
        user_id, buyer_type, legal_name, entity_type, state, city,
        contact_name, designation, email, phone, onboarding_status
      ) VALUES ($1, 'CORPORATE_BUYER', 'Pending Organization Details', 'COMPANY', 'Not Specified', 'Not Specified',
        $2, 'Director / Investment Officer', $3, $4, 'DRAFT')
      RETURNING *`,
      [user.id, `${user.firstName} ${user.lastName}`.trim(), user.email, user.phone || "+91 9999999999"]
    );

    const profile = mapBuyerProfile(res.rows[0]);

    // Initialize onboarding progress tracking
    await tx.query(
      `INSERT INTO buyer_onboarding_progress (buyer_profile_id, sections_completed, last_active_step, draft_payload)
       VALUES ($1, '[]'::jsonb, 1, '{}'::jsonb)
       ON CONFLICT DO NOTHING`,
      [profile.id]
    );

    await auditLog({
      actorId: user.id,
      action: "BUYER_ONBOARDING_STARTED",
      resourceType: "buyer_profiles",
      resourceId: profile.id,
    });

    return profile;
  });
}

/**
 * Updates Buyer Organization & Contact Profile
 */
export async function updateBuyerProfile(
  user: AuthenticatedUser,
  data: any,
  context?: { ip?: string; userAgent?: string }
): Promise<BuyerProfileRecord> {
  const profile = await getOrCreateBuyerProfile(user);
  assertBuyerCanEdit(profile);

  const res = await query<any>(
    `UPDATE buyer_profiles SET
      buyer_type = $1,
      legal_name = $2,
      trade_name = $3,
      entity_type = $4,
      registration_number = $5,
      country = $6,
      state = $7,
      city = $8,
      website = $9,
      year_established = $10,
      industry = $11,
      description = $12,
      fund_size = $13,
      aum = $14,
      current_vintage = $15,
      typical_ticket_size = $16,
      contact_name = $17,
      designation = $18,
      email = $19,
      phone = $20,
      preferred_comm_method = $21,
      completion_percentage = GREATEST(completion_percentage, 50),
      onboarding_status = CASE 
        WHEN onboarding_status = 'NOT_STARTED' THEN 'DRAFT'
        ELSE onboarding_status
      END,
      updated_at = NOW()
    WHERE id = $22
    RETURNING *`,
    [
      data.buyerType,
      data.legalName,
      data.tradeName || null,
      data.entityType,
      data.registrationNumber || null,
      data.country || "India",
      data.state,
      data.city,
      data.website || null,
      data.yearEstablished || null,
      data.industry || null,
      data.description || null,
      data.fundSize || null,
      data.aum || null,
      data.currentVintage || null,
      data.typicalTicketSize || null,
      data.contactName,
      data.designation,
      data.email,
      data.phone,
      data.preferredCommMethod || "IN_APP",
      profile.id,
    ]
  );

  await auditLog({
    actorId: user.id,
    action: "BUYER_PROFILE_UPDATED",
    resourceType: "buyer_profiles",
    resourceId: profile.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return mapBuyerProfile(res.rows[0]);
}

/**
 * Retrieves the complete buyer dossier (Profile, Mandates, Documents, Notes)
 */
export async function getBuyerDossier(
  targetUserId: string,
  requestingUser: AuthenticatedUser
): Promise<BuyerDossier> {
  // Anti-IDOR Authorization Guard
  const isOwner = targetUserId === requestingUser.id;
  const isAuthorizedAdmin =
    requestingUser.roles.includes("SUPER_ADMIN") ||
    requestingUser.roles.includes("ADMIN") ||
    requestingUser.permissions.includes("buyers.read");

  if (!isOwner && !isAuthorizedAdmin) {
    throw new ForbiddenError("You are not authorized to access this buyer dossier.");
  }

  // 1. Get profile
  const profileRes = await query<any>(
    `SELECT * FROM buyer_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [targetUserId]
  );

  if (profileRes.rows.length === 0) {
    throw new NotFoundError("Buyer profile not found.");
  }

  const profile = mapBuyerProfile(profileRes.rows[0]);

  // 2. Get mandates
  const mandatesRes = await query<any>(
    `SELECT * FROM acquisition_mandates WHERE buyer_profile_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [profile.id]
  );

  const mandates: AcquisitionMandateRecord[] = [];
  for (const mRow of mandatesRes.rows) {
    const indRes = await query<any>(
      `SELECT * FROM mandate_target_industries WHERE mandate_id = $1 ORDER BY industry ASC`,
      [mRow.id]
    );
    const geoRes = await query<any>(
      `SELECT * FROM mandate_target_geographies WHERE mandate_id = $1`,
      [mRow.id]
    );

    const industries: MandateTargetIndustryRecord[] = indRes.rows.map((r) => ({
      id: r.id,
      mandateId: r.mandate_id,
      industry: r.industry,
      subSectors: typeof r.sub_sectors === "string" ? JSON.parse(r.sub_sectors) : (r.sub_sectors || []),
      otherSubSector: r.other_sub_sector,
      createdAt: new Date(r.created_at),
    }));

    const geographies: MandateTargetGeographyRecord[] = geoRes.rows.map((r) => ({
      id: r.id,
      mandateId: r.mandate_id,
      region: r.region,
      countries: typeof r.countries === "string" ? JSON.parse(r.countries) : (r.countries || []),
      states: typeof r.states === "string" ? JSON.parse(r.states) : (r.states || []),
      cities: typeof r.cities === "string" ? JSON.parse(r.cities) : (r.cities || []),
      createdAt: new Date(r.created_at),
    }));

    mandates.push(mapAcquisitionMandate(mRow, industries, geographies));
  }

  // 3. Get documents
  const docsRes = await query<any>(
    `SELECT * FROM buyer_documents WHERE buyer_profile_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [profile.id]
  );
  const documents = docsRes.rows.map(mapBuyerDocument);

  // 4. Get internal notes (Strictly filtered: Admin only)
  let internalNotes: BuyerInternalNoteRecord[] | undefined = undefined;
  if (
    requestingUser.roles.includes("SUPER_ADMIN") ||
    requestingUser.roles.includes("ADMIN") ||
    requestingUser.permissions.includes("buyers.review")
  ) {
    const notesRes = await query<any>(
      `SELECT bin.*, u.first_name, u.last_name 
       FROM buyer_internal_notes bin
       JOIN users u ON bin.author_id = u.id
       WHERE bin.buyer_profile_id = $1 
       ORDER BY bin.created_at DESC`,
      [profile.id]
    );
    internalNotes = notesRes.rows.map(mapBuyerInternalNote);
  }

  // 5. Get onboarding progress draft
  const progRes = await query<any>(
    `SELECT * FROM buyer_onboarding_progress WHERE buyer_profile_id = $1`,
    [profile.id]
  );
  const progress = progRes.rows[0];

  return {
    profile,
    mandates,
    documents,
    internalNotes,
    draftPayload: progress?.draft_payload || {},
    lastActiveStep: progress?.last_active_step || 1,
    sectionsCompleted: progress?.sections_completed || [],
  };
}

/**
 * Creates a new Acquisition Mandate for a buyer
 */
export async function createAcquisitionMandate(
  user: AuthenticatedUser,
  data: any,
  context?: { ip?: string; userAgent?: string }
): Promise<AcquisitionMandateRecord> {
  const profile = await getOrCreateBuyerProfile(user);
  if (profile.onboardingStatus === "SUSPENDED") {
    throw new ForbiddenError("Suspended accounts cannot create new acquisition mandates.");
  }

  return await transaction(async (tx) => {
    const mRes = await tx.query<any>(
      `INSERT INTO acquisition_mandates (
        buyer_profile_id, name, description, status,
        min_investment, max_investment, preferred_ticket_size, available_capital,
        financing_requirement, debt_equity_preference,
        revenue_min, revenue_max, ebitda_min, ebitda_max,
        employee_min, employee_max, business_age_min, business_age_max,
        net_worth_min, net_worth_max, transaction_types, control_preference,
        strategic_objectives, other_strategic_objective,
        preferred_business_age, promoter_involvement, promoter_exit_preference, existing_management_retention,
        turnaround_opportunities, profitable_businesses_only, growth_stage, distressed_opportunities,
        asset_preference, investment_horizon, expected_holding_period_years, funding_source
      ) VALUES (
        $1, $2, $3, 'ACTIVE',
        $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23,
        $24, $25, $26, $27,
        $28, $29, $30, $31,
        $32, $33, $34, $35
      ) RETURNING *`,
      [
        profile.id,
        data.name,
        data.description || null,
        data.minInvestment,
        data.maxInvestment,
        data.preferredTicketSize || null,
        data.availableCapital || null,
        data.financingRequirement || null,
        data.debtEquityPreference || null,
        data.revenueMin || 0,
        data.revenueMax || null,
        data.ebitdaMin || null,
        data.ebitdaMax || null,
        data.employeeMin || 0,
        data.employeeMax || null,
        data.businessAgeMin || 0,
        data.businessAgeMax || null,
        data.netWorthMin || null,
        data.netWorthMax || null,
        JSON.stringify(data.transactionTypes || []),
        data.controlPreference || "MAJORITY_CONTROL",
        JSON.stringify(data.strategicObjectives || []),
        data.otherStrategicObjective || null,
        data.preferredBusinessAge || null,
        data.promoterInvolvement || null,
        data.promoterExitPreference || null,
        data.existingManagementRetention || null,
        Boolean(data.turnaroundOpportunities),
        data.profitableBusinessesOnly !== undefined ? Boolean(data.profitableBusinessesOnly) : true,
        data.growthStage !== undefined ? Boolean(data.growthStage) : true,
        Boolean(data.distressedOpportunities),
        data.assetPreference || "FLEXIBLE",
        data.investmentHorizon || "MEDIUM_TERM",
        data.expectedHoldingPeriodYears || null,
        data.fundingSource || "OWN_CAPITAL",
      ]
    );

    const mandateRow = mRes.rows[0];

    // Insert industries
    const industries: MandateTargetIndustryRecord[] = [];
    if (Array.isArray(data.targetIndustries)) {
      for (const ind of data.targetIndustries) {
        const indRes = await tx.query<any>(
          `INSERT INTO mandate_target_industries (mandate_id, industry, sub_sectors, other_sub_sector)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [mandateRow.id, ind.industry, JSON.stringify(ind.subSectors || []), ind.otherSubSector || null]
        );
        industries.push({
          id: indRes.rows[0].id,
          mandateId: indRes.rows[0].mandate_id,
          industry: indRes.rows[0].industry,
          subSectors: ind.subSectors || [],
          otherSubSector: indRes.rows[0].other_sub_sector,
          createdAt: new Date(indRes.rows[0].created_at),
        });
      }
    }

    // Insert geographies
    const geographies: MandateTargetGeographyRecord[] = [];
    if (Array.isArray(data.targetGeographies)) {
      for (const geo of data.targetGeographies) {
        const geoRes = await tx.query<any>(
          `INSERT INTO mandate_target_geographies (mandate_id, region, countries, states, cities)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            mandateRow.id,
            geo.region,
            JSON.stringify(geo.countries || ["India"]),
            JSON.stringify(geo.states || []),
            JSON.stringify(geo.cities || []),
          ]
        );
        geographies.push({
          id: geoRes.rows[0].id,
          mandateId: geoRes.rows[0].mandate_id,
          region: geoRes.rows[0].region,
          countries: geo.countries || ["India"],
          states: geo.states || [],
          cities: geo.cities || [],
          createdAt: new Date(geoRes.rows[0].created_at),
        });
      }
    }

    await auditLog({
      actorId: user.id,
      action: "BUYER_MANDATE_CREATED",
      resourceType: "acquisition_mandates",
      resourceId: mandateRow.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { name: data.name, minInvestment: data.minInvestment, maxInvestment: data.maxInvestment },
    });

    return mapAcquisitionMandate(mandateRow, industries, geographies);
  });
}

/**
 * Updates an existing Acquisition Mandate
 */
export async function updateAcquisitionMandate(
  mandateId: string,
  user: AuthenticatedUser,
  data: any,
  context?: { ip?: string; userAgent?: string }
): Promise<AcquisitionMandateRecord> {
  const profile = await getOrCreateBuyerProfile(user);
  if (profile.onboardingStatus === "SUSPENDED") {
    throw new ForbiddenError("Suspended accounts cannot modify acquisition mandates.");
  }

  // Anti-IDOR: Check mandate ownership
  const checkRes = await query<any>(
    `SELECT * FROM acquisition_mandates WHERE id = $1 AND deleted_at IS NULL`,
    [mandateId]
  );

  if (checkRes.rows.length === 0) {
    throw new NotFoundError("Acquisition mandate not found.");
  }

  if (checkRes.rows[0].buyer_profile_id !== profile.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot modify an acquisition mandate belonging to another buyer.");
  }

  return await transaction(async (tx) => {
    const mRes = await tx.query<any>(
      `UPDATE acquisition_mandates SET
        name = $1,
        description = $2,
        min_investment = $3,
        max_investment = $4,
        preferred_ticket_size = $5,
        available_capital = $6,
        financing_requirement = $7,
        debt_equity_preference = $8,
        revenue_min = $9,
        revenue_max = $10,
        ebitda_min = $11,
        ebitda_max = $12,
        employee_min = $13,
        employee_max = $14,
        business_age_min = $15,
        business_age_max = $16,
        net_worth_min = $17,
        net_worth_max = $18,
        transaction_types = $19,
        control_preference = $20,
        strategic_objectives = $21,
        other_strategic_objective = $22,
        preferred_business_age = $23,
        promoter_involvement = $24,
        promoter_exit_preference = $25,
        existing_management_retention = $26,
        turnaround_opportunities = $27,
        profitable_businesses_only = $28,
        growth_stage = $29,
        distressed_opportunities = $30,
        asset_preference = $31,
        investment_horizon = $32,
        expected_holding_period_years = $33,
        funding_source = $34,
        updated_at = NOW()
      WHERE id = $35
      RETURNING *`,
      [
        data.name,
        data.description || null,
        data.minInvestment,
        data.maxInvestment,
        data.preferredTicketSize || null,
        data.availableCapital || null,
        data.financingRequirement || null,
        data.debtEquityPreference || null,
        data.revenueMin || 0,
        data.revenueMax || null,
        data.ebitdaMin || null,
        data.ebitdaMax || null,
        data.employeeMin || 0,
        data.employeeMax || null,
        data.businessAgeMin || 0,
        data.businessAgeMax || null,
        data.netWorthMin || null,
        data.netWorthMax || null,
        JSON.stringify(data.transactionTypes || []),
        data.controlPreference || "MAJORITY_CONTROL",
        JSON.stringify(data.strategicObjectives || []),
        data.otherStrategicObjective || null,
        data.preferredBusinessAge || null,
        data.promoterInvolvement || null,
        data.promoterExitPreference || null,
        data.existingManagementRetention || null,
        Boolean(data.turnaroundOpportunities),
        data.profitableBusinessesOnly !== undefined ? Boolean(data.profitableBusinessesOnly) : true,
        data.growthStage !== undefined ? Boolean(data.growthStage) : true,
        Boolean(data.distressedOpportunities),
        data.assetPreference || "FLEXIBLE",
        data.investmentHorizon || "MEDIUM_TERM",
        data.expectedHoldingPeriodYears || null,
        data.fundingSource || "OWN_CAPITAL",
        mandateId,
      ]
    );

    const mandateRow = mRes.rows[0];

    // Replace industries
    await tx.query(`DELETE FROM mandate_target_industries WHERE mandate_id = $1`, [mandateId]);
    const industries: MandateTargetIndustryRecord[] = [];
    if (Array.isArray(data.targetIndustries)) {
      for (const ind of data.targetIndustries) {
        const indRes = await tx.query<any>(
          `INSERT INTO mandate_target_industries (mandate_id, industry, sub_sectors, other_sub_sector)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [mandateId, ind.industry, JSON.stringify(ind.subSectors || []), ind.otherSubSector || null]
        );
        industries.push({
          id: indRes.rows[0].id,
          mandateId: indRes.rows[0].mandate_id,
          industry: indRes.rows[0].industry,
          subSectors: ind.subSectors || [],
          otherSubSector: indRes.rows[0].other_sub_sector,
          createdAt: new Date(indRes.rows[0].created_at),
        });
      }
    }

    // Replace geographies
    await tx.query(`DELETE FROM mandate_target_geographies WHERE mandate_id = $1`, [mandateId]);
    const geographies: MandateTargetGeographyRecord[] = [];
    if (Array.isArray(data.targetGeographies)) {
      for (const geo of data.targetGeographies) {
        const geoRes = await tx.query<any>(
          `INSERT INTO mandate_target_geographies (mandate_id, region, countries, states, cities)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [
            mandateId,
            geo.region,
            JSON.stringify(geo.countries || ["India"]),
            JSON.stringify(geo.states || []),
            JSON.stringify(geo.cities || []),
          ]
        );
        geographies.push({
          id: geoRes.rows[0].id,
          mandateId: geoRes.rows[0].mandate_id,
          region: geoRes.rows[0].region,
          countries: geo.countries || ["India"],
          states: geo.states || [],
          cities: geo.cities || [],
          createdAt: new Date(geoRes.rows[0].created_at),
        });
      }
    }

    // Invalidate stale matches for this mandate
    await tx.query(`DELETE FROM buyer_opportunity_matches WHERE mandate_id = $1`, [mandateId]);

    await auditLog({
      actorId: user.id,
      action: "BUYER_MANDATE_UPDATED",
      resourceType: "acquisition_mandates",
      resourceId: mandateId,
      ip: context?.ip,
      userAgent: context?.userAgent,
    });

    return mapAcquisitionMandate(mandateRow, industries, geographies);
  });
}

/**
 * Soft deletes an acquisition mandate (owner only)
 */
export async function deleteAcquisitionMandate(
  mandateId: string,
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<void> {
  const profile = await getOrCreateBuyerProfile(user);

  const checkRes = await query<any>(
    `SELECT * FROM acquisition_mandates WHERE id = $1 AND deleted_at IS NULL`,
    [mandateId]
  );

  if (checkRes.rows.length === 0) {
    throw new NotFoundError("Acquisition mandate not found.");
  }

  if (checkRes.rows[0].buyer_profile_id !== profile.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot delete an acquisition mandate belonging to another buyer.");
  }

  await query(`UPDATE acquisition_mandates SET deleted_at = NOW(), status = 'ARCHIVED' WHERE id = $1`, [
    mandateId,
  ]);

  // Purge matches for archived mandate
  await query(`DELETE FROM buyer_opportunity_matches WHERE mandate_id = $1`, [mandateId]);

  await auditLog({
    actorId: user.id,
    action: "BUYER_MANDATE_ARCHIVED",
    resourceType: "acquisition_mandates",
    resourceId: mandateId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });
}

/**
 * Saves buyer draft progress without validation blockers
 */
export async function saveBuyerDraft(
  user: AuthenticatedUser,
  data: { lastActiveStep: number; draftPayload: any; sectionsCompleted?: string[] }
): Promise<void> {
  const profile = await getOrCreateBuyerProfile(user);

  await query(
    `UPDATE buyer_onboarding_progress 
     SET last_active_step = $1, draft_payload = $2, sections_completed = $3, updated_at = NOW() 
     WHERE buyer_profile_id = $4`,
    [data.lastActiveStep, JSON.stringify(data.draftPayload), JSON.stringify(data.sectionsCompleted || []), profile.id]
  );
}

/**
 * Submits the complete buyer profile and mandates for administrative review
 */
export async function submitBuyerForVerification(
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<BuyerProfileRecord> {
  const profile = await getOrCreateBuyerProfile(user);

  const submittableStates: BuyerOnboardingStatus[] = [
    "DRAFT",
    "PROFILE_INCOMPLETE",
    "MANDATE_INCOMPLETE",
    "READY_FOR_REVIEW",
    "CHANGES_REQUESTED",
  ];

  if (!submittableStates.includes(profile.onboardingStatus)) {
    throw new ValidationError(
      `Cannot submit buyer dossier in current status [${profile.onboardingStatus}].`
    );
  }

  // Completeness check
  if (!profile.legalName || profile.legalName === "Pending Organization Details") {
    throw new ValidationError("Legal organization details must be completed before submission.");
  }
  if (!profile.contactName || !profile.email || !profile.phone) {
    throw new ValidationError("Authorized contact person details are mandatory.");
  }

  // Ensure at least one active mandate
  const mandatesRes = await query<any>(
    `SELECT count(*) as count FROM acquisition_mandates WHERE buyer_profile_id = $1 AND deleted_at IS NULL`,
    [profile.id]
  );
  if (Number(mandatesRes.rows[0].count) === 0) {
    throw new ValidationError("At least one Acquisition Mandate is required before submission.");
  }

  return await transaction(async (tx) => {
    const res = await tx.query<any>(
      `UPDATE buyer_profiles 
       SET onboarding_status = 'SUBMITTED', submitted_at = NOW(), completion_percentage = 100, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [profile.id]
    );

    await auditLog({
      actorId: user.id,
      action: "BUYER_MANDATE_SUBMITTED",
      resourceType: "buyer_profiles",
      resourceId: profile.id,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        legalName: profile.legalName,
        buyerType: profile.buyerType,
      },
    });

    return mapBuyerProfile(res.rows[0]);
  });
}

/**
 * Admin: Lists buyer dossiers with pagination, search, and status filters
 */
export async function listBuyersForAdmin(
  adminUser: AuthenticatedUser,
  filters: { status?: string; search?: string; page?: number; limit?: number }
): Promise<{ items: any[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 15));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["bp.deleted_at IS NULL"];
  const params: any[] = [];
  let pIdx = 1;

  if (filters.status) {
    conditions.push(`bp.onboarding_status = $${pIdx++}`);
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push(
      `(bp.legal_name ILIKE $${pIdx} OR bp.contact_name ILIKE $${pIdx} OR bp.email ILIKE $${pIdx} OR bp.buyer_type ILIKE $${pIdx})`
    );
    params.push(`%${filters.search}%`);
    pIdx++;
  }

  const whereClause = conditions.join(" AND ");

  const countRes = await query<{ count: string }>(
    `SELECT count(*) as count FROM buyer_profiles bp WHERE ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  const listRes = await query<any>(
    `SELECT bp.*, 
            (SELECT count(*) FROM acquisition_mandates am WHERE am.buyer_profile_id = bp.id AND am.deleted_at IS NULL) as mandate_count
     FROM buyer_profiles bp
     WHERE ${whereClause}
     ORDER BY bp.updated_at DESC
     LIMIT $${pIdx++} OFFSET $${pIdx++}`,
    [...params, limit, offset]
  );

  return {
    items: listRes.rows.map((r) => ({
      ...mapBuyerProfile(r),
      mandateCount: Number(r.mandate_count || 0),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Admin: Executes state machine transitions for buyer verification, rejection, suspension, and change requests
 */
export async function executeAdminBuyerReviewAction(
  buyerId: string,
  action: "START_REVIEW" | "REQUEST_CHANGES" | "VERIFY" | "REJECT" | "SUSPEND",
  payload: { notes?: string; rejectionReason?: string; changesRequestedNotes?: string; suspensionReason?: string },
  adminUser: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<BuyerProfileRecord> {
  const res = await query<any>(
    `SELECT * FROM buyer_profiles WHERE id = $1 AND deleted_at IS NULL`,
    [buyerId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Buyer profile not found.");
  }

  const profile = mapBuyerProfile(res.rows[0]);
  const currentStatus = profile.onboardingStatus;

  let newStatus: BuyerOnboardingStatus;
  let auditAction: string;

  return await transaction(async (tx) => {
    switch (action) {
      case "START_REVIEW":
        if (currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot start review on buyer in [${currentStatus}] status. Status must be SUBMITTED.`
          );
        }
        newStatus = "UNDER_REVIEW";
        auditAction = "BUYER_REVIEW_STARTED";
        await tx.query(
          `UPDATE buyer_profiles 
           SET onboarding_status = $1, assigned_reviewer_id = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, adminUser.id, buyerId]
        );
        break;

      case "REQUEST_CHANGES":
        if (currentStatus !== "SUBMITTED" && currentStatus !== "UNDER_REVIEW") {
          throw new ValidationError(
            `Cannot request changes on buyer profile in [${currentStatus}] status.`
          );
        }
        if (!payload.changesRequestedNotes) {
          throw new ValidationError("Must specify requested changes for the buyer.");
        }
        newStatus = "CHANGES_REQUESTED";
        auditAction = "BUYER_CHANGES_REQUESTED";
        await tx.query(
          `UPDATE buyer_profiles 
           SET onboarding_status = $1, changes_requested_notes = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, payload.changesRequestedNotes, buyerId]
        );
        break;

      case "VERIFY":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("buyers.verify")
        ) {
          throw new ForbiddenError("Insufficient permission to verify buyer dossiers.");
        }
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot verify buyer in [${currentStatus}] status. Must be under active review.`
          );
        }
        newStatus = "VERIFIED";
        auditAction = "BUYER_VERIFIED";
        await tx.query(
          `UPDATE buyer_profiles 
           SET onboarding_status = $1, verified_at = NOW(), verified_by = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, adminUser.id, buyerId]
        );
        break;

      case "REJECT":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("buyers.verify")
        ) {
          throw new ForbiddenError("Insufficient permission to reject buyer dossiers.");
        }
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot reject buyer in [${currentStatus}] status.`
          );
        }
        if (!payload.rejectionReason) {
          throw new ValidationError("Rejection reason is mandatory.");
        }
        newStatus = "REJECTED";
        auditAction = "BUYER_REJECTED";
        await tx.query(
          `UPDATE buyer_profiles 
           SET onboarding_status = $1, rejection_reason = $2, updated_at = NOW() 
           WHERE id = $3`,
          [newStatus, payload.rejectionReason, buyerId]
        );
        break;

      case "SUSPEND":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("buyers.suspend")
        ) {
          throw new ForbiddenError("Insufficient permission to suspend buyers.");
        }
        if (!payload.suspensionReason) {
          throw new ValidationError("Suspension reason is mandatory.");
        }
        newStatus = "SUSPENDED";
        auditAction = "BUYER_SUSPENDED";
        await tx.query(
          `UPDATE buyer_profiles 
           SET onboarding_status = $1, suspension_reason = $2, suspended_at = NOW(), suspended_by = $3, updated_at = NOW() 
           WHERE id = $4`,
          [newStatus, payload.suspensionReason, adminUser.id, buyerId]
        );
        // Freeze active mandates
        await tx.query(
          `UPDATE acquisition_mandates SET status = 'PAUSED', updated_at = NOW() WHERE buyer_profile_id = $1`,
          [buyerId]
        );
        break;

      default:
        throw new ValidationError(`Unknown review action [${action}].`);
    }

    // Add internal note if provided
    if (payload.notes) {
      await tx.query(
        `INSERT INTO buyer_internal_notes (buyer_profile_id, author_id, content, category)
         VALUES ($1, $2, $3, 'COMPLIANCE')`,
        [buyerId, adminUser.id, payload.notes]
      );
    }

    await auditLog({
      actorId: adminUser.id,
      action: auditAction,
      resourceType: "buyer_profiles",
      resourceId: buyerId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: {
        previousStatus: currentStatus,
        newStatus,
        action,
      },
    });

    const updatedRes = await tx.query<any>(
      `SELECT * FROM buyer_profiles WHERE id = $1`,
      [buyerId]
    );
    return mapBuyerProfile(updatedRes.rows[0]);
  });
}

/**
 * Adds a confidential internal note to a buyer dossier (staff only)
 */
export async function addBuyerInternalNote(
  buyerId: string,
  data: { content: string; category?: any },
  adminUser: AuthenticatedUser
): Promise<BuyerInternalNoteRecord> {
  const profileRes = await query<any>(
    `SELECT id FROM buyer_profiles WHERE id = $1 AND deleted_at IS NULL`,
    [buyerId]
  );

  if (profileRes.rows.length === 0) {
    throw new NotFoundError("Buyer profile not found.");
  }

  const res = await query<any>(
    `INSERT INTO buyer_internal_notes (buyer_profile_id, author_id, content, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [buyerId, adminUser.id, data.content, data.category || "GENERAL"]
  );

  return mapBuyerInternalNote({
    ...res.rows[0],
    first_name: adminUser.firstName,
    last_name: adminUser.lastName,
  });
}

