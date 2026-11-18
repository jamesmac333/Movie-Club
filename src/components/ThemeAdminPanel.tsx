import React, { useCallback, useEffect, useState } from "react";
import { Check, Disc3, Pencil, Plus, Trash2, X } from "lucide-react";
import { MovieNight, PublicRotationTheme, Theme, ThemeSpin, ThemeSuggestion } from "../types.ts";

export interface AdminThemeState {
  themes: Theme[];
  suggestions: ThemeSuggestion[];
  rotationThemes: PublicRotationTheme[];
  spin: ThemeSpin | null;
  nextRotation: RotationStart | null;
  startOptions: RotationStart[];
}

// A night the wheel can start a theme from. "partial" means it themes the rest of a rotation already under way.
export interface RotationStart {
  startNightId: string;
  date: string;
  host: string;
  number: number;
  partial: boolean;
}

export function describeRotationStart(r: RotationStart) {
  const when = new Date(r.date).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  const host = r.host.split(" ")[0];
  return r.partial ? `The rest of this rotation, from ${host}'s night (${when})` : `The next full rotation, from ${host}'s night (${when})`;
}

// Calls an admin theme route and returns the new state, or throws the server's message
export async function themeRequest(path: string, method = "GET", body?: unknown): Promise<AdminThemeState & Record<string, any>> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

const fieldClass = "w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500";
const longDate = (d: string) => new Date(d).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

