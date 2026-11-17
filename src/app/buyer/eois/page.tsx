"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Loader2,
  Building2,
  Tag,
  ShieldCheck,
  HelpCircle,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BuyerEOIView, EOIStatus } from "@/types/eoi";

export default function BuyerEOIsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [eois, setEois] = useState<BuyerEOIView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Withdrawal state
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Clarification state
  const [clarifyEoi, setClarifyEoi] = useState<BuyerEOIView | null>(null);
  const [clarifyAnswer, setClarifyAnswer] = useState("");

  const fetchEOIs = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/v1/buyer/eois";
      if (statusFilter !== "ALL") {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setEois(json.data.items || []);
      } else {
        setError(json.error?.message || "Failed to load Expressions of Interest.");
      }
    } catch {
      setError("Network failure while retrieving EOI portfolio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/buyer/eois");
      return;
    }
    if (user) {
      fetchEOIs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, statusFilter]);

  const handleWithdraw = async (eoiId: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/buyer/eois/${eoiId}/withdraw`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success) {
        setWithdrawingId(null);
        fetchEOIs();
      } else {
        alert(json.error?.message || "Failed to withdraw EOI.");
      }
    } catch {
      alert("Network failure while withdrawing EOI.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswerClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyEoi || clarifyAnswer.trim().length < 10) return;

    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/buyer/eois/${clarifyEoi.id}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarificationAnswers: clarifyAnswer.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setClarifyEoi(null);
        setClarifyAnswer("");
        fetchEOIs();
      } else {
        alert(json.error?.message || "Failed to submit clarification.");
      }
    } catch {
      alert("Network failure while submitting clarification.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: EOIStatus) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Accepted</span>
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-red-100 text-red-800">
            <XCircle className="w-3.5 h-3.5" />
            <span>Declined</span>
          </span>
        );
      case "WITHDRAWN":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-slate-200 text-slate-700">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Withdrawn</span>
          </span>
        );
      case "CLARIFICATION_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Clarification Needed</span>
          </span>
        );
      case "UNDER_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-blue-100 text-blue-800">
            <Clock className="w-3.5 h-3.5" />
            <span>Under Review</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-slate-100 text-slate-800">
            <Send className="w-3.5 h-3.5 text-[#1557A6]" />
            <span>Submitted</span>
          </span>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#1557A6]" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Header */}
      <section className="bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Expressions of Interest (EOI) Portfolio
              </h1>
              <p className="text-xs text-[#D9E2EC] pt-1">
                Track formal commercial acquisition inquiries transmitted to verified business promoters.
              </p>
            </div>
            <Link
              href="/opportunities"
              className="px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              Browse Catalog
            </Link>
          </div>
        </div>
      </section>

      {/* Main Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 text-xs font-semibold">
          {["ALL", "SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED", "ACCEPTED", "DECLINED", "WITHDRAWN"].map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  statusFilter === s
                    ? "bg-[#1557A6] text-white shadow"
                    : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            )
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* EOI Items List */}
        {eois.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Send className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No Expressions of Interest Found
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven&apos;t submitted any Expressions of Interest matching this filter. Explore published business listings in the confidential catalog.
            </p>
            <Link
              href="/opportunities"
              className="inline-block px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow hover:bg-[#104789]"
            >
              Discover Opportunities
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {eois.map((eoi) => (
              <div
                key={eoi.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                      {eoi.referenceCode}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      Target Listing:{" "}
                      <Link
                        href={`/opportunities/${eoi.opportunityId}`}
                        className="font-bold text-[#1557A6] hover:underline"
                      >
                        {eoi.opportunityReference} — {eoi.opportunityTitle}
                      </Link>
                    </span>
                  </div>
                  <div>{getStatusBadge(eoi.status)}</div>
                </div>

                {/* Deal Details Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Interest Type</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.interestType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Proposed Structure</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.proposedTransactionType}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Indicative Range</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.indicativeOfferRange
                        ? eoi.indicativeOfferRange.replace(/_/g, " ")
                        : "Negotiable"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Investment Timeline</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.investmentTimeline.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Message Excerpt */}
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900 block mb-1">Your Submission Rationale:</span>
                  <p className="leading-relaxed">{eoi.buyerMessage}</p>
                </div>

                {/* Seller Dialogue / Clarification Notice */}
                {eoi.status === "CLARIFICATION_REQUESTED" && eoi.clarificationQuestions && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 space-y-2 text-xs">
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-700" />
                      <span>Promoter Question:</span>
                    </div>
                    <p className="text-amber-900 leading-relaxed font-medium">
                      {eoi.clarificationQuestions}
                    </p>
                    <button
                      onClick={() => setClarifyEoi(eoi)}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg text-xs"
                    >
                      Answer Clarification
                    </button>
                  </div>
                )}

                {/* Seller Response Message */}
                {eoi.sellerResponseMessage && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 space-y-1">
                    <span className="font-bold block">Promoter Message:</span>
                    <p className="leading-relaxed">{eoi.sellerResponseMessage}</p>
                  </div>
                )}

                {/* Decline Reason */}
                {eoi.status === "DECLINED" && eoi.sellerDeclineReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                    <span className="font-bold">Decline Reason: </span>
                    <span>{eoi.sellerDeclineReason.replace(/_/g, " ")}</span>
                  </div>
                )}

                {/* Footer / Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span>Submitted: {new Date(eoi.submittedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Expires: {new Date(eoi.expiresAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {eoi.status === "ACCEPTED" && (
                      <Link
                        href="/buyer/ndas"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white rounded font-bold transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Bilateral NDAs & Data Rooms</span>
                      </Link>
                    )}
                    {["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED"].includes(
                      eoi.status
                    ) && (
                      <button
                        onClick={() => setWithdrawingId(eoi.id)}
                        className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded font-semibold transition-colors"
                      >
                        Withdraw EOI
                      </button>
                    )}
                    <Link
                      href={`/opportunities/${eoi.opportunityId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold transition-colors"
                    >
                      <span>View Opportunity</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Withdraw Confirmation Modal */}
      {withdrawingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-200 text-center">
            <AlertCircle className="w-10 h-10 text-red-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Withdraw Expression of Interest?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to withdraw this EOI? The promoter will be notified that you are no longer actively pursuing this inquiry.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setWithdrawingId(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleWithdraw(withdrawingId)}
                disabled={actionLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
              >
                {actionLoading ? "Withdrawing..." : "Confirm Withdrawal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clarification Dialog Modal */}
      {clarifyEoi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Provide Clarification ({clarifyEoi.referenceCode})
            </h3>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-900">
              <span className="font-bold block">Promoter Inquiry:</span>
              <p className="pt-1">{clarifyEoi.clarificationQuestions}</p>
            </div>
            <form onSubmit={handleAnswerClarification} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">Your Response (Min 10 characters)</label>
                <textarea
                  rows={4}
                  value={clarifyAnswer}
                  onChange={(e) => setClarifyAnswer(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1557A6]"
                  placeholder="Provide structured clarification for the promoter..."
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setClarifyEoi(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {actionLoading ? "Submitting..." : "Submit Answer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
