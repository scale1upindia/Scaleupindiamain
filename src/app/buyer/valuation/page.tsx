// Scale-up India — Phase 13: Buyer Valuation Portfolio
// Path: src/app/buyer/valuation/page.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calculator,
  TrendingUp,
  ShieldCheck,
  Clock,
  ArrowRight,
  PlusCircle,
  FileText,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { ValuationCaseOverviewView } from "@/types/valuation";

export default function BuyerValuationPortfolioPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ValuationCaseOverviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCases() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/valuations");
        const json = await res.json();
        if (json.success) {
          setCases(json.data.cases || []);
        } else {
          setError(json.error?.message || "Failed to load valuation cases.");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading valuations.");
      } finally {
        setLoading(false);
      }
    }
    fetchCases();
  }, []);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Approved</span>;
      case "LOCKED":
        return <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 text-xs font-semibold rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>;
      case "SUBMITTED":
      case "UNDER_REVIEW":
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex items-center gap-1"><Clock className="w-3 h-3" /> In Review</span>;
      case "REVISION_REQUIRED":
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Revision Req</span>;
      default:
        return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">Draft (V1)</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 pb-20">
      {/* Header */}
      <div className="bg-[#1557A6] text-white py-12 px-6">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wide">
            <Calculator className="w-3.5 h-3.5 text-[#1557A6]" />
            PHASE 13 • VALUATION ENGINE
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Verified Valuation Workspaces</h1>
          <p className="text-[#D9E2EC] text-sm max-w-2xl">
            Deterministic, multi-methodology, evidence-linked financial valuation models with scenario analysis and audit provenance.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Disclaimer Notice */}
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-bold">Non-Binding Indicative Valuation Notice:</span> Valuations generated on Scale-up India are deterministic estimates based on provided financial evidence, market multiples, and economic assumptions. They do not constitute a guaranteed market price, legal fairness opinion, or binding purchase contract.
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4">
            <Calculator className="w-12 h-12 text-gray-400 mx-auto" />
            <h3 className="text-base font-bold text-gray-900">No Valuation Workspaces Found</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Valuation workspaces are initialized from active Due Diligence cases once prerequisite escrow deposits are confirmed.
            </p>
            <Link
              href="/buyer/diligence"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1f4e5b] transition-colors"
            >
              View Due Diligence Cases
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cases.map((c) => {
              const activeVer = c.activeVersion;
              const range = activeVer?.calculationResults?.range;
              const ev = activeVer?.calculationResults?.indicativeEnterpriseValue;
              const conf = activeVer?.confidenceLevel || "LOW";

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                        {c.referenceCode}
                      </span>
                      {getStatusBadge(c.status)}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-gray-900 line-clamp-1">
                        {c.opportunityTitle || "Acquisition Opportunity"}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono">
                        MOU: {c.mouReferenceCode || "MOU"} • DD: {c.diligenceReferenceCode || "DD"}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-3.5 rounded-xl space-y-1.5 border border-gray-100">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Indicative EV:</span>
                        <span className="font-bold text-gray-900">{formatCurrency(ev)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Valuation Range:</span>
                        <span className="font-medium text-gray-700">
                          {range?.status === "AVAILABLE"
                            ? `${formatCurrency(range.lowEnterpriseValue)} - ${formatCurrency(range.highEnterpriseValue)}`
                            : "Calculating..."}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Confidence:</span>
                        <span
                          className={`font-bold ${
                            conf === "HIGH"
                              ? "text-emerald-700"
                              : conf === "MEDIUM"
                              ? "text-amber-700"
                              : "text-gray-700"
                          }`}
                        >
                          {conf} ({activeVer?.confidenceScore ?? 0}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      Version V{c.currentVersionNumber}
                    </span>
                    <Link
                      href={`/buyer/valuation/${c.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1557A6] hover:text-[#1f4e5b]"
                    >
                      Open Model
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
