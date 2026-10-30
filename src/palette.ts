import { useEffect, useState } from "react";

// The club's own palette (from "Her"), used when a film has no poster to sample
export const CLUB_PALETTE = ["#121310", "#2e1b12", "#5a3a2b", "#8c6e5a", "#7d1712", "#e3be8a", "#afaf98", "#6f8c83", "#2f4a55", "#1c2626"];

const cache = new Map<string, string[]>();

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const luminance = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const distance = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Picks the most common distinct colours in an image, darkest first
function extractPalette(img: HTMLImageElement, count: number): string[] {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 72;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Group pixels into coarse colour buckets and average each bucket
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  const ranked = [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .map((x) => [Math.round(x.r / x.n), Math.round(x.g / x.n), Math.round(x.b / x.n)]);

  // Keep colours that are clearly different from ones already chosen
  const chosen: number[][] = [];
  for (const minGap of [60, 40, 20]) {
    for (const c of ranked) {
      if (chosen.length >= count) break;
      if (chosen.every((p) => distance(p, c) >= minGap)) chosen.push(c);
    }
    if (chosen.length >= count) break;
  }
  return chosen.sort((a, b) => luminance(a) - luminance(b)).map(([r, g, b]) => toHex(r, g, b));
}

// Colours sampled from a poster image; null until loaded (or if it can't be read)
export function usePosterPalette(url?: string | null, count = 7): string[] | null {
  const [palette, setPalette] = useState<string[] | null>(url ? cache.get(url) || null : null);

  useEffect(() => {
    if (!url || !/^https?:\/\//.test(url)) {
      setPalette(null);
      return;
    }
    if (cache.has(url)) {
      setPalette(cache.get(url)!);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      try {
        const colours = extractPalette(img, count);
        if (colours.length) cache.set(url, colours);
        if (!cancelled) setPalette(colours.length ? colours : null);
      } catch {
        if (!cancelled) setPalette(null);
      }
    };
    img.onerror = () => !cancelled && setPalette(null);
    // A separate address from the visible poster, so the browser doesn't reuse a cached
    // copy that was fetched without the cross-origin permission needed to read its pixels
    img.src = url + (url.includes("?") ? "&" : "?") + "palette=1";
    return () => {
      cancelled = true;
    };
  }, [url, count]);

  return palette;
}
