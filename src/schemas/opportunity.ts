import { z } from "zod";

const BusinessCategoryEnum = z.enum([
  "MANUFACTURING",
  "SERVICES",
  "TECHNOLOGY",
  "HEALTHCARE",
  "CONSUMER_RETAIL",
  "LOGISTICS",
  "AGRITECH",
  "OTHER",
]);

const OperatingRegionEnum = z.enum([
  "PAN_INDIA",
  "NORTH_INDIA",
  "WEST_INDIA",
  "SOUTH_INDIA",
  "EAST_INDIA",
  "CENTRAL_INDIA",
  "GLOBAL",
]);

const BusinessAgeBracketEnum = z.enum([
  "LESS_THAN_3_YRS",
  "3_TO_5_YRS",
  "5_TO_10_YRS",
  "10_TO_20_YRS",
  "OVER_20_YRS",
]);

const RevenueBracketEnum = z.enum([
  "UNDER_5CR",
  "5CR_TO_15CR",
  "15CR_TO_25CR",
  "25CR_TO_50CR",
  "50CR_TO_100CR",
  "100CR_TO_250CR",
  "OVER_250CR",
]);

const EbitdaMarginBracketEnum = z.enum([
  "NEGATIVE",
  "0_TO_10_PCT",
  "10_TO_20_PCT",
  "20_TO_30_PCT",
  "OVER_30_PCT",
]);

const AskingPriceBracketEnum = z.enum([
  "UNDER_10CR",
  "10CR_TO_25CR",
  "25CR_TO_50CR",
  "50CR_TO_100CR",
  "100CR_TO_250CR",
  "NEGOTIABLE",
]);

const TransactionTypeEnum = z.enum([
  "FULL_ACQUISITION",
  "MAJORITY_STAKE",
  "MINORITY_STAKE",
  "JOINT_VENTURE",
  "STRATEGIC_PARTNERSHIP",
  "ASSET_SALE",
]);

const BusinessModelEnum = z.enum([
  "B2B",
  "B2C",
  "B2B2C",
  "D2C",
  "CONTRACT_MANUFACTURING",
  "SAAS",
  "FRANCHISE",
  "HYBRID",
]);

const EmployeeRangeEnum = z.enum([
  "1_TO_10",
  "11_TO_50",
  "51_TO_200",
  "201_TO_500",
  "OVER_500",
]);

const GrowthRateBracketEnum = z.enum([
  "STABLE",
  "10_TO_25_PCT",
  "25_TO_50_PCT",
  "OVER_50_PCT",
]);

/**
 * Schema for creating a new business opportunity
 */
export const createOpportunitySchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(255, "Title cannot exceed 255 characters"),
  headline: z.string().max(500).optional(),
  teaserSummary: z
    .string()
    .min(20, "Teaser summary must be at least 20 characters")
    .max(2000, "Teaser summary cannot exceed 2000 characters"),
  businessCategory: BusinessCategoryEnum,
  industry: z.string().min(2, "Industry is mandatory").max(100),
  subSector: z.string().max(100).optional(),
  operatingRegion: OperatingRegionEnum,
  registeredState: z.string().min(2, "Registered state is required").max(100),
  registeredCity: z.string().max(100).optional(),
  approximateAgeBracket: BusinessAgeBracketEnum,
  revenueBracket: RevenueBracketEnum,
  transactionType: TransactionTypeEnum,

  // Authenticated Tier 1 Fields
  detailedDescription: z.string().max(5000).optional(),
  businessModel: BusinessModelEnum.default("B2B"),
  yearEstablished: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  employeeRange: EmployeeRangeEnum.optional(),
  customerScale: z.string().max(255).optional(),
  ebitdaMarginBracket: EbitdaMarginBracketEnum.optional(),
  askingPriceBracket: AskingPriceBracketEnum.optional(),
  growthRateBracket: GrowthRateBracketEnum.optional(),
  facilityDetails: z.string().max(2000).optional(),
  stakeOfferedPercentage: z
    .number()
    .min(0)
    .max(100)
    .optional(),
  promoterRetentionPreference: z.string().max(100).optional(),
  reasonForSale: z.string().max(1000).optional(),
  transactionObjective: z.string().max(1000).optional(),

  // Confidential Underlying Fields (for seller's own draft / staff review)
  exactLegalName: z.string().max(255).optional(),
  exactTradeName: z.string().max(255).optional(),
  exactCin: z.string().max(21).optional(),
  exactGstin: z.string().max(15).optional(),
  exactPan: z.string().max(10).optional(),
  exactAddress: z.string().max(1000).optional(),
  exactRevenue: z.number().min(0).optional(),
  exactEbitda: z.number().optional(),
  exactAskingPrice: z.number().min(0).optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;

/**
 * Schema for updating an existing business opportunity
 */
export const updateOpportunitySchema = createOpportunitySchema.partial();
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;

/**
 * Schema for administrative review actions on an opportunity
 */
export const adminReviewOpportunitySchema = z.object({
  action: z.enum([
    "START_REVIEW",
    "REQUEST_CHANGES",
    "VERIFY",
    "PUBLISH",
    "UNPUBLISH",
    "REJECT",
    "SUSPEND",
  ]),
  notes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(2000).optional(),
  changesRequestedNotes: z.string().max(2000).optional(),
  suspensionReason: z.string().max(2000).optional(),
});

export type AdminReviewOpportunityInput = z.infer<typeof adminReviewOpportunitySchema>;

export const DiscoverySortOptionEnum = z.enum([
  "newest",
  "oldest",
  "revenue_desc",
  "revenue_asc",
  "match",
]);
export type DiscoverySortOption = z.infer<typeof DiscoverySortOptionEnum>;

/**
 * Filter query parameters for public and authenticated opportunity discovery
 */
export const opportunityDiscoveryQuerySchema = z.object({
  q: z.string().max(100).optional(),
  search: z.string().max(100).optional(),
  industry: z.string().max(100).optional(),
  subSector: z.string().max(100).optional(),
  businessCategory: BusinessCategoryEnum.optional(),
  region: OperatingRegionEnum.optional(),
  transactionType: TransactionTypeEnum.optional(),
  businessModel: BusinessModelEnum.optional(),
  revenueBracket: RevenueBracketEnum.optional(),
  ebitdaBracket: EbitdaMarginBracketEnum.optional(),
  askingPriceBracket: AskingPriceBracketEnum.optional(),
  sort: DiscoverySortOptionEnum.optional().default("newest"),
  page: z.coerce.number().int().min(1, "Page must be at least 1").optional().default(1),
  limit: z.coerce.number().int().min(1).max(50, "Limit cannot exceed 50").optional().default(12),
  pageSize: z.coerce.number().int().min(1).max(50, "Page size cannot exceed 50").optional(),
});

export type OpportunityDiscoveryQuery = z.infer<typeof opportunityDiscoveryQuerySchema>;
