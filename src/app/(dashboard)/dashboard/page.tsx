"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  User,
  Key,
  LogOut,
  AlertTriangle,
  Building,
  ArrowRight,
  ClipboardList,
  FileText,
  Target,
  Bell,
  Sparkles,
  ExternalLink,
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
      <div className="flex-1 flex items-center justify-center p-8 min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1557A6]" />
      </div>
    );
  }

  const isStaff =
    user.permissions.includes("sellers.read") ||
    user.permissions.includes("buyers.read") ||
    user.roles.some((r) =>
      ["SUPER_ADMIN", "ADMIN", "VERIFICATION_MANAGER"].includes(r)
    );

  const sellerActions = [
    { href: "/onboarding/seller", label: "Onboarding Dossier", badge: "Start" },
    { href: "/seller/opportunities", label: "My Listings" },
    { href: "/seller/eois", label: "EOI Inbox" },
    { href: "/seller/ndas", label: "NDAs & VDR" },
    { href: "/seller/messages", label: "Deal Messages" },
    { href: "/seller/mous", label: "MOUs" },
    { href: "/seller/payments", label: "Escrow & Fees" },
    { href: "/seller/diligence", label: "Diligence Vault" },
    { href: "/seller/valuation", label: "Valuation" },
    { href: "/seller/deal-room", label: "Deal Room" },
  ];

  const buyerActions = [
    { href: "/onboarding/buyer", label: "Buyer Mandate", badge: "Start" },
    { href: "/buyer/matches", label: "AI Matches" },
    { href: "/buyer/eois", label: "My EOIs" },
    { href: "/buyer/ndas", label: "My NDAs" },
    { href: "/buyer/messages", label: "Deal Messages" },
    { href: "/buyer/mous", label: "MOUs" },
    { href: "/buyer/payments", label: "Escrow & Tokens" },
    { href: "/buyer/diligence", label: "Due Diligence" },
    { href: "/buyer/valuation", label: "Valuation" },
    { href: "/buyer/deal-room", label: "Deal Room" },
    { href: "/opportunities", label: "Explore Catalog" },
  ];

  return (
    <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      {/* Top Welcome Banner */}
      <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 sm:p-7 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[#0B1F3A] text-white flex items-center justify-center font-bold text-xl shadow-xs border border-[#153864] shrink-0">
              {user.firstName?.[0] || "U"}
              {user.lastName?.[0] || ""}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
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
                {isStaff && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Staff Access
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Scale-up India Authenticated Private Workspace • Session Protected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-center">
            {isStaff && (
              <Link
                href="/admin/sellers"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1557A6] bg-[#EEF5FB] hover:bg-[#DCEBF8] rounded-md transition-colors border border-[#1557A6]/20"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Admin Console</span>
              </Link>
            )}
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
              <span>Logout All</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2x2 Quick Navigation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Card 1: Seller / Promoter Hub */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <FileText className="w-4 h-4 text-[#1557A6]" />
                Seller / Promoter Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2.5 py-0.5 rounded-full">
                Active Phase 2
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">
              Business Profile & Onboarding Dossier
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Complete or review your multi-step business profile, statutory identifiers (CIN, GSTIN, PAN),
              audited financials, ownership cap table, and private document vault.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Deal Room & Actions
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {sellerActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all border ${
                    action.badge
                      ? "bg-[#1557A6] text-white border-[#1557A6] hover:bg-[#104789] font-semibold shadow-xs"
                      : "bg-slate-50 hover:bg-white text-slate-700 hover:text-[#1557A6] border-slate-200 hover:border-[#1557A6] font-medium"
                  }`}
                >
                  <span className="truncate">{action.label}</span>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ml-1.5 ${
                      action.badge ? "text-white/80" : "text-slate-400"
                    }`}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Buyer & Investor Hub */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <Target className="w-4 h-4 text-[#1557A6]" />
                Buyer & Investor Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2.5 py-0.5 rounded-full">
                Active Phase 3
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">
              Acquisition & Investment Mandates
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Create and manage corporate buyout mandates, target financial parameters, sector taxonomy,
              geographic criteria, and upload verified proof of capital to the secure vault.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
              Acquisition Pipeline
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {buyerActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-all border ${
                    action.badge
                      ? "bg-[#0B1F3A] text-white border-[#0B1F3A] hover:bg-[#102B4E] font-semibold shadow-xs"
                      : "bg-slate-50 hover:bg-white text-slate-700 hover:text-[#0B1F3A] border-slate-200 hover:border-[#0B1F3A] font-medium"
                  }`}
                >
                  <span className="truncate">{action.label}</span>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ml-1.5 ${
                      action.badge ? "text-white/80" : "text-slate-400"
                    }`}
                  />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Communication & Notification Hub */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider">
                <Bell className="w-4 h-4 text-[#1557A6]" />
                Communication Hub
              </span>
              <span className="text-[11px] font-semibold text-[#1557A6] bg-[#EEF5FB] px-2.5 py-0.5 rounded-full">
                Active Phase 15
              </span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mb-1.5">
              Notification & Preferences Center
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              View authoritative in-app alerts, transaction milestone notices, escrow token updates, and
              configure delivery preferences across in-app and email channels.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <Link
              href="/notifications"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <Bell className="w-4 h-4" />
              <span>View All Notifications</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        </div>

        {/* Card 4: Staff Diligence Desks OR Trust & Confidentiality */}
        {isStaff ? (
          <div className="bg-white rounded-xl shadow-xs border border-emerald-200 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                  <ClipboardList className="w-4 h-4 text-emerald-600" />
                  Staff Diligence Desks
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  Staff Console
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1.5">
                Verification & Review Consoles
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Review submitted promoter dossiers and institutional buyer acquisition mandates, verify statutory
                records, and record authoritative internal diligence notes.
              </p>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                Verification Consoles
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Link
                  href="/admin/sellers"
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <span>Review Sellers</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                </Link>
                <Link
                  href="/admin/buyers"
                  className="flex items-center justify-between px-3.5 py-2.5 bg-[#0B1F3A] hover:bg-[#102B4E] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <span>Review Buyers</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                </Link>
                <Link
                  href="/admin/opportunities"
                  className="flex items-center justify-between px-3.5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <span>Opportunities</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1 shrink-0" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#1557A6]" />
                  Trust & Confidentiality
                </span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  Enterprise Grade
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-1.5">
                Confidential Deal Ecosystem
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Scale-up India operates on strict bilateral confidentiality. Identifiers and proprietary
                audited figures are shielded by granular RBAC, private document vaults, and audit logs.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Assigned Persona Roles:</span>
              <strong className="text-slate-800">{user.roles.join(", ")}</strong>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: User Profile & Security Meta */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-[#1557A6]" />
            <span>Account Identifiers</span>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">User ID</span>
              <span className="font-mono text-slate-700 break-all">{user.id}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
              <span className="font-medium text-slate-800">{user.email}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Mobile Phone</span>
              <span className="font-medium text-slate-800">{user.phone || "Not provided"}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Member Since</span>
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
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 space-y-4">
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
                className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0B1F3A] text-white shadow-2xs"
              >
                {role}
              </span>
            ))}
          </div>
          <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-100">
            Account Type:{" "}
            <strong className="text-slate-800">
              {user.isInternal ? "Internal Scale-up India Staff" : "External Commercial Entity"}
            </strong>
          </div>
        </div>

        {/* Granular Permissions Card */}
        <div className="bg-white rounded-xl shadow-xs border border-[#D9E2EC] p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F3A] uppercase tracking-wider border-b border-slate-100 pb-3">
            <Key className="w-4 h-4 text-[#1557A6]" />
            <span>Active Permissions ({user.permissions.length})</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
            {user.permissions.map((perm) => (
              <div
                key={perm}
                className="text-[11px] font-mono text-slate-700 bg-slate-50 px-2.5 py-1 rounded border border-slate-100"
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
