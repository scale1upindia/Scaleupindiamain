"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderLock,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DiligenceCaseOverviewView, DiligenceCaseStatus } from "@/types/diligence";

export default function BuyerDiligencePortfolioPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [cases, setCases] = useState<DiligenceCaseOverviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/buyer/diligence");
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
      const res = await fetch("/api/v1/diligence-cases");
      const json = await res.json();
      if (json.success) {
        setCases(json.data.cases);
      } else {
        setError(json.error?.message || "Failed to load due diligence cases.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  const filteredCases = cases.filter((c) => {
    const matchesStatus = filterStatus === "ALL" || c.status === filterStatus;
    const matchesSearch =
      searchQuery === "" ||
      c.referenceCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.opportunityTitle.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: DiligenceCaseStatus) => {
    switch (status) {
      case "INITIATED":
      case "REQUESTS_OPEN":
      case "DOCUMENTS_SUBMITTED":
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Investigation
          </span>
        );
      case "REVIEW_COMPLETE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            Review Complete
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            Approved
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            Closed
          </span>
        );
      case "CREATED":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            Created
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/buyer/mous" className="hover:text-gray-900 transition-colors">
            Deal Intent MOUs
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-semibold text-gray-800">Due Diligence Workspaces</span>
        </div>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-[#1557A6]/10 rounded-xl text-[#1557A6]">
                  <FolderLock className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Buyer Due Diligence Portfolio
                  </h1>
                  <p className="text-xs text-gray-500">
                    Structured M&A investigation workspaces with cryptographic evidence integrity & risk tracking
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/buyer/mous"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 hover:bg-[#1557A6]/20 rounded-xl transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                View Eligible MOUs
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <span className="text-xs text-gray-500 block">Total Workspaces</span>
              <span className="text-xl font-bold text-gray-900 mt-0.5 block">{cases.length}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
              <span className="text-xs text-emerald-800 block">Active Workspaces</span>
              <span className="text-xl font-bold text-emerald-950 mt-0.5 block">
                {cases.filter((c) => ["INITIATED", "REQUESTS_OPEN", "DOCUMENTS_SUBMITTED", "UNDER_REVIEW"].includes(c.status)).length}
              </span>
            </div>
            <div className="bg-teal-50 border border-teal-100 rounded-xl p-3.5">
              <span className="text-xs text-teal-800 block">Approved Clear</span>
              <span className="text-xl font-bold text-teal-950 mt-0.5 block">
                {cases.filter((c) => c.status === "APPROVED").length}
              </span>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5">
              <span className="text-xs text-rose-800 block">Rejected / Critical</span>
              <span className="text-xl font-bold text-rose-950 mt-0.5 block">
                {cases.filter((c) => c.status === "REJECTED").length}
              </span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Case Ref or Title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {["ALL", "INITIATED", "UNDER_REVIEW", "REVIEW_COMPLETE", "APPROVED", "REJECTED", "CLOSED"].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    filterStatus === st
                      ? "bg-[#1557A6] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {st.replace(/_/g, " ")}
                </button>
              )
            )}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
            <Loader2 className="w-8 h-8 animate-spin text-[#1557A6]" />
            <p className="text-xs text-gray-500 mt-2">Loading due diligence portfolio...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-xs font-medium">{error}</p>
          </div>
        ) : filteredCases.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <FolderLock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">No Due Diligence Cases Found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Due Diligence Workspaces are activated once a Bilateral Deal Intent MOU is accepted and transaction token escrow deposit is confirmed.
              </p>
            </div>
            <div>
              <Link
                href="/buyer/mous"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1e4854] transition-colors"
              >
                Go to Bilateral MOUs
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCases.map((c) => {
              const progressPct = c.stats.completionPercentage;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 px-2.5 py-1 rounded-md">
                        {c.referenceCode}
                      </span>
                      {getStatusBadge(c.status)}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-gray-900 line-clamp-1">
                        {c.opportunityTitle}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Building2 className="w-3.5 h-3.5 text-gray-400" />
                        <span>MOU Ref: {c.mouReferenceCode}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-medium">Checklist Verification</span>
                        <span className="text-gray-900 font-bold">{progressPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1557A6] rounded-full transition-all duration-300"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>{c.stats.completedItems} verified of {c.stats.totalItems} items</span>
                        <span>{c.stats.totalEvidence} evidence files</span>
                      </div>
                    </div>

                    {/* Metrics Pills */}
                    <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-gray-400 block text-[10px]">Requests</span>
                        <span className="font-bold text-gray-800">{c.stats.openRequests} Open</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                        <span className="text-gray-400 block text-[10px]">Clarifications</span>
                        <span className="font-bold text-gray-800">{c.stats.openClarifications} Open</span>
                      </div>
                      <div className={`p-2 rounded-lg border ${
                        c.stats.criticalFindings > 0
                          ? "bg-rose-50 border-rose-200 text-rose-800"
                          : "bg-slate-50 border-slate-100 text-gray-800"
                      }`}>
                        <span className="block text-[10px] opacity-75">Findings</span>
                        <span className="font-bold">
                          {c.stats.criticalFindings > 0 ? `${c.stats.criticalFindings} Critical` : `${c.stats.highFindings} High Risk`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[11px] text-gray-400">
                      Opened {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <Link
                      href={`/buyer/diligence/${c.id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
                    >
                      Enter Workspace
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
