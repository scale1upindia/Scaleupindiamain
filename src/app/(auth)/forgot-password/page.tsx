"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Failed to process request");
      }
      setSubmitted(true);
      if (json.data.devToken) {
        setDevToken(json.data.devToken);
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#F7F9FC]">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-card border border-[#D9E2EC]">
        <div className="text-center mb-6">
          <h2 className="text-xl font-extrabold text-[#0B1F3A]">Password Reset Assistance</h2>
          <p className="mt-1 text-xs text-[#667085]">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-800 text-xs">
            <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {submitted ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-[#12B76A] border border-emerald-200">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#0B1F3A]">Dispatch Complete</h3>
            <p className="text-xs text-[#344054] leading-relaxed">
              If an active account corresponds to <strong className="text-[#0B1F3A]">{email}</strong>, a secure password reset link has been dispatched.
            </p>

            {devToken && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left text-xs text-amber-900">
                <span className="font-bold block text-[11px] uppercase tracking-wider mb-1">
                  Local Dev Reset Link:
                </span>
                <Link
                  href={`/reset-password?token=${devToken}`}
                  className="text-[#1557A6] font-mono break-all underline hover:text-[#2878C8]"
                >
                  /reset-password?token={devToken}
                </Link>
              </div>
            )}

            <div className="pt-4 border-t border-[#D9E2EC]">
              <Link href="/login" className="text-xs font-semibold text-[#1557A6] hover:text-[#2878C8]">
                Return to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#344054] uppercase tracking-wider mb-1.5">
                Registered Email
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg shadow-sm bg-[#1557A6] hover:bg-[#2878C8] text-white text-sm font-bold transition-all duration-200 disabled:opacity-60"
            >
              {isSubmitting ? (
                <span>Sending instruction...</span>
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <Link href="/login" className="text-xs text-[#667085] hover:text-[#1557A6] font-medium transition-colors">
                ← Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
