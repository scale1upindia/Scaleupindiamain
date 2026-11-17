"use client";

import { useState } from "react";
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
  Sparkles,
} from "lucide-react";
import {
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

export default function NewOpportunityPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State matching createOpportunitySchema
  const [formData, setFormData] = useState({
    // Step 1: Public Blind Teaser
    title: "",
    headline: "",
    teaserSummary: "",
    industry: "",
    registeredState: "Delhi",
    registeredCity: "New Delhi",
    businessCategory: BusinessCategory.MANUFACTURING as BusinessCategory,
    operatingRegion: OperatingRegion.NORTH_INDIA as OperatingRegion,
    approximateAgeBracket: BusinessAgeBracket.LESS_THAN_3_YRS as BusinessAgeBracket,
    transactionType: OpportunityTransactionType.FULL_ACQUISITION as OpportunityTransactionType,

    // Step 2: Operational Scale & Model
    businessModel: BusinessModel.B2B as BusinessModel,
    revenueBracket: RevenueBracket.CR_15_TO_25 as RevenueBracket,
    ebitdaMarginBracket: EbitdaMarginBracket.PCT_10_TO_20 as EbitdaMarginBracket,
    askingPriceBracket: AskingPriceBracket.CR_10_TO_25 as AskingPriceBracket,
    employeeRange: EmployeeRange.EMP_51_TO_200 as EmployeeRange,
    growthRateBracket: GrowthRateBracket.PCT_10_TO_25 as GrowthRateBracket,
    yearEstablished: new Date().getFullYear() - 8,
    customerScale: "",
    facilityDetails: "",
    detailedDescription: "",
    stakeOfferedPercentage: 100,
    promoterRetentionPreference: "Open to transition advisory period of 6-12 months",
    reasonForSale: "Promoter retirement / graceful liquidity exit",
    transactionObjective: "Strategic corporate buyout with operational continuity",

    // Step 3: Statutory Confidential Underpinnings
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step === 1) {
      if (formData.title.length < 5) {
        setError("Teaser title must be at least 5 characters.");
        return;
      }
      if (formData.teaserSummary.length < 20) {
        setError("Teaser summary must be at least 20 characters.");
        return;
      }
      if (!formData.industry) {
        setError("Please enter the primary industry/sector.");
        return;
      }
      if (!formData.registeredState) {
        setError("Please enter the registered state.");
        return;
      }
    }
    setStep((s) => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: formData.title,
        headline: formData.headline || undefined,
        teaserSummary: formData.teaserSummary,
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
        detailedDescription: formData.detailedDescription || undefined,
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

      const res = await fetch("/api/v1/seller/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        const newOppId = json.data.opportunity.id;
        router.push(`/seller/opportunities/${newOppId}/edit?created=true`);
      } else {
        setError(json.error?.message || "Failed to create opportunity");
      }
    } catch {
      setError("Network error while submitting opportunity draft.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Top Banner */}
      <section className="bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-4xl mx-auto space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#D9E2EC]">
            <Link href="/seller/opportunities" className="hover:text-white flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Opportunities</span>
            </Link>
            <span>/</span>
            <span>New Listing Wizard</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Create Business Opportunity
          </h1>
          <p className="text-xs sm:text-sm text-[#D9E2EC] leading-relaxed">
            Follow our 4-step progressive onboarding wizard. Public teasers remain completely masked from your statutory identity until authorized non-disclosure agreements are countersigned.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Step Progress Indicator */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {[
            { num: 1, label: "Blind Teaser", icon: Sparkles },
            { num: 2, label: "Operational Scale", icon: TrendingUp },
            { num: 3, label: "Statutory Identity", icon: Lock },
            { num: 4, label: "Review & Submit", icon: FileCheck2 },
          ].map((st) => {
            const Icon = st.icon;
            const isActive = step === st.num;
            const isCompleted = step > st.num;
            return (
              <div
                key={st.num}
                className={`p-3 rounded-lg border text-center transition-all ${
                  isActive
                    ? "bg-[#1557A6] text-white border-[#1557A6] shadow"
                    : isCompleted
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>Step {st.num}</span>
                </div>
                <div className="text-[10px] mt-0.5 truncate hidden sm:block font-medium">
                  {st.label}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Wizard Form Cards */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          {/* STEP 1: PUBLIC BLIND TEASER */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-6">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                  <Sparkles className="w-4 h-4 text-[#1557A6]" />
                  <span>Step 1 • Public Blind Teaser (Tier 0)</span>
                </div>
                <p className="text-xs text-slate-500">
                  This summary will be visible to prospective buyers without revealing your company brand, exact location, or statutory identity.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Teaser Headline / Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="e.g. Leading Precision CNC Machining & Auto Components Manufacturer"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Do not mention your exact company legal name or factory address.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Industry / Sector *</label>
                    <input
                      type="text"
                      name="industry"
                      required
                      value={formData.industry}
                      onChange={handleChange}
                      placeholder="e.g. Precision Engineering"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Business Category *</label>
                    <select
                      name="businessCategory"
                      value={formData.businessCategory}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                      value={formData.operatingRegion}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                      required
                      value={formData.registeredState}
                      onChange={handleChange}
                      placeholder="e.g. Maharashtra"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Proposed Transaction Structure *
                    </label>
                    <select
                      name="transactionType"
                      value={formData.transactionType}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                  <label className="block font-bold text-slate-800 mb-1">
                    Teaser Overview (Executive Summary) *
                  </label>
                  <textarea
                    name="teaserSummary"
                    required
                    rows={4}
                    value={formData.teaserSummary}
                    onChange={handleChange}
                    placeholder="Provide an overview of operational capabilities, key product lines, client retention rate, and market standing..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800 leading-relaxed"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Minimum 20 characters. Highlight competitive advantages and industry moats.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center gap-1.5"
                >
                  <span>Continue to Operational Scale</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: OPERATIONAL SCALE & COMMERCIAL BLUEPRINT */}
          {step === 2 && (
            <form onSubmit={handleNextStep} className="space-y-6">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4 text-[#1557A6]" />
                  <span>Step 2 • Operational Scale & Commercial Blueprint (Tier 1)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Disclosed strictly to verified and authenticated commercial buyers with signed acquisition mandates.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Commercial Model *</label>
                    <select
                      name="businessModel"
                      value={formData.businessModel}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    >
                      {Object.values(BusinessModel).map((bm) => (
                        <option key={bm} value={bm}>
                          {bm}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Annual Revenue Scale Bracket *
                    </label>
                    <select
                      name="revenueBracket"
                      value={formData.revenueBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                      value={formData.ebitdaMarginBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    >
                      {Object.values(EbitdaMarginBracket).map((eb) => (
                        <option key={eb} value={eb}>
                          {eb.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Asking Price / Expected Valuation Bracket
                    </label>
                    <select
                      name="askingPriceBracket"
                      value={formData.askingPriceBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                    <label className="block font-bold text-slate-800 mb-1">Employee Workforce Range</label>
                    <select
                      name="employeeRange"
                      value={formData.employeeRange}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                      value={formData.yearEstablished}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">YoY Growth Momentum</label>
                    <select
                      name="growthRateBracket"
                      value={formData.growthRateBracket}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
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
                  <label className="block font-bold text-slate-800 mb-1">
                    Facility Footprint & Infrastructure (Optional)
                  </label>
                  <input
                    type="text"
                    name="facilityDetails"
                    value={formData.facilityDetails}
                    onChange={handleChange}
                    placeholder="e.g. 45,000 sq ft owned manufacturing unit with ISO 9001:2015 certification"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center gap-1.5"
                >
                  <span>Continue to Confidential Identity</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: STATUTORY IDENTITY (TIER 3 MASKED UNDERPINNINGS) */}
          {step === 3 && (
            <form onSubmit={handleNextStep} className="space-y-6">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wider">
                  <Lock className="w-4 h-4 text-purple-700" />
                  <span>Step 3 • Statutory Confidential Identity (Tier 3 Sealed)</span>
                </div>
                <p className="text-xs text-slate-500">
                  These records are encrypted and protected behind non-disclosure vaults. Only Scale-up India verification officers can inspect them during pre-publication diligence.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Exact Legal Entity Name
                    </label>
                    <input
                      type="text"
                      name="exactLegalName"
                      value={formData.exactLegalName}
                      onChange={handleChange}
                      placeholder="e.g. Apex Precision Engineering Private Limited"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Trade / Commercial Brand Name
                    </label>
                    <input
                      type="text"
                      name="exactTradeName"
                      value={formData.exactTradeName}
                      onChange={handleChange}
                      placeholder="e.g. Apex Precision"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">CIN / LLPIN</label>
                    <input
                      type="text"
                      name="exactCin"
                      value={formData.exactCin}
                      onChange={handleChange}
                      placeholder="e.g. U29253DL2015PTC123456"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] text-slate-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">GSTIN</label>
                    <input
                      type="text"
                      name="exactGstin"
                      value={formData.exactGstin}
                      onChange={handleChange}
                      placeholder="e.g. 07AAACA1234A1Z5"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] text-slate-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Company PAN</label>
                    <input
                      type="text"
                      name="exactPan"
                      value={formData.exactPan}
                      onChange={handleChange}
                      placeholder="e.g. AAACA1234A"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md font-mono focus:ring-1 focus:ring-[#1557A6] text-slate-800 uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Registered Office Street Address
                  </label>
                  <input
                    type="text"
                    name="exactAddress"
                    value={formData.exactAddress}
                    onChange={handleChange}
                    placeholder="Plot 42, Industrial Area Phase II, New Delhi - 110020"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Exact Annual Revenue (INR)
                    </label>
                    <input
                      type="number"
                      name="exactRevenue"
                      value={formData.exactRevenue}
                      onChange={handleChange}
                      placeholder="e.g. 185000000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Exact Annual EBITDA (INR)
                    </label>
                    <input
                      type="number"
                      name="exactEbitda"
                      value={formData.exactEbitda}
                      onChange={handleChange}
                      placeholder="e.g. 32000000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Exact Asking Valuation (INR)
                    </label>
                    <input
                      type="number"
                      name="exactAskingPrice"
                      value={formData.exactAskingPrice}
                      onChange={handleChange}
                      placeholder="e.g. 250000000"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center gap-1.5"
                >
                  <span>Review Opportunity Dossier</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: REVIEW & CONFIRMATION */}
          {step === 4 && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                  <FileCheck2 className="w-4 h-4 text-[#1557A6]" />
                  <span>Step 4 • Review & Save Opportunity Listing</span>
                </div>
                <p className="text-xs text-slate-500">
                  Review your opportunity parameters before saving. You will be able to attach pitch decks and audited financial statements in the document vault.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-5 border border-slate-200 space-y-4 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Teaser Title:</span>
                  <h3 className="text-sm font-bold text-slate-900">{formData.title}</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-200 pt-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Sector:</span>
                    <strong className="text-slate-800">{formData.industry}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Region:</span>
                    <strong className="text-slate-800">
                      {formData.operatingRegion.replace(/_/g, " ")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Revenue Bracket:</span>
                    <strong className="text-[#1557A6]">
                      {formData.revenueBracket.replace(/_/g, " ")}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Transaction:</span>
                    <strong className="text-slate-800">
                      {formData.transactionType.replace(/_/g, " ")}
                    </strong>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <span className="text-slate-500 text-[11px] block mb-1">Teaser Overview:</span>
                  <p className="text-slate-700 leading-relaxed bg-white p-3 rounded border border-slate-200">
                    {formData.teaserSummary}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-3 space-y-1">
                  <span className="text-slate-500 text-[11px] block">Statutory Identity:</span>
                  <p className="text-slate-800 font-semibold">
                    {formData.exactLegalName || "Confidential Enterprise"} • CIN:{" "}
                    {formData.exactCin || "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-sm flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  disabled={submitting}
                  onClick={handleSubmit}
                  className="px-8 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>Save Opportunity Listing</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
