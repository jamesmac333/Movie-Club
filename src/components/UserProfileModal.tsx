import React, { useState, useEffect, useRef } from "react";
import { User, MOVIE_CLUB_USERS } from "../types.ts";
import { Lock, KeyRound, Check, AlertCircle, Eye, EyeOff, Upload, Camera, X } from "lucide-react";
import { compressAvatar } from "../compressAvatar.ts";

interface UserProfileModalProps {
  currentUser: User;
  onClose: () => void;
  users?: User[];
  onUserUpdate?: () => void;
}

export default function UserProfileModal({ currentUser, onClose, users = MOVIE_CLUB_USERS, onUserUpdate }: UserProfileModalProps) {
  const personalFileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
    e.target.value = "";
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
      setAvatarError("Please select an image file (PNG, JPG, WebP, etc.)");
      return;
    }
    setAvatarError("");
    setAvatarSuccess("");
    setSelectedFile(file);

    // Instant preview so the Save button is immediately active and preview is shown
    const quickReader = new FileReader();
    quickReader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) {
        setAvatarPreview(dataUrl);
      }
    };
    quickReader.readAsDataURL(file);

    // Crop and compress in background for optimal size
    compressAvatar(file)
      .then((dataUrl) => {
        setAvatarPreview(dataUrl);
      })
      .catch((err) => {
        console.warn("Avatar compression fallback to raw dataUrl", err);
      });
  };

  const handleAvatarUpload = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();

    let uploadData = avatarPreview;
    // Upload the compressed version even if Save is clicked before background compression finishes
    if (selectedFile) {
      uploadData = await compressAvatar(selectedFile).catch(() => uploadData);
    }
    if (!uploadData && selectedFile) {
      try {
        uploadData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      } catch (readErr) {
        setAvatarError("Failed to read image file.");
        return;
      }
    }

    if (!uploadData) {
      setAvatarError("Please select an image file first.");
      return;
    }

    setAvatarLoading(true);
    setAvatarSuccess("");
    setAvatarError("");

    try {
      const response = await fetch(`/api/users/${encodeURIComponent(currentUser.username)}/avatar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          avatarUrl: uploadData,
          requester: currentUser.username
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload avatar");
      }

      setAvatarSuccess("Profile picture updated and saved successfully!");
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

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 cursor-pointer overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="relative bg-[#0d0d0d] border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90dvh] sm:max-h-[85dvh] overflow-hidden shadow-2xl flex flex-col cursor-default overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-zinc-900 px-6 py-4 border-b border-zinc-800/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-lg text-zinc-100">
                Profile & settings
              </h3>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                Your photo and password
              </p>
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

        <div className="p-6 flex-1 overflow-y-auto overscroll-contain">
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

          <div className="space-y-6">
            {/* Profile Picture Manual Upload Section */}
            <div className="bg-zinc-900/10 border border-zinc-800/80 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="border-b border-zinc-800/60 pb-2 flex items-center justify-between">
                <h4 className="text-xs uppercase tracking-widest text-zinc-300 font-bold flex items-center gap-2">
                  <Camera className="w-3.5 h-3.5 text-amber-500" />
                  Profile Picture
                </h4>
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
                  {currentUser.username}
                </span>
              </div>

              <form onSubmit={handleAvatarUpload} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Current or Preview Image */}
                  <div className="relative group shrink-0 flex flex-col items-center gap-1.5">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500/40 bg-zinc-900 flex items-center justify-center relative shadow-md">
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
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {avatarPreview ? "New Preview" : "Current Photo"}
                    </span>
                  </div>

                  {/* File Dropzone / Picker */}
                  <div 
                    className={`flex-1 w-full border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center ${
                      dragActive 
                        ? "border-amber-500 bg-amber-500/10" 
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-950/40 hover:bg-zinc-950/70"
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={(e) => {
                      if (e.target !== personalFileInputRef.current) {
                        personalFileInputRef.current?.click();
                      }
                    }}
                  >
                    <input 
                      type="file" 
                      ref={personalFileInputRef}
                      accept="image/*" 
                      onClick={(e) => e.stopPropagation()}
                      onChange={handleFileChange} 
                      className="hidden" 
                    />
                    <Upload className="w-5 h-5 text-amber-500 mb-1.5" />
                    <span className="text-xs font-semibold text-zinc-200">
                      {selectedFile ? selectedFile.name : "Choose an image or drop here"}
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-1 font-mono uppercase tracking-wider">
                      Supports JPG, PNG, WebP & GIF
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        personalFileInputRef.current?.click();
                      }}
                      className="mt-2.5 px-3 py-1 bg-zinc-900 hover:bg-zinc-800 text-amber-400 border border-amber-500/30 hover:border-amber-500/60 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Browse Image
                    </button>
                  </div>
                </div>

                {avatarSuccess && (
                  <div className="text-xs font-semibold text-emerald-400 bg-emerald-950/20 border border-emerald-900/50 p-3 rounded-lg flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{avatarSuccess}</span>
                  </div>
                )}

                {avatarError && (
                  <div className="text-xs font-semibold text-red-400 bg-red-950/20 border border-red-900/50 p-3 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{avatarError}</span>
                  </div>
                )}

                {/* PROMINENT SAVE BUTTON SECTION */}
                {selectedFile || avatarPreview ? (
                  <div className="p-3.5 bg-amber-500/10 border-2 border-amber-500/40 rounded-xl shadow-lg shadow-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-amber-500/60 shrink-0 bg-zinc-900">
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Selected preview" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera className="w-5 h-5 text-amber-500" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5" />
                          <span>New Photo Selected</span>
                        </div>
                        <div className="text-xs font-medium text-zinc-200 truncate">
                          {selectedFile?.name || "Photo ready to apply"}
                        </div>
                        {selectedFile && (
                          <div className="text-[10px] text-zinc-400 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB • Ready to save
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setAvatarPreview(null);
                          setSelectedFile(null);
                          setAvatarError("");
                          setAvatarSuccess("");
                        }}
                        disabled={avatarLoading}
                        className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-bold uppercase rounded-lg border border-zinc-800 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAvatarUpload}
                        disabled={avatarLoading}
                        className="flex-1 sm:flex-initial px-5 py-2.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-ticket text-xs font-black uppercase tracking-wider rounded-lg shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {avatarLoading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                            <span>Saving Picture...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 stroke-[3]" />
                            <span>Save New Profile Picture</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-zinc-950/40 border border-zinc-900 rounded-xl">
                    <div className="text-xs text-zinc-400 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-zinc-500" />
                      <span>Select a picture above to save as your new profile photo</span>
                    </div>
                    <button
                      type="button"
                      disabled
                      className="px-4 py-2 bg-zinc-900 text-zinc-500 border border-zinc-800/60 rounded-lg text-xs font-bold uppercase tracking-wider cursor-not-allowed opacity-60 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Save Picture
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
                  className="w-full py-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-ticket font-bold rounded-lg text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? "Saving Password..." : "Update Password"}
                </button>
              </form>
            </div>
          </div>
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