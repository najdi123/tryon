"use client";

import { useState } from "react";
import Landing from "@/components/Landing";
import { computeCost, formatCost } from "@/lib/pricing";
import { toFaDigits } from "@/lib/fa";
import {
  BRAND_LABEL,
  PRESET_SHADES,
  shadeLabel,
  type Brand,
  type ShadeInfo,
} from "@/lib/shades";

type Step = "landing" | "shade" | "shade-review" | "hair-photo" | "result";
type RecolorMethod = "local" | "ai";
type HairType = "straight" | "wavy" | "curly" | "coily";

type CostEntry = { label: string; cents: number };

const HAIR_TYPE_LABEL: Record<HairType, string> = {
  straight: "صاف",
  wavy: "موج‌دار",
  curly: "فر",
  coily: "فر ریز",
};

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [brandFilter, setBrandFilter] = useState<Brand | null>(null);
  const [shade, setShade] = useState<ShadeInfo | null>(null);
  const [boxPreview, setBoxPreview] = useState<string | null>(null);
  const [hairFile, setHairFile] = useState<File | null>(null);
  const [hairPreview, setHairPreview] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [recolorMethod, setRecolorMethod] = useState<RecolorMethod | null>(null);
  const [hairType, setHairType] = useState<HairType | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);

  function addCost(label: string, inputTokens: number, outputTokens: number) {
    const cents = computeCost("gemini-2.5-flash", inputTokens, outputTokens) * 100;
    setCosts((prev) => [...prev, { label, cents }]);
  }

  function start(brand?: Brand) {
    setBrandFilter(brand ?? null);
    setStep("shade");
  }

  function pickHairPhoto(file: File) {
    setHairFile(file);
    setHairPreview(URL.createObjectURL(file));
  }

  async function readBox(file: File) {
    setError(null);
    setLoadingStatus("در حال خواندن جعبه…");
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/read-box", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "خواندن جعبه ناموفق بود.");
      setShade({
        shadeCode: data.shadeCode,
        shadeName: data.shadeName,
        hexColor: data.hexColor,
        colorDescription: data.colorDescription ?? "",
        confidence: data.confidence,
      });
      if (data.usage) addCost("خواندن جعبه", data.usage.inputTokens, data.usage.outputTokens);
      setBoxPreview(URL.createObjectURL(file));
      setStep("shade-review");
    } catch (e) {
      setError(e instanceof Error ? e.message : "مشکلی پیش آمد.");
    } finally {
      setLoadingStatus(null);
    }
  }

  async function tryOnWithGemini(file: File, info: ShadeInfo): Promise<void> {
    setLoadingStatus("در حال اعمال رنگ با هوش مصنوعی…");
    const form = new FormData();
    form.append("image", file);
    form.append("shadeName", info.shadeName);
    form.append("hex", info.hexColor);
    if (info.colorDescription) form.append("description", info.colorDescription);
    if (hairType) form.append("hairType", hairType);

    const res = await fetch("/api/tryon", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "اعمال رنگ با هوش مصنوعی ناموفق بود.");
    setResult(data.image);
    if (data.usage) addCost("اعمال رنگ (هوش مصنوعی)", data.usage.inputTokens, data.usage.outputTokens);
    setRecolorMethod("ai");
  }

  async function tryOn() {
    if (!hairFile || !shade) return;
    setLoadingStatus("در حال جداسازی مو…");
    setError(null);
    setResult(null);
    setRecolorMethod(null);

    try {
      // Attempt local recolor via MediaPipe hair segmentation
      let usedLocal = false;
      try {
        setLoadingStatus("در حال بارگذاری موتور جداسازی مو (اجرای اول ممکن است چند ثانیه طول بکشد)…");
        const { recolorHair, needsGemini } = await import("@/lib/hair-recolor");

        setLoadingStatus("در حال جداسازی مو…");
        const local = await recolorHair(hairFile, shade.hexColor);

        const tooFewHairPixels = local.hairPixelCount < 500;
        const requiresBleaching = needsGemini(local.avgHairLightness, shade.hexColor);

        if (!tooFewHairPixels && !requiresBleaching) {
          setResult(local.dataUrl);
          setRecolorMethod("local");
          usedLocal = true;
        } else if (requiresBleaching) {
          // Show local result briefly while AI runs, or just run AI
          setLoadingStatus("رنگ انتخابی روشن‌تر است — برای شبیه‌سازی دقیق‌تر از هوش مصنوعی استفاده می‌شود…");
        }
      } catch (localErr) {
        console.warn("Local recolor failed, falling back to AI:", localErr);
        setLoadingStatus("در حال استفاده از هوش مصنوعی…");
      }

      if (!usedLocal) {
        await tryOnWithGemini(hairFile, shade);
      }

      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "مشکلی پیش آمد.");
    } finally {
      setLoadingStatus(null);
    }
  }

  function reset() {
    setStep("landing");
    setBrandFilter(null);
    setShade(null);
    setBoxPreview(null);
    setHairFile(null);
    setHairPreview(null);
    setResult(null);
    setRecolorMethod(null);
    setHairType(null);
    setCosts([]);
    setError(null);
  }

  const totalCents = costs.reduce((sum, c) => sum + c.cents, 0);

  if (step === "landing") return <Landing onStart={start} />;

  const visiblePresets = brandFilter
    ? PRESET_SHADES.filter((s) => s.brand === brandFilter)
    : PRESET_SHADES;

  return (
    <main className="stage mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={reset}
          dir="ltr"
          className="flex items-end gap-2.5"
          aria-label="بازگشت به صفحه اصلی"
        >
          <span className="gold-text-logo font-display text-[26px] font-medium">Bianca</span>
          <span className="pb-0.5 font-display text-[18px] text-gold-amp">&amp;</span>
          <span className="font-display text-[22px] font-medium text-oyster-ink">Oyster</span>
        </button>
        <Stepper step={step} />
      </header>

      {error && (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      {costs.length > 0 && <CostMeter costs={costs} totalCents={totalCents} />}

      {step === "shade" && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-base font-semibold text-gold-title">عکس جعبه محصول رو بگیر</p>
            <p className="text-xs text-ink-body">
              طوری که برچسب و کد رنگ (مثلاً {toFaDigits("4/6")}) دیده بشه
            </p>
          </div>

          <div className="flex gap-3">
            <PickerTile
              icon="📷"
              title="گرفتن عکس"
              hint="باز کردن دوربین"
              capture="environment"
              onFile={readBox}
            />
            <PickerTile
              icon="🖼️"
              title="انتخاب تصویر"
              hint="از گالری"
              onFile={readBox}
            />
          </div>

          {loadingStatus && <p className="text-center text-sm text-ink-sub">{loadingStatus}</p>}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[color:var(--line-divider)]" />
            <span className="text-xs text-ink-faint">یا یکی از رنگ‌های آماده رو انتخاب کن</span>
            <div className="h-px flex-1 bg-[color:var(--line-divider)]" />
          </div>

          <div className="flex gap-2">
            <BrandTab active={brandFilter === null} onClick={() => setBrandFilter(null)}>
              همه
            </BrandTab>
            <BrandTab active={brandFilter === "bianca"} onClick={() => setBrandFilter("bianca")}>
              {BRAND_LABEL.bianca}
            </BrandTab>
            <BrandTab active={brandFilter === "oyster"} onClick={() => setBrandFilter("oyster")}>
              {BRAND_LABEL.oyster}
            </BrandTab>
          </div>

          <ShadeGroup
            title="رنگ‌های تیره"
            note="پردازش روی دستگاه — رایگان"
            noteClass="text-emerald-300"
            presets={visiblePresets.filter((s) => s.path === "local")}
            onPick={(preset) => {
              setShade(preset);
              setStep("hair-photo");
            }}
          />
          <ShadeGroup
            title="رنگ‌های روشن"
            note="پردازش با هوش مصنوعی"
            noteClass="text-sky-300"
            presets={visiblePresets.filter((s) => s.path === "ai")}
            onPick={(preset) => {
              setShade(preset);
              setStep("hair-photo");
            }}
          />

          <button
            onClick={reset}
            className="self-center rounded-full border border-[color:var(--line-panel)] px-5 py-2.5 text-sm text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.12)]"
          >
            بازگشت به صفحه اصلی
          </button>
        </section>
      )}

      {step === "shade-review" && shade && (
        <section className="flex flex-col gap-5">
          {boxPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boxPreview} alt="جعبه محصول" className="max-h-48 self-center rounded-xl object-contain" />
          )}

          <div className="panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[color:var(--line-ring)]"
                style={{ backgroundColor: shade.hexColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gold-title">{shadeLabel(shade)}</p>
                <p className="text-sm text-ink-body" dir="ltr">
                  {shade.shadeCode}
                </p>
              </div>
              <ConfidenceBadge confidence={shade.confidence} />
            </div>
            {shade.colorDescription && (
              <p className="text-xs leading-relaxed text-ink-muted" dir="ltr">
                {shade.colorDescription}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("shade")}>اسکن دوباره</SecondaryButton>
            <button onClick={() => setStep("hair-photo")} className="cta flex-1 rounded-full px-4 py-3 text-sm font-semibold">
              همین رنگ رو می‌خوام
            </button>
          </div>
        </section>
      )}

      {step === "hair-photo" && shade && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-base font-semibold text-gold-title">عکس خودت رو انتخاب کن</p>
            <p className="text-xs text-ink-body">
              رنگ انتخابی: {shadeLabel(shade)} <span dir="ltr">({shade.shadeCode})</span>
            </p>
          </div>

          {hairPreview ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-[color:var(--line-panel)] px-6 py-4 text-center transition-colors hover:border-[color:var(--line-ring)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hairPreview} alt="عکس شما" className="max-h-64 rounded-xl" />
              <span className="text-xs text-ink-faint">برای تغییر لمس کن</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) pickHairPhoto(f);
                }}
              />
            </label>
          ) : (
            <div className="flex gap-3">
              <PickerTile
                icon="🤳"
                title="گرفتن سلفی"
                hint="باز کردن دوربین"
                capture="user"
                onFile={pickHairPhoto}
              />
              <PickerTile icon="🖼️" title="انتخاب عکس" hint="از گالری" onFile={pickHairPhoto} />
            </div>
          )}

          {hairFile && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-ink-sub">
                نوع مو <span className="font-normal text-ink-faint">(برای حفظ حالت مو)</span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(HAIR_TYPE_LABEL) as HairType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setHairType(hairType === type ? null : type)}
                    className={`rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors ${
                      hairType === type
                        ? "border-transparent bg-gold-icon text-cta-ink"
                        : "border-[color:var(--line-panel)] text-ink-sub hover:bg-[rgba(226,196,137,.1)]"
                    }`}
                  >
                    {HAIR_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingStatus && <p className="text-center text-sm text-ink-sub">{loadingStatus}</p>}

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("shade")} disabled={!!loadingStatus}>
              بازگشت
            </SecondaryButton>
            <button
              onClick={tryOn}
              disabled={!hairFile || !!loadingStatus}
              className="cta flex-1 rounded-full px-4 py-3 text-sm font-semibold"
            >
              {loadingStatus ? "در حال پردازش…" : "اعمال رنگ"}
            </button>
          </div>

          <p className="text-center text-[11px] text-ink-faint">
            عکس شما محرمانه است و ذخیره نمی‌شود.
          </p>
        </section>
      )}

      {step === "result" && shade && (
        <section className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Figure label="قبل" src={hairPreview} />
            <Figure label="بعد" src={result} />
          </div>

          <div className="flex flex-col gap-1 text-center">
            {recolorMethod === "local" && (
              <p className="text-xs font-medium text-emerald-300">
                ✓ پردازش روی دستگاه — حالت مو کاملاً حفظ شده و بدون هزینه
              </p>
            )}
            {recolorMethod === "ai" && (
              <p className="text-xs text-ink-faint">پردازش با هوش مصنوعی</p>
            )}
            <p className="text-xs text-ink-muted">
              پیش‌نمایش رنگ {shadeLabel(shade)}. نتیجه بسته به رنگ اولیه موی شما متفاوت است.
            </p>
          </div>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("hair-photo")}>عکس دیگر</SecondaryButton>
            <button onClick={() => setStep("shade")} className="cta flex-1 rounded-full px-4 py-3 text-sm font-semibold">
              رنگ دیگر
            </button>
          </div>

          <button onClick={reset} className="self-center text-xs text-ink-faint underline-offset-4 hover:underline">
            شروع دوباره
          </button>
        </section>
      )}
    </main>
  );
}

