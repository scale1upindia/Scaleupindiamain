import Link from "next/link";
import { ShieldCheck, FileSpreadsheet, Calculator, FileCheck2, Scale, ArrowRight } from "lucide-react";

export const metadata = {
  title: "Professional Services & Deal Room — Scale-up India",
  description: "End-to-end deal structuring, 12-category due diligence room, and IBBI valuation advisory.",
};

export default function ServicesPage() {
  const services = [
    {
      icon: FileSpreadsheet,
      title: "12-Category Due Diligence Room",
      desc: "Structured virtual deal rooms covering corporate legal records, statutory compliance, tax audits, banking relationships, litigation history, and intellectual property.",
    },
    {
      icon: Calculator,
      title: "Valuation Advisory (IBBI / DCF)",
      desc: "Objective valuation frameworks utilizing Discounted Cash Flow (DCF), Comparable Company Analysis (CCA), and Net Asset Value (NAV) methods prepared by registered valuers.",
    },
    {
      icon: FileCheck2,
      title: "Tripartite MOU & Token Architecture",
      desc: "Standardized tripartite legal structures establishing mutual deal certainty, token considerations, and time-bound exclusivity milestones.",
    },
    {
      icon: Scale,
      title: "Share Transfer Agreement (STA) Facilitation",
      desc: "Comprehensive transaction documentation including representation & warranties, indemnity structures, escrow conditions, and post-closing covenants.",
    },
  ];

  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span>Institutional Deal Advisory</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Deal Execution & Advisory Services
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            From initial business profiling to final share transfer closure, Scale-up India provides institutional transaction support.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {services.map((s, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-3">
              <div className="w-10 h-10 rounded-lg bg-[#EEF5FB] text-[#1557A6] flex items-center justify-center">
                <s.icon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-900">{s.title}</h2>
              <p className="text-xs text-slate-600 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Ready to initiate a transaction?</h2>
          <p className="text-xs text-slate-600 max-w-lg mx-auto">
            Submit your profile as a business promoter or registered acquirer to begin confidential transaction facilitation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="px-6 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              Register on Platform
            </Link>
            <Link
              href="/how-it-works"
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors border border-slate-200"
            >
              Read Process Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

