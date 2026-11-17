// Scale-up India — Phase 13: Buyer / Reviewer Valuation Workspace Detail
// Path: src/app/buyer/valuation/[valuationId]/page.tsx

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  TrendingUp,
  ShieldCheck,
  Clock,
  ArrowLeft,
  PlusCircle,
  FileText,
  AlertTriangle,
  Lock,
  Layers,
  Sliders,
  CheckCircle2,
  XCircle,
  Percent,
  DollarSign,
  HelpCircle,
  ExternalLink,
  Briefcase,
} from "lucide-react";
import {
  ValuationCaseOverviewView,
  ValuationVersionDetailView,
  ValuationScenario,
} from "@/types/valuation";

export default function BuyerValuationWorkspacePage({
  params,
}: {
  params: Promise<{ valuationId: string }>;
}) {
  const router = useRouter();
  const { valuationId } = use(params);

  const [valuationCase, setValuationCase] = useState<ValuationCaseOverviewView | null>(null);
  const [activeVersion, setActiveVersion] = useState<ValuationVersionDetailView | null>(null);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number>(1);
  const [selectedScenario, setSelectedScenario] = useState<ValuationScenario>("BASE");
  const [activeTab, setActiveTab] = useState<"methodologies" | "inputs" | "adjustments" | "comparables" | "history">("methodologies");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [showAddInputModal, setShowAddInputModal] = useState(false);
  const [showAddAdjustmentModal, setShowAddAdjustmentModal] = useState(false);
  const [showAddComparableModal, setShowAddComparableModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showLockModal, setShowLockModal] = useState(false);

  // Form states
  const [inputForm, setInputForm] = useState({
    metricName: "REVENUE",
    rawValue: 50,
    unit: "CRORE",
    currency: "INR",
    sourcePeriod: "FY2024",
    provenanceType: "DILIGENCE_EVIDENCE",
    qualityFlag: "VERIFIED",
    notes: "",
  });

  const [adjForm, setAdjForm] = useState({
    adjustmentType: "TAX_CONTINGENCY",
    title: "Contingent Tax Dispute Holdback",
    amount: -42000000,
    rationale: "Holding back disputed tax liability identified in diligence findings.",
  });

  const [compForm, setCompForm] = useState({
    companyName: "Zenith Aerospace Components",
    sector: "Precision Engineering",
    period: "FY2024",
    revenue: 800000000,
    ebitda: 160000000,
    impliedEv: 2000000000,
    source: "Industry M&A Transaction Database",
    confidence: "HIGH",
  });

  const [reviewForm, setReviewForm] = useState({
    decision: "APPROVED",
    notes: "Financial evidence corroborated against statutory audit filings. Valuation methodology outputs validated.",
  });

  const fetchWorkspace = async (verNum?: number) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || "Failed to load valuation workspace.");
        return;
      }
      const c: ValuationCaseOverviewView = json.data;
      setValuationCase(c);

      const targetVer = verNum || c.currentVersionNumber;
      setSelectedVersionNum(targetVer);

      const verRes = await fetch(`/api/v1/valuations/${valuationId}/versions/${targetVer}`);
      const verJson = await verRes.json();
      if (verJson.success) {
        setActiveVersion(verJson.data);
      }
    } catch (err: any) {
      setError(err.message || "Network error loading valuation model.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspace();
  }, [valuationId]);

  const handleVersionChange = async (verNum: number) => {
    setSelectedVersionNum(verNum);
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/versions/${verNum}`);
      const json = await res.json();
      if (json.success) {
        setActiveVersion(json.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load version.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!confirm("Create a new valuation version cloned from the current version?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg(`Valuation Version V${json.data.versionNumber} created.`);
        await fetchWorkspace(json.data.versionNumber);
      } else {
        setError(json.error?.message || "Failed to create new version.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInput = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/inputs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...inputForm,
          rawValue: Number(inputForm.rawValue),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddInputModal(false);
        setSuccessMsg("Financial input recorded and model recalculated.");
        setActiveVersion(json.data);
      } else {
        setError(json.error?.message || "Failed to add input.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...adjForm,
          amount: Number(adjForm.amount),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddAdjustmentModal(false);
        setSuccessMsg("Valuation adjustment recorded with explicit audit rationale.");
        setActiveVersion(json.data);
      } else {
        setError(json.error?.message || "Failed to add adjustment.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComparable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/comparables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...compForm,
          revenue: Number(compForm.revenue),
          ebitda: compForm.ebitda ? Number(compForm.ebitda) : null,
          impliedEv: Number(compForm.impliedEv),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddComparableModal(false);
        setSuccessMsg("Comparable company multiple added to benchmark dataset.");
        setActiveVersion(json.data);
      } else {
        setError(json.error?.message || "Failed to add comparable.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitVersion = async () => {
    if (!confirm("Submit this valuation version for formal reviewer evaluation?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Submitted for review" }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Valuation version successfully submitted for review.");
        setActiveVersion(json.data);
        await fetchWorkspace(selectedVersionNum);
      } else {
        setError(json.error?.message || "Submission failed.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowReviewModal(false);
        setSuccessMsg(`Review completed with verdict: ${reviewForm.decision}`);
        setActiveVersion(json.data);
        await fetchWorkspace(selectedVersionNum);
      } else {
        setError(json.error?.message || "Review submission failed.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLock = async () => {
    if (!confirm("Permanently lock this approved valuation version into an immutable historical record?")) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/valuations/${valuationId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lockReason: "Formal valuation lock post-due diligence." }),
      });
      const json = await res.json();
      if (json.success) {
        setShowLockModal(false);
        setSuccessMsg("Valuation version permanently locked into immutable state.");
        setActiveVersion(json.data);
        await fetchWorkspace(selectedVersionNum);
      } else {
        setError(json.error?.message || "Locking failed.");
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  if (loading && !valuationCase) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-12 text-center text-sm text-gray-500">
        Loading valuation workspace...
      </div>
    );
  }

  if (!valuationCase || !activeVersion) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-12 text-center text-sm text-red-600">
        Valuation workspace not found or unauthorized.
      </div>
    );
  }

  const scenarioOutput = activeVersion.calculationResults?.scenarios?.[selectedScenario];
  const range = activeVersion.calculationResults?.range;
  const isLocked = activeVersion.status === "LOCKED";
  const isApproved = activeVersion.status === "APPROVED";
  const isDraft = activeVersion.status === "DRAFT" || activeVersion.status === "REVISION_REQUIRED";
  const isReviewerOrAdmin = valuationCase.userRole === "REVIEWER" || valuationCase.userRole === "ADMIN";

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20">
      {/* Top Header */}
      <div className="bg-[#1557A6] text-white py-8 px-6 border-b border-[#1f4e5b]">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <Link
              href="/buyer/valuation"
              className="inline-flex items-center gap-1.5 text-xs text-[#D9E2EC] hover:text-white"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Valuations
            </Link>

            <div className="flex items-center gap-2">
              <span className="text-xs text-white/80">Version:</span>
              <select
                value={selectedVersionNum}
                onChange={(e) => handleVersionChange(Number(e.target.value))}
                className="bg-white/10 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 border border-white/20 focus:outline-none"
              >
                {Array.from({ length: valuationCase.versionCount || 1 }, (_, i) => i + 1).map((v) => (
                  <option key={v} value={v} className="text-gray-900">
                    Version V{v} {v === valuationCase.currentVersionNumber ? "(Active)" : ""}
                  </option>
                ))}
              </select>

              {isDraft && (
                <button
                  onClick={handleSubmitVersion}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-[#1557A6] hover:bg-[#439685] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  Submit for Review
                </button>
              )}

              {isReviewerOrAdmin && (activeVersion.status === "SUBMITTED" || activeVersion.status === "UNDER_REVIEW") && (
                <button
                  onClick={() => setShowReviewModal(true)}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Review Model
                </button>
              )}

              {isReviewerOrAdmin && isApproved && (
                <button
                  onClick={handleLock}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Lock Model
                </button>
              )}

              {(isApproved || isLocked) && (
                <Link
                  href="/buyer/deal-room"
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  Proceed to Deal Room
                </Link>
              )}

              <button
                onClick={handleCreateNewVersion}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Version
              </button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold bg-white/20 px-2 py-0.5 rounded">
                  {valuationCase.referenceCode} • V{activeVersion.versionNumber}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    isLocked
                      ? "bg-indigo-200 text-indigo-900"
                      : isApproved
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {activeVersion.status}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight">
                {activeVersion.title || valuationCase.opportunityTitle}
              </h1>
              <p className="text-xs text-[#D9E2EC]">
                Opportunity: {valuationCase.opportunityReference} • DD Case: {valuationCase.diligenceReferenceCode}
              </p>
            </div>

            {/* Scenario Switcher */}
            <div className="bg-white/10 p-1 rounded-xl flex items-center border border-white/20">
              {(["CONSERVATIVE", "BASE", "OPTIMISTIC"] as ValuationScenario[]).map((sc) => (
                <button
                  key={sc}
                  onClick={() => setSelectedScenario(sc)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    selectedScenario === sc
                      ? "bg-white text-[#1557A6] shadow-sm"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  {sc}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-700 text-xs font-bold">Dismiss</button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-700 text-xs font-bold">Dismiss</button>
          </div>
        )}

        {/* Headline Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-teal-600" />
              Estimated Enterprise Value
            </span>
            <div className="text-2xl font-extrabold text-gray-900">
              {formatCurrency(scenarioOutput?.summaryEnterpriseValue)}
            </div>
            <p className="text-[11px] text-gray-400">
              {selectedScenario} scenario output
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-blue-600" />
              Estimated Equity Value
            </span>
            <div className="text-2xl font-extrabold text-gray-900">
              {formatCurrency(scenarioOutput?.summaryEquityValue)}
            </div>
            <p className="text-[11px] text-gray-400">
              Net of debt & cash adjustments
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
              Indicative Valuation Range
            </span>
            <div className="text-sm font-bold text-gray-900 mt-1">
              {range?.status === "AVAILABLE"
                ? `${formatCurrency(range.lowEnterpriseValue)} - ${formatCurrency(range.highEnterpriseValue)}`
                : "Range Unavailable"}
            </div>
            <p className="text-[11px] text-gray-400">
              Spread: {range?.spreadPercentage ?? 0}%
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-1">
            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Confidence Index
            </span>
            <div className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <span
                className={`${
                  activeVersion.confidenceLevel === "HIGH"
                    ? "text-emerald-700"
                    : activeVersion.confidenceLevel === "MEDIUM"
                    ? "text-amber-700"
                    : "text-gray-700"
                }`}
              >
                {activeVersion.confidenceLevel}
              </span>
              <span className="text-sm text-gray-400 font-normal">
                ({activeVersion.confidenceScore}%)
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              {activeVersion.confidenceFactors?.length || 0} evaluation factors evaluated
            </p>
          </div>
        </div>

        {/* Confidence Breakdown Banner */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-teal-600" />
              Transparent Confidence Attribution Model
            </span>
            <span className="text-xs text-gray-400">Deterministic scoring algorithm</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {activeVersion.confidenceFactors?.map((f, idx) => (
              <div key={idx} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                <div className="flex justify-between text-[11px] font-bold">
                  <span className="truncate text-gray-700" title={f.name}>{f.name}</span>
                  <span className="text-teal-700 font-mono">{f.score}/{f.weight}</span>
                </div>
                <p className="text-[10px] text-gray-500 line-clamp-2" title={f.explanation}>{f.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 space-x-6 text-sm font-bold">
          <button
            onClick={() => setActiveTab("methodologies")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "methodologies"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            Methodologies & Output
          </button>
          <button
            onClick={() => setActiveTab("inputs")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "inputs"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            Financial Inputs ({activeVersion.inputs.length})
          </button>
          <button
            onClick={() => setActiveTab("adjustments")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "adjustments"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Adjustments & Findings ({activeVersion.adjustments.length})
          </button>
          <button
            onClick={() => setActiveTab("comparables")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "comparables"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Market Comparables ({activeVersion.comparables.length})
          </button>
        </div>

        {/* TAB 1: METHODOLOGIES */}
        {activeTab === "methodologies" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Revenue Multiple Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">Revenue Multiple Analysis</h3>
                  <span className="text-xs bg-teal-50 text-teal-800 font-bold px-2.5 py-0.5 rounded">Multiple Engine</span>
                </div>
                {scenarioOutput?.revenueMultiple ? (
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Period Revenue:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(scenarioOutput.revenueMultiple.revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Selected Multiple:</span>
                        <span className="font-bold text-gray-900">{scenarioOutput.revenueMultiple.selectedMultiple}x</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-bold text-gray-700">Enterprise Value:</span>
                        <span className="font-extrabold text-teal-700 text-sm">{formatCurrency(scenarioOutput.revenueMultiple.enterpriseValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-700">Equity Value:</span>
                        <span className="font-extrabold text-blue-700 text-sm">{formatCurrency(scenarioOutput.revenueMultiple.equityValue)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">Revenue input not configured or multiple disabled.</p>
                )}
              </div>

              {/* EBITDA Multiple Card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">EBITDA Multiple Analysis</h3>
                  <span className="text-xs bg-blue-50 text-blue-800 font-bold px-2.5 py-0.5 rounded">Multiple Engine</span>
                </div>
                {scenarioOutput?.ebitdaMultiple ? (
                  scenarioOutput.ebitdaMultiple.isNegativeEbitdaUnsuitable ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="w-4 h-4" />
                        Methodology Unsuitable
                      </div>
                      <p>{scenarioOutput.ebitdaMultiple.message}</p>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Period EBITDA:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(scenarioOutput.ebitdaMultiple.ebitda)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Selected Multiple:</span>
                        <span className="font-bold text-gray-900">{scenarioOutput.ebitdaMultiple.selectedMultiple}x</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-bold text-gray-700">Enterprise Value:</span>
                        <span className="font-extrabold text-teal-700 text-sm">{formatCurrency(scenarioOutput.ebitdaMultiple.enterpriseValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-bold text-gray-700">Equity Value:</span>
                        <span className="font-extrabold text-blue-700 text-sm">{formatCurrency(scenarioOutput.ebitdaMultiple.equityValue)}</span>
                      </div>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-gray-400">EBITDA input not configured or multiple disabled.</p>
                )}
              </div>
            </div>

            {/* Discounted Cash Flow (DCF) Table */}
            {scenarioOutput?.dcf && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Discounted Cash Flow Model (DCF)</h3>
                    <p className="text-xs text-gray-500">
                      Deterministic forecast discounting unlevered free cash flows at WACC ({scenarioOutput.dcf.waccPct}%) with terminal growth ({scenarioOutput.dcf.terminalGrowthRatePct}%)
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block">Implied DCF Enterprise Value</span>
                    <span className="text-lg font-extrabold text-teal-700">{formatCurrency(scenarioOutput.dcf.enterpriseValue)}</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-700 font-bold border-y border-gray-200">
                      <tr>
                        <th className="py-2.5 px-3">Year</th>
                        <th className="py-2.5 px-3">Revenue</th>
                        <th className="py-2.5 px-3">EBITDA</th>
                        <th className="py-2.5 px-3">EBIT</th>
                        <th className="py-2.5 px-3">Tax</th>
                        <th className="py-2.5 px-3">Free Cash Flow</th>
                        <th className="py-2.5 px-3">Discount Factor</th>
                        <th className="py-2.5 px-3 text-right">Present Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {scenarioOutput.dcf.projectionYears.map((yr) => (
                        <tr key={yr.year}>
                          <td className="py-2.5 px-3 font-bold text-gray-900">Year {yr.year}</td>
                          <td className="py-2.5 px-3">{formatCurrency(yr.projectedRevenue)}</td>
                          <td className="py-2.5 px-3">{formatCurrency(yr.ebitda)} ({yr.ebitdaMarginPct}%)</td>
                          <td className="py-2.5 px-3">{formatCurrency(yr.ebit)}</td>
                          <td className="py-2.5 px-3">{formatCurrency(yr.taxAmount)}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-900">{formatCurrency(yr.freeCashFlow)}</td>
                          <td className="py-2.5 px-3 font-mono text-gray-500">{yr.discountFactor}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-teal-700">{formatCurrency(yr.presentValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-bold border-t border-gray-200">
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-gray-600">Sum of PV of Free Cash Flows:</td>
                        <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(scenarioOutput.dcf.sumPvCashFlows)}</td>
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-gray-600">PV of Terminal Value:</td>
                        <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(scenarioOutput.dcf.pvTerminalValue)}</td>
                      </tr>
                      <tr>
                        <td colSpan={7} className="py-2 px-3 text-right text-teal-800">Total Enterprise Value:</td>
                        <td className="py-2 px-3 text-right text-teal-800 font-extrabold">{formatCurrency(scenarioOutput.dcf.enterpriseValue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Asset-Based Valuation */}
            {scenarioOutput?.assetBased && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-gray-900">Adjusted Net Asset Valuation</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-gray-50 p-4 rounded-xl space-y-1">
                    <span className="text-gray-500">Adjusted Tangible Assets:</span>
                    <div className="text-base font-extrabold text-gray-900">{formatCurrency(scenarioOutput.assetBased.adjustedAssets)}</div>
                    <span className="text-[10px] text-gray-400">Total Assets + Additions - Risk Haircuts</span>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl space-y-1">
                    <span className="text-gray-500">Adjusted Liabilities:</span>
                    <div className="text-base font-extrabold text-gray-900">{formatCurrency(scenarioOutput.assetBased.adjustedLiabilities)}</div>
                    <span className="text-[10px] text-gray-400">Total Liabilities + Contingency Provisions</span>
                  </div>
                  <div className="bg-teal-50 p-4 rounded-xl space-y-1">
                    <span className="text-teal-700 font-bold">Net Asset Value (NAV):</span>
                    <div className="text-base font-extrabold text-teal-900">{formatCurrency(scenarioOutput.assetBased.netAssetValue)}</div>
                    <span className="text-[10px] text-teal-600">Adjusted Assets - Adjusted Liabilities</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: FINANCIAL INPUTS */}
        {activeTab === "inputs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Financial Inputs & Evidence Provenance</h3>
                <p className="text-xs text-gray-500">
                  Every financial input is validated and bound to its source period and diligence evidence document.
                </p>
              </div>
              {!isLocked && (
                <button
                  onClick={() => setShowAddInputModal(true)}
                  className="px-3.5 py-1.5 bg-[#1557A6] hover:bg-[#1f4e5b] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Financial Input
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Metric</th>
                    <th className="py-3 px-4">Raw Input</th>
                    <th className="py-3 px-4">Normalized (INR)</th>
                    <th className="py-3 px-4">Period</th>
                    <th className="py-3 px-4">Provenance</th>
                    <th className="py-3 px-4">Quality Flag</th>
                    <th className="py-3 px-4">Evidence Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeVersion.inputs.map((inp) => (
                    <tr key={inp.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-bold text-gray-900">{inp.metricName}</td>
                      <td className="py-3 px-4 font-mono">{inp.rawValue} {inp.unit}</td>
                      <td className="py-3 px-4 font-bold font-mono text-gray-900">{formatCurrency(inp.normalizedValue)}</td>
                      <td className="py-3 px-4 text-gray-600">{inp.sourcePeriod || "—"}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-800">
                          {inp.provenanceType}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800">
                          {inp.qualityFlag}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 truncate max-w-xs">
                        {inp.evidenceTitle ? (
                          <span className="flex items-center gap-1 text-teal-700">
                            <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                            {inp.evidenceTitle} (v{inp.evidenceVersionNumber})
                          </span>
                        ) : (
                          <span className="text-gray-400">Manual / None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: ADJUSTMENTS & FINDINGS */}
        {activeTab === "adjustments" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Valuation Adjustments & Diligence Findings</h3>
                <p className="text-xs text-gray-500">
                  Explicit adjustments with regulatory rationale and linkages to due diligence risk findings.
                </p>
              </div>
              {!isLocked && (
                <button
                  onClick={() => setShowAddAdjustmentModal(true)}
                  className="px-3.5 py-1.5 bg-[#1557A6] hover:bg-[#1f4e5b] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Adjustment
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Linked Diligence Finding</th>
                    <th className="py-3 px-4">Rationale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeVersion.adjustments.map((adj) => (
                    <tr key={adj.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-gray-700">{adj.adjustmentType}</td>
                      <td className="py-3 px-4 font-bold text-gray-900">{adj.title}</td>
                      <td
                        className={`py-3 px-4 font-mono font-bold ${
                          adj.amount >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {formatCurrency(adj.amount)}
                      </td>
                      <td className="py-3 px-4">
                        {adj.sourceFindingReference ? (
                          <div className="space-y-0.5">
                            <span className="font-mono text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-bold">
                              {adj.sourceFindingReference} ({adj.sourceFindingSeverity})
                            </span>
                            <p className="text-[11px] text-gray-700 truncate max-w-xs">{adj.sourceFindingTitle}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-600 max-w-md">{adj.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: COMPARABLES */}
        {activeTab === "comparables" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Peer Transaction Comparables</h3>
                <p className="text-xs text-gray-500">
                  Authorized industry market peer transaction dataset used for multiple triangulation.
                </p>
              </div>
              {!isLocked && (
                <button
                  onClick={() => setShowAddComparableModal(true)}
                  className="px-3.5 py-1.5 bg-[#1557A6] hover:bg-[#1f4e5b] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Add Market Comparable
                </button>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Company Name</th>
                    <th className="py-3 px-4">Sector</th>
                    <th className="py-3 px-4">Revenue</th>
                    <th className="py-3 px-4">Implied EV</th>
                    <th className="py-3 px-4">EV / Rev</th>
                    <th className="py-3 px-4">EV / EBITDA</th>
                    <th className="py-3 px-4">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeVersion.comparables.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50/50">
                      <td className="py-3 px-4 font-bold text-gray-900">{c.companyName}</td>
                      <td className="py-3 px-4 text-gray-600">{c.sector}</td>
                      <td className="py-3 px-4 font-mono">{formatCurrency(c.revenue)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">{formatCurrency(c.impliedEv)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-teal-700">{c.revenueMultiple}x</td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">{c.ebitdaMultiple ? `${c.ebitdaMultiple}x` : "—"}</td>
                      <td className="py-3 px-4 text-gray-500 truncate max-w-xs">{c.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MODAL: ADD FINANCIAL INPUT */}
        {showAddInputModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Add Financial Input</h3>
              <form onSubmit={handleAddInput} className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Metric Name</label>
                    <select
                      value={inputForm.metricName}
                      onChange={(e) => setInputForm({ ...inputForm, metricName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono font-bold"
                    >
                      <option value="REVENUE">REVENUE</option>
                      <option value="EBITDA">EBITDA</option>
                      <option value="TOTAL_DEBT">TOTAL_DEBT</option>
                      <option value="CASH">CASH</option>
                      <option value="TOTAL_ASSETS">TOTAL_ASSETS</option>
                      <option value="TOTAL_LIABILITIES">TOTAL_LIABILITIES</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Unit</label>
                    <select
                      value={inputForm.unit}
                      onChange={(e) => setInputForm({ ...inputForm, unit: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono"
                    >
                      <option value="INR">INR (Rupees)</option>
                      <option value="THOUSAND">THOUSAND</option>
                      <option value="LAKH">LAKH</option>
                      <option value="CRORE">CRORE</option>
                      <option value="MILLION">MILLION</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Raw Value</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={inputForm.rawValue}
                      onChange={(e) => setInputForm({ ...inputForm, rawValue: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Source Period</label>
                    <input
                      type="text"
                      placeholder="e.g. FY2024, LTM"
                      value={inputForm.sourcePeriod}
                      onChange={(e) => setInputForm({ ...inputForm, sourcePeriod: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Provenance Type</label>
                  <select
                    value={inputForm.provenanceType}
                    onChange={(e) => setInputForm({ ...inputForm, provenanceType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="DILIGENCE_EVIDENCE">Diligence Evidence (Audited Disclosures)</option>
                    <option value="AUDITED_STATEMENTS">Audited Financial Statements</option>
                    <option value="TAX_FILINGS">Statutory Tax Returns (ITR / GST)</option>
                    <option value="MANUAL_INPUT">Manual Entry (Unverified)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddInputModal(false)}
                    className="px-4 py-2 text-gray-600 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1f4e5b]"
                  >
                    Add Input
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD ADJUSTMENT */}
        {showAddAdjustmentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Add Valuation Adjustment</h3>
              <form onSubmit={handleAddAdjustment} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Adjustment Type</label>
                  <select
                    value={adjForm.adjustmentType}
                    onChange={(e) => setAdjForm({ ...adjForm, adjustmentType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  >
                    <option value="TAX_CONTINGENCY">Tax Contingency Provision</option>
                    <option value="RISK_HAIRCUT">Risk Haircut</option>
                    <option value="ASSET_ADDITION">Asset Addition</option>
                    <option value="LIABILITY_ADDITION">Liability Addition</option>
                    <option value="WORKING_CAPITAL_NORM">Working Capital Normalization</option>
                    <option value="PROMOTER_INDEMNITY">Promoter Indemnity Holdback</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Title</label>
                  <input
                    type="text"
                    required
                    value={adjForm.title}
                    onChange={(e) => setAdjForm({ ...adjForm, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Amount (INR)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={adjForm.amount}
                    onChange={(e) => setAdjForm({ ...adjForm, amount: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg p-2 font-mono"
                  />
                  <span className="text-[10px] text-gray-400">Use negative numbers for haircuts/liabilities</span>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Explicit Regulatory Rationale</label>
                  <textarea
                    rows={3}
                    required
                    value={adjForm.rationale}
                    onChange={(e) => setAdjForm({ ...adjForm, rationale: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddAdjustmentModal(false)}
                    className="px-4 py-2 text-gray-600 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1f4e5b]"
                  >
                    Save Adjustment
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: ADD COMPARABLE */}
        {showAddComparableModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Add Comparable Peer Multiple</h3>
              <form onSubmit={handleAddComparable} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    value={compForm.companyName}
                    onChange={(e) => setCompForm({ ...compForm, companyName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Revenue (INR)</label>
                    <input
                      type="number"
                      required
                      value={compForm.revenue}
                      onChange={(e) => setCompForm({ ...compForm, revenue: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Implied EV (INR)</label>
                    <input
                      type="number"
                      required
                      value={compForm.impliedEv}
                      onChange={(e) => setCompForm({ ...compForm, impliedEv: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg p-2 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Data Source</label>
                  <input
                    type="text"
                    required
                    value={compForm.source}
                    onChange={(e) => setCompForm({ ...compForm, source: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowAddComparableModal(false)}
                    className="px-4 py-2 text-gray-600 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1f4e5b]"
                  >
                    Add Comparable
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: REVIEW */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Review Valuation Model</h3>
              <form onSubmit={handleReview} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Verdict Decision</label>
                  <select
                    value={reviewForm.decision}
                    onChange={(e) => setReviewForm({ ...reviewForm, decision: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2 font-bold"
                  >
                    <option value="APPROVED">APPROVE — Valuation Endorsed</option>
                    <option value="REVISION_REQUIRED">REVISION REQUIRED — Request Model Changes</option>
                    <option value="REJECTED">REJECT — Valuation Rejected</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Review Notes & Assessment</label>
                  <textarea
                    rows={4}
                    required
                    value={reviewForm.notes}
                    onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg p-2"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="px-4 py-2 text-gray-600 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700"
                  >
                    Submit Review Verdict
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
