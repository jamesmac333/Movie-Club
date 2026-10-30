import React, { useState, useEffect } from "react";
import { User, EdmRecipient, EdmLog } from "../types.ts";
import { 
  Mail, 
  Send, 
  Plus, 
  Trash2, 
  Check, 
  AlertCircle, 
  Clock, 
  Sparkles, 
  RefreshCw, 
  Eye, 
  X, 
  Users, 
  Film, 
  BookOpen, 
  CheckCircle2, 
  ShieldCheck 
} from "lucide-react";

interface EdmAdminManagerProps {
  currentUser: User;
}

export default function EdmAdminManager({ currentUser }: EdmAdminManagerProps) {
  const [recipients, setRecipients] = useState<EdmRecipient[]>([]);
  const [logs, setLogs] = useState<EdmLog[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");

  useEffect(() => {
    fetchEdmData();
  }, []);

  const parseResponse = async (res: Response) => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    const rawText = await res.text();
    if (!res.ok) {
      if (rawText.includes("Cannot POST") || rawText.includes("Cannot GET") || res.status === 404) {
        throw new Error(
          "Cloud Run backend does not have the EDM endpoints yet (HTTP 404). Please redeploy your backend to Google Cloud Run by running ./deploy.sh from your terminal."
        );
      }
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    throw new Error("Received non-JSON response from server.");
  };

  const fetchEdmData = async () => {
    try {
      const res = await fetch("/api/edm");
      if (res.ok) {
        const data = await parseResponse(res);
        setRecipients(data.recipients || []);
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load EDM data", err);
    }
  };

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!newEmail.trim() || !newEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/edm/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          name: newName.trim(),
          requester: currentUser.username
        })
      });

      const data = await parseResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to add email address.");
      }

      setRecipients(data.recipients || []);
      setNewEmail("");
      setNewName("");
      setSuccessMsg("Recipient added to EDM distribution list!");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add email address.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRecipient = async (emailToRemove: string) => {
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/edm/recipients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailToRemove,
          requester: currentUser.username
        })
      });

      const data = await parseResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove recipient.");
      }

      setRecipients(data.recipients || []);
      setSuccessMsg("Recipient removed from distribution list.");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to remove recipient.");
    }
  };

  const handleSendTestEdm = async () => {
    setSuccessMsg("");
    setErrorMsg("");
    setTestSending(true);

    try {
      const res = await fetch("/api/edm/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester: currentUser.username
        })
      });

      const data = await parseResponse(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to send test EDM.");
      }

      setSuccessMsg(data.message || "Test EDM broadcast sent successfully!");
      if (data.logs) {
        setLogs(data.logs);
      } else {
        await fetchEdmData();
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dispatch test EDM.");
    } finally {
      setTestSending(false);
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString("en-NZ", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Overview Notice */}
      <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 sm:p-5 flex items-start gap-3">
        <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl shrink-0 mt-0.5">
          <Mail className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="font-serif font-bold text-zinc-100 text-sm flex items-center gap-2">
            Automated EDM System Dispatches
            <span className="text-[10px] font-mono bg-amber-500 text-zinc-950 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Live
            </span>
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            EDMs are automatically generated and broadcast directly to club members whenever:
          </p>
          <ul className="text-xs text-zinc-300 space-y-1 list-disc list-inside pt-1">
            <li>
              <strong className="text-amber-400">Night Overview is published:</strong> sends the full session chronicle with gathering photo, featured movie details, and top review pick.
            </li>
            <li>
              <strong className="text-amber-400">Next movie is selected:</strong> sends the "Curtain Rises" announcement with poster, director, runtime, and date reminder so people don't have to be on site.
            </li>
          </ul>
        </div>
      </div>

      {/* Feedback alerts */}
      {successMsg && (
        <div className="bg-emerald-950/30 border border-emerald-900/60 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/30 border border-red-900/60 text-red-400 p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Recipient Management Section */}
      <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs uppercase tracking-widest font-bold text-zinc-300">
              Distribution List ({recipients.length})
            </h4>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            Admins: James & Ash
          </span>
        </div>

        {/* Add new recipient input */}
        <form onSubmit={handleAddRecipient} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
          <div className="sm:col-span-6">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="member@example.com"
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-amber-500 font-mono"
            />
          </div>
          <div className="sm:col-span-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. Tom Sakai)"
              className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3.5 py-2.5 text-base focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-full py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-ticket text-xs font-bold uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/10"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </form>

        {/* Existing recipients list */}
        <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
          {recipients.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-2 text-center">
              No recipients added yet. Add an email above to start receiving EDM blasts!
            </p>
          ) : (
            recipients.map((rec) => (
              <div 
                key={rec.email}
                className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800/60 rounded-xl px-3.5 py-2.5 text-xs transition-colors hover:border-zinc-700"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-200 block truncate">
                      {rec.name ? `${rec.name} ` : ""}
                      <span className="font-mono text-zinc-400 font-normal">({rec.email})</span>
                    </span>
                    {rec.addedAt && (
                      <span className="text-[10px] text-zinc-500 font-mono block">
                        Added {formatDate(rec.addedAt)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec.email)}
                  className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                  title="Remove from distribution list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Test EDM Dispatch Button Section */}
      <div className="bg-gradient-to-r from-zinc-900/70 via-zinc-900/40 to-zinc-900/70 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="space-y-1 text-center sm:text-left">
          <h4 className="text-xs uppercase tracking-widest font-bold text-zinc-200 flex items-center justify-center sm:justify-start gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            EDM Dispatch Test Transmission
          </h4>
          <p className="text-xs text-zinc-400">
            Sends a formatted diagnostic EDM to all {recipients.length} registered recipient(s) to confirm pipeline health.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSendTestEdm}
          disabled={testSending || recipients.length === 0}
          className="w-full sm:w-auto px-5 py-2.5 bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 text-xs font-bold uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-white/5 shrink-0"
        >
          {testSending ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Dispatching Test...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 text-zinc-950" />
              Send EDM Test
            </>
          )}
        </button>
      </div>

      {/* Recent Dispatches & Activity Log */}
      <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <h4 className="text-xs uppercase tracking-widest font-bold text-zinc-300">
              Transmission History ({logs.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={fetchEdmData}
            className="text-[10px] font-mono text-zinc-500 hover:text-zinc-300 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-zinc-500 italic py-3 text-center">
              No EDMs dispatched yet. Trigger one with the test button or by choosing a movie!
            </p>
          ) : (
            logs.map((log) => {
              const isOverview = log.type === "overview";
              const isMovie = log.type === "movie_selection";
              const isTest = log.type === "test";

              return (
                <div
                  key={log.id}
                  className="bg-zinc-950/70 border border-zinc-800/70 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 sm:mt-0 ${
                      isOverview 
                        ? "bg-amber-500/10 text-amber-400" 
                        : isMovie 
                        ? "bg-purple-500/10 text-purple-400" 
                        : "bg-emerald-500/10 text-emerald-400"
                    }`}>
                      {isOverview ? (
                        <BookOpen className="w-3.5 h-3.5" />
                      ) : isMovie ? (
                        <Film className="w-3.5 h-3.5" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-zinc-200 truncate">
                          {log.subject}
                        </span>
                        <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${
                          log.status === "sent" 
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40" 
                            : log.status === "simulated"
                            ? "bg-blue-950/60 text-blue-400 border border-blue-800/40"
                            : "bg-red-950/60 text-red-400 border border-red-800/40"
                        }`}>
                          {log.status === "simulated" ? "Dispatched (Sim)" : log.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {formatDate(log.sentAt)} • {log.recipients.length} recipient(s)
                      </div>
                    </div>
                  </div>

                  {log.htmlContent && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewHtml(log.htmlContent || null);
                        setPreviewTitle(log.subject);
                      }}
                      className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-[10px] font-mono uppercase rounded-lg border border-zinc-800 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    >
                      <Eye className="w-3 h-3" />
                      Inspect HTML
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* HTML Modal Preview */}
      {previewHtml && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewHtml(null)}
        >
          <div 
            className="bg-[#182221] border border-amber-500/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold">
                  EDM HTML Preview
                </span>
                <h4 className="font-bold text-zinc-100 text-sm truncate max-w-md">
                  {previewTitle}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewHtml(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-[#080808] p-2">
              <iframe
                title="EDM Preview"
                srcDoc={previewHtml}
                className="w-full h-[600px] border-0 rounded-xl"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
