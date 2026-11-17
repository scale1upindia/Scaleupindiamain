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
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SellerNDAView } from "@/types/nda";

export default function SellerNDADetailPage({
  params,
}: {
  params: Promise<{ ndaId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { ndaId } = use(params);

  const [nda, setNda] = useState<SellerNDAView | null>(null);
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
      const res = await fetch(`/api/v1/seller/ndas/${ndaId}`);
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
      router.push(`/login?redirect=/seller/nda/${ndaId}`);
    } else if (user) {
      fetchNDA();
    }
  }, [user, authLoading, ndaId]);

  const handleAccept = async () => {
    if (!acknowledged) return;
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/seller/ndas/${ndaId}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termsAcknowledged: true }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchNDA();
      } else {
        setError(json.error?.message || "Failed to countersign NDA agreement.");
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
      const res = await fetch(`/api/v1/seller/ndas/${ndaId}/decline`, {
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
            href="/seller/ndas"
            className="inline-block px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg"
          >
            Return to NDA Inbox
          </Link>
        </div>
      </div>
    );
  }

  if (!nda) return null;

  const isExecuted = nda.status === "EXECUTED";
  const isDeclined = nda.status === "DECLINED";
  const isSellerAccepted = Boolean(nda.sellerAcceptedAt);

  return (
    <div className="flex-1 bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/seller/ndas" className="hover:text-slate-800">
            NDA Inbox
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
              ) : isSellerAccepted ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                  <Clock className="w-4 h-4" />
                  <span>AWAITING ACQUIRER</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                  <FileText className="w-4 h-4" />
                  <span>COUNTERSIGNATURE REQUIRED</span>
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
                    Both parties have executed the confidentiality covenants. The Secure Data Room is ready for document management.
                  </p>
                </div>
              </div>
              <Link
                href={`/seller/data-room/${nda.dataRoomId}`}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow inline-flex items-center justify-center gap-2 shrink-0 transition-colors"
              >
                <span>Manage Secure Data Room</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Legal Document Terms */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-xs text-slate-700 space-y-4 max-h-96 overflow-y-auto leading-relaxed">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-2">
              Bilateral Non-Disclosure & Non-Circumvention Terms
            </h4>
            <p>
              Under this Bilateral Non-Disclosure Agreement, the Disclosing Party authorizes the Recipient ({nda.buyerEntityType}, {nda.buyerLocation}) to access confidential files within the Scale-up India Secure Data Room solely for evaluating EOI {nda.eoiReference}.
            </p>
            <div>
              <strong className="text-slate-900 block mb-1">1. Bilateral Scope</strong>
              <p>
                Both parties agree that business metrics, technical architectures, and financial data disclosed shall not be utilized for competing commercial activities or disclosed to unauthorized third parties.
              </p>
            </div>
            <div>
              <strong className="text-slate-900 block mb-1">2. Term of Covenants</strong>
              <p>
                Confidentiality obligations remain in full force and effect for twenty-four (24) months from execution.
              </p>
            </div>
          </div>

          {/* Bilateral Acceptance Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Your Countersignature (Promoter)
              </span>
              {nda.sellerAcceptedAt ? (
                <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Accepted on {new Date(nda.sellerAcceptedAt).toLocaleString()}</span>
                </div>
              ) : (
                <div className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Pending your review & countersignature</span>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Acquirer Acceptance
              </span>
              {nda.buyerAcceptedAt ? (
                <div className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Accepted on {new Date(nda.buyerAcceptedAt).toLocaleString()}</span>
                </div>
              ) : (
                <div className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Pending acquirer acceptance</span>
                </div>
              )}
            </div>
          </div>

          {/* Promoter Action Box */}
          {!isSellerAccepted && !isDeclined && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#1557A6] focus:ring-[#1557A6]"
                />
                <span className="leading-relaxed">
                  I confirm that I am authorized to bind the enterprise, and I formally countersign the bilateral Non-Disclosure Agreement for transaction {nda.opportunityReference}.
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
                  <span>Countersign & Accept NDA</span>
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
              Please specify the reason for declining this Non-Disclosure Agreement.
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
