import Link from "next/link";
import {
  UserCheck,
  FileSearch,
  Send,
  FileSignature,
  Coins,
  SearchCheck,
  Scale,
  Handshake,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

export default function HowItWorksPage() {
  const steps = [
    {
      step: "01",
      title: "Buyer & Seller Registration",
      icon: UserCheck,
      desc: "Buyers/Investors define industry preferences, investment capacity, and strategic objectives. Sellers/Promoters register company details, turnover, and intent (100% buyout, equity dilution, or asset sale).",
      highlight: "Dual-registration ensures accurate matching based on strategic fit.",
    },
    {
      step: "02",
      title: "Curated Confidential Listings",
      icon: FileSearch,
      desc: "Our matching engine displays relevant, pre-qualified opportunities. Identifying details remain masked until bilateral consent to protect commercial confidentiality.",
      highlight: "No open classifieds; opportunities are curated and verified.",
    },
    {
      step: "03",
      title: "Expression of Interest & 24h Response",
      icon: Send,
      desc: "When an acquirer expresses interest, the seller is alerted immediately. Sellers are expected to respond within 24 hours. Overdue responses trigger dedicated Scale-up India RM intervention.",
      highlight: "Guaranteed deal momentum without leaving acquirers waiting.",
    },
    {
      step: "04",
      title: "Tripartite MOU & Token Payment",
      icon: FileSignature,
      desc: "Upon mutual consent, a formal Tripartite MOU is executed between Buyer, Seller, and Scale-up India. A token fee (baseline ₹5,000) is deposited by both parties to formalize intent.",
      highlight: "Tripartite legal structure locks exclusivity and defines fee covenants.",
    },
    {
      step: "05",
      title: "Due Diligence & Independent Valuation",
      icon: SearchCheck,
      desc: "Initiated within 48 working hours of MOU execution. Buyers can leverage Scale-up India's 12-category DD checklist or engage external professionals. Optional IBBI-compliant business valuation.",
      highlight: "Full visibility into financial, corporate, tax, and legal health.",
    },
    {
      step: "06",
      title: "Share Transfer Agreement (STA)",
      icon: Scale,
      desc: "Upon satisfactory DD findings, a formal Share Transfer Agreement (STA) or Asset Purchase Agreement is drafted and executed with legal facilitation.",
      highlight: "Binding commercial transfer contracts reviewed by corporate legal counsel.",
    },
    {
      step: "07",
      title: "Custodianship & Fund Security",
      icon: Coins,
      desc: "Scale-up India acts as neutral custodian during financial settlement. Consideration funds are deposited into designated client accounts and only released upon confirmed statutory share transfer.",
      highlight: "Protects against default; consideration returned if seller fails covenants.",
    },
    {
      step: "08",
      title: "Statutory Filings & Deal Closure",
      icon: CheckCircle2,
      desc: "Execution of MCA filings (SH-4, DIR-12, board resolutions). Once statutory compliance is verified, consideration is disbursed to the seller net of facilitation fees.",
      highlight: "Formal transaction closure with complete compliance dossiers.",
    },
    {
      step: "09",
      title: "Post-Acquisition Advisory",
      icon: Handshake,
      desc: "Our involvement extends past closure to ensure cultural alignment, management transition, and sustained operational growth.",
      highlight: "Ensuring business legacies thrive under new ownership.",
    },
  ];

  return (
    <div className="flex-1 bg-[#F7F9FC] py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-block text-xs font-bold uppercase tracking-wider text-[#1557A6] bg-[#EEF5FB] border border-[#D9E2EC] px-3.5 py-1 rounded-full">
            Structured Transaction Process
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold text-[#0B1F3A]">
            How Scale-up India Operates
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
            A secure, transparent, and legally protected business matchmaking journey designed by Ideal Corporate Synergy LLP.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="space-y-6">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-[#D9E2EC] flex flex-col md:flex-row items-start gap-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-lg shadow-md">
                    {s.step}
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-[#EEF5FB] text-[#1557A6] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-2 flex-1">
                  <h3 className="text-base font-bold text-slate-900">{s.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
                  <div className="pt-2 text-[11px] font-semibold text-[#1557A6] flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A]" />
                    <span>{s.highlight}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white p-8 sm:p-10 rounded-2xl text-center space-y-4 shadow-lg border border-[#153864]">
          <h2 className="text-2xl font-bold">Ready to Begin Your Deal Journey?</h2>
          <p className="text-xs text-[#D9E2EC] max-w-xl mx-auto">
            Whether you are looking to sell, raise capital, or acquire established enterprises, our team is ready to guide your transaction.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-[#F59E0B] hover:bg-[#D97706] text-white text-xs font-bold rounded-md shadow transition-colors flex items-center gap-2"
            >
              <span>Start Onboarding</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/opportunities"
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md transition-colors"
            >
              Browse Opportunities
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

