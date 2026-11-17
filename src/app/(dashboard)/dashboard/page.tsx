"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  User,
  Key,
  LogOut,
  Mail,
  Phone,
  Calendar,
  AlertTriangle,
  Building,
  ArrowRight,
  ClipboardList,
  FileText,
  Target,
  Briefcase,
  Bell,
} from "lucide-react";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogoutAll = async () => {
    if (!confirm("Are you sure you want to sign out from all active sessions?")) return;
    try {
      await fetch("/api/v1/auth/logout", { method: "POST" });
      await logout();
    } catch (err) {
      console.error("Error signing out all sessions:", err);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1557A6]" />
      </div>
    );
  }

  return (
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xl shadow-md border border-[#153864]">
              {user.firstName[0]}
              {user.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Welcome, {user.firstName} {user.lastName}
                </h1>
                {user.isEmailVerified ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    Verified Email
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    Email Unverified
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Scale-up India Authenticated Private Workspace • Session Protected
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => logout()}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={handleLogoutAll}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 hover:text-red-800 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
            >
              <span>Logout All Sessions</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Seller Onboarding Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <FileText className="w-4 h-4 text-[#1557A6]" />
                Seller / Promoter Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2 py-0.5 rounded">
                Active Phase 2
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Business Profile & Onboarding Dossier
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Complete or review your multi-step business profile, statutory identifiers (CIN, GSTIN, PAN),
              audited financials, ownership cap table, transaction preferences, and private document vault.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <Link
              href="/onboarding/seller"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <span>Onboarding</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/opportunities"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Listings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/eois"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>EOI Inbox</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/ndas"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#0B1F3A] hover:bg-[#102B4E] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>NDAs & VDR</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/messages"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Messages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/mous"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>MOUs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/payments"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Escrow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/diligence"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Diligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/valuation"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Valuation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/seller/deal-room"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Deal Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Buyer Mandate Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <Target className="w-4 h-4 text-[#1557A6]" />
                Buyer & Investor Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2 py-0.5 rounded">
                Active Phase 3
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Acquisition & Investment Mandates
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Create and manage corporate buyout or investment mandates, target financial parameters,
              sector taxonomy, geographic criteria, and upload proof of capital to the secure vault.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
            <Link
              href="/onboarding/buyer"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors"
            >
              <span>Mandates</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/matches"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Matches</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/eois"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>My EOIs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/ndas"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>My NDAs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/messages"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#0B1F3A] hover:bg-[#102B4E] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Messages</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/mous"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>MOUs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/payments"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Escrow</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/diligence"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Diligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/valuation"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Valuation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/buyer/deal-room"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Deal Room</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/opportunities"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#0B1F3A] hover:bg-[#102B4E] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>Explore Deals</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Notification & Communication Center Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <Bell className="w-4 h-4 text-[#1557A6]" />
                Communication Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2 py-0.5 rounded">
                Active Phase 15
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Notification & Preferences Center
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              View authoritative in-app alerts, transaction milestone notices, escrow token updates, and configure your delivery preferences across in-app and email channels.
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex gap-2">
            <Link
              href="/notifications"
              className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              <span>View Notifications</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Admin Review Console Card (Shown if user has administrative permission) */}
        {user &&
        (user.permissions.includes("sellers.read") ||
          user.permissions.includes("buyers.read") ||
          user.roles.some((r) =>
            ["SUPER_ADMIN", "ADMIN", "VERIFICATION_MANAGER"].includes(r)
          )) ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  Staff Diligence Desks
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Staff Only
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Verification & Review Consoles
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Review submitted promoter dossiers and institutional buyer acquisition mandates, verify statutory records, and record internal diligence notes.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
              <Link
                href="/admin/sellers"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <span>Sellers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/buyers"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-[#0B1F3A] hover:bg-[#102B4E] text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <span>Buyers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/admin/opportunities"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <span>Opportunities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#1557A6]" />
                  Trust & Confidentiality
                </span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  Enterprise Grade
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Confidential Deal Ecosystem
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Scale-up India operates on strict bilateral confidentiality. Identifiers and proprietary
                audited figures are shielded by granular RBAC, private document vaults, and audit logs.
              </p>
            </div>
            <div className="mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
              Assigned Roles: <strong className="text-slate-800">{user.roles.join(", ")}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#1557A6]" />
            <span>Account Identifiers</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">User ID</span>
              <span className="font-mono text-slate-700 break-all">{user.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Email</span>
              <span className="font-medium text-slate-800">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Mobile Phone</span>
              <span className="font-medium text-slate-800">{user.phone || "Not provided"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase">Member Since</span>
              <span className="text-slate-700">
                {new Date(user.createdAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Assigned Roles Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider border-b border-slate-100 pb-3">
            <Building className="w-4 h-4 text-[#1557A6]" />
            <span>Multi-Role Profile</span>
          </div>
          <p className="text-xs text-slate-600">
            Scale-up India supports concurrent personas on a single account:
          </p>
          <div className="flex flex-wrap gap-2">
            {user.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-[#0B1F3A] text-white shadow-sm"
              >
                {role}
              </span>
            ))}
          </div>
          <div className="pt-2 text-[11px] text-slate-500">
            Account Type:{" "}
            <strong className="text-slate-800">
              {user.isInternal ? "Internal Scale-up India Staff" : "External Commercial Entity"}
            </strong>
          </div>
        </div>

        {/* Granular Permissions Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider border-b border-slate-100 pb-3">
            <Key className="w-4 h-4 text-[#1557A6]" />
            <span>Active Permissions ({user.permissions.length})</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-2">
            {user.permissions.map((perm) => (
              <div
                key={perm}
                className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-100"
              >
                {perm}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

