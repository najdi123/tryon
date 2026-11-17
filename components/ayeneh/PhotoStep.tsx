"use client";

import { useRef, useState } from "react";
import { readPhoto, type ReadyPhoto } from "@/lib/client/photo";
import { CAMERA_DENIED, COPY, PHOTO_PROBLEM } from "./copy";
import { IconArrowRight, IconCamera, IconFrame, IconImage } from "./icons";

type Props = { photo: ReadyPhoto | null; onPhoto: (p: ReadyPhoto) => void; onContinue: () => void };

export function PhotoStep({ photo, onPhoto, onContinue }: Props) {
  const selfie = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const r = await readPhoto(file);
    setBusy(false);
    if (r.ok) onPhoto(r.photo);
    else setProblem(PHOTO_PROBLEM[r.problem]);
  }

  // The selfie button opens the phone's camera. If the browser reports the camera as blocked,
  // say so and leave the gallery button working.
  async function openCamera() {
    try {
      const state = await navigator.permissions?.query({ name: "camera" as PermissionName });
      if (state?.state === "denied") {
        setProblem(CAMERA_DENIED);
        return;
      }
    } catch {
      // The permission cannot be read on this browser: the file input still works.
    }
    selfie.current?.click();
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-ink">{COPY.photoTitle}</h2>
        <p className="mt-1 text-[15px] text-ink-3">{COPY.photoSub}</p>
      </div>

      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-line-strong bg-surface">
        {busy ? (
          <div className="flex flex-col items-center gap-3 text-ink-2"><span className="spinner" /><span className="text-sm">{COPY.photoChecking}</span></div>
        ) : photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- a local data URL of the customer's own photo; never sent through the image optimizer
          <img src={photo.dataUrl} alt="عکس شما" className="size-full object-contain" />
        ) : (
          <svg width="150" height="150" viewBox="0 0 150 150" fill="none" stroke="var(--slate)" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M48 96c-10-22-6-58 27-58s37 36 27 58" fill="var(--teal-tint)" />
            <path d="M58 70c0-12 7-20 17-20s17 8 17 20-7 22-17 22-17-10-17-22Z" fill="var(--surface)" />
            <path d="M24 132c2-18 16-26 36-30M126 132c-2-18-16-26-36-30" />
            <rect x="60" y="104" width="30" height="22" rx="5" fill="var(--surface)" /><circle cx="75" cy="115" r="5.5" />
          </svg>
        )}
      </div>

      {problem && <p role="alert" className="rounded-xl bg-danger-tint px-3 py-2.5 text-sm leading-6 text-danger">{problem}</p>}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={busy} onClick={openCamera} className="btn btn-soft"><IconCamera />{COPY.takeSelfie}</button>
        <button type="button" disabled={busy} onClick={() => gallery.current?.click()} className="btn btn-outline"><IconImage />{COPY.fromGallery}</button>
      </div>
      <input ref={selfie} type="file" accept="image/*" capture="user" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ""; }} />

      <h3 className="rule mt-1 text-lg font-bold text-ink">{COPY.hairQuestion}</h3>
      <div className="flex items-center gap-3 rounded-2xl border-2 border-teal bg-teal-tint px-4 py-3">
        <span className="grid size-6 place-items-center rounded-full border-2 border-teal"><span className="size-3 rounded-full bg-teal" /></span>
        <span><span className="block text-[17px] font-bold text-ink">{COPY.myHair}</span><span className="text-sm text-ink-2">{COPY.myHairSub}</span></span>
      </div>
      <div aria-disabled className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 opacity-70">
        <span className="size-6 rounded-full border-2 border-line-strong" />
        <span className="flex-1"><span className="block text-[17px] font-bold text-ink">{COPY.newStyle}</span><span className="text-sm text-ink-2">{COPY.newStyleSub}</span></span>
        <span className="rounded-full bg-slate-tint px-3 py-1 text-xs font-medium text-ink-2">{COPY.soon}</span>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-slate-tint px-3 py-2.5 text-sm text-ink-2"><IconFrame size={20} />{COPY.photoGuide}</p>
      <button type="button" disabled={!photo || busy} onClick={onContinue} className="btn btn-primary w-full">
        {COPY.continueToTry}<IconArrowRight size={20} />
      </button>
    </section>
  );
}
