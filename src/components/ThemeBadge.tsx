import React from "react";
import { Sparkles } from "lucide-react";

// The rotation's theme, shown on nights so everyone can see it at a glance
export default function ThemeBadge({ name, number, className = "" }: { name: string; number?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 max-w-full min-h-7 px-2.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold ${className}`}>
      <Sparkles className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{number ? `Rotation ${number} · ` : "Theme: "}{name}</span>
    </span>
  );
}
