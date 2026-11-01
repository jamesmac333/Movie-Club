import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "motion/react";
import { Award, Star } from "lucide-react";

// Small animations shared across the site. Each one is short, plays when something
// happens (not on every scroll), and falls back to a plain fade or no motion at all
// when the phone's Reduce Motion setting is on.

// A number that ticks up from zero the first time it scrolls into view
export function CountUp({ to, format = (n) => String(Math.round(n)), duration = 1.1 }: { to: number; format?: (n: number) => string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? to : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setValue(to);
      return;
    }
    const controls = animate(0, to, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setValue });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {/* Screen readers get the final value straight away */}
      <span aria-hidden="true">{format(value)}</span>
      <span className="sr-only">{format(to)}</span>
    </span>
  );
}

const STAR_SIZES = { sm: "w-3 h-3", md: "w-4 h-4" };

// Five stars that fill one at a time, left to right, when they first come into view.
// A half star fills to its middle.
export function StarRow({ rating, size = "md", emptyClass = "text-zinc-600" }: { rating: number; size?: keyof typeof STAR_SIZES; emptyClass?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20px" });
  const reduce = useReducedMotion();
  const cls = STAR_SIZES[size];

  return (
    <span ref={ref} className="flex items-center gap-0.5 shrink-0" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n, i) => {
        const fill = rating >= n ? 1 : rating >= n - 0.5 ? 0.5 : 0;
        const shown = `inset(0 ${(1 - fill) * 100}% 0 0)`;
        return (
          <span key={n} className={`relative ${cls}`}>
            <Star className={`absolute inset-0 ${cls} ${emptyClass}`} />
            {fill > 0 && (
              <motion.span
                className="absolute inset-0"
                initial={{ clipPath: reduce ? shown : "inset(0 100% 0 0)" }}
                animate={inView ? { clipPath: shown } : undefined}
                transition={{ duration: 0.22, delay: 0.15 + i * 0.09, ease: "easeOut" }}
              >
                <Star className={`${cls} text-amber-500 fill-amber-500`} />
              </motion.span>
            )}
          </span>
        );
      })}
    </span>
  );
}

// "Ash's favourite": thumps down like a rubber stamp when it first appears.
// Wrap it in <AnimatePresence initial={false}> so it only stamps when Ash picks a review,
// not every time a page with a favourite opens.
export function FavouriteStamp({ big = false }: { big?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.span
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: -24 }}
      animate={{ opacity: 1, scale: 1, rotate: -4 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 520, damping: 17, mass: 0.8 }}
      className={`inline-flex items-center gap-1 rounded-md border-2 border-amber-500 text-amber-500 font-semibold uppercase tracking-wide shrink-0 ${
        big ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-xs"
      }`}
    >
      <Award className={big ? "w-4 h-4" : "w-3.5 h-3.5"} aria-hidden="true" />
      Ash's favourite
    </motion.span>
  );
}

// The nights whose reviews were just unlocked by the member posting their own,
// so the newly visible reviews can be dealt out like cards. Pass the nights that are still sealed.
export function useJustRevealed(sealedIds: string[]): Set<string> {
  const key = [...sealedIds].sort().join(",");
  const previous = useRef(key);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  useEffect(() => {
    const before = previous.current ? previous.current.split(",") : [];
    previous.current = key;
    const now = new Set(key ? key.split(",") : []);
    const opened = before.filter((id) => !now.has(id));
    if (!opened.length) return;
    setRevealed(new Set(opened));
    const timer = setTimeout(() => setRevealed(new Set()), 4000);
    return () => clearTimeout(timer);
  }, [key]);
  return revealed;
}

// Motion props for the i-th dealt card: it flips over from face down
export function dealt(i: number, dealing: boolean, reduce: boolean | null) {
  if (!dealing) return {};
  if (reduce) return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.3, delay: i * 0.08 } };
  return {
    initial: { opacity: 0, rotateY: 90, y: 24 },
    animate: { opacity: 1, rotateY: 0, y: 0 },
    transition: { duration: 0.45, delay: 0.2 + i * 0.18, ease: [0.2, 0.8, 0.3, 1] },
    style: { transformPerspective: 900 }
  };
}

// Text that turns over like a flip clock whenever it changes
export function FlipText({ text, className = "" }: { text: string; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom [perspective:400px] ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={text}
          initial={reduce ? { opacity: 0 } : { rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="inline-block origin-center"
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
