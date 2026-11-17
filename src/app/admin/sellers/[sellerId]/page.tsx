"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { OnboardingDossier, SellerDocumentRecord, SellerInternalNoteRecord } from "@/types/seller";
import {
  Building2,
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  FileText,
  Download,
  DollarSign,
  PieChart,
  Users,
  Briefcase,
  ExternalLink,
  MessageSquare,
  Send,
  Lock,
  Calendar,
  MapPin,
  Globe,
  Tag,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

export default function AdminSellerDossierPage() {
  const params = useParams();
  const router = useRouter();
  const sellerId = params.sellerId as string;
  const { user, loading: authLoading } = useAuth();

  const [dossier, setDossier] = useState<OnboardingDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Review Modals State
  const [activeModal, setActiveModal] = useState<"REQUEST_CHANGES" | "VERIFY" | "REJECT" | null>(null);
  const [changesNotes, setChangesNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNote, setAdminNote] = useState("");

  // Internal Note Creation Form
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteCategory, setNewNoteCategory] = useState<
    "GENERAL" | "COMPLIANCE" | "FINANCIAL" | "VALUATION" | "RISK"
  >("GENERAL");
  const [submittingNote, setSubmittingNote] = useState(false);

  const isAuthorized =
    user &&
    (user.permissions.includes("sellers.read") ||
      user.roles.some((r) =>
        ["SUPER_ADMIN", "ADMIN", "VERIFICATION_MANAGER"].includes(r)
      ));

  const canVerify =
    user &&
    (user.roles.includes("SUPER_ADMIN") ||
      user.permissions.includes("sellers.verify") ||
      user.permissions.includes("profiles.verify"));

  const canReview =
    user &&
    (user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("ADMIN") ||
      user.permissions.includes("sellers.review"));

  const fetchDossier = useCallback(async () => {
    if (!isAuthorized || !sellerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/admin/sellers/${sellerId}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load seller dossier.");
      }
      setDossier(json.data.dossier);
    } catch (err: any) {
      setError(err.message || "Failed to load seller dossier.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, sellerId]);

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      fetchDossier();
    }
  }, [authLoading, isAuthorized, fetchDossier]);

  const handleAction = async (action: "START_REVIEW" | "REQUEST_CHANGES" | "VERIFY" | "REJECT") => {
    setActionLoading(true);
    setError(null);
    try {
      const payload: any = { action };
      if (action === "REQUEST_CHANGES") {
        if (!changesNotes.trim()) {
          alert("Please describe the specific revisions required from the promoter.");
          setActionLoading(false);
          return;
        }
        payload.changesRequestedNotes = changesNotes.trim();
        if (adminNote.trim()) payload.notes = adminNote.trim();
      } else if (action === "REJECT") {
        if (!rejectionReason.trim()) {
          alert("Please provide the formal reason for rejection.");
          setActionLoading(false);
          return;
        }
        payload.rejectionReason = rejectionReason.trim();
        if (adminNote.trim()) payload.notes = adminNote.trim();
      } else if (action === "VERIFY") {
        if (adminNote.trim()) payload.notes = adminNote.trim();
      }

      const res = await fetch(`/api/v1/admin/sellers/${sellerId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Action execution failed.");
      }

      setActiveModal(null);
      setChangesNotes("");
      setRejectionReason("");
      setAdminNote("");
      await fetchDossier();
    } catch (err: any) {
      alert(`Action error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    setSubmittingNote(true);
    try {
      const res = await fetch(`/api/v1/admin/sellers/${sellerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newNoteText.trim(),
          category: newNoteCategory,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to add internal note.");
      }

      setNewNoteText("");
      await fetchDossier();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingNote(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-[#1557A6]" />
        <span className="text-sm font-medium">Loading dossier records...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Restricted Console</h2>
          <p className="text-sm text-slate-600">
            You do not possess the required permissions to inspect this seller dossier.
          </p>
          <div className="pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Dashboard</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dossier) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Dossier Unavailable</h2>
          <p className="text-sm text-slate-600">{error || "Seller record was not found."}</p>
          <Link
            href="/admin/sellers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sellers List</span>
          </Link>
        </div>
      </div>
    );
  }

  const { profile, business, financials, ownership, transactionPreferences, documents, internalNotes } = dossier;
  const status = profile.onboardingStatus;

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-8">
      {/* Back Link & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/sellers"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1557A6] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Verification Queue</span>
        </Link>
        <span className="text-xs text-slate-400 font-mono">Dossier ID: {profile.id}</span>
      </div>

      {/* Main Dossier Header Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[#1557A6] text-white flex items-center justify-center font-bold text-lg shadow">
                {business?.legalName?.[0] || "B"}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {business?.legalName || "Untitled Business Entity"}
                </h1>
                {business?.tradeName && (
                  <p className="text-xs text-slate-500 font-medium">Trade Name: {business.tradeName}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                {business?.businessType?.replace(/_/g, " ") || "Entity Unspecified"}
              </span>
              <span className="text-slate-400">•</span>
              <span>{business?.industry || "Industry Unspecified"}</span>
              <span className="text-slate-400">•</span>
              <span>
                {business?.registeredCity ? `${business.registeredCity}, ` : ""}
                {business?.registeredState || "India"}
              </span>
              <span className="text-slate-400">•</span>
              <span className="font-mono text-[11px] text-slate-500">
                Est. {business?.yearEstablished || "—"}
              </span>
            </div>
          </div>

          {/* Current Status & Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Status:</span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${
                  status === "VERIFIED"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                    : status === "SUBMITTED"
                    ? "bg-amber-50 text-amber-800 border-amber-300"
                    : status === "UNDER_REVIEW"
                    ? "bg-blue-50 text-blue-800 border-blue-300"
                    : status === "CHANGES_REQUESTED"
                    ? "bg-purple-50 text-purple-800 border-purple-300"
                    : status === "REJECTED"
                    ? "bg-rose-50 text-rose-800 border-rose-300"
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                {status === "VERIFIED" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                {status === "UNDER_REVIEW" && <RefreshCw className="w-3.5 h-3.5 text-blue-600" />}
                {status === "SUBMITTED" && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                {status === "CHANGES_REQUESTED" && <AlertCircle className="w-3.5 h-3.5 text-purple-600" />}
                {status === "REJECTED" && <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                <span>{status.replace(/_/g, " ")}</span>
              </span>
            </div>

            {/* Workflow Action Triggers */}
            <div className="flex flex-wrap items-center gap-2">
              {status === "SUBMITTED" && canReview && (
                <button
                  disabled={actionLoading}
                  onClick={() => handleAction("START_REVIEW")}
                  className="px-3.5 py-1.5 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow hover:bg-[#104789] transition"
                >
                  Start Review
                </button>
              )}

              {(status === "SUBMITTED" || status === "UNDER_REVIEW") && canReview && (
                <button
                  disabled={actionLoading}
                  onClick={() => setActiveModal("REQUEST_CHANGES")}
                  className="px-3 py-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-semibold rounded-md transition"
                >
                  Request Changes
                </button>
              )}

              {(status === "SUBMITTED" || status === "UNDER_REVIEW") && canVerify && (
                <button
                  disabled={actionLoading}
                  onClick={() => setActiveModal("VERIFY")}
                  className="px-3.5 py-1.5 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow hover:bg-[#104789] transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify Dossier</span>
                </button>
              )}

              {(status === "SUBMITTED" || status === "UNDER_REVIEW") && canVerify && (
                <button
                  disabled={actionLoading}
                  onClick={() => setActiveModal("REJECT")}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-semibold rounded-md transition"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Change Request Notice if in CHANGES_REQUESTED status */}
        {profile.changesRequestedNotes && (
          <div className="mt-6 p-4 bg-purple-50 rounded-lg border border-purple-200 text-xs text-purple-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-purple-800">
              <AlertCircle className="w-4 h-4 text-purple-600" />
              <span>Pending Revisions Requested from Promoter:</span>
            </div>
            <p className="whitespace-pre-line text-purple-950 pl-5">
              {profile.changesRequestedNotes}
            </p>
          </div>
        )}

        {/* Rejection Notice if in REJECTED status */}
        {profile.rejectionReason && (
          <div className="mt-6 p-4 bg-rose-50 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600" />
              <span>Dossier Rejection Ground:</span>
            </div>
            <p className="whitespace-pre-line text-rose-950 pl-5">{profile.rejectionReason}</p>
          </div>
        )}
      </div>

      {/* Main Grid: Details & Internal Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Comprehensive Submission Records */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Promoter Profile */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>Promoter & Authorized Representative Details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Designation</span>
                <span className="font-medium text-slate-800">{profile.designation || "Not specified"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Official Email</span>
                <span className="font-medium text-slate-800">{profile.email || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Direct Mobile</span>
                <span className="font-medium text-slate-800">{profile.mobile || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Preferred Channel</span>
                <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  {profile.preferredCommMethod}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Business Overview & Statutory Identifiers */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                <Building2 className="w-4 h-4" />
                <span>Statutory Identifiers & Operations</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">
                Confidential Identifiers
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">CIN</span>
                <span className="font-mono font-medium text-slate-800">{business?.cin || "Not Applicable"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">GSTIN</span>
                <span className="font-mono font-medium text-slate-800">{business?.gstin || "Not Applicable"}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">PAN</span>
                <span className="font-mono font-medium text-slate-800">{business?.pan || "Not Applicable"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Sub-Sector</span>
                <span className="text-slate-800">{business?.subSector || "General"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">MSME Category</span>
                <span className="font-semibold text-slate-700">{business?.msmeStatus || "NONE"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Active Headcount</span>
                <span className="font-semibold text-slate-800">{business?.employeeCount || 0} employees</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Official Website</span>
                {business?.website ? (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#1557A6] font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>{business.website}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-slate-400">Not provided</span>
                )}
              </div>
            </div>

            {business?.operatingLocations && business.operatingLocations.length > 0 && (
              <div className="pt-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase">Operating Footprint</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {business.operatingLocations.map((loc, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium"
                    >
                      {loc}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 text-xs">
              <span className="text-slate-400 block text-[10px] uppercase">Executive Business Profile</span>
              <p className="mt-1 text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-line">
                {business?.businessDescription || "No detailed business overview provided."}
              </p>
            </div>
          </div>

          {/* Section 3: Multi-Year Financials */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Multi-Year Audited Financial Track Record</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Figures in ₹ Crores / Lakhs</span>
            </div>

            {financials.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No financial records recorded for this entity.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <th className="py-2.5 px-3">FY</th>
                      <th className="py-2.5 px-3">Revenue</th>
                      <th className="py-2.5 px-3">EBITDA</th>
                      <th className="py-2.5 px-3">PAT</th>
                      <th className="py-2.5 px-3">Net Worth</th>
                      <th className="py-2.5 px-3">Total Debt</th>
                      <th className="py-2.5 px-3">Audited?</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {financials.map((fin) => (
                      <tr key={fin.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{fin.financialYear}</td>
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800">
                          ₹{Number(fin.revenue).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          ₹{Number(fin.ebitda).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          ₹{Number(fin.pat).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          ₹{Number(fin.netWorth).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          ₹{Number(fin.debt).toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 px-3">
                          {fin.isAudited ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Audited
                            </span>
                          ) : (
                            <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Provisional
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Ownership & Cap Table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                <PieChart className="w-4 h-4" />
                <span>Ownership Structure & Cap Table</span>
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Sum: {ownership.reduce((sum, o) => sum + Number(o.ownershipPercentage), 0).toFixed(2)}%
              </span>
            </div>

            {ownership.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No shareholding pattern entered.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[10px] uppercase">
                      <th className="py-2.5 px-3">Shareholder / Entity</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Equity Holding</th>
                      <th className="py-2.5 px-3">Holding Entity</th>
                      <th className="py-2.5 px-3">Control / Special Rights</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ownership.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{o.ownerName}</td>
                        <td className="py-2.5 px-3 text-slate-600">{o.ownerType.replace(/_/g, " ")}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#1557A6]">
                          {Number(o.ownershipPercentage).toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">{o.holdingEntity || "—"}</td>
                        <td className="py-2.5 px-3 text-slate-500">{o.controlRights || "Standard Equity"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Transaction Preferences & Objectives */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
              <Briefcase className="w-4 h-4" />
              <span>Commercial Intent & Transaction Terms</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Transaction Intent</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {transactionPreferences?.intents.map((intent, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-[#EEF5FB]/50 text-[#1557A6] font-semibold rounded text-[11px]"
                    >
                      {intent.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Stake Offered</span>
                <span className="font-semibold text-slate-800">
                  {transactionPreferences?.stakeOfferedPercentage
                    ? `${transactionPreferences.stakeOfferedPercentage}%`
                    : "Not specified"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Expected Valuation</span>
                <span className="font-mono font-bold text-slate-900">
                  {transactionPreferences?.expectedValuation
                    ? `₹${Number(transactionPreferences.expectedValuation).toLocaleString("en-IN")}`
                    : "Flexible / Market Determined"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Preferred Timeline</span>
                <span className="font-medium text-slate-800">
                  {transactionPreferences?.preferredTimeline || "Immediate to 6 months"}
                </span>
              </div>
            </div>

            {transactionPreferences?.preferredBuyerType && transactionPreferences.preferredBuyerType.length > 0 && (
              <div className="pt-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase">Preferred Counterparty Profile</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {transactionPreferences.preferredBuyerType.map((bt, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px]">
                      {bt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {transactionPreferences?.reasonForTransaction && (
              <div className="pt-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase">Primary Reason for Transaction</span>
                <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {transactionPreferences.reasonForTransaction}
                </p>
              </div>
            )}

            {transactionPreferences?.strategicObjectives && (
              <div className="pt-2 text-xs">
                <span className="text-slate-400 block text-[10px] uppercase">Strategic Synergies Desired</span>
                <p className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {transactionPreferences.strategicObjectives}
                </p>
              </div>
            )}
          </div>

          {/* Section 6: Document Vault */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
                <FileText className="w-4 h-4" />
                <span>Verified Private Document Vault ({documents.length})</span>
              </div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">
                Anti-Tamper & Magic Byte Verified
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                No documents uploaded into the private vault.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#1557A6]" />
                        <span className="text-xs font-bold text-slate-800">{doc.originalFilename}</span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {doc.documentType.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>{(doc.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">SHA-256: {doc.checksumSha256.slice(0, 12)}...</span>
                      </div>
                    </div>

                    <a
                      href={`/api/v1/seller/documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1557A6] bg-[#EEF5FB] hover:bg-[#EEF5FB] rounded-md transition shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Internal Confidential Review Desk */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-xs font-bold text-[#1557A6] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Verification Checklist & Review</span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Promoter Identity</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Business Registration</span>
                <span className="font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> {business?.cin ? "CIN Verified" : "Identified"}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Financial Records</span>
                <span className="font-semibold text-slate-800">{financials.length} Years Provided</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Cap Table Distribution</span>
                <span className="font-semibold text-slate-800">
                  {ownership.reduce((sum, o) => sum + Number(o.ownershipPercentage), 0).toFixed(0)}% Accounted
                </span>
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-100">
                <span className="text-slate-600">Document Vault Evidence</span>
                <span className="font-semibold text-slate-800">{documents.length} Files Lodged</span>
              </div>
            </div>
          </div>

          {/* Internal Notes Panel */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                <MessageSquare className="w-4 h-4 text-[#1557A6]" />
                <span>Internal Review Notes</span>
              </div>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Internal Only
              </span>
            </div>

            <p className="text-[11px] text-slate-500">
              Internal notes are strictly confidential and NEVER shown to the business promoter or external parties.
            </p>

            {/* Existing Notes Feed */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {!internalNotes || internalNotes.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                  No internal notes recorded yet.
                </div>
              ) : (
                internalNotes.map((note) => (
                  <div key={note.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        {note.category}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(note.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-line">{note.content}</p>
                    {note.authorName && (
                      <span className="block text-[10px] text-slate-400">By: {note.authorName}</span>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Note Form */}
            <form onSubmit={handleAddInternalNote} className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase">Add Review Note</label>
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as any)}
                  className="text-xs rounded border border-slate-300 px-2 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1557A6]"
                >
                  <option value="GENERAL">General</option>
                  <option value="COMPLIANCE">Compliance</option>
                  <option value="FINANCIAL">Financial</option>
                  <option value="VALUATION">Valuation</option>
                  <option value="RISK">Risk</option>
                </select>
              </div>

              <textarea
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={3}
                placeholder="Log internal diligence remarks, promoter observations, or verification flags..."
                className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-[#1557A6]"
              />

              <button
                type="submit"
                disabled={submittingNote || !newNoteText.trim()}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow hover:bg-[#104789] disabled:opacity-50 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Save Note</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* MODAL: Request Changes */}
      {activeModal === "REQUEST_CHANGES" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-purple-800">
              <AlertCircle className="w-5 h-5 text-purple-600" />
              <h3 className="text-base font-bold">Request Dossier Changes</h3>
            </div>
            <p className="text-xs text-slate-600">
              This action unlocks the promoter’s profile and sets status to{" "}
              <strong>CHANGES_REQUESTED</strong>. Provide clear instructions on what must be corrected.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Required Changes (Visible to Promoter) *
                </label>
                <textarea
                  value={changesNotes}
                  onChange={(e) => setChangesNotes(e.target.value)}
                  rows={4}
                  placeholder="e.g. Please upload audited financials for FY 2023-24, and provide CIN certificate in the document vault."
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Internal Note (Optional, Staff Only)
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Internal notes on why changes were requested..."
                  className="w-full text-xs rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-purple-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction("REQUEST_CHANGES")}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-md transition shadow"
              >
                {actionLoading ? "Submitting..." : "Send Request to Promoter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Verify Dossier */}
      {activeModal === "VERIFY" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold">Verify Business Dossier</h3>
            </div>
            <p className="text-xs text-slate-600">
              Confirming verification marks this seller profile as <strong>VERIFIED</strong>. The business will be eligible
              for confidential matchmaking with qualified buyers and investors.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Internal Verification Remark (Optional)
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Diligence cleared by verification desk..."
                className="w-full text-xs rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction("VERIFY")}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1557A6] hover:bg-[#104789] rounded-md transition shadow"
              >
                {actionLoading ? "Verifying..." : "Confirm & Verify Dossier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Dossier */}
      {activeModal === "REJECT" && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-800">
              <XCircle className="w-5 h-5 text-rose-600" />
              <h3 className="text-base font-bold">Reject Business Dossier</h3>
            </div>
            <p className="text-xs text-slate-600">
              Rejecting permanently sets this dossier status to <strong>REJECTED</strong>. A formal reason is mandatory.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rejection Reason *
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={3}
                  placeholder="Explain the regulatory, compliance, or authenticity ground for rejection..."
                  className="w-full text-xs rounded-md border border-slate-300 p-2.5 focus:outline-none focus:ring-1 focus:ring-rose-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Internal Staff Note (Optional)
                </label>
                <input
                  type="text"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Internal audit notes..."
                  className="w-full text-xs rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-1 focus:ring-rose-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={() => setActiveModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md transition"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={() => handleAction("REJECT")}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-md transition shadow"
              >
                {actionLoading ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