function Stepper({ step }: { step: Step }) {
  // The landing page promises three steps — the box-scan review folds into "انتخاب رنگ".
  const labels = ["انتخاب رنگ", "عکس شما", "نتیجه"];
  const current = step === "result" ? 2 : step === "hair-photo" ? 1 : 0;
  return (
    <div className="flex items-center justify-center gap-2 text-xs">
      {labels.map((label, i) => (
        <span key={label} className="flex items-center gap-2">
          <span className={i <= current ? "font-semibold text-gold-title" : "text-ink-faint"}>
            {toFaDigits(i + 1)}. {label}
          </span>
          {i < labels.length - 1 && (
            <span aria-hidden className="text-ink-footer">
              ←
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function BrandTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full border px-4 py-2 text-xs transition-colors ${
        active
          ? "border-transparent bg-gold-icon font-semibold text-cta-ink"
          : "border-[color:var(--line-panel)] text-gold-outline hover:bg-[rgba(226,196,137,.12)]"
      }`}
    >
      {children}
    </button>
  );
}

function ShadeGroup({
  title,
  note,
  noteClass,
  presets,
  onPick,
}: {
  title: string;
  note: string;
  noteClass: string;
  presets: Array<ShadeInfo & { shadeCode: string }>;
  onPick: (preset: ShadeInfo) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-ink-sub">
        {title} — <span className={noteClass}>{note}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => (
          <button
            key={preset.shadeCode}
            onClick={() => onPick(preset)}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-[color:var(--line-panel)] p-3 text-center transition-colors hover:bg-[rgba(226,196,137,.1)]"
          >
            <span
              className="h-10 w-10 rounded-full border-2 border-[color:var(--line-ring)]"
              style={{ backgroundColor: preset.hexColor }}
            />
            <span className="text-[11px] font-medium leading-tight text-gold-title">
              {shadeLabel(preset)}
            </span>
            <span className="text-[10px] text-ink-faint" dir="ltr">
              {preset.shadeCode}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PickerTile({
  icon,
  title,
  hint,
  capture,
  onFile,
}: {
  icon: string;
  title: string;
  hint: string;
  capture?: "user" | "environment";
  onFile: (file: File) => void;
}) {
  return (
    <label className="flex flex-1 cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[color:var(--line-panel)] px-4 py-7 text-center transition-colors hover:border-[color:var(--line-ring)] hover:bg-[rgba(226,196,137,.06)]">
      <span className="text-3xl">{icon}</span>
      <span className="text-sm font-medium text-gold-title">{title}</span>
      <span className="text-xs text-ink-faint">{hint}</span>
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function SecondaryButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-full border border-[color:var(--line-panel)] px-4 py-3 text-sm text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.12)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "زیاد", cls: "bg-emerald-950/50 text-emerald-300" },
    medium: { label: "متوسط", cls: "bg-amber-950/50 text-amber-300" },
    low: { label: "کم", cls: "bg-red-950/50 text-red-300" },
  };
  const c = map[confidence] ?? map.low;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.cls}`}>{c.label}</span>;
}

function Figure({ label, src }: { label: string; src: string | null }) {
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-center text-xs text-ink-sub">{label}</figcaption>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <div className="aspect-square w-full rounded-xl bg-[rgba(26,20,13,.7)]" />
      )}
    </figure>
  );
}

function CostMeter({ costs, totalCents }: { costs: CostEntry[]; totalCents: number }) {
  return (
    <div className="rounded-xl border border-[color:var(--line-faint)] bg-[rgba(26,20,13,.7)] px-4 py-3">
      <p className="mb-2 text-xs font-semibold text-ink-sub">هزینه سرویس (Gemini)</p>
      <div className="space-y-1 text-xs text-ink-muted">
        {costs.map((c, i) => (
          <div key={i} className="flex justify-between">
            <span>{c.label}</span>
            <span className="font-mono" dir="ltr">
              {formatCost(c.cents)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-[color:var(--line-divider)] pt-2">
        <div className="flex justify-between text-xs font-semibold text-gold-title">
          <span>مجموع این جلسه</span>
          <span className="font-mono" dir="ltr">
            {formatCost(totalCents)}
          </span>
        </div>
      </div>
    </div>
  );
}
