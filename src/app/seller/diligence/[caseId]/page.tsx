"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderLock,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Upload,
  HelpCircle,
  ChevronRight,
  X,
  FileCheck2,
  Send,
  Calculator,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  DiligenceCaseOverviewView,
  DiligenceChecklistItemView,
  DiligenceClarificationView,
  DiligenceEvidenceDetailView,
  DiligenceCategory,
} from "@/types/diligence";

export default function SellerDiligenceWorkspacePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { caseId } = use(params);

  const [diligenceCase, setDiligenceCase] = useState<DiligenceCaseOverviewView | null>(null);
  const [checklist, setChecklist] = useState<DiligenceChecklistItemView[]>([]);
  const [evidenceList, setEvidenceList] = useState<DiligenceEvidenceDetailView[]>([]);
  const [clarifications, setClarifications] = useState<DiligenceClarificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "clarifications" | "checklist" | "evidence">("requests");

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedChecklistItemId, setSelectedChecklistItemId] = useState<string>("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined);
  const [uploadCategory, setUploadCategory] = useState<DiligenceCategory>("CORPORATE_LEGAL");
  const [uploadTitle, setUploadTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Clarification response modal/state
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [selectedClarification, setSelectedClarification] = useState<DiligenceClarificationView | null>(null);
  const [clarificationAnswer, setClarificationAnswer] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/seller/diligence/${caseId}`);
      return;
    }
    if (user && caseId) {
      fetchWorkspaceData();
    }
  }, [user, authLoading, caseId]);

  const fetchWorkspaceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [caseRes, checkRes, evdRes, clarRes] = await Promise.all([
        fetch(`/api/v1/diligence-cases/${caseId}`),
        fetch(`/api/v1/diligence-cases/${caseId}/checklist`),
        fetch(`/api/v1/diligence-cases/${caseId}/evidence`),
        fetch(`/api/v1/diligence-cases/${caseId}/clarifications`),
      ]);

      const [caseJson, checkJson, evdJson, clarJson] = await Promise.all([
        caseRes.json(),
        checkRes.json(),
        evdRes.json(),
        clarRes.json(),
      ]);

      if (caseJson.success) {
        setDiligenceCase(caseJson.data);
      } else {
        setError(caseJson.error?.message || "Failed to load due diligence case.");
      }

      if (checkJson.success) setChecklist(checkJson.data.items);
      if (evdJson.success) setEvidenceList(evdJson.data.evidence);
      if (clarJson.success) setClarifications(clarJson.data.clarifications);
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !selectedChecklistItemId || !uploadTitle) {
      alert("Please fill all required fields and select a valid document.");
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("checklistItemId", selectedChecklistItemId);
      formData.append("category", uploadCategory);
      formData.append("title", uploadTitle);
      if (selectedRequestId) formData.append("requestId", selectedRequestId);

      const res = await fetch(`/api/v1/diligence-cases/${caseId}/evidence`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setShowUploadModal(false);
        setSelectedFile(null);
        setUploadTitle("");
        setSelectedRequestId(undefined);
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Document upload failed.");
      }
    } catch {
      alert("Network error during document upload.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleClarificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClarification || !clarificationAnswer.trim()) return;

    setAnswerLoading(true);
    try {
      const res = await fetch(
        `/api/v1/diligence-cases/${caseId}/clarifications/${selectedClarification.id}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ responseText: clarificationAnswer }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setShowClarificationModal(false);
        setSelectedClarification(null);
        setClarificationAnswer("");
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Failed to send response.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setAnswerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#1557A6]" />
        <p className="text-xs text-gray-500 mt-2">Loading Diligence Desk...</p>
      </div>
    );
  }

  if (error || !diligenceCase) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Failed to open diligence desk</h3>
            <p className="text-xs">{error || "Case not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = diligenceCase.stats.completionPercentage;

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/seller/diligence" className="hover:text-gray-900 transition-colors">
            Promoter Diligence Desk
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono font-semibold text-gray-800">{diligenceCase.referenceCode}</span>
        </div>

        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 px-3 py-1 rounded-md">
                  {diligenceCase.referenceCode}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {diligenceCase.status.replace(/_/g, " ")}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                {diligenceCase.opportunityTitle}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <Link
                  href={`/seller/mous/${diligenceCase.mouId}`}
                  className="text-[#1557A6] hover:underline flex items-center gap-1 font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Bilateral MOU: {diligenceCase.mouReferenceCode}
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/seller/valuation"
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors border border-slate-200 shrink-0"
              >
                <Calculator className="w-4 h-4 text-[#1557A6]" />
                Valuation Desk
              </Link>
              <button
                onClick={() => {
                  const firstPending = checklist.find((i) => i.status !== "ACCEPTED") || checklist[0];
                  if (firstPending) {
                    setSelectedChecklistItemId(firstPending.id);
                    setUploadCategory(firstPending.category as DiligenceCategory);
                    setUploadTitle(`Evidence for ${firstPending.title}`);
                  }
                  setShowUploadModal(true);
                }}
                className="px-4 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1e4854] transition-colors flex items-center gap-2 shrink-0"
              >
                <Upload className="w-4 h-4" />
                Upload Evidence Document
              </button>
            </div>
          </div>

          {/* Progress Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 col-span-1 sm:col-span-2">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Clearance Progress</span>
                <span className="text-gray-900 font-bold">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1557A6] rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
                <span>{diligenceCase.stats.completedItems} of {diligenceCase.stats.totalItems} verified clear</span>
                <span>{diligenceCase.stats.totalEvidence} documents submitted</span>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5">
              <span className="text-[11px] text-amber-800 block">Open Requests</span>
              <span className="text-xl font-bold text-amber-950 mt-0.5 block">
                {diligenceCase.stats.openRequests}
              </span>
              <span className="text-[10px] text-amber-700">Submissions required</span>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5">
              <span className="text-[11px] text-blue-800 block">Clarifications Open</span>
              <span className="text-xl font-bold text-blue-950 mt-0.5 block">
                {diligenceCase.stats.openClarifications}
              </span>
              <span className="text-[10px] text-blue-700">Awaiting your response</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
          <button
            onClick={() => setActiveTab("requests")}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "requests"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Clock className="w-4 h-4" />
            Action Requests ({diligenceCase.stats.openRequests})
          </button>
          <button
            onClick={() => setActiveTab("clarifications")}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "clarifications"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Clarifications ({clarifications.length})
          </button>
          <button
            onClick={() => setActiveTab("checklist")}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "checklist"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            Checklist Requirements ({checklist.length})
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "evidence"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4" />
            Disclosed Documents ({evidenceList.length})
          </button>
        </div>

        {/* Tab 1: Requests */}
        {activeTab === "requests" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Buyer Document Requests</h2>
              <p className="text-xs text-gray-500">
                Specific records and statutory proof formally requested by the buyer&apos;s audit team
              </p>
            </div>

            {diligenceCase.stats.openRequests === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900">All Requests Satisfied</h3>
                <p className="text-xs text-gray-500">
                  There are currently no outstanding document requests from the buyer.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
                {checklist.map((item) => (
                  <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">{item.title}</span>
                        {item.required && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                            REQUIRED
                          </span>
                        )}
                        <span className="text-[10px] font-bold bg-slate-100 text-gray-700 px-2 py-0.5 rounded">
                          {item.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedChecklistItemId(item.id);
                        setUploadCategory(item.category as DiligenceCategory);
                        setUploadTitle(`Evidence for ${item.title}`);
                        setShowUploadModal(true);
                      }}
                      className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Document
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Clarifications */}
        {activeTab === "clarifications" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Clarification Queries</h2>
              <p className="text-xs text-gray-500">
                Questions from the buyer&apos;s due diligence team regarding submitted records
              </p>
            </div>

            {clarifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-500">
                No clarification inquiries from buyer.
              </div>
            ) : (
              <div className="space-y-4">
                {clarifications.map((cl) => (
                  <div key={cl.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">
                          Inquiry from {cl.raisedByName || "Reviewer"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(cl.createdAt).toLocaleDateString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        {cl.question}
                      </p>
                    </div>

                    {cl.responseText ? (
                      <div className="space-y-1 pl-4 border-l-2 border-[#1557A6]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1557A6]">Your Response</span>
                          <span className="text-[11px] text-gray-400">
                            {cl.respondedAt ? new Date(cl.respondedAt).toLocaleDateString("en-IN") : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray-800 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                          {cl.responseText}
                        </p>
                      </div>
                    ) : (
                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setSelectedClarification(cl);
                            setClarificationAnswer("");
                            setShowClarificationModal(true);
                          }}
                          className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Respond to Inquiry
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Checklist Requirements */}
        {activeTab === "checklist" && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
            {checklist.map((item) => (
              <div key={item.id} className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{item.title}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === "ACCEPTED"
                          ? "bg-emerald-100 text-emerald-800"
                          : item.status === "REJECTED"
                          ? "bg-rose-100 text-rose-800"
                          : item.status === "EVIDENCE_SUBMITTED"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {item.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedChecklistItemId(item.id);
                    setUploadCategory(item.category as DiligenceCategory);
                    setUploadTitle(`Evidence for ${item.title}`);
                    setShowUploadModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 hover:bg-[#1557A6]/20 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Disclosed Evidence Documents */}
        {activeTab === "evidence" && (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden shadow-sm">
            {evidenceList.length === 0 ? (
              <div className="p-12 text-center text-xs text-gray-500">
                No documents uploaded yet.
              </div>
            ) : (
              evidenceList.map((ev) => (
                <div key={ev.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{ev.title}</span>
                      <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                        v{ev.currentVersionNumber}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {ev.category.replace(/_/g, " ")} • {(ev.activeVersion.fileSize / 1024).toFixed(1)} KB
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono">
                      Checksum: {ev.activeVersion.checksum.slice(0, 16)}...
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {ev.status}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Modal: Upload Evidence */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Upload Evidence Document</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Checklist Requirement *</label>
                <select
                  required
                  value={selectedChecklistItemId}
                  onChange={(e) => {
                    setSelectedChecklistItemId(e.target.value);
                    const item = checklist.find((i) => i.id === e.target.value);
                    if (item) setUploadCategory(item.category as DiligenceCategory);
                  }}
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                >
                  <option value="">Select Requirement</option>
                  {checklist.map((i) => (
                    <option key={i.id} value={i.id}>
                      [{i.category}] {i.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Attach File (PDF, PNG, JPG up to 15MB) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedFile(e.target.files[0]);
                    }
                  }}
                  className="w-full p-2 border rounded-lg text-gray-600 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#1557A6]/10 file:text-[#1557A6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {uploadLoading ? "Uploading..." : "Submit Evidence"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Clarification Response */}
      {showClarificationModal && selectedClarification && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Respond to Clarification</h3>
              <button onClick={() => setShowClarificationModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleClarificationSubmit} className="space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1">
                <span className="font-bold text-gray-800 block">Question:</span>
                <p className="text-gray-700">{selectedClarification.question}</p>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Your Clarification Answer *</label>
                <textarea
                  rows={4}
                  required
                  value={clarificationAnswer}
                  onChange={(e) => setClarificationAnswer(e.target.value)}
                  placeholder="Provide precise details, reconciliations, or context..."
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowClarificationModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={answerLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {answerLoading ? "Sending..." : "Submit Response"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
