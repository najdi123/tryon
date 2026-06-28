"use client";

import { useState } from "react";
import QrScanner from "@/components/QrScanner";
import { parseQrPayload, type HairShade } from "@/lib/products";

type Step = "scan" | "photo" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("scan");
  const [shade, setShade] = useState<HairShade | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleScan(text: string) {
    const parsed = parseQrPayload(text);
    if (!parsed) {
      setError("That code didn't contain a recognizable color.");
      return;
    }
    setError(null);
    setShade(parsed);
    setStep("photo");
  }

  function handlePhoto(file: File) {
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setResult(null);
  }

  async function runTryOn() {
    if (!photoFile || !shade) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("image", photoFile);
      form.append("shadeName", shade.name);
      form.append("hex", shade.hex);
      if (shade.description) form.append("description", shade.description);

      const res = await fetch("/api/tryon", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setResult(data.image);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("scan");
    setShade(null);
    setPhotoFile(null);
    setPhotoPreview(null);
    setResult(null);
    setError(null);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Hair Color Try-On</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Scan a product, upload a photo, preview the shade.
        </p>
      </header>

      <Stepper step={step} />

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {step === "scan" && (
        <section className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-zinc-500">
            Point your camera at the QR code on the product.
          </p>
          <QrScanner onResult={handleScan} />
        </section>
      )}

      {step === "photo" && shade && (
        <section className="flex flex-col gap-5">
          <ShadeBadge shade={shade} />

          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-10 text-center dark:border-white/15">
            {photoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoPreview} alt="Your photo" className="max-h-64 rounded-xl" />
            ) : (
              <span className="text-sm text-zinc-500">Tap to choose or take a photo</span>
            )}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhoto(f);
              }}
            />
          </label>

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm dark:border-white/15">
              Back
            </button>
            <button
              onClick={runTryOn}
              disabled={!photoFile || loading}
              className="flex-2 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-40"
            >
              {loading ? "Applying color…" : "Try this color"}
            </button>
          </div>
        </section>
      )}

      {step === "result" && shade && (
        <section className="flex flex-col gap-5">
          <ShadeBadge shade={shade} />
          <div className="grid grid-cols-2 gap-3">
            <Figure label="Before" src={photoPreview} />
            <Figure label="After" src={result} />
          </div>
          <p className="text-center text-xs text-zinc-400">
            Preview only — real results vary with your natural hair color and bleaching.
          </p>
          <div className="flex gap-3">
            <button onClick={() => setStep("photo")} className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm dark:border-white/15">
              Try another photo
            </button>
            <button onClick={reset} className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background">
              New scan
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["scan", "photo", "result"];
  const labels = { scan: "Scan", photo: "Photo", result: "Result" };
  const current = steps.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      {steps.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span className={i <= current ? "font-semibold text-foreground" : "text-zinc-400"}>
            {labels[s]}
          </span>
          {i < steps.length - 1 && <span className="text-zinc-300">→</span>}
        </span>
      ))}
    </div>
  );
}

function ShadeBadge({ shade }: { shade: HairShade }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
      <span
        className="h-10 w-10 rounded-full border border-black/10 dark:border-white/15"
        style={{ backgroundColor: shade.hex }}
      />
      <div>
        <p className="text-sm font-medium">{shade.name}</p>
        <p className="text-xs text-zinc-500">{shade.hex}</p>
      </div>
    </div>
  );
}

function Figure({ label, src }: { label: string; src: string | null }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-center text-xs text-zinc-500">{label}</figcaption>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <div className="aspect-square w-full rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      )}
    </figure>
  );
}
