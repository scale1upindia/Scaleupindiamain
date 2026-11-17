import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, MapPin, Phone, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#0B1F3A] text-white border-t border-[#102B4E] mt-auto">
      {/* Trust & Confidentiality Header */}
      <div className="bg-[#061224] py-3.5 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#EEF5FB]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span className="font-semibold text-white">Institutional Confidentiality Charter</span>
            <span className="hidden md:inline text-[#98A2B3]">— Proprietary business identities, CINs, and financials safeguarded under tripartite NDAs.</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#98A2B3]">
            <span>Verified Promoters</span>
            <span>•</span>
            <span>Pre-screened Acquirers</span>
            <span>•</span>
            <span>Tripartite Legal Architecture</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Column 1: Brand & Operating Entity */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2.5">
              <div className="bg-white/10 rounded-lg p-1.5">
                <Image src="/logo-icon.png" alt="Scale-up India" width={36} height={36} className="h-9 w-auto" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-base font-extrabold text-white tracking-tight">Scale-up India</span>
                <span className="text-[10px] text-[#F59E0B] font-semibold tracking-wide">Empowering Tomorrow&apos;s Enterprises</span>
              </div>
            </div>
            <p className="text-xs text-[#98A2B3] leading-relaxed">
              Scale-up India is an institutional matchmaking and deal orchestration platform operated under{" "}
              <strong className="text-white">Ideal Corporate Synergy LLP</strong>. Connecting businesses, capital, and strategic visionaries.
            </p>
            <div className="pt-2">
              <Image src="/ics-logo.svg" alt="ICS LLP" width={180} height={36} className="h-6 w-auto opacity-80" />
            </div>
          </div>

          {/* Column 2: Deal Pathways */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EEF5FB] mb-4">
              Deal Pathways
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/onboarding/buyer" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Acquire a Business (100% Buyout)
                </Link>
              </li>
              <li>
                <Link href="/onboarding/seller" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Sell Company Stake / Graceful Exit
                </Link>
              </li>
              <li>
                <Link href="/onboarding/buyer" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Growth Capital & Equity Dilution
                </Link>
              </li>
              <li>
                <Link href="/onboarding/buyer" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Strategic Joint Ventures & Partnerships
                </Link>
              </li>
              <li>
                <Link href="/opportunities" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Curated Confidential Opportunities
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Professional Services */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EEF5FB] mb-4">
              Deal Room & Services
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link href="/services" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  12-Category Due Diligence Room
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Valuation Support (IBBI / DCF)
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Tripartite MOU & Token Architecture
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Share Transfer Agreement (STA) Execution
                </Link>
              </li>
              <li>
                <Link href="/confidentiality" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">
                  Confidentiality Charter & NDA
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Corporate Office */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#EEF5FB] mb-4">
              Corporate Office
            </h4>
            <div className="space-y-3 text-xs text-[#98A2B3]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                <address className="not-italic leading-relaxed text-[#D9E2EC]">
                  302, Raghuvansham Apartment,<br />
                  Main Road Kidwaipuri,<br />
                  Near IT Golamber, Patna - 800001
                </address>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span className="text-[#D9E2EC]">+91 99955 004</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#F59E0B] shrink-0" />
                <span className="text-[#D9E2EC]">contact@scaleupindia.co.in</span>
              </div>
            </div>
          </div>
        </div>

        {/* Regulatory Disclaimer & Copyright */}
        <div className="mt-12 pt-8 border-t border-white/10 text-xs text-[#98A2B3]">
          <p className="leading-relaxed text-[11px] text-slate-400">
            <strong>Regulatory & Platform Disclaimer:</strong> Scale-up India is a confidential matchmaking and transaction facilitation platform operated under Ideal Corporate Synergy LLP. Scale-up India does not provide public investment advisory or retail depository services, and is not an RBI-registered NBFC, SEBI-registered stock broker, or retail escrow bank. All transactions, Due Diligence proceedings, and legal document executions are conducted strictly between consenting commercial principals with professional advisory facilitation.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
            <p className="text-slate-400">© {new Date().getFullYear()} Scale-up India / Ideal Corporate Synergy LLP. All rights reserved.</p>
            <div className="flex items-center gap-5">
              <Link href="/privacy" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">Terms of Use</Link>
              <Link href="/confidentiality" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">Confidentiality</Link>
              <Link href="/disclaimer" className="text-[#D9E2EC] hover:text-[#F59E0B] transition-colors">Disclaimer</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
