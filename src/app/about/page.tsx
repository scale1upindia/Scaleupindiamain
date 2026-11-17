import Link from "next/link";
import { Building2, ShieldCheck, Target, Users, MapPin, Mail, Phone } from "lucide-react";

export const metadata = {
  title: "About Us — Scale-up India",
  description: "Scale-up India operates as a trusted business matchmaking and institutional deal facilitation platform.",
};

export default function AboutPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <Building2 className="w-4 h-4 text-[#F59E0B]" />
            <span>Institutional Background</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            About Scale-up India
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Bridging established Indian enterprises, growth capital, and institutional acquirers through trusted matchmaking and structured deal execution.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">Our Core Philosophy</h2>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Scale-up India was founded to address the critical gap in the Indian mid-market business ecosystem: the absence of a serious, confidential, and professional matchmaking platform for business promoters seeking exits, growth capital, or strategic partnerships.
          </p>
          <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            Unlike informal brokers or unverified listing directories, Scale-up India operates under institutional corporate principles. Every business promoter and acquirer undergoes verified onboarding, financial evaluation, and structured non-disclosure covenants before sensitive transaction data is exchanged.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-3">
            <ShieldCheck className="w-6 h-6 text-[#12B76A]" />
            <h3 className="text-sm font-bold text-slate-900">Confidentiality First</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              No business information is ever broadcast publicly. Identities are unlocked only through mutual consent and executed NDAs.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-3">
            <Target className="w-6 h-6 text-[#1557A6]" />
            <h3 className="text-sm font-bold text-slate-900">Deterministic Matchmaking</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Target sector taxonomy, geographic scope, ticket capacity, and governance preferences ensure high deal relevance.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#D9E2EC] p-6 shadow-sm space-y-3">
            <Users className="w-6 h-6 text-[#2878C8]" />
            <h3 className="text-sm font-bold text-slate-900">End-to-End Facilitation</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              From business profiling to due diligence room access, valuation support, and share transfer agreements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

