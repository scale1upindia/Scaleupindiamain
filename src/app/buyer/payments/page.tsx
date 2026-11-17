// Scale-up India — Phase 11: Buyer Payment Intents & Earnest Deposits Portfolio
// Path: src/app/buyer/payments/page.tsx

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Loader2,
  ChevronRight,
  FileText,
} from "lucide-react";
import { PaymentIntentListItemView } from "@/types/payment";

export default function BuyerPaymentsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<PaymentIntentListItemView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/v1/payment-intents");
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/login?redirect=/buyer/payments");
          return;
        }
        throw new Error("Failed to load payment intents.");
      }
      const data = await res.json();
      setPayments(data.data?.paymentIntents || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/buyer/payments");
      return;
    }
    if (user) {
      fetchPayments();
    }
  }, [user, authLoading, router]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Escrow Confirmed
          </span>
        );
      case "CREATED":
      case "PENDING":
      case "REQUIRES_ACTION":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" />
            Payment Pending
          </span>
        );
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <RefreshCw className="w-3.5 h-3.5" />
            {status === "REFUNDED" ? "Refunded" : "Partially Refunded"}
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
            <XCircle className="w-3.5 h-3.5" />
            Cancelled
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-3.5 h-3.5" />
            Payment Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading Escrow & Payment Records...</p>
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
          <span className="text-gray-900 font-bold">Transaction Escrow & Deposits</span>
        </div>

        {/* Main Title Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#1557A6]" />
              Buyer Escrow & Earnest Deposits
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Authoritative transaction earnest deposits and financial intent ledger governed by bilateral deal agreements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/buyer/mous"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              View Accepted MOUs
            </Link>
          </div>
        </div>

        {/* Platform Escrow Guarantee Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <span className="font-bold">Intermediary Transaction Escrow Protection</span>
            <p className="text-emerald-800 leading-relaxed">
              Scale-up India orchestrates deal facilitation escrow. Earnest token deposits are locked to protect deal exclusivity during the Due Diligence window and are never released to the promoter prior to final definitive agreement execution.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Payment Intents List */}
        {payments.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm space-y-3">
            <CreditCard className="w-10 h-10 text-gray-400 mx-auto" />
            <h3 className="text-sm font-bold text-gray-900">No Payment Intents Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              You do not have any active or previous earnest deposit intents. Payment intents are initiated from bilaterally accepted Deal Intent MOUs.
            </p>
            <div className="pt-2">
              <Link
                href="/buyer/mous"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
              >
                Go to Deal Intent Portfolio
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {payments.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-[#1557A6]/40 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-gray-900">
                        {p.referenceCode}
                      </span>
                      {getStatusBadge(p.status)}
                    </div>
                    <h2 className="text-base font-bold text-gray-900">
                      {p.opportunityTitle || "Confidential Opportunity"}
                    </h2>
                    <p className="text-xs text-gray-500 flex items-center gap-2">
                      <span>Opportunity: {p.opportunityReference}</span>
                      <span>•</span>
                      <span>MOU Ref: {p.mouReferenceCode}</span>
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-gray-500 block">Agreed Earnest Deposit</span>
                    <span className="text-lg font-bold text-gray-900">
                      ₹{p.amount.toLocaleString("en-IN")} {p.currency}
                    </span>
                    <span className="text-[11px] text-gray-400 block">
                      ₹{(p.amount / 100000).toFixed(2)} Lakhs INR
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                  <div>
                    <span>Initiated on: {new Date(p.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                    {p.completedAt && (
                      <span className="ml-3 text-emerald-700 font-medium">
                        • Verified at: {new Date(p.completedAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/buyer/payments/${p.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1557A6] text-white font-semibold rounded-lg hover:bg-[#1e4854] transition-colors"
                  >
                    View Escrow Details
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
