import { FileText, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Terms of Use — Scale-up India",
  description: "Terms governing platform participation, verification criteria, and commercial matchmaking obligations.",
};

export default function TermsPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <FileText className="w-4 h-4 text-[#F59E0B]" />
            <span>Platform Terms</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms of Use
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Legal terms governing participation in Scale-up India&apos;s business matchmaking and transaction ecosystem.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">1. Eligibility & Representation</h2>
          <p>
            Participation is restricted to commercial enterprises, business promoters, accredited institutional investors, corporate buyers, family offices, and certified strategic partners. Users warrant that all corporate records, turnover metrics, and cap table allocations submitted are accurate and legally verified.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">2. Verification Rights</h2>
          <p>
            Scale-up India reserves the statutory right to verify corporate identities, examine proof of funds, inspect incorporation credentials, and refuse, suspend, or request revisions to any onboarding dossier that fails compliance standards.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">3. Non-Circumvention & Platform Exclusivity</h2>
          <p>
            Once introduced through the Scale-up India platform, parties agree to conduct subsequent due diligence, MOU signing, and transaction closure under the tripartite facilitation framework established by the platform.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">4. Limitation of Liability</h2>
          <p>
            Scale-up India acts as a facilitator and deal room provider. Commercial decisions, valuations, and contract executions are made solely between the transacting principals. Independent legal and financial advisory is required.
          </p>
        </div>
      </div>
    </div>
  );
}

