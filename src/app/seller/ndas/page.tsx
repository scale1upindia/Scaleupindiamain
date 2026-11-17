"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { SellerNDAView, NDAStatus } from "@/types/nda";

export default function SellerNDAsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [ndas, setNdas] = useState<SellerNDAView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNDAs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/seller/ndas");
      const json = await res.json();
      if (json.success) {
        setNdas(json.data.items || []);
      } else {
        setError(json.error?.message || "Failed to load NDA inbox.");
      }
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/seller/ndas");
    } else if (user) {
      fetchNDAs();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold bg-[#1557A6]/10 text-[#1557A6] px-2.5 py-0.5 rounded">
                PROMOTER DESK
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-500">Bilateral Non-Disclosure Agreements</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              NDA Agreements Inbox
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Review and countersign confidentiality covenants to activate Secure Data Rooms with verified acquirers.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">
            {error}
          </div>
        )}

        {ndas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Bilateral NDAs Initiated</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              When an Expression of Interest is accepted on your opportunity listings, either party can initiate a bilateral NDA here.
            </p>
            <Link
              href="/seller/eois"
              className="inline-block px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow hover:bg-[#104789]"
            >
              View Received EOIs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {ndas.map((nda) => {
              const isExecuted = nda.status === "EXECUTED";
              const isDeclined = nda.status === "DECLINED";
              const isSellerAccepted = Boolean(nda.sellerAcceptedAt);

              return (
                <div
                  key={nda.id}
                  className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                        {nda.referenceCode}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500">
                        Opportunity: <strong className="text-slate-800">{nda.opportunityTitle}</strong> (
                        {nda.opportunityReference})
                      </span>
                    </div>

                    <div>
                      {isExecuted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>EXECUTED</span>
                        </span>
                      ) : isDeclined ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DECLINED</span>
                        </span>
                      ) : isSellerAccepted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                          <Clock className="w-3.5 h-3.5" />
                          <span>AWAITING ACQUIRER</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                          <FileText className="w-3.5 h-3.5" />
                          <span>COUNTERSIGNATURE REQUIRED</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Prospective Acquirer</span>
                      <span className="font-semibold text-slate-800">
                        {nda.buyerEntityType} • {nda.buyerLocation}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Associated EOI</span>
                      <span className="font-mono font-bold text-slate-700">{nda.eoiReference}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Covenant Standard</span>
                      <span className="text-slate-700">{nda.documentReference}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs border-t border-slate-100">
                    <span className="text-slate-400 text-[11px]">
                      Initiated: {new Date(nda.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {isExecuted && nda.dataRoomId ? (
                        <Link
                          href={`/seller/data-room/${nda.dataRoomId}`}
                          className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow inline-flex items-center gap-1.5 transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4" />
                          <span>Manage Secure Data Room</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      ) : (
                        <Link
                          href={`/seller/nda/${nda.id}`}
                          className="px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white font-bold rounded-lg shadow inline-flex items-center gap-1.5 transition-colors"
                        >
                          <span>Review & Countersign NDA</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
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
