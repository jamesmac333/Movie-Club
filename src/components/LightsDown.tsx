import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MovieNight } from "../types.ts";
import { showingNow } from "../clubStats.ts";

// On a club night, from 7 pm, the edges of Home dim like a cinema before the film.
// It sits behind everything and never blocks a tap.
export default function LightsDown({ nights }: { nights: MovieNight[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const showing = showingNow(nights, now);

  return (
    <AnimatePresence>
      {showing && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: "easeInOut" }}
          className="pointer-events-none fixed inset-0 z-20 bg-[radial-gradient(ellipse_at_50%_35%,transparent_35%,rgba(0,0,0,0.75)_100%)]"
        />
      )}
    </AnimatePresence>
  );
}

// A row of marquee bulbs that switch on one by one, then chase
export function MarqueeBulbs({ count = 18 }: { count?: number }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex justify-between px-1" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: reduce ? 1 : 0.15 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, delay: reduce ? 0 : 0.4 + i * 0.07 }}
          className="marquee-bulb w-2 h-2 rounded-full bg-amber-300"
          style={{ animationDelay: `${1.8 + (i % 3) * 0.4}s` }}
        />
      ))}
    </div>
  );
}
