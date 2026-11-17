"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Building2,
  ShieldCheck,
  DollarSign,
  Target,
  Globe,
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
  Lock,
  Plus,
  Briefcase,
  Users,
  RefreshCw,
  X,
  MapPin,
  Clock,
} from "lucide-react";
import {
  BuyerDossier,
  BuyerType,
  EntityType,
  TransactionType,
  ControlPreference,
  InvestmentHorizon,
  FundingSource,
  RegionType,
  BuyerDocumentType,
  AcquisitionMandateRecord,
} from "@/types/buyer";

const STEPS = [
  { id: 1, label: "Persona", title: "Investor Persona & Type" },
  { id: 2, label: "Organization", title: "Organization & Entity Profile" },
  { id: 3, label: "Representative", title: "Authorized Contact Person" },
  { id: 4, label: "Mandates", title: "Acquisition & Investment Mandates" },
  { id: 5, label: "Documents", title: "Verification Document Vault" },
  { id: 6, label: "Review & Submit", title: "Review & Verification Submission" },
];

const INDUSTRY_TAXONOMY: Record<string, string[]> = {
  Manufacturing: ["Industrial Machinery", "Automotive Components", "Packaging", "Plastics", "Chemicals"],
  Technology: ["SaaS", "Enterprise Software", "AI & ML", "Cybersecurity", "FinTech", "EdTech"],
  Healthcare: ["Hospitals & Clinics", "Pharma Formulation", "Medical Devices", "Diagnostics", "HealthTech"],
  "Consumer & Retail": ["FMCG", "Direct-to-Consumer (D2C)", "Apparel & Textiles", "Food Processing", "Retail Chains"],
  "Logistics & Infrastructure": ["Warehousing", "Cold Chain", "Freight Forwarding", "Renewable Energy", "EPC"],
  Services: ["BPO & IT Services", "Financial Services", "Consulting", "Real Estate"],
};

