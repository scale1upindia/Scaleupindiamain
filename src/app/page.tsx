import Link from "next/link";
import {
  ShieldCheck,
  TrendingUp,
  Briefcase,
  Users,
  Handshake,
  ArrowRight,
  Lock,
  FileCheck2,
  Building2,
  CheckCircle2,
  Sparkles,
  Scale,
  FileText,
  BadgeCheck,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex-1 flex flex-col bg-[#F7F9FC]">
      {/* =========================================================================
          1. HERO SECTION (Deep Navy + Blue Gradient + Controlled Orange Accent)
          ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        {/* Subtle Geometric / Tech Ambient Glows */}
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#2878C8] blur-3xl" />
          <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-[#1557A6] blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto text-center space-y-8">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-4 py-1.5 rounded-full text-xs text-[#EEF5FB] shadow-subtle">
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
            <span className="font-bold tracking-wider uppercase text-[11px] text-[#FDBA3B]">
              Built for the Next Generation of Business
            </span>
            <span className="text-white/40">•</span>
            <span className="text-white/90 font-medium">Ideal Corporate Synergy LLP</span>
          </div>

          {/* Cinematic Headline & Subtitle */}
          <div className="max-w-4xl mx-auto space-y-5">
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
              Where Businesses, Capital &amp;{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#EEF5FB] to-[#FDBA3B]">
                Strategic Partnerships
              </span>{" "}
              Meet.
            </h1>
            <p className="text-base sm:text-lg text-[#D9E2EC] max-w-3xl mx-auto leading-relaxed font-normal">
              An institutional matchmaking and transaction facilitation platform connecting verified business promoters, pre-screened acquirers, and institutional capital under a confidential tripartite charter.
            </p>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#F59E0B] hover:bg-[#FDBA3B] text-[#0B1F3A] text-sm font-extrabold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
            >
              <span>Explore Opportunities</span>
              <ArrowRight className="w-4 h-4 text-[#0B1F3A]" />
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/30 text-sm font-semibold rounded-lg backdrop-blur-sm transition-all duration-200"
            >
              <span>Sell / Partner Business</span>
            </Link>
            <Link
              href="/how-it-works"
              className="w-full sm:w-auto text-xs font-semibold text-[#EEF5FB] hover:text-[#FDBA3B] px-4 py-2 transition-colors"
            >
              How Deal Rooms Work →
            </Link>
          </div>

          {/* Technical Ecosystem Diagram */}
          <div className="pt-10 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 sm:p-8 border border-white/20 shadow-2xl">
              <div className="text-[11px] uppercase tracking-widest text-[#D9E2EC] font-bold mb-6 text-center">
                The Scale-up India Bilateral Deal Infrastructure
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
                {/* Node 1: Promoters */}
                <div className="bg-white text-[#101828] p-5 rounded-xl shadow-sm text-center space-y-2 border border-[#D9E2EC] flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#EEF5FB] text-[#1557A6] flex items-center justify-center mx-auto mb-2">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1F3A]">Business Promoters</h3>
                    <p className="text-[11px] text-[#344054] leading-relaxed">
                      100% company buyouts, strategic equity dilution, or graceful retirement exits.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#1557A6] bg-[#EEF5FB] py-1 px-2.5 rounded-full inline-block mt-2">
                    Verified Dossiers
                  </span>
                </div>

                {/* Node 2: Center Orchestrator */}
                <div className="bg-gradient-to-b from-[#0B1F3A] to-[#1557A6] text-white p-6 rounded-xl shadow-xl text-center space-y-3 transform md:scale-105 border-2 border-[#F59E0B]/60 flex flex-col justify-between">
                  <div>
                    <div className="w-11 h-11 rounded-lg bg-[#F59E0B] text-[#0B1F3A] flex items-center justify-center mx-auto mb-2 font-bold shadow">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wide text-white">
                      Scale-up India
                    </h3>
                    <p className="text-[11px] text-[#EEF5FB] leading-relaxed">
                      Deterministic Matching Engine • Bilateral NDAs • 12-Category VDR • Closing Deal Rooms
                    </p>
                  </div>
                  <span className="text-[10px] font-bold text-[#FDBA3B] bg-white/10 py-1 px-3 rounded-full inline-block">
                    Tripartite Legal Shield
                  </span>
                </div>

                {/* Node 3: Buyers & Investors */}
                <div className="bg-white text-[#101828] p-5 rounded-xl shadow-sm text-center space-y-2 border border-[#D9E2EC] flex flex-col justify-between">
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-[#EEF5FB] text-[#1557A6] flex items-center justify-center mx-auto mb-2">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#0B1F3A]">Buyers &amp; Investors</h3>
                    <p className="text-[11px] text-[#344054] leading-relaxed">
                      Deploy growth capital into audited enterprises or execute horizontal acquisitions.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-[#1557A6] bg-[#EEF5FB] py-1 px-2.5 rounded-full inline-block mt-2">
                    Pre-Screened Mandates
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. PLATFORM DIFFERENTIATOR (Soft Blue Section - Rhythm)
          ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#EEF5FB] border-b border-[#D9E2EC]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-block text-xs font-bold uppercase tracking-wider text-[#1557A6] bg-white border border-[#D9E2EC] px-3.5 py-1 rounded-full shadow-sm">
                Institutional Deal Infrastructure
              </div>
              <h2 className="text-3xl font-extrabold text-[#0B1F3A] leading-tight">
                A Serious Business Platform. Not a Generic Directory.
              </h2>
              <p className="text-sm text-[#344054] leading-relaxed">
                Unlike open classifieds or public company databases, Scale-up India operates as an institutional M&amp;A intermediary. Commercial transactions require discretion, employee safeguarding, tax diligence, and tripartite non-disclosure governance.
              </p>

              <div className="space-y-3.5">
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-white text-[#12B76A] border border-emerald-200 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  </div>
                  <p className="text-xs text-[#344054] leading-relaxed">
                    <strong className="text-[#0B1F3A]">Progressive Data Masking:</strong> CIN, PAN, GSTIN, and audited balance sheets remain masked until mutual NDA execution.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-white text-[#12B76A] border border-emerald-200 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  </div>
                  <p className="text-xs text-[#344054] leading-relaxed">
                    <strong className="text-[#0B1F3A]">End-to-End Orchestration:</strong> From opportunity matching to earnest token deposits, 12-category VDR due diligence, and closing records.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 rounded-full bg-white text-[#12B76A] border border-emerald-200 shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-[#12B76A]" />
                  </div>
                  <p className="text-xs text-[#344054] leading-relaxed">
                    <strong className="text-[#0B1F3A]">Deterministic Matching Engine:</strong> Hard-gated matching across 7 criteria without speculative AI hallucinations.
                  </p>
                </div>
              </div>
            </div>

            {/* Pathways Grid */}
            <div className="bg-white p-8 rounded-2xl shadow-card border border-[#D9E2EC] space-y-6">
              <div className="flex items-center justify-between border-b border-[#D9E2EC] pb-4">
                <h3 className="text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                  Supported Transaction Types
                </h3>
                <span className="text-[11px] font-semibold text-[#1557A6]">4 Core Pathways</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#D9E2EC] hover:border-[#2878C8] transition-colors">
                  <h4 className="text-xs font-bold text-[#0B1F3A]">100% Acquisition</h4>
                  <p className="text-[11px] text-[#667085] mt-1">Full control buyouts and founder exits.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#D9E2EC] hover:border-[#2878C8] transition-colors">
                  <h4 className="text-xs font-bold text-[#0B1F3A]">Equity Dilution</h4>
                  <p className="text-[11px] text-[#667085] mt-1">Growth capital and minority investor entry.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#D9E2EC] hover:border-[#2878C8] transition-colors">
                  <h4 className="text-xs font-bold text-[#0B1F3A]">Joint Ventures</h4>
                  <p className="text-[11px] text-[#667085] mt-1">Commercial alliances &amp; market synergy.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#D9E2EC] hover:border-[#2878C8] transition-colors">
                  <h4 className="text-xs font-bold text-[#0B1F3A]">Asset Realization</h4>
                  <p className="text-[11px] text-[#667085] mt-1">Factory, plant, and industrial real estate.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. FEATURED MASKED OPPORTUNITIES (White Section)
          ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#D9E2EC]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">
              Curated Confidential Opportunities
            </h2>
            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl mx-auto leading-relaxed">
              Real commercial enterprises vetted by our transaction committee. In adherence to our confidentiality charter, statutory credentials are progressively unmasked.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <div className="bg-[#F7F9FC] p-6 rounded-2xl border border-[#D9E2EC] space-y-5 hover:border-[#2878C8] hover:shadow-cardHover transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#12B76A] border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  Verified Opportunity
                </span>
                <span className="text-xs font-bold text-[#1557A6]">94% Match Synergy</span>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">
                Profitable Precision Engineering &amp; CNC Component Enterprise
              </h3>
              <div className="space-y-2 text-xs text-[#344054] pt-1">
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Sector:</span>
                  <strong className="text-[#0B1F3A]">Precision Engineering</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Region:</span>
                  <strong className="text-[#0B1F3A]">North India (Haryana / NCR)</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Revenue Range:</span>
                  <strong className="text-[#0B1F3A]">₹15 Cr – ₹30 Cr</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Structure:</span>
                  <strong className="text-[#1557A6]">100% Stake Sale</strong>
                </div>
              </div>
              <Link
                href="/opportunities"
                className="block text-center w-full py-2.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Inspect Teaser &amp; Request NDA
              </Link>
            </div>

            {/* Card 2 */}
            <div className="bg-[#F7F9FC] p-6 rounded-2xl border border-[#D9E2EC] space-y-5 hover:border-[#2878C8] hover:shadow-cardHover transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#12B76A] border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  Verified Opportunity
                </span>
                <span className="text-xs font-bold text-[#1557A6]">88% Match Synergy</span>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">
                Specialty Chemical &amp; Bio-Extracts Formulation Plant
              </h3>
              <div className="space-y-2 text-xs text-[#344054] pt-1">
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Sector:</span>
                  <strong className="text-[#0B1F3A]">Chemicals &amp; Life Sciences</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Region:</span>
                  <strong className="text-[#0B1F3A]">Western India (Gujarat)</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Revenue Range:</span>
                  <strong className="text-[#0B1F3A]">₹40 Cr – ₹65 Cr</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Structure:</span>
                  <strong className="text-[#1557A6]">Majority Equity Dilution</strong>
                </div>
              </div>
              <Link
                href="/opportunities"
                className="block text-center w-full py-2.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Inspect Teaser &amp; Request NDA
              </Link>
            </div>

            {/* Card 3 */}
            <div className="bg-[#F7F9FC] p-6 rounded-2xl border border-[#D9E2EC] space-y-5 hover:border-[#2878C8] hover:shadow-cardHover transition-all duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-[#12B76A] border border-emerald-200 px-2.5 py-0.5 rounded-md">
                  Verified Opportunity
                </span>
                <span className="text-xs font-bold text-[#1557A6]">91% Match Synergy</span>
              </div>
              <h3 className="text-base font-bold text-[#0B1F3A]">
                Multi-Location Cold Chain Logistics &amp; Warehousing Firm
              </h3>
              <div className="space-y-2 text-xs text-[#344054] pt-1">
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Sector:</span>
                  <strong className="text-[#0B1F3A]">Supply Chain &amp; Cold Storage</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Region:</span>
                  <strong className="text-[#0B1F3A]">Central India (Madhya Pradesh)</strong>
                </div>
                <div className="flex justify-between border-b border-[#D9E2EC]/70 pb-1.5">
                  <span className="text-[#667085]">Revenue Range:</span>
                  <strong className="text-[#0B1F3A]">₹20 Cr – ₹35 Cr</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#667085]">Structure:</span>
                  <strong className="text-[#1557A6]">Strategic JV / Equity Dilution</strong>
                </div>
              </div>
              <Link
                href="/opportunities"
                className="block text-center w-full py-2.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
              >
                Inspect Teaser &amp; Request NDA
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. TRUST & SECURITY ARCHITECTURE (Navy Section - Rhythm)
          ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0B1F3A] text-white border-b border-[#102B4E]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-[11px] uppercase tracking-wider text-[#F59E0B] font-bold">
              Confidentiality by Design
            </span>
            <h2 className="text-3xl font-extrabold text-white">
              Institutional Security &amp; Tripartite Legal Governance
            </h2>
            <p className="text-xs sm:text-sm text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
              Scale-up India replaces insecure email attachments and uncontrolled disclosures with bank-grade access isolation and immutable cryptographic audit trails.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#102B4E]/60 border border-white/10 rounded-2xl p-6 space-y-3 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-lg bg-[#1557A6] text-white flex items-center justify-center">
                <Lock className="w-5 h-5 text-[#FDBA3B]" />
              </div>
              <h3 className="text-base font-bold text-white">Tiered Access Control</h3>
              <p className="text-xs text-[#D9E2EC] leading-relaxed">
                4-tier progressive data masking prevents early entity exposure. Full corporate disclosures require mutual bilateral electronic NDA execution.
              </p>
            </div>

            <div className="bg-[#102B4E]/60 border border-white/10 rounded-2xl p-6 space-y-3 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-lg bg-[#1557A6] text-white flex items-center justify-center">
                <FileCheck2 className="w-5 h-5 text-[#FDBA3B]" />
              </div>
              <h3 className="text-base font-bold text-white">12-Category Virtual Data Room</h3>
              <p className="text-xs text-[#D9E2EC] leading-relaxed">
                Magic-byte verified document vault outside web root with SHA-256 integrity checksums and short-lived HMAC-signed download URLs.
              </p>
            </div>

            <div className="bg-[#102B4E]/60 border border-white/10 rounded-2xl p-6 space-y-3 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-lg bg-[#1557A6] text-white flex items-center justify-center">
                <Scale className="w-5 h-5 text-[#FDBA3B]" />
              </div>
              <h3 className="text-base font-bold text-white">Atomic Transaction Closing</h3>
              <p className="text-xs text-[#D9E2EC] leading-relaxed">
                Deterministic closing conditions verification, row-locked database settlement, sequential Closing Record generation, and immutable audit logs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. STRUCTURED 9-STEP JOURNEY (Soft Blue Section - Rhythm)
          ========================================================================= */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#EEF5FB] border-b border-[#D9E2EC]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1F3A]">
              Structured 9-Step Deal Journey
            </h2>
            <p className="text-xs sm:text-sm text-[#667085] max-w-2xl mx-auto">
              From onboarding through bilateral NDA, Tripartite MOU, Due Diligence, and final Share Transfer Agreement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-3 text-center">
            {[
              { step: "01", title: "Registration", desc: "Intent & role onboarding" },
              { step: "02", title: "Dossier", desc: "Statutory & financial audit" },
              { step: "03", title: "Verification", desc: "Admin compliance review" },
              { step: "04", title: "Matching", desc: "7-Factor synergy score" },
              { step: "05", title: "EOI Interest", desc: "24h response SLA" },
              { step: "06", title: "Bilateral NDA", desc: "Countersigned secrecy" },
              { step: "07", title: "MOU & Token", desc: "Earnest deposit ledger" },
              { step: "08", title: "Due Diligence", desc: "12-Category room audit" },
              { step: "09", title: "Closing", desc: "Atomic settlement & STA" },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white p-4 rounded-xl border border-[#D9E2EC] shadow-sm flex flex-col justify-between hover:border-[#2878C8] transition-colors"
              >
                <div>
                  <span className="text-xs font-black text-[#1557A6] block mb-1">
                    {item.step}
                  </span>
                  <h4 className="text-xs font-bold text-[#0B1F3A] leading-tight">
                    {item.title}
                  </h4>
                </div>
                <p className="text-[10px] text-[#667085] mt-2 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. FINAL CALL TO ACTION (Deep Navy + Royal Blue Gradient + Orange CTA)
          ========================================================================= */}
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-16 px-4 sm:px-6 lg:px-8 text-center border-t border-[#102B4E]">
        <div className="max-w-4xl mx-auto space-y-6">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#FDBA3B]">
            Confidential Consultation
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight">
            Tell us what you&apos;re looking to buy, sell, invest in, or build.
          </h2>
          <p className="text-xs sm:text-sm text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Every business conversation is protected by strict non-disclosure covenants and guided by corporate advisors at Ideal Corporate Synergy LLP.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-3.5 bg-[#F59E0B] hover:bg-[#FDBA3B] text-[#0B1F3A] text-xs sm:text-sm font-extrabold rounded-lg shadow-md transition-all duration-200 hover:shadow-lg"
            >
              Get Started Now
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-3.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-semibold rounded-lg backdrop-blur-sm transition-colors"
            >
              Access Deal Room
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
