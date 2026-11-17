"use client";

import { useEffect, useState, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Send,
  Lock,
  ArrowLeft,
  Building2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DealConversationView, DealMessageView } from "@/types/messaging";

export default function DealMessagingPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { conversationId } = use(params);

  const [conversation, setConversation] = useState<DealConversationView | null>(null);
  const [messages, setMessages] = useState<DealMessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [closing, setClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversationData = async () => {
    try {
      // 1. Fetch conversation details
      const convRes = await fetch(`/api/v1/conversations/${conversationId}`);
      const convJson = await convRes.json();

      if (!convJson.success) {
        setError(convJson.error?.message || "Failed to access deal conversation.");
        setLoading(false);
        return;
      }

      setConversation(convJson.data);

      // 2. Fetch messages
      const msgRes = await fetch(`/api/v1/conversations/${conversationId}/messages?limit=50`);
      const msgJson = await msgRes.json();

      if (msgJson.success) {
        setMessages(msgJson.data.messages);
      }

      // 3. Mark conversation read
      await fetch(`/api/v1/conversations/${conversationId}/read`, { method: "POST" });
    } catch {
      setError("Network communication failure while opening deal messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/deals/${conversationId}/messages`);
      return;
    }
    if (user) {
      loadConversationData();
    }
  }, [user, authLoading, conversationId]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      const json = await res.json();
      if (json.success) {
        setMessages((prev) => [...prev, json.data]);
        setContent("");
      } else {
        setError(json.error?.message || "Failed to deliver message.");
      }
    } catch {
      setError("Network error while sending message.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Are you sure you want to delete this message?")) return;

    try {
      const res = await fetch(
        `/api/v1/conversations/${conversationId}/messages/${messageId}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (json.success) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  status: "SOFT_DELETED",
                  content: "[This message was deleted by the sender]",
                }
              : m
          )
        );
      } else {
        alert(json.error?.message || "Could not delete message.");
      }
    } catch {
      alert("Network error deleting message.");
    }
  };

  const handleCloseConversation = async () => {
    setClosing(true);
    try {
      const res = await fetch(`/api/v1/conversations/${conversationId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closeReason: closeReason.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setConversation(json.data);
        setShowCloseModal(false);
      } else {
        alert(json.error?.message || "Could not close deal conversation.");
      }
    } catch {
      alert("Network failure closing conversation.");
    } finally {
      setClosing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Opening Confidential Deal Room...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Communication Boundary Notice</h2>
          <p className="text-sm text-gray-600 mb-6">{error || "Access Denied."}</p>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1557A6] text-white rounded-lg text-sm font-semibold hover:bg-[#1e4854] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const isClosedOrRevoked = conversation.status === "CLOSED" || conversation.status === "REVOKED";

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col">
      {/* 1. Deal Context & Security Banner */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              title="Return to previous desk"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-gray-900">{conversation.title}</h1>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    conversation.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-800"
                      : conversation.status === "CLOSED"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {conversation.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                <span>Ref: <strong className="font-mono text-gray-700">{conversation.referenceCode}</strong></span>
                <span>•</span>
                <span>Deal: {conversation.opportunityTitle}</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-[#1557A6] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  NDA: {conversation.ndaReference}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadConversationData}
              className="p-2 text-gray-600 hover:text-[#1557A6] hover:bg-gray-50 rounded-lg transition-colors"
              title="Refresh discussion stream"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {conversation.dataRoomId && (
              <Link
                href={
                  conversation.userRole === "BUYER"
                    ? `/buyer/data-room/${conversation.dataRoomId}`
                    : `/seller/data-room/${conversation.dataRoomId}`
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-[#1557A6]" />
                Data Room
              </Link>
            )}

            <Link
              href={
                conversation.userRole === "BUYER"
                  ? `/buyer/mous`
                  : `/seller/mous`
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-amber-700" />
              Deal Intent (MOU)
            </Link>

            {conversation.status === "ACTIVE" && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-xs font-semibold hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors"
              >
                Close Thread
              </button>
            )}
          </div>
        </div>

        {/* Confidentiality Reminder Sub-banner */}
        <div className="bg-[#EEF5FB] border-t border-[#1557A6]/20 px-4 py-1.5 text-center text-xs text-[#1557A6] font-medium flex items-center justify-center gap-2">
          <Lock className="w-3.5 h-3.5" />
          <span>
            Protected Commercial Channel • Communicating with <strong>{conversation.counterpartyLabel}</strong> • Subject to executed bilateral non-disclosure covenants
          </span>
        </div>
      </header>

      {/* 2. Message Stream Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-between">
        <div className="space-y-4 mb-4">
          {messages.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-200 p-8 shadow-xs">
              <Building2 className="w-12 h-12 text-[#1557A6]/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-900">Secure Deal Discussion Opened</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                Both principals have executed the bilateral NDA. You may now securely discuss transaction structures, diligence inquiries, and operational terms.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.isMine;
              const isDeleted = msg.status === "SOFT_DELETED";

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-gray-600">
                      {isMine ? "You" : conversation.counterpartyLabel}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div
                    className={`relative max-w-xl rounded-2xl px-4 py-3 text-sm shadow-xs ${
                      isMine
                        ? "bg-[#1557A6] text-white rounded-tr-none"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-none"
                    } ${isDeleted ? "italic opacity-70" : ""}`}
                  >
                    {/* Safe plain text rendering (immune to XSS / raw HTML injection) */}
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                    {isMine && !isDeleted && conversation.status === "ACTIVE" && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="absolute -left-7 top-3 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete message"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. Composer or Closed Banner */}
        <div className="sticky bottom-4 z-10 pt-2">
          {isClosedOrRevoked ? (
            <div className="bg-gray-100 border border-gray-300 rounded-xl p-4 text-center text-sm text-gray-600 shadow-xs">
              <Lock className="w-5 h-5 text-gray-500 mx-auto mb-1" />
              <p className="font-semibold text-gray-800">
                This deal communication channel is {conversation.status.toLowerCase()}.
              </p>
              {conversation.closeReason && (
                <p className="text-xs text-gray-500 mt-0.5">Reason: {conversation.closeReason}</p>
              )}
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="bg-white border border-gray-200 rounded-2xl shadow-lg p-2.5 flex flex-col gap-2 focus-within:border-[#1557A6] transition-all"
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type your confidential deal message... (Press Enter to send)"
                rows={2}
                maxLength={4000}
                className="w-full resize-none border-0 focus:ring-0 text-sm text-gray-900 placeholder-gray-400 p-2"
                disabled={sending}
              />

              <div className="flex items-center justify-between px-2 pt-1 border-t border-gray-100">
                <span className="text-[11px] text-gray-400">
                  {content.length} / 4000 characters
                </span>

                <button
                  type="submit"
                  disabled={!content.trim() || sending}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#1557A6] text-white rounded-lg text-xs font-semibold hover:bg-[#1e4854] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {sending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Close Conversation Confirmation Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-gray-200">
            <h3 className="text-base font-bold text-gray-900 mb-2">Conclude Deal Discussion</h3>
            <p className="text-xs text-gray-600 mb-4">
              Closing this thread marks the communication as concluded. No further messages can be submitted by either party.
            </p>

            <textarea
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="Optional conclusion note..."
              className="w-full border border-gray-300 rounded-lg p-2.5 text-xs text-gray-800 mb-4 focus:ring-1 focus:ring-[#1557A6] outline-hidden"
              rows={3}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50"
                disabled={closing}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseConversation}
                className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 flex items-center gap-1.5"
                disabled={closing}
              >
                {closing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
