"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Search,
  Filter,
  Lock,
  Eye,
  Building2,
  MapPin,
  TrendingUp,
  Tag,
  ArrowRight,
  Layers,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  Tier0Opportunity,
  Tier1Opportunity,
  OperatingRegion,
  BusinessCategory,
  RevenueBracket,
  OpportunityTransactionType,
  BusinessModel,
  EbitdaMarginBracket,
} from "@/types/opportunity";

interface DiscoveryResponse {
  opportunities: (Tier0Opportunity | Tier1Opportunity)[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  appliedFilters: Record<string, string | null>;
  sorting: {
    sort: string;
  };
  viewerTier: number;
}

export default function OpportunitiesPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("");
  const [subSector, setSubSector] = useState("");
  const [businessCategory, setBusinessCategory] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [transactionType, setTransactionType] = useState<string>("");
  const [businessModel, setBusinessModel] = useState<string>("");
  const [revenueBracket, setRevenueBracket] = useState<string>("");
  const [ebitdaBracket, setEbitdaBracket] = useState<string>("");
  const [sort, setSort] = useState<string>("newest");
  const [page, setPage] = useState(1);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (industry.trim()) params.set("industry", industry.trim());
      if (subSector.trim()) params.set("subSector", subSector.trim());
      if (businessCategory) params.set("businessCategory", businessCategory);
      if (region) params.set("region", region);
      if (transactionType) params.set("transactionType", transactionType);
      if (businessModel) params.set("businessModel", businessModel);
      if (revenueBracket) params.set("revenueBracket", revenueBracket);
      if (ebitdaBracket) params.set("ebitdaBracket", ebitdaBracket);
      if (sort) params.set("sort", sort);
      params.set("page", page.toString());
      params.set("limit", "12");

