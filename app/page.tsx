"use client";

import { useCallback, useEffect, useState } from "react";
import { BrandStep } from "@/components/ayeneh/BrandStep";
import { BrandBar, FootNotes, Header, Stepper, type Step } from "@/components/ayeneh/Chrome";
import { COPY } from "@/components/ayeneh/copy";
import { PhotoStep } from "@/components/ayeneh/PhotoStep";
import { HelpSheet } from "@/components/ayeneh/Sheet";
import { TryStep, type Results } from "@/components/ayeneh/TryStep";
import { ensureSession, loadCatalog, track, type CatalogLine, type CatalogShade, type GalleryInfo } from "@/lib/client/api";
import type { ReadyPhoto } from "@/lib/client/photo";

// The three steps live on one page and in the browser's history, so the phone's back button
// walks them and every earlier choice (brand, photo, shade, previews) is still there.
export default function Home() {
  const [step, setStep] = useState<Step>(0);
  const [lines, setLines] = useState<CatalogLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [gallery, setGallery] = useState<GalleryInfo>(null);
  const [line, setLine] = useState<CatalogLine | null>(null);
  const [photo, setPhoto] = useState<ReadyPhoto | null>(null);
  const [selected, setSelected] = useState<CatalogShade | null>(null);
  const [results, setResults] = useState<Results>({});
  const [consent, setConsent] = useState<boolean | null>(null);
  const [help, setHelp] = useState(false);

  const load = useCallback(() => {
    loadCatalog()
      .then((l) => {
        setLines(l);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    void ensureSession().then(setGallery);
    load();
    window.history.replaceState({ step: 0 }, "");
    const pop = (e: PopStateEvent) => setStep(((e.state as { step?: Step } | null)?.step ?? 0) as Step);
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [load]);

  function forward(to: Step) {
    window.history.pushState({ step: to }, "");
    setStep(to);
    window.scrollTo({ top: 0 });
  }

  function back(to: Step) {
    if (to < step) window.history.go(to - step);
  }

  function pickLine(l: CatalogLine) {
    if (l.key !== line?.key) {
      setLine(l);
      setSelected(null); // a shade belongs to its line
      setResults({});
    }
    track("BRAND_SELECTED", { lineKey: l.key });
    forward(1);
  }

  function takePhoto(p: ReadyPhoto) {
    setPhoto(p);
    setResults({}); // previews belong to the photo they were made from
    track("PHOTO_READY");
  }

  return (
    <main className="column flex min-h-dvh flex-col gap-4">
      <Header onBack={step > 0 ? () => back((step - 1) as Step) : undefined} onHelp={() => setHelp(true)} />
      {step > 0 && <Stepper step={step} onGo={back} />}
      {step > 0 && line && <BrandBar nameEn={line.nameEn} onChange={() => back(0)} />}

      {failed ? (
        <div role="alert" className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="text-ink-2">{COPY.catalogError}</p>
          <button type="button" onClick={load} className="btn btn-primary px-8">{COPY.retry}</button>
        </div>
      ) : lines === null ? (
        <div className="mt-16 grid place-items-center"><span className="spinner" /></div>
      ) : step === 0 || !line ? (
        <BrandStep lines={lines} onPick={pickLine} />
      ) : step === 1 || !photo ? (
        <PhotoStep photo={photo} onPhoto={takePhoto} onContinue={() => forward(2)} />
      ) : (
        <TryStep
          line={line}
          photo={photo}
          selected={selected}
          results={results}
          consent={consent}
          onSelect={setSelected}
          onResult={(code, url) => setResults((r) => ({ ...r, [code]: url }))}
          onConsent={setConsent}
          onChangePhoto={() => back(1)}
        />
      )}

      {step === 0 && <Stepper step={0} onGo={back} />}
      <FootNotes gallery={gallery} />
      {help && <HelpSheet onClose={() => setHelp(false)} />}
    </main>
  );
}
