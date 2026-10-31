import React, { useState, useEffect, useRef } from "react";
import { User } from "../types.ts";
import { Lock, UserCog, Check, AlertCircle, Eye, EyeOff, Upload, Camera, Database, Download, ShieldCheck, HardDrive } from "lucide-react";
import { compressAvatar } from "../compressAvatar.ts";

interface AdminMembersPanelProps {
  currentUser: User;
  users: User[];
  onUserUpdate?: () => void;
}

// Admin tab: change any member's photo or password, and download the database
export default function AdminMembersPanel({ currentUser, users, onUserUpdate }: AdminMembersPanelProps) {
  const targetFileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTarget, setSelectedTarget] = useState("Tom");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Feedback states
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Target member avatar upload states
  const [targetAvatarPreview, setTargetAvatarPreview] = useState<string | null>(null);
  const [targetSelectedFile, setTargetSelectedFile] = useState<File | null>(null);
  const [targetDragActive, setTargetDragActive] = useState(false);
  const [targetAvatarLoading, setTargetAvatarLoading] = useState(false);
  const [targetAvatarSuccess, setTargetAvatarSuccess] = useState("");
  const [targetAvatarError, setTargetAvatarError] = useState("");

  useEffect(() => {
    setTargetAvatarPreview(null);
    setTargetSelectedFile(null);
    setTargetAvatarSuccess("");
    setTargetAvatarError("");
  }, [selectedTarget]);

  // Backup statistics for admins
  const [backupStats, setBackupStats] = useState<{
    primaryDbFile?: string;
    automaticBackupFile?: string;
    hasBackup?: boolean;
    backupLastModified?: string | null;
    snapshotCount?: number;
    dbSizeBytes?: number;
    isAutomated?: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/backup/status")
      .then((res) => res.json())
      .then((data) => setBackupStats(data))
      .catch(() => {});
  }, []);


  // Downloads go through fetch so the session token is sent with the request
  const downloadBackupFile = async (query: string) => {
    try {
      const res = await fetch(`/api/admin/backup/download${query}`);
      if (!res.ok) throw new Error("Download failed");
      const filename = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "movie-club-backup.json";
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMsg("Could not download the backup file.");
    }
  };

  const handleDownloadBackup = () => {
    downloadBackupFile("");
  };

  const handleDownloadBak = () => {
    downloadBackupFile("?target=bak");
  };

  const handleTargetFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processTargetFile(file);
    }
  };

  const handleTargetDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setTargetDragActive(true);
    } else if (e.type === "dragleave") {
      setTargetDragActive(false);
    }
  };

  const handleTargetDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTargetDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processTargetFile(file);
    }
  };

  const processTargetFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setTargetAvatarError("Please select an image file (PNG, JPG, WebP, etc.)");
      return;
    }
    setTargetAvatarError("");
    setTargetAvatarSuccess("");
    setTargetSelectedFile(file);

    // Instant preview so the Save button is immediately active and preview is shown
    const quickReader = new FileReader();
    quickReader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setTargetAvatarPreview(dataUrl);
      }
    };
    quickReader.readAsDataURL(file);

    // Crop and compress in background for optimal size
    compressAvatar(file)
      .then((dataUrl) => {
        setTargetAvatarPreview(dataUrl);
      })
      .catch((err) => {
        console.warn("Avatar compression fallback to raw dataUrl", err);
      });
  };

  const handleTargetAvatarUpload = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    let uploadData = targetAvatarPreview;
    // Upload the compressed version even if Save is clicked before background compression finishes
    if (targetSelectedFile) {
      uploadData = await compressAvatar(targetSelectedFile).catch(() => uploadData);
    }
    if (!uploadData && targetSelectedFile) {
      try {
        uploadData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(targetSelectedFile);
        });
      } catch (readErr) {
        setTargetAvatarError("Failed to read image file.");
        return;
      }
    }

    if (!uploadData) {
      setTargetAvatarError("Please select a picture first.");
      return;
    }

    setTargetAvatarLoading(true);
    setTargetAvatarSuccess("");
    setTargetAvatarError("");

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(selectedTarget)}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          avatarUrl: uploadData,
          requester: currentUser.username
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update member profile picture");
      }

      setTargetAvatarSuccess(`Profile picture for ${users.find(u => u.username === selectedTarget)?.name || selectedTarget} saved successfully!`);
      setTargetSelectedFile(null);
      if (onUserUpdate) {
        onUserUpdate();
      }
    } catch (err: any) {
      setTargetAvatarError(err.message || "Something went wrong.");
    } finally {
      setTargetAvatarLoading(false);
    }
  };

  const handleAdminReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!adminNewPassword) {
      setErrorMsg("Please specify a new password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminUsername: currentUser.username,
          targetUsername: selectedTarget,
          newPassword: adminNewPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }

      const targetFull = users.find(u => u.username === selectedTarget);
      setSuccessMsg(`Successfully reset password for ${targetFull?.name || selectedTarget}!`);
      setAdminNewPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to set password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback messages */}
      {successMsg && (
        <div className="mb-4 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 p-3.5 rounded-lg text-xs flex items-center gap-2.5 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 bg-red-950/20 border border-red-900/40 text-red-400 p-3.5 rounded-lg text-xs flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMsg}</span>
        </div>
      )}
      <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 text-amber-500/80 text-[11px] leading-relaxed">
        As a Movie Club Administrator, you can modify any member's profile picture or override their password instantly.
      </div>

      {/* Shared Member Selector */}
      <div className="bg-zinc-900/20 border border-zinc-900 rounded-xl p-4 space-y-2">
        <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Target Club Member
        </label>
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-base md:text-sm cursor-pointer"
        >
          {users.map((user) => (
            <option key={user.username} value={user.username}>
              {user.name} ({user.username}) {user.isAdmin ? "• Admin" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Override Profile Picture */}
      <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold border-b border-zinc-800/60 pb-2 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-amber-500" />
          Override Profile Picture
        </h4>

        <form onSubmit={handleTargetAvatarUpload} className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Preview or Current */}
            <div className="relative group shrink-0 flex flex-col items-center gap-1.5">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/40 bg-zinc-900 flex items-center justify-center relative shadow-md">
                {targetAvatarPreview ? (
                  <img 
                    src={targetAvatarPreview} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : users.find(u => u.username === selectedTarget)?.avatarUrl ? (
                  <img 
                    src={users.find(u => u.username === selectedTarget)?.avatarUrl} 
                    alt="Current Target Profile" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="text-2xl font-bold text-amber-500 uppercase">
                    {users.find(u => u.username === selectedTarget)?.name.substring(0, 2) || "??"}
                  </span>
                )}
                {targetAvatarLoading && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-400 font-medium">
                {targetAvatarPreview ? "New Preview" : "Current Photo"}
              </span>
            </div>

            {/* File Drag zone */}
            <div 
              className={`flex-1 w-full border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                targetDragActive 
                  ? "border-amber-500 bg-amber-500/10" 
                  : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/70"
              }`}
              onDragEnter={handleTargetDrag}
              onDragOver={handleTargetDrag}
              onDragLeave={handleTargetDrag}
              onDrop={handleTargetDrop}
              onClick={(e) => {
                if (e.target !== targetFileInputRef.current) {
                  targetFileInputRef.current?.click();
                }
              }}
            >
              <input 
                type="file" 
                ref={targetFileInputRef} 
                accept="image/*" 
                onClick={(e) => e.stopPropagation()}
                onChange={handleTargetFileChange} 
                className="hidden" 
              />
              <Upload className="w-5 h-5 text-amber-500 mb-1.5" />
              <span className="text-xs font-semibold text-zinc-200">
                {targetSelectedFile ? targetSelectedFile.name : "Choose profile picture or drop here"}
              </span>
              <span className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                Override for {users.find(u => u.username === selectedTarget)?.name || selectedTarget}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  targetFileInputRef.current?.click();
                }}
                className="mt-2.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                Browse Image
              </button>
            </div>
          </div>

          {targetAvatarSuccess && (
            <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-lg flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{targetAvatarSuccess}</span>
            </div>
          )}

          {targetAvatarError && (
            <div className="text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/50 p-3 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{targetAvatarError}</span>
            </div>
          )}

          {/* PROMINENT TARGET SAVE BUTTON SECTION */}
          {targetSelectedFile || targetAvatarPreview ? (
            <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl shadow-lg shadow-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-500/60 shrink-0 bg-zinc-900">
                  {targetAvatarPreview ? (
                    <img src={targetAvatarPreview} alt="Selected preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Camera className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>New Photo Selected for {users.find(u => u.username === selectedTarget)?.name || selectedTarget}</span>
                  </div>
                  <div className="text-xs font-medium text-zinc-200 truncate">
                    {targetSelectedFile?.name || "Photo ready to apply"}
                  </div>
                  {targetSelectedFile && (
                    <div className="text-[10px] text-zinc-400 font-mono">
                      {(targetSelectedFile.size / 1024).toFixed(1)} KB • Ready to save
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setTargetAvatarPreview(null);
                    setTargetSelectedFile(null);
                    setTargetAvatarError("");
                    setTargetAvatarSuccess("");
                  }}
                  disabled={targetAvatarLoading}
                  className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold uppercase rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleTargetAvatarUpload}
                  disabled={targetAvatarLoading}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-ticket text-xs font-black uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {targetAvatarLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                      <span>Saving Member Picture...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Save Member Profile Picture</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <Camera className="w-4 h-4 text-zinc-500" />
                <span>Select a picture to override profile photo for {users.find(u => u.username === selectedTarget)?.name || selectedTarget}</span>
              </div>
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-zinc-900 text-zinc-500 border border-zinc-800/60 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed opacity-60 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                Save Member Picture
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Override Password */}
      <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4">
        <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold border-b border-zinc-800/60 pb-2 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-500" />
          Override Password
        </h4>

        <form onSubmit={handleAdminReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showAdminPass ? "text" : "password"}
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                placeholder="Enter new password for selected member"
                className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-base md:text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowAdminPass(!showAdminPass)}
                className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
              >
                {showAdminPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-zinc-100 hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <UserCog className="w-4 h-4" />
            {loading ? "Overriding Password..." : "Set Member Password"}
          </button>
        </form>
      </div>

      {/* Database Storage & Automatic Backups */}
      <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800/60 pb-2">
          <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-amber-500" />
            Database Storage & Automatic Backups
          </h4>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Auto-Backup Active
          </span>
        </div>

        <div className="text-xs text-zinc-400 leading-relaxed space-y-2">
          <p>
            All member profile photos, movie nights, reviews, ratings, and the email history are stored together in your unified database (<span className="font-mono text-zinc-300">server-db.json</span>).
          </p>
          <p>
            An automatic backup copy (<span className="font-mono text-zinc-300">server-db.json.bak</span>) is created synchronously on every single save, alongside rolling historical snapshots. In the event of an unexpected interruption, the server automatically recovers from the backup.
          </p>
        </div>

        <div className="bg-zinc-950/60 border border-zinc-900 rounded-lg p-3 text-[11px] font-mono text-zinc-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <div className="text-zinc-300 font-semibold flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-500" />
              <span>Database File Path</span>
            </div>
            <div className="text-zinc-500 truncate max-w-xs sm:max-w-md">
              {backupStats?.primaryDbFile || "server-db.json"}
            </div>
          </div>
          {backupStats?.dbSizeBytes ? (
            <span className="text-zinc-400 font-semibold bg-zinc-900 px-2 py-1 rounded border border-zinc-800 shrink-0">
              {(backupStats.dbSizeBytes / 1024).toFixed(1)} KB
            </span>
          ) : null}
        </div>

        <div className="pt-1 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleDownloadBackup}
            className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-amber-500/30 hover:border-amber-500/60 font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download Live Database (.json)
          </button>
          {backupStats?.hasBackup && (
            <button
              type="button"
              onClick={handleDownloadBak}
              className="w-full sm:w-auto px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 font-bold rounded-lg text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Download Auto-Backup (.bak)
            </button>
          )}
        </div>
        <span className="block text-[10px] text-zinc-500">
          Exports complete JSON copies of all movie nights, member avatars, reviews, recaps, and the email history.
        </span>
      </div>
    </div>
  );
}
