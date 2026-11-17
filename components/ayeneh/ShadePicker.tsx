"use client";

import { useMemo, useState } from "react";
import type { CatalogLine, CatalogShade } from "@/lib/client/api";
import HairLock from "@/components/HairLock";
import { COPY } from "./copy";
import { IconSearch } from "./icons";

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
// "۷/۳", "7.3" and "7/3" all find the same code; Arabic and Persian letter forms match each other.
function fold(v: string): string {
  return v
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/‌/g, " ")
    .replace(/[./]/g, ".")
    .trim().toLowerCase();
}

type Props = { line: CatalogLine; selected: CatalogShade | null; onSelect: (s: CatalogShade) => void };

// Search by name or code, the colour families as chips, and the shades as a row of locks.
export function ShadePicker({ line, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | null>(null);
  const shades = useMemo(() => {
    const q = fold(query);
    const hits = line.shades.filter((s) => (family === null || s.familyKey === family) && (q === "" || fold(s.code).includes(q) || fold(s.nameFa).includes(q)));
    if (q === "") return hits;
    // A code that starts with what was typed comes first: "4" finds 4 and 4.2 before 7.54.
    const rank = (code: string) => (fold(code) === q ? 0 : fold(code).startsWith(q) ? 1 : 2);
    return [...hits].sort((a, b) => rank(a.code) - rank(b.code));
  }, [line, query, family]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-line-strong bg-surface px-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={COPY.searchPlaceholder}
          aria-label={COPY.searchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
        />
        <span className="text-ink-2"><IconSearch /></span>
      </label>

      <div className="scroll-x -mx-4 flex gap-2 px-4">
        <button type="button" className="chip" aria-pressed={family === null} onClick={() => setFamily(null)}>{COPY.all}</button>
        {line.families.map((f) => (
          <button key={f.key} type="button" className="chip" aria-pressed={family === f.key} onClick={() => setFamily(f.key)}>{f.nameFa}</button>
        ))}
      </div>

      {shades.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{COPY.noMatch}</p>
      ) : (
        <ul className="scroll-x -mx-4 flex gap-1 px-4 pb-1">
          {shades.map((s) => {
            const on = selected?.code === s.code;
            return (
              <li key={s.code}>
                <button type="button" aria-pressed={on} onClick={() => onSelect(s)} className="flex w-[84px] flex-col items-center gap-1 rounded-2xl px-1 py-2">
                  <span className={`grid size-[68px] place-items-center rounded-full border-[3px] ${on ? "border-teal" : "border-transparent"}`}>
                    <HairLock hex={s.hex} size={44} seed={`${line.key}-${s.code}`} />
                  </span>
                  <span dir="ltr" className="num text-[15px] font-bold text-ink">{s.code}</span>
                  <span className={`line-clamp-2 text-center text-[12px] leading-4 ${on ? "font-bold text-ink" : "text-ink-2"}`}>{s.nameFa}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
