"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Building2,
  MapPin,
  TrendingUp,
  Tag,
  Lock,
  Eye,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  Users,
  AlertTriangle,
  FileText,
  DollarSign,
  Scale,
  Sparkles,
  Loader2,
  Send,
  X,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  Tier0Opportunity,
  Tier1Opportunity,
  Tier2Opportunity,
  Tier3Opportunity,
} from "@/types/opportunity";
import { BuyerEOIView } from "@/types/eoi";

export default function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = use(params);
  const { user } = useAuth();
  const [opp, setOpp] = useState<
    Tier0Opportunity | Tier1Opportunity | Tier2Opportunity | Tier3Opportunity | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EOI State
  const [existingEoi, setExistingEoi] = useState<BuyerEOIView | null>(null);
  const [eoiModalOpen, setEoiModalOpen] = useState(false);
  const [eoiSubmitting, setEoiSubmitting] = useState(false);
  const [eoiError, setEoiError] = useState<string | null>(null);
  const [eoiSuccess, setEoiSuccess] = useState<BuyerEOIView | null>(null);

  // Form inputs
  const [interestType, setInterestType] = useState("FULL_ACQUISITION");
  const [proposedTransactionType, setProposedTransactionType] = useState("Full 100% Acquisition");
  const [indicativeOfferRange, setIndicativeOfferRange] = useState("NEGOTIABLE");
  const [investmentTimeline, setInvestmentTimeline] = useState("1_TO_3_MONTHS");
  const [buyerMessage, setBuyerMessage] = useState("");

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/opportunities/${opportunityId}`);
        const json = await res.json();
        if (json.success) {
          setOpp(json.data.opportunity);
          if (json.data.opportunity?.transactionType) {
            setProposedTransactionType(json.data.opportunity.transactionType.replace(/_/g, " "));
          }
        } else {
          setError(json.error?.message || "Failed to load opportunity");
        }
      } catch {
        setError("Network failure while retrieving opportunity details.");
      } finally {
        setLoading(false);
      }
    }
    fetchDetail();
  }, [opportunityId]);

  // Check if buyer has existing active EOI
  useEffect(() => {
    if (!user) return;
    async function checkExistingEOI() {
      try {
        const res = await fetch(`/api/v1/buyer/eois?opportunityId=${opportunityId}`);
        const json = await res.json();
        if (json.success && json.data.items?.length > 0) {
          const active = json.data.items.find((e: BuyerEOIView) =>
            ["SUBMITTED", "UNDER_REVIEW", "CLARIFICATION_REQUESTED", "ACCEPTED"].includes(e.status)
          );
          if (active) {
            setExistingEoi(active);
          }
        }
      } catch {
        // Silent catch for initial check
      }
    }
    checkExistingEOI();
  }, [opportunityId, user]);

  const handleEoiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerMessage || buyerMessage.trim().length < 20) {
      setEoiError("Please provide an acquisition message of at least 20 characters.");
      return;
    }

    setEoiSubmitting(true);
    setEoiError(null);

    try {
      const res = await fetch(`/api/v1/opportunities/${opportunityId}/eoi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interestType,
          proposedTransactionType,
          indicativeOfferRange,
          investmentTimeline,
          buyerMessage: buyerMessage.trim(),
        }),
      });

      const json = await res.json();
      if (json.success) {
        setEoiSuccess(json.data);
        setExistingEoi(json.data);
      } else {
        setEoiError(json.error?.message || "Failed to submit Expression of Interest.");
      }
    } catch {
      setEoiError("Network failure while transmitting Expression of Interest.");
    } finally {
      setEoiSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-12 shadow-sm text-center space-y-4 max-w-md w-full">
          <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
          <p className="text-sm font-semibold text-slate-800">
            Retrieving Opportunity Teaser...
          </p>
          <p className="text-xs text-slate-500">
            Applying server-side progressive confidentiality policies
          </p>
        </div>
      </div>
    );
  }

  if (error || !opp) {
    return (
      <div className="flex-1 bg-[#F7F9FC] flex items-center justify-center p-12">
        <div className="bg-white rounded-xl border border-red-200 p-8 shadow-sm text-center space-y-4 max-w-md w-full">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">Opportunity Unavailable</h2>
          <p className="text-xs text-red-700 leading-relaxed">
            {error || "The requested business opportunity could not be found or is not yet published."}
          </p>
          <Link
            href="/opportunities"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-md shadow transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Catalog</span>
          </Link>
        </div>
      </div>
    );
  }

  const isTier1 = opp.tier >= 1;
  const isTier2 = opp.tier >= 2;
  const isTier3 = opp.tier >= 3;

  const t1 = isTier1 ? (opp as Tier1Opportunity) : null;
  const t2 = isTier2 ? (opp as Tier2Opportunity) : null;
  const t3 = isTier3 ? (opp as Tier3Opportunity) : null;

  return (
    <div className="flex-1 bg-[#F7F9FC] pb-16">
      {/* Top Header */}
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-10 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <Link
              href="/opportunities"
              className="inline-flex items-center gap-1.5 text-xs text-[#D9E2EC] hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Opportunities Catalog</span>
            </Link>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs bg-white/10 px-3 py-1 rounded border border-white/20 text-[#D9E2EC] font-bold">
                {opp.referenceCode}
              </span>
              <span
                className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded flex items-center gap-1.5 ${
                  isTier3
                    ? "bg-purple-500/20 text-purple-200 border border-purple-400/40"
                    : isTier1
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                    : "bg-amber-500/20 text-amber-200 border border-amber-400/40"
                }`}
              >
                {isTier3 ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Tier 3: Internal / Owner Unmasked Record</span>
                  </>
                ) : isTier1 ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Tier 1: Authenticated Buyer Access</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Tier 0: Public Blind Teaser</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {opp.title}
          </h1>

          {opp.headline && (
            <p className="text-sm text-[#D9E2EC] max-w-4xl leading-relaxed">
              {opp.headline}
            </p>
          )}

          {/* Quick Meta Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
            <span className="bg-white/10 text-white px-3 py-1 rounded-full border border-white/20">
              Sector: <strong>{opp.industry}</strong>
            </span>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full border border-white/20">
              Region: <strong>{opp.operatingRegion.replace(/_/g, " ")}</strong>
            </span>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full border border-white/20">
              Scale: <strong>{opp.revenueBracket.replace(/_/g, " ")}</strong>
            </span>
            <span className="bg-white/10 text-white px-3 py-1 rounded-full border border-white/20">
              Deal: <strong>{opp.transactionType.replace(/_/g, " ")}</strong>
            </span>
          </div>
        </div>
      </section>

      {/* Match Score Banner */}
      {isTier1 && t1 && t1.matchScore !== undefined && t1.matchScore !== null && (
        <div className="bg-[#102B4E] border-b border-[#153864] py-3 px-4 sm:px-6 lg:px-8 text-white">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#12B76A] flex items-center justify-center font-extrabold text-sm shadow">
                {t1.matchScore}%
              </div>
              <div>
                <div className="text-xs font-bold flex items-center gap-2">
                  <span>Mandate Match Compatibility</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/10 text-[#D9E2EC]">
                    {t1.matchClassification?.replace(/_/g, " ") || "CALCULATED"}
                  </span>
                </div>
                <p className="text-[11px] text-[#D9E2EC]">
                  Deterministic score computed against your active acquisition mandate.
                </p>
              </div>
            </div>
            <Link
              href="/buyer/matches"
              className="text-xs text-[#D9E2EC] hover:text-white underline font-semibold"
            >
              View Full Criteria Breakdown →
            </Link>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column (2 Cols): Business Overview & Narrative */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active EOI Banner if already submitted */}
            {existingEoi && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <h3 className="text-sm font-bold text-emerald-950">
                      Expression of Interest Active ({existingEoi.referenceCode})
                    </h3>
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                    {existingEoi.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  You submitted an Expression of Interest on {new Date(existingEoi.submittedAt).toLocaleDateString()}. Scale-up India is orchestrating bilateral interaction.
                </p>
                <div className="pt-2">
                  <Link
                    href="/buyer/eois"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 hover:text-emerald-950 underline"
                  >
                    <span>Track Status in EOI Portfolio →</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Teaser Narrative */}
            <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1557A6]" />
                <span>Executive Teaser Narrative</span>
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {opp.teaserSummary}
              </p>
            </div>

            {/* Detailed Description (Tier 1+) */}
            {isTier1 && t1?.detailedDescription && (
              <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-600" />
                  <span>Confidential Operational Overview (Tier 1)</span>
                </h2>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {t1.detailedDescription}
                </p>
              </div>
            )}

            {/* Confidentiality Notice */}
            <div className="bg-slate-50 rounded-xl border border-[#D9E2EC] p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Lock className="w-4 h-4 text-amber-600" />
                <span>Statutory Credentials Masked</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Legal entity name, Corporate Identification Number (CIN), GSTIN, PAN, exact street address, and audited accounts are safeguarded under Scale-up India&apos;s tripartite confidentiality architecture.
              </p>
            </div>
          </div>

          {/* Right Column (1 Col): Deal Parameters & EOI Action */}
          <div className="space-y-6">
            {/* Parameters Box */}
            <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Transaction Profile
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Business Category</span>
                  <span className="font-semibold text-slate-800 block">
                    {opp.businessCategory.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-500 text-[11px] block">Revenue Bracket</span>
                  <span className="font-semibold text-slate-800 block">
                    {opp.revenueBracket.replace(/_/g, " ")}
                  </span>
                </div>

                {isTier1 && t1?.askingPriceBracket && (
                  <div className="border-t border-slate-100 pt-3">
                    <span className="text-slate-500 text-[11px] block">Expected Valuation / Price</span>
                    <span className="font-bold text-sm text-slate-900 block">
                      {t1.askingPriceBracket.replace(/_/g, " ")}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-500 text-[11px] block">Deal Structure</span>
                  <span className="font-semibold text-slate-800 block">
                    {opp.transactionType.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-slate-500 text-[11px] block">Operating Region</span>
                  <span className="font-semibold text-slate-800 block">
                    {opp.operatingRegion.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>

            {/* Expression of Interest CTA Card */}
            <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Send className="w-4 h-4 text-[#1557A6]" />
                <span>Bilateral EOI Pathway</span>
              </div>

              <div className="space-y-2 text-xs text-slate-600 leading-relaxed">
                <p>
                  Submit a formal Expression of Interest to connect directly with the promoter through Scale-up India.
                </p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Non-Binding Bilateral Expression</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Safe Buyer Profile Shared With Promoter</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>24-Hour Promoter Review SLA</span>
                  </div>
                </div>
              </div>

              {existingEoi ? (
                existingEoi.status === "ACCEPTED" ? (
                  <Link
                    href="/buyer/ndas"
                    className="w-full py-2.5 bg-[#12B76A] hover:bg-[#0e9355] text-white text-xs font-bold rounded-md shadow-sm transition-colors text-center block"
                  >
                    EOI Accepted — Proceed to Bilateral NDA
                  </Link>
                ) : (
                  <Link
                    href="/buyer/eois"
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-md shadow-sm transition-colors text-center block"
                  >
                    View Active EOI ({existingEoi.referenceCode})
                  </Link>
                )
              ) : !user ? (
                <Link
                  href={`/login?redirect=/opportunities/${opportunityId}`}
                  className="w-full py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow-sm transition-colors text-center block"
                >
                  Sign In to Express Interest
                </Link>
              ) : (
                <button
                  onClick={() => {
                    setEoiModalOpen(true);
                    setEoiError(null);
                    setEoiSuccess(null);
                  }}
                  className="w-full py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Express Acquisition Interest</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* EOI Submission Modal */}
      {eoiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#0B1F3A] to-[#1557A6] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Express Acquisition Interest</h3>
                <p className="text-xs text-[#D9E2EC]">
                  Listing: <strong>{opp.referenceCode}</strong> — {opp.title}
                </p>
              </div>
              <button
                onClick={() => setEoiModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {eoiSuccess ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    Expression of Interest Transmitted
                  </h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs space-y-1 text-slate-600">
                    <div>Reference: <strong className="text-slate-900">{eoiSuccess.referenceCode}</strong></div>
                    <div>Status: <strong className="text-emerald-700">{eoiSuccess.status}</strong></div>
                    <div>Submitted: {new Date(eoiSuccess.submittedAt).toLocaleDateString()}</div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    The promoter has been notified via their secure inbox. You can track this transaction in your EOI Portfolio.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Link
                      href="/buyer/eois"
                      className="px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow hover:bg-[#104789]"
                    >
                      Go to EOI Portfolio
                    </Link>
                    <button
                      onClick={() => setEoiModalOpen(false)}
                      className="px-4 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEoiSubmit} className="space-y-4">
                  {/* Regulatory Disclaimer Banner */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-950">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      <span>Non-Binding Transaction Notice</span>
                    </div>
                    <p>
                      Submitting an Expression of Interest does not automatically reveal confidential seller information or create a binding acquisition agreement. It records bilateral commercial interest.
                    </p>
                  </div>

                  {eoiError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                      {eoiError}
                    </div>
                  )}

                  {/* Field: Interest Type */}
                  <div className="space-y-1">
                    <label className="font-semibold block text-slate-800">Interest Type</label>
                    <select
                      value={interestType}
                      onChange={(e) => setInterestType(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs font-medium focus:ring-2 focus:ring-[#1557A6]"
                    >
                      <option value="FULL_ACQUISITION">100% Full Acquisition</option>
                      <option value="MAJORITY_STAKE">Majority Stake (&gt; 51%)</option>
                      <option value="MINORITY_STAKE">Minority Growth Investment (&lt; 49%)</option>
                      <option value="STRATEGIC_INVESTMENT">Strategic Corporate Investment</option>
                      <option value="JOINT_VENTURE">Joint Venture / Strategic Partnership</option>
                      <option value="OTHER">Other Structured Transaction</option>
                    </select>
                  </div>

                  {/* Field: Proposed Transaction Type */}
                  <div className="space-y-1">
                    <label className="font-semibold block text-slate-800">Proposed Deal Structure</label>
                    <input
                      type="text"
                      value={proposedTransactionType}
                      onChange={(e) => setProposedTransactionType(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-[#1557A6]"
                      placeholder="e.g. 100% Buyout with promoter retention"
                      required
                    />
                  </div>

                  {/* Field: Indicative Range & Timeline */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold block text-slate-800">Indicative Valuation</label>
                      <select
                        value={indicativeOfferRange}
                        onChange={(e) => setIndicativeOfferRange(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-[#1557A6]"
                      >
                        <option value="NEGOTIABLE">Negotiable</option>
                        <option value="UNDER_10CR">Under ₹10 Cr</option>
                        <option value="10CR_TO_25CR">₹10 Cr – ₹25 Cr</option>
                        <option value="25CR_TO_50CR">₹25 Cr – ₹50 Cr</option>
                        <option value="50CR_TO_100CR">₹50 Cr – ₹100 Cr</option>
                        <option value="OVER_100CR">Over ₹100 Cr</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold block text-slate-800">Investment Horizon</label>
                      <select
                        value={investmentTimeline}
                        onChange={(e) => setInvestmentTimeline(e.target.value)}
                        className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-[#1557A6]"
                      >
                        <option value="IMMEDIATE_30_DAYS">Immediate (&lt; 30 Days)</option>
                        <option value="1_TO_3_MONTHS">1 to 3 Months</option>
                        <option value="3_TO_6_MONTHS">3 to 6 Months</option>
                        <option value="FLEXIBLE">Flexible</option>
                      </select>
                    </div>
                  </div>

                  {/* Field: Buyer Message */}
                  <div className="space-y-1">
                    <label className="font-semibold block text-slate-800">
                      Acquisition Rationale & Message (Min 20 characters)
                    </label>
                    <textarea
                      rows={4}
                      value={buyerMessage}
                      onChange={(e) => setBuyerMessage(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-xs focus:ring-2 focus:ring-[#1557A6]"
                      placeholder="Outline your acquisition rationale, relevant industry background, and proposed synergy..."
                      required
                    />
                    <span className="text-[10px] text-slate-400 block text-right">
                      {buyerMessage.length}/2000 characters
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setEoiModalOpen(false)}
                      className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={eoiSubmitting}
                      className="px-6 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                      {eoiSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Transmitting EOI</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
