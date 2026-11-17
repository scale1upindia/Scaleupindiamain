"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Lock,
  Building2,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { BuyerNDAView } from "@/types/nda";

export default function BuyerNDADetailPage({
  params,
}: {
  params: Promise<{ ndaId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { ndaId } = use(params);

  const [nda, setNda] = useState<BuyerNDAView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [acknowledged, setAcknowledged] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(false);

  const fetchNDA = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/buyer/ndas/${ndaId}`);
      const json = await res.json();
      if (json.success) {
        setNda(json.data);
      } else {
        setError(json.error?.message || "Failed to load NDA agreement.");
      }
    } catch {
      setError("Network failure while fetching NDA agreement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/buyer/nda/${ndaId}`);
    } else if (user) {
      fetchNDA();
    }
  }, [user, authLoading, ndaId]);

  const handleAccept = async () => {
    if (!acknowledged) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/buyer/ndas/${ndaId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsAcknowledged: true }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchNDA();
      } else {
        setError(json.error?.message || "Failed to accept NDA agreement.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!declineReason || declineReason.length < 5) {
      setError("Please provide a decline reason of at least 5 characters.");
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/buyer/ndas/${ndaId}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ declineReason }),
      });
      const json = await res.json();
      if (json.success) {
        setShowDeclineModal(false);
        await fetchNDA();
      } else {
        setError(json.error?.message || "Failed to decline NDA agreement.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
      </div>
    );
  }

  if (error && !nda) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="text-base font-bold text-red-900">Access Restricted</h2>
          <p className="text-xs text-red-700">{error}</p>
          <Link
            href="/buyer/eois"
            className="inline-block px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg"
          >
            Return to EOI Portfolio
          </Link>
        </div>
      </div>
    );
  }

  if (!nda) return null;

  const isExecuted = nda.status === "EXECUTED";
  const isDeclined = nda.status === "DECLINED";
  const isBuyerAccepted = Boolean(nda.buyerAcceptedAt);

  return (
    <div className="flex-1 bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/buyer/eois" className="hover:text-slate-800">
            EOI Portfolio
          </Link>
          <span>/</span>
          <span className="font-mono text-slate-700">{nda.referenceCode}</span>
        </div>

        {/* NDA Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-[#1557A6]/10 text-[#1557A6] px-2.5 py-1 rounded">
                  {nda.referenceCode}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">{nda.documentReference}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Bilateral Non-Disclosure Agreement
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Target Opportunity:{" "}
                <strong className="text-slate-900">{nda.opportunityTitle}</strong> (
                {nda.opportunityReference})
              </p>
            </div>

            {/* Status Pill */}
            <div>
              {isExecuted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>NDA EXECUTED</span>
                </span>
              ) : isDeclined ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                  <XCircle className="w-4 h-4" />
                  <span>DECLINED</span>
                </span>
              ) : isBuyerAccepted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  <Clock className="w-4 h-4" />
                  <span>AWAITING PROMOTER</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                  <FileText className="w-4 h-4" />
                  <span>AWAITING YOUR ACCEPTANCE</span>
                </span>
              )}
            </div>
          </div>

          {/* Execution Banner */}
          {isExecuted && nda.dataRoomId && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Bilateral NDA Formally Executed
                  </h3>
                  <p className="text-xs text-emerald-800">
                    Both parties have acknowledged the covenants. The Secure Data Room is now active.
                  </p>
                </div>
              </div>
              <Link
                href={`/buyer/data-room/${nda.dataRoomId}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
              >
                <span>Enter Secure Data Room</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Legal Agreement Document View */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-xs text-slate-700 space-y-4 max-h-96 overflow-y-auto leading-relaxed">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
              Standard Bilateral Non-Disclosure & Non-Circumvention Covenants
            </h4>
            <p>
              This Bilateral Non-Disclosure Agreement (the &quot;Agreement&quot;) is made effective as of the date of bilateral acceptance, by and between the verified prospective Acquirer/Investor (&quot;Recipient&quot;) and the verified Business Promoter (&quot;Disclosing Party&quot;), through the facilitation platform Scale-up India.
            </p>
            <div>
              <strong className="text-slate-900 block mb-1">1. Definition of Confidential Information</strong>
              <p>
                &quot;Confidential Information&quot; includes all financial, statutory, technical, customer, operational, and commercial documents, audit reports, tax filings, and trade secrets disclosed through the Scale-up India Secure Data Room.
              </p>
            </div>
            <div>
              <strong className="text-slate-900 block mb-1">2. Obligation of Strict Confidentiality</strong>
              <p>
                The Recipient covenants to hold all Confidential Information in strict confidence, exercising no less than reasonable commercial care. Recipient shall not disclose, duplicate, or release any portion to third parties without prior written consent.
              </p>
            </div>
            <div>
              <strong className="text-slate-900 block mb-1">3. Permitted Diligence Purpose</strong>
              <p>
                All disclosed documents and data room contents shall be utilized solely and exclusively for evaluating the prospective commercial transaction referenced under EOI {nda.eoiReference}.
              </p>
            </div>
            <div>
              <strong className="text-slate-900 block mb-1">4. Non-Circumvention Covenant</strong>
              <p>
                Recipient agrees not to bypass, circumvent, or avoid Scale-up India or the Disclosing Party to contact employees, suppliers, customers, or lenders directly without formal authorization.
              </p>
            </div>
            <div>
              <strong className="text-slate-900 block mb-1">5. Term & Termination</strong>
              <p>
                The confidentiality covenants herein shall remain binding for a period of twenty-four (24) months following execution.
              </p>
            </div>
          </div>

          {/* Bilateral Acceptance Status Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Acceptance (Acquirer)
              </span>
              {nda.buyerAcceptedAt ? (
                <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Accepted on {new Date(nda.buyerAcceptedAt).toLocaleString()}</span>
                </div>
              ) : (
                <div className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Pending your review & acknowledgement</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Promoter Acceptance (Seller)
              </span>
              {nda.sellerAcceptedAt ? (
                <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Accepted on {new Date(nda.sellerAcceptedAt).toLocaleString()}</span>
                </div>
              ) : (
                <div className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Pending promoter counter-acceptance</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Box for Buyer */}
          {!isBuyerAccepted && !isDeclined && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#1557A6] focus:ring-[#1557A6]"
                />
                <span className="leading-relaxed">
                  I confirm that I am authorized to bind my organization, and I formally acknowledge and accept the bilateral Non-Disclosure Covenants set forth in {nda.documentReference}.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleAccept}
                  disabled={!acknowledged || actionLoading}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Acknowledge & Accept NDA</span>
                </button>

                <button
                  onClick={() => setShowDeclineModal(true)}
                  disabled={actionLoading}
                  className="w-full sm:w-auto px-4 py-2.5 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                >
                  Decline NDA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Decline Reason Modal */}
      {showDeclineModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Decline Bilateral NDA</h3>
            <p className="text-xs text-slate-600">
              Please specify the reason for declining this Non-Disclosure Agreement. This will terminate the confidentiality workflow.
            </p>
            <textarea
              rows={3}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Provide reason for declining..."
              className="w-full p-3 border border-slate-300 rounded-lg text-xs focus:ring-[#1557A6] focus:border-[#1557A6]"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDeclineModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow"
              >
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
