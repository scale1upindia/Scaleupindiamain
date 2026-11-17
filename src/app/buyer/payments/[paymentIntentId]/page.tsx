// Scale-up India — Phase 11: Buyer Payment Intent & Earnest Deposit Detail Workspace
// Path: src/app/buyer/payments/[paymentIntentId]/page.tsx

"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Loader2,
  ChevronRight,
  FileText,
  AlertTriangle,
  History,
  Info,
} from "lucide-react";
import { PaymentIntentDetailView } from "@/types/payment";

export default function BuyerPaymentDetailPage({
  params,
}: {
  params: Promise<{ paymentIntentId: string }>;
}) {
  const router = useRouter();
  const { paymentIntentId } = use(params);
  const { user, loading: authLoading } = useAuth();

  const [payment, setPayment] = useState<PaymentIntentDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");

  const fetchPayment = async () => {
    try {
      const res = await fetch(`/api/v1/payment-intents/${paymentIntentId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?redirect=/buyer/payments/${paymentIntentId}`);
          return;
        }
        if (res.status === 403) {
          throw new Error("You do not have permission to view this payment intent.");
        }
        if (res.status === 404) {
          throw new Error("Payment intent record not found.");
        }
        throw new Error("Failed to load payment intent details.");
      }
      const data = await res.json();
      setPayment(data.data?.paymentIntent);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/buyer/payments/${paymentIntentId}`);
      return;
    }
    if (user) {
      fetchPayment();
    }
  }, [user, authLoading, paymentIntentId, router]);

  // Polling when pending
  useEffect(() => {
    if (!payment || (payment.status !== "CREATED" && payment.status !== "PENDING")) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/payment-intents/${paymentIntentId}/status`);
        if (res.ok) {
          const data = await res.json();
          if (data.data?.status !== payment.status) {
            fetchPayment();
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [payment, paymentIntentId]);

  const handleCancel = async () => {
    if (!cancelReason || cancelReason.length < 5) {
      setError("Please provide a valid cancellation reason (min 5 characters).");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/payment-intents/${paymentIntentId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to cancel payment intent.");
      }

      setShowCancelModal(false);
      setCancelReason("");
      setSuccessMsg("Payment intent successfully cancelled.");
      await fetchPayment();
    } catch (err: any) {
      setError(err.message || "Failed to cancel payment.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundReason || refundReason.length < 10) {
      setError("Please provide a detailed refund justification (min 10 characters).");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const payload: any = { reason: refundReason };
      if (refundAmount && Number(refundAmount) > 0) {
        payload.amount = Number(refundAmount);
      }

      const res = await fetch(`/api/v1/payment-intents/${paymentIntentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Failed to process refund request.");
      }

      setShowRefundModal(false);
      setRefundReason("");
      setRefundAmount("");
      setSuccessMsg("Refund successfully processed and credited to ledger.");
      await fetchPayment();
    } catch (err: any) {
      setError(err.message || "Failed to process refund.");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUCCEEDED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            Escrow Confirmed
          </span>
        );
      case "CREATED":
      case "PENDING":
      case "REQUIRES_ACTION":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-4 h-4" />
            Payment Pending
          </span>
        );
      case "REFUNDED":
      case "PARTIALLY_REFUNDED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <RefreshCw className="w-4 h-4" />
            {status === "REFUNDED" ? "Fully Refunded" : "Partially Refunded"}
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle className="w-4 h-4" />
            Payment Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
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
          <p className="text-sm text-gray-600 font-medium">Loading Escrow Workspace...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] py-12 px-4">
        <div className="max-w-md mx-auto bg-white rounded-2xl p-8 border border-red-200 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-900">Payment Intent Error</h2>
          <p className="text-xs text-gray-500 mt-2">{error || "Unable to display payment intent."}</p>
          <div className="mt-6">
            <Link
              href="/buyer/payments"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854]"
            >
              Back to Payments Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPending =
    payment.status === "CREATED" ||
    payment.status === "PENDING" ||
    payment.status === "REQUIRES_ACTION";
  const isSucceeded = payment.status === "SUCCEEDED";
  const canRefund =
    isSucceeded ||
    (payment.status === "PARTIALLY_REFUNDED" &&
      payment.amount - payment.refundedAmount > 0);

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Link href="/buyer/payments" className="hover:text-gray-900 font-medium">
              Escrow & Deposits
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-gray-900 font-mono font-bold">{payment.referenceCode}</span>
          </div>

          <Link
            href={`/buyer/mous/${payment.mouId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileText className="w-3.5 h-3.5" />
            View MOU ({payment.mouReferenceCode})
          </Link>
        </div>

        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-800 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-gray-900">
                  {payment.referenceCode}
                </span>
                {getStatusBadge(payment.status)}
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                {payment.opportunityTitle || "Confidential Acquisition Deal"}
              </h1>
              <p className="text-xs text-gray-500 flex items-center gap-2">
                <span>Opportunity: {payment.opportunityReference}</span>
                <span>•</span>
                <span>MOU Ref: {payment.mouReferenceCode}</span>
                <span>•</span>
                <span>Gateway: {payment.provider}</span>
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs text-gray-500 block">Authoritative Earnest Deposit</span>
              <span className="text-2xl font-bold text-gray-900">
                ₹{payment.amount.toLocaleString("en-IN")} {payment.currency}
              </span>
              <span className="text-xs text-gray-400 block">
                ₹{(payment.amount / 100000).toFixed(2)} Lakhs INR
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="pt-2 flex items-center gap-3 flex-wrap">
            {isPending && (
              <>
                <button
                  onClick={() => setShowCancelModal(true)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel Intent
                </button>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Awaiting payment completion via verified gateway. Auto-sync active.</span>
                </div>
              </>
            )}

            {canRefund && (
              <button
                onClick={() => {
                  setRefundAmount((payment.amount - payment.refundedAmount).toString());
                  setShowRefundModal(true);
                }}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
              >
                Request Escrow Refund
              </button>
            )}
          </div>
        </div>

        {/* Escrow Guarantee Banner */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="text-xs text-emerald-900 space-y-1">
            <span className="font-bold">Scale-up India Institutional Escrow Trust</span>
            <p className="text-emerald-800 leading-relaxed">
              Deposited funds are held in commercial facilitation escrow. Definite disbursement remains subject to definitive Share Purchase/Asset Sale Agreement execution and Due Diligence completion.
            </p>
          </div>
        </div>

        {/* Token Deposit Intent Card */}
        {payment.tokenDeposit && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#1557A6]" />
              Token Deposit Model Binding
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-gray-500 block">Token Reference</span>
                <span className="font-mono font-bold text-gray-900 mt-1 block">
                  {payment.tokenDeposit.referenceCode}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-gray-500 block">Deposit Status</span>
                <span className="font-bold text-gray-900 mt-1 block">
                  {payment.tokenDeposit.status}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                <span className="text-gray-500 block">Confirmation Timestamp</span>
                <span className="font-bold text-gray-900 mt-1 block">
                  {payment.tokenDeposit.confirmedAt
                    ? new Date(payment.tokenDeposit.confirmedAt).toLocaleString("en-IN")
                    : "Pending Verification"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Immutable Financial Ledger */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <History className="w-4 h-4 text-[#1557A6]" />
              Immutable Financial Ledger (Append-Only)
            </span>
            <span className="text-xs font-normal text-gray-500">
              {payment.ledger.length} entries recorded
            </span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">Tx Reference</th>
                  <th className="py-2.5 px-3 font-semibold">Event Type</th>
                  <th className="py-2.5 px-3 font-semibold">Direction</th>
                  <th className="py-2.5 px-3 font-semibold">Amount</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {payment.ledger.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-bold text-gray-900">
                      {entry.transactionReference}
                    </td>
                    <td className="py-3 px-3 font-sans font-medium text-gray-700">
                      {entry.transactionType}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          entry.direction === "CREDIT"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {entry.direction}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans font-bold text-gray-900">
                      ₹{entry.amount.toLocaleString("en-IN")} {entry.currency}
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-emerald-700 font-medium">{entry.status}</span>
                    </td>
                    <td className="py-3 px-3 font-sans text-gray-500">
                      {new Date(entry.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Non-Binding Legal Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Intermediary & Non-Binding Notice</span>
            <p className="text-amber-800 leading-relaxed">
              Scale-up India operates under Ideal Corporate Synergy LLP as a confidential matchmaking intermediary. Earnest deposits do not create a statutory debenture, deposit, or equity holding until definitive agreements are executed.
            </p>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Cancel Payment Intent</h3>
            <p className="text-xs text-gray-500">
              Cancelling this payment intent will mark the earnest deposit attempt as cancelled in the immutable ledger.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="State reason for cancellation..."
              className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#1557A6] outline-none h-24"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
              <button
                onClick={handleCancel}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Request Escrow Refund</h3>
            <p className="text-xs text-gray-500">
              Refunds will reverse the earnest deposit and update the transaction ledger. Remaining refundable balance: ₹
              {(payment.amount - payment.refundedAmount).toLocaleString("en-IN")} INR.
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Refund Amount (INR)
              </label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                max={payment.amount - payment.refundedAmount}
                className="w-full text-xs p-2.5 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#1557A6] outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Refund Justification (min 10 chars)
              </label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="E.g., Transaction mutually terminated prior to due diligence completion..."
                className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:ring-1 focus:ring-[#1557A6] outline-none h-24"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRefundModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                Close
              </button>
              <button
                onClick={handleRefund}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? "Processing Refund..." : "Confirm Refund"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
