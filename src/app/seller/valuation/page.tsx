"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Building2,
  TrendingUp,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  ShieldCheck,
  ChevronRight,
  Info,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ValuationCaseOverviewView, ValuationCaseStatus, ValuationConfidenceLevel } from "@/types/valuation";

export default function SellerValuationPortfolioPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [cases, setCases] = useState<ValuationCaseOverviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/seller/valuation");
      return;
    }
    if (user) {
      fetchCases();
    }
  }, [user, authLoading]);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/valuations");
      const json = await res.json();
      if (json.success) {
        setCases(json.data.cases);
      } else {
        setError(json.error?.message || "Failed to load valuation cases.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    return (
      searchQuery === "" ||
      c.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.opportunityTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.diligenceReferenceCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getStatusBadge = (status: ValuationCaseStatus) => {
    switch (status) {
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Buyer Modeling (Draft)
          </span>
        );
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Submitted for Review
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <TrendingUp className="w-3 h-3 text-blue-600" />
            Under Internal Review
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified &amp; Approved
          </span>
        );
      case "LOCKED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Lock className="w-3 h-3 text-purple-600" />
            Locked Version
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  const getConfidenceBadge = (level: ValuationConfidenceLevel) => {
    switch (level) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-3 h-3" />
            High Confidence
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <AlertCircle className="w-3 h-3" />
            Medium Confidence
          </span>
        );
      case "LOW":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertTriangle className="w-3 h-3" />
            Low Confidence
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <Link href="/seller/diligence" className="hover:text-gray-900 transition-colors">
            Due Diligence
          </Link>
          <ChevronRight className="w-4 h-4 text-gray-400" />
          <span className="text-gray-900 font-medium">Valuation Desk</span>
        </nav>

        {/* Header Banner */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-teal-50 rounded-xl text-teal-800 border border-teal-100">
                <Calculator className="w-6 h-6 text-[#1557A6]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Seller Valuation Desk</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review progressive, evidence-linked indicative valuation models prepared by prospective acquirers.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/seller/diligence"
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Building2 className="w-4 h-4 text-gray-500" />
              Due Diligence Workspaces
            </Link>
          </div>
        </div>

        {/* Legal & Regulatory Disclaimer Notice */}
        <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-900">
          <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-blue-950">
              Confidentiality &amp; Indicative Pricing Transparency:
            </span>
            <p className="text-blue-800 leading-relaxed text-xs">
              Valuations shown in this desk represent indicative mathematical ranges calculated by prospective acquirers
              anchored on verified due diligence evidence. Pursuant to progressive confidentiality protocols, buyer-proprietary
              internal strategic notes and tactical adjustment papers are masked. Indicative models do not constitute a statutory
              fairness opinion, registered valuer certificate under Indian Companies Act / FEMA, or guaranteed buyout offer.
            </p>
          </div>
        </div>

        {/* Controls: Search and Filter */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, title, or diligence reference..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
            />
          </div>
          <div className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{filteredCases.length}</span> valuation workspaces
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading valuation workspaces...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-rose-900">Failed to load workspaces</h3>
            <p className="text-xs text-rose-700 mt-1">{error}</p>
            <button
              onClick={fetchCases}
              className="mt-4 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-3">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-semibold text-gray-900">No Valuation Workspaces Available</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Valuation workspaces are established by verified prospective acquirers once bilateral NDA execution,
              Deal Intent MOU acceptance, escrow token deposit, and active Due Diligence are verified.
            </p>
            <div className="pt-2">
              <Link
                href="/seller/diligence"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white rounded-lg text-xs font-semibold hover:bg-[#235360] transition-colors"
              >
                Go to Due Diligence Desk
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCases.map((c) => {
              const activeVer = c.activeVersion;
              const range = activeVer?.calculationResults?.range;
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border border-gray-200 hover:border-teal-300 hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Header: Reference and Status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                        {c.referenceCode}
                      </span>
                      {getStatusBadge(c.status)}
                    </div>

                    {/* Opportunity Info */}
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 line-clamp-1">
                        {c.opportunityTitle}
                      </h3>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        DD Ref: <span className="font-mono font-medium">{c.diligenceReferenceCode}</span>
                      </p>
                    </div>

                    {/* Indicative Range Box */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg space-y-1">
                      <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Indicative Enterprise Value Range
                      </div>
                      <div className="text-sm font-bold text-gray-900">
                        {range?.lowEnterpriseValue && range?.highEnterpriseValue
                          ? `${formatCurrency(range.lowEnterpriseValue)} – ${formatCurrency(range.highEnterpriseValue)}`
                          : range?.baseEnterpriseValue
                          ? formatCurrency(range.baseEnterpriseValue)
                          : "Calculations in Progress"}
                      </div>
                      {range?.baseEnterpriseValue && (
                        <div className="text-xs text-teal-700 font-medium">
                          Base EV: {formatCurrency(range.baseEnterpriseValue)}
                        </div>
                      )}
                    </div>

                    {/* Confidence & Version Meta */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <span className="text-gray-500">
                        Version: <span className="font-semibold text-gray-700">V{c.currentVersionNumber}</span>
                      </span>
                      {activeVer && getConfidenceBadge(activeVer.confidenceLevel)}
                    </div>
                  </div>

                  {/* Footer Action */}
                  <div className="px-5 py-3 bg-gray-50/70 border-t border-gray-100 flex items-center justify-end">
                    <Link
                      href={`/seller/valuation/${c.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1557A6] hover:text-[#235360] transition-colors"
                    >
                      View Valuation Summary
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
