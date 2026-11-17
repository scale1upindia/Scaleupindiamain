import { query, transaction } from "@/lib/db";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { AuthenticatedUser } from "@/types/auth";
import {
  OpportunityRecord,
  Tier0Opportunity,
  Tier1Opportunity,
  Tier2Opportunity,
  Tier3Opportunity,
  OpportunityStatus,
  OpportunityDocumentRecord,
  OpportunityDocumentSummary,
  OpportunityInternalNoteRecord,
} from "@/types/opportunity";
import { CreateOpportunityInput, UpdateOpportunityInput, OpportunityDiscoveryQuery, createOpportunitySchema } from "@/schemas/opportunity";
import { auditLog } from "@/domains/audit/logger";
import { MATCHING_ALGORITHM_VERSION } from "@/domains/matching/weights";

export function mapOpportunityRecord(row: any): OpportunityRecord {
  return {
    id: row.id,
    referenceCode: row.reference_code,
    sellerProfileId: row.seller_profile_id,
    userId: row.user_id,
    title: row.title,
    headline: row.headline,
    teaserSummary: row.teaser_summary,
    businessCategory: row.business_category,
    industry: row.industry,
    subSector: row.sub_sector,
    operatingRegion: row.operating_region,
    registeredState: row.registered_state,
    registeredCity: row.registered_city,
    approximateAgeBracket: row.approximate_age_bracket,
    revenueBracket: row.revenue_bracket,
    transactionType: row.transaction_type,

    detailedDescription: row.detailed_description,
    businessModel: row.business_model || "B2B",
    yearEstablished: row.year_established ? Number(row.year_established) : null,
    employeeRange: row.employee_range,
    customerScale: row.customer_scale,
    ebitdaMarginBracket: row.ebitda_margin_bracket,
    askingPriceBracket: row.asking_price_bracket,
    growthRateBracket: row.growth_rate_bracket,
    facilityDetails: row.facility_details,
    stakeOfferedPercentage: row.stake_offered_percentage ? Number(row.stake_offered_percentage) : null,
    promoterRetentionPreference: row.promoter_retention_preference,
    reasonForSale: row.reason_for_sale,
    transactionObjective: row.transaction_objective,

    exactLegalName: row.exact_legal_name,
    exactTradeName: row.exact_trade_name,
    exactCin: row.exact_cin,
    exactGstin: row.exact_gstin,
    exactPan: row.exact_pan,
    exactAddress: row.exact_address,
    exactRevenue: row.exact_revenue ? Number(row.exact_revenue) : null,
    exactEbitda: row.exact_ebitda ? Number(row.exact_ebitda) : null,
    exactAskingPrice: row.exact_asking_price ? Number(row.exact_asking_price) : null,

    status: row.status,
    rejectionReason: row.rejection_reason,
    changesRequestedNotes: row.changes_requested_notes,
    suspensionReason: row.suspension_reason,
    assignedReviewerId: row.assigned_reviewer_id,
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
    verifiedBy: row.verified_by,
    publishedAt: row.published_at ? new Date(row.published_at) : null,
    publishedBy: row.published_by,
    suspendedAt: row.suspended_at ? new Date(row.suspended_at) : null,
    suspendedBy: row.suspended_by,
    viewCount: Number(row.view_count || 0),

    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function mapOpportunityDocument(row: any): OpportunityDocumentRecord {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    sellerProfileId: row.seller_profile_id,
    ownerId: row.owner_id,
    documentType: row.document_type,
    accessTier: Number(row.access_tier),
    originalFilename: row.original_filename,
    storageKey: row.storage_key,
    mimeType: row.mime_type,
    fileSizeBytes: Number(row.file_size_bytes),
    checksumSha256: row.checksum_sha256,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Server-Side Progressive Data Masking (Tier 0 to Tier 3)
 * STRICT SECURITY INVARIANT: Confidential fields are NEVER returned in the payload
 * for unprivileged tiers. Masking occurs server-side before serializing.
 */
export function maskOpportunityForUser(
  record: OpportunityRecord,
  user?: AuthenticatedUser | null,
  options?: {
    isTier2Authorized?: boolean;
    documents?: OpportunityDocumentRecord[];
  }
): Tier0Opportunity | Tier1Opportunity | Tier2Opportunity | Tier3Opportunity {
  const isOwner = Boolean(user && user.id === record.userId);
  const isAuthorizedAdmin = Boolean(
    user &&
      (user.roles.includes("SUPER_ADMIN") ||
        user.roles.includes("ADMIN") ||
        user.permissions.includes("opportunities.read_all"))
  );

  // 1. TIER 3 — Full Confidential Record (Owner or Authorized Admin Only)
  if (isOwner || isAuthorizedAdmin) {
    const docSummaries: OpportunityDocumentSummary[] = (options?.documents || []).map((d) => ({
      id: d.id,
      opportunityId: d.opportunityId,
      documentType: d.documentType,
      accessTier: d.accessTier,
      originalFilename: d.originalFilename,
      mimeType: d.mimeType,
      fileSizeBytes: d.fileSizeBytes,
      verificationStatus: d.verificationStatus,
      createdAt: d.createdAt,
    }));

    return {
      tier: 3,
      id: record.id,
      referenceCode: record.referenceCode,
      title: record.title,
      headline: record.headline,
      teaserSummary: record.teaserSummary,
      businessCategory: record.businessCategory,
      industry: record.industry,
      subSector: record.subSector,
      operatingRegion: record.operatingRegion,
      registeredState: record.registeredState,
      registeredCity: record.registeredCity,
      approximateAgeBracket: record.approximateAgeBracket,
      revenueBracket: record.revenueBracket,
      transactionType: record.transactionType,
      status: record.status,
      publishedAt: record.publishedAt,

      detailedDescription: record.detailedDescription,
      businessModel: record.businessModel,
      yearEstablished: record.yearEstablished,
      employeeRange: record.employeeRange,
      customerScale: record.customerScale,
      ebitdaMarginBracket: record.ebitdaMarginBracket,
      askingPriceBracket: record.askingPriceBracket,
      growthRateBracket: record.growthRateBracket,
      facilityDetails: record.facilityDetails,
      stakeOfferedPercentage: record.stakeOfferedPercentage,
      promoterRetentionPreference: record.promoterRetentionPreference,
      reasonForSale: record.reasonForSale,
      transactionObjective: record.transactionObjective,

      exactLegalName: record.exactLegalName,
      exactTradeName: record.exactTradeName,
      exactCin: record.exactCin,
      exactGstin: record.exactGstin,
      exactPan: record.exactPan,
      exactAddress: record.exactAddress,
      exactRevenue: record.exactRevenue,
      exactEbitda: record.exactEbitda,
      exactAskingPrice: record.exactAskingPrice,

      assignedReviewerId: record.assignedReviewerId,
      rejectionReason: record.rejectionReason,
      changesRequestedNotes: record.changesRequestedNotes,
      suspensionReason: record.suspensionReason,
      verifiedAt: record.verifiedAt,
      verifiedBy: record.verifiedBy,
      suspendedAt: record.suspendedAt,
      suspendedBy: record.suspendedBy,

      documents: docSummaries,
    };
  }

  // 2. TIER 2 — Authorized Buyer (Post-EOI & Mutual Consent)
  if (options?.isTier2Authorized) {
    const allowedDocs: OpportunityDocumentSummary[] = (options?.documents || [])
      .filter((d) => d.accessTier <= 2)
      .map((d) => ({
        id: d.id,
        opportunityId: d.opportunityId,
        documentType: d.documentType,
        accessTier: d.accessTier,
        originalFilename: d.originalFilename,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        verificationStatus: d.verificationStatus,
        createdAt: d.createdAt,
      }));

    return {
      tier: 2,
      id: record.id,
      referenceCode: record.referenceCode,
      title: record.title,
      headline: record.headline,
      teaserSummary: record.teaserSummary,
      businessCategory: record.businessCategory,
      industry: record.industry,
      subSector: record.subSector,
      operatingRegion: record.operatingRegion,
      registeredState: record.registeredState,
      registeredCity: record.registeredCity,
      approximateAgeBracket: record.approximateAgeBracket,
      revenueBracket: record.revenueBracket,
      transactionType: record.transactionType,
      status: record.status,
      publishedAt: record.publishedAt,

      detailedDescription: record.detailedDescription,
      businessModel: record.businessModel,
      yearEstablished: record.yearEstablished,
      employeeRange: record.employeeRange,
      customerScale: record.customerScale,
      ebitdaMarginBracket: record.ebitdaMarginBracket,
      askingPriceBracket: record.askingPriceBracket,
      growthRateBracket: record.growthRateBracket,
      facilityDetails: record.facilityDetails,
      stakeOfferedPercentage: record.stakeOfferedPercentage,
      promoterRetentionPreference: record.promoterRetentionPreference,
      reasonForSale: record.reasonForSale,
      transactionObjective: record.transactionObjective,

      documents: allowedDocs,
    };
  }

  // 3. TIER 1 — Authenticated Buyer
  if (user) {
    return {
      tier: 1,
      id: record.id,
      referenceCode: record.referenceCode,
      title: record.title,
      headline: record.headline,
      teaserSummary: record.teaserSummary,
      businessCategory: record.businessCategory,
      industry: record.industry,
      subSector: record.subSector,
      operatingRegion: record.operatingRegion,
      registeredState: record.registeredState,
      approximateAgeBracket: record.approximateAgeBracket,
      revenueBracket: record.revenueBracket,
      transactionType: record.transactionType,
      status: record.status,
      publishedAt: record.publishedAt,

      detailedDescription: record.detailedDescription,
      businessModel: record.businessModel,
      yearEstablished: record.yearEstablished,
      employeeRange: record.employeeRange,
      customerScale: record.customerScale,
      ebitdaMarginBracket: record.ebitdaMarginBracket,
      askingPriceBracket: record.askingPriceBracket,
      growthRateBracket: record.growthRateBracket,
      facilityDetails: record.facilityDetails,
      stakeOfferedPercentage: record.stakeOfferedPercentage,
      promoterRetentionPreference: record.promoterRetentionPreference,
      reasonForSale: record.reasonForSale,
      transactionObjective: record.transactionObjective,
    };
  }

  // 4. TIER 0 — Public Blind Teaser (Unauthenticated / Anonymous)
  return {
    tier: 0,
    id: record.id,
    referenceCode: record.referenceCode,
    title: record.title,
    headline: record.headline,
    teaserSummary: record.teaserSummary,
    businessCategory: record.businessCategory,
    industry: record.industry,
    subSector: record.subSector,
    operatingRegion: record.operatingRegion,
    registeredState: record.registeredState,
    approximateAgeBracket: record.approximateAgeBracket,
    revenueBracket: record.revenueBracket,
    transactionType: record.transactionType,
    status: record.status,
    publishedAt: record.publishedAt,
  };
}

/**
 * Generates an institutional reference code, e.g., OPP-2026-1001
 */
async function generateReferenceCode(): Promise<string> {
  const res = await query<any>(`SELECT nextval('opportunity_ref_seq') as seq`);
  const seq = res.rows[0].seq;
  const year = new Date().getFullYear();
  return `OPP-${year}-${String(seq).padStart(4, "0")}`;
}

/**
 * Creates a new business opportunity (Seller Only)
 */
export async function createOpportunity(
  user: AuthenticatedUser,
  data: CreateOpportunityInput,
  context?: { ip?: string; userAgent?: string }
): Promise<Tier3Opportunity> {
  const validated = createOpportunitySchema.parse(data);

  // 1. Verify seller profile exists (or resolve lazy profile)
  const sellerRes = await query<any>(
    `SELECT id, onboarding_status FROM seller_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
    [user.id]
  );

  let sellerProfileId: string;
  if (sellerRes.rows.length === 0) {
    // Lazily create seller profile container
    const ins = await query<any>(
      `INSERT INTO seller_profiles (user_id, designation, mobile, email, onboarding_status)
       VALUES ($1, 'Promoter / Director', $2, $3, 'DRAFT')
       RETURNING id, onboarding_status`,
      [user.id, user.phone || "+91 9999999999", user.email]
    );
    sellerProfileId = ins.rows[0].id;
  } else {
    sellerProfileId = sellerRes.rows[0].id;
    if (sellerRes.rows[0].onboarding_status === "SUSPENDED") {
      throw new ForbiddenError("Suspended accounts cannot create new business opportunities.");
    }
  }

  const referenceCode = await generateReferenceCode();

  const res = await query<any>(
    `INSERT INTO opportunities (
      reference_code, seller_profile_id, user_id,
      title, headline, teaser_summary, business_category, industry, sub_sector,
      operating_region, registered_state, registered_city, approximate_age_bracket,
      revenue_bracket, transaction_type, detailed_description, business_model,
      year_established, employee_range, customer_scale, ebitda_margin_bracket,
      asking_price_bracket, growth_rate_bracket, facility_details,
      stake_offered_percentage, promoter_retention_preference, reason_for_sale, transaction_objective,
      exact_legal_name, exact_trade_name, exact_cin, exact_gstin, exact_pan, exact_address,
      exact_revenue, exact_ebitda, exact_asking_price, status
    ) VALUES (
      $1, $2, $3,
      $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17,
      $18, $19, $20, $21,
      $22, $23, $24,
      $25, $26, $27, $28,
      $29, $30, $31, $32, $33, $34,
      $35, $36, $37, 'DRAFT'
    ) RETURNING *`,
    [
      referenceCode,
      sellerProfileId,
      user.id,
      data.title,
      data.headline || null,
      data.teaserSummary,
      data.businessCategory,
      data.industry,
      data.subSector || null,
      data.operatingRegion,
      data.registeredState,
      data.registeredCity || null,
      data.approximateAgeBracket,
      data.revenueBracket,
      data.transactionType,
      data.detailedDescription || null,
      data.businessModel || "B2B",
      data.yearEstablished || null,
      data.employeeRange || null,
      data.customerScale || null,
      data.ebitdaMarginBracket || null,
      data.askingPriceBracket || null,
      data.growthRateBracket || null,
      data.facilityDetails || null,
      data.stakeOfferedPercentage || null,
      data.promoterRetentionPreference || null,
      data.reasonForSale || null,
      data.transactionObjective || null,
      data.exactLegalName || null,
      data.exactTradeName || null,
      data.exactCin || null,
      data.exactGstin || null,
      data.exactPan || null,
      data.exactAddress || null,
      data.exactRevenue || null,
      data.exactEbitda || null,
      data.exactAskingPrice || null,
    ]
  );

  const record = mapOpportunityRecord(res.rows[0]);

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_CREATED",
    resourceType: "opportunities",
    resourceId: record.id,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: { referenceCode: record.referenceCode, title: record.title },
  });

  return maskOpportunityForUser(record, user) as Tier3Opportunity;
}

/**
 * Updates an opportunity draft (Owner Seller Only, with Mass-Assignment Protection)
 */
export async function updateOpportunity(
  opportunityId: string,
  user: AuthenticatedUser,
  data: UpdateOpportunityInput,
  context?: { ip?: string; userAgent?: string }
): Promise<Tier3Opportunity> {
  const existing = await query<any>(
    `SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError("Business opportunity not found.");
  }

  const record = mapOpportunityRecord(existing.rows[0]);

  // Anti-IDOR Ownership Guard
  if (record.userId !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot modify an opportunity belonging to another seller.");
  }

  // Finite State Machine Invariant Lock
  const editableStatuses: OpportunityStatus[] = ["DRAFT", "READY_FOR_REVIEW", "CHANGES_REQUESTED"];
  if (!editableStatuses.includes(record.status) && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError(
      `Opportunity is locked in [${record.status}] status and cannot be modified without administrative change request.`
    );
  }

  // Mass Assignment Protection: Whitelist permitted fields only
  const res = await query<any>(
    `UPDATE opportunities SET
      title = COALESCE($1, title),
      headline = COALESCE($2, headline),
      teaser_summary = COALESCE($3, teaser_summary),
      business_category = COALESCE($4, business_category),
      industry = COALESCE($5, industry),
      sub_sector = COALESCE($6, sub_sector),
      operating_region = COALESCE($7, operating_region),
      registered_state = COALESCE($8, registered_state),
      registered_city = COALESCE($9, registered_city),
      approximate_age_bracket = COALESCE($10, approximate_age_bracket),
      revenue_bracket = COALESCE($11, revenue_bracket),
      transaction_type = COALESCE($12, transaction_type),
      detailed_description = COALESCE($13, detailed_description),
      business_model = COALESCE($14, business_model),
      year_established = COALESCE($15, year_established),
      employee_range = COALESCE($16, employee_range),
      customer_scale = COALESCE($17, customer_scale),
      ebitda_margin_bracket = COALESCE($18, ebitda_margin_bracket),
      asking_price_bracket = COALESCE($19, asking_price_bracket),
      growth_rate_bracket = COALESCE($20, growth_rate_bracket),
      facility_details = COALESCE($21, facility_details),
      stake_offered_percentage = COALESCE($22, stake_offered_percentage),
      promoter_retention_preference = COALESCE($23, promoter_retention_preference),
      reason_for_sale = COALESCE($24, reason_for_sale),
      transaction_objective = COALESCE($25, transaction_objective),
      exact_legal_name = COALESCE($26, exact_legal_name),
      exact_trade_name = COALESCE($27, exact_trade_name),
      exact_cin = COALESCE($28, exact_cin),
      exact_gstin = COALESCE($29, exact_gstin),
      exact_pan = COALESCE($30, exact_pan),
      exact_address = COALESCE($31, exact_address),
      exact_revenue = COALESCE($32, exact_revenue),
      exact_ebitda = COALESCE($33, exact_ebitda),
      exact_asking_price = COALESCE($34, exact_asking_price),
      updated_at = NOW()
    WHERE id = $35
    RETURNING *`,
    [
      data.title ?? null,
      data.headline ?? null,
      data.teaserSummary ?? null,
      data.businessCategory ?? null,
      data.industry ?? null,
      data.subSector ?? null,
      data.operatingRegion ?? null,
      data.registeredState ?? null,
      data.registeredCity ?? null,
      data.approximateAgeBracket ?? null,
      data.revenueBracket ?? null,
      data.transactionType ?? null,
      data.detailedDescription ?? null,
      data.businessModel ?? null,
      data.yearEstablished ?? null,
      data.employeeRange ?? null,
      data.customerScale ?? null,
      data.ebitdaMarginBracket ?? null,
      data.askingPriceBracket ?? null,
      data.growthRateBracket ?? null,
      data.facilityDetails ?? null,
      data.stakeOfferedPercentage ?? null,
      data.promoterRetentionPreference ?? null,
      data.reasonForSale ?? null,
      data.transactionObjective ?? null,
      data.exactLegalName ?? null,
      data.exactTradeName ?? null,
      data.exactCin ?? null,
      data.exactGstin ?? null,
      data.exactPan ?? null,
      data.exactAddress ?? null,
      data.exactRevenue ?? null,
      data.exactEbitda ?? null,
      data.exactAskingPrice ?? null,
      opportunityId,
    ]
  );

  const updatedRecord = mapOpportunityRecord(res.rows[0]);

  // Invalidate any existing match records since opportunity parameters changed
  await query(`DELETE FROM buyer_opportunity_matches WHERE opportunity_id = $1`, [opportunityId]);

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_UPDATED",
    resourceType: "opportunities",
    resourceId: opportunityId,
    ip: context?.ip,
    userAgent: context?.userAgent,
  });

  return maskOpportunityForUser(updatedRecord, user) as Tier3Opportunity;
}

/**
 * Submits an opportunity for platform review (Submission Gates Enforced)
 */
export async function submitOpportunity(
  opportunityId: string,
  user: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<Tier3Opportunity> {
  const existing = await query<any>(
    `SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (existing.rows.length === 0) {
    throw new NotFoundError("Business opportunity not found.");
  }

  const record = mapOpportunityRecord(existing.rows[0]);

  // Anti-IDOR Ownership Guard
  if (record.userId !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You cannot submit an opportunity belonging to another seller.");
  }

  // FSM Invariant: Must be in submittable status
  const submittableStatuses: OpportunityStatus[] = ["DRAFT", "READY_FOR_REVIEW", "CHANGES_REQUESTED"];
  if (!submittableStatuses.includes(record.status)) {
    throw new ValidationError(`Cannot submit opportunity currently in [${record.status}] status.`);
  }

  // Submission Gates Validation
  if (!record.title || record.title.length < 5) {
    throw new ValidationError("Opportunity title is mandatory (min 5 characters).");
  }
  if (!record.teaserSummary || record.teaserSummary.length < 20) {
    throw new ValidationError("Teaser summary is mandatory (min 20 characters).");
  }
  if (!record.businessCategory || !record.industry || !record.operatingRegion || !record.registeredState) {
    throw new ValidationError("Business classification, industry, and geography must be defined.");
  }
  if (!record.revenueBracket || !record.transactionType) {
    throw new ValidationError("Revenue bracket and transaction type are mandatory.");
  }

  const res = await query<any>(
    `UPDATE opportunities 
     SET status = 'SUBMITTED', submitted_at = NOW(), updated_at = NOW() 
     WHERE id = $1 
     RETURNING *`,
    [opportunityId]
  );

  const updatedRecord = mapOpportunityRecord(res.rows[0]);

  // Invalidate any existing match records since opportunity parameters changed
  await query(`DELETE FROM buyer_opportunity_matches WHERE opportunity_id = $1`, [opportunityId]);

  await auditLog({
    actorId: user.id,
    action: "OPPORTUNITY_SUBMITTED",
    resourceType: "opportunities",
    resourceId: opportunityId,
    ip: context?.ip,
    userAgent: context?.userAgent,
    metadata: { referenceCode: record.referenceCode, title: record.title },
  });

  return maskOpportunityForUser(updatedRecord, user) as Tier3Opportunity;
}

/**
 * Retrieves all opportunities owned by the authenticated seller
 */
export async function getSellerOpportunities(user: AuthenticatedUser): Promise<Tier3Opportunity[]> {
  const res = await query<any>(
    `SELECT * FROM opportunities WHERE user_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC`,
    [user.id]
  );

  return res.rows.map((row) => {
    const rec = mapOpportunityRecord(row);
    return maskOpportunityForUser(rec, user) as Tier3Opportunity;
  });
}

/**
 * Retrieves a single seller opportunity by ID (Anti-IDOR verified)
 */
export async function getSellerOpportunityById(
  opportunityId: string,
  user: AuthenticatedUser
): Promise<Tier3Opportunity> {
  const res = await query<any>(
    `SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Opportunity not found.");
  }

  const record = mapOpportunityRecord(res.rows[0]);

  if (record.userId !== user.id && !user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenError("You are not authorized to view this seller opportunity.");
  }

  // Load documents
  const docsRes = await query<any>(
    `SELECT * FROM opportunity_documents WHERE opportunity_id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );
  const docs = docsRes.rows.map(mapOpportunityDocument);

  return maskOpportunityForUser(record, user, { documents: docs }) as Tier3Opportunity;
}

/**
 * Admin: Lists all opportunities with search, status filters, and pagination
 */
export async function listOpportunitiesForAdmin(
  adminUser: AuthenticatedUser,
  filters: { status?: string; search?: string; page?: number; limit?: number }
): Promise<{ items: Tier3Opportunity[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 15));
  const offset = (page - 1) * limit;

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: any[] = [];
  let pIdx = 1;

  if (filters.status && filters.status !== "ALL") {
    conditions.push(`status = $${pIdx++}`);
    params.push(filters.status);
  }

  if (filters.search) {
    conditions.push(
      `(title ILIKE $${pIdx} OR reference_code ILIKE $${pIdx} OR industry ILIKE $${pIdx} OR registered_state ILIKE $${pIdx})`
    );
    params.push(`%${filters.search}%`);
    pIdx++;
  }

  const whereClause = conditions.join(" AND ");

  const countRes = await query<{ count: string }>(
    `SELECT count(*) as count FROM opportunities WHERE ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  const listRes = await query<any>(
    `SELECT * FROM opportunities WHERE ${whereClause} ORDER BY updated_at DESC LIMIT $${pIdx++} OFFSET $${pIdx++}`,
    [...params, limit, offset]
  );

  const items = listRes.rows.map((row) => {
    const rec = mapOpportunityRecord(row);
    return maskOpportunityForUser(rec, adminUser) as Tier3Opportunity;
  });

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Admin: Executes state machine transitions for opportunity review, verification, publishing, suspension
 */
export async function executeAdminOpportunityReview(
  opportunityId: string,
  action: "START_REVIEW" | "REQUEST_CHANGES" | "VERIFY" | "PUBLISH" | "UNPUBLISH" | "REJECT" | "SUSPEND",
  payload: { notes?: string; rejectionReason?: string; changesRequestedNotes?: string; suspensionReason?: string },
  adminUser: AuthenticatedUser,
  context?: { ip?: string; userAgent?: string }
): Promise<Tier3Opportunity> {
  const res = await query<any>(
    `SELECT * FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Opportunity not found.");
  }

  const isAuthorizedAdmin =
    adminUser.roles.includes("SUPER_ADMIN") ||
    adminUser.roles.includes("ADMIN") ||
    adminUser.permissions.includes("opportunities.review");

  if (!isAuthorizedAdmin) {
    throw new ForbiddenError("Insufficient administrative permissions to execute review actions.");
  }

  const record = mapOpportunityRecord(res.rows[0]);
  const currentStatus = record.status;
  let newStatus: OpportunityStatus;
  let auditAction: string;

  return await transaction(async (tx) => {
    switch (action) {
      case "START_REVIEW":
        if (currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot start review on opportunity in [${currentStatus}] status. Status must be SUBMITTED.`
          );
        }
        newStatus = "UNDER_REVIEW";
        auditAction = "OPPORTUNITY_REVIEW_STARTED";
        await tx.query(
          `UPDATE opportunities SET status = $1, assigned_reviewer_id = $2, updated_at = NOW() WHERE id = $3`,
          [newStatus, adminUser.id, opportunityId]
        );
        break;

      case "REQUEST_CHANGES":
        if (currentStatus !== "SUBMITTED" && currentStatus !== "UNDER_REVIEW") {
          throw new ValidationError(
            `Cannot request changes on opportunity in [${currentStatus}] status.`
          );
        }
        if (!payload.changesRequestedNotes) {
          throw new ValidationError("Must specify requested changes for the seller.");
        }
        newStatus = "CHANGES_REQUESTED";
        auditAction = "OPPORTUNITY_CHANGES_REQUESTED";
        await tx.query(
          `UPDATE opportunities SET status = $1, changes_requested_notes = $2, updated_at = NOW() WHERE id = $3`,
          [newStatus, payload.changesRequestedNotes, opportunityId]
        );
        break;

      case "VERIFY":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("opportunities.verify")
        ) {
          throw new ForbiddenError("Insufficient permissions to verify business opportunities.");
        }
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(
            `Cannot verify opportunity in [${currentStatus}] status. Must be in review.`
          );
        }
        newStatus = "VERIFIED";
        auditAction = "OPPORTUNITY_VERIFIED";
        await tx.query(
          `UPDATE opportunities SET status = $1, verified_at = NOW(), verified_by = $2, updated_at = NOW() WHERE id = $3`,
          [newStatus, adminUser.id, opportunityId]
        );
        break;

      case "PUBLISH":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("opportunities.publish")
        ) {
          throw new ForbiddenError("Insufficient permissions to publish business opportunities.");
        }
        if (currentStatus !== "VERIFIED") {
          throw new ValidationError(
            `Cannot publish opportunity in [${currentStatus}] status. Opportunity must be VERIFIED first.`
          );
        }
        newStatus = "PUBLISHED";
        auditAction = "OPPORTUNITY_PUBLISHED";
        await tx.query(
          `UPDATE opportunities SET status = $1, published_at = NOW(), published_by = $2, updated_at = NOW() WHERE id = $3`,
          [newStatus, adminUser.id, opportunityId]
        );
        break;

      case "UNPUBLISH":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("opportunities.publish")
        ) {
          throw new ForbiddenError("Insufficient permissions to unpublish opportunities.");
        }
        if (currentStatus !== "PUBLISHED") {
          throw new ValidationError(`Cannot unpublish opportunity not currently in PUBLISHED status.`);
        }
        newStatus = "VERIFIED";
        auditAction = "OPPORTUNITY_UNPUBLISHED";
        await tx.query(
          `UPDATE opportunities SET status = $1, updated_at = NOW() WHERE id = $2`,
          [newStatus, opportunityId]
        );
        // Purge matches for unpublished opportunity
        await tx.query(`DELETE FROM buyer_opportunity_matches WHERE opportunity_id = $1`, [opportunityId]);
        break;

      case "REJECT":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("opportunities.verify")
        ) {
          throw new ForbiddenError("Insufficient permissions to reject opportunities.");
        }
        if (currentStatus !== "UNDER_REVIEW" && currentStatus !== "SUBMITTED") {
          throw new ValidationError(`Cannot reject opportunity in [${currentStatus}] status.`);
        }
        if (!payload.rejectionReason) {
          throw new ValidationError("Rejection reason is mandatory.");
        }
        newStatus = "REJECTED";
        auditAction = "OPPORTUNITY_REJECTED";
        await tx.query(
          `UPDATE opportunities SET status = $1, rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
          [newStatus, payload.rejectionReason, opportunityId]
        );
        // Purge matches for rejected opportunity
        await tx.query(`DELETE FROM buyer_opportunity_matches WHERE opportunity_id = $1`, [opportunityId]);
        break;

      case "SUSPEND":
        if (
          !adminUser.roles.includes("SUPER_ADMIN") &&
          !adminUser.permissions.includes("opportunities.suspend")
        ) {
          throw new ForbiddenError("Insufficient permissions to suspend opportunities.");
        }
        if (!payload.suspensionReason) {
          throw new ValidationError("Suspension reason is mandatory.");
        }
        newStatus = "SUSPENDED";
        auditAction = "OPPORTUNITY_SUSPENDED";
        await tx.query(
          `UPDATE opportunities SET status = $1, suspension_reason = $2, suspended_at = NOW(), suspended_by = $3, updated_at = NOW() WHERE id = $4`,
          [newStatus, payload.suspensionReason, adminUser.id, opportunityId]
        );
        // Purge matches for suspended opportunity
        await tx.query(`DELETE FROM buyer_opportunity_matches WHERE opportunity_id = $1`, [opportunityId]);
        break;

      default:
        throw new ValidationError(`Unknown review action [${action}].`);
    }

    if (payload.notes) {
      await tx.query(
        `INSERT INTO opportunity_internal_notes (opportunity_id, author_id, content, category)
         VALUES ($1, $2, $3, 'CURATION')`,
        [opportunityId, adminUser.id, payload.notes]
      );
    }

    await auditLog({
      actorId: adminUser.id,
      action: auditAction,
      resourceType: "opportunities",
      resourceId: opportunityId,
      ip: context?.ip,
      userAgent: context?.userAgent,
      metadata: { previousStatus: currentStatus, newStatus, action },
    });

    const updatedRes = await tx.query<any>(`SELECT * FROM opportunities WHERE id = $1`, [opportunityId]);
    const updated = mapOpportunityRecord(updatedRes.rows[0]);
    return maskOpportunityForUser(updated, adminUser) as Tier3Opportunity;
  });
}

/**
 * Public & Authenticated Opportunity Discovery
 * Enforces server-side data masking (Tier 0 for unauthenticated, Tier 1 for authenticated)
 */
export async function discoverOpportunities(
  filters: Partial<OpportunityDiscoveryQuery>,
  user?: AuthenticatedUser | null
): Promise<{ items: (Tier0Opportunity | Tier1Opportunity)[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.pageSize || filters.limit || 12));
  const offset = (page - 1) * limit;

  // Strict Discovery Invariant: Only PUBLISHED and un-deleted opportunities can be discovered
  const conditions: string[] = ["o.status = 'PUBLISHED'", "o.deleted_at IS NULL"];
  const params: any[] = [];
  let pIdx = 1;

  // Search keyword (q or search) across allowed non-confidential fields
  const searchTerm = (filters.q || filters.search || "").trim();
  if (searchTerm) {
    conditions.push(
      `(o.title ILIKE $${pIdx} OR o.teaser_summary ILIKE $${pIdx} OR o.detailed_description ILIKE $${pIdx} OR o.industry ILIKE $${pIdx} OR o.sub_sector ILIKE $${pIdx} OR o.reference_code ILIKE $${pIdx} OR o.registered_state ILIKE $${pIdx})`
    );
    params.push(`%${searchTerm}%`);
    pIdx++;
  }

  if (filters.industry?.trim()) {
    conditions.push(`o.industry ILIKE $${pIdx++}`);
    params.push(`%${filters.industry.trim()}%`);
  }

  if (filters.subSector?.trim()) {
    conditions.push(`o.sub_sector ILIKE $${pIdx++}`);
    params.push(`%${filters.subSector.trim()}%`);
  }

  if (filters.businessCategory) {
    conditions.push(`o.business_category = $${pIdx++}`);
    params.push(filters.businessCategory);
  }

  if (filters.region) {
    conditions.push(`o.operating_region = $${pIdx++}`);
    params.push(filters.region);
  }

  if (filters.transactionType) {
    conditions.push(`o.transaction_type = $${pIdx++}`);
    params.push(filters.transactionType);
  }

  if (filters.businessModel) {
    conditions.push(`o.business_model = $${pIdx++}`);
    params.push(filters.businessModel);
  }

  if (filters.revenueBracket) {
    conditions.push(`o.revenue_bracket = $${pIdx++}`);
    params.push(filters.revenueBracket);
  }

  if (filters.ebitdaBracket) {
    conditions.push(`o.ebitda_margin_bracket = $${pIdx++}`);
    params.push(filters.ebitdaBracket);
  }

  if (filters.askingPriceBracket) {
    conditions.push(`o.asking_price_bracket = $${pIdx++}`);
    params.push(filters.askingPriceBracket);
  }

  const whereClause = conditions.join(" AND ");

  // Count query
  const countRes = await query<{ count: string }>(
    `SELECT count(*) as count FROM opportunities o WHERE ${whereClause}`,
    params
  );
  const total = Number(countRes.rows[0].count);

  // Check if authenticated user has a buyer profile for match-aware scores
  let buyerProfileId: string | null = null;
  if (user) {
    const bpRes = await query<{ id: string }>(
      `SELECT id FROM buyer_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
      [user.id]
    );
    if (bpRes.rows.length > 0) {
      buyerProfileId = bpRes.rows[0].id;
    }
  }

  // Sorting whitelist
  const sortOption = filters.sort || "newest";
  let orderByClause = "o.published_at DESC NULLS LAST, o.created_at DESC, o.id DESC";

  if (sortOption === "oldest") {
    orderByClause = "o.published_at ASC NULLS LAST, o.created_at ASC, o.id ASC";
  } else if (sortOption === "revenue_desc") {
    orderByClause = `CASE o.revenue_bracket 
      WHEN 'OVER_250CR' THEN 7 
      WHEN '100CR_TO_250CR' THEN 6 
      WHEN '50CR_TO_100CR' THEN 5 
      WHEN '25CR_TO_50CR' THEN 4 
      WHEN '15CR_TO_25CR' THEN 3 
      WHEN '5CR_TO_15CR' THEN 2 
      WHEN 'UNDER_5CR' THEN 1 
      ELSE 0 END DESC, o.id DESC`;
  } else if (sortOption === "revenue_asc") {
    orderByClause = `CASE o.revenue_bracket 
      WHEN 'UNDER_5CR' THEN 1 
      WHEN '5CR_TO_15CR' THEN 2 
      WHEN '15CR_TO_25CR' THEN 3 
      WHEN '25CR_TO_50CR' THEN 4 
      WHEN '50CR_TO_100CR' THEN 5 
      WHEN '100CR_TO_250CR' THEN 6 
      WHEN 'OVER_250CR' THEN 7 
      ELSE 8 END ASC, o.id DESC`;
  } else if (sortOption === "match" && buyerProfileId) {
    orderByClause = "COALESCE(bom.score, 0) DESC, o.published_at DESC NULLS LAST, o.id DESC";
  }

  let listSql = "";
  const queryParams = [...params];

  if (buyerProfileId && user) {
    queryParams.push(user.id);
    const buyerParamIdx = pIdx++;
    queryParams.push(MATCHING_ALGORITHM_VERSION);
    const versionParamIdx = pIdx++;
    queryParams.push(limit);
    const limitParamIdx = pIdx++;
    queryParams.push(offset);
    const offsetParamIdx = pIdx++;

    listSql = `
      SELECT o.*, 
             bom.score as match_score, 
             bom.classification as match_classification, 
             bom.is_eligible as match_is_eligible
      FROM opportunities o
      LEFT JOIN (
        SELECT opportunity_id, score, classification, is_eligible 
        FROM buyer_opportunity_matches 
        WHERE buyer_id = $${buyerParamIdx} 
          AND matching_version = $${versionParamIdx}
      ) bom ON bom.opportunity_id = o.id
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;
  } else {
    queryParams.push(limit);
    const limitParamIdx = pIdx++;
    queryParams.push(offset);
    const offsetParamIdx = pIdx++;

    listSql = `
      SELECT o.*
      FROM opportunities o
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
    `;
  }

  const listRes = await query<any>(listSql, queryParams);

  const items = listRes.rows.map((row) => {
    const rec = mapOpportunityRecord(row);
    const masked = maskOpportunityForUser(rec, user) as Tier0Opportunity | Tier1Opportunity;
    if (user && buyerProfileId && masked.tier >= 1) {
      (masked as Tier1Opportunity).matchScore =
        row.match_score !== null && row.match_score !== undefined ? Number(row.match_score) : null;
      (masked as Tier1Opportunity).matchClassification = row.match_classification || null;
      (masked as Tier1Opportunity).isEligible =
        row.match_is_eligible !== null && row.match_is_eligible !== undefined
          ? Boolean(row.match_is_eligible)
          : null;
    }
    return masked;
  });

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Retrieves a single opportunity for discovery/detail page with Progressive Data Masking
 */
export async function getOpportunityForDiscovery(
  identifier: string,
  user?: AuthenticatedUser | null
): Promise<Tier0Opportunity | Tier1Opportunity | Tier2Opportunity | Tier3Opportunity> {
  // Query by ID (UUID) or reference_code
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

  const res = await query<any>(
    `SELECT * FROM opportunities WHERE ${isUuid ? "id = $1" : "reference_code = $1"} AND deleted_at IS NULL`,
    [identifier]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError("Opportunity not found.");
  }

  const record = mapOpportunityRecord(res.rows[0]);

  const isOwner = Boolean(user && user.id === record.userId);
  const isAdmin = Boolean(
    user &&
      (user.roles.includes("SUPER_ADMIN") ||
        user.roles.includes("ADMIN") ||
        user.permissions.includes("opportunities.read_all"))
  );

  // Unpublished opportunities can ONLY be inspected by the owner seller or an admin
  // Returns uniform "Opportunity not found." to prevent enumeration of unpublished IDs
  if (record.status !== "PUBLISHED" && !isOwner && !isAdmin) {
    throw new NotFoundError("Opportunity not found.");
  }

  // Check Tier 2 authorization grant if user is authenticated
  let isTier2Authorized = false;
  if (user && !isOwner && !isAdmin) {
    const grantRes = await query<any>(
      `SELECT id FROM opportunity_access_grants 
       WHERE opportunity_id = $1 AND buyer_user_id = $2 AND granted_tier >= 2 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [record.id, user.id]
    );
    isTier2Authorized = grantRes.rows.length > 0;
  }

  // Increment view count asynchronously (safe metrics counter)
  query(`UPDATE opportunities SET view_count = view_count + 1 WHERE id = $1`, [record.id]).catch(() => {});

  // Load documents if owner, admin, or Tier 2 authorized
  let docs: OpportunityDocumentRecord[] = [];
  if (isOwner || isAdmin || isTier2Authorized) {
    const docsRes = await query<any>(
      `SELECT * FROM opportunity_documents WHERE opportunity_id = $1 AND deleted_at IS NULL`,
      [record.id]
    );
    docs = docsRes.rows.map(mapOpportunityDocument);
  }

  const masked = maskOpportunityForUser(record, user, {
    isTier2Authorized,
    documents: docs,
  });

  // Attach match score if user is an authenticated buyer
  if (user && masked.tier >= 1) {
    const bpRes = await query<{ id: string }>(
      `SELECT id FROM buyer_profiles WHERE user_id = $1 AND deleted_at IS NULL`,
      [user.id]
    );
    if (bpRes.rows.length > 0) {
      const matchRes = await query<any>(
        `SELECT score, classification, is_eligible FROM buyer_opportunity_matches 
         WHERE buyer_id = $1 AND opportunity_id = $2 AND matching_version = $3`,
        [user.id, record.id, MATCHING_ALGORITHM_VERSION]
      );
      if (matchRes.rows.length > 0) {
        (masked as Tier1Opportunity).matchScore = Number(matchRes.rows[0].score);
        (masked as Tier1Opportunity).matchClassification = matchRes.rows[0].classification;
        (masked as Tier1Opportunity).isEligible = Boolean(matchRes.rows[0].is_eligible);
      }
    }
  }

  return masked;
}

/**
 * Adds an internal note to an opportunity (Admin / Staff only)
 */
export async function addOpportunityInternalNote(
  opportunityId: string,
  data: { content: string; category?: any },
  adminUser: AuthenticatedUser
): Promise<OpportunityInternalNoteRecord> {
  const checkRes = await query<any>(
    `SELECT id FROM opportunities WHERE id = $1 AND deleted_at IS NULL`,
    [opportunityId]
  );

  if (checkRes.rows.length === 0) {
    throw new NotFoundError("Opportunity not found.");
  }

  const res = await query<any>(
    `INSERT INTO opportunity_internal_notes (opportunity_id, author_id, content, category)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [opportunityId, adminUser.id, data.content, data.category || "CURATION"]
  );

  return {
    id: res.rows[0].id,
    opportunityId: res.rows[0].opportunity_id,
    authorId: res.rows[0].author_id,
    authorName: `${adminUser.firstName} ${adminUser.lastName}`.trim(),
    content: res.rows[0].content,
    category: res.rows[0].category,
    createdAt: new Date(res.rows[0].created_at),
  };
}
