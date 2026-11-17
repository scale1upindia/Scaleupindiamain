export type BuyerType =
  | "INDIVIDUAL_INVESTOR"
  | "CORPORATE_BUYER"
  | "PE_FUND"
  | "VC_FUND"
  | "FAMILY_OFFICE"
  | "STRATEGIC_PARTNER"
  | "OTHER";

export type EntityType =
  | "COMPANY"
  | "FUND"
  | "FAMILY_OFFICE"
  | "INDIVIDUAL"
  | "LLP"
  | "PARTNERSHIP"
  | "OTHER";

export type BuyerOnboardingStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "PROFILE_INCOMPLETE"
  | "MANDATE_INCOMPLETE"
  | "READY_FOR_REVIEW"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "VERIFIED"
  | "REJECTED"
  | "SUSPENDED";

export type MandateStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";

export type TransactionType =
  | "FULL_ACQUISITION"
  | "MAJORITY_STAKE"
  | "MINORITY_STAKE"
  | "STRATEGIC_INVESTMENT"
  | "PRIVATE_EQUITY"
  | "VENTURE_INVESTMENT"
  | "JOINT_VENTURE"
  | "STRATEGIC_PARTNERSHIP"
  | "ASSET_ACQUISITION";

export type ControlPreference =
  | "FULL_CONTROL"
  | "MAJORITY_CONTROL"
  | "JOINT_CONTROL"
  | "MINORITY"
  | "NO_CONTROL_FINANCIAL";

export type InvestmentHorizon = "SHORT_TERM" | "MEDIUM_TERM" | "LONG_TERM";

export type FundingSource =
  | "OWN_CAPITAL"
  | "FUND_CAPITAL"
  | "BANK_DEBT"
  | "INSTITUTIONAL_DEBT"
  | "CO_INVESTMENT"
  | "COMBINATION";

export type RegionType =
  | "PAN_INDIA"
  | "NORTH_INDIA"
  | "SOUTH_INDIA"
  | "EAST_INDIA"
  | "WEST_INDIA"
  | "GLOBAL"
  | "SPECIFIC_STATES";

export type BuyerDocumentType =
  | "COMPANY_REGISTRATION"
  | "FUND_PROFILE"
  | "AUTHORIZATION_LETTER"
  | "INVESTMENT_MANDATE"
  | "PROOF_OF_FUNDS"
  | "CORPORATE_PROFILE"
  | "OTHER";

export interface BuyerProfileRecord {
  id: string;
  userId: string;
  buyerType: BuyerType;
  legalName: string;
  tradeName: string | null;
  entityType: EntityType;
  registrationNumber: string | null;
  country: string;
  state: string;
  city: string;
  website: string | null;
  yearEstablished: number | null;
  industry: string | null;
  description: string | null;
  fundSize: number | null;
  aum: number | null;
  currentVintage: number | null;
  typicalTicketSize: number | null;
  contactName: string;
  designation: string;
  email: string;
  phone: string;
  preferredCommMethod: "IN_APP" | "EMAIL" | "PHONE" | "WHATSAPP";
  onboardingStatus: BuyerOnboardingStatus;
  completionPercentage: number;
  rejectionReason: string | null;
  changesRequestedNotes: string | null;
  suspensionReason: string | null;
  assignedReviewerId: string | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  suspendedAt: Date | null;
  suspendedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MandateTargetIndustryRecord {
  id: string;
  mandateId: string;
  industry: string;
  subSectors: string[];
  otherSubSector: string | null;
  createdAt: Date;
}

export interface MandateTargetGeographyRecord {
  id: string;
  mandateId: string;
  region: RegionType;
  countries: string[];
  states: string[];
  cities: string[];
  createdAt: Date;
}

export interface AcquisitionMandateRecord {
  id: string;
  buyerProfileId: string;
  name: string;
  description: string | null;
  status: MandateStatus;
  minInvestment: number;
  maxInvestment: number;
  preferredTicketSize: number | null;
  availableCapital: number | null;
  financingRequirement: string | null;
  debtEquityPreference: string | null;
  revenueMin: number;
  revenueMax: number | null;
  ebitdaMin: number | null;
  ebitdaMax: number | null;
  employeeMin: number;
  employeeMax: number | null;
  businessAgeMin: number;
  businessAgeMax: number | null;
  netWorthMin: number | null;
  netWorthMax: number | null;
  transactionTypes: TransactionType[];
  controlPreference: ControlPreference;
  strategicObjectives: string[];
  otherStrategicObjective: string | null;
  preferredBusinessAge: string | null;
  promoterInvolvement: string | null;
  promoterExitPreference: string | null;
  existingManagementRetention: string | null;
  turnaroundOpportunities: boolean;
  profitableBusinessesOnly: boolean;
  growthStage: boolean;
  distressedOpportunities: boolean;
  assetPreference: "ASSET_HEAVY" | "ASSET_LIGHT" | "FLEXIBLE";
  investmentHorizon: InvestmentHorizon;
  expectedHoldingPeriodYears: number | null;
  fundingSource: FundingSource;
  targetIndustries?: MandateTargetIndustryRecord[];
  targetGeographies?: MandateTargetGeographyRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerDocumentRecord {
  id: string;
  buyerProfileId: string;
  ownerId: string;
  mandateId: string | null;
  documentType: BuyerDocumentType;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuyerInternalNoteRecord {
  id: string;
  buyerProfileId: string;
  authorId: string;
  authorName?: string;
  content: string;
  category: "GENERAL" | "COMPLIANCE" | "FINANCIAL" | "MANDATE" | "RISK";
  createdAt: Date;
}

export interface BuyerDossier {
  profile: BuyerProfileRecord;
  mandates: AcquisitionMandateRecord[];
  documents: BuyerDocumentRecord[];
  internalNotes?: BuyerInternalNoteRecord[];
  draftPayload?: Record<string, any>;
  lastActiveStep?: number;
  sectionsCompleted?: string[];
}

