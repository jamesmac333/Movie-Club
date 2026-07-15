import React, { useState } from "react";
import { User, MOVIE_CLUB_USERS } from "../types.ts";
import { Ticket, LogIn, Lock, HelpCircle, Film, Sparkles } from "lucide-react";
import { motion } from "motion/react";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState("James");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCheatSheet, setShowCheatSheet] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter your password to gain entry.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Login failed");
      }

      const data = await response.json();
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Invalid password or connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black overflow-y-auto flex flex-col items-center justify-center p-4 md:p-8 select-none z-50">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.06)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
      <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-500/10 to-transparent" />

      {/* Main Container */}
      <div className="w-full max-w-md relative z-10 my-auto flex flex-col items-center">
        
        {/* Cinematic Branding */}
        <div className="text-center mb-10 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl mb-4 text-amber-500 shadow-lg shadow-amber-500/5"
          >
            <Film className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-4xl font-serif tracking-[0.2em] text-zinc-100 font-bold italic"
          >
            MOVIE CLUB
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 mt-2 font-mono"
          >
            Members-Only Movie Club
          </motion.p>
        </div>

        {/* Ticket Styled Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative bg-[#0c0c0c] border border-zinc-800 rounded-3xl w-full overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
        >
          {/* Ticket Header */}
          <div className="relative h-14 bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-between px-8">
            <span className="text-zinc-950 font-serif font-black text-xl tracking-[0.1em] flex items-center gap-2">
              <Ticket className="w-5.5 h-5.5" />
              ADMIT ONE
            </span>
            <span className="text-zinc-950/70 font-mono text-xs font-bold tracking-wider">NO. 7715408</span>
            
            {/* Cutout Punch */}
            <div className="absolute left-1/2 -bottom-3.5 -translate-x-1/2 w-7 h-7 bg-black rounded-full" />
          </div>

          {/* Form Content */}
          <div className="p-8 pt-12 relative">
            
            {/* Decorative Ticket Side Notch Cutouts */}
            <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 w-7 h-7 bg-black rounded-full border-r border-zinc-800" />
            <div className="absolute top-1/2 -right-3.5 -translate-y-1/2 w-7 h-7 bg-black rounded-full border-l border-zinc-800" />

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Member Selection */}
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2.5 font-mono">
                  Select Member Profile
                </label>
                <select
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all text-sm font-medium"
                >
                  {MOVIE_CLUB_USERS.map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.name} ({user.isAdmin ? "Admin" : "Member"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Password Input */}
              <div>
                <div className="flex justify-between items-center mb-2.5">
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCheatSheet(!showCheatSheet)}
                    className="text-[10px] text-amber-500/70 hover:text-amber-500 flex items-center gap-1 transition-colors font-mono uppercase tracking-wider"
                  >
                    <HelpCircle className="w-3 h-3" />
                    Help
                  </button>
                </div>
                
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3.5 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all font-mono tracking-widest text-sm"
                />
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-xs text-red-400 font-semibold flex items-center gap-1.5 bg-red-950/20 border border-red-900/30 p-3 rounded-lg font-mono">
                  <span>⚠️ {error}</span>
                </p>
              )}

              {/* Action Buttons */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-zinc-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10 cursor-pointer active:scale-[0.99]"
              >
                <LogIn className="w-4 h-4" />
                {loading ? "Verifying Token..." : "Access Movie Club"}
              </button>

            </form>
          </div>

          {/* Ticket Footer branding */}
          <div className="bg-zinc-900/40 px-8 py-3.5 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500 font-mono">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500/60" /> Classy Movie Club
            </span>
            <span>Est. 2026</span>
          </div>
        </motion.div>

        {/* Cheat sheet drawer */}
        {showCheatSheet && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full bg-zinc-950/90 border border-zinc-900 rounded-2xl p-4 mt-4 text-xs space-y-2 text-zinc-400 font-mono"
          >
            <p className="text-zinc-200 font-bold border-b border-zinc-900 pb-1.5 uppercase tracking-wider">Launch Passwords Reference</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-zinc-500">James Macintosh:</span><br/>
                Password: <span className="text-amber-500 font-bold">Admin</span>
              </div>
              <div>
                <span className="text-zinc-500">Ash Macintosh:</span><br/>
                Password: <span className="text-amber-500 font-bold">Admin</span>
              </div>
              <div>
                <span className="text-zinc-500">Tom Sakai:</span><br/>
                Password: <span className="text-amber-500 font-bold">movienight</span>
              </div>
              <div>
                <span className="text-zinc-500">Madison Hill:</span><br/>
                Password: <span className="text-amber-500 font-bold">movienight</span>
              </div>
              <div>
                <span className="text-zinc-500">Max Smith:</span><br/>
                Password: <span className="text-amber-500 font-bold">movienight</span>
              </div>
              <div>
                <span className="text-zinc-500">Amy Walsh:</span><br/>
                Password: <span className="text-amber-500 font-bold">movienight</span>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-900 italic">
              * Note: You can reset your password to anything you like after entering the club!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
