"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  IndianRupee,
  Calendar,
  ChevronRight,
  History,
  X,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DealMOUDetailView, ProposedStructure } from "@/types/mou";

export default function SellerMOUDetailPage({
  params,
}: {
  params: Promise<{ mouId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { mouId } = use(params);

  const [mou, setMou] = useState<DealMOUDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Counter form state
  const [counterValuation, setCounterValuation] = useState<number>(0);
  const [counterStructure, setCounterStructure] = useState<ProposedStructure>("FULL_ACQUISITION");
  const [counterCash, setCounterCash] = useState<number>(0);
  const [counterEquity, setCounterEquity] = useState<number>(0);
  const [counterEarnest, setCounterEarnest] = useState<number>(0);
  const [counterExclusivity, setCounterExclusivity] = useState<number>(30);
  const [counterDD, setCounterDD] = useState<number>(45);
  const [counterNotes, setCounterNotes] = useState<string>("");

  // Reject / Withdraw reason
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [withdrawalReason, setWithdrawalReason] = useState<string>("");

  const fetchMOU = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/mous/${mouId}`);
      const json = await res.json();
      if (json.success) {
        setMou(json.data);
        const terms = json.data.currentTerms;
        setCounterValuation(terms.proposedValuation);
        setCounterStructure(terms.proposedStructure);
        setCounterCash(terms.cashConsideration);
        setCounterEquity(terms.equityConsideration);
        setCounterEarnest(terms.earnestDepositAmount);
        setCounterExclusivity(terms.exclusivityPeriodDays);
        setCounterDD(terms.dueDiligenceWindowDays);
      } else {
        setError(json.error?.message || "Failed to load Deal Intent MOU.");
      }
    } catch {
      setError("Network communication failure.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/seller/mous/${mouId}`);
      return;
    }
    if (user && mouId) {
      fetchMOU();
    }
  }, [user, authLoading, mouId]);

  const handleAccept = async () => {
    if (!confirm("Are you sure you wish to bilaterally accept this Deal Intent? You will confirm preliminary commercial terms and exclusivity periods for due diligence.")) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/mous/${mouId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      const json = await res.json();
      if (json.success) {
        setMou(json.data);
      } else {
        alert(json.error?.message || "Failed to accept Deal Intent.");
      }
    } catch {
      alert("Network error processing acceptance.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/mous/${mouId}/counter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          terms: {
            proposedValuation: Number(counterValuation),
            proposedStructure: counterStructure,
            cashConsideration: Number(counterCash),
            equityConsideration: Number(counterEquity),
            earnestDepositAmount: Number(counterEarnest),
            exclusivityPeriodDays: Number(counterExclusivity),
            dueDiligenceWindowDays: Number(counterDD),
            summaryNotes: counterNotes,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setMou(json.data);
        setShowCounterModal(false);
      } else {
        alert(json.error?.message || "Failed to submit counterproposal.");
      }
    } catch {
      alert("Network error submitting counterproposal.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for declining the proposal.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/mous/${mouId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const json = await res.json();
      if (json.success) {
        setMou(json.data);
        setShowRejectModal(false);
      } else {
        alert(json.error?.message || "Failed to decline proposal.");
      }
    } catch {
      alert("Network error processing rejection.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/mous/${mouId}/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: withdrawalReason }),
      });
      const json = await res.json();
      if (json.success) {
        setMou(json.data);
        setShowWithdrawModal(false);
      } else {
        alert(json.error?.message || "Failed to withdraw proposal.");
      }
    } catch {
      alert("Network error processing withdrawal.");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading Deal Intent Workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !mou) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border border-red-200 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Access Denied or Not Found</h2>
          <p className="text-xs text-gray-500 mt-2">{error || "Unable to display MOU agreement."}</p>
          <div className="mt-6">
            <Link
              href="/seller/mous"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854]"
            >
              Back to Deal Intent Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const terms = mou.currentTerms;
  const isAccepted = mou.status === "ACCEPTED";
  const isRejected = mou.status === "REJECTED";
  const isWithdrawn = mou.status === "WITHDRAWN";
  const canRespond = mou.isMyTurnToRespond;
  const canWithdraw =
    (mou.status === "PROPOSED" || mou.status === "COUNTERED") && !mou.isMyTurnToRespond;

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/seller/mous" className="hover:text-gray-900 font-medium">
              Deal Intent Portfolio
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 font-mono font-bold">{mou.referenceCode}</span>
          </div>
          {mou.conversationId && (
            <Link
              href={`/deals/${mou.conversationId}/messages`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#1557A6]" />
              Deal Discussion
            </Link>
          )}
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#1557A6] bg-teal-50 px-2.5 py-1 rounded border border-teal-100">
                  {mou.referenceCode}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  Version {mou.currentVersionNumber}
                </span>

                {isAccepted ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    BILATERALLY ACCEPTED
                  </span>
                ) : isRejected ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
                    DECLINED
                  </span>
                ) : isWithdrawn ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    WITHDRAWN
                  </span>
                ) : canRespond ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    ACTION REQUIRED: YOUR REVIEW
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    AWAITING BUYER RESPONSE
                  </span>
                )}
              </div>

              <h1 className="text-xl font-bold text-gray-900">{mou.opportunityTitle}</h1>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <span>Governed under Bilateral NDA: {mou.ndaReference}</span>
                <span>•</span>
                <span>Counterparty: {mou.counterpartyLabel}</span>
              </p>
            </div>

            {/* Response CTA Action Group */}
            {canRespond && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  Accept Terms
                </button>
                <button
                  onClick={() => setShowCounterModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors disabled:opacity-50"
                >
                  Counterproposal
                </button>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-xs font-bold rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            )}

            {canWithdraw && (
              <div>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Withdraw Counterproposal
                </button>
              </div>
            )}
          </div>

          {/* Non-Binding Legal Disclaimer */}
          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span className="font-bold block">Non-Binding Legal Notice</span>
              <p className="leading-relaxed text-amber-800">
                {mou.nonBindingDisclaimer}
              </p>
            </div>
          </div>

          {/* Phase 11: Promoter Escrow Desk Card */}
          {isAccepted && terms.earnestDepositAmount > 0 && (
            <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Transaction Escrow & Earnest Deposit Desk
                </span>
                <p className="text-xs text-gray-600">
                  Agreed Earnest Deposit: ₹{terms.earnestDepositAmount.toLocaleString("en-IN")} {terms.currency} (₹{(terms.earnestDepositAmount / 100000).toFixed(2)} Lakhs INR)
                </p>
              </div>
              <div>
                <Link
                  href="/seller/payments"
                  className="inline-flex items-center gap-1 px-3 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
                >
                  View Escrow Verification Desk
                </Link>
              </div>
            </div>
          )}

          {/* Phase 12: Promoter Diligence Desk Card */}
          {isAccepted && (
            <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  Due Diligence Desk
                </span>
                <p className="text-xs text-teal-800">
                  Respond to buyer document requests, upload verified statutory documentation, and answer clarifications.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/seller/diligence"
                  className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors flex items-center gap-1.5"
                >
                  Enter Diligence Desk
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Commercial Terms Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-6">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
            <span>Commercial Terms (Version {mou.currentVersionNumber})</span>
            <span className="text-xs font-normal text-gray-500">
              Currency: {terms.currency}
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <span className="text-xs text-gray-500 block">Proposed Acquisition Valuation</span>
              <span className="text-xl font-bold text-gray-900 mt-1 block">
                ₹{(terms.proposedValuation / 10000000).toFixed(2)} Cr
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                ₹{terms.proposedValuation.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <span className="text-xs text-gray-500 block">Deal Consideration Structure</span>
              <span className="text-sm font-bold text-gray-900 mt-1 block">
                {terms.proposedStructure.replace(/_/g, " ")}
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Cash: ₹{(terms.cashConsideration / 10000000).toFixed(2)} Cr • Equity: ₹{(terms.equityConsideration / 10000000).toFixed(2)} Cr
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <span className="text-xs text-gray-500 block">Proposed Token / Earnest Deposit</span>
              <span className="text-lg font-bold text-gray-900 mt-1 block">
                ₹{(terms.earnestDepositAmount / 100000).toFixed(2)} Lakhs
              </span>
              <span className="text-[11px] text-gray-400 mt-0.5 block">
                Deposit to secure diligence commitment
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500 block">Exclusivity Period</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                {terms.exclusivityPeriodDays} Days
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500 block">Due Diligence Window</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                {terms.dueDiligenceWindowDays} Days
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-500 block">Target Closing Date</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">
                {terms.targetClosingDate || "To be mutually agreed"}
              </span>
            </div>
          </div>

          {/* Conditions Precedent */}
          {terms.conditionsPrecedent && terms.conditionsPrecedent.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 block">Conditions Precedent</span>
              <ul className="space-y-1.5">
                {terms.conditionsPrecedent.map((cond, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 mt-0.5 shrink-0" />
                    <span>{cond}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Key Assumptions & Notes */}
          {terms.summaryNotes && (
            <div className="space-y-1 bg-gray-50 p-4 rounded-xl text-xs">
              <span className="font-bold text-gray-800 block">Commercial Justification & Notes</span>
              <p className="text-gray-700 whitespace-pre-wrap">{terms.summaryNotes}</p>
            </div>
          )}
        </div>

        {/* Immutable Version History */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1557A6]" />
            Negotiation & Version Audit Trail
          </h2>

          <div className="space-y-3">
            {mou.versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 rounded-xl border border-gray-100 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#1557A6]">
                      Version {ver.versionNumber}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="font-semibold text-gray-700">
                      Proposed by {ver.proposedByRole === "SELLER" ? "You (Promoter)" : "Buyer"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-800">
                      {ver.status}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    Valuation: ₹{(ver.terms.proposedValuation / 10000000).toFixed(2)} Cr • Exclusivity: {ver.terms.exclusivityPeriodDays} days • Structure: {ver.terms.proposedStructure.replace(/_/g, " ")}
                  </div>
                  {ver.terms.summaryNotes && (
                    <p className="text-gray-500 italic mt-1">&quot;{ver.terms.summaryNotes}&quot;</p>
                  )}
                </div>
                <div className="text-[11px] text-gray-400 shrink-0">
                  {new Date(ver.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* COUNTERPROPOSAL MODAL */}
      {showCounterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-gray-900">
                Submit Deal Intent Counterproposal
              </h3>
              <button
                onClick={() => setShowCounterModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCounter} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Revised Expected Valuation (₹ INR) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={counterValuation}
                  onChange={(e) => setCounterValuation(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Cash Consideration (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={counterCash}
                    onChange={(e) => setCounterCash(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Earnest Deposit Expected (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={counterEarnest}
                    onChange={(e) => setCounterEarnest(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Exclusivity Period (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={counterExclusivity}
                    onChange={(e) => setCounterExclusivity(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    DD Window (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={counterDD}
                    onChange={(e) => setCounterDD(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Promoter Justification & Counter Notes
                </label>
                <textarea
                  rows={3}
                  value={counterNotes}
                  onChange={(e) => setCounterNotes(e.target.value)}
                  placeholder="Explain promoter counter terms, working capital adjustments, or exclusivity rationale..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#1557A6] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCounterModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white font-bold rounded-lg hover:bg-[#1e4854] disabled:opacity-50"
                >
                  {actionLoading ? "Submitting..." : "Submit Counterproposal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Decline Deal Intent Proposal</h3>
            <p className="text-xs text-gray-500">
              Please provide a clear reason for declining this commercial proposal.
            </p>
            <form onSubmit={handleReject} className="space-y-4 text-xs">
              <textarea
                rows={4}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for declining terms..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Confirm Decline"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WITHDRAW MODAL */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-gray-900">Withdraw Counterproposal</h3>
            <p className="text-xs text-gray-500">
              Are you sure you wish to withdraw your active counterproposal?
            </p>
            <form onSubmit={handleWithdraw} className="space-y-4 text-xs">
              <textarea
                rows={3}
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                placeholder="Optional withdrawal reason..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-gray-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-900 disabled:opacity-50"
                >
                  {actionLoading ? "Processing..." : "Withdraw"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
