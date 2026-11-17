"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Building2,
  User,
  DollarSign,
  PieChart,
  Briefcase,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Save,
  AlertCircle,
  Loader2,
  Trash2,
  UploadCloud,
  FileCheck,
  ShieldCheck,
  Lock,
} from "lucide-react";
import {
  OnboardingDossier,
  SellerDocumentType,
  BusinessType,
  MSMEStatus,
} from "@/types/seller";

export default function SellerOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<OnboardingDossier | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states
  const [promoter, setPromoter] = useState({
    designation: "Promoter / Managing Director",
    mobile: "",
    email: "",
    preferredCommMethod: "IN_APP" as const,
  });

  const [business, setBusiness] = useState({
    legalName: "",
    tradeName: "",
    businessType: "PRIVATE_LIMITED" as BusinessType,
    cin: "",
    gstin: "",
    pan: "",
    industry: "",
    subSector: "",
    yearEstablished: 2015,
    registeredState: "",
    registeredCity: "",
    operatingLocations: [] as string[],
    employeeCount: 25,
    businessDescription: "",
    website: "",
    msmeStatus: "NONE" as MSMEStatus,
    otherRegistrations: [] as string[],
  });

  const [financials, setFinancials] = useState<any[]>([
    {
      financialYear: "2023-24",
      revenue: 0,
      ebitda: 0,
      pat: 0,
      netWorth: 0,
      debt: 0,
      assets: 0,
      liabilities: 0,
      isAudited: true,
    },
  ]);

  const [ownerships, setOwnerships] = useState<any[]>([
    {
      ownerType: "INDIVIDUAL_PROMOTER" as const,
      ownerName: "",
      ownershipPercentage: 100,
      role: "Promoter & Founder",
      controlRights: "Full operational and board control",
    },
  ]);

  const [intent, setIntent] = useState({
    intents: ["FULL_SALE"] as string[],
    stakeOfferedPercentage: 100,
    expectedValuation: 0,
    expectedTransactionValue: 0,
    minAcceptableTerms: "",
    preferredTimeline: "3-6 Months",
    preferredBuyerType: ["STRATEGIC_ACQUIRER", "PE_FUND"],
    strategicObjectives: "",
    reasonForTransaction: "",
  });

  // Document upload state
  const [uploadDocType, setUploadDocType] = useState<SellerDocumentType>("AUDITED_FINANCIALS");
  const [isUploading, setIsUploading] = useState(false);

  // Load Dossier from server
  const loadDossier = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/seller/onboarding");
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to load onboarding dossier");

      const d: OnboardingDossier = json.data.dossier;
      setDossier(d);

      if (d.profile) {
        setPromoter({
          designation: d.profile.designation || "Promoter / Managing Director",
          mobile: d.profile.mobile || user?.phone || "",
          email: d.profile.email || user?.email || "",
          preferredCommMethod: (d.profile.preferredCommMethod as any) || "IN_APP",
        });
      }

      if (d.business) {
        setBusiness({
          legalName: d.business.legalName || "",
          tradeName: d.business.tradeName || "",
          businessType: d.business.businessType || "PRIVATE_LIMITED",
          cin: d.business.cin || "",
          gstin: d.business.gstin || "",
          pan: d.business.pan || "",
          industry: d.business.industry || "",
          subSector: d.business.subSector || "",
          yearEstablished: d.business.yearEstablished || 2015,
          registeredState: d.business.registeredState || "",
          registeredCity: d.business.registeredCity || "",
          operatingLocations: d.business.operatingLocations || [],
          employeeCount: d.business.employeeCount || 0,
          businessDescription: d.business.businessDescription || "",
          website: d.business.website || "",
          msmeStatus: d.business.msmeStatus || "NONE",
          otherRegistrations: d.business.otherRegistrations || [],
        });
      }

      if (d.financials && d.financials.length > 0) {
        setFinancials(d.financials);
      }

      if (d.ownership && d.ownership.length > 0) {
        setOwnerships(d.ownership);
      }

      if (d.transactionPreferences) {
        setIntent({
          intents: d.transactionPreferences.intents || ["FULL_SALE"],
          stakeOfferedPercentage: d.transactionPreferences.stakeOfferedPercentage ?? 100,
          expectedValuation: d.transactionPreferences.expectedValuation ?? 0,
          expectedTransactionValue: d.transactionPreferences.expectedTransactionValue ?? 0,
          minAcceptableTerms: d.transactionPreferences.minAcceptableTerms || "",
          preferredTimeline: d.transactionPreferences.preferredTimeline || "3-6 Months",
          preferredBuyerType: d.transactionPreferences.preferredBuyerType || [],
          strategicObjectives: d.transactionPreferences.strategicObjectives || "",
          reasonForTransaction: d.transactionPreferences.reasonForTransaction || "",
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load onboarding dossier");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  // Read-only lock check: submitted or verified
  const isLocked =
    dossier?.profile?.onboardingStatus === "SUBMITTED" ||
    dossier?.profile?.onboardingStatus === "UNDER_REVIEW" ||
    dossier?.profile?.onboardingStatus === "VERIFIED";

  // Section Save Handlers
  const handleSavePromoter = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/seller/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(promoter),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to update promoter profile");
      setSaveStatus("saved");
      setActiveStep(2);
      await loadDossier();
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBusiness = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/seller/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...business,
          employeeCount: Number(business.employeeCount),
          yearEstablished: Number(business.yearEstablished),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to update business profile");
      setSaveStatus("saved");
      setActiveStep(3);
      await loadDossier();
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFinancials = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const formatted = financials.map((f) => ({
        financialYear: f.financialYear,
        revenue: Number(f.revenue),
        ebitda: Number(f.ebitda),
        pat: Number(f.pat),
        netWorth: Number(f.netWorth),
        debt: Number(f.debt || 0),
        assets: Number(f.assets),
        liabilities: Number(f.liabilities),
        isAudited: Boolean(f.isAudited),
      }));

      const res = await fetch("/api/v1/seller/financials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financials: formatted }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to save financial records");
      setSaveStatus("saved");
      setActiveStep(4);
      await loadDossier();
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOwnership = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const formatted = ownerships.map((o) => ({
        ownerType: o.ownerType,
        ownerName: o.ownerName,
        ownershipPercentage: Number(o.ownershipPercentage),
        role: o.role || undefined,
        holdingEntity: o.holdingEntity || undefined,
        controlRights: o.controlRights || undefined,
      }));

      const res = await fetch("/api/v1/seller/ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerships: formatted }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to save ownership records");
      setSaveStatus("saved");
      setActiveStep(5);
      await loadDossier();
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIntent = async () => {
    setSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/seller/transaction-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intents: intent.intents,
          stakeOfferedPercentage: Number(intent.stakeOfferedPercentage),
          expectedValuation: Number(intent.expectedValuation),
          expectedTransactionValue: Number(intent.expectedTransactionValue),
          minAcceptableTerms: intent.minAcceptableTerms,
          preferredTimeline: intent.preferredTimeline,
          preferredBuyerType: intent.preferredBuyerType,
          strategicObjectives: intent.strategicObjectives,
          reasonForTransaction: intent.reasonForTransaction,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Failed to save transaction preferences");
      setSaveStatus("saved");
      setActiveStep(6);
      await loadDossier();
    } catch (err: any) {
      setSaveStatus("error");
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Document Upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", uploadDocType);

      const res = await fetch("/api/v1/seller/documents", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Upload failed");
      await loadDossier();
    } catch (err: any) {
      setErrorMessage(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to remove this document?")) return;
    try {
      const res = await fetch(`/api/v1/seller/documents/${docId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Delete failed");
      await loadDossier();
    } catch (err: any) {
      setErrorMessage(err.message);
    }
  };

  // Final Submit for Verification
  const handleSubmitDossier = async () => {
    if (!confirm("Confirm submission for Scale-up India administrative verification? Once submitted, fields are locked during review.")) return;

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/seller/onboarding/submit", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message || "Submission failed");
      setSuccessMessage("Your business dossier has been successfully submitted for administrative verification.");
      await loadDossier();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
      </div>
    );
  }

  const steps = [
    { num: 1, title: "Promoter", icon: User },
    { num: 2, title: "Business Profile", icon: Building2 },
    { num: 3, title: "Financials", icon: DollarSign },
    { num: 4, title: "Ownership", icon: PieChart },
    { num: 5, title: "Transaction Intent", icon: Briefcase },
    { num: 6, title: "Documents Vault", icon: FileText },
    { num: 7, title: "Review & Submit", icon: FileCheck },
  ];

  return (
    <div className="flex-1 bg-[#F7F9FC] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#1557A6]">
                  Seller / Promoter Business Dossier
                </h1>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded ${
                    dossier?.profile?.onboardingStatus === "VERIFIED"
                      ? "bg-emerald-100 text-emerald-800"
                      : dossier?.profile?.onboardingStatus === "SUBMITTED"
                      ? "bg-blue-100 text-blue-800"
                      : dossier?.profile?.onboardingStatus === "CHANGES_REQUESTED"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {dossier?.profile?.onboardingStatus || "DRAFT"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Institutional onboarding workspace for confidential enterprise divestment and stake sales.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Dossier Completion</span>
                <span className="text-sm font-bold text-[#1557A6]">
                  {dossier?.profile?.completionPercentage || 0}%
                </span>
              </div>
              <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[#1557A6] h-full transition-all duration-500"
                  style={{ width: `${dossier?.profile?.completionPercentage || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Locked / Changes Requested Notification Banners */}
          {isLocked && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-blue-900 text-xs">
              <Lock className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                This dossier is currently locked under administrative review. Modifications are restricted until review completion.
              </span>
            </div>
          )}

          {dossier?.profile?.onboardingStatus === "CHANGES_REQUESTED" && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
              <span className="font-bold block mb-1">Scale-up India Reviewer Notes:</span>
              <p>{dossier.profile.changesRequestedNotes}</p>
            </div>
          )}
        </div>

        {/* Global Error & Success Alerts */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Horizontal Stepper */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 overflow-x-auto">
          <div className="flex items-center min-w-[700px] justify-between">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const isCurrent = activeStep === s.num;
              const isPast = activeStep > s.num;
              return (
                <button
                  key={s.num}
                  onClick={() => setActiveStep(s.num)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isCurrent
                      ? "bg-[#1557A6] text-white shadow-sm"
                      : isPast
                      ? "text-[#1557A6] hover:bg-slate-50"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                      isCurrent
                        ? "bg-white text-[#1557A6]"
                        : isPast
                        ? "bg-[#1557A6] text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : s.num}
                  </div>
                  <span>{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 1: PROMOTER PROFILE */}
        {activeStep === 1 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1557A6]">01 — Promoter Profile</h2>
              <p className="text-xs text-slate-600 mt-1">
                Provide your primary executive designation and verified contact preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designation / Corporate Role *
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={promoter.designation}
                  onChange={(e) => setPromoter({ ...promoter, designation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Verified Contact Mobile *
                </label>
                <input
                  type="tel"
                  disabled={isLocked}
                  value={promoter.mobile}
                  onChange={(e) => setPromoter({ ...promoter, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Correspondence Email *
                </label>
                <input
                  type="email"
                  disabled={isLocked}
                  value={promoter.email}
                  onChange={(e) => setPromoter({ ...promoter, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Preferred Communication Mode
                </label>
                <select
                  disabled={isLocked}
                  value={promoter.preferredCommMethod}
                  onChange={(e) =>
                    setPromoter({ ...promoter, preferredCommMethod: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                >
                  <option value="IN_APP">In-App Deal Room (Recommended for Confidentiality)</option>
                  <option value="EMAIL">Encrypted Email</option>
                  <option value="PHONE">Direct Telephone</option>
                  <option value="WHATSAPP">WhatsApp Business</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="button"
                disabled={saving || isLocked}
                onClick={handleSavePromoter}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50"
              >
                {saving ? <span>Saving...</span> : <span>Save & Continue to Business Profile</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: BUSINESS IDENTITY & OVERVIEW */}
        {activeStep === 2 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1557A6]">02 — Business Identity & Operations</h2>
              <p className="text-xs text-slate-600 mt-1">
                Corporate identification records, MCA CIN, statutory registrations, and operating summary.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Legal Business Name (As per MCA / RoC) *
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.legalName}
                  onChange={(e) => setBusiness({ ...business, legalName: e.target.value })}
                  placeholder="e.g. Acme Precision Engineering Pvt Ltd"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trade / Brand Name (Optional)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.tradeName}
                  onChange={(e) => setBusiness({ ...business, tradeName: e.target.value })}
                  placeholder="e.g. Acme Precision"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Business Entity Type *
                </label>
                <select
                  disabled={isLocked}
                  value={business.businessType}
                  onChange={(e) => setBusiness({ ...business, businessType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                >
                  <option value="PRIVATE_LIMITED">Private Limited Company</option>
                  <option value="PUBLIC_LIMITED">Public Limited Company</option>
                  <option value="LLP">Limited Liability Partnership (LLP)</option>
                  <option value="PARTNERSHIP_FIRM">Partnership Firm</option>
                  <option value="SOLE_PROPRIETORSHIP">Sole Proprietorship</option>
                  <option value="OTHER">Other Form of Undertaking</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corporate Identification Number (CIN)
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.cin}
                  onChange={(e) => setBusiness({ ...business, cin: e.target.value.toUpperCase() })}
                  placeholder="e.g. U28910MH2012PTC234567"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.gstin}
                  onChange={(e) => setBusiness({ ...business, gstin: e.target.value.toUpperCase() })}
                  placeholder="e.g. 27AAPFU0939F1ZV"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company PAN</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.pan}
                  onChange={(e) => setBusiness({ ...business, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. AAPFU0939F"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Industry Sector *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.industry}
                  onChange={(e) => setBusiness({ ...business, industry: e.target.value })}
                  placeholder="e.g. Manufacturing / Chemicals / Logistics"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Year Established *</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={business.yearEstablished}
                  onChange={(e) =>
                    setBusiness({ ...business, yearEstablished: parseInt(e.target.value) || 2015 })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered State *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.registeredState}
                  onChange={(e) => setBusiness({ ...business, registeredState: e.target.value })}
                  placeholder="e.g. Maharashtra"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Registered City *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={business.registeredCity}
                  onChange={(e) => setBusiness({ ...business, registeredCity: e.target.value })}
                  placeholder="e.g. Pune"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full-Time Employee Count *</label>
                <input
                  type="number"
                  disabled={isLocked}
                  value={business.employeeCount}
                  onChange={(e) =>
                    setBusiness({ ...business, employeeCount: parseInt(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MSME Category</label>
                <select
                  disabled={isLocked}
                  value={business.msmeStatus}
                  onChange={(e) => setBusiness({ ...business, msmeStatus: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                >
                  <option value="NONE">Not Registered / Large Enterprise</option>
                  <option value="MICRO">Micro Enterprise</option>
                  <option value="SMALL">Small Enterprise</option>
                  <option value="MEDIUM">Medium Enterprise</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Executive Business Summary & Core Operations *
              </label>
              <textarea
                rows={4}
                disabled={isLocked}
                value={business.businessDescription}
                onChange={(e) => setBusiness({ ...business, businessDescription: e.target.value })}
                placeholder="Describe your manufacturing capabilities, product offerings, key client profile, revenue streams, and competitive strengths..."
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
              />
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={saving || isLocked}
                onClick={handleSaveBusiness}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50"
              >
                {saving ? <span>Saving...</span> : <span>Save & Continue to Financials</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FINANCIALS */}
        {activeStep === 3 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1557A6]">03 — Multi-Year Financial Performance</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Structured audited financials (in INR). Support multiple fiscal years.
                </p>
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() =>
                    setFinancials([
                      ...financials,
                      {
                        financialYear: "2022-23",
                        revenue: 0,
                        ebitda: 0,
                        pat: 0,
                        netWorth: 0,
                        debt: 0,
                        assets: 0,
                        liabilities: 0,
                        isAudited: true,
                      },
                    ])
                  }
                  className="px-3 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-md shadow"
                >
                  + Add Fiscal Year
                </button>
              )}
            </div>

            <div className="space-y-6">
              {financials.map((fin, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-[#F7F9FC] space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="text-xs font-bold text-[#1557A6]">
                      Fiscal Year {fin.financialYear || `#${idx + 1}`}
                    </span>
                    {financials.length > 1 && !isLocked && (
                      <button
                        type="button"
                        onClick={() => setFinancials(financials.filter((_, i) => i !== idx))}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">FY (e.g. 2023-24)</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={fin.financialYear}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].financialYear = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Turnover / Revenue (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.revenue}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].revenue = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">EBITDA (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.ebitda}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].ebitda = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">PAT (Net Profit) (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.pat}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].pat = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Net Worth (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.netWorth}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].netWorth = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Debt / Borrowings (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.debt}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].debt = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Assets (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.assets}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].assets = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Liabilities (₹)</label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={fin.liabilities}
                        onChange={(e) => {
                          const copy = [...financials];
                          copy[idx].liabilities = e.target.value;
                          setFinancials(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={saving || isLocked}
                onClick={handleSaveFinancials}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50"
              >
                {saving ? <span>Saving...</span> : <span>Save & Continue to Ownership</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: OWNERSHIP CAP TABLE */}
        {activeStep === 4 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1557A6]">04 — Shareholding & Cap Table</h2>
                <p className="text-xs text-slate-600 mt-1">
                  List all major shareholders. Total ownership must sum to 100%.
                </p>
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={() =>
                    setOwnerships([
                      ...ownerships,
                      {
                        ownerType: "INDIVIDUAL_PROMOTER",
                        ownerName: "",
                        ownershipPercentage: 10,
                        role: "Director",
                      },
                    ])
                  }
                  className="px-3 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-md shadow"
                >
                  + Add Shareholder
                </button>
              )}
            </div>

            <div className="space-y-4">
              {ownerships.map((o, idx) => (
                <div key={idx} className="p-4 border border-slate-200 rounded-lg bg-[#F7F9FC] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1557A6]">Owner #{idx + 1}</span>
                    {ownerships.length > 1 && !isLocked && (
                      <button
                        type="button"
                        onClick={() => setOwnerships(ownerships.filter((_, i) => i !== idx))}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Owner Name *</label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={o.ownerName}
                        onChange={(e) => {
                          const copy = [...ownerships];
                          copy[idx].ownerName = e.target.value;
                          setOwnerships(copy);
                        }}
                        placeholder="e.g. Ramesh Agarwal"
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Owner Type *</label>
                      <select
                        disabled={isLocked}
                        value={o.ownerType}
                        onChange={(e) => {
                          const copy = [...ownerships];
                          copy[idx].ownerType = e.target.value;
                          setOwnerships(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      >
                        <option value="INDIVIDUAL_PROMOTER">Individual Promoter / Founder</option>
                        <option value="CORPORATE_ENTITY">Corporate Holding Entity</option>
                        <option value="PE_VC_FUND">PE / VC / Angel Investor</option>
                        <option value="ESOP_POOL">ESOP Trust / Pool</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Equity Stake (%) *
                      </label>
                      <input
                        type="number"
                        disabled={isLocked}
                        value={o.ownershipPercentage}
                        onChange={(e) => {
                          const copy = [...ownerships];
                          copy[idx].ownershipPercentage = e.target.value;
                          setOwnerships(copy);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs text-slate-900 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Total Ownership Accounted For:</span>
              <span
                className={`font-bold ${
                  ownerships.reduce((sum, o) => sum + Number(o.ownershipPercentage || 0), 0) === 100
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {ownerships.reduce((sum, o) => sum + Number(o.ownershipPercentage || 0), 0)}%
              </span>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(3)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={saving || isLocked}
                onClick={handleSaveOwnership}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50"
              >
                {saving ? <span>Saving...</span> : <span>Save & Continue to Intent</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: TRANSACTION INTENT */}
        {activeStep === 5 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1557A6]">05 — Transaction Intent & Requirements</h2>
              <p className="text-xs text-slate-600 mt-1">
                Define the commercial objectives of your exit, equity dilution, or strategic alliance.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Transaction Types Sought (Select one or more) *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { val: "FULL_SALE", label: "100% Full Sale (Complete Exit)" },
                    { val: "PARTIAL_STAKE_SALE", label: "Partial Stake Sale" },
                    { val: "INVESTMENT", label: "Growth Capital Investment" },
                    { val: "JOINT_VENTURE", label: "Joint Venture Alliance" },
                    { val: "STRATEGIC_PARTNERSHIP", label: "Strategic Partnership" },
                    { val: "ASSET_SALE", label: "Sale of Asset / Factory" },
                  ].map((t) => (
                    <label
                      key={t.val}
                      className={`p-3 border rounded-lg text-xs flex items-center gap-2 cursor-pointer transition-colors ${
                        intent.intents.includes(t.val)
                          ? "border-[#1557A6] bg-[#EEF5FB] text-slate-900 font-semibold"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={intent.intents.includes(t.val)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setIntent({ ...intent, intents: [...intent.intents, t.val] });
                          } else {
                            if (intent.intents.length === 1) return;
                            setIntent({
                              ...intent,
                              intents: intent.intents.filter((i) => i !== t.val),
                            });
                          }
                        }}
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Stake Offered (% Equity)
                  </label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={intent.stakeOfferedPercentage}
                    onChange={(e) =>
                      setIntent({ ...intent, stakeOfferedPercentage: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Enterprise Valuation (₹)
                  </label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={intent.expectedValuation}
                    onChange={(e) =>
                      setIntent({ ...intent, expectedValuation: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expected Consideration / Transaction Value (₹)
                  </label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={intent.expectedTransactionValue}
                    onChange={(e) =>
                      setIntent({
                        ...intent,
                        expectedTransactionValue: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Transaction / Exit Vision
                </label>
                <textarea
                  rows={3}
                  disabled={isLocked}
                  value={intent.reasonForTransaction}
                  onChange={(e) => setIntent({ ...intent, reasonForTransaction: e.target.value })}
                  placeholder="e.g. Promoter retirement, desire to unlock growth capital, succession planning..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(4)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                disabled={saving || isLocked}
                onClick={handleSaveIntent}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50"
              >
                {saving ? <span>Saving...</span> : <span>Save & Continue to Documents</span>}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: DOCUMENTS VAULT */}
        {activeStep === 6 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1557A6]">06 — Private Document Vault</h2>
              <p className="text-xs text-slate-600 mt-1">
                Upload verified statutory and financial records. Files are encrypted, magic-byte validated, and kept strictly private.
              </p>
            </div>

            {/* Upload Control */}
            {!isLocked && (
              <div className="p-5 border-2 border-dashed border-slate-300 rounded-xl bg-[#F7F9FC] space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="w-full sm:w-1/3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Document Category</label>
                    <select
                      value={uploadDocType}
                      onChange={(e) => setUploadDocType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-xs text-slate-900 bg-white"
                    >
                      <option value="AUDITED_FINANCIALS">Audited Balance Sheet & P&L (PDF)</option>
                      <option value="ITR_ACKNOWLEDGEMENT">ITR Acknowledgement (PDF)</option>
                      <option value="FORM_26AS">Form 26AS (PDF)</option>
                      <option value="INCORPORATION_CERT">Certificate of Incorporation</option>
                      <option value="GST_REGISTRATION">GST Registration Certificate</option>
                      <option value="PAN_CARD">Company PAN Card</option>
                      <option value="SHAREHOLDING_PATTERN">Shareholding Pattern / Cap Table</option>
                      <option value="REGULATORY_APPROVAL">Regulatory Approvals / Licenses</option>
                      <option value="OTHER">Other Supporting Record</option>
                    </select>
                  </div>

                  <div className="w-full sm:w-2/3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Choose PDF / PNG / JPEG (Max 15MB)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        disabled={isUploading}
                        onChange={handleUploadFile}
                        className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1557A6] file:text-white hover:file:bg-[#104789] cursor-pointer"
                      />
                      {isUploading && <Loader2 className="w-4 h-4 animate-spin text-[#1557A6]" />}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Uploaded Documents List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Uploaded Records ({dossier?.documents.length || 0})
              </h3>
              {dossier?.documents.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-100">
                  No documents uploaded yet. Please upload your audited financials and tax acknowledgements.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {dossier?.documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-white flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <FileCheck className="w-5 h-5 text-[#1557A6]" />
                        <div>
                          <span className="font-semibold text-slate-800 block">
                            {doc.originalFilename}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {doc.documentType} • {(doc.fileSizeBytes / 1024 / 1024).toFixed(2)} MB • {doc.verificationStatus}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <a
                          href={`/api/v1/seller/documents/${doc.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#1557A6] hover:underline font-semibold"
                        >
                          View
                        </a>
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(5)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStep(7)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow"
              >
                <span>Proceed to Review & Submit</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: REVIEW & SUBMIT */}
        {activeStep === 7 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-[#1557A6]">07 — Review & Submit for Verification</h2>
              <p className="text-xs text-slate-600 mt-1">
                Please review your business profile, cap table, and financials prior to final submission.
              </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-[#F7F9FC] rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-[#1557A6] block text-[11px] uppercase tracking-wider">
                  Business Entity
                </span>
                <div className="space-y-1">
                  <div><strong>Legal Name:</strong> {business.legalName || "Not specified"}</div>
                  <div><strong>Type:</strong> {business.businessType}</div>
                  <div><strong>Industry:</strong> {business.industry}</div>
                  <div><strong>Location:</strong> {business.registeredCity}, {business.registeredState}</div>
                  <div><strong>Employees:</strong> {business.employeeCount}</div>
                </div>
              </div>

              <div className="p-4 bg-[#F7F9FC] rounded-lg border border-slate-200 space-y-2">
                <span className="font-bold text-[#1557A6] block text-[11px] uppercase tracking-wider">
                  Transaction & Intent
                </span>
                <div className="space-y-1">
                  <div><strong>Intents:</strong> {intent.intents.join(", ")}</div>
                  <div><strong>Stake Offered:</strong> {intent.stakeOfferedPercentage}%</div>
                  <div><strong>Expected Valuation:</strong> ₹{Number(intent.expectedValuation).toLocaleString("en-IN")}</div>
                  <div><strong>Timeline:</strong> {intent.preferredTimeline}</div>
                </div>
              </div>
            </div>

            {/* Statutory Declaration */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#1557A6] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Promoter Statutory Declaration:</strong> I hereby confirm that the information provided in this dossier is true, complete, and accurate as per audited statutory books of accounts. Scale-up India facilitates trusted matchmaking and transaction execution but is not responsible for any promoter misstatements.
                </p>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveStep(6)}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              {isLocked ? (
                <div className="text-xs text-blue-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                  <span>Dossier Submitted & Under Review</span>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSubmitDossier}
                  className="flex items-center gap-2 px-8 py-3 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow-lg disabled:opacity-50"
                >
                  {saving ? <span>Submitting...</span> : <span>Submit for Administrative Verification</span>}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
