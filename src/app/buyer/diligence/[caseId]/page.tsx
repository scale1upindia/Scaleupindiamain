"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderLock,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Download,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  X,
  FileCheck2,
  Calculator,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  DiligenceCaseOverviewView,
  DiligenceChecklistItemView,
  DiligenceFindingView,
  DiligenceClarificationView,
  DiligenceEvidenceDetailView,
  DiligenceCategory,
  ChecklistItemStatus,
  ChecklistItemPriority,
  FindingSeverity,
  DiligenceCaseStatus,
} from "@/types/diligence";

export default function BuyerDiligenceWorkspacePage({
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
  const [findings, setFindings] = useState<DiligenceFindingView[]>([]);
  const [clarifications, setClarifications] = useState<DiligenceClarificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"checklist" | "evidence" | "findings" | "clarifications">("checklist");

  // Modals & form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<DiligenceChecklistItemView | null>(null);
  const [requestDescription, setRequestDescription] = useState("");
  const [requestPriority, setRequestPriority] = useState<ChecklistItemPriority>("MEDIUM");
  const [requestDueDate, setRequestDueDate] = useState("");

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedEvidenceForReview, setSelectedEvidenceForReview] = useState<{
    evidenceId: string;
    versionNumber: number;
    title: string;
  } | null>(null);
  const [reviewVerdict, setReviewVerdict] = useState<"ACCEPTED" | "REJECTED" | "CLARIFICATION_REQUIRED">("ACCEPTED");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [clarificationQuestion, setClarificationQuestion] = useState("");

  const [showFindingModal, setShowFindingModal] = useState(false);
  const [findingCategory, setFindingCategory] = useState<DiligenceCategory>("FINANCIAL");
  const [findingTitle, setFindingTitle] = useState("");
  const [findingDescription, setFindingDescription] = useState("");
  const [findingSeverity, setFindingSeverity] = useState<FindingSeverity>("MEDIUM");
  const [findingExposure, setFindingExposure] = useState<number | "">("");
  const [findingRemediation, setFindingRemediation] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [statusChangeLoading, setStatusChangeLoading] = useState(false);
  const [valLoading, setValLoading] = useState(false);
  const [selectedFindingSeverityFilter, setSelectedFindingSeverityFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/buyer/diligence/${caseId}`);
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
      const [caseRes, checkRes, evdRes, findRes, clarRes] = await Promise.all([
        fetch(`/api/v1/diligence-cases/${caseId}`),
        fetch(`/api/v1/diligence-cases/${caseId}/checklist`),
        fetch(`/api/v1/diligence-cases/${caseId}/evidence`),
        fetch(`/api/v1/diligence-cases/${caseId}/findings`),
        fetch(`/api/v1/diligence-cases/${caseId}/clarifications`),
      ]);

      const [caseJson, checkJson, evdJson, findJson, clarJson] = await Promise.all([
        caseRes.json(),
        checkRes.json(),
        evdRes.json(),
        findRes.json(),
        clarRes.json(),
      ]);

      if (caseJson.success) {
        setDiligenceCase(caseJson.data);
      } else {
        setError(caseJson.error?.message || "Failed to load diligence case.");
      }

      if (checkJson.success) setChecklist(checkJson.data.items);
      if (evdJson.success) setEvidenceList(evdJson.data.evidence);
      if (findJson.success) setFindings(findJson.data.findings);
      if (clarJson.success) setClarifications(clarJson.data.clarifications);
    } catch {
      setError("Network communication error.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (evidenceId: string) => {
    try {
      const res = await fetch(`/api/v1/diligence-cases/${caseId}/evidence/${evidenceId}/signed-url`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data.downloadUrl) {
        window.open(json.data.downloadUrl, "_blank");
      } else {
        alert(json.error?.message || "Failed to generate signed download token.");
      }
    } catch {
      alert("Error initiating secure download.");
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForRequest) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/diligence-cases/${caseId}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checklistItemId: selectedItemForRequest.id,
          requestDescription,
          priority: requestPriority,
          required: true,
          dueDate: requestDueDate || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowRequestModal(false);
        setRequestDescription("");
        setRequestDueDate("");
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Failed to create document request.");
      }
    } catch {
      alert("Network communication error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvidenceForReview) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/v1/diligence-cases/${caseId}/evidence/${selectedEvidenceForReview.evidenceId}/versions/${selectedEvidenceForReview.versionNumber}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: reviewVerdict,
            notes: reviewNotes || undefined,
            rejectionReason: reviewVerdict === "REJECTED" ? rejectionReason : undefined,
            clarificationQuestion: reviewVerdict === "CLARIFICATION_REQUIRED" ? clarificationQuestion : undefined,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setShowReviewModal(false);
        setReviewNotes("");
        setRejectionReason("");
        setClarificationQuestion("");
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Failed to submit review.");
      }
    } catch {
      alert("Network communication error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateFinding = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch(`/api/v1/diligence-cases/${caseId}/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: findingCategory,
          title: findingTitle,
          description: findingDescription,
          severity: findingSeverity,
          financialImpactEstimate: findingExposure ? Number(findingExposure) : undefined,
          remediationPlan: findingRemediation || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowFindingModal(false);
        setFindingTitle("");
        setFindingDescription("");
        setFindingExposure("");
        setFindingRemediation("");
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Failed to create finding.");
      }
    } catch {
      alert("Network communication error.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransitionStatus = async (targetStatus: DiligenceCaseStatus, verdict?: "APPROVED" | "REJECTED") => {
    if (!confirm(`Are you sure you want to transition this case to ${targetStatus.replace(/_/g, " ")}?`)) {
      return;
    }
    setStatusChangeLoading(true);
    try {
      const res = await fetch(`/api/v1/diligence-cases/${caseId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetStatus, verdict }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWorkspaceData();
      } else {
        alert(json.error?.message || "Failed to transition case status.");
      }
    } catch {
      alert("Network communication error.");
    } finally {
      setStatusChangeLoading(false);
    }
  };

  const handleOpenValuation = async () => {
    setValLoading(true);
    try {
      const res = await fetch(`/api/v1/diligence-cases/${caseId}/valuations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success && json.data) {
        router.push(`/buyer/valuation/${json.data.id}`);
      } else {
        alert(json.error?.message || "Failed to initialize valuation workspace.");
      }
    } catch {
      alert("Network error connecting to valuation engine.");
    } finally {
      setValLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-[#1557A6]" />
        <p className="text-xs text-gray-500 mt-2">Loading Diligence Workspace...</p>
      </div>
    );
  }

  if (error || !diligenceCase) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8 max-w-4xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-bold text-sm">Failed to open workspace</h3>
            <p className="text-xs">{error || "Case not found."}</p>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = diligenceCase.stats.completionPercentage;

  // Group checklist items by category
  const groupedChecklist = checklist.reduce<Record<string, DiligenceChecklistItemView[]>>((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const filteredFindings = findings.filter(
    (f) => selectedFindingSeverityFilter === "ALL" || f.severity === selectedFindingSeverityFilter
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/dashboard" className="hover:text-gray-900 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/buyer/diligence" className="hover:text-gray-900 transition-colors">
            Due Diligence Portfolio
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono font-semibold text-gray-800">{diligenceCase.referenceCode}</span>
        </div>

        {/* Case Header Card */}
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
                  href={`/buyer/mous/${diligenceCase.mouId}`}
                  className="text-[#1557A6] hover:underline flex items-center gap-1 font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Bilateral MOU: {diligenceCase.mouReferenceCode}
                </Link>
                <span>•</span>
                <span>Opened: {new Date(diligenceCase.createdAt).toLocaleDateString("en-IN")}</span>
              </div>
            </div>

            {/* FSM Status Transitions */}
            <div className="flex flex-wrap items-center gap-2">
              {diligenceCase.status === "CREATED" && (
                <button
                  onClick={() => handleTransitionStatus("INITIATED")}
                  disabled={statusChangeLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1e4854] transition-colors disabled:opacity-50"
                >
                  Activate Diligence
                </button>
              )}
              {["INITIATED", "REQUESTS_OPEN", "DOCUMENTS_SUBMITTED"].includes(diligenceCase.status) && (
                <button
                  onClick={() => handleTransitionStatus("UNDER_REVIEW")}
                  disabled={statusChangeLoading}
                  className="px-3.5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Begin Formal Review
                </button>
              )}
              {diligenceCase.status === "UNDER_REVIEW" && (
                <>
                  <button
                    onClick={() => handleTransitionStatus("REVIEW_COMPLETE")}
                    disabled={statusChangeLoading}
                    className="px-3.5 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                  >
                    Complete Review
                  </button>
                  <button
                    onClick={() => handleTransitionStatus("CLARIFICATION_REQUIRED")}
                    disabled={statusChangeLoading}
                    className="px-3.5 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    Flag Clarification Needed
                  </button>
                </>
              )}
              {diligenceCase.status === "REVIEW_COMPLETE" && (
                <>
                  <button
                    onClick={() => handleTransitionStatus("APPROVED", "APPROVED")}
                    disabled={statusChangeLoading}
                    className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve Clearance
                  </button>
                  <button
                    onClick={() => handleTransitionStatus("REJECTED", "REJECTED")}
                    disabled={statusChangeLoading}
                    className="px-3 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
                  >
                    Reject Due to Findings
                  </button>
                </>
              )}
              {diligenceCase.status !== "CLOSED" && (
                <button
                  onClick={() => handleTransitionStatus("CLOSED")}
                  disabled={statusChangeLoading}
                  className="px-3 py-2 bg-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50"
                >
                  Close Case
                </button>
              )}
              <button
                onClick={handleOpenValuation}
                disabled={valLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1e4854] transition-colors disabled:opacity-50"
              >
                {valLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
                Valuation Engine
              </button>
            </div>
          </div>

          {/* Progress & Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 col-span-1 sm:col-span-2">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-gray-500 font-medium">Verification Progress</span>
                <span className="text-gray-900 font-bold">{progressPct}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1557A6] rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
                <span>{diligenceCase.stats.completedItems} / {diligenceCase.stats.totalItems} items completed</span>
                <span>{diligenceCase.stats.totalEvidence} evidence files</span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <span className="text-[11px] text-gray-500 block">Open Requests</span>
              <span className="text-xl font-bold text-gray-900 mt-0.5 block">
                {diligenceCase.stats.openRequests}
              </span>
              <span className="text-[10px] text-gray-400">Awaiting seller submission</span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <span className="text-[11px] text-gray-500 block">Clarifications</span>
              <span className="text-xl font-bold text-gray-900 mt-0.5 block">
                {diligenceCase.stats.openClarifications}
              </span>
              <span className="text-[10px] text-gray-400">Questions open</span>
            </div>

            <div className={`p-3.5 rounded-xl border ${
              diligenceCase.stats.criticalFindings > 0
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-slate-50 border-slate-100 text-gray-800"
            }`}>
              <span className="text-[11px] block opacity-80">Risk Findings</span>
              <span className="text-xl font-bold mt-0.5 block">
                {diligenceCase.stats.criticalFindings > 0
                  ? `${diligenceCase.stats.criticalFindings} Critical`
                  : `${diligenceCase.stats.highFindings} High Risk`}
              </span>
              <span className="text-[10px] opacity-75">
                {findings.length} total logged
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-xl px-4 pt-2 shadow-sm">
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
            <FolderLock className="w-4 h-4" />
            Evidence Documents ({evidenceList.length})
          </button>
          <button
            onClick={() => setActiveTab("findings")}
            className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === "findings"
                ? "border-[#1557A6] text-[#1557A6]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Risk Findings ({findings.length})
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
        </div>

        {/* Tab 1: Checklist */}
        {activeTab === "checklist" && (
          <div className="space-y-6">
            {Object.entries(groupedChecklist).map(([category, items]) => {
              const completedCount = items.filter((i) => i.status === "ACCEPTED" || i.status === "WAIVED").length;
              const catPct = Math.round((completedCount / items.length) * 100);

              return (
                <div key={category} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Category Header */}
                  <div className="bg-slate-50/80 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 tracking-wide">
                        {category.replace(/_/g, " ")}
                      </h3>
                      <p className="text-xs text-gray-500">
                        {completedCount} of {items.length} items verified ({catPct}%)
                      </p>
                    </div>
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-[#1557A6]" style={{ width: `${catPct}%` }} />
                    </div>
                  </div>

                  {/* Items List */}
                  <div className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <div key={item.id} className="p-6 hover:bg-slate-50/50 transition-colors space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-gray-900">{item.title}</span>
                              {item.required && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                                  REQUIRED
                                </span>
                              )}
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  item.status === "ACCEPTED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : item.status === "REJECTED"
                                    ? "bg-rose-100 text-rose-800"
                                    : item.status === "EVIDENCE_SUBMITTED"
                                    ? "bg-blue-100 text-blue-800"
                                    : item.status === "CLARIFICATION_REQUIRED"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-700"
                                }`}
                              >
                                {item.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-gray-500 max-w-2xl">{item.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedItemForRequest(item);
                                setRequestDescription(`Please provide verified records for: ${item.title}`);
                                setShowRequestModal(true);
                              }}
                              className="px-3 py-1.5 text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 hover:bg-[#1557A6]/20 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              Request Document
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Evidence Documents */}
        {activeTab === "evidence" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Submitted Evidence Records</h2>
              <p className="text-xs text-gray-500">
                Immutable, cryptographically verified evidence documents uploaded for this diligence case
              </p>
            </div>

            {evidenceList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-500">
                No evidence documents uploaded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {evidenceList.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                            {ev.referenceCode}
                          </span>
                          <span className="font-bold text-sm text-gray-900">{ev.title}</span>
                          <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded text-gray-600">
                            v{ev.currentVersionNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              ev.status === "ACCEPTED"
                                ? "bg-emerald-100 text-emerald-800"
                                : ev.status === "REJECTED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {ev.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 block">
                          Category: {ev.category.replace(/_/g, " ")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(ev.id)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5 text-gray-500" />
                          Download Active File
                        </button>
                        <button
                          onClick={() => {
                            setSelectedEvidenceForReview({
                              evidenceId: ev.id,
                              versionNumber: ev.currentVersionNumber,
                              title: ev.title,
                            });
                            setShowReviewModal(true);
                          }}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-[#1557A6] hover:bg-[#1e4854] rounded-lg transition-colors"
                        >
                          Review Version
                        </button>
                      </div>
                    </div>

                    {/* Versions list */}
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <span className="text-[11px] font-bold text-gray-600 block">Version History</span>
                      {ev.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-800">Version {ver.versionNumber}:</span>
                              <span className="text-gray-600">{ver.originalFilename}</span>
                              <span className="text-[10px] text-gray-400">
                                ({(ver.fileSize / 1024).toFixed(1)} KB)
                              </span>
                              <span className="text-[10px] font-semibold text-gray-500">
                                Status: {ver.reviewStatus}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 block truncate max-w-lg">
                              SHA256: {ver.checksum}
                            </span>
                          </div>
                          {ver.reviewerNotes && (
                            <span className="text-[11px] text-gray-500 italic max-w-xs truncate">
                              &quot;{ver.reviewerNotes}&quot;
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Risk Findings */}
        {activeTab === "findings" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">Due Diligence Findings & Red Flags</h2>
                <p className="text-xs text-gray-500">
                  Track liabilities, tax claims, litigation risks, or regulatory disclosures discovered during examination
                </p>
              </div>
              <button
                onClick={() => setShowFindingModal(true)}
                className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-xl hover:bg-[#1e4854] transition-colors flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Log New Finding
              </button>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                <button
                  key={sev}
                  onClick={() => setSelectedFindingSeverityFilter(sev)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                    selectedFindingSeverityFilter === sev
                      ? "bg-[#1557A6] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>

            {filteredFindings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-teal-600 mx-auto" />
                <h3 className="text-sm font-bold text-gray-900">No Findings Logged</h3>
                <p className="text-xs text-gray-500">
                  No issues or red flags matching the current filter have been recorded for this case.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredFindings.map((f) => (
                  <div
                    key={f.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                          {f.referenceCode}
                        </span>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                            f.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800"
                              : f.severity === "HIGH"
                              ? "bg-orange-100 text-orange-800"
                              : f.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {f.severity} RISK
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                          {f.category.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-gray-700 bg-slate-100 px-2.5 py-1 rounded-md">
                        Status: {f.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-gray-900">{f.title}</h3>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{f.description}</p>

                    {f.financialImpactEstimate && (
                      <div className="text-xs bg-amber-50 border border-amber-200 text-amber-900 p-2.5 rounded-lg font-medium">
                        Estimated Exposure: ₹{f.financialImpactEstimate.toLocaleString("en-IN")} INR
                      </div>
                    )}

                    {f.remediationPlan && (
                      <div className="text-xs bg-slate-50 border border-slate-100 p-3 rounded-lg">
                        <span className="font-bold text-gray-800 block mb-1">Recommended Remediation:</span>
                        <p className="text-gray-600">{f.remediationPlan}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Clarifications */}
        {activeTab === "clarifications" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-900">Clarification Requests</h2>
              <p className="text-xs text-gray-500">
                Official questions and responses between reviewer and promoter regarding evidence
              </p>
            </div>

            {clarifications.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-xs text-gray-500">
                No clarification inquiries opened.
              </div>
            ) : (
              <div className="space-y-4">
                {clarifications.map((cl) => (
                  <div key={cl.id} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-800">
                          Question asked by {cl.raisedByName || "Reviewer"}
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
                          <span className="text-xs font-bold text-[#1557A6]">
                            Seller Response ({cl.respondedByName || "Promoter"})
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {cl.respondedAt ? new Date(cl.respondedAt).toLocaleDateString("en-IN") : ""}
                          </span>
                        </div>
                        <p className="text-xs text-gray-800 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                          {cl.responseText}
                        </p>
                      </div>
                    ) : (
                      <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>Awaiting promoter response...</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Request Evidence */}
      {showRequestModal && selectedItemForRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Request Evidence Document</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Checklist Requirement</label>
                <div className="p-2.5 bg-gray-50 border rounded-lg text-gray-800 font-medium">
                  {selectedItemForRequest.title}
                </div>
              </div>
              <div>
                <label className="block font-bold text-gray-700 mb-1">Specific Instructions for Seller *</label>
                <textarea
                  rows={3}
                  required
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  placeholder="e.g. Provide certified audited statements for FY 23-24 including notes on contingent liabilities..."
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Priority</label>
                  <select
                    value={requestPriority}
                    onChange={(e) => setRequestPriority(e.target.value as ChecklistItemPriority)}
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={requestDueDate}
                    onChange={(e) => setRequestDueDate(e.target.value)}
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? "Submitting..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Review Evidence */}
      {showReviewModal && selectedEvidenceForReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">
                Review Evidence: {selectedEvidenceForReview.title} (v{selectedEvidenceForReview.versionNumber})
              </h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleReviewEvidence} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Decision</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewVerdict("ACCEPTED")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-colors ${
                      reviewVerdict === "ACCEPTED"
                        ? "bg-emerald-50 border-emerald-500 text-emerald-800"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewVerdict("REJECTED")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-colors ${
                      reviewVerdict === "REJECTED"
                        ? "bg-rose-50 border-rose-500 text-rose-800"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewVerdict("CLARIFICATION_REQUIRED")}
                    className={`p-2.5 rounded-lg border font-bold text-center transition-colors ${
                      reviewVerdict === "CLARIFICATION_REQUIRED"
                        ? "bg-amber-50 border-amber-500 text-amber-800"
                        : "bg-white border-gray-200 text-gray-700"
                    }`}
                  >
                    Clarify
                  </button>
                </div>
              </div>

              {reviewVerdict === "REJECTED" && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Rejection Reason *</label>
                  <textarea
                    rows={3}
                    required
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Specify why this document is unacceptable..."
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  />
                </div>
              )}

              {reviewVerdict === "CLARIFICATION_REQUIRED" && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Clarification Question *</label>
                  <textarea
                    rows={3}
                    required
                    value={clarificationQuestion}
                    onChange={(e) => setClarificationQuestion(e.target.value)}
                    placeholder="Ask the promoter to explain discrepancies or supply missing annexures..."
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-gray-700 mb-1">Reviewer Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Auditor comments or internal review notes..."
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? "Saving..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Finding */}
      {showFindingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-900">Log Risk Finding</h3>
              <button onClick={() => setShowFindingModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFinding} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category</label>
                  <select
                    value={findingCategory}
                    onChange={(e) => setFindingCategory(e.target.value as DiligenceCategory)}
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  >
                    <option value="CORPORATE_LEGAL">Corporate Legal</option>
                    <option value="FINANCIAL">Financial</option>
                    <option value="TAX">Tax</option>
                    <option value="BANKING">Banking</option>
                    <option value="COMPLIANCE">Compliance</option>
                    <option value="LITIGATION">Litigation</option>
                    <option value="REGULATORY">Regulatory</option>
                    <option value="INTELLECTUAL_PROPERTY">Intellectual Property</option>
                    <option value="EMPLOYEES_HR">Employees / HR</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Severity</label>
                  <select
                    value={findingSeverity}
                    onChange={(e) => setFindingSeverity(e.target.value as FindingSeverity)}
                    className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                  >
                    <option value="CRITICAL">Critical (Deal Breaker)</option>
                    <option value="HIGH">High (Material Concern)</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Finding Title *</label>
                <input
                  type="text"
                  required
                  value={findingTitle}
                  onChange={(e) => setFindingTitle(e.target.value)}
                  placeholder="e.g. Unresolved GST Demand Notice FY 22-23"
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Description & Evidence Analysis *</label>
                <textarea
                  rows={3}
                  required
                  value={findingDescription}
                  onChange={(e) => setFindingDescription(e.target.value)}
                  placeholder="Describe the nature of the risk and specific evidence or document reviewed..."
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Estimated Financial Exposure INR</label>
                <input
                  type="number"
                  value={findingExposure}
                  onChange={(e) => setFindingExposure(e.target.value ? Number(e.target.value) : "")}
                  placeholder="e.g. 2500000"
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Recommended Remediation / Condition Precedent</label>
                <textarea
                  rows={2}
                  value={findingRemediation}
                  onChange={(e) => setFindingRemediation(e.target.value)}
                  placeholder="e.g. Demand indemnification escrow or insist on promoter clearing dispute prior to definitive agreement..."
                  className="w-full p-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1557A6]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowFindingModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-[#1557A6] text-white rounded-lg font-bold disabled:opacity-50"
                >
                  {actionLoading ? "Logging..." : "Log Finding"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
