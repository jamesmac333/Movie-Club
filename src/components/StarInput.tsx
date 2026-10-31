import React, { useRef, useState } from "react";

interface StarInputProps {
  value: number;
  // Called once the member lets go, with a rating from ½ to 5 in half steps
  onChange: (rating: number) => void;
  label: string;
  size?: "lg" | "md";
  disabled?: boolean;
}

const SIZES = {
  lg: { star: "w-14 h-14", glyph: "text-5xl" },
  md: { star: "w-11 h-11", glyph: "text-4xl" },
};

// Turns a finger or mouse position into a rating: the left half of a star is a half,
// the right half is a whole star
function ratingAt(el: HTMLElement, clientX: number): number {
  // Measured from the stars themselves, in case the layout stretches the control wider
  const left = (el.firstElementChild as HTMLElement).getBoundingClientRect().left;
  const right = (el.lastElementChild as HTMLElement).getBoundingClientRect().right;
  const position = ((clientX - left) / (right - left)) * 5;
  return Math.min(5, Math.max(0.5, Math.ceil(position * 2) / 2));
}

// Five stars for giving a rating. Tap a star's left half for a half star or its right half
// for a whole one, or slide a finger along the stars and let go on the rating you want.
export default function StarInput({ value, onChange, label, size = "md", disabled = false }: StarInputProps) {
  const ref = useRef<HTMLDivElement>(null);
  // While a finger is down, the stars follow it without saving anything
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? value;
  const { star, glyph } = SIZES[size];

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || !ref.current) return;
    ref.current.setPointerCapture(e.pointerId);
    setPreview(ratingAt(ref.current, e.clientX));
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (preview === null || !ref.current) return;
    setPreview(ratingAt(ref.current, e.clientX));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (preview === null || !ref.current) return;
    const rating = ratingAt(ref.current, e.clientX);
    setPreview(null);
    onChange(rating);
  };
  // The page started scrolling instead: leave the rating as it was
  const onPointerCancel = () => setPreview(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.5 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.5 : 0;
    if (!step) return;
    e.preventDefault();
    onChange(Math.min(5, Math.max(0.5, (value || 0) + step)));
  };

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={0.5}
      aria-valuemax={5}
      aria-valuenow={shown || undefined}
      aria-valuetext={shown ? `${shown} out of 5 stars` : "Not rated"}
      aria-disabled={disabled || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      // Sideways slides set the rating; up and down still scroll the page
      style={{ touchAction: "pan-y" }}
      className={`inline-flex w-fit self-start select-none rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${disabled ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = shown >= n ? "100%" : shown >= n - 0.5 ? "50%" : "0%";
        return (
          <span key={n} aria-hidden="true" className={`relative ${star} ${glyph} leading-none flex items-center justify-center`}>
            <span className="text-zinc-700">★</span>
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="relative">
                <span className="invisible">★</span>
                <span className="absolute inset-y-0 left-0 overflow-hidden text-amber-500" style={{ width: fill }}>★</span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
