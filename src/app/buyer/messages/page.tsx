"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  ShieldCheck,
  Building2,
  Clock,
  ArrowRight,
  Loader2,
  AlertCircle,
  Inbox,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DealConversationView } from "@/types/messaging";

export default function BuyerMessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [conversations, setConversations] = useState<DealConversationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/conversations");
      const json = await res.json();
      if (json.success) {
        setConversations(json.data.items);
      } else {
        setError(json.error?.message || "Failed to load deal conversations.");
      }
    } catch {
      setError("Network communication failure.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/buyer/messages");
      return;
    }
    if (user) {
      fetchConversations();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading Deal Communications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-[#1557A6]" />
              Confidential Deal Messages
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Bilateral diligence communication threads for your executed acquisitions
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-[#1557A6] hover:underline"
          >
            ← Return to Dashboard
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {conversations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-xs">
            <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-900">No Deal Discussions Yet</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
              Deal discussion threads become active once both you and the promoter execute the bilateral Non-Disclosure Agreement.
            </p>
            <Link
              href="/buyer/ndas"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1557A6] text-white rounded-lg text-xs font-semibold hover:bg-[#1e4854] transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              View NDA Portfolio
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/deals/${conv.id}/messages`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-[#1557A6] hover:shadow-md transition-all group"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#1557A6] bg-[#1557A6]/10 px-2 py-0.5 rounded">
                      {conv.referenceCode}
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#1557A6] transition-colors">
                      {conv.opportunityTitle}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {conv.unreadCount > 0 && (
                      <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {conv.unreadCount} new
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        conv.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 mb-3 line-clamp-1">
                  {conv.lastMessageSnippet ? (
                    <span>Last message: {conv.lastMessageSnippet}</span>
                  ) : (
                    <span className="text-gray-400 italic">No messages sent yet.</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-gray-100 pt-3">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    With {conv.counterpartyLabel}
                  </span>
                  <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform font-medium text-[#1557A6]">
                    Open Discussion <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
