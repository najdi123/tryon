"use client";

import { useState } from "react";
import { computeCost, formatCost } from "@/lib/pricing";

type Step = "box-photo" | "shade-review" | "hair-photo" | "result";
type RecolorMethod = "local" | "ai";

type ShadeInfo = {
  shadeCode: string;
  shadeName: string;
  hexColor: string;
  colorDescription: string;
  confidence: "high" | "medium" | "low";
};

type CostEntry = { label: string; cents: number };

const PRESET_SHADES: Array<ShadeInfo & { path: "local" | "ai" }> = [
  // Dark shades → local canvas recolor
  { shadeCode: "3/0",  shadeName: "Dark Brown",       hexColor: "#2C1A0E", colorDescription: "deep dark brown, cool undertones",                             confidence: "high", path: "local" },
  { shadeCode: "4/6",  shadeName: "Red Chestnut",     hexColor: "#8B3520", colorDescription: "warm medium brown with intense red undertones, glossy finish", confidence: "high", path: "local" },
  { shadeCode: "5/5",  shadeName: "Light Mahogany",   hexColor: "#7B3F30", colorDescription: "warm light brown with mahogany-red reflect",                  confidence: "high", path: "local" },
  // Light shades → Gemini AI recolor
  { shadeCode: "8/3",  shadeName: "Light Gold Blonde", hexColor: "#D4A855", colorDescription: "light warm blonde with golden highlights, sun-kissed",        confidence: "high", path: "ai" },
  { shadeCode: "9/1",  shadeName: "Very Light Ash",    hexColor: "#DDD0A0", colorDescription: "very light cool blonde, ash undertones, pearl finish",        confidence: "high", path: "ai" },
  { shadeCode: "10/01",shadeName: "Platinum Blonde",   hexColor: "#EFE5CA", colorDescription: "lightest platinum blonde, icy cool tone, high-shine finish",  confidence: "high", path: "ai" },
];

