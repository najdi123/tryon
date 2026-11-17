"use client";

import { useEffect, useState } from "react";
import { tryOnAi, track, type CatalogLine, type CatalogShade } from "@/lib/client/api";
import { composeResult } from "@/lib/client/compose";
import type { ReadyPhoto } from "@/lib/client/photo";
import { lightnessGap, needsGemini, recolorPrepared } from "@/lib/hair-recolor";
import { imageFileName, saveImage, shareImage } from "@/lib/image-share";
import { CompareSlider } from "./CompareSlider";
import { COPY, TRYON_PROBLEM } from "./copy";
import { IconDownload, IconHair, IconImage, IconInfo, IconShare } from "./icons";
import { ConsentSheet } from "./Sheet";
import { ShadePicker } from "./ShadePicker";

// A preview belongs to one line, one photo and one shade: the same code in two lines is two
// products, and an answer that arrives after the photo or the line changed is never shown.
export type Results = Record<string, string>;
export const resultKey = (lineKey: string, photoId: string, code: string) => `${lineKey}|${photoId}|${code}`;

type Props = {
  line: CatalogLine;
  photo: ReadyPhoto;
  selected: CatalogShade | null;
  results: Results;
  pending: string | null; // the result key being made by the image service, if any
  consent: boolean | null; // for this photo; null: not asked yet
  aiAvailable: boolean;
  onSelect: (s: CatalogShade) => void;
  onResult: (key: string, dataUrl: string) => void;
  onPending: (key: string | null) => void;
  onConsent: (answer: boolean | null) => void;
  onChangePhoto: () => void;
};

// Whether this shade on this photo can be made on the phone or needs the image service.
function engineFor(photo: ReadyPhoto, shade: CatalogShade): "local" | "ai" {
  if (!photo.prepared) return "ai";
  return needsGemini(photo.prepared.avgHairLightness, shade.hex) ? "ai" : "local";
}

