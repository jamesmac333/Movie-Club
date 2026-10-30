import React from "react";
import { usePosterPalette, CLUB_PALETTE } from "../palette.ts";

interface PaletteStripProps {
  posterUrl?: string | null;
  colors?: string[];
  className?: string;
  count?: number;
}

// A strip of a film's colours, sampled from its poster (or the club palette)
export default function PaletteStrip({ posterUrl, colors, className = "h-2 rounded", count = 7 }: PaletteStripProps) {
  const sampled = usePosterPalette(colors ? null : posterUrl, count);
  const shown = colors || sampled || (posterUrl ? null : CLUB_PALETTE);
  if (!shown) return <div aria-hidden="true" className={`${className} bg-zinc-800`} />;
  return (
    <div aria-hidden="true" className={`flex overflow-hidden ${className}`}>
      {shown.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  );
}