export default function Home() {
  const [step, setStep] = useState<Step>("box-photo");
  const [shade, setShade] = useState<ShadeInfo | null>(null);
  const [boxPreview, setBoxPreview] = useState<string | null>(null);
  const [hairFile, setHairFile] = useState<File | null>(null);
  const [hairPreview, setHairPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [recolorMethod, setRecolorMethod] = useState<RecolorMethod | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);

  function addCost(label: string, inputTokens: number, outputTokens: number) {
    const cents = computeCost("gemini-2.5-flash", inputTokens, outputTokens) * 100;
    setCosts((prev) => [...prev, { label, cents }]);
  }

  async function readBox(file: File) {
    setError(null);
    setLoadingStatus("Reading box…");
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
        colorDescription: data.colorDescription ?? "",
        confidence: data.confidence,
      });
      if (data.usage) addCost("Box read", data.usage.inputTokens, data.usage.outputTokens);
      setBoxPreview(URL.createObjectURL(file));
      setStep("shade-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingStatus(null);
    }
  }

  async function tryOnWithGemini(file: File, info: ShadeInfo): Promise<void> {
    setLoadingStatus("Applying color with AI…");
    const form = new FormData();
    form.append("image", file);
    form.append("shadeName", info.shadeName);
    form.append("hex", info.hexColor);
    if (info.colorDescription) form.append("description", info.colorDescription);

    const res = await fetch("/api/tryon", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "AI try-on failed.");
    setResult(data.image);
    if (data.usage) addCost("Hair color apply (AI)", data.usage.inputTokens, data.usage.outputTokens);
    setRecolorMethod("ai");
  }

  async function tryOn() {
    if (!hairFile || !shade) return;
    setLoadingStatus("Segmenting hair…");
    setError(null);
    setResult(null);
    setRecolorMethod(null);

    try {
      // Attempt local recolor via MediaPipe hair segmentation
      let usedLocal = false;
      try {
        setLoadingStatus("Loading hair segmenter (first run may take a few seconds)…");
        const { recolorHair, needsGemini } = await import("@/lib/hair-recolor");

        setLoadingStatus("Segmenting hair…");
        const local = await recolorHair(hairFile, shade.hexColor);

        const tooFewHairPixels = local.hairPixelCount < 500;
        const requiresBleaching = needsGemini(local.avgHairLightness, shade.hexColor);

        if (!tooFewHairPixels && !requiresBleaching) {
          setResult(local.dataUrl);
          setRecolorMethod("local");
          usedLocal = true;
        } else if (requiresBleaching) {
          // Show local result briefly while AI runs, or just run AI
          setLoadingStatus("Target shade is lighter — using AI for better bleach simulation…");
        }
      } catch (localErr) {
        console.warn("Local recolor failed, falling back to AI:", localErr);
        setLoadingStatus("Falling back to AI…");
      }

      if (!usedLocal) {
        await tryOnWithGemini(hairFile, shade);
      }

      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoadingStatus(null);
    }
  }

  function reset() {
    setStep("box-photo");
    setShade(null);
    setBoxPreview(null);
    setHairFile(null);
    setHairPreview(null);
    setResult(null);
    setRecolorMethod(null);
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

      {costs.length > 0 && <CostMeter costs={costs} totalCents={totalCents} />}

      {step === "box-photo" && (
        <section className="flex flex-col gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-8 text-center transition-colors hover:border-black/20 dark:border-white/15 dark:hover:border-white/25">
            <span className="text-4xl">📦</span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Photograph the product box
            </span>
            <span className="text-xs text-zinc-400">Show the label with the shade code (e.g. 4/6)</span>
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

          {loadingStatus && <p className="text-center text-sm text-zinc-500">{loadingStatus}</p>}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            <span className="text-xs text-zinc-400">or pick a preset shade</span>
            <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500">
              Dark shades — <span className="text-emerald-600 dark:text-emerald-400">local recolor (free)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_SHADES.filter((s) => s.path === "local").map((preset) => (
                <button
                  key={preset.shadeCode}
                  onClick={() => { setShade(preset); setStep("shade-review"); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-black/10 p-3 text-center transition-colors hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-zinc-900"
                >
                  <span
                    className="h-10 w-10 rounded-full border-2 border-black/10 dark:border-white/15"
                    style={{ backgroundColor: preset.hexColor }}
                  />
                  <span className="text-[11px] font-medium leading-tight text-zinc-700 dark:text-zinc-300">
                    {preset.shadeName}
                  </span>
                  <span className="text-[10px] text-zinc-400">{preset.shadeCode}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-zinc-500">
              Light shades — <span className="text-blue-600 dark:text-blue-400">AI recolor (Gemini)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_SHADES.filter((s) => s.path === "ai").map((preset) => (
                <button
                  key={preset.shadeCode}
                  onClick={() => { setShade(preset); setStep("shade-review"); }}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-black/10 p-3 text-center transition-colors hover:bg-zinc-50 dark:border-white/15 dark:hover:bg-zinc-900"
                >
                  <span
                    className="h-10 w-10 rounded-full border-2 border-black/10 dark:border-white/15"
                    style={{ backgroundColor: preset.hexColor }}
                  />
                  <span className="text-[11px] font-medium leading-tight text-zinc-700 dark:text-zinc-300">
                    {preset.shadeName}
                  </span>
                  <span className="text-[10px] text-zinc-400">{preset.shadeCode}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {step === "shade-review" && shade && (
        <section className="flex flex-col gap-5">
          {boxPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxPreview} alt="Product box" className="max-h-48 self-center rounded-xl object-contain" />
          )}

          <div className="rounded-2xl border-2 border-black/10 p-4 dark:border-white/15">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-black/10 dark:border-white/15"
                style={{ backgroundColor: shade.hexColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{shade.shadeName}</p>
                <p className="text-sm text-zinc-500">{shade.shadeCode}</p>
              </div>
              <ConfidenceBadge confidence={shade.confidence} />
            </div>
            {shade.colorDescription && (
              <p className="text-xs text-zinc-500 leading-relaxed">{shade.colorDescription}</p>
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
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-black/10 px-6 py-10 text-center transition-colors hover:border-black/20 dark:border-white/15 dark:hover:border-white/25">
            {hairPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hairPreview} alt="Your photo" className="max-h-64 rounded-xl" />
            ) : (
              <>
                <span className="text-4xl">📸</span>
                <span className="text-sm text-zinc-500">Choose or take a selfie</span>
                <span className="text-xs text-zinc-400">Hair clearly visible works best</span>
              </>
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

          {loadingStatus && (
            <p className="text-center text-sm text-zinc-500">{loadingStatus}</p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("shade-review")}
              disabled={!!loadingStatus}
              className="flex-1 rounded-full border border-black/10 px-4 py-3 text-sm disabled:opacity-40 dark:border-white/15"
            >
              Back
            </button>
            <button
              onClick={tryOn}
              disabled={!hairFile || !!loadingStatus}
              className="flex-1 rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background disabled:opacity-40"
            >
              {loadingStatus ? "Working…" : "Try color"}
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

          <div className="flex flex-col gap-1 text-center">
            {recolorMethod === "local" && (
              <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ✓ Local recolor — hairstyle fully preserved, no AI cost
              </p>
            )}
            {recolorMethod === "ai" && (
              <p className="text-xs text-zinc-400">AI recolor (Gemini)</p>
            )}
            <p className="text-xs text-zinc-400">
              Preview: {shade.shadeName}. Results vary by starting hair color.
            </p>
          </div>

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
  const labels: Record<Step, string> = {
    "box-photo": "Box",
    "shade-review": "Shade",
    "hair-photo": "Photo",
    result: "Result",
  };
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

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "High", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" },
    medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" },
    low: { label: "Low", cls: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  };
  const c = map[confidence] ?? map.low;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>
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

function CostMeter({ costs, totalCents }: { costs: Array<{ label: string; cents: number }>; totalCents: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
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
      <div className="mt-2 border-t border-black/10 pt-2 dark:border-white/15">
        <div className="flex justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200">
          <span>Total this session</span>
          <span className="font-mono">{formatCost(totalCents)}</span>
        </div>
      </div>
    </div>
  );
}
