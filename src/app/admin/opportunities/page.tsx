"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Eye,
  FileCheck2,
  Building2,
  MapPin,
  Loader2,
} from "lucide-react";
import { OpportunityRecord, OpportunityStatus } from "@/types/opportunity";

export default function AdminOpportunitiesQueuePage() {
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/v1/admin/opportunities?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setOpportunities(json.data.opportunities || []);
      } else {
        setError(json.error?.message || "Failed to load opportunities queue");
      }
    } catch {
      setError("Network error while querying administrative opportunities.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = opportunities.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.referenceCode.toLowerCase().includes(q) ||
      o.title.toLowerCase().includes(q) ||
      o.industry.toLowerCase().includes(q) ||
      (o.exactLegalName && o.exactLegalName.toLowerCase().includes(q))
    );
  });

  const getStatusBadge = (status: OpportunityStatus) => {
    switch (status) {
      case OpportunityStatus.DRAFT:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
            Draft
          </span>
        );
      case OpportunityStatus.SUBMITTED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            Submitted
          </span>
        );
      case OpportunityStatus.UNDER_REVIEW:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
            Under Review
          </span>
        );
      case OpportunityStatus.VERIFIED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
            Verified Ready
          </span>
        );
      case OpportunityStatus.PUBLISHED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
            Published Live
          </span>
        );
      case OpportunityStatus.CHANGES_REQUESTED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            Changes Requested
          </span>
        );
      case OpportunityStatus.REJECTED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
            Rejected
          </span>
        );
      case OpportunityStatus.SUSPENDED:
        return (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
            Suspended
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Header */}
      <section className="bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-7xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-0.5 rounded-full text-xs text-[#D9E2EC]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1557A6]" />
            <span>Scale-up India Deal Desk • Diligence Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Opportunity Verification & Curation Desk
          </h1>
          <p className="text-xs sm:text-sm text-[#D9E2EC] max-w-3xl leading-relaxed">
            Review submitted promoter offerings, audit statutory documents, inspect CIN/GSTIN registrations, request amendments, and publish curated deals to the discovery catalog.
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Tabs Bar */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3 text-xs">
            {[
              "ALL",
              OpportunityStatus.SUBMITTED,
              OpportunityStatus.UNDER_REVIEW,
              OpportunityStatus.VERIFIED,
              OpportunityStatus.PUBLISHED,
              OpportunityStatus.CHANGES_REQUESTED,
              OpportunityStatus.REJECTED,
              OpportunityStatus.SUSPENDED,
            ].map((tab) => {
              const isSelected = statusFilter === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                    isSelected
                      ? "bg-[#1557A6] text-white shadow-sm"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {tab.replace(/_/g, " ")}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ref code (OPP-2026-XXXX), headline, sector, or exact legal name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Results List */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Loading opportunity review queue...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-3">
            <Layers className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Opportunities Found</h3>
            <p className="text-xs text-slate-500">
              No listings currently match the selected status filter or search parameters.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span>
                Showing <strong className="text-slate-900">{filtered.length}</strong> opportunities
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Ref Code</th>
                      <th className="py-3 px-4">Teaser Title & Legal Entity</th>
                      <th className="py-3 px-4">Sector & Region</th>
                      <th className="py-3 px-4">Revenue Scale</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((opp) => (
                      <tr key={opp.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                          {opp.referenceCode}
                        </td>
                        <td className="py-3 px-4 max-w-xs">
                          <p className="font-bold text-slate-900 line-clamp-1">{opp.title}</p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {opp.exactLegalName || "Unspecified Legal Name"}
                          </p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800">{opp.industry}</span>
                          <span className="text-[11px] text-slate-500 block">
                            {opp.operatingRegion.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#1557A6] whitespace-nowrap">
                          {opp.revenueBracket.replace(/_/g, " ")}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{getStatusBadge(opp.status)}</td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {opp.submittedAt ? new Date(opp.submittedAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <Link
                            href={`/admin/opportunities/${opp.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white text-[11px] font-bold rounded shadow-sm transition-colors"
                          >
                            <span>Inspect & Review</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
