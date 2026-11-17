"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, AlertCircle, ArrowRight, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError("Missing verification token. Please verify your link.");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch("/api/v1/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const json = await res.json();
        if (json.success) {
          setSuccess(true);
        } else {
          setError(json.error?.message || "Verification failed");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-[#D9E2EC] text-center">
      {loading ? (
        <div className="space-y-4 py-8">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin mx-auto" />
          <h3 className="text-sm font-bold text-[#0B1F3A]">Verifying Email Address...</h3>
          <p className="text-xs text-[#667085]">Validating cryptographic token against institutional ledger</p>
        </div>
      ) : success ? (
        <div className="space-y-4 py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 text-[#12B76A] border border-emerald-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A]">Email Verified</h2>
          <p className="text-xs text-[#344054] leading-relaxed">
            Your registered email address has been successfully verified. Your account is now in good standing for deal room participation.
          </p>
          <div className="pt-4 border-t border-[#D9E2EC]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-[#1557A6] hover:bg-[#2878C8] text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
            >
              <span>Proceed to Login</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 text-[#D92D20] border border-red-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-extrabold text-[#0B1F3A]">Verification Notice</h2>
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          <div className="pt-4 border-t border-[#D9E2EC]">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-1.5 px-6 py-2.5 bg-white border border-[#D9E2EC] text-[#0B1F3A] hover:bg-[#EEF5FB] text-xs font-bold rounded-lg transition-colors"
            >
              <span>Back to Login</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#F7F9FC]">
      <Suspense
        fallback={
          <div className="p-8 text-center text-[#667085] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#1557A6]" />
            <span className="text-xs font-semibold">Verifying...</span>
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}
