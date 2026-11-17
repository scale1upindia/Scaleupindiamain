export type OnboardingStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "PROFILE_INCOMPLETE"
  | "READY_FOR_REVIEW"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "CHANGES_REQUESTED"
  | "VERIFIED"
  | "REJECTED";

export type BusinessType =
  | "PRIVATE_LIMITED"
  | "PUBLIC_LIMITED"
  | "LLP"
  | "PARTNERSHIP_FIRM"
  | "SOLE_PROPRIETORSHIP"
  | "OTHER";

export type MSMEStatus = "MICRO" | "SMALL" | "MEDIUM" | "NONE";

export type TransactionIntent =
  | "FULL_SALE"
  | "PARTIAL_STAKE_SALE"
  | "INVESTMENT"
  | "JOINT_VENTURE"
  | "STRATEGIC_PARTNERSHIP"
  | "ASSET_SALE";

export type OwnerType =
  | "INDIVIDUAL_PROMOTER"
  | "CORPORATE_ENTITY"
  | "PE_VC_FUND"
  | "ESOP_POOL"
  | "OTHER";

export type SellerDocumentType =
  | "INCORPORATION_CERT"
  | "PAN_CARD"
  | "GST_REGISTRATION"
  | "AUDITED_FINANCIALS"
  | "ITR_ACKNOWLEDGEMENT"
  | "FORM_26AS"
  | "SHAREHOLDING_PATTERN"
  | "REGULATORY_APPROVAL"
  | "OTHER";

export interface SellerProfileRecord {
  id: string;
  userId: string;
  designation: string;
  mobile: string;
  email: string;
  preferredCommMethod: "IN_APP" | "EMAIL" | "PHONE" | "WHATSAPP";
  onboardingStatus: OnboardingStatus;
  currentStep: number;
  completionPercentage: number;
  rejectionReason: string | null;
  changesRequestedNotes: string | null;
  assignedReviewerId: string | null;
  submittedAt: Date | null;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessProfileRecord {
  id: string;
  sellerProfileId: string;
  legalName: string;
  tradeName: string | null;
  businessType: BusinessType;
  cin: string | null;
  gstin: string | null;
  pan: string | null;
  industry: string;
  subSector: string | null;
  yearEstablished: number;
  registeredState: string;
  registeredCity: string;
  operatingLocations: string[];
  employeeCount: number;
  businessDescription: string;
  website: string | null;
  msmeStatus: MSMEStatus;
  otherRegistrations: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessFinancialRecord {
  id: string;
  sellerProfileId: string;
  financialYear: string;
  revenue: number;
  ebitda: number;
  pat: number;
  netWorth: number;
  debt: number;
  assets: number;
  liabilities: number;
  cashFlow: number | null;
  isAudited: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessOwnershipRecord {
  id: string;
  sellerProfileId: string;
  ownerType: OwnerType;
  ownerName: string;
  ownershipPercentage: number;
  holdingEntity: string | null;
  role: string | null;
  controlRights: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerTransactionPreferenceRecord {
  id: string;
  sellerProfileId: string;
  intents: TransactionIntent[];
  stakeOfferedPercentage: number | null;
  expectedValuation: number | null;
  expectedTransactionValue: number | null;
  minAcceptableTerms: string | null;
  preferredTimeline: string | null;
  preferredBuyerType: string[];
  strategicObjectives: string | null;
  reasonForTransaction: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SellerDocumentRecord {
  id: string;
  sellerProfileId: string;
  ownerId: string;
  documentType: SellerDocumentType;
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

export interface SellerInternalNoteRecord {
  id: string;
  sellerProfileId: string;
  authorId: string;
  authorName?: string;
  content: string;
  category: "GENERAL" | "COMPLIANCE" | "FINANCIAL" | "VALUATION" | "RISK";
  createdAt: Date;
}

export interface OnboardingDossier {
  profile: SellerProfileRecord;
  business: BusinessProfileRecord | null;
  financials: BusinessFinancialRecord[];
  ownership: BusinessOwnershipRecord[];
  transactionPreferences: SellerTransactionPreferenceRecord | null;
  documents: SellerDocumentRecord[];
  internalNotes?: SellerInternalNoteRecord[];
  draftPayload?: Record<string, any>;
  lastActiveSection?: string;
  sectionsCompleted?: string[];
}

