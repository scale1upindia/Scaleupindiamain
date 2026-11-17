// Scale-up India — Phase 14: Buyer Transaction Deal Room Portfolio
// Path: src/app/buyer/deal-room/page.tsx

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Briefcase,
  ShieldCheck,
  Clock,
  ArrowRight,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
} from "lucide-react";
import { TransactionOverviewView } from "@/types/transaction";

export default function BuyerDealRoomPortfolioPage() {
  const [transactions, setTransactions] = useState<TransactionOverviewView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        setLoading(true);
        const res = await fetch("/api/v1/transactions");
        const json = await res.json();
        if (json.success) {
          setTransactions(json.data.transactions || []);
        } else {
          setError(json.error?.message || "Failed to load transactions.");
        }
      } catch (err: any) {
        setError(err.message || "Network error loading transactions.");
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, []);

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CLOSED":
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Closed & Executed
          </span>
        );
      case "READY_FOR_CLOSING":
        return (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Ready for Closing
          </span>
        );
      case "CLOSING_CONDITIONS":
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Closing Conditions
          </span>
        );
      case "TERMS_FINALIZATION":
        return (
          <span className="px-2.5 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" /> Terms Finalization
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-semibold rounded-full flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {status}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#1557A6]/10 text-[#1557A6]">
                Phase 14 — Closing Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">Deal Room</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mt-1 flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-[#1557A6]" />
              Transaction & Closing Rooms
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              Authoritative transaction execution workspaces. Manage final transaction terms,
              closing condition verification, definitive legal documents, and atomic transaction closing.
            </p>
          </div>
        </div>

        {/* Notice */}
        <div className="bg-[#EEF5FB] border border-[#1557A6]/20 rounded-xl p-4 text-xs text-slate-700 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#1557A6] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-slate-900">Institutional Closing Standard:</span> Transactions cannot be closed unless all mandatory conditions are verified against authoritative ledgers, bilateral confirmations are signed, and platform reviewer approval is granted.
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-8 h-8 border-4 border-[#1557A6] border-t-transparent rounded-full animate-spin" />
            <p className="mt-3 text-sm text-slate-500 font-medium">Loading transaction deal rooms...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Failed to load transactions</p>
              <p className="text-xs mt-0.5">{error}</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 p-8">
            <Briefcase className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No Active Deal Rooms</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-6">
              Transaction deal rooms are initialized once an approved corporate valuation and completed due diligence case are established.
            </p>
            <Link
              href="/buyer/valuation"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg hover:bg-[#235360] transition shadow-sm"
            >
              Go to Valuation Portfolio
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {transactions.map((txn) => (
              <div
                key={txn.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-6 border-b border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {txn.referenceCode}
                    </span>
                    {getStatusBadge(txn.status)}
                  </div>
                  <h3 className="font-semibold text-slate-900 group-hover:text-[#1557A6] transition line-clamp-1">
                    {txn.opportunityTitle || "Acquisition Opportunity"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 font-mono">
                    Ref: {txn.opportunityReference || "OPP-XXXX"}
                  </p>

                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Agreed Consideration</span>
                      <p className="text-sm font-bold text-slate-900 mt-0.5">
                        {formatCurrency(txn.agreedAmount)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Structure</span>
                      <p className="text-xs font-medium text-slate-700 mt-0.5">
                        {txn.transactionType.replace("_", " ")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <FileCheck2 className="w-3.5 h-3.5 text-slate-400" />
                      Version {txn.currentVersionNumber}
                    </span>
                    <span className="flex items-center gap-1">
                      {txn.buyerConfirmed && txn.sellerConfirmed ? (
                        <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Bilateral Confirmed
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">Confirmations Pending</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Created {new Date(txn.createdAt).toLocaleDateString()}
                  </span>
                  <Link
                    href={`/buyer/deal-room/${txn.id}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1557A6] hover:text-[#235360] transition"
                  >
                    Open Deal Room
                    <ArrowRight className="w-3.5 h-3.5" />
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
