"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  MatchClassification,
  BuyerMatchItem,
} from "@/types/matching";

export default function BuyerMatchesPage() {
  const [matches, setMatches] = useState<BuyerMatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedClassification, setSelectedClassification] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchMatches = useCallback(
    async (targetPage = 1, classification = selectedClassification) => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          page: targetPage.toString(),
          limit: "10",
        });

        if (classification !== "ALL") {
          params.append("classification", classification);
        }

        const res = await fetch(`/api/v1/buyer/matches?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to load matches");
        }

        setMatches(data.data.items || []);
        setTotal(data.data.total || 0);
        setTotalPages(data.data.totalPages || 1);
        setPage(data.data.page || 1);
      } catch (err: any) {
        setError(err.message || "Failed to load match listings");
      } finally {
        setLoading(false);
      }
    },
    [selectedClassification]
  );

  useEffect(() => {
    fetchMatches(1, selectedClassification);
  }, [fetchMatches, selectedClassification]);

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/v1/buyer/matches/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to refresh matches");
      }
      await fetchMatches(1, selectedClassification);
    } catch (err: any) {
      alert(err.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const getScoreBadgeClass = (score: number) => {
    if (score >= 90) return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (score >= 75) return "bg-blue-50 text-blue-700 border-blue-200";
    if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  const getClassificationLabel = (cls: string) => {
    switch (cls) {
      case "EXCELLENT_MATCH":
        return "Excellent Match (90-100%)";
      case "STRONG_MATCH":
        return "Strong Match (75-89%)";
      case "POTENTIAL_MATCH":
        return "Potential Match (60-74%)";
      case "WEAK_MATCH":
        return "Weak Match (40-59%)";
      default:
        return "Poor Match";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                Phase 5 Deterministic Engine
              </span>
              <span className="text-xs text-slate-500 font-mono">v1.0.0-deterministic</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Curated Strategic Acquisition Matches
            </h1>
            <p className="mt-1 text-sm text-slate-500 max-w-3xl">
              Deterministic, explainable business matching computed against your verified acquisition mandates.
              Zero AI hallucinations. Every score is mathematically auditable.
            </p>
          </div>

          <div className="mt-4 md:mt-0 flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-slate-700" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Recalculating...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Recalculate Matches
                </>
              )}
            </button>
            <Link
              href="/onboarding/buyer"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Manage Mandates
            </Link>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {["ALL", "EXCELLENT_MATCH", "STRONG_MATCH", "POTENTIAL_MATCH"].map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClassification(cls)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  selectedClassification === cls
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cls.replace("_", " ")}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Found <span className="font-bold text-slate-800">{total}</span> eligible matching opportunities
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-md bg-rose-50 border border-rose-200 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Match List */}
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <svg className="animate-spin mx-auto h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Loading algorithmic matches...
          </div>
        ) : matches.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-3 text-base font-semibold text-slate-900">No matches found</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
              We couldn&apos;t find any published opportunities matching your active mandate criteria at this time.
            </p>
            <div className="mt-6">
              <button
                onClick={handleRefresh}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Trigger Fresh Search
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {matches.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col md:flex-row gap-6 justify-between items-start"
              >
                <div className="space-y-3 flex-1">
                  {/* Top line with score and badges */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-bold border ${getScoreBadgeClass(
                        item.score
                      )}`}
                    >
                      {item.score}% Match Score
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {getClassificationLabel(item.classification)}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      Ref: {item.opportunity.referenceCode}
                    </span>
                    <span className="text-xs text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded">
                      Mandate: {item.mandateName}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 hover:text-indigo-600 transition-colors">
                      <Link href={`/opportunities/${item.opportunityId}`}>
                        {item.opportunity.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                      {item.opportunity.teaserSummary}
                    </p>
                  </div>

                  {/* Operational Tags */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                      Sector: {item.opportunity.industry}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                      Region: {item.opportunity.operatingRegion.replace("_", " ")}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                      Turnover: {item.opportunity.revenueBracket.replace("_", " ")}
                    </span>
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                      Structure: {item.opportunity.transactionType.replace("_", " ")}
                    </span>
                  </div>

                  {/* Algorithmic Explanation Reasons */}
                  <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Algorithmic Match Insights:
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                      {item.reasons.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right CTA */}
                <div className="flex md:flex-col gap-3 w-full md:w-auto shrink-0 self-stretch md:self-center justify-between border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  <div className="hidden md:block text-center mb-2">
                    <div className="text-2xl font-black text-slate-900">{item.score}</div>
                    <div className="text-[10px] uppercase font-bold text-slate-400">Compatibility</div>
                  </div>
                  <Link
                    href={`/opportunities/${item.opportunityId}`}
                    className="w-full text-center inline-flex justify-center items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                  >
                    View Teaser
                  </Link>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 rounded-lg">
                <button
                  onClick={() => fetchMatches(page - 1)}
                  disabled={page <= 1}
                  className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => fetchMatches(page + 1)}
                  disabled={page >= totalPages}
                  className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
