"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Loader2,
  Building2,
  ShieldCheck,
  MapPin,
  TrendingUp,
  Send,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SellerEOIView, EOIStatus, EOIDeclineReason } from "@/types/eoi";

export default function SellerEOIsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [eois, setEois] = useState<SellerEOIView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Action Modals State
  const [acceptModalEoi, setAcceptModalEoi] = useState<SellerEOIView | null>(null);
  const [acceptMessage, setAcceptMessage] = useState("");

  const [declineModalEoi, setDeclineModalEoi] = useState<SellerEOIView | null>(null);
  const [declineReason, setDeclineReason] = useState<EOIDeclineReason>("VALUATION_MISMATCH");
  const [declineMessage, setDeclineMessage] = useState("");

  const [clarifyModalEoi, setClarifyModalEoi] = useState<SellerEOIView | null>(null);
  const [clarifyQuestion, setClarifyQuestion] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const fetchEOIs = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = "/api/v1/seller/eois";
      if (statusFilter !== "ALL") {
        url += `?status=${statusFilter}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setEois(json.data.items || []);
      } else {
        setError(json.error?.message || "Failed to load received Expressions of Interest.");
      }
    } catch {
      setError("Network failure while retrieving seller inbox.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/seller/eois");
      return;
    }
    if (user) {
      fetchEOIs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, statusFilter]);

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptModalEoi) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/v1/seller/eois/${acceptModalEoi.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerResponseMessage: acceptMessage.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setAcceptModalEoi(null);
        setAcceptMessage("");
        fetchEOIs();
      } else {
        alert(json.error?.message || "Failed to accept EOI.");
      }
    } catch {
      alert("Network failure while accepting EOI.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!declineModalEoi) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/v1/seller/eois/${declineModalEoi.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerDeclineReason: declineReason,
          sellerResponseMessage: declineMessage.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setDeclineModalEoi(null);
        setDeclineMessage("");
        fetchEOIs();
      } else {
        alert(json.error?.message || "Failed to decline EOI.");
      }
    } catch {
      alert("Network failure while declining EOI.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClarify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyModalEoi || clarifyQuestion.trim().length < 10) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/v1/seller/eois/${clarifyModalEoi.id}/clarify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clarificationQuestions: clarifyQuestion.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setClarifyModalEoi(null);
        setClarifyQuestion("");
        fetchEOIs();
      } else {
        alert(json.error?.message || "Failed to request clarification.");
      }
    } catch {
      alert("Network failure while requesting clarification.");
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
            <span>Withdrawn by Buyer</span>
          </span>
        );
      case "CLARIFICATION_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-100 text-amber-800">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Clarification Awaited</span>
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
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Inbox className="w-3.5 h-3.5" />
            <span>New Submission</span>
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
                Seller EOI Review Desk
              </h1>
              <p className="text-xs text-[#D9E2EC] pt-1">
                Evaluate incoming acquisition inquiries and strategic investment interest from verified buyers.
              </p>
            </div>
            <Link
              href="/seller/opportunities"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg border border-white/20 transition-colors"
            >
              My Listings
            </Link>
          </div>
        </div>
      </section>

      {/* Main Body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4 text-xs font-semibold">
          {["ALL", "SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED", "ACCEPTED", "DECLINED"].map((s) => (
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
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {/* EOI List */}
        {eois.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              No Received Expressions of Interest
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              You haven&apos;t received any buyer inquiries matching this filter yet. Ensure your listings are published and verified.
            </p>
            <Link
              href="/seller/opportunities"
              className="inline-block px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow hover:bg-[#104789]"
            >
              Manage Listings
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {eois.map((eoi) => (
              <div
                key={eoi.id}
                className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold bg-[#1557A6]/10 text-[#1557A6] px-2.5 py-1 rounded">
                      {eoi.referenceCode}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500">
                      Listing:{" "}
                      <strong className="text-slate-800">
                        {eoi.opportunityReference} — {eoi.opportunityTitle}
                      </strong>
                    </span>
                  </div>
                  <div>{getStatusBadge(eoi.status)}</div>
                </div>

                {/* Safe Buyer Profile Box */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#1557A6]" />
                      <span>Safe Buyer Summary (Confidential Profile)</span>
                    </div>

                    {eoi.matchScore !== null && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{eoi.matchScore}% Mandate Match</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Entity Classification</span>
                      <span className="font-semibold text-slate-800">
                        {eoi.buyerEntityType.replace(/_/g, " ")} ({eoi.buyerType.replace(/_/g, " ")})
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Sector / Focus</span>
                      <span className="font-semibold text-slate-800">
                        {eoi.buyerIndustry || "Diversified / General"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Operating Base</span>
                      <span className="font-semibold text-slate-800">{eoi.buyerLocation}</span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Proposed Deal Type</span>
                      <span className="font-semibold text-slate-800">
                        {eoi.proposedTransactionType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Commercial Offer */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Interest Structure</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.interestType.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Indicative Offer Range</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.indicativeOfferRange
                        ? eoi.indicativeOfferRange.replace(/_/g, " ")
                        : "Negotiable"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Target Timeline</span>
                    <span className="font-semibold text-slate-800">
                      {eoi.investmentTimeline.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>

                {/* Buyer Message */}
                <div className="bg-white rounded-lg border border-slate-200 p-3 text-xs space-y-1">
                  <span className="font-bold text-slate-900 block">Buyer Rationale:</span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {eoi.buyerMessage}
                  </p>
                </div>

                {/* Clarification Dialogue if active */}
                {eoi.clarificationQuestions && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
                    <span className="font-bold text-amber-950 block">Your Clarification Request:</span>
                    <p className="text-amber-900">{eoi.clarificationQuestions}</p>
                    {eoi.clarificationAnswers && (
                      <div className="pt-2 border-t border-amber-200">
                        <span className="font-bold text-emerald-950 block">Buyer Clarification Answer:</span>
                        <p className="text-emerald-900">{eoi.clarificationAnswers}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Response / Decision Display */}
                {eoi.status === "ACCEPTED" && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Expression of Interest Formally Accepted</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Scale-up India will initiate Phase 8 bilateral NDA execution and transaction room staging.
                    </p>
                  </div>
                )}

                {eoi.status === "DECLINED" && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900">
                    <span className="font-bold">Declined Reason: </span>
                    <span>{eoi.sellerDeclineReason?.replace(/_/g, " ")}</span>
                  </div>
                )}

                {/* Actions & Decision Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <span>Submitted: {new Date(eoi.submittedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Expires: {new Date(eoi.expiresAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {eoi.status === "ACCEPTED" && (
                      <Link
                        href="/seller/ndas"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white rounded font-bold transition-colors"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Bilateral NDAs & Data Rooms</span>
                      </Link>
                    )}
                    {["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED"].includes(
                      eoi.status
                    ) && (
                      <>
                        <button
                          onClick={() => {
                            setClarifyModalEoi(eoi);
                            setClarifyQuestion("");
                          }}
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded font-semibold transition-colors"
                        >
                          Request Clarification
                        </button>
                        <button
                          onClick={() => {
                            setDeclineModalEoi(eoi);
                            setDeclineMessage("");
                          }}
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded font-semibold transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => {
                            setAcceptModalEoi(eoi);
                            setAcceptMessage("");
                          }}
                          className="px-4 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white rounded font-bold shadow-sm transition-colors"
                        >
                          Accept EOI
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Accept EOI Modal */}
      {acceptModalEoi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Accept Expression of Interest
                </h3>
                <p className="text-xs text-slate-500">
                  EOI Reference: {acceptModalEoi.referenceCode}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Accepting this Expression of Interest indicates your willingness to proceed toward a bilateral Non-Disclosure Agreement (NDA) and confidential discussions orchestrated by Scale-up India.
            </p>

            <form onSubmit={handleAccept} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Optional Note to Prospective Buyer
                </label>
                <textarea
                  rows={3}
                  value={acceptMessage}
                  onChange={(e) => setAcceptMessage(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-[#1557A6]"
                  placeholder="e.g. Pleased to proceed to mutual NDA and preliminary commercial briefing..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAcceptModalEoi(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Confirm Acceptance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline EOI Modal */}
      {declineModalEoi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Decline Expression of Interest ({declineModalEoi.referenceCode})
            </h3>
            <form onSubmit={handleDecline} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Reason for Declining</label>
                <select
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value as EOIDeclineReason)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white"
                >
                  <option value="VALUATION_MISMATCH">Valuation Mismatch</option>
                  <option value="STRATEGY_MISMATCH">Strategic / Synergy Mismatch</option>
                  <option value="CAPACITY_CONCERN">Capital / Capacity Concern</option>
                  <option value="ALREADY_COMMITTED">Currently Committed to Another Acquirer</option>
                  <option value="NOT_ACCEPTING_OFFERS">No Longer Accepting Inquiries for Listing</option>
                  <option value="OTHER">Other Commercial Reason</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Optional Courteous Explanation</label>
                <textarea
                  rows={3}
                  value={declineMessage}
                  onChange={(e) => setDeclineMessage(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  placeholder="Provide brief context for the buyer..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeclineModalEoi(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {actionLoading ? "Declining..." : "Decline EOI"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clarification Modal */}
      {clarifyModalEoi && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Request Clarification ({clarifyModalEoi.referenceCode})
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ask the prospective acquirer specific questions about their acquisition structure, timeline, or operating synergy prior to formal acceptance.
            </p>
            <form onSubmit={handleClarify} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-800">
                  Question for Buyer (Min 10 characters)
                </label>
                <textarea
                  rows={4}
                  value={clarifyQuestion}
                  onChange={(e) => setClarifyQuestion(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                  placeholder="e.g. Please clarify your proposed promoter retention transition period..."
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setClarifyModalEoi(null)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50"
                >
                  {actionLoading ? "Sending..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
