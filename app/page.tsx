"use client";

import { useState } from "react";
import { computeCost, formatCost } from "@/lib/pricing";

type Step = "box-photo" | "shade-review" | "hair-photo" | "result";

type ShadeInfo = {
  shadeCode: string;
  shadeName: string;
  hexColor: string;
  confidence: "high" | "medium" | "low";
};

type CostEntry = { label: string; cents: number };

export default function Home() {
  const [step, setStep] = useState<Step>("box-photo");
  const [shade, setShade] = useState<ShadeInfo | null>(null);
  const [boxPreview, setBoxPreview] = useState<string | null>(null);
  const [hairFile, setHairFile] = useState<File | null>(null);
  const [hairPreview, setHairPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);

  function addCost(label: string, inputTokens: number, outputTokens: number) {
    const cents = computeCost("gemini-2.5-flash", inputTokens, outputTokens) * 100;
    setCosts((prev) => [...prev, { label, cents }]);
  }

  async function readBox(file: File) {
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/read-box", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to read box.");

      setShade({
        shadeCode: data.shadeCode,
        shadeName: data.shadeName,
        hexColor: data.hexColor,
        confidence: data.confidence,
      });

      if (data.usage) {
        addCost("Box read", data.usage.inputTokens, data.usage.outputTokens);
      }

      setBoxPreview(URL.createObjectURL(file));
      setStep("shade-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function tryOn() {
    if (!hairFile || !shade) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("image", hairFile);
      form.append("shadeName", shade.shadeName);
      form.append("hex", shade.hexColor);

      const res = await fetch("/api/tryon", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Try-on failed.");

      setResult(data.image);
      if (data.usage) {
        addCost("Hair color apply", data.usage.inputTokens, data.usage.outputTokens);
      }

      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("box-photo");
    setShade(null);
    setBoxPreview(null);
    setHairFile(null);
    setHairPreview(null);
    setResult(null);
    setCosts([]);
    setError(null);
  }

  const totalCents = costs.reduce((sum, c) => sum + c.cents, 0);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Hair Color Try-On</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Photograph your product box, pick the shade, upload a selfie, preview the color.
        </p>
      </header>

      <Stepper step={step} />

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40">
          {error}
        </p>
      )}

      {costs.length > 0 && (
        <CostMeter costs={costs} totalCents={totalCents} />
      )}

      {step === "box-photo" && (
        <section className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-10 text-center dark:border-white/15">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              📦 Photograph the product box
            </span>
            <span className="text-xs text-zinc-500">Show the label with the shade code</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) readBox(f);
              }}
            />
          </label>
          {loading && <p className="text-center text-sm text-zinc-500">Reading box…</p>}
        </section>
      )}

      {step === "shade-review" && shade && (
        <section className="flex flex-col gap-5">
          {boxPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxPreview} alt="Product box" className="max-h-48 self-center rounded-xl" />
          )}

          <div className="rounded-2xl border-2 border-black/10 p-4 dark:border-white/15">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="h-12 w-12 rounded-full border-2 border-black/10 dark:border-white/15"
                style={{ backgroundColor: shade.hexColor }}
              />
              <div className="flex-1">
                <p className="font-semibold">{shade.shadeName}</p>
                <p className="text-sm text-zinc-500">{shade.shadeCode}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Confidence: <span className="capitalize">{shade.confidence}</span>
            </p>
            {shade.confidence !== "high" && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Low confidence reading. Result may not match the exact product shade.
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("box-photo")}
              className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm dark:border-white/15"
            >
              Rescan
            </button>
            <button
              onClick={() => setStep("hair-photo")}
              className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              Use this shade
            </button>
          </div>
        </section>
      )}

      {step === "hair-photo" && shade && (
        <section className="flex flex-col gap-5">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-10 text-center dark:border-white/15">
            {hairPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hairPreview} alt="Your photo" className="max-h-64 rounded-xl" />
            ) : (
              <span className="text-sm text-zinc-500">📸 Choose or take a selfie</span>
            )}
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setHairFile(f);
                  setHairPreview(URL.createObjectURL(f));
                }
              }}
            />
          </label>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("shade-review")}
              className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm dark:border-white/15"
            >
              Back
            </button>
            <button
              onClick={tryOn}
              disabled={!hairFile || loading}
              className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-40"
            >
              {loading ? "Applying…" : "Try color"}
            </button>
          </div>
        </section>
      )}

      {step === "result" && shade && (
        <section className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Figure label="Before" src={hairPreview} />
            <Figure label="After" src={result} />
          </div>

          <p className="text-center text-xs text-zinc-400">
            ⚠️ Preview for hair dyed to {shade.shadeName}. Results vary by starting hair color and bleaching.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setStep("hair-photo")}
              className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm dark:border-white/15"
            >
              Try another photo
            </button>
            <button
              onClick={reset}
              className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background"
            >
              New product
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Step[] = ["box-photo", "shade-review", "hair-photo", "result"];
  const labels = { "box-photo": "Box", "shade-review": "Shade", "hair-photo": "Photo", result: "Result" };
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

function CostMeter({ costs, totalCents }: { costs: CostEntry[]; totalCents: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        API Costs (Gemini)
      </p>
      <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        {costs.map((c, i) => (
          <div key={i} className="flex justify-between">
            <span>{c.label}</span>
            <span className="font-mono">{formatCost(c.cents)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-black/10 pt-2 dark:border-white/15">
        <div className="flex justify-between font-semibold text-zinc-800 dark:text-zinc-200">
          <span>Total this session</span>
          <span className="font-mono">{formatCost(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