      const res = await fetch(`/api/v1/opportunities?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error?.message || "Failed to load opportunities");
      }
    } catch {
      setError("An unexpected network error occurred while loading opportunities.");
    } finally {
      setLoading(false);
    }
  }, [
    search,
    industry,
    subSector,
    businessCategory,
    region,
    transactionType,
    businessModel,
    revenueBracket,
    ebitdaBracket,
    sort,
    page,
  ]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOpportunities();
  };

  const clearFilters = () => {
    setSearch("");
    setIndustry("");
    setSubSector("");
    setBusinessCategory("");
    setRegion("");
    setTransactionType("");
    setBusinessModel("");
    setRevenueBracket("");
    setEbitdaBracket("");
    setSort("newest");
    setPage(1);
  };

  const activeFiltersCount = [
    search,
    industry,
    subSector,
    businessCategory,
    region,
    transactionType,
    businessModel,
    revenueBracket,
    ebitdaBracket,
  ].filter(Boolean).length;

  return (
    <div className="flex-1 bg-[#F7F9FC]">
      {/* Header Banner */}
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
                <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
                <span>Verified Business Discovery Catalog</span>
                <span>•</span>
                <span>Progressive Confidentiality Enforced</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Curated Business Opportunities
              </h1>
              <p className="text-xs sm:text-sm text-[#D9E2EC] max-w-3xl leading-relaxed">
                Discover pre-screened acquisition targets, equity dilution rounds, and strategic joint venture proposals across India. Sensitive statutory identities and cap tables are protected behind non-disclosure gates.
              </p>
            </div>

            {/* Current Viewer Tier Badge */}
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-4 text-xs space-y-1.5 self-start sm:self-auto min-w-[220px]">
              <div className="text-[11px] text-[#D9E2EC] uppercase tracking-wider font-semibold">Your Disclosure Level</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#12B76A] animate-pulse" />
                <span className="font-bold text-white text-sm">
                  {user ? "Tier 1: Authenticated Buyer" : "Tier 0: Public Blind Teaser"}
                </span>
              </div>
              <p className="text-[10px] text-white/80">
                {user
                  ? "Full operational models, EBITDA & match scores unlocked."
                  : "Sign in to unlock operational models & match scores."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Search & Filter Form */}
        <form onSubmit={handleFilterSubmit} className="bg-white rounded-xl border border-[#D9E2EC] p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <Filter className="w-4 h-4 text-[#1557A6]" />
              <span>Multi-Factor Deal Search & Filters</span>
              {activeFiltersCount > 0 && (
                <span className="bg-[#1557A6] text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {activeFiltersCount} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="text-xs text-[#1557A6] hover:text-[#0B1F3A] hover:underline font-semibold"
              >
                {showAdvancedFilters ? "Hide Advanced Filters" : "Show All Filters"}
              </button>
              {activeFiltersCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-red-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
            </div>
          </div>

          {/* Primary Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search keywords, sector, teaser..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] focus:border-[#1557A6] bg-slate-50/50"
              />
            </div>

            {/* Industry Input */}
            <div className="lg:col-span-3">
              <input
                type="text"
                placeholder="Industry (e.g. Defense, Logistics)"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] focus:border-[#1557A6] bg-slate-50/50"
              />
            </div>

            {/* Category */}
            <div className="lg:col-span-3">
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] focus:border-[#1557A6] bg-slate-50/50"
              >
                <option value="">All Business Categories</option>
                {Object.values(BusinessCategory).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Region */}
            <div className="lg:col-span-2">
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] focus:border-[#1557A6] bg-slate-50/50"
              >
                <option value="">All Regions</option>
                {Object.values(OperatingRegion).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary / Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
              {/* Sub-Sector */}
              <div>
                <input
                  type="text"
                  placeholder="Sub-Sector (e.g. Avionics)"
                  value={subSector}
                  onChange={(e) => setSubSector(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50"
                />
              </div>

              {/* Transaction Type */}
              <div>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50"
                >
                  <option value="">All Deal Structures</option>
                  {Object.values(OpportunityTransactionType).map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* Business Model */}
              <div>
                <select
                  value={businessModel}
                  onChange={(e) => setBusinessModel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50"
                >
                  <option value="">All Business Models</option>
                  {Object.values(BusinessModel).map((bm) => (
                    <option key={bm} value={bm}>
                      {bm}
                    </option>
                  ))}
                </select>
              </div>

              {/* Revenue Bracket */}
              <div>
                <select
                  value={revenueBracket}
                  onChange={(e) => setRevenueBracket(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50"
                >
                  <option value="">Any Revenue Scale</option>
                  {Object.values(RevenueBracket).map((br) => (
                    <option key={br} value={br}>
                      {br.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              {/* EBITDA Bracket */}
              <div>
                <select
                  value={ebitdaBracket}
                  onChange={(e) => setEbitdaBracket(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50"
                >
                  <option value="">Any EBITDA Margin</option>
                  {["NEGATIVE", "0_TO_10_PCT", "10_TO_20_PCT", "20_TO_30_PCT", "OVER_30_PCT"].map((eb) => (
                    <option key={eb} value={eb}>
                      {eb.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Row & Sort Whitelist Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                Sort By:
              </span>
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1557A6] bg-slate-50/50 font-medium"
              >
                <option value="newest">Newest Listed First</option>
                <option value="oldest">Oldest Listed First</option>
                <option value="revenue_desc">Revenue Scale (High to Low)</option>
                <option value="revenue_asc">Revenue Scale (Low to High)</option>
                {user && <option value="match">★ Best Match Score (My Mandate)</option>}
              </select>
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow transition-colors flex items-center justify-center gap-2"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search Opportunities</span>
            </button>
          </div>
        </form>

        {/* Results View */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#1557A6] mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Querying verified opportunity vault...</p>
            <p className="text-xs text-slate-500">Applying server-side progressive confidentiality filters</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-red-800">{error}</p>
            <button
              onClick={() => fetchOpportunities()}
              className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-md shadow"
            >
              Try Again
            </button>
          </div>
        ) : !data || data.opportunities.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-16 text-center shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Opportunities Match Your Criteria</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              We could not find active published opportunities matching these exact parameters. Try widening your revenue scale or region filters.
            </p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-[#1557A6] text-white text-xs font-semibold rounded-md shadow"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-600 px-1">
              <div>
                Showing <strong className="text-slate-900">{data.opportunities.length}</strong> of{" "}
                <strong className="text-slate-900">{data.pagination.total}</strong> published deals
              </div>
              <div className="text-[11px] text-slate-500">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </div>
            </div>

            {/* Opportunities Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.opportunities.map((opp) => {
                const isTier1 = opp.tier >= 1;
                const tier1Opp = isTier1 ? (opp as Tier1Opportunity) : null;
                const hasMatchScore =
                  tier1Opp?.matchScore !== null &&
                  tier1Opp?.matchScore !== undefined;

                return (
                  <div
                    key={opp.id}
                    className="bg-white rounded-xl border border-[#D9E2EC] shadow-sm hover:shadow-md hover:border-[#1557A6]/40 transition-all flex flex-col justify-between overflow-hidden"
                  >
                    {/* Card Top Strip */}
                    <div className="p-5 space-y-4">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold border border-slate-200">
                          {opp.referenceCode}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Match Score Badge for Authenticated Buyers */}
                          {hasMatchScore && (
                            <span className="text-[10px] font-bold bg-[#12B76A]/10 text-[#0f766e] border border-[#12B76A]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-[#12B76A]" />
                              <span>{tier1Opp!.matchScore}% Match</span>
                            </span>
                          )}

                          {/* Tier Disclosure Indicator */}
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1 ${
                              isTier1
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            {isTier1 ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>Tier 1</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" />
                                <span>Tier 0</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-2">
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                          {opp.title}
                        </h3>
                        <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                          {opp.teaserSummary}
                        </p>
                      </div>

                      {/* Attributes Grid */}
                      <div className="bg-slate-50 rounded-lg p-3 space-y-2 border border-slate-100 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            Sector:
                          </span>
                          <span className="font-semibold text-slate-800 text-right">
                            {opp.industry}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            Region:
                          </span>
                          <span className="font-semibold text-slate-800 text-right">
                            {opp.operatingRegion.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                            Revenue Scale:
                          </span>
                          <span className="font-bold text-[#1557A6] text-right">
                            {opp.revenueBracket.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-[11px] flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            Deal Type:
                          </span>
                          <span className="font-semibold text-slate-800 text-right">
                            {opp.transactionType.replace(/_/g, " ")}
                          </span>
                        </div>

                        {/* Tier 1 Specific Fields */}
                        {isTier1 && tier1Opp && (
                          <>
                            <div className="border-t border-slate-200/60 pt-2 flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">Business Model:</span>
                              <span className="font-semibold text-emerald-700 text-right">
                                {tier1Opp.businessModel}
                              </span>
                            </div>
                            {tier1Opp.askingPriceBracket && (
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500 text-[11px]">Asking Price:</span>
                                <span className="font-bold text-slate-900 text-right">
                                  {tier1Opp.askingPriceBracket.replace(/_/g, " ")}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Card Footer CTA */}
                    <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <span>Identity Protected</span>
                      </div>
                      <Link
                        href={`/opportunities/${opp.id}`}
                        className="px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-md shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <span>View Opportunity</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-6">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>
                <span className="text-xs text-slate-600 px-3">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                </span>
                <button
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, data.pagination.totalPages))}
                  className="px-3 py-1.5 border border-slate-300 rounded-md bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 flex items-center gap-1 hover:bg-slate-50"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
