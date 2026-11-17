"use client";

import { useEffect, useState, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  FileText,
  Upload,
  Download,
  Trash2,
  Clock,
  AlertCircle,
  Loader2,
  Lock,
  Plus,
  FolderLock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DataRoomView, DataRoomDocumentView, DataRoomDocumentCategory } from "@/types/nda";

export default function SellerDataRoomPage({
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

  // Upload modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<DataRoomDocumentCategory>("FINANCIAL");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download & Delete states
  const [actionDocId, setActionDocId] = useState<string | null>(null);

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
      router.push(`/login?redirect=/seller/data-room/${dataRoomId}`);
    } else if (user) {
      fetchDataRoom();
    }
  }, [user, authLoading, dataRoomId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !uploadTitle) {
      setError("Please provide a title and select a document file.");
      return;
    }

    setUploadLoading(true);
    setError(null);
    setUploadSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", uploadTitle);
      formData.append("documentCategory", uploadCategory);
      formData.append("accessLevel", "ROOM_MEMBER");

      const res = await fetch(`/api/v1/data-rooms/${dataRoomId}/documents`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success) {
        setShowUploadModal(false);
        setUploadTitle("");
        setSelectedFile(null);
        setUploadSuccessMessage("Document uploaded securely to Data Room.");
        await fetchDataRoom();
      } else {
        setError(json.error?.message || "Failed to upload document.");
      }
    } catch {
      setError("Network communication failure during file upload.");
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDownload = async (doc: DataRoomDocumentView) => {
    setActionDocId(doc.id);
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
        const a = document.createElement("a");
        a.href = json.data.downloadUrl;
        a.download = doc.originalFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        setError(json.error?.message || "Failed to generate signed download token.");
      }
    } catch {
      setError("Network error while requesting document download.");
    } finally {
      setActionDocId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to remove this document from the Data Room?")) return;
    setActionDocId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/data-rooms/${dataRoomId}/documents/${docId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        await fetchDataRoom();
      } else {
        setError(json.error?.message || "Failed to delete document.");
      }
    } catch {
      setError("Network failure while deleting document.");
    } finally {
      setActionDocId(null);
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
              href="/seller/ndas"
              className="inline-block px-5 py-2.5 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow"
            >
              Return to NDA Inbox
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
          <Link href="/seller/ndas" className="hover:text-slate-800">
            NDA Inbox
          </Link>
          <span>/</span>
          <Link href={`/seller/nda/${room.ndaId}`} className="hover:text-slate-800">
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
                Data Room Document Management
              </h1>
              <p className="text-xs text-slate-600 mt-1">
                Manage confidential diligence files accessible to verified acquirer under NDA{" "}
                <Link
                  href={`/seller/nda/${room.ndaId}`}
                  className="font-bold text-[#1557A6] hover:underline"
                >
                  {room.ndaReference}
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-3">
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
                className="px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors"
              >
                <span>Deal Messages</span>
              </button>
              <Link
                href="/seller/mous"
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow-xs inline-flex items-center gap-2 transition-colors"
              >
                <span>Deal Intent (MOU)</span>
              </Link>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow inline-flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Upload Document</span>
              </button>
            </div>
          </div>

          {uploadSuccessMessage && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{uploadSuccessMessage}</span>
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
            <div className="bg-slate-50 rounded-xl border border-dashed border-slate-300 p-12 text-center space-y-4">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Documents in this Category</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload audited financials, corporate records, or operational documents for the acquirer.
              </p>
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 bg-[#1557A6] text-white text-xs font-bold rounded-lg shadow"
              >
                Upload First File
              </button>
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
                      <span>{doc.downloadCount} downloads</span>
                      <span>•</span>
                      <span>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={actionDocId === doc.id}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
                    >
                      {actionDocId === doc.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Download</span>
                    </button>

                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={actionDocId === doc.id}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleUpload}
            className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Upload Diligence Document</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Document Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FY24 Audited Balance Sheet & P&L"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-[#1557A6] focus:border-[#1557A6]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Category *</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DataRoomDocumentCategory)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs focus:ring-[#1557A6] focus:border-[#1557A6]"
                >
                  <option value="FINANCIAL">Financial (Audited accounts, tax returns, forecasts)</option>
                  <option value="TAX">Tax (GST, IT returns, assessments)</option>
                  <option value="LEGAL">Legal (Contracts, licenses, litigation filings)</option>
                  <option value="CORPORATE">Corporate (MOA, AOA, board resolutions, cap table)</option>
                  <option value="OPERATIONAL">Operational (Plant, equipment, vendor agreements)</option>
                  <option value="COMMERCIAL">Commercial (Key client contracts, order book)</option>
                  <option value="HR">HR (Key personnel, employment policies, agreements)</option>
                  <option value="TECHNICAL">Technical (Patents, IP, system architecture)</option>
                  <option value="OTHER">Other Diligence Documentation</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select File (PDF, PNG, JPEG $\le$ 15MB) *</label>
                <input
                  type="file"
                  required
                  ref={fileInputRef}
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#1557A6] file:text-white hover:file:bg-[#104789]"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Files are validated for magic-bytes, hashed with SHA-256, and kept in private encrypted storage.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploadLoading || !selectedFile || !uploadTitle}
                className="px-5 py-2.5 bg-[#1557A6] hover:bg-[#104789] text-white text-xs font-bold rounded-lg shadow disabled:opacity-50 inline-flex items-center gap-2"
              >
                {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>Upload to Data Room</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
