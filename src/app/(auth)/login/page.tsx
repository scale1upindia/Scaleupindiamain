"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

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

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getErrorMessage = (code: string | null) => {
    if (!code) return null;
    switch (code) {
      case "unverified_email":
        return "Your Google account email is not verified. Please verify your email with Google or sign in using a password.";
      case "invalid_oauth_state":
      case "csrf_state_mismatch":
        return "Authentication session expired or security verification failed. Please try signing in again.";
      case "google_auth_not_configured":
        return "Google Sign-In is not currently configured for this environment. Please sign in with your email and password.";
      case "account_suspended":
        return "Your account has been suspended by Scale-up India administration.";
      case "access_denied":
        return "Google authorization request was cancelled or declined.";
      default:
        return decodeURIComponent(code).replace(/_/g, " ");
    }
  };

  const displayError = error || getErrorMessage(urlError);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      router.push(redirectPath);
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please verify your email and password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full space-y-6 bg-white p-8 sm:p-10 rounded-2xl shadow-card border border-[#D9E2EC]">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#EEF5FB] text-[#1557A6] mb-3 shadow-sm border border-[#D9E2EC]">
          <Shield className="w-6 h-6 text-[#1557A6]" />
        </div>
        <h2 className="text-2xl font-extrabold text-[#0B1F3A] tracking-tight">
          Sign In to Deal Room
        </h2>
        <p className="mt-2 text-xs text-[#667085]">
          Confidential access for Promoters, Acquirers &amp; Institutional Partners
        </p>
      </div>

      {/* Error Alert */}
      {displayError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 text-[#D92D20] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[#D92D20]">Authentication Notice</p>
            <p className="mt-0.5 text-red-700">{displayError}</p>
          </div>
        </div>
      )}

      {/* Google Sign-In Action */}
      <div>
        <a
          href={`/api/v1/auth/google${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ""}`}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border border-[#D9E2EC] bg-white hover:bg-[#F7F9FC] text-[#344054] text-sm font-semibold transition-all duration-150 shadow-sm hover:shadow active:bg-[#EDF2F7]"
        >
          <GoogleIcon />
          <span>Continue with Google</span>
        </a>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#D9E2EC]" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-3 text-[#667085] font-medium">or continue with email</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="block text-xs font-bold text-[#344054] uppercase tracking-wider mb-1.5">
            Registered Email Address
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

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-[#344054] uppercase tracking-wider">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#1557A6] hover:text-[#2878C8] transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative rounded-lg shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#98A2B3]">
              <Lock className="h-4 w-4" />
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            <span>Verifying credentials...</span>
          ) : (
            <>
              <span>Enter Private Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <div className="text-center pt-4 border-t border-[#D9E2EC]">
        <p className="text-xs text-[#667085]">
          Don&apos;t have an account on Scale-up India?{" "}
          <Link
            href="/register"
            className="font-bold text-[#1557A6] hover:text-[#2878C8] transition-colors"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex items-center justify-center py-16 px-4 sm:px-6 lg:px-8 bg-[#F7F9FC]">
      <Suspense
        fallback={
          <div className="p-8 text-center text-[#667085] flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-[#1557A6]" />
            <span className="text-xs font-semibold">Loading deal room...</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
