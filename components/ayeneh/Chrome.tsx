"use client";

import { COPY } from "./copy";
import { IconArrowLeft, IconCheck, IconChevron, IconHelp, IconLock, Mirror } from "./icons";
import { toFaDigits } from "@/lib/fa";

export type Step = 0 | 1 | 2;

export function Header({ onBack, onHelp }: { onBack?: () => void; onHelp: () => void }) {
  return (
    <header className="flex items-center justify-between pt-4">
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={COPY.back} className="grid size-11 place-items-center rounded-full text-ink">
          <IconArrowLeft size={26} />
        </button>
      ) : (
        <span className="size-11" />
      )}
      <div className="flex items-center gap-2">
        <h1 className="text-[28px] font-bold leading-none text-ink">{COPY.appName}</h1>
        <Mirror size={30} />
      </div>
      <button type="button" onClick={onHelp} aria-label={COPY.helpTitle} className="grid size-11 place-items-center rounded-full text-ink-2">
        <IconHelp size={26} />
      </button>
    </header>
  );
}

// The three steps. A finished step is a button back to it; a later step is not reachable.
export function Stepper({ step, onGo }: { step: Step; onGo: (s: Step) => void }) {
  return (
    <nav aria-label={COPY.stepsLabel} className="flex items-center gap-1.5">
      {COPY.steps.map((label, i) => {
        const done = i < step;
        const current = i === step;
        const cls = current
          ? "bg-teal text-white font-bold"
          : done
            ? "bg-teal-tint text-ink font-medium"
            : "bg-slate-tint text-ink-3 font-medium";
        return (
          <button
            key={label}
            type="button"
            disabled={!done}
            aria-current={current ? "step" : undefined}
            onClick={() => onGo(i as Step)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] ${cls}`}
          >
            {done && <span className="grid size-5 place-items-center rounded-full bg-teal text-white"><IconCheck size={13} /></span>}
            <span className="num whitespace-nowrap">{toFaDigits(i + 1)}. {label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function BrandBar({ nameEn, onChange }: { nameEn: string; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line-strong bg-surface p-1.5">
      <span dir="ltr" className="rounded-xl bg-teal-soft px-4 py-2 text-[15px] font-bold text-ink">{nameEn}</span>
      <button type="button" onClick={onChange} className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-medium text-ink-2">
        {COPY.changeBrand}
        <IconChevron size={18} />
      </button>
    </div>
  );
}

export function FootNotes({ gallery }: { gallery: { name: string; city: string } | null }) {
  return (
    <footer className="mt-auto border-t border-line pt-3 pb-5 text-[12px] text-ink-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-1.5"><IconLock size={15} />{COPY.footPhoto}</span>
        <span>{COPY.footPreview}</span>
      </div>
      {gallery && <p className="mt-1.5 text-center">{COPY.galleryFrom} {gallery.name}، {gallery.city}</p>}
    </footer>
  );
}
