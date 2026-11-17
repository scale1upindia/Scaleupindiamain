"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  Bell,
  CheckCheck,
  Shield,
  Briefcase,
  DollarSign,
  FileCheck,
  MessageSquare,
  Sparkles,
  Settings,
  Lock,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { NotificationRecord, NotificationPreferenceRecord } from "@/types/notification";

export default function NotificationCenterPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"ALL" | "UNREAD" | "TRANSACTIONS" | "SECURITY" | "PREFERENCES">("ALL");
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferenceRecord[]>([]);
  const [prefLoading, setPrefLoading] = useState(false);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefMessage, setPrefMessage] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");

      if (activeTab === "UNREAD") {
        params.set("unreadOnly", "true");
      } else if (activeTab === "TRANSACTIONS") {
        params.set("category", "TRANSACTION");
      } else if (activeTab === "SECURITY") {
        params.set("category", "SECURITY");
      }

      const res = await fetch(`/api/v1/notifications?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      if (data.data) {
        setNotifications(data.data.notifications || []);
        setUnreadCount(data.data.unreadCount || 0);
        setTotalCount(data.data.totalCount || 0);
        setTotalPages(data.data.totalPages || 1);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [page, activeTab]);

  const fetchPreferences = useCallback(async () => {
    try {
      setPrefLoading(true);
      const res = await fetch("/api/v1/notifications/preferences");
      if (!res.ok) throw new Error("Failed to load preferences");
      const data = await res.json();
      if (data.data?.preferences) {
        setPreferences(data.data.preferences);
      }
    } catch (err) {
      console.error("Error fetching preferences:", err);
    } finally {
      setPrefLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (activeTab === "PREFERENCES") {
        fetchPreferences();
      } else {
        fetchNotifications();
      }
    }
  }, [user, activeTab, page, fetchNotifications, fetchPreferences]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/v1/notifications/read-all", { method: "POST" });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
        );
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleTogglePref = (category: string, channel: string, current: boolean, isMandatory: boolean) => {
    if (isMandatory) return; // Cannot toggle mandatory
    setPreferences((prev) =>
      prev.map((p) =>
        p.category === category && p.channel === channel ? { ...p, isEnabled: !current } : p
      )
    );
  };

  const handleSavePreferences = async () => {
    try {
      setPrefSaving(true);
      setPrefMessage(null);
      const payload = {
        preferences: preferences.map((p) => ({
          category: p.category,
          channel: p.channel,
          isEnabled: p.isEnabled,
        })),
      };
      const res = await fetch("/api/v1/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to update preferences");
      }
      setPrefMessage("Notification preferences successfully saved.");
      setTimeout(() => setPrefMessage(null), 4000);
    } catch (err: any) {
      setPrefMessage(err.message || "Failed to save preferences.");
    } finally {
      setPrefSaving(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "SECURITY":
        return <Shield className="w-4 h-4 text-rose-600" />;
      case "TRANSACTION":
        return <Briefcase className="w-4 h-4 text-[#1557A6]" />;
      case "PAYMENT":
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
      case "DILIGENCE":
        return <FileCheck className="w-4 h-4 text-amber-600" />;
      case "MESSAGING":
        return <MessageSquare className="w-4 h-4 text-[#2878C8]" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600" />;
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
    <div className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#EEF5FB] text-[#1557A6] flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Notification Center</h1>
              <p className="text-xs text-slate-600">
                Authoritative transactional alerts, deal updates, and delivery preferences
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {unreadCount > 0 && activeTab !== "PREFERENCES" && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1557A6] hover:bg-[#EEF5FB] bg-slate-50 border border-[#D9E2EC] rounded-md transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}
          <button
            onClick={() => (activeTab === "PREFERENCES" ? fetchPreferences() : fetchNotifications())}
            title="Refresh"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveTab("ALL"); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "ALL"
              ? "border-[#1557A6] text-[#1557A6] bg-white"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>All Notifications</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full font-mono">{totalCount}</span>
        </button>

        <button
          onClick={() => { setActiveTab("UNREAD"); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "UNREAD"
              ? "border-[#1557A6] text-[#1557A6] bg-white"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <span>Unread</span>
          {unreadCount > 0 && (
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-mono font-bold">
              {unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab("TRANSACTIONS"); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "TRANSACTIONS"
              ? "border-[#1557A6] text-[#1557A6] bg-white"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Transactions</span>
        </button>

        <button
          onClick={() => { setActiveTab("SECURITY"); setPage(1); }}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "SECURITY"
              ? "border-[#1557A6] text-[#1557A6] bg-white"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>Security</span>
        </button>

        <button
          onClick={() => setActiveTab("PREFERENCES")}
          className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ml-auto ${
            activeTab === "PREFERENCES"
              ? "border-[#1557A6] text-[#1557A6] bg-white"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Preferences</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === "PREFERENCES" ? (
        <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-6 sm:p-8">
          <div className="mb-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#1557A6]" />
              <span>Channel Delivery Preferences</span>
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Configure communication channels for transactional events. Critical security and transaction closing notices are legally mandatory and cannot be disabled.
            </p>
          </div>

          {prefMessage && (
            <div
              className={`p-3 rounded-lg text-xs font-semibold mb-6 flex items-center gap-2 ${
                prefMessage.includes("success")
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-rose-50 text-rose-800 border border-rose-200"
              }`}
            >
              {prefMessage.includes("success") ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{prefMessage}</span>
            </div>
          )}

          {prefLoading ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#1557A6]" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto border border-[#D9E2EC] rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider border-b border-[#D9E2EC]">
                    <tr>
                      <th className="py-3 px-4">Event Category</th>
                      <th className="py-3 px-4">Classification</th>
                      <th className="py-3 px-4 text-center">In-App Notification</th>
                      <th className="py-3 px-4 text-center">Email Notification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D9E2EC]">
                    {["SECURITY", "TRANSACTION", "PAYMENT", "DILIGENCE", "DEAL_ACTIVITY", "MESSAGING", "MARKETING_INFORMATIONAL"].map(
                      (cat) => {
                        const inAppPref = preferences.find((p) => p.category === cat && p.channel === "IN_APP");
                        const emailPref = preferences.find((p) => p.category === cat && p.channel === "EMAIL");
                        const isMandatory = inAppPref?.isMandatory || emailPref?.isMandatory;

                        return (
                          <tr key={cat} className="hover:bg-slate-50/50">
                            <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2">
                              {getCategoryIcon(cat)}
                              <span>{cat.replace("_", " ")}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              {isMandatory ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  <Lock className="w-3 h-3 text-amber-600" />
                                  Mandatory (Compliance)
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                                  Configurable
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <label className="inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={inAppPref?.isEnabled ?? true}
                                  disabled={Boolean(isMandatory)}
                                  onChange={() =>
                                    handleTogglePref(cat, "IN_APP", inAppPref?.isEnabled ?? true, Boolean(isMandatory))
                                  }
                                  className="w-4 h-4 rounded text-[#1557A6] focus:ring-[#1557A6] disabled:opacity-50"
                                />
                              </label>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <label className="inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={emailPref?.isEnabled ?? true}
                                  disabled={Boolean(isMandatory)}
                                  onChange={() =>
                                    handleTogglePref(cat, "EMAIL", emailPref?.isEnabled ?? true, Boolean(isMandatory))
                                  }
                                  className="w-4 h-4 rounded text-[#1557A6] focus:ring-[#1557A6] disabled:opacity-50"
                                />
                              </label>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  onClick={handleSavePreferences}
                  disabled={prefSaving}
                  className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#1557A6] hover:bg-[#104789] rounded-md shadow transition-colors disabled:opacity-50"
                >
                  {prefSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{prefSaving ? "Saving Preferences..." : "Save Preferences"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Notifications List */
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1557A6]" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-[#D9E2EC] p-12 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No Notifications</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                You are all caught up. New transaction milestones, diligence requests, and security alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                className={`bg-white rounded-xl shadow-sm border transition-all p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  notif.isRead
                    ? "border-[#D9E2EC] text-slate-700 bg-white"
                    : "border-[#1557A6]/30 bg-[#EEF5FB]/40 ring-1 ring-[#1557A6]/20"
                }`}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                    {getCategoryIcon(notif.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold text-[#1557A6] bg-[#EEF5FB] px-2 py-0.5 rounded border border-[#D9E2EC]">
                        {notif.category}
                      </span>
                      {notif.severity === "CRITICAL" && (
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          CRITICAL
                        </span>
                      )}
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#12B76A]" title="Unread" />
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(notif.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900 mt-1">{notif.title}</h4>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{notif.safeBody}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 sm:self-center">
                  {notif.actionUrl && (
                    <Link
                      href={notif.actionUrl}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#1557A6] hover:bg-[#104789] rounded shadow-sm transition-colors"
                    >
                      <span>{notif.actionType ? notif.actionType.replace("_", " ") : "View Details"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  )}

                  {!notif.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4 text-slate-500" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 text-xs font-semibold rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
