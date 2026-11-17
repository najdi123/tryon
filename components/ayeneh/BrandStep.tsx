"use client";

import Image from "next/image";
import type { CatalogLine } from "@/lib/client/api";
import { COPY } from "./copy";
import { IconChevron } from "./icons";

// How each line's card looks. The wordmarks are set in type: no box art is used
// until the brands supply their own.
const CARD: Record<string, { bg: string; ink: string; word: string; sub?: string }> = {
  bianca: { bg: "var(--card-bianca)", ink: "var(--ink)", word: "BiancaColor" },
  "oyster-perlacolor": { bg: "var(--card-oyster)", ink: "#ffffff", word: "Oyster", sub: "PERMANENT" },
  "oyster-no-ammonia": { bg: "var(--card-noammonia)", ink: "var(--ink)", word: "Oyster", sub: "NO AMMONIA" },
};

export function BrandStep({ lines, onPick }: { lines: CatalogLine[]; onPick: (l: CatalogLine) => void }) {
  return (
    <section className="flex flex-col gap-5">
      <p className="text-center text-[22px] font-bold leading-9 text-ink [text-wrap:balance]">{COPY.heroTitle}</p>
      <div className="relative overflow-hidden rounded-3xl">
        <Image src="/hero-before-after.jpg" alt={COPY.heroAlt} width={890} height={409} preload className="h-auto w-full" />
      </div>
      <h2 className="rule text-xl font-bold text-ink">{COPY.chooseBrand}</h2>
      {lines.length === 0 && <p className="py-6 text-center text-ink-2">{COPY.emptyCatalog}</p>}
      <ul className="flex flex-col gap-3">
        {lines.map((l) => {
          const c = CARD[l.key] ?? CARD.bianca;
          return (
            <li key={l.key}>
              <button
                type="button"
                onClick={() => onPick(l)}
                style={{ background: c.bg, color: c.ink }}
                className="flex min-h-[104px] w-full items-center gap-4 rounded-3xl px-5 py-4 text-center"
              >
                <span className="flex flex-1 flex-col items-center gap-1">
                  <span dir="ltr" className="text-[30px] font-light leading-none tracking-tight">{c.word}</span>
                  {c.sub && <span dir="ltr" className="text-[12px] font-bold uppercase tracking-[0.3em]">{c.sub}</span>}
                  <span className="mt-1 text-lg font-bold">{COPY.lineTitle[l.key] ?? l.nameFa}</span>
                </span>
                <span className="h-12 w-px bg-current opacity-25" />
                <IconChevron size={26} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
