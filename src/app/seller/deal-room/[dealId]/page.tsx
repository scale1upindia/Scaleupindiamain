// Scale-up India — Phase 14: Seller Deal Room Workspace
// Path: src/app/seller/deal-room/[dealId]/page.tsx

"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowLeft,
  FileText,
  Upload,
  Download,
  AlertTriangle,
  Lock,
} from "lucide-react";
import {
  TransactionOverviewView,
  TransactionConditionRecord,
  TransactionDocumentRecord,
  ClosingReadinessView,
} from "@/types/transaction";

export default function SellerDealRoomWorkspacePage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = use(params);

  const [txn, setTxn] = useState<TransactionOverviewView | null>(null);
  const [conditions, setConditions] = useState<TransactionConditionRecord[]>([]);
  const [documents, setDocuments] = useState<TransactionDocumentRecord[]>([]);
  const [readiness, setReadiness] = useState<ClosingReadinessView | null>(null);
  const [activeTab, setActiveTab] = useState<"terms" | "checklist" | "documents">("terms");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Document upload modal state
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDocType, setUploadDocType] = useState<string>("BOARD_RESOLUTION");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);

  async function fetchDealRoomData() {
    try {
      setLoading(true);
      setError(null);

      const [txnRes, condRes, docsRes, readyRes] = await Promise.all([
        fetch(`/api/v1/transactions/${dealId}`),
        fetch(`/api/v1/transactions/${dealId}/conditions`),
        fetch(`/api/v1/transactions/${dealId}/documents`),
        fetch(`/api/v1/transactions/${dealId}/closing-readiness`),
      ]);

      const [txnJson, condJson, docsJson, readyJson] = await Promise.all([
        txnRes.json(),
        condRes.json(),
        docsRes.json(),
        readyRes.json(),
      ]);

      if (txnJson.success) setTxn(txnJson.data.transaction);
      else throw new Error(txnJson.error?.message || "Failed to load transaction");

      if (condJson.success) setConditions(condJson.data.conditions || []);
      if (docsJson.success) setDocuments(docsJson.data.documents || []);
      if (readyJson.success) setReadiness(readyJson.data.readiness || null);
    } catch (err: any) {
      setError(err.message || "Failed to load deal room.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDealRoomData();
  }, [dealId]);

  const handleConfirmTerms = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`/api/v1/transactions/${dealId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "Seller confirmation of final transaction terms." }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDealRoomData();
      } else {
        alert(json.error?.message || "Failed to confirm terms.");
      }
    } catch (err: any) {
      alert(err.message || "Network error confirming terms.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert("Please select a file to upload.");
      return;
    }

    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("title", uploadTitle || uploadFile.name);
      formData.append("documentType", uploadDocType);
      if (selectedConditionId) {
        formData.append("conditionId", selectedConditionId);
      }

      const res = await fetch(`/api/v1/transactions/${dealId}/documents`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setDocModalOpen(false);
        setUploadFile(null);
        setUploadTitle("");
        setSelectedConditionId(null);
        await fetchDealRoomData();
      } else {
        alert(json.error?.message || "Document upload failed.");
      }
    } catch (err: any) {
      alert(err.message || "Network error uploading document.");
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return "—";
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)} Lakh`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-[#1557A6] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-sm text-slate-500 font-medium">Entering transaction workspace...</p>
      </div>
    );
  }

  if (error || !txn) {
    return (
      <div className="min-h-screen bg-[#f8fafc] py-12 px-4 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
          <AlertTriangle className="w-6 h-6 mb-2" />
          <h2 className="text-base font-bold">Deal Room Access Error</h2>
          <p className="text-sm mt-1">{error || "Workspace not found"}</p>
          <Link
            href="/seller/deal-room"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-red-800 underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Deal Rooms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/seller/deal-room"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Deal Rooms
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Ref: {txn.referenceCode}</span>
            <span className="text-xs text-slate-400">|</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              V{txn.currentVersionNumber} Active
            </span>
          </div>
        </div>

        {/* Hero Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-[#1557A6]/10 text-[#1557A6]">
                  PROMOTER CLOSING WORKSPACE
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {txn.status}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">
                {txn.opportunityTitle || "Acquisition Workspace"}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Opportunity Ref: <span className="font-mono font-semibold">{txn.opportunityReference}</span> &bull; MOU Ref: <span className="font-mono font-semibold">{txn.mouReference}</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
              <div className="bg-slate-50 px-5 py-3 rounded-xl border border-slate-200/80">
                <span className="text-[10px] uppercase font-semibold text-slate-400 block">Agreed Consideration</span>
                <span className="text-xl font-extrabold text-slate-900 mt-0.5 block">
                  {formatCurrency(txn.agreedAmount)}
                </span>
              </div>
              {!txn.sellerConfirmed && txn.status !== "CLOSED" && (
                <button
                  onClick={handleConfirmTerms}
                  disabled={actionLoading}
                  className="px-5 py-3 bg-[#1557A6] text-white text-xs font-semibold rounded-xl hover:bg-[#235360] transition shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Terms as Seller
                </button>
              )}
              {txn.sellerConfirmed && (
                <div className="px-4 py-2.5 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-emerald-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Seller Confirmed
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 space-x-2">
          <button
            onClick={() => setActiveTab("terms")}
            className={`pb-3 px-4 text-xs font-semibold transition border-b-2 ${
              activeTab === "terms"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Agreed Terms
          </button>
          <button
            onClick={() => setActiveTab("checklist")}
            className={`pb-3 px-4 text-xs font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "checklist"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Closing Checklist
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={`pb-3 px-4 text-xs font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === "documents"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Closing Documents ({documents.length})
          </button>
        </div>

        {/* Tab 1: Terms */}
        {activeTab === "terms" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-900">Agreed Transaction Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">Consideration</span>
                  <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(txn.agreedAmount)} {txn.currency}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div>
                    <span className="text-slate-500">Transaction Type:</span>
                    <p className="font-semibold text-slate-800">{txn.transactionType.replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Payment Structure:</span>
                    <p className="font-semibold text-slate-800">{txn.paymentStructure.replace("_", " ")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Token Treatment:</span>
                    <p className="font-semibold text-slate-800">{txn.tokenDepositTreatment.replace(/_/g, " ")}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-2">
                  <div>
                    <span className="text-slate-500">Buyer Confirmation:</span>
                    <p className="font-semibold text-slate-800">
                      {txn.buyerConfirmed ? "Confirmed by Buyer" : "Pending Buyer Confirmation"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Seller Confirmation:</span>
                    <p className="font-semibold text-slate-800">
                      {txn.sellerConfirmed ? "Confirmed by Seller" : "Pending Seller Confirmation"}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Governing Law:</span>
                    <p className="font-semibold text-slate-800">{txn.governingLaw}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Checklist */}
        {activeTab === "checklist" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Closing Conditions Checklist</h3>
            <div className="divide-y divide-slate-100">
              {conditions.map((c) => (
                <div key={c.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">{c.title}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>
                  </div>
                  <div>
                    {c.status === "SATISFIED" ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Satisfied
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">
                        {c.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Documents */}
        {activeTab === "documents" && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Closing Documents & Resolutions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Upload board resolutions and seller execution copies.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedConditionId(null);
                  setDocModalOpen(true);
                }}
                className="px-3.5 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg hover:bg-[#235360] transition shadow-sm flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                Upload Document
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((d) => (
                  <div key={d.id} className="py-3 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-800">{d.title}</span>
                      <span className="ml-2 text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                        {d.document_type}
                      </span>
                    </div>
                    <a
                      href={`/api/v1/transactions/${dealId}/documents/${d.id}/download`}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upload Modal */}
        {docModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <h3 className="text-base font-bold text-slate-900">Upload Seller Closing Document</h3>
              <form onSubmit={handleUploadDocument} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Document Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    required
                    placeholder="e.g. Board Resolution approving business transfer"
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1557A6]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Document Type</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#1557A6]"
                  >
                    <option value="BOARD_RESOLUTION">Board / Shareholder Resolution</option>
                    <option value="FINAL_TRANSACTION_AGREEMENT">Final Agreement (Promoter Copy)</option>
                    <option value="CLOSING_CERTIFICATE">Bilateral Closing Certificate</option>
                    <option value="REGULATORY_APPROVAL">Regulatory Approval / Filing</option>
                    <option value="OTHER_CLOSING_EVIDENCE">Other Evidence</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">File (PDF, PNG, JPEG &le; 15MB)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required
                    className="w-full text-xs p-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDocModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-lg hover:bg-[#235360] transition shadow-sm"
                  >
                    Upload Document
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
