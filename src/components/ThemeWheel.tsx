import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, Maximize, Minimize, RotateCcw, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { MovieNight } from "../types.ts";
import { AdminThemeState, describeRotationStart, themeRequest } from "./ThemeAdminPanel.tsx";

interface Slice {
  id: string;
  name: string;
}

interface Winner {
  id: string;
  name: string;
  description: string;
}

type Phase = "loading" | "ready" | "spinning" | "decide" | "veto" | "locked" | "error";

// Slice colours from the club palette, all dark enough for light text
const SLICE_COLOURS = ["#7d1712", "#2f4a55", "#5a3a2b", "#3f5f58", "#2e1b12", "#6e5444", "#4b1a14", "#22383f"];
// Above this many themes the slices are too thin to label; the card beside the wheel does the work
const MAX_LABELLED = 30;
// Room along a slice for its name, from the rim to the hub (in wheel units)
const LABEL_ROOM = 360;
const MIN_LABEL = 14;
const POINTER_ANGLE = 0; // top of the wheel

const mod = (n: number, m: number) => ((n % m) + m) % m;
const shuffle = <T,>(items: T[]) => {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// A soft click each time a slice passes the pointer, like a real prize wheel
function useTicker() {
  const ctx = useRef<AudioContext | null>(null);
  const start = () => {
    if (!ctx.current) {
      try {
        ctx.current = new AudioContext();
      } catch {}
    }
    ctx.current?.resume().catch(() => {});
  };
  const tick = () => {
    const c = ctx.current;
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = 1400;
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.04);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + 0.05);
  };
  useEffect(() => () => void ctx.current?.close().catch(() => {}), []);
  return { start, tick };
}

function slicePath(i: number, n: number, r: number) {
  if (n === 1) return `M 0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r} Z`;
  const a0 = ((i / n) * 2 * Math.PI) - Math.PI / 2;
  const a1 = (((i + 1) / n) * 2 * Math.PI) - Math.PI / 2;
  const large = 1 / n > 0.5 ? 1 : 0;
  return `M 0 0 L ${r * Math.cos(a0)} ${r * Math.sin(a0)} A ${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`;
}

function sliceColour(i: number, n: number) {
  const c = i % SLICE_COLOURS.length;
  // Don't let the last slice match the first one next to it
  return i === n - 1 && n > 1 && c === 0 ? SLICE_COLOURS[3] : SLICE_COLOURS[c];
}

