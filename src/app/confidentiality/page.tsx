import { ShieldCheck, Lock, EyeOff, FileText, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Confidentiality Charter & NDA — Scale-up India",
  description: "Platform confidentiality standards, progressive data masking, and Non-Disclosure Agreements.",
};

export default function ConfidentialityPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span>Confidentiality Charter</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Confidentiality Charter & NDA Policy
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Protecting proprietary enterprise information, commercial trade secrets, and promoter identities is the foundation of Scale-up India.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">1. Tripartite Non-Disclosure Obligation</h2>
          <p>
            All participants on Scale-up India (Business Promoters, Buyers, Investors, and Platform Advisors) operate under legally binding non-disclosure covenants governed by the Indian Contract Act, 1872. No business information is ever broadcast publicly or indexed on open search engines.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">2. Progressive Data Masking (Tier 0 to Tier 2)</h2>
          <p>
            Information is disclosed strictly on a need-to-know, consent-driven basis:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Tier 0 (Pre-NDA Teaser):</strong> High-level sector, revenue band, and strategic intent. All company identifiers, promoter names, exact addresses, and cap tables are masked.</li>
            <li><strong>Tier 1 (Post-Expression of Interest):</strong> Shared only after the promoter explicitly consents to the acquirer&apos;s verified credentials.</li>
            <li><strong>Tier 2 (Post-Executed NDA):</strong> Full statutory audit reports, valuation models, customer concentration metrics, and virtual due diligence rooms.</li>
          </ul>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">3. Document Vault & Cryptographic Integrity</h2>
          <p>
            All uploaded corporate dossiers, tax audits, and proof of funds are stored in private vaults protected by binary magic-byte inspection, SHA-256 checksums, and strict server-side Anti-IDOR authorization barriers. Direct URL downloads are forbidden.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">4. Non-Circumvention</h2>
          <p>
            Parties entering into discussions via Scale-up India agree to strict non-circumvention terms prohibiting direct bilateral transactions that bypass platform advisory facilitation without mutual consent.
          </p>
        </div>
      </div>
    </div>
  );
}