export function TryStep(p: Props) {
  const { line, photo, selected, results, aiAvailable } = p;
  const [problem, setProblem] = useState<{ text: string; kind: "error" | "declined" } | null>(null);
  const [asking, setAsking] = useState(false);
  const [labelled, setLabelled] = useState<{ key: string; url: string } | null>(null);
  const key = selected ? resultKey(line.key, photo.id, selected.code) : null;
  const result = key ? (results[key] ?? null) : null;
  const busy = p.pending !== null;
  const canLocal = photo.prepared !== null;
  const engine = selected ? engineFor(photo, selected) : null;
  const unavailable = engine === "ai" && !aiAvailable; // said before any consent or upload

  // The labelled picture is drawn as soon as a result exists, so Save and Share act at once on the tap.
  useEffect(() => {
    if (!key || !result || !selected) return;
    let live = true;
    composeResult(result, { brand: line.nameEn, code: selected.code, nameFa: selected.nameFa })
      .then((url) => { if (live) setLabelled({ key, url }); })
      .catch(() => { if (live) setLabelled({ key, url: result }); });
    return () => { live = false; };
  }, [key, result, selected, line.nameEn]);
  const ready = labelled && labelled.key === key ? labelled.url : null;

  function select(s: CatalogShade) {
    if (s.code === selected?.code) return;
    setProblem(null);
    p.onSelect(s);
    track("SHADE_SELECTED", { lineKey: line.key, shadeCode: s.code });
  }

  async function run(shade: CatalogShade, consent: boolean | null) {
    if (busy) return;
    setProblem(null);
    const ref = { lineKey: line.key, shadeCode: shade.code };
    const k = resultKey(line.key, photo.id, shade.code);
    if (engineFor(photo, shade) === "local" && photo.prepared) {
      // Made on the phone: nothing is uploaded, and the browser reports the try-on itself.
      track("TRYON_STARTED", { ...ref, status: "local" });
      try {
        const url = recolorPrepared(photo.prepared, shade.hex);
        if (!url.startsWith("data:image/")) throw new Error("empty");
        p.onResult(k, url);
        track("TRYON_SUCCEEDED", { ...ref, status: "local" });
      } catch {
        track("TRYON_FAILED", { ...ref, status: "local" });
        setProblem({ text: TRYON_PROBLEM.failed, kind: "error" });
      }
      return;
    }
    if (!aiAvailable) return;
    if (consent === null) return setAsking(true);
    if (consent === false) return setProblem({ text: `${COPY.consentDeclined}${canLocal ? ` ${COPY.consentDeclinedLocal}` : ""}`, kind: "declined" });
    p.onPending(k);
    const r = await tryOnAi(photo.blob, line.key, shade.code); // the server records this try-on
    p.onPending(null);
    if (r.ok) p.onResult(k, r.image);
    else setProblem({ text: TRYON_PROBLEM[r.reason], kind: "error" });
  }

  function save() {
    if (!ready || !selected) return;
    saveImage(ready, imageFileName(`${line.key}-${selected.code}`));
    track("RESULT_DOWNLOADED", { lineKey: line.key, shadeCode: selected.code, status: "save" });
  }

  async function share() {
    if (!ready || !selected) return;
    const name = imageFileName(`${line.key}-${selected.code}`);
    const about = { lineKey: line.key, shadeCode: selected.code };
    const outcome = await shareImage(ready, name, `${selected.nameFa} · ${selected.code} · ${line.nameEn}`);
    if (outcome === "shared") track("RESULT_DOWNLOADED", { ...about, status: "share" });
    if (outcome === "unsupported") {
      saveImage(ready, name);
      track("RESULT_DOWNLOADED", { ...about, status: "save" });
    }
  }

  // The lightening note is about the hair, not about which engine runs.
  const lightens = selected !== null && (photo.prepared ? lightnessGap(photo.prepared.avgHairLightness, selected.hex) > 0.12 : false);

  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="rule text-xl font-bold text-ink">{COPY.tryTitle}</h2>
      <CompareSlider before={photo.dataUrl} after={result} busy={busy} />

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={p.onChangePhoto} className="btn bg-slate-tint text-ink"><IconImage />{COPY.changePhoto}</button>
        <button type="button" disabled className="btn flex-col gap-0 bg-slate-tint text-ink-3">
          <span className="flex items-center gap-2"><IconHair size={20} />{COPY.changeStyle}</span>
          <span className="text-xs font-medium">{COPY.soon}</span>
        </button>
      </div>

      <div className="scroll-x -mx-4 flex items-center gap-2 px-4">
        <span className="shrink-0 pe-1 text-[15px] font-bold text-ink">{COPY.method}</span>
        {COPY.methods.map((m, i) => (
          <button key={m} type="button" className="chip gap-1.5" aria-pressed={i === 0} disabled={i > 0}>
            {m}{i > 0 && <span className="text-xs">({COPY.soon})</span>}
          </button>
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

      {selected && !result && unavailable && (
        <p role="status" className="rounded-xl bg-slate-tint px-3 py-2.5 text-sm leading-6 text-ink-2">
          {COPY.noEngine}{canLocal ? ` ${COPY.noEngineLocal}` : ""}
        </p>
      )}
      {selected && !result && !unavailable && (
        <button type="button" disabled={busy} onClick={() => void run(selected, p.consent)} className="btn btn-primary w-full">
          {busy ? COPY.working : COPY.tryThis}
        </button>
      )}
      {problem && (
        <div role="alert" className="flex flex-col gap-1 rounded-xl bg-danger-tint px-3 py-2.5 text-sm leading-6 text-danger">
          <span>{problem.text}</span>
          {selected && problem.kind === "error" && (
            <button type="button" onClick={() => void run(selected, p.consent)} className="min-h-11 self-start font-bold underline">{COPY.retry}</button>
          )}
          {selected && problem.kind === "declined" && (
            <button type="button" onClick={() => { setProblem(null); setAsking(true); }} className="min-h-11 self-start font-bold underline">{COPY.consentReconsider}</button>
          )}
        </div>
      )}
      {lightens && <p className="flex items-start gap-2 rounded-xl bg-note px-3 py-2.5 text-sm leading-6 text-ink"><span className="mt-0.5 shrink-0"><IconInfo size={20} /></span>{COPY.lightenNote}</p>}
      <p className="text-center text-[13px] text-ink-3">{COPY.dependsNote}</p>

      {result && (
        <>
          <div className="grid grid-cols-[1.7fr_1fr] gap-3">
            <button type="button" disabled={!ready} onClick={save} className="btn btn-primary"><IconDownload />{COPY.save}</button>
            <button type="button" disabled={!ready} onClick={() => void share()} className="btn btn-outline"><IconShare />{COPY.share}</button>
          </div>
          <p className="text-center text-[13px] text-ink-3">{COPY.previewNote}</p>
          <p className="rounded-xl bg-slate-tint px-3 py-2.5 text-[13px] leading-6 text-ink-2">{COPY.safety}</p>
        </>
      )}

      {asking && selected && (
        <ConsentSheet
          canLocal={canLocal}
          onDismiss={() => setAsking(false)}
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
