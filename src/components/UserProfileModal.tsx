import React, { useState, useEffect } from "react";
import { User, MOVIE_CLUB_USERS } from "../types.ts";
import { Lock, KeyRound, UserCog, Check, AlertCircle, Eye, EyeOff, Upload, Camera, Image, X } from "lucide-react";

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  users?: User[];
  onUserUpdate?: () => void;
}

export default function UserProfileModal({ currentUser, onClose, users = MOVIE_CLUB_USERS, onUserUpdate }: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"personal" | "admin">("personal");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Admin states
  const [selectedTarget, setSelectedTarget] = useState("Tom");
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [showAdminPass, setShowAdminPass] = useState(false);

  // Feedback states
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // Avatar upload states
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarSuccess, setAvatarSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");

  const dbUser = (users || []).find(u => u.username.toLowerCase() === currentUser.username.toLowerCase());
  const currentAvatarUrl = dbUser?.avatarUrl || currentUser.avatarUrl;
  const isAdmin = currentUser.isAdmin || currentUser.username.toLowerCase() === "james" || currentUser.username.toLowerCase() === "ash";

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
      setTargetAvatarError("Please select an image file (PNG, JPG, etc.)");
      return;
    }
    setTargetAvatarError("");
    setTargetAvatarSuccess("");
    setTargetSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setTargetAvatarPreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTargetAvatarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAvatarPreview) return;

    setTargetAvatarLoading(true);
    setTargetAvatarSuccess("");
    setTargetAvatarError("");

    try {
      const response = await fetch(`/api/users/${selectedTarget}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          avatarUrl: targetAvatarPreview,
          requester: currentUser.username
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update member profile picture");
      }

      setTargetAvatarSuccess("Member profile picture updated successfully!");
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file (PNG, JPG, etc.)");
      return;
    }
    setAvatarError("");
    setAvatarSuccess("");
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarPreview(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!avatarPreview) return;

    const isAdmin = currentUser.isAdmin || currentUser.username.toLowerCase() === "james" || currentUser.username.toLowerCase() === "ash";
    if (!isAdmin) {
      setAvatarError("Only administrators can change profile pictures.");
      return;
    }

    setAvatarLoading(true);
    setAvatarSuccess("");
    setAvatarError("");

    try {
      const response = await fetch(`/api/users/${currentUser.username}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          avatarUrl: avatarPreview,
          requester: currentUser.username
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload avatar");
      }

      setAvatarSuccess("Profile picture updated successfully!");
      setSelectedFile(null);
      if (onUserUpdate) {
        onUserUpdate();
      }
    } catch (err: any) {
      setAvatarError(err.message || "Something went wrong.");
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleSelfReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (!newPassword) {
      setErrorMsg("Password cannot be empty.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser.username,
          newPassword: newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update password");
      }

      setSuccessMsg("Your password has been changed successfully!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
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
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0d0d0d] border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] sm:max-h-[85vh] overflow-hidden shadow-2xl flex flex-col cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-zinc-100">Credentials Manager</h3>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Account Security & Resets</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher if admin */}
        {isAdmin && (
          <div className="flex border-b border-zinc-900 bg-zinc-950/40">
            <button
              onClick={() => { setActiveTab("personal"); setSuccessMsg(""); setErrorMsg(""); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === "personal"
                  ? "text-amber-500 border-b-2 border-amber-500 bg-amber-500/[0.02]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              Reset My Password
            </button>
            <button
              onClick={() => { setActiveTab("admin"); setSuccessMsg(""); setErrorMsg(""); }}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "admin"
                  ? "text-amber-500 border-b-2 border-amber-500 bg-amber-500/[0.02]"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <UserCog className="w-3.5 h-3.5" />
              Admin Controls
            </button>
          </div>
        )}

        <div className="p-6 flex-1 overflow-y-auto">
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

          {activeTab === "personal" ? (
            <div className="space-y-6">
              {/* Profile Picture Manual Upload Section */}
              <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4">
                <h4 className="text-xs uppercase tracking-widest text-zinc-400 font-bold border-b border-zinc-800/60 pb-2 flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-amber-500" />
                  Profile Picture
                </h4>

                <form onSubmit={handleAvatarUpload} className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {/* Current or Preview Image */}
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/30 bg-zinc-900 flex items-center justify-center relative">
                        {avatarPreview ? (
                          <img 
                            src={avatarPreview} 
                            alt="Preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : currentAvatarUrl ? (
                          <img 
                            src={currentAvatarUrl} 
                            alt="Current Profile" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="text-2xl font-bold text-amber-500 uppercase">{currentUser.name.substring(0, 2)}</span>
                        )}
                        {avatarLoading && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* File Dropzone / Picker */}
                    {isAdmin ? (
                      <div 
                        className={`flex-1 w-full border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                          dragActive 
                            ? "border-amber-500 bg-amber-500/5" 
                            : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
                        }`}
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById("avatar-file-input")?.click()}
                      >
                        <input 
                          type="file" 
                          id="avatar-file-input" 
                          accept="image/*" 
                          onChange={handleFileChange} 
                          className="hidden" 
                        />
                        <Upload className="w-5 h-5 text-zinc-500 mb-1.5" />
                        <span className="text-xs font-semibold text-zinc-300">
                          {selectedFile ? selectedFile.name : "Choose an image or drop here"}
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                          Raw Upload • No AI enhancement applied
                        </span>
                      </div>
                    ) : (
                      <div className="flex-1 w-full border border-zinc-800/80 rounded-xl p-4 bg-zinc-950/30 flex flex-col items-center justify-center text-center">
                        <Lock className="w-5 h-5 text-zinc-600 mb-1.5" />
                        <span className="text-xs font-semibold text-zinc-400">Profile Picture Locked</span>
                        <span className="text-[10px] text-zinc-500 mt-1 leading-relaxed max-w-[240px]">
                          Only administrators (James or Ash) are authorized to modify profile pictures.
                        </span>
                      </div>
                    )}
                  </div>

                  {avatarSuccess && (
                    <p className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded-lg flex items-center gap-1.5 font-mono">
                      <span>✓ {avatarSuccess}</span>
                    </p>
                  )}

                  {avatarError && (
                    <p className="text-[11px] font-semibold text-red-400 bg-red-950/10 border border-red-900/30 p-2.5 rounded-lg flex items-center gap-1.5 font-mono">
                      <span>⚠️ {avatarError}</span>
                    </p>
                  )}

                  {avatarPreview && (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview(null);
                          setSelectedFile(null);
                          setAvatarError("");
                          setAvatarSuccess("");
                        }}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase rounded-lg border border-zinc-800/80 transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        disabled={avatarLoading}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 text-xs font-bold uppercase rounded-lg shadow-lg shadow-amber-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        {avatarLoading ? "Saving..." : "Save Picture"}
                      </button>
                    </div>
                  )}
                </form>
              </div>

              {/* Account details and Password reset section */}
              <div className="border-t border-zinc-900 pt-6">
                <form onSubmit={handleSelfReset} className="space-y-4">
                  <div className="p-3.5 bg-zinc-900/20 border border-zinc-900/60 rounded-xl">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">Logged In As</span>
                    <span className="text-sm font-semibold text-zinc-100">{currentUser.name}</span>
                    <span className="text-xs text-zinc-400 block mt-0.5">Username: <span className="font-mono text-amber-500">{currentUser.username}</span></span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-base md:text-sm font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-300"
                      >
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-base md:text-sm font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
                  >
                    <Lock className="w-4 h-4" />
                    {loading ? "Saving Password..." : "Update Password"}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
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
                    <div className="relative group shrink-0">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/30 bg-zinc-900 flex items-center justify-center relative">
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
                    </div>

                    {/* File Drag zone */}
                    <div 
                      className={`flex-1 w-full border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                        targetDragActive 
                          ? "border-amber-500 bg-amber-500/5" 
                          : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40"
                      }`}
                      onDragEnter={handleTargetDrag}
                      onDragOver={handleTargetDrag}
                      onDragLeave={handleTargetDrag}
                      onDrop={handleTargetDrop}
                      onClick={() => document.getElementById("target-avatar-file-input")?.click()}
                    >
                      <input 
                        type="file" 
                        id="target-avatar-file-input" 
                        accept="image/*" 
                        onChange={handleTargetFileChange} 
                        className="hidden" 
                      />
                      <Upload className="w-5 h-5 text-zinc-500 mb-1.5" />
                      <span className="text-xs font-semibold text-zinc-300">
                        {targetSelectedFile ? targetSelectedFile.name : "Choose profile picture or drop here"}
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                        Override for {users.find(u => u.username === selectedTarget)?.name || selectedTarget}
                      </span>
                    </div>
                  </div>

                  {targetAvatarSuccess && (
                    <p className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/10 border border-emerald-900/30 p-2.5 rounded-lg flex items-center gap-1.5 font-mono">
                      <span>✓ {targetAvatarSuccess}</span>
                    </p>
                  )}

                  {targetAvatarError && (
                    <p className="text-[11px] font-semibold text-red-400 bg-red-950/10 border border-red-900/30 p-2.5 rounded-lg flex items-center gap-1.5 font-mono">
                      <span>⚠️ {targetAvatarError}</span>
                    </p>
                  )}

                  {targetAvatarPreview && (
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setTargetAvatarPreview(null);
                          setTargetSelectedFile(null);
                          setTargetAvatarError("");
                          setTargetAvatarSuccess("");
                        }}
                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-bold uppercase rounded-lg border border-zinc-800/80 transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="submit"
                        disabled={targetAvatarLoading}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-zinc-950 text-xs font-bold uppercase rounded-lg shadow-lg shadow-amber-500/10 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        {targetAvatarLoading ? "Saving..." : "Save Picture"}
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
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-900/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
}
