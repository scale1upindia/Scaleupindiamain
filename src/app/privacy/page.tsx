import { ShieldCheck, Lock } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Scale-up India",
  description: "Data privacy practices, information security standards, and statutory compliance under Indian IT laws.",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span>Data Protection</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Statutory disclosure regarding the collection, processing, encryption, and confidentiality of enterprise and promoter records.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">1. Scope & Legislative Compliance</h2>
          <p>
            Scale-up India complies with the Information Technology Act, 2000, the IT (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act (DPDP), 2023.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">2. Information Collected</h2>
          <p>
            We collect organizational identification (incorporation number, entity type, registered address), authorized representative credentials, audited financial profiles, cap tables, acquisition mandates, and verification documents strictly for transaction matchmaking and due diligence.
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">3. Use of Information & No Public Directory Guarantee</h2>
          <p>
            Under no circumstances is confidential business information sold, traded, or indexed as a public web directory. All business profiles remain masked (Tier 0) until explicit promoter consent and bilateral NDA execution unlock identity access (Tier 2).
          </p>

          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">4. Security Safeguards & Audit Logging</h2>
          <p>
            The platform employs salted bcrypt password hashing, cryptographic session tokens, SHA-256 binary checksums for document vaults, and an append-only immutable audit log recording all access attempts, reviews, and state transitions.
          </p>
        </div>
      </div>
    </div>
  );
}

