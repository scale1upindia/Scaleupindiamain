// Scale-up India — Phase 11: Seller Escrow & Earnest Deposit Receipt View
// Path: src/app/seller/payments/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  FileText,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function SellerPaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [mous, setMous] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAcceptedMOUs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/mous?role=SELLER");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?redirect=/seller/payments");
          return;
        }
        throw new Error("Failed to load seller deal intents.");
      }
      const data = await res.json();
      const allMous = data.data?.mous || [];
      // Filter for accepted MOUs
      const accepted = allMous.filter((m: any) => m.status === "ACCEPTED");
      setMous(accepted);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/seller/payments");
      return;
    }
    if (user) {
      fetchAcceptedMOUs();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading Promoter Escrow Desk...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 font-medium">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-900 font-bold">Promoter Escrow & Token Deposits</span>
        </div>

        {/* Main Title Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#1557A6]" />
              Promoter Escrow & Token Deposit Desk
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Confidential overview of verified buyer earnest deposits held in commercial facilitation escrow.
            </p>
          </div>
          <Link
            href="/seller/mous"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" />
            Seller Deal Intents
          </Link>
        </div>

        {/* Security & Confidentiality Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <span className="font-bold">Confidential Escrow Verification</span>
            <p className="text-emerald-800 leading-relaxed">
              Scale-up India acts as an independent intermediary verifying buyer deposits. Once the buyer completes their earnest deposit transfer, deal room Due Diligence workflows are unlocked. Personal banking credentials of counterparties remain strictly confidential.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Accepted Deals Escrow List */}
        {mous.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-3">
            <CreditCard className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900">No Accepted Deal Intents</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You do not have any bilaterally accepted Deal Intent MOUs yet. Earnest deposit escrow tracking activates once both parties accept the preliminary terms.
            </p>
            <div className="pt-2">
              <Link
                href="/seller/mous"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
              >
                Go to Seller Deal Intents
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {mous.map((m) => (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4 hover:border-[#1557A6]/40 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-900">
                        {m.referenceCode}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        MOU Accepted
                      </span>
                    </div>
                    <h2 className="text-base font-bold text-gray-900">{m.opportunityTitle}</h2>
                    <p className="text-xs text-gray-500">
                      Counterparty: {m.counterpartyLabel}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-gray-500 block">Agreed Earnest Deposit</span>
                    <span className="text-lg font-bold text-gray-900">
                      ₹{m.earnestDepositAmount.toLocaleString("en-IN")} {m.currency}
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      ₹{(m.earnestDepositAmount / 100000).toFixed(2)} Lakhs INR
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Facilitation Escrow Desk Active
                  </span>

                  <Link
                    href={`/seller/mous/${m.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1557A6] text-white font-semibold rounded-lg hover:bg-[#1e4854] transition-colors"
                  >
                    View Deal Intent & Escrow Status
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
