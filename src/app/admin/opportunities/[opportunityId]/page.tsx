"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  TrendingUp,
  Scale,
  FileCheck2,
  ArrowLeft,
  Lock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Download,
  Send,
  MessageSquare,
  AlertCircle,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  OpportunityRecord,
  OpportunityStatus,
  OpportunityDocumentSummary,
  OpportunityInternalNoteRecord,
  AdminOpportunityReviewAction,
} from "@/types/opportunity";

export default function AdminOpportunityReviewPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = use(params);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [opp, setOpp] = useState<OpportunityRecord | null>(null);
  const [documents, setDocuments] = useState<OpportunityDocumentSummary[]>([]);
  const [notes, setNotes] = useState<OpportunityInternalNoteRecord[]>([]);

  // Action Modals / Text Inputs
  const [actionPrompt, setActionPrompt] = useState<{
    action: AdminOpportunityReviewAction;
    title: string;
    description: string;
  } | null>(null);
  const [actionInputText, setActionInputText] = useState("");

  // Internal Note Input
  const [newNoteContent, setNewNoteContent] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/opportunities/${opportunityId}`);
      const json = await res.json();
      if (json.success) {
        setOpp(json.data.opportunity);
        setDocuments(json.data.documents || []);
        setNotes(json.data.notes || []);
      } else {
        setError(json.error?.message || "Failed to load opportunity for review");
      }
    } catch {
      setError("Network error while loading review dossier.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  const executeAction = async (
    action: AdminOpportunityReviewAction,
    payloadField?: { name: string; value: string }
  ) => {
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = { action };
      if (payloadField && payloadField.value) {
        body[payloadField.name] = payloadField.value;
      }

      const res = await fetch(`/api/v1/admin/opportunities/${opportunityId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (json.success) {
        setSuccess(`Action ${action} executed successfully.`);
        setActionPrompt(null);
        setActionInputText("");
        await fetchDetails();
      } else {
        setError(json.error?.message || `Failed to execute action ${action}`);
      }
    } catch {
      setError("Network error during action execution.");
    } finally {
      setActing(false);
    }
  };

  const handleActionClick = (action: AdminOpportunityReviewAction) => {
    if (action === AdminOpportunityReviewAction.REQUEST_CHANGES) {
      setActionPrompt({
        action,
        title: "Request Amendments from Promoter",
        description: "Specify the exact changes required in the opportunity parameters or documentation.",
      });
      setActionInputText("");
      return;
    }
    if (action === AdminOpportunityReviewAction.REJECT) {
      setActionPrompt({
        action,
        title: "Reject Opportunity Listing",
        description: "Provide the reason for rejecting this listing (e.g. non-compliant metrics, unverified statutory records).",
      });
      setActionInputText("");
      return;
    }
    if (action === AdminOpportunityReviewAction.SUSPEND) {
      setActionPrompt({
        action,
        title: "Suspend Live Opportunity",
        description: "Provide the administrative reason for suspending this published listing.",
      });
      setActionInputText("");
      return;
    }

    if (confirm(`Are you sure you want to execute ${action} on this opportunity?`)) {
      executeAction(action);
    }
  };

  const handlePromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionPrompt) return;
    if (!actionInputText.trim()) {
      setError("Notes / Reason are required for this action.");
      return;
    }

    let fieldName = "notes";
    if (actionPrompt.action === AdminOpportunityReviewAction.REQUEST_CHANGES) {
      fieldName = "changesRequestedNotes";
    } else if (actionPrompt.action === AdminOpportunityReviewAction.REJECT) {
      fieldName = "rejectionReason";
    } else if (actionPrompt.action === AdminOpportunityReviewAction.SUSPEND) {
      fieldName = "suspensionReason";
    }

    executeAction(actionPrompt.action, { name: fieldName, value: actionInputText.trim() });
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;

    setAddingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/opportunities/${opportunityId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: newNoteContent.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        setNewNoteContent("");
        await fetchDetails();
      } else {
        setError(json.error?.message || "Failed to add internal note");
      }
    } catch {
      setError("Network error while adding internal note.");
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-slate-200 p-12 shadow-sm text-center space-y-4 max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
          <p className="text-sm font-semibold text-slate-800">Loading Opportunity Diligence Dossier...</p>
        </div>
      </div>
    );
  }

  if (error && !opp) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-red-200 p-8 shadow-sm text-center space-y-4 max-w-md w-full">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Review Error</h2>
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          <Link
            href="/admin/opportunities"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Queue</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Top Banner */}
      <section className="bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <Link
              href="/admin/opportunities"
              className="inline-flex items-center gap-1.5 text-xs text-[#D9E2EC] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Opportunities Queue</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-white/10 px-3 py-1 rounded border border-white/20 text-[#D9E2EC] font-bold">
                {opp?.referenceCode}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded bg-purple-500/20 text-purple-200 border border-purple-400/40">
                Tier 3 Unmasked Staff View
              </span>
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded bg-white/20 text-white border border-white/30">
                {opp?.status}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {opp?.title}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[#D9E2EC]">
            <span>Sector: <strong className="text-white">{opp?.industry}</strong></span>
            <span>•</span>
            <span>Region: <strong className="text-white">{opp?.operatingRegion.replace(/_/g, " ")}</strong></span>
            <span>•</span>
            <span>Revenue Scale: <strong className="text-white">{opp?.revenueBracket.replace(/_/g, " ")}</strong></span>
            <span>•</span>
            <span>Transaction: <strong className="text-white">{opp?.transactionType.replace(/_/g, " ")}</strong></span>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Prompt if active */}
        {actionPrompt && (
          <div className="bg-white rounded-xl border border-slate-300 p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">{actionPrompt.title}</h3>
              <button
                type="button"
                onClick={() => setActionPrompt(null)}
                className="text-xs text-slate-500 hover:text-slate-800 font-bold"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{actionPrompt.description}</p>
            <form onSubmit={handlePromptSubmit} className="space-y-4">
              <textarea
                rows={3}
                required
                value={actionInputText}
                onChange={(e) => setActionInputText(e.target.value)}
                placeholder="Enter justification or instructions..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionPrompt(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={acting}
                  className="px-5 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  {acting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm & Execute</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Grid: Details & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Inspection Panels */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Unmasked Statutory Identity (Tier 3) */}
            <div className="bg-purple-50/60 rounded-xl border border-purple-200 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-purple-200 pb-3">
                <h2 className="text-sm font-bold text-purple-950 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-purple-700" />
                  <span>Statutory Corporate Identity (Tier 3 Unmasked)</span>
                </h2>
                <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-bold uppercase">
                  Staff Confidential
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Exact Legal Entity Name</span>
                  <strong className="text-slate-900 text-sm">
                    {opp?.exactLegalName || "Not provided by seller"}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Trade / Commercial Brand</span>
                  <strong className="text-slate-900 text-sm">
                    {opp?.exactTradeName || "Not provided"}
                  </strong>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">CIN / LLPIN</span>
                  <span className="font-mono font-bold text-slate-900">
                    {opp?.exactCin || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">GSTIN</span>
                  <span className="font-mono font-bold text-slate-900">
                    {opp?.exactGstin || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Company PAN</span>
                  <span className="font-mono font-bold text-slate-900">
                    {opp?.exactPan || "N/A"}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-[11px] block">Registered Office</span>
                  <span className="text-slate-800">{opp?.exactAddress || "N/A"}</span>
                </div>

                <div className="border-t border-purple-200 pt-3">
                  <span className="text-slate-500 text-[11px] block">Exact Annual Revenue</span>
                  <strong className="text-emerald-900 text-sm">
                    {opp?.exactRevenue ? `₹${(opp.exactRevenue / 10000000).toFixed(2)} Cr` : "N/A"}
                  </strong>
                </div>

                <div className="border-t border-purple-200 pt-3">
                  <span className="text-slate-500 text-[11px] block">Exact Annual EBITDA</span>
                  <strong className="text-emerald-900 text-sm">
                    {opp?.exactEbitda ? `₹${(opp.exactEbitda / 10000000).toFixed(2)} Cr` : "N/A"}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. Public Teaser & Operational Scale */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#1557A6]" />
                <span>Teaser Content & Operational Model</span>
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Teaser Description</span>
                  <p className="text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed mt-1">
                    {opp?.teaserSummary}
                  </p>
                </div>

                {opp?.detailedDescription && (
                  <div>
                    <span className="text-slate-500 text-[11px] block">Detailed Operational Blueprint</span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed mt-1">
                      {opp.detailedDescription}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Business Model:</span>
                    <strong className="text-slate-800">{opp?.businessModel}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Employees:</span>
                    <strong className="text-slate-800">
                      {opp?.employeeRange?.replace(/_/g, " ") || "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Year Established:</span>
                    <strong className="text-slate-800">{opp?.yearEstablished || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">EBITDA Margin:</span>
                    <strong className="text-emerald-700">
                      {opp?.ebitdaMarginBracket?.replace(/_/g, " ") || "N/A"}
                    </strong>
                  </div>
                </div>

                {opp?.facilityDetails && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-500 text-[11px] block">Facilities & Assets:</span>
                    <p className="text-slate-700 mt-1">{opp.facilityDetails}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Document Vault Inspector */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-[#1557A6]" />
                <span>Uploaded Vault Documents ({documents.length})</span>
              </h2>

              <div className="space-y-2 text-xs">
                {documents.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-[11px]">
                    No documents uploaded by promoter for this opportunity.
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#1557A6] block">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                        <p className="font-semibold text-slate-900">{doc.originalFilename}</p>
                        <span className="text-[10px] text-slate-500">
                          {(doc.fileSizeBytes / 1024).toFixed(0)} KB • Verified Magic Bytes
                        </span>
                      </div>

                      <a
                        href={`/api/v1/seller/opportunities/${opportunityId}/documents/${doc.id}`}
                        download
                        className="px-3 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded shadow-sm flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 4. Internal Diligence Notes Panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#1557A6]" />
                <span>Internal Staff Diligence Trail</span>
              </h2>

              {/* Notes List */}
              <div className="space-y-3 text-xs max-h-60 overflow-y-auto pr-1">
                {notes.length === 0 ? (
                  <p className="text-slate-400 text-center py-4 text-[11px]">
                    No internal diligence notes recorded yet.
                  </p>
                ) : (
                  notes.map((n) => (
                    <div
                      key={n.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <strong className="text-slate-800">
                          {n.authorName || "Platform Reviewer"}
                        </strong>
                        <span>{new Date(n.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{n.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Note Form */}
              <form onSubmit={handleAddNote} className="space-y-2 pt-2 border-t border-slate-100">
                <textarea
                  rows={2}
                  required
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Add confidential review note for fellow administrators..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-[#1557A6] text-slate-800"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={addingNote || !newNoteContent.trim()}
                    className="px-4 py-1.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {addingNote && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Record Internal Note</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column (1 Col): Administrative Actions Desk */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#1557A6]" />
                <span>Review Desk Actions</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                {/* 1. START_REVIEW */}
                {opp?.status === OpportunityStatus.SUBMITTED && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.START_REVIEW)}
                    className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Begin Active Diligence</span>
                  </button>
                )}

                {/* 2. REQUEST_CHANGES */}
                {(opp?.status === OpportunityStatus.SUBMITTED ||
                  opp?.status === OpportunityStatus.UNDER_REVIEW) && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.REQUEST_CHANGES)}
                    className="w-full py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Request Changes from Seller</span>
                  </button>
                )}

                {/* 3. VERIFY */}
                {(opp?.status === OpportunityStatus.SUBMITTED ||
                  opp?.status === OpportunityStatus.UNDER_REVIEW) && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.VERIFY)}
                    className="w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verify Opportunity</span>
                  </button>
                )}

                {/* 4. PUBLISH */}
                {opp?.status === OpportunityStatus.VERIFIED && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.PUBLISH)}
                    className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Publish Live to Catalog</span>
                  </button>
                )}

                {/* 5. UNPUBLISH */}
                {opp?.status === OpportunityStatus.PUBLISHED && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.UNPUBLISH)}
                    className="w-full py-2.5 px-3 bg-slate-600 hover:bg-slate-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Unpublish Listing</span>
                  </button>
                )}

                {/* 6. REJECT */}
                {opp?.status !== OpportunityStatus.REJECTED &&
                  opp?.status !== OpportunityStatus.PUBLISHED && (
                    <button
                      disabled={acting}
                      onClick={() => handleActionClick(AdminOpportunityReviewAction.REJECT)}
                      className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject Listing</span>
                    </button>
                  )}

                {/* 7. SUSPEND */}
                {opp?.status === OpportunityStatus.PUBLISHED && (
                  <button
                    disabled={acting}
                    onClick={() => handleActionClick(AdminOpportunityReviewAction.SUSPEND)}
                    className="w-full py-2.5 px-3 bg-red-800 hover:bg-red-900 text-white font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Suspend Listing</span>
                  </button>
                )}
              </div>
            </div>

            {/* Opportunity Audit Timestamps */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 text-[11px]">
                Audit Metadata
              </h4>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Created:</span>
                  <span className="font-semibold text-slate-800">
                    {opp ? new Date(opp.createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Submitted:</span>
                  <span className="font-semibold text-slate-800">
                    {opp?.submittedAt ? new Date(opp.submittedAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Verified:</span>
                  <span className="font-semibold text-slate-800">
                    {opp?.verifiedAt ? new Date(opp.verifiedAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Published:</span>
                  <span className="font-semibold text-slate-800">
                    {opp?.publishedAt ? new Date(opp.publishedAt).toLocaleString() : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
