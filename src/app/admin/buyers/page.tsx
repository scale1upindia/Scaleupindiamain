"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  FileText,
  Eye,
  ShieldAlert,
  ArrowLeft,
  Ban,
  Target,
} from "lucide-react";

interface AdminBuyerItem {
  id: string;
  userId: string;
  buyerType: string;
  legalName: string;
  tradeName: string | null;
  entityType: string;
  country: string;
  state: string;
  city: string;
  contactName: string;
  email: string;
  phone: string;
  onboardingStatus: string;
  completionPercentage: number;
  mandateCount: number;
  submittedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

const STATUS_FILTERS = [
  { label: "All Buyers", value: "" },
  { label: "Submitted", value: "SUBMITTED" },
  { label: "Under Review", value: "UNDER_REVIEW" },
  { label: "Changes Requested", value: "CHANGES_REQUESTED" },
  { label: "Verified", value: "VERIFIED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Suspended", value: "SUSPENDED" },
  { label: "Drafts", value: "DRAFT" },
];

export default function AdminBuyersPage() {
  const { user, loading: authLoading } = useAuth();
  const [buyers, setBuyers] = useState<AdminBuyerItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAuthorized =
    user &&
    (user.permissions.includes("buyers.read") ||
      user.roles.some((r) =>
        ["SUPER_ADMIN", "ADMIN", "VERIFICATION_MANAGER"].includes(r)
      ));

  const fetchBuyers = useCallback(async () => {
    if (!isAuthorized) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchTerm) params.set("search", searchTerm);
      params.set("page", page.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/v1/admin/buyers?${params.toString()}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to fetch buyer dossiers.");
      }

      setBuyers(json.data.items);
      setTotal(json.data.total);
      setTotalPages(json.data.totalPages);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, statusFilter, searchTerm, page]);

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      fetchBuyers();
    }
  }, [authLoading, isAuthorized, fetchBuyers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBuyers();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Submitted
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
            <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
            Under Review
          </span>
        );
      case "CHANGES_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <AlertCircle className="w-3 h-3 text-purple-600" />
            Changes Requested
          </span>
        );
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-900 border border-red-300">
            <Ban className="w-3 h-3 text-red-700" />
            Suspended
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1557A6]" />
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Restricted Console</h2>
          <p className="text-sm text-slate-600">
            Administrative credentials with `buyers.read` authorization are required to access this console.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#1557A6] text-white flex items-center justify-center shadow-md">
              <Target className="w-6 h-6 text-[#1557A6]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Buyer & Investor Verification Desk
                </h1>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Phase 3 Active
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Vetting institutional acquirers, PE/VC funds, corporate buyers, and active investment mandates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/sellers"
              className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200 transition"
            >
              Seller Queue
            </Link>
            <button
              onClick={() => fetchBuyers()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1557A6] bg-[#EEF5FB] hover:bg-[#EEF5FB] rounded-md transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Buyers
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{total}</div>
          </div>
          <div className="bg-amber-50/60 rounded-lg p-3 border border-amber-100">
            <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
              Awaiting Review
            </div>
            <div className="text-2xl font-bold text-amber-900 mt-0.5">
              {buyers.filter((b) => b.onboardingStatus === "SUBMITTED").length}
            </div>
          </div>
          <div className="bg-blue-50/60 rounded-lg p-3 border border-blue-100">
            <div className="text-[11px] font-medium text-blue-700 uppercase tracking-wider">
              Under Diligence
            </div>
            <div className="text-2xl font-bold text-blue-900 mt-0.5">
              {buyers.filter((b) => b.onboardingStatus === "UNDER_REVIEW").length}
            </div>
          </div>
          <div className="bg-emerald-50/60 rounded-lg p-3 border border-emerald-100">
            <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
              Verified Acquirers
            </div>
            <div className="text-2xl font-bold text-emerald-900 mt-0.5">
              {buyers.filter((b) => b.onboardingStatus === "VERIFIED").length}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_FILTERS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  statusFilter === tab.value
                    ? "bg-[#1557A6] text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-80">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search legal name, rep, email..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1557A6]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#1557A6] text-white text-xs font-medium rounded-md hover:bg-[#104789] transition shadow-sm"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Buyers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200 flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-[#1557A6]" />
            <span className="text-xs font-medium">Loading buyer dossiers...</span>
          </div>
        ) : buyers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-2">
            <Briefcase className="w-10 h-10 text-slate-300 stroke-[1.5]" />
            <p className="text-sm font-medium text-slate-700">No buyer profiles found</p>
            <p className="text-xs text-slate-400">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Entity & Persona</th>
                  <th className="py-3 px-4">Authorized Contact</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Mandates</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {buyers.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{b.legalName}</div>
                      <div className="text-[11px] text-slate-500">{b.buyerType.replace(/_/g, " ")} • {b.entityType}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{b.contactName}</div>
                      <div className="text-[11px] text-slate-500">{b.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {b.city}, {b.state}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#EEF5FB] text-[#1557A6]">
                        {b.mandateCount} Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(b.onboardingStatus)}</td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(b.updatedAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/buyers/${b.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white rounded text-xs font-semibold shadow-sm transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Mandate</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
            <div>
              Showing page <span className="font-semibold">{page}</span> of{" "}
              <span className="font-semibold">{totalPages}</span> ({total} total buyers)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium disabled:opacity-50 hover:bg-slate-50 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 rounded text-xs font-medium disabled:opacity-50 hover:bg-slate-50 transition"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

