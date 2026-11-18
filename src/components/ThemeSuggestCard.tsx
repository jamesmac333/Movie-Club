import React, { useEffect, useState } from "react";
import { Lightbulb, Send, X } from "lucide-react";
import { ThemeSuggestion } from "../types.ts";

// Members suggest rotation themes here; the admins decide which go on the wheel
export function ThemeSuggestSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState("");
  const [mine, setMine] = useState<ThemeSuggestion[]>([]);

  useEffect(() => {
    fetch("/api/theme-suggestions/mine")
      .then((r) => (r.ok ? r.json() : []))
      .then(setMine)
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give the theme a name.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/theme-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send your suggestion.");
      setMine((prev) => [...prev, data.suggestion]);
      setSent(`Sent "${data.suggestion.name}" to the admins.`);
      setName("");
      setDescription("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="suggest-theme-title">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative w-full md:max-w-lg max-h-[90dvh] overflow-y-auto bg-zinc-900 border-t md:border border-zinc-800 rounded-t-[28px] md:rounded-3xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 id="suggest-theme-title" className="font-serif text-3xl text-zinc-50">Suggest a theme</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-2 rounded-full text-zinc-400 hover:text-zinc-100 flex items-center justify-center cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-zinc-300">Each rotation gets a theme from the wheel, and every pick has to fit it. Ash and James look at suggestions before they go on.</p>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-200">Theme</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder="e.g. Heists"
              className="h-12 bg-zinc-950 border border-zinc-700 rounded-xl px-4 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-200">What counts? <span className="text-zinc-500 font-normal">(optional)</span></span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="e.g. Any film where the main plot is a robbery or a con"
              className="bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {sent && <p role="status" className="text-sm text-emerald-400">{sent}</p>}
          <button type="submit" disabled={busy} className="min-h-12 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-semibold flex items-center justify-center gap-2 cursor-pointer">
            <Send className="w-4 h-4" aria-hidden="true" />
            {busy ? "Sending…" : "Send suggestion"}
          </button>
        </form>

        {mine.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4">
            <p className="slate text-zinc-400">Waiting for the admins</p>
            <ul className="flex flex-col gap-1.5">
              {mine.map((s) => (
                <li key={s.id} className="text-zinc-200">{s.name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// A small card on Home that opens the suggestion sheet
export default function ThemeSuggestCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section aria-labelledby="suggest-theme" className="bg-zinc-900 border border-zinc-800 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <Lightbulb className="w-6 h-6 text-amber-500 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <h2 id="suggest-theme" className="font-serif text-2xl text-zinc-50">Got a theme idea?</h2>
        <p className="text-sm text-zinc-400">Suggest one for a future rotation and it could end up on the wheel.</p>
      </div>
      <button type="button" onClick={onOpen} className="min-h-12 px-5 rounded-2xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold cursor-pointer">
        Suggest a theme
      </button>
    </section>
  );
}