// Name and explainer inputs, used for adding, editing and tweaking suggestions
function ThemeFields({ name, description, onName, onDescription, idPrefix }: { name: string; description: string; onName: (v: string) => void; onDescription: (v: string) => void; idPrefix: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${idPrefix}-name`} className="sr-only">Theme</label>
      <input id={`${idPrefix}-name`} value={name} onChange={(e) => onName(e.target.value)} maxLength={80} placeholder="Theme, e.g. Heists" className={`${fieldClass} h-12`} />
      <label htmlFor={`${idPrefix}-desc`} className="sr-only">What counts</label>
      <textarea id={`${idPrefix}-desc`} value={description} onChange={(e) => onDescription(e.target.value)} maxLength={500} rows={2} placeholder="What counts? (optional)" className={`${fieldClass} py-2.5`} />
    </div>
  );
}

function ThemeRow({ theme, onSave, onDelete }: { key?: string; theme: Theme; onSave: (name: string, description: string) => Promise<void>; onDelete: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(theme.name);
  const [description, setDescription] = useState(theme.description);

  if (editing) {
    return (
      <li className="py-3 flex flex-col gap-2">
        <ThemeFields idPrefix={`edit-${theme.id}`} name={name} description={description} onName={setName} onDescription={setDescription} />
        <div className="flex gap-2">
          <button type="button" onClick={() => onSave(name, description).then(() => setEditing(false))} className="flex-1 min-h-11 rounded-xl bg-red-700 hover:bg-red-600 text-ticket font-semibold cursor-pointer">Save</button>
          <button type="button" onClick={() => { setEditing(false); setName(theme.name); setDescription(theme.description); }} className="flex-1 min-h-11 rounded-xl border border-zinc-700 text-zinc-300 font-semibold cursor-pointer">Cancel</button>
        </div>
      </li>
    );
  }

  return (
    <li className="py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-zinc-100 font-medium break-words">{theme.name}</p>
        {theme.description && <p className="text-sm text-zinc-400 break-words whitespace-pre-wrap">{theme.description}</p>}
        {theme.suggestedBy && <p className="text-xs text-zinc-500 mt-0.5">Suggested by {theme.suggestedBy.split(" ")[0]}</p>}
      </div>
      {confirmDelete ? (
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => onDelete()} className="min-h-11 px-3 rounded-xl bg-red-700 text-ticket text-sm font-semibold cursor-pointer">Delete</button>
          <button type="button" onClick={() => setConfirmDelete(false)} aria-label="Keep it" className="w-11 h-11 rounded-xl text-zinc-400 hover:text-zinc-100 flex items-center justify-center cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      ) : (
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => setEditing(true)} aria-label={`Edit ${theme.name}`} className="w-11 h-11 rounded-xl text-zinc-400 hover:text-amber-500 flex items-center justify-center cursor-pointer"><Pencil className="w-4 h-4" /></button>
          <button type="button" onClick={() => setConfirmDelete(true)} aria-label={`Delete ${theme.name}`} className="w-11 h-11 rounded-xl text-zinc-400 hover:text-red-400 flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
    </li>
  );
}

function SuggestionRow({ suggestion, onAccept, onDecline }: { key?: string; suggestion: ThemeSuggestion; onAccept: (name?: string, description?: string) => Promise<void>; onDecline: () => Promise<void> }) {
  const [tweaking, setTweaking] = useState(false);
  const [name, setName] = useState(suggestion.name);
  const [description, setDescription] = useState(suggestion.description);

  return (
    <li className="py-4 flex flex-col gap-3">
      <div>
        <p className="text-xs text-zinc-500">From {suggestion.suggestedBy.split(" ")[0]}</p>
        {!tweaking && (
          <>
            <p className="text-zinc-100 font-medium break-words">{suggestion.name}</p>
            {suggestion.description && <p className="text-sm text-zinc-400 break-words whitespace-pre-wrap">{suggestion.description}</p>}
          </>
        )}
      </div>
      {tweaking ? (
        <>
          <ThemeFields idPrefix={`sug-${suggestion.id}`} name={name} description={description} onName={setName} onDescription={setDescription} />
          <div className="flex gap-2">
            <button type="button" onClick={() => onAccept(name, description)} className="flex-1 min-h-11 rounded-xl bg-red-700 hover:bg-red-600 text-ticket font-semibold cursor-pointer">Add to the wheel</button>
            <button type="button" onClick={() => setTweaking(false)} className="flex-1 min-h-11 rounded-xl border border-zinc-700 text-zinc-300 font-semibold cursor-pointer">Cancel</button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onAccept()} className="min-h-11 px-4 rounded-xl bg-red-700 hover:bg-red-600 text-ticket text-sm font-semibold flex items-center gap-1.5 cursor-pointer"><Check className="w-4 h-4" />Add as is</button>
          <button type="button" onClick={() => setTweaking(true)} className="min-h-11 px-4 rounded-xl border border-zinc-700 text-zinc-200 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"><Pencil className="w-4 h-4" />Tweak and add</button>
          <button type="button" onClick={() => onDecline()} className="min-h-11 px-4 rounded-xl text-zinc-400 hover:text-red-400 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"><X className="w-4 h-4" />Decline</button>
        </div>
      )}
    </li>
  );
}

// Admins: the theme list, members' suggestions, past rotations' themes, and the way into the wheel
export default function ThemeAdminPanel({ nights, onOpenWheel, onChanged, refreshKey }: { nights: MovieNight[]; onOpenWheel: () => void; onChanged: () => void; refreshKey?: number }) {
  const [state, setState] = useState<AdminThemeState | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(() => {
    themeRequest("/api/admin/themes").then(setState).catch((e) => setError(e.message));
  }, []);
  useEffect(load, [load, refreshKey]);

  // Runs a change, shows the new state, and lets the rest of the site catch up
  const run = async (path: string, method: string, body?: unknown) => {
    setError("");
    try {
      setState(await themeRequest(path, method, body));
      onChanged();
    } catch (e: any) {
      setError(e.message);
      throw e;
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await run("/api/admin/themes", "POST", { name, description }).then(() => { setName(""); setDescription(""); }).catch(() => {});
  };

  if (!state) return <p className="text-sm text-zinc-400">{error || "Loading themes…"}</p>;

  const onWheel = state.themes.filter((t) => t.status === "available");
  const next = state.nextRotation;
  const history = [...state.rotationThemes]
    .map((rt) => ({ ...rt, night: nights.find((n) => n.id === rt.startNightId) }))
    .sort((a, b) => new Date(b.night?.date || 0).getTime() - new Date(a.night?.date || 0).getTime());

  return (
    <div className="flex flex-col gap-6">
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

      {/* The wheel */}
      <div className="bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 flex flex-col gap-3">
        {next ? (
          <p className="text-zinc-300">
            {state.spin ? (
              <>A spin for <span className="text-zinc-100 font-semibold">Rotation {next.number}</span> ({describeRotationStart(next).toLowerCase()}) is waiting to be locked in or vetoed.</>
            ) : (
              <>Next up is <span className="text-zinc-100 font-semibold">Rotation {next.number}</span>. You can spin for {state.startOptions.map((o) => describeRotationStart(o).replace(/^The/, "the")).join(", or ")}.</>
            )}
          </p>
        ) : (
          <p className="text-zinc-300">Every upcoming rotation has its theme.</p>
        )}
        <p className="text-sm text-zinc-400">{onWheel.length === 0 ? "There are no themes on the wheel. Add some below before spinning." : `${onWheel.length} theme${onWheel.length === 1 ? "" : "s"} on the wheel.`}</p>
        <button
          type="button"
          onClick={onOpenWheel}
          disabled={!next || (onWheel.length === 0 && !state.spin)}
          className="min-h-12 rounded-2xl bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-ticket font-semibold flex items-center justify-center gap-2 cursor-pointer"
        >
          <Disc3 className="w-5 h-5" aria-hidden="true" />
          Open the wheel
        </button>
        {state.spin && (
          <button
            type="button"
            onClick={() => window.confirm("Cancel the waiting spin? Its result is thrown away and the veto comes back, as if the wheel was never spun.") && run("/api/admin/themes/spin/cancel", "POST", {}).catch(() => {})}
            className="min-h-12 rounded-2xl border border-zinc-700 text-zinc-300 hover:text-red-300 hover:border-red-800 font-semibold cursor-pointer"
          >
            Cancel this spin
          </button>
        )}
        {state.spin && <p className="text-sm text-zinc-400">Use this if the wheel was spun by mistake or as a test. It isn't shown on the TV.</p>}
      </div>

      {/* Suggestions from members */}
      {state.suggestions.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-2xl text-zinc-50">Suggestions <span className="text-amber-500">({state.suggestions.length})</span></h3>
          <ul className="divide-y divide-zinc-800">
            {state.suggestions.map((s) => (
              <SuggestionRow
                key={s.id}
                suggestion={s}
                onAccept={(n, d) => run(`/api/admin/theme-suggestions/${s.id}/accept`, "POST", n === undefined ? {} : { name: n, description: d }).catch(() => {})}
                onDecline={() => run(`/api/admin/theme-suggestions/${s.id}`, "DELETE").catch(() => {})}
              />
            ))}
          </ul>
        </div>
      )}

      {/* Add a theme */}
      <form onSubmit={add} className="flex flex-col gap-2">
        <h3 className="font-serif text-2xl text-zinc-50">Add a theme</h3>
        <ThemeFields idPrefix="new-theme" name={name} description={description} onName={setName} onDescription={setDescription} />
        <button type="submit" className="min-h-12 rounded-2xl border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 font-semibold flex items-center justify-center gap-2 cursor-pointer">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add to the wheel
        </button>
      </form>

      {/* On the wheel */}
      <div className="flex flex-col gap-1">
        <h3 className="font-serif text-2xl text-zinc-50">On the wheel</h3>
        {onWheel.length === 0 ? (
          <p className="text-sm text-zinc-400">Nothing yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {onWheel.map((t) => (
              <ThemeRow
                key={t.id}
                theme={t}
                onSave={(n, d) => run(`/api/admin/themes/${t.id}`, "PUT", { name: n, description: d })}
                onDelete={() => run(`/api/admin/themes/${t.id}`, "DELETE").catch(() => {})}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Past and upcoming rotations' themes */}
      {history.length > 0 && (
        <div className="flex flex-col gap-1">
          <h3 className="font-serif text-2xl text-zinc-50">Used</h3>
          <ul className="divide-y divide-zinc-800">
            {history.map((rt) => {
              const theme = state.themes.find((t) => t.id === rt.themeId);
              const notStarted = rt.night && new Date(rt.night.date).getTime() > Date.now();
              return (
                <li key={rt.startNightId} className="pt-3 flex flex-col">
                  <div className="flex items-center gap-3">
                    <p className="flex-1 min-w-0 slate text-zinc-500">{rt.night ? `Rotation ${rt.number} · from ${longDate(rt.night.date)}` : "Rotation"}</p>
                    {notStarted && (
                      <button
                        type="button"
                        onClick={() => window.confirm(`Clear "${rt.name}" from this rotation and put it back on the wheel?`) && run(`/api/admin/rotation-themes/${rt.startNightId}`, "DELETE").catch(() => {})}
                        className="min-h-11 px-3 rounded-xl text-sm text-zinc-400 hover:text-red-400 font-semibold cursor-pointer shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  {theme ? (
                    <ul>
                      <ThemeRow
                        theme={theme}
                        onSave={(n, d) => run(`/api/admin/themes/${theme.id}`, "PUT", { name: n, description: d })}
                        onDelete={() => run(`/api/admin/themes/${theme.id}`, "DELETE").catch(() => {})}
                      />
                    </ul>
                  ) : (
                    <p className="py-3 text-zinc-400 break-words">{rt.name} <span className="text-xs">(deleted)</span></p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