// Full-screen theme wheel, made to be shown on the TV after the last film of a rotation
export default function ThemeWheel({ nights, onClose, onChanged }: { nights: MovieNight[]; onClose: () => void; onChanged: () => void }) {
  const [state, setState] = useState<AdminThemeState | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [slices, setSlices] = useState<Slice[]>([]);
  const [passing, setPassing] = useState<number>(-1);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [nearMisses, setNearMisses] = useState<string[]>([]);
  const [finalSpin, setFinalSpin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const wheel = useRef<SVGGElement>(null);
  const angle = useRef(0);
  const frame = useRef(0);
  const ticker = useTicker();
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const vetoUsed = !!state?.spin?.vetoed;
  // The rotation being spun for, kept after locking in (when the server has no rotation waiting any more)
  const [rotation, setRotation] = useState<AdminThemeState["nextRotation"]>(null);
  useEffect(() => {
    if (state?.nextRotation && !rotation) setRotation(state.nextRotation);
  }, [state, rotation]);

  // Load the wheel, picking up where things were left if a spin is waiting
  useEffect(() => {
    themeRequest("/api/admin/themes")
      .then((s) => {
        setState(s);
        const onWheel = s.themes.filter((t) => t.status === "available" && t.id !== (s.spin?.vetoed ? s.spin.themeId : ""));
        setSlices(shuffle(onWheel.map((t) => ({ id: t.id, name: t.name }))));
        if (s.spin && !s.spin.vetoed) {
          const t = s.themes.find((x) => x.id === s.spin!.themeId);
          if (t) setWinner({ id: t.id, name: t.name, description: t.description });
          setPhase("decide");
        } else {
          setFinalSpin(!!s.spin?.vetoed);
          setPhase("ready");
        }
      })
      .catch((e) => {
        setError(e.message);
        setPhase("error");
      });
  }, []);

  // Keep the page behind still, and follow full-screen changes
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("fullscreenchange", onFs);
      cancelAnimationFrame(frame.current);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else root.current?.requestFullscreen?.().catch(() => {});
  };

  const n = slices.length;
  const sliceDeg = n ? 360 / n : 360;
  const indexAtPointer = (deg: number) => (n ? Math.floor(mod(POINTER_ANGLE - deg, 360) / sliceDeg) % n : -1);

  const setWheelAngle = (deg: number) => {
    angle.current = deg;
    wheel.current?.setAttribute("transform", `rotate(${deg})`);
  };

  // Spins to land on the winner, slowing down so the last few names are easy to read
  const animateTo = (targetIndex: number, list: Slice[]) => new Promise<number[]>((resolve) => {
    const count = list.length;
    const deg = 360 / count;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 4000 : 11000;
    const turns = reduce ? 2 : 7;
    const jitter = (Math.random() - 0.5) * deg * 0.7;
    const targetMod = mod(POINTER_ANGLE - ((targetIndex + 0.5) * deg + jitter), 360);
    const from = angle.current;
    const to = from + turns * 360 + mod(targetMod - mod(from, 360), 360);
    const passed: number[] = [];
    let last = -1;
    const t0 = performance.now();

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = from + (to - from) * eased;
      setWheelAngle(current);
      const idx = Math.floor(mod(POINTER_ANGLE - current, 360) / deg) % count;
      if (idx !== last) {
        last = idx;
        passed.push(idx);
        setPassing(idx);
        if (soundRef.current) ticker.tick();
      }
      if (t < 1) frame.current = requestAnimationFrame(step);
      else resolve(passed);
    };
    frame.current = requestAnimationFrame(step);
  });

  const spin = useCallback(async () => {
    if (phase !== "ready" || busy || !n) return;
    setBusy(true);
    setError("");
    ticker.start();
    try {
      const res = await themeRequest("/api/admin/themes/spin", "POST", { startNightId: rotation?.startNightId });
      // Keep the order already on screen; add anything new at the end
      const order = new Map<string, number>(slices.map((s, i) => [s.id, i] as [string, number]));
      const list: Slice[] = [...res.wheel].sort((a: Slice, b: Slice) => Number(order.get(a.id) ?? 1e6) - Number(order.get(b.id) ?? 1e6));
      setSlices(list);
      setFinalSpin(res.final);
      setPhase("spinning");
      setBusy(false);
      // Wait a frame so the wheel redraws with the server's list before it moves
      await new Promise((r) => requestAnimationFrame(r));
      const target = list.findIndex((s) => s.id === res.winner.id);
      const passed = await animateTo(target, list);
      // The names that went past just before it stopped
      const misses: string[] = [];
      for (let i = passed.length - 2; i >= 0 && misses.length < 4; i--) {
        const name = list[passed[i]].name;
        if (passed[i] !== target && !misses.includes(name)) misses.push(name);
      }
      setNearMisses(misses);
      await new Promise((r) => setTimeout(r, 900));
      setWinner(res.winner);
      setState(res);
      setPhase(res.final ? "locked" : "decide");
      if (res.final) onChanged();
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
      setPhase("ready");
    }
  }, [phase, busy, n, slices, onChanged, rotation]);

  // Space or Enter spins, so it can be run from the laptop keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "spinning" && !document.fullscreenElement) onClose();
      if ((e.key === " " || e.key === "Enter") && phase === "ready" && (e.target as HTMLElement)?.tagName !== "BUTTON") {
        e.preventDefault();
        spin();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, spin, onClose]);

  const lockIn = async () => {
    setBusy(true);
    setError("");
    try {
      setState(await themeRequest("/api/admin/themes/spin/lock", "POST", {}));
      setPhase("locked");
      onChanged();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const veto = async (removeForGood: boolean) => {
    setBusy(true);
    setError("");
    try {
      const s = await themeRequest("/api/admin/themes/spin/veto", "POST", { removeForGood });
      setState(s);
      setSlices((prev) => prev.filter((x) => x.id !== winner?.id));
      setWinner(null);
      setNearMisses([]);
      setPassing(-1);
      setFinalSpin(true);
      setPhase("ready");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startDate = rotation ? new Date(rotation.date).toLocaleDateString("en-NZ", { weekday: "long", day: "numeric", month: "long" }) : "";
  const labelled = n <= MAX_LABELLED;
  // As big as the slice's width allows, then shrunk so long names still fit between the rim and the hub
  const baseFont = Math.min(34, Math.floor(((2 * Math.PI * 250) / Math.max(n, 1)) * 0.55));
  const labelFor = (name: string) => {
    const fit = Math.floor(LABEL_ROOM / (name.length * 0.5));
    const size = Math.max(MIN_LABEL, Math.min(baseFont, fit));
    const maxChars = Math.floor(LABEL_ROOM / (size * 0.5));
    return { size, text: name.length > maxChars ? name.slice(0, maxChars - 1) + "…" : name };
  };
  const winnerIndex = winner ? slices.findIndex((s) => s.id === winner.id) : -1;
  const landed = phase === "decide" || phase === "veto" || phase === "locked";
  const card = landed ? null : passing >= 0 ? slices[passing]?.name : null;
  const onlyOneLeft = useMemo(() => (state ? state.themes.filter((t) => t.status === "available" && t.id !== winner?.id).length === 0 : false), [state, winner]);

  return createPortal(
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Theme wheel"
      className="fixed inset-0 z-[70] bg-zinc-950 text-zinc-100 overflow-y-auto overscroll-contain flex flex-col bg-[radial-gradient(ellipse_at_30%_45%,rgba(227,190,138,0.10),transparent_60%)]"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 sm:px-8 pt-[max(1rem,env(safe-area-inset-top))] pb-2">
        <div className="flex-1 min-w-0">
          <p className="slate text-amber-500">The theme wheel</p>
          {rotation && <p className="font-serif text-2xl sm:text-3xl text-zinc-50 truncate">Rotation {rotation.number} · {rotation.partial ? `from ${rotation.host.split(" ")[0]}'s night, ${startDate}` : `starts ${startDate}`}</p>}
        </div>
        <button type="button" onClick={() => setSound(!sound)} aria-label={sound ? "Turn sound off" : "Turn sound on"} className="w-12 h-12 rounded-full text-zinc-400 hover:text-zinc-100 flex items-center justify-center cursor-pointer">
          {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </button>
        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Leave full screen" : "Full screen"} className="w-12 h-12 rounded-full text-zinc-400 hover:text-zinc-100 flex items-center justify-center cursor-pointer">
          {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
        <button type="button" onClick={onClose} disabled={phase === "spinning"} aria-label="Close the wheel" className="w-12 h-12 rounded-full text-zinc-400 hover:text-zinc-100 disabled:opacity-30 flex items-center justify-center cursor-pointer">
          <X className="w-6 h-6" />
        </button>
      </div>

      {phase === "loading" && <p className="m-auto text-zinc-400">Setting up the wheel…</p>}
      {phase === "error" && <p className="m-auto text-red-400 px-6 text-center">{error}</p>}

      {phase !== "loading" && phase !== "error" && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center gap-8 lg:gap-12 px-4 sm:px-8 pb-8">
          {/* The wheel */}
          <div className="relative mx-auto w-full max-w-[min(78vh,92vw)] lg:max-w-[min(82vh,52vw)] aspect-square">
            {n === 0 ? (
              <div className="absolute inset-0 rounded-full border-4 border-dashed border-zinc-700 flex items-center justify-center text-center p-10">
                <p className="font-serif text-3xl text-zinc-300">No themes on the wheel. Add some in Admin first.</p>
              </div>
            ) : (
              <svg viewBox="-520 -540 1040 1060" className="w-full h-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]" aria-hidden="true">
                <circle r="512" fill="#e3be8a" />
                <circle r="500" fill="#121310" />
                <g ref={wheel} transform={`rotate(${angle.current})`}>
                  {slices.map((s, i) => {
                    const mid = ((i + 0.5) / n) * 360;
                    const isWinner = landed && i === winnerIndex;
                    const label = labelFor(s.name);
                    return (
                      <g key={s.id}>
                        <path d={slicePath(i, n, 492)} fill={sliceColour(i, n)} stroke="#121310" strokeWidth="3" opacity={landed && !isWinner ? 0.45 : 1} />
                        {labelled && (
                          <text
                            transform={`rotate(${mid - 90}) translate(${n === 1 ? 0 : 455} 0)`}
                            textAnchor={n === 1 ? "middle" : "end"}
                            dominantBaseline="central"
                            fill="#f4e6cc"
                            fontFamily="Georgia, serif"
                            fontSize={label.size}
                            style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.35)", strokeWidth: 3 }}
                          >
                            {label.text}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  {/* Bulbs round the rim */}
                  {Array.from({ length: 24 }, (_, i) => {
                    const a = (i / 24) * 2 * Math.PI;
                    return <circle key={i} cx={506 * Math.cos(a)} cy={506 * Math.sin(a)} r="5" fill="#fbe7b0" opacity={i % 2 ? 0.9 : 0.5} />;
                  })}
                </g>
                {/* Hub */}
                <circle r="70" fill="#121310" stroke="#e3be8a" strokeWidth="6" />
                <text textAnchor="middle" dominantBaseline="central" fill="#e3be8a" fontFamily="Georgia, serif" fontStyle="italic" fontSize="34">MC</text>
                {/* Pointer */}
                <path d="M -34 -548 L 34 -548 L 0 -470 Z" fill="#e3be8a" stroke="#121310" strokeWidth="4" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* What the pointer is passing, then the result */}
          <div className="flex flex-col gap-4 min-w-0 lg:pr-4">
            {!landed && (
              <div className="min-h-[14rem] sm:min-h-[16rem] bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 flex flex-col justify-center gap-3">
                <p className="slate text-zinc-400">{phase === "spinning" ? "Now passing" : finalSpin ? "Final spin" : "Ready"}</p>
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.p
                    key={card ?? "idle"}
                    initial={{ opacity: 0.2, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.12 }}
                    className="font-serif text-[clamp(2.25rem,min(5vw,9vh),5.5rem)] leading-[1.02] text-zinc-50 break-words"
                  >
                    {card ?? (n ? `${n} theme${n === 1 ? "" : "s"} on the wheel` : "Nothing to spin")}
                  </motion.p>
                </AnimatePresence>
                {phase === "ready" && finalSpin && <p className="text-lg text-amber-300">The veto's been used. Whatever this lands on is the theme.</p>}
              </div>
            )}

            {landed && winner && (
              <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 160, damping: 16 }} className="bg-zinc-900 border-2 border-amber-500/70 rounded-[2rem] p-6 sm:p-8 flex flex-col gap-3 shadow-[0_0_80px_rgba(227,190,138,0.18)]">
                <p className="slate text-amber-500">{phase === "locked" ? `Rotation ${rotation?.number ?? ""} theme` : "The wheel has spoken"}</p>
                <p className="marquee-glow font-serif text-[clamp(2.5rem,min(5.5vw,10vh),6.5rem)] leading-[1] text-amber-200 break-words">{winner.name}</p>
                {winner.description && <p className="text-[clamp(1.05rem,min(1.7vw,3.4vh),1.75rem)] leading-snug text-zinc-300 whitespace-pre-wrap">{winner.description}</p>}
              </motion.div>
            )}

            {landed && nearMisses.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex flex-col gap-2">
                <p className="slate text-zinc-500">So close</p>
                <div className="flex flex-wrap gap-2">
                  {nearMisses.map((m) => (
                    <span key={m} className="px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-300 text-base">{m}</span>
                  ))}
                </div>
              </motion.div>
            )}

            {error && <p role="alert" className="text-lg text-red-400">{error}</p>}

            {/* Controls */}
            {phase === "ready" && n > 0 && (
              <button type="button" onClick={spin} disabled={busy} autoFocus className="min-h-20 rounded-[1.5rem] bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket font-serif text-4xl cursor-pointer shadow-[0_10px_40px_rgba(125,23,18,0.5)]">
                {busy ? "Spinning…" : finalSpin ? "Spin again" : "Spin"}
              </button>
            )}

            {phase === "decide" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={lockIn} disabled={busy} className="flex-1 min-h-16 rounded-[1.25rem] bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket text-xl font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  <Check className="w-6 h-6" aria-hidden="true" />
                  {busy ? "Locking in…" : "Lock it in"}
                </button>
                <button type="button" onClick={() => setPhase("veto")} disabled={busy || vetoUsed || onlyOneLeft} className="flex-1 min-h-16 rounded-[1.25rem] border-2 border-zinc-600 hover:border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-100 text-xl font-semibold flex items-center justify-center gap-2 cursor-pointer">
                  <RotateCcw className="w-6 h-6" aria-hidden="true" />
                  Veto
                </button>
              </div>
            )}
            {phase === "decide" && onlyOneLeft && <p className="text-zinc-400">It's the only theme on the wheel, so there's nothing to veto it for.</p>}

            {phase === "veto" && (
              <div className="flex flex-col gap-3">
                <p className="text-xl text-zinc-200">Veto "{winner?.name}"? You only get one per rotation, and the next spin is final.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button type="button" onClick={() => veto(false)} disabled={busy} className="flex-1 min-h-16 rounded-[1.25rem] bg-red-700 hover:bg-red-600 disabled:opacity-60 text-ticket text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer">
                    <RotateCcw className="w-5 h-5" aria-hidden="true" />
                    Veto, keep it for later
                  </button>
                  <button type="button" onClick={() => veto(true)} disabled={busy} className="flex-1 min-h-16 rounded-[1.25rem] border-2 border-red-800 hover:bg-red-950 disabled:opacity-60 text-red-300 text-lg font-semibold flex items-center justify-center gap-2 cursor-pointer">
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                    Veto, remove it for good
                  </button>
                </div>
                <button type="button" onClick={() => setPhase("decide")} disabled={busy} className="min-h-12 text-zinc-400 hover:text-zinc-100 font-semibold cursor-pointer">Never mind</button>
              </div>
            )}

            {phase === "locked" && (
              <div className="flex flex-col gap-3">
                <p className="text-xl text-emerald-400">Locked in. The club email is on its way.</p>
                <button type="button" onClick={onClose} className="min-h-14 rounded-[1.25rem] border-2 border-zinc-600 hover:border-amber-500 text-zinc-100 text-lg font-semibold cursor-pointer">Close the wheel</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
