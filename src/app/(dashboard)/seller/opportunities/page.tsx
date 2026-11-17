"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Plus,
  Building2,
  Calendar,
  Eye,
  Edit,
  Send,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Lock,
  Layers,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { OpportunityRecord, OpportunityStatus } from "@/types/opportunity";

export default function SellerOpportunitiesPage() {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<OpportunityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchOpportunities = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/seller/opportunities");
      const json = await res.json();
      if (json.success) {
        setOpportunities(json.data.opportunities || []);
      } else {
        setError(json.error?.message || "Failed to load opportunities");
      }
    } catch {
      setError("An unexpected network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpportunities();
  }, []);

  const handleSubmitForReview = async (oppId: string) => {
    if (!confirm("Are you sure you want to submit this opportunity for Scale-up India administrative verification? The listing will be locked from further edits during review.")) {
      return;
    }
    setSubmittingId(oppId);
    setActionSuccess(null);
    setError(null);
    try {
      const res = await fetch(`/api/v1/seller/opportunities/${oppId}/submit`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setActionSuccess("Opportunity submitted for platform verification successfully.");
        await fetchOpportunities();
      } else {
        setError(json.error?.message || "Failed to submit opportunity");
      }
    } catch {
      setError("Network failure while submitting opportunity.");
    } finally {
      setSubmittingId(null);
    }
  };

  const getStatusBadge = (status: OpportunityStatus) => {
    switch (status) {
      case OpportunityStatus.DRAFT:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Draft</span>
          </span>
        );
      case OpportunityStatus.SUBMITTED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-500" />
            <span>Submitted for Review</span>
          </span>
        );
      case OpportunityStatus.UNDER_REVIEW:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>Under Active Diligence</span>
          </span>
        );
      case OpportunityStatus.VERIFIED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
            <CheckCircle2 className="w-3 h-3 text-teal-500" />
            <span>Verified Ready</span>
          </span>
        );
      case OpportunityStatus.PUBLISHED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Live & Published</span>
          </span>
        );
      case OpportunityStatus.CHANGES_REQUESTED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3 h-3 text-amber-600" />
            <span>Changes Requested</span>
          </span>
        );
      case OpportunityStatus.REJECTED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">
            <XCircle className="w-3 h-3 text-red-500" />
            <span>Rejected</span>
          </span>
        );
      case OpportunityStatus.SUSPENDED:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300">
            <AlertTriangle className="w-3 h-3 text-slate-600" />
            <span>Suspended</span>
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
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3 py-0.5 rounded-full text-xs text-[#D9E2EC]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1557A6]" />
              <span>Promoter Deal Room & Listings</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Business Opportunities Management
            </h1>
            <p className="text-xs sm:text-sm text-[#D9E2EC] max-w-2xl leading-relaxed">
              Create, review, and manage your confidential business offerings. Each opportunity is reviewed by Scale-up India corporate advisors before publication to qualified acquirers.
            </p>
          </div>

          <Link
            href="/seller/opportunities/new"
            className="px-5 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow-md transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Opportunity</span>
          </Link>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {actionSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Loading your listed opportunities...</p>
          </div>
        ) : opportunities.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#1557A6]/10 text-[#1557A6] flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No Business Opportunities Created Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Launch your first confidential business offering to connect with pre-screened institutional acquirers and growth investors.
            </p>
            <Link
              href="/seller/opportunities/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Opportunity</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <span>
                You have <strong className="text-slate-900">{opportunities.length}</strong> listed opportunity/opportunities.
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {opportunities.map((opp) => {
                const canEdit =
                  opp.status === OpportunityStatus.DRAFT ||
                  opp.status === OpportunityStatus.CHANGES_REQUESTED;
                const canSubmit = canEdit;

                return (
                  <div
                    key={opp.id}
                    className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-slate-800">
                          {opp.referenceCode}
                        </span>
                        {getStatusBadge(opp.status)}
                      </div>

                      <div className="text-[11px] text-slate-500">
                        Created on {new Date(opp.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                      <div className="md:col-span-3 space-y-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {opp.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {opp.teaserSummary}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 pt-1">
                          <span className="font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {opp.industry}
                          </span>
                          <span>•</span>
                          <span className="font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {opp.operatingRegion.replace(/_/g, " ")}
                          </span>
                          <span>•</span>
                          <span className="font-bold text-[#1557A6] bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {opp.revenueBracket.replace(/_/g, " ")}
                          </span>
                          <span>•</span>
                          <span className="font-medium bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                            {opp.transactionType.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>

                      {/* Action Desk */}
                      <div className="flex flex-col gap-2 pt-2 md:pt-0">
                        {canEdit && (
                          <Link
                            href={`/seller/opportunities/${opp.id}/edit`}
                            className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-sm transition-colors text-center flex items-center justify-center gap-1.5"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Opportunity</span>
                          </Link>
                        )}

                        {canSubmit && (
                          <button
                            disabled={submittingId === opp.id}
                            onClick={() => handleSubmitForReview(opp.id)}
                            className="w-full py-2 px-3 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {submittingId === opp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Send className="w-3.5 h-3.5" />
                            )}
                            <span>Submit for Review</span>
                          </button>
                        )}

                        <Link
                          href={`/opportunities/${opp.id}`}
                          className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-md transition-colors text-center flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Public Teaser</span>
                        </Link>
                      </div>
                    </div>

                    {/* Review Feedback Alert */}
                    {opp.status === OpportunityStatus.CHANGES_REQUESTED && opp.changesRequestedNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-amber-800">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Platform Reviewer Feedback:
                        </span>
                        <p>{opp.changesRequestedNotes}</p>
                      </div>
                    )}

                    {opp.status === OpportunityStatus.REJECTED && opp.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 space-y-1">
                        <span className="font-bold flex items-center gap-1 text-red-800">
                          <XCircle className="w-3.5 h-3.5" />
                          Rejection Reason:
                        </span>
                        <p>{opp.rejectionReason}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
