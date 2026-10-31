import React, { useEffect, useState } from "react";
import { User, MOVIE_CLUB_USERS } from "../types.ts";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { setToken } from "../auth.ts";
import PaletteStrip from "./PaletteStrip.tsx";
import { CLUB_PALETTE } from "../palette.ts";

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [members, setMembers] = useState<User[]>(MOVIE_CLUB_USERS);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Use members' current profile photos when the server has them
  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((dbUsers: User[] | null) => {
        if (!dbUsers) return;
        setMembers(
          MOVIE_CLUB_USERS.map((m) => {
            const found = dbUsers.find((u) => u.username.toLowerCase() === m.username.toLowerCase());
            return found?.avatarUrl && !found.avatarUrl.startsWith("/src/") ? { ...m, avatarUrl: found.avatarUrl } : m;
          })
        );
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      setError("Tap your photo first.");
      return;
    }
    if (!password) {
      setError("Enter your password to come in.");
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
      if (data.token) setToken(data.token);
      onLoginSuccess(data.user);
    } catch (err: any) {
      setError(err.message || "Invalid password or connection error.");
    } finally {
      setLoading(false);
    }
  };

  const selected = members.find((m) => m.username === username);

  return (
    <div className="min-h-[100dvh] bg-zinc-950 text-zinc-100 overflow-y-auto flex flex-col items-center px-5 pt-[max(3.5rem,env(safe-area-inset-top))] pb-8">
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm flex flex-col gap-8 flex-1"
      >
        <header className="flex flex-col items-center text-center gap-3">
          <h1 className="font-serif text-5xl text-zinc-50">Movie Club</h1>
          <PaletteStrip colors={CLUB_PALETTE} className="h-3.5 w-60 rounded" />
          <p className="slate text-zinc-400 mt-1">Admit one · Every second Friday · 7 pm</p>
        </header>

        <fieldset className="flex flex-col gap-3">
          <legend className="slate text-zinc-400 mb-3">Who's watching?</legend>
          <div className="grid grid-cols-3 gap-3">
            {members.map((m) => {
              const on = m.username === username;
              return (
                <button
                  key={m.username}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setUsername(m.username);
                    setError("");
                  }}
                  className={`flex flex-col items-center gap-2 py-3 rounded-2xl border-2 cursor-pointer transition-colors ${
                    on ? "bg-amber-950 border-amber-500" : "bg-zinc-900 border-transparent hover:border-zinc-700"
                  }`}
                >
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="w-14 h-14 rounded-full bg-slate flex items-center justify-center font-semibold">{m.name.substring(0, 2).toUpperCase()}</span>
                  )}
                  <span className="text-sm font-medium">{m.username}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="slate text-zinc-400">
            {selected ? `Password for ${selected.username}` : "Password"}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-14 rounded-2xl border border-zinc-700 bg-zinc-900 text-zinc-100 text-lg px-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <button
            type="submit"
            disabled={loading}
            className="min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold text-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? "Checking…" : "Enter"}
          </button>
          <p className="text-center text-sm text-zinc-500">Members only</p>
        </div>
      </motion.form>
    </div>
  );
}
