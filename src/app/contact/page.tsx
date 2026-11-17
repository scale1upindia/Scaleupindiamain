import { Mail, Phone, MapPin, Clock, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Contact Desk — Scale-up India",
  description: "Reach the Scale-up India transaction facilitation and support desk.",
};

export default function ContactPage() {
  return (
    <div className="flex-1 bg-[#F7F9FC]">
      <section className="bg-gradient-to-r from-[#0B1F3A] via-[#102B4E] to-[#1557A6] text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-[#153864]">
        <div className="max-w-5xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 px-3.5 py-1 rounded-full text-xs text-[#D9E2EC]">
            <ShieldCheck className="w-4 h-4 text-[#F59E0B]" />
            <span>Advisory Assistance</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Contact Scale-up India
          </h1>
          <p className="text-sm sm:text-base text-[#D9E2EC] max-w-2xl mx-auto leading-relaxed">
            Our transaction advisors are available to assist business promoters and institutional acquirers.
          </p>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-[#D9E2EC] p-8 shadow-sm space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-lg bg-slate-50 border border-[#D9E2EC] space-y-2 text-center sm:text-left">
              <MapPin className="w-5 h-5 text-[#1557A6] mx-auto sm:mx-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Corporate Office</h3>
              <address className="not-italic text-xs text-slate-600 leading-relaxed">
                302, Raghuvansham Apartment,<br />
                Main Road Kidwaipuri,<br />
                Near IT Golamber, Patna - 800001
              </address>
            </div>

            <div className="p-5 rounded-lg bg-slate-50 border border-[#D9E2EC] space-y-2 text-center sm:text-left">
              <Phone className="w-5 h-5 text-[#12B76A] mx-auto sm:mx-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Direct Telephone</h3>
              <p className="text-xs text-slate-600 font-medium">+91 99955 004</p>
              <p className="text-[11px] text-slate-500">Mon – Fri, 9:30 AM – 6:30 PM IST</p>
            </div>

            <div className="p-5 rounded-lg bg-slate-50 border border-[#D9E2EC] space-y-2 text-center sm:text-left">
              <Mail className="w-5 h-5 text-[#2878C8] mx-auto sm:mx-0" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Electronic Mail</h3>
              <p className="text-xs text-slate-600 font-medium">contact@scaleupindia.co.in</p>
              <p className="text-[11px] text-slate-500">Confidential inquiries answered within 24h</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 text-xs text-slate-500 leading-relaxed text-center">
            For existing onboarding dossiers and active mandate queries, please log in and utilize the In-App Transaction Desk.
          </div>
        </div>
      </div>
    </div>
  );
}

