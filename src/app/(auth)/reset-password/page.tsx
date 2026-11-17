"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!token) {
      setError("Missing reset token. Please check your reset link.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error?.message || "Password reset failed");
      }
      setCompleted(true);
    } catch (err: any) {
      setError(err.message || "Failed to update password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-[#D9E2EC]">
      <div className="text-center mb-6">
        <h2 className="text-xl font-extrabold text-[#0B1F3A]">Set New Password</h2>
        <p className="mt-1 text-xs text-[#667085]">
          Please choose a strong password to safeguard your confidential deal records.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {completed ? (
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-[#12B76A] border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[#0B1F3A]">Password Updated</h3>
          <p className="text-xs text-[#344054] leading-relaxed">
            Your password has been securely updated. All previous sessions have been invalidated.
          </p>
          <div className="pt-4 border-t border-[#D9E2EC]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#344054] uppercase tracking-wider mb-1.5">
              New Password
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-[#D9E2EC] rounded-lg bg-white text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#1557A6]/20 focus:border-[#1557A6] placeholder-[#98A2B3] transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#344054] uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative rounded-lg shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
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
              <span>Updating password...</span>
            ) : (
              <>
                <span>Save New Password</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#F7F9FC]">
      <Suspense
        fallback={
          <div className="p-8 text-center text-[#667085] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#1557A6]" />
            <span className="text-xs font-semibold">Loading...</span>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
