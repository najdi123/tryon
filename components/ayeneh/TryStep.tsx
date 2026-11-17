"use client";

import { useState } from "react";
import { tryOnAi, track, type CatalogLine, type CatalogShade } from "@/lib/client/api";
import { composeResult } from "@/lib/client/compose";
import type { ReadyPhoto } from "@/lib/client/photo";
import { needsGemini, recolorPrepared } from "@/lib/hair-recolor";
import { imageFileName, saveImage, shareImage } from "@/lib/image-share";
import { CompareSlider } from "./CompareSlider";
import { COPY, TRYON_PROBLEM } from "./copy";
import { IconDownload, IconHair, IconImage, IconInfo, IconShare } from "./icons";
import { ConsentSheet } from "./Sheet";
import { ShadePicker } from "./ShadePicker";

export type Results = Record<string, string>; // shade code → preview data URL, for this photo and line

type Props = {
  line: CatalogLine;
  photo: ReadyPhoto;
  selected: CatalogShade | null;
  results: Results;
  consent: boolean | null; // null: not asked yet
  onSelect: (s: CatalogShade) => void;
  onResult: (code: string, dataUrl: string) => void;
  onConsent: (yes: boolean) => void;
  onChangePhoto: () => void;
};

// Whether this shade on this photo can be made on the phone or needs the image service.
function engineFor(photo: ReadyPhoto, shade: CatalogShade): "local" | "ai" {
  if (!photo.prepared) return "ai";
  return needsGemini(photo.prepared.avgHairLightness, shade.hex) ? "ai" : "local";
}

export function TryStep(p: Props) {
  const { line, photo, selected, results } = p;
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const result = selected ? (results[selected.code] ?? null) : null;
  const about = selected ? { lineKey: line.key, shadeCode: selected.code } : null;

  function select(s: CatalogShade) {
    if (s.code === selected?.code) return;
    setProblem(null);
    p.onSelect(s);
    track("SHADE_SELECTED", { lineKey: line.key, shadeCode: s.code });
  }

  async function run(shade: CatalogShade, consent: boolean | null) {
    setProblem(null);
    const ref = { lineKey: line.key, shadeCode: shade.code };
    if (engineFor(photo, shade) === "local" && photo.prepared) {
      // Made on the phone: nothing is uploaded, and the browser reports the try-on itself.
      track("TRYON_STARTED", { ...ref, status: "local" });
      try {
        p.onResult(shade.code, recolorPrepared(photo.prepared, shade.hex));
        track("TRYON_SUCCEEDED", { ...ref, status: "local" });
      } catch {
        track("TRYON_FAILED", { ...ref, status: "local" });
        setProblem(TRYON_PROBLEM.failed);
      }
      return;
    }
    if (consent === null) return setAsking(true);
    if (consent === false) return setProblem(COPY.consentDeclined);
    setBusy(true);
    const r = await tryOnAi(photo.blob, line.key, shade.code); // the server records this try-on
    setBusy(false);
    if (r.ok) p.onResult(shade.code, r.image);
    else setProblem(TRYON_PROBLEM[r.reason]);
  }

  async function labelled(): Promise<{ url: string; name: string } | null> {
    if (!selected || !result) return null;
    const url = await composeResult(result, { brand: line.nameEn, code: selected.code, nameFa: selected.nameFa });
    return { url, name: imageFileName(`${line.key}-${selected.code}`) };
  }

  async function save() {
    const img = await labelled();
    if (!img || !about) return;
    saveImage(img.url, img.name);
    track("RESULT_DOWNLOADED", about);
  }

  async function share() {
    const img = await labelled();
    if (!img || !selected) return;
    const outcome = await shareImage(img.url, img.name, `${selected.nameFa} · ${selected.code} · ${line.nameEn}`);
    if (outcome === "unsupported") saveImage(img.url, img.name);
  }

  const needsLightening = selected !== null && engineFor(photo, selected) === "ai";

  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="rule text-xl font-bold text-ink">{COPY.tryTitle}</h2>
      <CompareSlider before={photo.dataUrl} after={result} busy={busy} />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={p.onChangePhoto} className="btn bg-slate-tint text-ink"><IconImage />{COPY.changePhoto}</button>
        <button type="button" disabled className="btn bg-slate-tint text-ink-3"><IconHair />{COPY.changeStyle}<span className="text-xs font-medium">({COPY.soon})</span></button>
      </div>

      <div className="scroll-x -mx-4 flex items-center gap-2 px-4">
        <span className="shrink-0 pe-1 text-[15px] font-bold text-ink">{COPY.method}</span>
        {COPY.methods.map((m, i) => (
          <button key={m} type="button" className="chip" aria-pressed={i === 0} disabled={i > 0} title={i > 0 ? COPY.soon : undefined}>{m}</button>
        ))}
      </div>

      <ShadePicker line={line} selected={selected} onSelect={select} />

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-strong bg-surface px-4 py-3">
        <div>
          <p className="text-[13px] text-ink-3">{COPY.selected}</p>
          <p className="text-lg font-bold text-ink">{selected ? selected.nameFa : COPY.pickFirst}</p>
        </div>
        {selected && <span dir="ltr" className="num rounded-full bg-slate-tint px-4 py-1.5 text-[15px] font-bold text-ink-2">{selected.code}</span>}
      </div>

      {selected && !result && (
        <button type="button" disabled={busy} onClick={() => void run(selected, p.consent)} className="btn btn-primary w-full">
          {busy ? COPY.working : COPY.tryThis}
        </button>
      )}
      {problem && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl bg-danger-tint px-3 py-2.5 text-sm leading-6 text-danger">
          <span>{problem}</span>
          {selected && p.consent !== false && (
            <button type="button" onClick={() => void run(selected, p.consent)} className="self-start font-bold underline">{COPY.retry}</button>
          )}
        </div>
      )}
      {needsLightening && <p className="flex items-start gap-2 rounded-xl bg-note px-3 py-2.5 text-sm leading-6 text-ink"><span className="mt-0.5 shrink-0"><IconInfo size={20} /></span>{COPY.lightenNote}</p>}
      <p className="text-center text-[13px] text-ink-3">{COPY.dependsNote}</p>

      {result && (
        <>
          <div className="grid grid-cols-[1.7fr_1fr] gap-3">
            <button type="button" onClick={() => void save()} className="btn btn-primary"><IconDownload />{COPY.save}</button>
            <button type="button" onClick={() => void share()} className="btn btn-outline"><IconShare />{COPY.share}</button>
          </div>
          <p className="text-center text-[13px] text-ink-3">{COPY.previewNote}</p>
          <p className="rounded-xl bg-slate-tint px-3 py-2.5 text-[13px] leading-6 text-ink-2">{COPY.safety}</p>
        </>
      )}

      {asking && selected && (
        <ConsentSheet
          onAnswer={(yes) => {
            setAsking(false);
            p.onConsent(yes);
            void run(selected, yes);
          }}
        />
      )}
    </section>
  );
}
