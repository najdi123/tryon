"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandStep } from "@/components/ayeneh/BrandStep";
import { BrandBar, FootNotes, Header, Stepper, type Step } from "@/components/ayeneh/Chrome";
import { COPY } from "@/components/ayeneh/copy";
import { PhotoStep } from "@/components/ayeneh/PhotoStep";
import { HelpSheet } from "@/components/ayeneh/Sheet";
import { TryStep, type Results } from "@/components/ayeneh/TryStep";
import { ensureSession, loadCatalog, track, type Catalog, type CatalogLine, type CatalogShade, type GalleryInfo } from "@/lib/client/api";
import type { ReadyPhoto } from "@/lib/client/photo";

const MAX_KEPT_RESULTS = 8; // previews are large pictures held in memory

// The three steps live on one page and in the browser's history, so the phone's back button
// walks them and every earlier choice (brand, photo, shade, previews) is still there.
export default function Home() {
  const [wanted, setWanted] = useState<Step>(0);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  const [gallery, setGallery] = useState<GalleryInfo>(null);
  const [line, setLine] = useState<CatalogLine | null>(null);
  const [photo, setPhoto] = useState<ReadyPhoto | null>(null);
  const [selected, setSelected] = useState<CatalogShade | null>(null);
  const [results, setResults] = useState<Results>({});
  const [pending, setPending] = useState<string | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [help, setHelp] = useState(false);
  const moving = useRef(false);

  // What is shown never runs ahead of what is in memory: after a reload the history may say
  // step 3 while the brand and the photo are gone.
  const step: Step = !line ? 0 : !photo ? (Math.min(wanted, 1) as Step) : wanted;

  const load = useCallback(() => {
    loadCatalog()
      .then((c) => {
        setCatalog(c);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    void ensureSession().then(setGallery);
    load();
    // Next keeps its own marker in history.state; ours is added beside it, never in its place.
    window.history.replaceState({ ...(window.history.state as object | null), step: 0 }, "");
    const pop = (e: PopStateEvent) => {
      moving.current = false;
      setWanted(((e.state as { step?: Step } | null)?.step ?? 0) as Step);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, [load]);

  function forward(to: Step) {
    window.history.pushState({ ...(window.history.state as object | null), step: to }, "");
    setWanted(to);
    window.scrollTo({ top: 0 });
  }

  function back(to: Step) {
    if (to >= step || moving.current) return; // a second tap before the first lands would leave the app
    if (wanted !== step) return setWanted(to); // history is ahead of the screen: only the screen moves
    moving.current = true;
    window.history.go(to - step);
  }

  function pickLine(l: CatalogLine) {
    if (l.key !== line?.key) {
      setLine(l);
      setSelected(null); // a shade belongs to its line
    }
    forward(1);
    track("BRAND_SELECTED", { lineKey: l.key });
  }

  function takePhoto(p: ReadyPhoto) {
    setPhoto(p);
    setResults({});
    setConsent(null); // the permission was for the earlier photo
    track("PHOTO_READY");
  }

  function keepResult(key: string, url: string) {
    setResults((r) => {
      const entries = [...Object.entries(r).filter(([k]) => k !== key), [key, url] as [string, string]];
      return Object.fromEntries(entries.slice(-MAX_KEPT_RESULTS));
    });
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
      ) : catalog === null ? (
        <div className="mt-16 grid place-items-center"><span className="spinner" /></div>
      ) : step === 0 || !line ? (
        <>
          <BrandStep lines={catalog.lines} onPick={pickLine} />
          {catalog.lines.length === 0 && <button type="button" onClick={load} className="btn btn-outline mx-auto px-8">{COPY.retry}</button>}
        </>
      ) : step === 1 || !photo ? (
        <PhotoStep photo={photo} onPhoto={takePhoto} onContinue={() => forward(2)} />
      ) : (
        <TryStep
          line={line}
          photo={photo}
          selected={selected}
          results={results}
          pending={pending}
          consent={consent}
          aiAvailable={catalog.aiAvailable}
          onSelect={setSelected}
          onResult={keepResult}
          onPending={setPending}
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
