import { AlertTriangle, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Regulatory Disclaimer — Scale-up India",
  description: "Platform regulatory status, non-depository, and transaction advisory clarification.",
};

export default function DisclaimerPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span>Platform Status Notice</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Regulatory & Platform Disclaimer
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Statutory disclosure regarding the scope of services provided by Scale-up India.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Statutory Scope & Legal Structure</h2>
          <p>
            Scale-up India is an institutional matchmaking, deal facilitation, and transaction workflow platform. Scale-up India is operated under corporate advisory principles.
          </p>
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200/80 text-amber-900 space-y-2">
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-800">Clear Regulatory Demarcation</h3>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Scale-up India is <strong>NOT</strong> an RBI-registered Non-Banking Financial Company (NBFC) and does not accept public deposits or extend retail loans.</li>
              <li>Scale-up India is <strong>NOT</strong> a SEBI-registered stock broker, investment advisor, or public stock exchange.</li>
              <li>The platform does <strong>NOT</strong> provide public investment recommendations, retail securities offerings, or mass capital pooling.</li>
            </ul>
          </div>
          <p>
            All business sales, equity dilutions, asset transfers, joint ventures, and investment transactions facilitated through the platform are conducted strictly as private, bilateral commercial transactions between consenting commercial principals with professional corporate advisory facilitation.
          </p>
          <p>
            Users are advised to conduct independent due diligence, financial audits, and legal counsel prior to executing any binding transaction agreements or releasing token considerations.
          </p>
        </div>
      </div>
    </div>
  );
}

