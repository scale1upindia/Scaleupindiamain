"use client";

import { useEffect, useState } from "react";
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
  Inbox,
  IndianRupee,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DealMOUListItemView } from "@/types/mou";

export default function SellerMOUsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [mous, setMous] = useState<DealMOUListItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMOUs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/mous?role=SELLER");
      const json = await res.json();
      if (json.success) {
        setMous(json.data.mous);
      } else {
        setError(json.error?.message || "Failed to load Deal Intent MOUs.");
      }
    } catch {
      setError("Network communication failure.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/seller/mous");
      return;
    }
    if (user) {
      fetchMOUs();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading Deal Intent Agreements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-[#1557A6]" />
              Promoter Deal Intent (MOU) Portfolio
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Review and negotiate structured commercial terms proposed by verified prospective buyers.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#1557A6] hover:underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        {/* Non-Binding Legal Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <span className="font-bold">Preliminary Commercial Intent</span>
            <p className="leading-relaxed">
              Deal Intent proposals outline proposed acquisition valuations, payment structures, and diligence timelines. All submissions are non-binding expressions of interest and subject to definitive agreement execution.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {mous.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
            <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-900">No Deal Intent Proposals Yet</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              When prospective buyers execute bilateral NDAs and review your Virtual Data Room, they may submit formal Deal Intent proposals for your consideration.
            </p>
            <div className="mt-5">
              <Link
                href="/seller/ndas"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
              >
                View Active NDAs & Diligence Rooms
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {mous.map((mou) => {
              const isAccepted = mou.status === "ACCEPTED";
              const isRejected = mou.status === "REJECTED";
              const isWithdrawn = mou.status === "WITHDRAWN";
              const isActionRequired = mou.isMyTurnToRespond;

              return (
                <div
                  key={mou.id}
                  className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${
                    isActionRequired ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-200"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#1557A6] bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                          {mou.referenceCode}
                        </span>
                        <span className="text-xs text-gray-500 font-mono">
                          v{mou.currentVersionNumber}
                        </span>
                        {/* Status Badge */}
                        {isAccepted ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            BILATERALLY ACCEPTED
                          </span>
                        ) : isRejected ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
                            DECLINED
                          </span>
                        ) : isWithdrawn ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                            WITHDRAWN
                          </span>
                        ) : isActionRequired ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
                            <Clock className="w-3 h-3 text-amber-600" />
                            ACTION REQUIRED: YOUR REVIEW
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            AWAITING BUYER RESPONSE
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 truncate">
                        {mou.opportunityTitle}
                      </h3>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {mou.counterpartyLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <IndianRupee className="w-3.5 h-3.5 text-gray-400" />
                          Valuation: ₹{(mou.proposedValuation / 10000000).toFixed(2)} Cr
                        </span>
                        <span className="text-gray-400">•</span>
                        <span>Structure: {mou.proposedStructure.replace(/_/g, " ")}</span>
                        <span className="text-gray-400">•</span>
                        <span>Exclusivity: {mou.exclusivityPeriodDays} Days</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/seller/mous/${mou.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
                      >
                        <span>Review Proposal</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
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
