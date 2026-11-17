"use client";

import { useRef, useState } from "react";
import { COPY } from "./copy";

// Before on the right, after on the left, as the reference shows. The handle drags and also
// answers the arrow keys. With no result yet, the photo alone is shown.
export function CompareSlider({ before, after, busy }: { before: string; after: string | null; busy: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50); // percent from the left edge
  const dragging = useRef(false);

  function move(clientX: number) {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(4, Math.min(96, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <div
      ref={box}
      className="relative touch-pan-y select-none overflow-hidden rounded-3xl bg-slate-tint"
      onPointerDown={(e) => { if (!after) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => { if (dragging.current) move(e.clientX); }}
      onPointerUp={() => { dragging.current = false; }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the customer's photo */}
      <img src={before} alt={COPY.beforeAlt} draggable={false} className="block h-auto w-full" />
      {after && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- local data URL of the preview */}
          <img src={after} alt={COPY.afterAlt} draggable={false} className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
          <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${pos}%` }} />
          <div
            role="slider"
            tabIndex={0}
            aria-label={COPY.compareLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") setPos((p) => Math.max(4, p - 5));
              if (e.key === "ArrowRight") setPos((p) => Math.min(96, p + 5));
              if (e.key === "Home") setPos(4);
              if (e.key === "End") setPos(96);
            }}
            className="absolute top-[72%] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-md"
            style={{ left: `${pos}%` }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path d="M8 5 3 10l5 5V5Zm4 0v10l5-5-5-5Z" /></svg>
          </div>
          {pos > 22 && <span className="absolute left-3 top-3 rounded-full bg-teal px-3 py-1 text-sm font-bold text-white">{COPY.after}</span>}
        </>
      )}
      {(!after || pos < 78) && <span className="absolute right-3 top-3 rounded-full bg-ink/70 px-3 py-1 text-sm font-bold text-white">{COPY.before}</span>}
      {busy && (
        <div className="absolute inset-0 grid place-items-center bg-white/65">
          <div className="flex flex-col items-center gap-3 text-ink"><span className="spinner" /><span className="text-sm font-medium">{COPY.working}</span></div>
        </div>
      )}
    </div>
  );
}
