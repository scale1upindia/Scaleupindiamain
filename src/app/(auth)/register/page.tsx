"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  TrendingUp,
  Handshake,
  Check,
  ArrowRight,
  AlertCircle,
  Building,
} from "lucide-react";

type RoleOption = "PROMOTER" | "BUYER" | "INVESTOR" | "PARTNER";

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  // Single-role selection state (Option A)
  const [selectedRoles, setSelectedRoles] = useState<RoleOption[]>(["PROMOTER"]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectRole = (role: RoleOption) => {
    setSelectedRoles([role]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedRoles.length === 0) {
      setError("Please select at least one role to proceed.");
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        firstName,
        lastName,
        email,
        phone,
        password,
        roles: selectedRoles,
      });
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please review your details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#F7F9FC]">
      <div className="max-w-xl w-full bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-[#D9E2EC]">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#EEF5FB] text-[#1557A6] mb-3 shadow-sm border border-[#D9E2EC]">
            <Building className="w-6 h-6 text-[#1557A6]" />
          </div>
          <h2 className="text-2xl font-extrabold text-[#0B1F3A] tracking-tight">
            Join Scale-up India
          </h2>
          <p className="mt-1 text-xs text-[#667085]">
            A trusted ecosystem connecting Indian businesses, capital, and strategic partners.
          </p>
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#D92D20]">Notice</p>
              <p className="mt-0.5 text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Role Selection */}
        <div className="mt-8">
          <label className="block text-xs font-bold text-[#0B1F3A] uppercase tracking-wider mb-1.5">
            Step 1: What brings you to Scale-up India? (Select Your Role)
          </label>
          <p className="text-[11px] text-[#667085] mb-3">
            Choose your primary account type. You can manage mandates and listings from your workspace.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Option 1: Promoter / Seller */}
            <div
              onClick={() => selectRole("PROMOTER")}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-left flex flex-col justify-between ${
                selectedRoles.includes("PROMOTER")
                  ? "border-[#1557A6] bg-[#EEF5FB] shadow-sm"
                  : "border-[#D9E2EC] hover:border-[#2878C8]/60 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="w-5 h-5 text-[#1557A6]" />
                  {selectedRoles.includes("PROMOTER") && (
                    <div className="w-4 h-4 rounded-full bg-[#1557A6] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold text-[#0B1F3A]">Promoter / Seller</h4>
                <p className="text-[10px] text-[#344054] mt-1 leading-relaxed">
                  100% buyout, equity dilution, or asset sale.
                </p>
              </div>
            </div>

            {/* Option 2: Buyer / Investor */}
            <div
              onClick={() => selectRole("BUYER")}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-left flex flex-col justify-between ${
                selectedRoles.includes("BUYER")
                  ? "border-[#1557A6] bg-[#EEF5FB] shadow-sm"
                  : "border-[#D9E2EC] hover:border-[#2878C8]/60 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-[#1557A6]" />
                  {selectedRoles.includes("BUYER") && (
                    <div className="w-4 h-4 rounded-full bg-[#1557A6] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold text-[#0B1F3A]">Buyer / Investor</h4>
                <p className="text-[10px] text-[#344054] mt-1 leading-relaxed">
                  Targeted acquisitions and strategic investments.
                </p>
              </div>
            </div>

            {/* Option 3: Strategic Partner / JV */}
            <div
              onClick={() => selectRole("PARTNER")}
              className={`cursor-pointer p-4 rounded-xl border-2 transition-all text-left flex flex-col justify-between ${
                selectedRoles.includes("PARTNER")
                  ? "border-[#1557A6] bg-[#EEF5FB] shadow-sm"
                  : "border-[#D9E2EC] hover:border-[#2878C8]/60 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Handshake className="w-5 h-5 text-[#1557A6]" />
                  {selectedRoles.includes("PARTNER") && (
                    <div className="w-4 h-4 rounded-full bg-[#1557A6] text-white flex items-center justify-center">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <h4 className="text-xs font-bold text-[#0B1F3A]">Partnership / JV</h4>
                <p className="text-[10px] text-[#344054] mt-1 leading-relaxed">
                  Synergy alliances and market expansion.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Google Quick Sign-Up */}
        <div className="mt-6 pt-6 border-t border-[#D9E2EC]">
          <a
            href={`/api/v1/auth/google?roles=${selectedRoles.join(",")}`}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-[#D9E2EC] bg-white hover:bg-[#F7F9FC] text-[#344054] text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow active:bg-[#EDF2F7]"
          >
            <GoogleIcon />
            <span>Sign up with Google</span>
          </a>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#D9E2EC]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-[#667085] font-medium">or register with email</span>
            </div>
          </div>
        </div>

        {/* Step 2: Email & Password Registration */}
        <form className="space-y-6" onSubmit={handleSubmit}>
          {/* Personal Information */}
          <div className="space-y-4">
            <label className="block text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
              Step 2: Profile &amp; Credentials
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1.5">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Ramesh"
                  className="block w-full px-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1.5">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Sharma"
                  className="block w-full px-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1.5">Work / Business Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ramesh@company.in"
                  className="block w-full px-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#344054] mb-1.5">Mobile Number (India +91)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 9876543210"
                  className="block w-full px-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#344054] mb-1.5">
                Password (Min 8 chars, 1 uppercase, 1 number, 1 special char) *
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full px-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
              />
            </div>
          </div>

          <div className="text-[11px] text-[#344054] leading-relaxed bg-[#EEF5FB] p-3.5 rounded-xl border border-[#D9E2EC]">
            <span className="font-bold text-[#0B1F3A]">Confidentiality Guarantee:</span> Scale-up India protects all identifying details. Your contact and business identifiers are never shared publicly.
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg shadow-sm bg-[#1557A6] hover:bg-[#2878C8] text-white text-sm font-bold transition-all duration-200 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>Creating your secure workspace...</span>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-4 border-t border-[#D9E2EC] mt-6">
          <p className="text-xs text-[#667085]">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#1557A6] hover:text-[#2878C8] transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
