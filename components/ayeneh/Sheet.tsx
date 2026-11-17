"use client";

import { useEffect, useRef } from "react";
import { COPY } from "./copy";

// A bottom sheet on the page's own surface. Escape and the backdrop close it.
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-t-3xl bg-surface px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] outline-none"
      >
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <div className="mt-3 text-[15px] leading-7 text-ink-2">{children}</div>
      </div>
    </div>
  );
}

export function HelpSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title={COPY.helpTitle} onClose={onClose}>
      <ul className="flex flex-col gap-2.5">
        {COPY.help.map((line) => <li key={line}>{line}</li>)}
      </ul>
      <p className="mt-3 rounded-xl bg-note px-3 py-2 text-[13px] leading-6 text-ink">{COPY.safety}</p>
      <button type="button" onClick={onClose} className="btn btn-outline mt-4 w-full">{COPY.close}</button>
    </Sheet>
  );
}

// Asked once, before the first photo leaves the phone.
export function ConsentSheet({ onAnswer }: { onAnswer: (yes: boolean) => void }) {
  return (
    <Sheet title={COPY.consentTitle} onClose={() => onAnswer(false)}>
      <p>{COPY.consentBody}</p>
      <p className="mt-2 text-[13px] text-ink-3">{COPY.consentLocal}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        <button type="button" onClick={() => onAnswer(true)} className="btn btn-primary w-full">{COPY.consentYes}</button>
        <button type="button" onClick={() => onAnswer(false)} className="btn btn-outline w-full">{COPY.consentNo}</button>
      </div>
    </Sheet>
  );
}