export default function BuyerOnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<BuyerDossier | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states: Organization & Persona
  const [buyerType, setBuyerType] = useState<BuyerType>("CORPORATE_BUYER");
  const [entityType, setEntityType] = useState<EntityType>("COMPANY");
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [country, setCountry] = useState("India");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [website, setWebsite] = useState("");
  const [yearEstablished, setYearEstablished] = useState<number | "">(2015);
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");

  // Fund Metrics
  const [fundSize, setFundSize] = useState<number | "">("");
  const [aum, setAum] = useState<number | "">("");
  const [currentVintage, setCurrentVintage] = useState<number | "">("");
  const [typicalTicketSize, setTypicalTicketSize] = useState<number | "">("");

  // Contact Person
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("Director / Investment Lead");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredCommMethod, setPreferredCommMethod] = useState<"IN_APP" | "EMAIL" | "PHONE" | "WHATSAPP">("IN_APP");

  // Mandates List
  const [mandates, setMandates] = useState<AcquisitionMandateRecord[]>([]);

  // Mandate Modal Form State
  const [isMandateModalOpen, setIsMandateModalOpen] = useState(false);
  const [editingMandateId, setEditingMandateId] = useState<string | null>(null);
  const [mandateName, setMandateName] = useState("");
  const [mandateDescription, setMandateDescription] = useState("");
  const [minInvestment, setMinInvestment] = useState<number>(10000000); // 1 Cr
  const [maxInvestment, setMaxInvestment] = useState<number>(50000000); // 5 Cr
  const [preferredTicketSize, setPreferredTicketSize] = useState<number | "">("");
  const [availableCapital, setAvailableCapital] = useState<number | "">("");
  const [revenueMin, setRevenueMin] = useState<number>(50000000); // 5 Cr
  const [revenueMax, setRevenueMax] = useState<number | "">("");
  const [ebitdaMin, setEbitdaMin] = useState<number | "">("");
  const [ebitdaMax, setEbitdaMax] = useState<number | "">("");
  const [employeeMin, setEmployeeMin] = useState<number>(10);
  const [employeeMax, setEmployeeMax] = useState<number | "">("");
  const [selectedTransactionTypes, setSelectedTransactionTypes] = useState<TransactionType[]>([
    "FULL_ACQUISITION",
    "MAJORITY_STAKE",
  ]);
  const [controlPreference, setControlPreference] = useState<ControlPreference>("MAJORITY_CONTROL");
  const [selectedStrategicObjectives, setSelectedStrategicObjectives] = useState<string[]>([
    "MARKET_EXPANSION",
    "GEOGRAPHIC_EXPANSION",
  ]);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(["Manufacturing"]);
  const [selectedSubSectors, setSelectedSubSectors] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionType>("PAN_INDIA");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [investmentHorizon, setInvestmentHorizon] = useState<InvestmentHorizon>("MEDIUM_TERM");
  const [fundingSource, setFundingSource] = useState<FundingSource>("OWN_CAPITAL");
  const [profitableOnly, setProfitableOnly] = useState(true);
  const [growthStage, setGrowthStage] = useState(true);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<BuyerDocumentType>("COMPANY_REGISTRATION");

  // Load Dossier
  const loadDossier = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/buyer/profile");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load buyer dossier.");

      const d: BuyerDossier = json.data.dossier;
      setDossier(d);

      if (d.profile) {
        setBuyerType(d.profile.buyerType);
        setEntityType(d.profile.entityType);
        setLegalName(d.profile.legalName === "Pending Organization Details" ? "" : d.profile.legalName);
        setTradeName(d.profile.tradeName || "");
        setRegistrationNumber(d.profile.registrationNumber || "");
        setCountry(d.profile.country || "India");
        setState(d.profile.state === "Not Specified" ? "" : d.profile.state);
        setCity(d.profile.city === "Not Specified" ? "" : d.profile.city);
        setWebsite(d.profile.website || "");
        setYearEstablished(d.profile.yearEstablished || "");
        setIndustry(d.profile.industry || "");
        setDescription(d.profile.description || "");
        setFundSize(d.profile.fundSize || "");
        setAum(d.profile.aum || "");
        setCurrentVintage(d.profile.currentVintage || "");
        setTypicalTicketSize(d.profile.typicalTicketSize || "");
        setContactName(d.profile.contactName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim());
        setDesignation(d.profile.designation || "Director / Investment Lead");
        setEmail(d.profile.email || user?.email || "");
        setPhone(d.profile.phone || user?.phone || "");
        setPreferredCommMethod(d.profile.preferredCommMethod || "IN_APP");
      }

      setMandates(d.mandates || []);
      setDocuments(d.documents || []);

      if (d.lastActiveStep && d.lastActiveStep >= 1 && d.lastActiveStep <= 6) {
        setCurrentStep(d.lastActiveStep);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load buyer dossier.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDossier();
  }, [loadDossier]);

  // Draft autosave
  const handleSaveDraft = async () => {
    setSaveStatus("saving");
    try {
      await fetch("/api/v1/buyer/onboarding/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastActiveStep: currentStep,
          draftPayload: {
            buyerType,
            entityType,
            legalName,
            tradeName,
            registrationNumber,
            state,
            city,
            website,
            yearEstablished,
            industry,
            description,
            fundSize,
            aum,
            contactName,
            designation,
            email,
            phone,
            preferredCommMethod,
          },
        }),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
    }
  };

  // Profile Save
  const handleSaveProfile = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const payload = {
        buyerType,
        entityType,
        legalName: legalName.trim(),
        tradeName: tradeName.trim() || undefined,
        registrationNumber: registrationNumber.trim() || undefined,
        country,
        state: state.trim(),
        city: city.trim(),
        website: website.trim() || undefined,
        yearEstablished: yearEstablished ? Number(yearEstablished) : undefined,
        industry: industry.trim() || undefined,
        description: description.trim() || undefined,
        fundSize: fundSize ? Number(fundSize) : undefined,
        aum: aum ? Number(aum) : undefined,
        currentVintage: currentVintage ? Number(currentVintage) : undefined,
        typicalTicketSize: typicalTicketSize ? Number(typicalTicketSize) : undefined,
        contactName: contactName.trim(),
        designation: designation.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredCommMethod,
      };

      const res = await fetch("/api/v1/buyer/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save profile.");

      setSuccessMessage("Buyer profile details saved successfully.");
      await loadDossier();
      return true;
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to save profile.");
      return false;
    }
  };

  // Create or Update Mandate
  const handleSaveMandate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (!mandateName.trim()) {
        throw new Error("Mandate name is required.");
      }
      if (Number(minInvestment) > Number(maxInvestment)) {
        throw new Error("Minimum investment cannot exceed maximum investment.");
      }
      if (selectedIndustries.length === 0) {
        throw new Error("Please select at least one target industry.");
      }

      const payload = {
        name: mandateName.trim(),
        description: mandateDescription.trim() || undefined,
        minInvestment: Number(minInvestment),
        maxInvestment: Number(maxInvestment),
        preferredTicketSize: preferredTicketSize ? Number(preferredTicketSize) : undefined,
        availableCapital: availableCapital ? Number(availableCapital) : undefined,
        revenueMin: Number(revenueMin || 0),
        revenueMax: revenueMax ? Number(revenueMax) : undefined,
        ebitdaMin: ebitdaMin !== "" ? Number(ebitdaMin) : undefined,
        ebitdaMax: ebitdaMax !== "" ? Number(ebitdaMax) : undefined,
        employeeMin: Number(employeeMin || 0),
        employeeMax: employeeMax ? Number(employeeMax) : undefined,
        transactionTypes: selectedTransactionTypes,
        controlPreference,
        strategicObjectives: selectedStrategicObjectives,
        investmentHorizon,
        fundingSource,
        profitableBusinessesOnly: profitableOnly,
        growthStage,
        targetIndustries: selectedIndustries.map((ind) => ({
          industry: ind,
          subSectors: selectedSubSectors,
        })),
        targetGeographies: [
          {
            region: selectedRegion,
            countries: ["India"],
            states: selectedStates,
          },
        ],
      };

      let res;
      if (editingMandateId) {
        res = await fetch(`/api/v1/buyer/mandates/${editingMandateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/v1/buyer/mandates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to save mandate.");

      setIsMandateModalOpen(false);
      setEditingMandateId(null);
      await loadDossier();
    } catch (err: any) {
      alert(`Mandate validation error: ${err.message}`);
    }
  };

  // Delete Mandate
  const handleDeleteMandate = async (mandateId: string) => {
    if (!confirm("Are you sure you want to archive this acquisition mandate?")) return;
    try {
      const res = await fetch(`/api/v1/buyer/mandates/${mandateId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to delete mandate.");
      await loadDossier();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Document Upload
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDoc(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", selectedDocType);

      const res = await fetch("/api/v1/buyer/documents", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to upload document.");

      await loadDossier();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document from your vault?")) return;
    try {
      const res = await fetch(`/api/v1/buyer/documents/${docId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to delete document.");
      await loadDossier();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Submit Dossier
  const handleSubmitDossier = async () => {
    if (!confirm("Are you ready to submit your buyer profile and mandates for verification?")) return;
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/buyer/onboarding/submit", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Submission failed.");

      alert("Your buyer acquisition dossier has been submitted for administrative verification!");
      await loadDossier();
    } catch (err: any) {
      setErrorMessage(err.message || "Submission failed.");
    }
  };

  const isLocked =
    dossier?.profile?.onboardingStatus === "SUBMITTED" ||
    dossier?.profile?.onboardingStatus === "UNDER_REVIEW" ||
    dossier?.profile?.onboardingStatus === "VERIFIED" ||
    dossier?.profile?.onboardingStatus === "SUSPENDED";

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1557A6]" />
        <span className="text-sm font-medium">Loading buyer & investor mandate workspace...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#1557A6] text-white flex items-center justify-center font-bold text-lg shadow">
              <Briefcase className="w-6 h-6 text-[#1557A6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Buyer & Investor Acquisition Mandate Hub
                </h1>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${
                    dossier?.profile?.onboardingStatus === "VERIFIED"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                      : dossier?.profile?.onboardingStatus === "SUBMITTED"
                      ? "bg-amber-50 text-amber-800 border-amber-300"
                      : dossier?.profile?.onboardingStatus === "CHANGES_REQUESTED"
                      ? "bg-purple-50 text-purple-800 border-purple-300"
                      : dossier?.profile?.onboardingStatus === "SUSPENDED"
                      ? "bg-red-50 text-red-800 border-red-300"
                      : "bg-slate-100 text-slate-700 border-slate-200"
                  }`}
                >
                  {dossier?.profile?.onboardingStatus || "DRAFT"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Define your corporate or institutional investment mandates, target financial parameters, and transaction preferences.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && (
              <button
                onClick={handleSaveDraft}
                disabled={saveStatus === "saving"}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Draft"}</span>
              </button>
            )}
            <button
              onClick={() => router.push("/dashboard")}
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition"
            >
              Dashboard
            </button>
          </div>
        </div>

        {/* Changes Requested Banner */}
        {dossier?.profile?.changesRequestedNotes && (
          <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900">
            <strong>Revisions Requested by Review Desk: </strong>
            <p className="mt-1 whitespace-pre-line">{dossier.profile.changesRequestedNotes}</p>
          </div>
        )}

        {/* Lock Banner */}
        {isLocked && (
          <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>
              This acquisition dossier is currently under formal review or verified. Profiles and mandates cannot be directly altered without change authorization.
            </span>
          </div>
        )}

        {/* Progress Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-6 pt-6 border-t border-slate-100">
          {STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              className={`p-2.5 rounded-lg text-left transition ${
                currentStep === s.id
                  ? "bg-[#1557A6] text-white shadow-sm"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Step 0{s.id}</div>
              <div className="text-xs font-semibold truncate mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* STEP 1: Persona */}
      {currentStep === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">01. Investor Persona & Acquirer Type</h2>
            <p className="text-xs text-slate-500 mt-1">Select the classification that represents your buying or investing entity.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { type: "CORPORATE_BUYER", title: "Corporate Acquirer", desc: "Operating enterprise seeking strategic acquisition, product expansion, or vertical integration." },
              { type: "PE_FUND", title: "Private Equity (PE)", desc: "Institutional buyout or growth equity fund targeting majority stakes and control transactions." },
              { type: "VC_FUND", title: "Venture Capital (VC)", desc: "Institutional or syndication fund investing growth or early/late-stage equity." },
              { type: "FAMILY_OFFICE", title: "Family Office", desc: "Private wealth vehicle seeking long-term capital preservation, yield, or strategic business holdings." },
              { type: "STRATEGIC_PARTNER", title: "Strategic Partner / JV", desc: "Enterprise seeking commercial alliances, technology co-development, or distribution JVs." },
              { type: "INDIVIDUAL_INVESTOR", title: "Individual / Angel", desc: "High-net-worth individual, entrepreneur, or executive investing personal capital." },
            ].map((p) => (
              <div
                key={p.type}
                onClick={() => !isLocked && setBuyerType(p.type as any)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  buyerType === p.type
                    ? "border-[#1557A6] bg-[#EEF5FB] shadow-sm ring-1 ring-[#1557A6]"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-slate-900">{p.title}</h3>
                  {buyerType === p.type && <CheckCircle2 className="w-4 h-4 text-[#1557A6]" />}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                handleSaveProfile();
                setCurrentStep(2);
              }}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow transition"
            >
              <span>Next: Organization Details</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Organization */}
      {currentStep === 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">02. Organization / Entity Profile</h2>
            <p className="text-xs text-slate-500 mt-1">Provide statutory and commercial identifiers for your acquiring entity.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Legal Entity Name *</label>
              <input
                type="text"
                disabled={isLocked}
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Apex Strategic Investments Private Limited"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Trade / Brand Name</label>
              <input
                type="text"
                disabled={isLocked}
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="e.g. Apex Capital"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Entity Form *</label>
              <select
                disabled={isLocked}
                value={entityType}
                onChange={(e) => setEntityType(e.target.value as any)}
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6] bg-white"
              >
                <option value="COMPANY">Private / Public Company</option>
                <option value="FUND">Alternative Investment Fund (AIF) / Trust</option>
                <option value="FAMILY_OFFICE">Family Office</option>
                <option value="LLP">Limited Liability Partnership (LLP)</option>
                <option value="INDIVIDUAL">Sole Proprietor / Individual</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">CIN / Reg / SEBI No.</label>
              <input
                type="text"
                disabled={isLocked}
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. U74140DL2018PTC123456"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">State / Province *</label>
              <input
                type="text"
                disabled={isLocked}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">City *</label>
              <input
                type="text"
                disabled={isLocked}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Mumbai"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Website</label>
              <input
                type="text"
                disabled={isLocked}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://apexcapital.com"
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Year Established</label>
              <input
                type="number"
                disabled={isLocked}
                value={yearEstablished}
                onChange={(e) => setYearEstablished(e.target.value ? Number(e.target.value) : "")}
                className="w-full p-2.5 rounded-md border border-slate-300 focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>
          </div>

          {/* Fund Details if Fund or Family Office */}
          {(buyerType === "PE_FUND" || buyerType === "VC_FUND" || buyerType === "FAMILY_OFFICE") && (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <h3 className="text-xs font-bold text-[#1557A6] uppercase tracking-wider">Fund & Asset Scale Metrics</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">AUM (₹)</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={aum}
                    onChange={(e) => setAum(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 5000000000 (₹500 Cr)"
                    className="w-full p-2.5 rounded-md border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Current Fund Size (₹)</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={fundSize}
                    onChange={(e) => setFundSize(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 1500000000 (₹150 Cr)"
                    className="w-full p-2.5 rounded-md border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[10px] mb-1">Current Fund Vintage</label>
                  <input
                    type="number"
                    disabled={isLocked}
                    value={currentVintage}
                    onChange={(e) => setCurrentVintage(e.target.value ? Number(e.target.value) : "")}
                    placeholder="e.g. 2022"
                    className="w-full p-2.5 rounded-md border border-slate-300"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(1)}
              className="flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={async () => {
                const ok = await handleSaveProfile();
                if (ok) setCurrentStep(3);
              }}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow transition"
            >
              <span>Next: Contact Representative</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Representative */}
      {currentStep === 3 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">03. Authorized Representative & Deal Contact</h2>
            <p className="text-xs text-slate-500 mt-1">Designate the investment lead responsible for evaluating matched opportunities.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Full Name *</label>
              <input
                type="text"
                disabled={isLocked}
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full p-2.5 rounded-md border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Designation *</label>
              <input
                type="text"
                disabled={isLocked}
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="w-full p-2.5 rounded-md border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Official Email *</label>
              <input
                type="email"
                disabled={isLocked}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded-md border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Direct Mobile Phone *</label>
              <input
                type="text"
                disabled={isLocked}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 rounded-md border border-slate-300"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Preferred Channel</label>
              <select
                disabled={isLocked}
                value={preferredCommMethod}
                onChange={(e) => setPreferredCommMethod(e.target.value as any)}
                className="w-full p-2.5 rounded-md border border-slate-300 bg-white"
              >
                <option value="IN_APP">In-App Secure Deal Desk</option>
                <option value="EMAIL">Encrypted Email</option>
                <option value="PHONE">Direct Telephone</option>
                <option value="WHATSAPP">WhatsApp Verified</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={async () => {
                const ok = await handleSaveProfile();
                if (ok) setCurrentStep(4);
              }}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow transition"
            >
              <span>Next: Acquisition Mandates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Mandates */}
      {currentStep === 4 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">04. Acquisition & Investment Mandates</h2>
              <p className="text-xs text-slate-500 mt-1">
                You can create multiple independent mandates for different sectors, deal sizes, or geographies.
              </p>
            </div>
            {!isLocked && (
              <button
                onClick={() => {
                  setEditingMandateId(null);
                  setMandateName("");
                  setMandateDescription("");
                  setMinInvestment(10000000);
                  setMaxInvestment(50000000);
                  setIsMandateModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Mandate</span>
              </button>
            )}
          </div>

          {mandates.length === 0 ? (
            <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-3">
              <Target className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">No Acquisition Mandates Created Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Define at least one investment mandate detailing your target ticket size, industries, and transaction preferences to enable matching.
              </p>
              {!isLocked && (
                <button
                  onClick={() => setIsMandateModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg shadow hover:bg-[#104789] transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add First Mandate</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mandates.map((m) => (
                <div key={m.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                      <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {m.status}
                      </span>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => handleDeleteMandate(m.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Archive Mandate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Investment Range</span>
                      <span className="font-mono font-bold text-slate-800">
                        ₹{(m.minInvestment / 10000000).toFixed(1)}Cr – ₹{(m.maxInvestment / 10000000).toFixed(1)}Cr
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block uppercase">Control Preference</span>
                      <span className="font-medium text-slate-700">{m.controlPreference.replace(/_/g, " ")}</span>
                    </div>
                  </div>

                  {m.targetIndustries && m.targetIndustries.length > 0 && (
                    <div className="text-xs pt-1">
                      <span className="text-slate-400 text-[10px] block uppercase">Target Industries</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.targetIndustries.map((ind, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[#EEF5FB] text-[#1557A6] rounded text-[10px] font-semibold">
                            {ind.industry}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(3)}
              className="flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              disabled={mandates.length === 0}
              onClick={() => setCurrentStep(5)}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow disabled:opacity-50 transition"
            >
              <span>Next: Upload Documents</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Documents */}
      {currentStep === 5 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">05. Private Document Vault</h2>
            <p className="text-xs text-slate-500 mt-1">
              Upload credentials such as certificate of incorporation, fund registration, or proof of capital. All files are inspected for true magic bytes and stored in an anti-tamper vault.
            </p>
          </div>

          {!isLocked && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Document Category</label>
                  <select
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value as any)}
                    className="w-full p-2 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="COMPANY_REGISTRATION">Certificate of Incorporation / Reg</option>
                    <option value="FUND_PROFILE">Fund Deck / Mandate Profile</option>
                    <option value="AUTHORIZATION_LETTER">Board / Partner Authorization Letter</option>
                    <option value="PROOF_OF_FUNDS">Proof of Funds / Bank Solvency</option>
                    <option value="CORPORATE_PROFILE">Corporate Overview & Past Deals</option>
                    <option value="OTHER">Other Diligence Record</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Select File (PDF, PNG, JPEG up to 15MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    disabled={uploadingDoc}
                    onChange={handleUploadDocument}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1557A6] file:text-white hover:file:bg-[#104789]"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Uploaded Documents List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Vault Files ({documents.length})</h3>
            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No documents uploaded into the buyer vault yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#1557A6]" />
                        <span>{doc.originalFilename}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB • SHA-256: {doc.checksumSha256.slice(0, 10)}...
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/v1/buyer/documents/${doc.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 text-xs font-semibold text-[#1557A6] bg-[#EEF5FB] hover:bg-[#EEF5FB] rounded transition"
                      >
                        View
                      </a>
                      {!isLocked && (
                        <button
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition"
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
              onClick={() => setCurrentStep(4)}
              className="flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              onClick={() => setCurrentStep(6)}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow transition"
            >
              <span>Next: Review & Submit</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: Review & Submit */}
      {currentStep === 6 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-base font-bold text-slate-900">06. Review & Submit for Verification</h2>
            <p className="text-xs text-slate-500 mt-1">
              Verify your organizational identity and active acquisition mandates before dispatching to the Scale-up India internal diligence desk.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#1557A6] uppercase tracking-wider block">Acquiring Entity</span>
              <div className="font-bold text-sm text-slate-900">{legalName || "Untitled Entity"}</div>
              <div className="text-slate-600">{buyerType.replace(/_/g, " ")} • {entityType}</div>
              <div className="text-slate-500">{city}, {state}, {country}</div>
              <div className="text-slate-500">Rep: {contactName} ({designation}) • {email}</div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2">
              <span className="text-[10px] font-bold text-[#1557A6] uppercase tracking-wider block">Mandate Summary</span>
              <div className="font-bold text-sm text-slate-900">{mandates.length} Active Mandates Lodged</div>
              <div className="text-slate-600">Documents in Vault: {documents.length}</div>
              <div className="text-slate-500">Current Status: {dossier?.profile?.onboardingStatus}</div>
            </div>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 text-xs text-emerald-950 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Confidentiality & Anti-Circumvention Commitment</span>
            </div>
            <p className="text-[11px] leading-relaxed text-emerald-900">
              By submitting this acquisition mandate, you confirm that your organization has valid investment capacity, authorized decision-making representation, and agrees to evaluate opportunities strictly within Scale-up India’s confidentiality agreements.
            </p>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(5)}
              className="flex items-center gap-1.5 px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-semibold rounded-md transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            {!isLocked && (
              <button
                onClick={handleSubmitDossier}
                className="flex items-center gap-1.5 px-8 py-3 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow-md hover:shadow-lg transition"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Submit for Verification</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CREATE / EDIT MANDATE MODAL */}
      {isMandateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[#1557A6]" />
                <h3 className="text-sm font-bold text-slate-900">Define Acquisition Mandate</h3>
              </div>
              <button onClick={() => setIsMandateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMandate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Mandate Title *</label>
                <input
                  type="text"
                  required
                  value={mandateName}
                  onChange={(e) => setMandateName(e.target.value)}
                  placeholder="e.g. ₹10Cr–₹50Cr Precision Engineering Acquisition"
                  className="w-full p-2.5 rounded-md border border-slate-300"
                />
              </div>

              {/* Financial Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Min Investment (₹) *</label>
                  <input
                    type="number"
                    required
                    value={minInvestment}
                    onChange={(e) => setMinInvestment(Number(e.target.value))}
                    className="w-full p-2.5 rounded-md border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Max Investment (₹) *</label>
                  <input
                    type="number"
                    required
                    value={maxInvestment}
                    onChange={(e) => setMaxInvestment(Number(e.target.value))}
                    className="w-full p-2.5 rounded-md border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Target Business Revenue Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Target Revenue Min (₹)</label>
                  <input
                    type="number"
                    value={revenueMin}
                    onChange={(e) => setRevenueMin(Number(e.target.value))}
                    className="w-full p-2.5 rounded-md border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Target Revenue Max (₹)</label>
                  <input
                    type="number"
                    value={revenueMax}
                    onChange={(e) => setRevenueMax(e.target.value ? Number(e.target.value) : "")}
                    className="w-full p-2.5 rounded-md border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {/* Governance & Control */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Control Preference</label>
                  <select
                    value={controlPreference}
                    onChange={(e) => setControlPreference(e.target.value as any)}
                    className="w-full p-2.5 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="FULL_CONTROL">Full Control (100% Buyout)</option>
                    <option value="MAJORITY_CONTROL">Majority Control (&gt;51%)</option>
                    <option value="JOINT_CONTROL">Joint Control (50:50)</option>
                    <option value="MINORITY">Significant Minority (26%–49%)</option>
                    <option value="NO_CONTROL_FINANCIAL">Passive / Financial Investment</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Funding Source</label>
                  <select
                    value={fundingSource}
                    onChange={(e) => setFundingSource(e.target.value as any)}
                    className="w-full p-2.5 rounded-md border border-slate-300 bg-white"
                  >
                    <option value="OWN_CAPITAL">Internal Accruals / Own Balance Sheet</option>
                    <option value="FUND_CAPITAL">Committed Fund Capital</option>
                    <option value="BANK_DEBT">Debt / Acquisition Financing</option>
                    <option value="CO_INVESTMENT">Co-Investment / Consortium</option>
                  </select>
                </div>
              </div>

              {/* Target Industries */}
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Target Sectors</label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(INDUSTRY_TAXONOMY).map((ind) => (
                    <button
                      key={ind}
                      type="button"
                      onClick={() => {
                        if (selectedIndustries.includes(ind)) {
                          setSelectedIndustries(selectedIndustries.filter((i) => i !== ind));
                        } else {
                          setSelectedIndustries([...selectedIndustries, ind]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                        selectedIndustries.includes(ind)
                          ? "bg-[#1557A6] text-white border-[#1557A6]"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>

              {/* Geography */}
              <div>
                <label className="block font-bold text-slate-700 uppercase text-[11px] mb-1">Target Geography</label>
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value as any)}
                  className="w-full p-2.5 rounded-md border border-slate-300 bg-white"
                >
                  <option value="PAN_INDIA">Pan India</option>
                  <option value="NORTH_INDIA">North India</option>
                  <option value="SOUTH_INDIA">South India</option>
                  <option value="WEST_INDIA">West India</option>
                  <option value="EAST_INDIA">East India</option>
                  <option value="GLOBAL">Global / Overseas</option>
                </select>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={profitableOnly}
                    onChange={(e) => setProfitableOnly(e.target.checked)}
                    className="rounded text-[#1557A6]"
                  />
                  <span>Profitable Entities Only</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={growthStage}
                    onChange={(e) => setGrowthStage(e.target.checked)}
                    className="rounded text-[#1557A6]"
                  />
                  <span>Growth-Stage Scaling</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMandateModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-md transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#1557A6] hover:bg-[#104789] text-white font-semibold rounded-md shadow transition"
                >
                  Save Mandate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

