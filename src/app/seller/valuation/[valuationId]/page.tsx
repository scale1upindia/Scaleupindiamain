"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calculator,
  Building2,
  TrendingUp,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  ChevronRight,
  Info,
  Scale,
  FileCheck2,
  EyeOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  ValuationCaseOverviewView,
  ValuationSellerSummaryView,
  ValuationConfidenceLevel,
  ValuationMethodology,
} from "@/types/valuation";

export default function SellerValuationDetailPage() {
  const params = useParams();
  const valuationId = params.valuationId as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [sellerSummary, setSellerSummary] = useState<ValuationSellerSummaryView | null>(null);
  const [caseOverview, setCaseOverview] = useState<ValuationCaseOverviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/seller/valuation/${valuationId}`);
      return;
    }
    if (user && valuationId) {
      fetchValuationData();
    }
  }, [user, authLoading, valuationId]);

  const fetchValuationData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch progressive disclosure seller summary
      const sumRes = await fetch(`/api/v1/valuations/${valuationId}/seller-summary`);
      const sumJson = await sumRes.json();

      // 2. Fetch general case overview
      const caseRes = await fetch(`/api/v1/valuations/${valuationId}`);
      const caseJson = await caseRes.json();

      if (sumJson.success && caseJson.success) {
        setSellerSummary(sumJson.data);
        setCaseOverview(caseJson.data);
      } else {
        setError(sumJson.error?.message || caseJson.error?.message || "Failed to load valuation summary.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getMethodologyLabel = (m: ValuationMethodology) => {
    switch (m) {
      case "REVENUE_MULTIPLE":
        return "Revenue Multiple Approach";
      case "EBITDA_MULTIPLE":
        return "EBITDA Multiple Approach";
      case "DISCOUNTED_CASH_FLOW":
        return "Discounted Cash Flow (DCF)";
      case "ASSET_BASED":
        return "Asset-Based NAV Approach";
      case "COMPARABLE_COMPANIES":
        return "Comparable Market Peers";
      case "BLENDED":
        return "Blended Weighted Framework";
      default:
        return m;
    }
  };

  const getMethodologyDescription = (m: ValuationMethodology) => {
    switch (m) {
      case "REVENUE_MULTIPLE":
        return "Enterprise value derived from normalized annual revenue multiplied by verified market benchmark multiple.";
      case "EBITDA_MULTIPLE":
        return "Enterprise value derived from normalized recurring operating earnings (EBITDA) multiplied by sector multiple.";
      case "DISCOUNTED_CASH_FLOW":
        return "Intrinsic value based on projected multi-year free cash flows discounted at cost of capital (WACC) with perpetual terminal value.";
      case "ASSET_BASED":
        return "Net asset liquidation and replacement value after adjusting book balance sheet for fair market haircuts and liabilities.";
      case "COMPARABLE_COMPANIES":
        return "Market peer triangulation using median sector transaction multiples and operating peer metrics.";
      case "BLENDED":
        return "Weighted synthesis combining multiple standalone methodologies to achieve robust, risk-adjusted valuation range.";
      default:
        return "";
    }
  };

  const getConfidenceBadge = (level: ValuationConfidenceLevel, score?: number | null) => {
    switch (level) {
      case "HIGH":
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5" />
              High Confidence ({score ?? 85}/100)
            </span>
          </div>
        );
      case "MEDIUM":
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
              <AlertCircle className="w-3.5 h-3.5" />
              Medium Confidence ({score ?? 60}/100)
            </span>
          </div>
        );
      case "LOW":
      default:
        return (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
              <AlertTriangle className="w-3.5 h-3.5" />
              Low Confidence ({score ?? 35}/100)
            </span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading valuation summary...</p>
        </div>
      </div>
    );
  }

  if (error || !sellerSummary || !caseOverview) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-semibold text-gray-900">Valuation Unavailable</h2>
          <p className="text-sm text-gray-500">{error || "Could not retrieve valuation details."}</p>
          <div className="pt-2">
            <Link
              href="/seller/valuation"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white rounded-lg text-sm font-semibold hover:bg-[#235360] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Valuation Desk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const range = sellerSummary.indicativeValuationRange;
  const activeVer = caseOverview.activeVersion;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <Link href="/seller/valuation" className="hover:text-gray-900 transition-colors">
            Valuation Desk
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium font-mono">{sellerSummary.referenceCode}</span>
        </nav>

        {/* Header Block */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
                {sellerSummary.referenceCode}
              </span>
              <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Version V{sellerSummary.currentVersionNumber}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {sellerSummary.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{sellerSummary.opportunityTitle}</h1>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <span>
                Due Diligence Workspace:{" "}
                <Link
                  href={`/seller/diligence/${sellerSummary.diligenceCaseId}`}
                  className="font-mono font-medium text-[#1557A6] hover:underline"
                >
                  {caseOverview.diligenceReferenceCode || sellerSummary.diligenceCaseId}
                </Link>
              </span>
              <span>•</span>
              <span>Disclosed: {new Date(sellerSummary.disclosedAt).toLocaleDateString()}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/seller/diligence/${sellerSummary.diligenceCaseId}`}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <FileCheck2 className="w-4 h-4 text-[#1557A6]" />
              Diligence Workspace
            </Link>
          </div>
        </div>

        {/* Progressive Disclosure Notice */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-5 flex items-start gap-3.5 text-sm">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-blue-900">
            <h3 className="font-semibold text-blue-950">
              Confidential Indicative Valuation Summary (Progressive Disclosure)
            </h3>
            <p className="text-xs text-blue-800 leading-relaxed">
              This summary reflects the evidence-anchored indicative valuation prepared by the prospective acquirer
              under bilateral confidentiality terms. To preserve negotiation fairness and confidential proprietary strategy,
              the acquirer&apos;s internal working papers, sensitivity sliders, tactical discount factor adjustments,
              and internal memos remain protected under progressive disclosure protocols.
            </p>
          </div>
        </div>

        {/* Indicative Range Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Enterprise Value Range */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Indicative Valuation
                </span>
                <h3 className="text-lg font-bold text-gray-900">Enterprise Value (EV) Range</h3>
              </div>
              <div className="p-2.5 bg-teal-50 rounded-lg text-[#1557A6]">
                <Calculator className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gray-500 font-medium">Indicative Base Enterprise Value:</span>
                <span className="text-xl font-bold text-[#1557A6]">
                  {formatCurrency(range.baseEnterpriseValue)}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200/80 flex items-center justify-between text-xs">
                <div>
                  <span className="text-gray-500">Low EV: </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(range.lowEnterpriseValue)}</span>
                </div>
                <div>
                  <span className="text-gray-500">High EV: </span>
                  <span className="font-semibold text-gray-900">{formatCurrency(range.highEnterpriseValue)}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Reflects the total operational value of the business on a cash-free, debt-free basis across conservative,
              base, and optimistic economic scenarios.
            </p>
          </div>

          {/* Model Confidence & Quality Factor */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Integrity &amp; Robustness
                </span>
                <h3 className="text-lg font-bold text-gray-900">Valuation Confidence Index</h3>
              </div>
              <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Model Confidence Level:</span>
                {getConfidenceBadge(sellerSummary.confidenceLevel, activeVer?.confidenceScore)}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${
                    sellerSummary.confidenceLevel === "HIGH"
                      ? "bg-emerald-500"
                      : sellerSummary.confidenceLevel === "MEDIUM"
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${Math.min(activeVer?.confidenceScore || 50, 100)}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Calculated using the platform deterministic 6-factor model: verified due diligence evidence provenance,
              input freshness, methodology triangulation, comparable peer density, risk finding adjustments, and
              internal governance approval.
            </p>
          </div>
        </div>

        {/* Applied Methodologies Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Applied Valuation Methodologies</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                The prospective acquirer synthesized the following corporate valuation approaches to triangulate the indicative range.
              </p>
            </div>
            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
              {sellerSummary.methodologiesApplied.length} Approaches Configured
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {sellerSummary.methodologiesApplied.map((m) => (
              <div
                key={m}
                className="p-4 rounded-xl border border-gray-200 bg-slate-50/50 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Scale className="w-4 h-4 text-[#1557A6]" />
                    <h4 className="text-sm font-semibold text-gray-900">{getMethodologyLabel(m)}</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{getMethodologyDescription(m)}</p>
                </div>
                <div className="pt-2 border-t border-gray-200/60 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Status:</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Configured &amp; Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Masked Proprietary Working Papers Notice */}
        <div className="bg-slate-100/90 border border-slate-300 rounded-xl p-5 flex items-start gap-3.5 text-slate-800">
          <EyeOff className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-slate-900">
              Masked Proprietary Buyer Worksheets &amp; Adjustment Papers
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pursuant to Phase 13 Progressive Disclosure and antitrust fair-dealing standards, specific buyer discount
              rate sensitivities, custom tactical risk adjustments, and private reviewer notes are masked. If you wish to
              discuss or clarify indicative pricing assumptions, coordinate through the Due Diligence workspace and
              verified deal communication channels.
            </p>
          </div>
        </div>

        {/* Regulatory & Commercial Footer Disclaimer */}
        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-gray-700">
            <Lock className="w-3.5 h-3.5 text-gray-500" />
            Commercial &amp; Regulatory Valuation Notice
          </div>
          <p className="leading-relaxed">
            Indicative valuations are financial decision-support tools generated within the Scale-up India platform.
            They do not constitute a formal fairness opinion, statutory valuation under Section 247 of the Indian Companies
            Act, 2013, Reserve Bank of India (RBI) Foreign Exchange Management Act (FEMA) transfer pricing certification,
            or SEBI compliance valuation. Formal binding transaction consideration will be governed strictly by the
            definitive share purchase or asset transfer agreements.
          </p>
        </div>
      </div>
    </div>
  );
}
