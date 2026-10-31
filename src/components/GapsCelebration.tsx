import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { CLUB_PALETTE } from "../palette.ts";
import GapBadge from "./GapBadge.tsx";

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// Fireworks in the club's colours, bursting at random over the screen for a few seconds
function useFireworks(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scale = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * scale;
      canvas.height = window.innerHeight * scale;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colours = [...CLUB_PALETTE, "#f59e0b", "#f4e6cc"];
    const sparks: Spark[] = [];
    const burst = () => {
      const x = window.innerWidth * (0.15 + Math.random() * 0.7);
      const y = window.innerHeight * (0.12 + Math.random() * 0.4);
      const color = colours[Math.floor(Math.random() * colours.length)];
      for (let i = 0; i < 90; i++) {
        const angle = (Math.PI * 2 * i) / 90;
        const speed = 2 + Math.random() * 3.5;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
      }
    };

    const started = performance.now();
    let nextBurst = 0;
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - started;
      if (elapsed < 4500 && elapsed >= nextBurst) {
        burst();
        nextBurst = elapsed + 350 + Math.random() * 400;
      }
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.06;
        s.vx *= 0.985;
        s.life -= 0.01;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = s.life;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (elapsed < 4500 || sparks.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

// Shown once, when a member finishes rating and reviewing every night lost in the data loss
export default function GapsCelebration({ firstName, filmCount, onClose }: { firstName: string; filmCount: number; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFireworks(canvasRef);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5">
      <motion.div className="absolute inset-0 bg-black/80" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 w-full h-full pointer-events-none" />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gaps-done-title"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="relative w-full max-w-sm bg-zinc-900 border border-amber-800 rounded-3xl p-6 flex flex-col items-center text-center gap-4"
      >
        <GapBadge size="xl" />
        <h2 id="gaps-done-title" className="font-serif text-3xl text-zinc-50 leading-tight">That's every gap filled</h2>
        <p className="text-zinc-300">
          Thanks, {firstName}. All {filmCount} lost nights have your rating and review again, so the club's history is back in one piece.
        </p>
        <p className="text-sm text-amber-500">This badge now sits on your profile photo.</p>
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="mt-2 w-full min-h-14 rounded-2xl bg-red-700 hover:bg-red-600 text-ticket font-semibold text-lg cursor-pointer"
        >
          Done
        </button>
      </motion.div>
    </div>,
    document.body
  );
}
