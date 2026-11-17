"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Trash2,
  Download,
  Send,
  Eye,
  Sparkles,
} from "lucide-react";
import {
  OpportunityRecord,
  OpportunityStatus,
  OpportunityDocumentType,
  OpportunityDocumentSummary,
  BusinessCategory,
  OperatingRegion,
  BusinessAgeBracket,
  RevenueBracket,
  EbitdaMarginBracket,
  AskingPriceBracket,
  OpportunityTransactionType,
  BusinessModel,
  EmployeeRange,
  GrowthRateBracket,
} from "@/types/opportunity";

export default function EditOpportunityPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Opportunity Record
  const [opp, setOpp] = useState<OpportunityRecord | null>(null);
  const [documents, setDocuments] = useState<OpportunityDocumentSummary[]>([]);

  // Form Fields
  const [formData, setFormData] = useState({
    title: "",
    headline: "",
    teaserSummary: "",
    detailedDescription: "",
    industry: "",
    registeredState: "Delhi",
    registeredCity: "",
    businessCategory: BusinessCategory.MANUFACTURING as BusinessCategory,
    operatingRegion: OperatingRegion.NORTH_INDIA as OperatingRegion,
    approximateAgeBracket: BusinessAgeBracket.LESS_THAN_3_YRS as BusinessAgeBracket,
    transactionType: OpportunityTransactionType.FULL_ACQUISITION as OpportunityTransactionType,
    businessModel: BusinessModel.B2B as BusinessModel,
    revenueBracket: RevenueBracket.CR_15_TO_25 as RevenueBracket,
    ebitdaMarginBracket: EbitdaMarginBracket.PCT_10_TO_20 as EbitdaMarginBracket,
    askingPriceBracket: AskingPriceBracket.CR_10_TO_25 as AskingPriceBracket,
    employeeRange: EmployeeRange.EMP_51_TO_200 as EmployeeRange,
    growthRateBracket: GrowthRateBracket.PCT_10_TO_25 as GrowthRateBracket,
    yearEstablished: 2015,
    customerScale: "",
    facilityDetails: "",
    stakeOfferedPercentage: 100,
    promoterRetentionPreference: "",
    reasonForSale: "",
    transactionObjective: "",
    exactLegalName: "",
    exactTradeName: "",
    exactCin: "",
    exactGstin: "",
    exactPan: "",
    exactAddress: "",
    exactRevenue: "",
    exactEbitda: "",
    exactAskingPrice: "",
  });

  // Upload Form State
  const [selectedDocType, setSelectedDocType] = useState<OpportunityDocumentType>(
    OpportunityDocumentType.TEASER_DECK
  );
  const [docFile, setDocFile] = useState<File | null>(null);

  const fetchOpportunity = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/seller/opportunities/${opportunityId}`);
      const json = await res.json();
      if (json.success) {
        const o: OpportunityRecord = json.data.opportunity;
        setOpp(o);
        setDocuments(json.data.documents || []);

        setFormData({
          title: o.title,
          headline: o.headline || "",
          teaserSummary: o.teaserSummary,
          detailedDescription: o.detailedDescription || "",
          industry: o.industry,
          registeredState: o.registeredState || "Delhi",
          registeredCity: o.registeredCity || "",
          businessCategory: o.businessCategory,
          operatingRegion: o.operatingRegion,
          approximateAgeBracket: o.approximateAgeBracket || BusinessAgeBracket.LESS_THAN_3_YRS,
          transactionType: o.transactionType,
          businessModel: o.businessModel,
          revenueBracket: o.revenueBracket,
          ebitdaMarginBracket: o.ebitdaMarginBracket || EbitdaMarginBracket.PCT_10_TO_20,
          askingPriceBracket: o.askingPriceBracket || AskingPriceBracket.CR_10_TO_25,
          employeeRange: o.employeeRange || EmployeeRange.EMP_51_TO_200,
          growthRateBracket: o.growthRateBracket || GrowthRateBracket.PCT_10_TO_25,
          yearEstablished: o.yearEstablished || 2015,
          customerScale: o.customerScale || "",
          facilityDetails: o.facilityDetails || "",
          stakeOfferedPercentage: o.stakeOfferedPercentage || 100,
          promoterRetentionPreference: o.promoterRetentionPreference || "",
          reasonForSale: o.reasonForSale || "",
          transactionObjective: o.transactionObjective || "",
          exactLegalName: o.exactLegalName || "",
          exactTradeName: o.exactTradeName || "",
          exactCin: o.exactCin || "",
          exactGstin: o.exactGstin || "",
          exactPan: o.exactPan || "",
          exactAddress: o.exactAddress || "",
          exactRevenue: o.exactRevenue ? o.exactRevenue.toString() : "",
          exactEbitda: o.exactEbitda ? o.exactEbitda.toString() : "",
          exactAskingPrice: o.exactAskingPrice ? o.exactAskingPrice.toString() : "",
        });
      } else {
        setError(json.error?.message || "Failed to load opportunity");
      }
    } catch {
      setError("Network error while retrieving opportunity.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        headline: formData.headline || undefined,
        teaserSummary: formData.teaserSummary,
        detailedDescription: formData.detailedDescription || undefined,
        industry: formData.industry,
        registeredState: formData.registeredState,
        registeredCity: formData.registeredCity || undefined,
        businessCategory: formData.businessCategory,
        operatingRegion: formData.operatingRegion,
        approximateAgeBracket: formData.approximateAgeBracket,
        transactionType: formData.transactionType,
        businessModel: formData.businessModel,
        revenueBracket: formData.revenueBracket,
        ebitdaMarginBracket: formData.ebitdaMarginBracket || undefined,
        askingPriceBracket: formData.askingPriceBracket || undefined,
        employeeRange: formData.employeeRange || undefined,
        growthRateBracket: formData.growthRateBracket || undefined,
        yearEstablished: formData.yearEstablished ? Number(formData.yearEstablished) : undefined,
        customerScale: formData.customerScale || undefined,
        facilityDetails: formData.facilityDetails || undefined,
        stakeOfferedPercentage: formData.stakeOfferedPercentage
          ? Number(formData.stakeOfferedPercentage)
          : undefined,
        promoterRetentionPreference: formData.promoterRetentionPreference || undefined,
        reasonForSale: formData.reasonForSale || undefined,
        transactionObjective: formData.transactionObjective || undefined,
        exactLegalName: formData.exactLegalName || undefined,
        exactTradeName: formData.exactTradeName || undefined,
        exactCin: formData.exactCin || undefined,
        exactGstin: formData.exactGstin || undefined,
        exactPan: formData.exactPan || undefined,
        exactAddress: formData.exactAddress || undefined,
        exactRevenue: formData.exactRevenue ? Number(formData.exactRevenue) : undefined,
        exactEbitda: formData.exactEbitda ? Number(formData.exactEbitda) : undefined,
        exactAskingPrice: formData.exactAskingPrice ? Number(formData.exactAskingPrice) : undefined,
      };

      const res = await fetch(`/api/v1/seller/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Opportunity draft updated successfully.");
        await fetchOpportunity();
      } else {
        setError(json.error?.message || "Failed to update draft");
      }
    } catch {
      setError("Network error while saving draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (
      !confirm(
        "Are you sure you want to submit this opportunity for Scale-up India administrative verification? The listing will be locked from further edits during review."
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/v1/seller/opportunities/${opportunityId}/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setSuccess("Opportunity successfully submitted for platform verification.");
        await fetchOpportunity();
      } else {
        setError(json.error?.message || "Failed to submit opportunity");
      }
    } catch {
      setError("Network error during submission.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile) return;

    setUploadingDoc(true);
    setError(null);
    setSuccess(null);
    try {
      const data = new FormData();
      data.append("file", docFile);
      data.append("documentType", selectedDocType);

      const res = await fetch(`/api/v1/seller/opportunities/${opportunityId}/documents`, {
        method: "POST",
        body: data,
      });

      const json = await res.json();
      if (json.success) {
        setSuccess("Document uploaded securely to opportunity vault.");
        setDocFile(null);
        await fetchOpportunity();
      } else {
        setError(json.error?.message || "Failed to upload document");
      }
    } catch {
      setError("Network error while uploading document.");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document from the vault?")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(
        `/api/v1/seller/opportunities/${opportunityId}/documents/${docId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setSuccess("Document deleted successfully.");
        await fetchOpportunity();
      } else {
        setError(json.error?.message || "Failed to delete document");
      }
    } catch {
      setError("Network error while deleting document.");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm text-center space-y-4 max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading Opportunity...</p>
        </div>
      </div>
    );
  }

  if (error && !opp) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-red-200 p-8 shadow-sm text-center space-y-4 max-w-md w-full">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Opportunity Not Found</h2>
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          <Link
            href="/seller/opportunities"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Opportunities</span>
          </Link>
        </div>
      </div>
    );
  }

  const isEditable =
    opp?.status === OpportunityStatus.DRAFT ||
    opp?.status === OpportunityStatus.CHANGES_REQUESTED;

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Top Banner */}
      <section className="bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <Link
              href="/seller/opportunities"
              className="inline-flex items-center gap-1.5 text-xs text-[#D9E2EC] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to My Opportunities</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-white/10 px-3 py-1 rounded border border-white/20 text-[#D9E2EC] font-bold">
                {opp?.referenceCode}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded bg-white/20 text-white border border-white/30">
                {opp?.status}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {formData.title || "Opportunity Editor"}
          </h1>

          <p className="text-xs sm:text-sm text-[#D9E2EC]">
            Manage teaser disclosure, operational benchmarks, statutory records, and deal room attachments.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Lock Warning if not editable */}
        {!isEditable && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 shadow-sm flex items-center justify-between gap-4 text-xs text-amber-900">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <div>
                <strong className="block text-sm font-bold text-amber-950">
                  Opportunity Editing Locked ({opp?.status})
                </strong>
                <span>
                  This opportunity has been submitted for platform diligence or published live. Modifications are restricted to preserve deal room integrity.
                </span>
              </div>
            </div>
            <Link
              href={`/opportunities/${opp?.id}`}
              className="px-4 py-2 bg-amber-800 text-white text-xs font-bold rounded-md shadow whitespace-nowrap"
            >
              View Live Teaser
            </Link>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Editor Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Form Data */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Public Teaser */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#1557A6]" />
                  <span>Public Blind Teaser (Tier 0)</span>
                </h2>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase">
                  Public Facing
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Teaser Headline *</label>
                  <input
                    type="text"
                    name="title"
                    disabled={!isEditable}
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Sector / Industry *</label>
                    <input
                      type="text"
                      name="industry"
                      disabled={!isEditable}
                      value={formData.industry}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Business Category *</label>
                    <select
                      name="businessCategory"
                      disabled={!isEditable}
                      value={formData.businessCategory}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(BusinessCategory).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Operating Region *</label>
                    <select
                      name="operatingRegion"
                      disabled={!isEditable}
                      value={formData.operatingRegion}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(OperatingRegion).map((reg) => (
                        <option key={reg} value={reg}>
                          {reg.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Registered State *</label>
                    <input
                      type="text"
                      name="registeredState"
                      disabled={!isEditable}
                      value={formData.registeredState}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Transaction Structure *</label>
                    <select
                      name="transactionType"
                      disabled={!isEditable}
                      value={formData.transactionType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(OpportunityTransactionType).map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Executive Teaser Overview *</label>
                  <textarea
                    name="teaserSummary"
                    rows={4}
                    disabled={!isEditable}
                    value={formData.teaserSummary}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Operational Scale & Model */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#1557A6]" />
                  <span>Operational Scale & Commercial Model (Tier 1)</span>
                </h2>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded font-bold uppercase border border-emerald-200">
                  Buyer Mandate Only
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Commercial Model</label>
                    <select
                      name="businessModel"
                      disabled={!isEditable}
                      value={formData.businessModel}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(BusinessModel).map((bm) => (
                        <option key={bm} value={bm}>
                          {bm}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Revenue Scale Bracket</label>
                    <select
                      name="revenueBracket"
                      disabled={!isEditable}
                      value={formData.revenueBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(RevenueBracket).map((rb) => (
                        <option key={rb} value={rb}>
                          {rb.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">EBITDA Margin Bracket</label>
                    <select
                      name="ebitdaMarginBracket"
                      disabled={!isEditable}
                      value={formData.ebitdaMarginBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(EbitdaMarginBracket).map((eb) => (
                        <option key={eb} value={eb}>
                          {eb.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Asking Price Bracket</label>
                    <select
                      name="askingPriceBracket"
                      disabled={!isEditable}
                      value={formData.askingPriceBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(AskingPriceBracket).map((ap) => (
                        <option key={ap} value={ap}>
                          {ap.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Employee Range</label>
                    <select
                      name="employeeRange"
                      disabled={!isEditable}
                      value={formData.employeeRange}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(EmployeeRange).map((er) => (
                        <option key={er} value={er}>
                          {er.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Year Established</label>
                    <input
                      type="number"
                      name="yearEstablished"
                      disabled={!isEditable}
                      value={formData.yearEstablished}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Growth Rate</label>
                    <select
                      name="growthRateBracket"
                      disabled={!isEditable}
                      value={formData.growthRateBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    >
                      {Object.values(GrowthRateBracket).map((gr) => (
                        <option key={gr} value={gr}>
                          {gr.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Facility Details</label>
                  <input
                    type="text"
                    name="facilityDetails"
                    disabled={!isEditable}
                    value={formData.facilityDetails}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Statutory Sealed Records */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-purple-700" />
                  <span>Statutory Confidential Identity (Tier 3 Sealed)</span>
                </h2>
                <span className="text-[10px] bg-purple-50 text-purple-800 px-2 py-0.5 rounded font-bold uppercase border border-purple-200">
                  NDA Sealed
                </span>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Exact Legal Entity Name</label>
                    <input
                      type="text"
                      name="exactLegalName"
                      disabled={!isEditable}
                      value={formData.exactLegalName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Trade / Brand Name</label>
                    <input
                      type="text"
                      name="exactTradeName"
                      disabled={!isEditable}
                      value={formData.exactTradeName}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">CIN / LLPIN</label>
                    <input
                      type="text"
                      name="exactCin"
                      disabled={!isEditable}
                      value={formData.exactCin}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">GSTIN</label>
                    <input
                      type="text"
                      name="exactGstin"
                      disabled={!isEditable}
                      value={formData.exactGstin}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">PAN</label>
                    <input
                      type="text"
                      name="exactPan"
                      disabled={!isEditable}
                      value={formData.exactPan}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Registered Address</label>
                  <input
                    type="text"
                    name="exactAddress"
                    disabled={!isEditable}
                    value={formData.exactAddress}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] disabled:bg-slate-100 text-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Save Button Bar */}
            {isEditable && (
              <div className="flex justify-end pt-2">
                <button
                  disabled={saving}
                  onClick={handleSaveDraft}
                  className="px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Draft Changes</span>
                </button>
              </div>
            )}
          </div>

          {/* Right Column (1 Col): Document Vault & Review Submission */}
          <div className="space-y-6">
            {/* Document Vault */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-[#1557A6]" />
                  <span>Opportunity Vault Documents</span>
                </h3>
              </div>

              {/* Upload Form */}
              {isEditable && (
                <form onSubmit={handleUploadDocument} className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Document Category</label>
                    <select
                      value={selectedDocType}
                      onChange={(e) => setSelectedDocType(e.target.value as OpportunityDocumentType)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-slate-800 bg-white"
                    >
                      {Object.values(OpportunityDocumentType).map((dt) => (
                        <option key={dt} value={dt}>
                          {dt.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Select File (PDF, PNG, JPG &lt; 15MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      required
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-[#1557A6] file:text-white hover:file:bg-[#104789]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingDoc || !docFile}
                    className="w-full py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {uploadingDoc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>Upload to Secure Vault</span>
                  </button>
                </form>
              )}

              {/* Document List */}
              <div className="space-y-2 pt-1 text-xs">
                {documents.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-[11px]">
                    No vault documents uploaded yet.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] uppercase font-bold text-[#1557A6] block">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                        <p className="font-medium text-slate-800 truncate text-[11px]">
                          {doc.originalFilename}
                        </p>
                        <span className="text-[10px] text-slate-500">
                          {(doc.fileSizeBytes / 1024).toFixed(0)} KB
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/v1/seller/opportunities/${opportunityId}/documents/${doc.id}`}
                          download
                          className="p-1.5 text-slate-600 hover:text-[#1557A6] hover:bg-slate-200 rounded"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        {isEditable && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-1.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Submission Desk */}
            {isEditable && (
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                  <Send className="w-4 h-4 text-[#1557A6]" />
                  <span>Platform Verification</span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  When your opportunity parameters and confidential records are ready, submit for Scale-up India administrative diligence.
                </p>

                <button
                  disabled={submitting}
                  onClick={handleSubmitForReview}
                  className="w-full py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Submit for Review</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
