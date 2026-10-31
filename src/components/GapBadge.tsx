import React from "react";
import { Award } from "lucide-react";

const SIZES = {
  sm: { box: "w-4 h-4 border", icon: "w-2.5 h-2.5" },
  md: { box: "w-5 h-5 border-2", icon: "w-3 h-3" },
  lg: { box: "w-7 h-7 border-2", icon: "w-4 h-4" },
  xl: { box: "w-20 h-20 border-4", icon: "w-11 h-11" },
};

export const GAP_BADGE_TITLE = "Filled in every night lost in the data loss";

// The award a member earns by filling in every night lost in the data loss
export default function GapBadge({ size = "md", className = "" }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <span title={GAP_BADGE_TITLE} className={`${s.box} rounded-full bg-amber-500 border-zinc-950 text-zinc-950 flex items-center justify-center shrink-0 ${className}`}>
      <Award className={s.icon} aria-hidden="true" />
    </span>
  );
}

// Pins the badge to the bottom-right of a profile photo
export function WithGapBadge({ show, size = "md", children }: { show: boolean; size?: keyof typeof SIZES; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      {show && (
        <>
          <GapBadge size={size} className="absolute -bottom-0.5 -right-0.5" />
          <span className="sr-only">{GAP_BADGE_TITLE}</span>
        </>
      )}
    </span>
  );
}
