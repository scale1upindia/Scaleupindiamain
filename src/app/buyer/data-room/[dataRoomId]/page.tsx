"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  Download,
  Clock,
  AlertCircle,
  Loader2,
  Lock,
  Building2,
  FolderLock,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DataRoomView, DataRoomDocumentView } from "@/types/nda";

export default function BuyerDataRoomPage({
  params,
}: {
  params: Promise<{ dataRoomId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { dataRoomId } = use(params);

  const [room, setRoom] = useState<DataRoomView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Download state
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  const fetchDataRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/data-rooms/${dataRoomId}`);
      const json = await res.json();
      if (json.success) {
        setRoom(json.data);
      } else {
        setError(json.error?.message || "Failed to access Data Room.");
      }
    } catch {
      setError("Network communication failure while opening Secure Data Room.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/buyer/data-room/${dataRoomId}`);
    } else if (user) {
      fetchDataRoom();
    }
  }, [user, authLoading, dataRoomId]);

  const handleDownload = async (doc: DataRoomDocumentView) => {
    setDownloadingDocId(doc.id);
    setDownloadSuccessMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/data-rooms/${dataRoomId}/documents/${doc.id}/signed-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expiresInSeconds: 300 }),
        }
      );
      const json = await res.json();
      if (json.success && json.data.downloadUrl) {
        // Trigger browser download via signed URL
        const a = document.createElement("a");
        a.href = json.data.downloadUrl;
        a.download = doc.originalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setDownloadSuccessMessage(
          `Signed download link authorized for "${doc.title}". Valid for 5 minutes.`
        );
      } else {
        setError(json.error?.message || "Failed to generate signed download authorization.");
      }
    } catch {
      setError("Network failure while requesting document download authorization.");
    } finally {
      setDownloadingDocId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#1557A6] animate-spin" />
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center space-y-4">
          <FolderLock className="w-10 h-10 text-red-600 mx-auto" />
          <h2 className="text-lg font-bold text-red-950">Data Room Access Restricted</h2>
          <p className="text-xs text-red-700 max-w-md mx-auto leading-relaxed">{error}</p>
          <div className="pt-2">
            <Link
              href="/buyer/eois"
              className="inline-block px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow"
            >
              Return to EOI Portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const filteredDocs =
    categoryFilter === "ALL"
      ? room.documents
      : room.documents.filter((d) => d.documentCategory === categoryFilter);

  const categories = [
    "ALL",
    "FINANCIAL",
    "TAX",
    "LEGAL",
    "CORPORATE",
    "OPERATIONAL",
    "COMMERCIAL",
    "HR",
    "TECHNICAL",
    "OTHER",
  ];

  return (
    <div className="flex-1 bg-[#F7F9FC] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/buyer/eois" className="hover:text-slate-800">
            EOI Portfolio
          </Link>
          <span>/</span>
          <Link href={`/buyer/nda/${room.ndaId}`} className="hover:text-slate-800">
            {room.ndaReference}
          </Link>
          <span>/</span>
          <span className="font-mono text-slate-700">{room.referenceCode}</span>
        </div>

        {/* Room Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-bold bg-[#1557A6]/10 text-[#1557A6] px-2.5 py-1 rounded">
                  {room.referenceCode}
                </span>
                <span className="text-xs text-slate-400">•</span>
                <span className="text-xs text-slate-500">
                  Target Listing:{" "}
                  <strong className="text-slate-900">{room.opportunityTitle}</strong> (
                  {room.opportunityReference})
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                Secure Virtual Data Room (VDR)
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Authorized diligence room governed under bilateral NDA{" "}
                <Link
                  href={`/buyer/nda/${room.ndaId}`}
                  className="font-bold text-[#1557A6] hover:underline"
                >
                  {room.ndaReference}
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/v1/opportunities/${room.opportunityId}/conversations`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ndaId: room.ndaId }),
                    });
                    const json = await res.json();
                    if (json.success) {
                      router.push(`/deals/${json.data.id}/messages`);
                    } else {
                      alert(json.error?.message || "Could not open deal discussion.");
                    }
                  } catch {
                    alert("Network error opening discussion.");
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg hover:bg-[#1e4854] transition-colors"
              >
                <span>Deal Messages</span>
              </button>
              <Link
                href="/buyer/mous"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
              >
                <span>Deal Intent (MOU)</span>
              </Link>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-full">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{room.status}</span>
              </div>
            </div>
          </div>

          {/* Confidentiality Reminder Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="space-y-0.5 leading-relaxed">
              <span className="font-bold block">Strict Confidentiality Enforced</span>
              <p className="text-amber-900">
                All document views, cryptographic download tokens, and IP addresses are audited in an immutable ledger under NDA covenants. Redistribution or unauthorized retention of files is strictly prohibited.
              </p>
            </div>
          </div>

          {downloadSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccessMessage}</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-b border-slate-100 pb-4 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  categoryFilter === cat
                    ? "bg-[#1557A6] text-white shadow"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Document Table / Cards */}
          {filteredDocs.length === 0 ? (
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-2">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Documents in this Category</h3>
              <p className="text-xs text-slate-500">
                The promoter has not yet published files under the &quot;{categoryFilter}&quot; category.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 px-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{doc.title}</span>
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                        {doc.documentCategory}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>{doc.originalFilename}</span>
                      <span>•</span>
                      <span>{(doc.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                      <span>•</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownload(doc)}
                    disabled={downloadingDocId === doc.id}
                    className="px-4 py-2 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow inline-flex items-center justify-center gap-2 shrink-0 disabled:opacity-50 transition-colors"
                  >
                    {downloadingDocId === doc.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Download via Signed Token</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
