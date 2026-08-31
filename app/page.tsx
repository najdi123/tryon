"use client";

import { useRef, useState } from "react";
import Landing from "@/components/Landing";
import Lightbox, { type LightboxItem } from "@/components/Lightbox";
import { computeCost, formatCost } from "@/lib/pricing";
import { toFaDigits } from "@/lib/fa";
import type { PreparedHair } from "@/lib/hair-recolor";
import {
  BRAND_LABEL,
  BRANDS,
  PRESET_SHADES,
  shadeLabel,
  type Brand,
  type PresetShade,
  type ShadeInfo,
} from "@/lib/shades";

type Step = "landing" | "shade" | "shade-review" | "hair-photo" | "result";
type RecolorMethod = "local" | "ai";
type HairType = "straight" | "wavy" | "curly" | "coily";

type CostEntry = { label: string; cents: number };

type TryOnResult = {
  shade: ShadeInfo;
  /** null while this shade is still processing. */
  image: string | null;
  method: RecolorMethod | null;
  error: string | null;
};

/** Each AI shade is a separate paid Gemini call, so the batch is kept small. */
const MAX_SHADES = 5;

const HAIR_TYPE_LABEL: Record<HairType, string> = {
  straight: "صاف",
  wavy: "موج‌دار",
  curly: "فر",
  coily: "فر ریز",
};

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [brandFilter, setBrandFilter] = useState<Brand | null>(null);
  const [selected, setSelected] = useState<ShadeInfo[]>([]);
  const [scanned, setScanned] = useState<ShadeInfo | null>(null);
  const [boxPreview, setBoxPreview] = useState<string | null>(null);
  const [hairFile, setHairFile] = useState<File | null>(null);
  const [hairPreview, setHairPreview] = useState<string | null>(null);
  const [results, setResults] = useState<TryOnResult[]>([]);
  const [hairType, setHairType] = useState<HairType | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [costs, setCosts] = useState<CostEntry[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Segmentation is the expensive step and does not depend on the target
  // colour, so it is cached per photo and reused across shades and retries.
  const prepared = useRef<{ file: File; prep: PreparedHair } | null>(null);

  function addCost(label: string, inputTokens: number, outputTokens: number) {
    const cents = computeCost("gemini-2.5-flash", inputTokens, outputTokens) * 100;
    setCosts((prev) => [...prev, { label, cents }]);
  }

  function start(brand?: Brand) {
    setBrandFilter(brand ?? null);
    setStep("shade");
  }

  function toggleShade(shade: ShadeInfo) {
    // Decided outside the updater — updaters must stay side-effect free.
    const at = selected.findIndex((s) => s.shadeCode === shade.shadeCode);
    if (at >= 0) {
      setNote(null);
      setSelected(selected.filter((_, i) => i !== at));
      return;
    }
    if (selected.length >= MAX_SHADES) {
      setNote(`حداکثر ${toFaDigits(MAX_SHADES)} رنگ را می‌توانید هم‌زمان امتحان کنید.`);
      return;
    }
    setNote(null);
    setSelected([...selected, shade]);
  }

  /** Scanned shades are added, never toggled off by a repeat scan. */
  function addScannedShade(shade: ShadeInfo): boolean {
    if (selected.some((s) => s.shadeCode === shade.shadeCode)) return true;
    if (selected.length >= MAX_SHADES) {
      setError(
        `حداکثر ${toFaDigits(MAX_SHADES)} رنگ را می‌توانید هم‌زمان امتحان کنید. یکی از رنگ‌ها را حذف کنید.`,
      );
      return false;
    }
    setSelected([...selected, shade]);
    return true;
  }

  function pickHairPhoto(file: File) {
    prepared.current = null;
    setResults([]);
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
      setScanned({
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

  async function applyWithGemini(
    file: File,
    info: ShadeInfo,
  ): Promise<{ image: string; method: RecolorMethod }> {
    const form = new FormData();
    form.append("image", file);
    form.append("shadeName", info.shadeName);
    form.append("hex", info.hexColor);
    if (info.colorDescription) form.append("description", info.colorDescription);
    if (hairType) form.append("hairType", hairType);

    const res = await fetch("/api/tryon", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "اعمال رنگ با هوش مصنوعی ناموفق بود.");
    if (data.usage) {
      addCost(`اعمال رنگ ${shadeLabel(info)}`, data.usage.inputTokens, data.usage.outputTokens);
    }
    return { image: data.image, method: "ai" };
  }

  async function runTryOn() {
    if (!hairFile || selected.length === 0) return;
    setError(null);
    setResults(
      selected.map((shade) => ({ shade, image: null, method: null, error: null })),
    );
    setStep("result");

    // Segment once for the whole batch.
    let prep: PreparedHair | null = null;
    if (prepared.current?.file === hairFile) {
      prep = prepared.current.prep;
    } else {
      setLoadingStatus("در حال جداسازی مو (اجرای اول ممکن است چند ثانیه طول بکشد)…");
      try {
        const { prepareHair } = await import("@/lib/hair-recolor");
        prep = await prepareHair(hairFile);
        prepared.current = { file: hairFile, prep };
      } catch (segErr) {
        // Not fatal — every shade just goes through Gemini instead.
        console.warn("Hair segmentation failed, using AI for all shades:", segErr);
      }
    }

    const { needsGemini, recolorPrepared } = await import("@/lib/hair-recolor");

    for (let i = 0; i < selected.length; i++) {
      const shade = selected[i];
      setLoadingStatus(
        `در حال پردازش رنگ ${toFaDigits(i + 1)} از ${toFaDigits(selected.length)} — ${shadeLabel(shade)}`,
      );
      try {
        let outcome: { image: string; method: RecolorMethod };
        const canDoLocally =
          prep !== null &&
          prep.hairPixelCount >= 500 &&
          !needsGemini(prep.avgHairLightness, shade.hexColor);

        if (canDoLocally) {
          outcome = { image: recolorPrepared(prep!, shade.hexColor), method: "local" };
        } else {
          outcome = await applyWithGemini(hairFile, shade);
        }
        setResults((prev) =>
          prev.map((r, j) => (j === i ? { ...r, image: outcome.image, method: outcome.method } : r)),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "پردازش این رنگ ناموفق بود.";
        setResults((prev) => prev.map((r, j) => (j === i ? { ...r, error: msg } : r)));
      }
    }

    setLoadingStatus(null);
  }

  /** Keeps the photo (and its segmentation) — just pick different shades. */
  function tryOtherColors() {
    setSelected([]);
    setResults([]);
    setNote(null);
    setStep("shade");
  }

  function reset() {
    setStep("landing");
    setBrandFilter(null);
    setSelected([]);
    setScanned(null);
    setBoxPreview(null);
    setHairFile(null);
    setHairPreview(null);
    setResults([]);
    setHairType(null);
    setCosts([]);
    setError(null);
    setNote(null);
    prepared.current = null;
  }

  const totalCents = costs.reduce((sum, c) => sum + c.cents, 0);

  if (step === "landing") return <Landing onStart={start} />;

  const visiblePresets = brandFilter
    ? PRESET_SHADES.filter((s) => s.brand === brandFilter)
    : PRESET_SHADES;

  const isSelected = (code: string) => selected.some((s) => s.shadeCode === code);

  // The original photo leads the lightbox so before/after can be paged through.
  const lightboxItems: LightboxItem[] = [
    ...(hairPreview
      ? [{ src: hairPreview, title: "عکس اصلی", fileKey: "original" }]
      : []),
    ...results
      .filter((r) => r.image)
      .map((r) => ({
        src: r.image!,
        title: shadeLabel(r.shade),
        caption: r.shade.shadeCode,
        fileKey: r.shade.shadeCode,
      })),
  ];

  function openLightbox(src: string) {
    const at = lightboxItems.findIndex((it) => it.src === src);
    if (at >= 0) setLightboxIndex(at);
  }

  const doneCount = results.filter((r) => r.image || r.error).length;

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
            <PickerTile icon="🖼️" title="انتخاب تصویر" hint="از گالری" onFile={readBox} />
          </div>

          {loadingStatus && <p className="text-center text-sm text-ink-sub">{loadingStatus}</p>}

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[color:var(--line-divider)]" />
            <span className="text-xs text-ink-faint">
              یا تا {toFaDigits(MAX_SHADES)} رنگ انتخاب کن
            </span>
            <div className="h-px flex-1 bg-[color:var(--line-divider)]" />
          </div>

          <div className="flex flex-wrap gap-2">
            <BrandTab active={brandFilter === null} onClick={() => setBrandFilter(null)}>
              همه
            </BrandTab>
            {BRANDS.map((brand) => (
              <BrandTab
                key={brand}
                active={brandFilter === brand}
                onClick={() => setBrandFilter(brand)}
              >
                {BRAND_LABEL[brand]}
              </BrandTab>
            ))}
          </div>

          <p className="flex items-center justify-center gap-3 text-[11px] text-ink-faint">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              پردازش روی دستگاه، رایگان
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              پردازش با هوش مصنوعی
            </span>
          </p>

          {groupByFamily(visiblePresets).map((group) => (
            <ShadeGroup
              key={group.family}
              title={group.family}
              count={group.items.length}
              presets={group.items}
              isSelected={isSelected}
              selectionIndex={(code) => selected.findIndex((s) => s.shadeCode === code)}
              onToggle={toggleShade}
            />
          ))}

          {/* Selection bar rides the bottom of the viewport while scrolling the chart. */}
          <div className="sticky bottom-0 -mx-5 mt-1 flex flex-col gap-2 bg-[rgba(10,8,6,.94)] px-5 pb-4 pt-3 backdrop-blur-sm">
            {note && <p className="text-center text-[11px] text-amber-300">{note}</p>}
            <div className="flex items-center gap-3">
              <div className="flex flex-1 items-center gap-1.5">
                {selected.length === 0 ? (
                  <span className="text-xs text-ink-faint">هنوز رنگی انتخاب نشده</span>
                ) : (
                  selected.map((s) => (
                    <button
                      key={s.shadeCode}
                      onClick={() => toggleShade(s)}
                      title={`حذف ${shadeLabel(s)}`}
                      aria-label={`حذف ${shadeLabel(s)}`}
                      className="h-7 w-7 rounded-full border-2 border-[color:var(--line-ring)] transition-transform hover:scale-110"
                      style={{ backgroundColor: s.hexColor }}
                    />
                  ))
                )}
              </div>
              <button
                onClick={() => setStep("hair-photo")}
                disabled={selected.length === 0}
                className="cta rounded-full px-6 py-3 text-sm font-semibold"
              >
                ادامه
                {selected.length > 0 && ` (${toFaDigits(selected.length)})`}
              </button>
            </div>
          </div>

          <button
            onClick={reset}
            className="self-center rounded-full border border-[color:var(--line-panel)] px-5 py-2.5 text-sm text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.12)]"
          >
            بازگشت به صفحه اصلی
          </button>
        </section>
      )}

      {step === "shade-review" && scanned && (
        <section className="flex flex-col gap-5">
          {boxPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={boxPreview}
              alt="جعبه محصول"
              className="max-h-48 self-center rounded-xl object-contain"
            />
          )}

          <div className="panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
              <span
                className="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[color:var(--line-ring)]"
                style={{ backgroundColor: scanned.hexColor }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-gold-title">{shadeLabel(scanned)}</p>
                <p className="text-sm text-ink-body" dir="ltr">
                  {scanned.shadeCode}
                </p>
              </div>
              <ConfidenceBadge confidence={scanned.confidence} />
            </div>
            {scanned.colorDescription && (
              <p className="text-xs leading-relaxed text-ink-muted" dir="ltr">
                {scanned.colorDescription}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("shade")}>اسکن دوباره</SecondaryButton>
            <button
              onClick={() => {
                if (addScannedShade(scanned)) setStep("hair-photo");
              }}
              className="cta flex-1 rounded-full px-4 py-3 text-sm font-semibold"
            >
              همین رنگ رو می‌خوام
            </button>
          </div>
        </section>
      )}

      {step === "hair-photo" && selected.length > 0 && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-base font-semibold text-gold-title">عکس خودت رو انتخاب کن</p>
            <div className="flex items-center gap-1.5">
              {selected.map((s) => (
                <span
                  key={s.shadeCode}
                  title={`${shadeLabel(s)} (${s.shadeCode})`}
                  className="h-6 w-6 rounded-full border-2 border-[color:var(--line-ring)]"
                  style={{ backgroundColor: s.hexColor }}
                />
              ))}
              <span className="mr-1 text-xs text-ink-body">
                {toFaDigits(selected.length)} رنگ انتخاب شده
              </span>
            </div>
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

          <div className="flex gap-3">
            <SecondaryButton onClick={() => setStep("shade")}>تغییر رنگ‌ها</SecondaryButton>
            <button
              onClick={runTryOn}
              disabled={!hairFile}
              className="cta flex-1 rounded-full px-4 py-3 text-sm font-semibold"
            >
              اعمال {toFaDigits(selected.length)} رنگ
            </button>
          </div>

          <p className="text-center text-[11px] text-ink-faint">
            عکس شما محرمانه است و ذخیره نمی‌شود.
          </p>
        </section>
      )}

      {step === "result" && results.length > 0 && (
        <section className="flex flex-col gap-5">
          {loadingStatus && (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm text-ink-sub">{loadingStatus}</p>
              <div className="h-1 overflow-hidden rounded-full bg-[rgba(226,196,137,.14)]">
                <div
                  className="h-full rounded-full bg-gold-icon transition-all duration-500"
                  style={{ width: `${(doneCount / results.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {hairPreview && (
            <figure className="flex flex-col items-center gap-1">
              <figcaption className="text-xs text-ink-sub">عکس اصلی</figcaption>
              <button type="button" onClick={() => openLightbox(hairPreview)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hairPreview}
                  alt="عکس اصلی"
                  className="h-28 w-28 rounded-xl object-cover"
                />
              </button>
            </figure>
          )}

          <div className={`grid gap-3 ${results.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {results.map((r) => (
              <ResultCard key={r.shade.shadeCode} result={r} onOpen={openLightbox} />
            ))}
          </div>

          <p className="text-center text-xs text-ink-muted">
            نتیجه بسته به رنگ اولیه موی شما متفاوت است. برای بزرگ‌نمایی، ذخیره یا اشتراک‌گذاری روی
            هر تصویر بزنید.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={tryOtherColors}
              disabled={!!loadingStatus}
              className="cta rounded-full px-4 py-3.5 text-sm font-semibold"
            >
              امتحان رنگ‌های دیگر با همین عکس
            </button>
            <div className="flex gap-3">
              <SecondaryButton onClick={() => setStep("hair-photo")} disabled={!!loadingStatus}>
                عکس دیگر
              </SecondaryButton>
              <SecondaryButton onClick={reset} disabled={!!loadingStatus}>
                شروع دوباره
              </SecondaryButton>
            </div>
          </div>
        </section>
      )}

      {costs.length > 0 && (
        <p className="mt-auto pt-6 text-center text-[10px] text-ink-footer opacity-50">
          هزینه این جلسه{" "}
          <span dir="ltr" className="font-mono">
            {formatCost(totalCents)}
          </span>
        </p>
      )}

      {lightboxIndex !== null && lightboxItems[lightboxIndex] && (
        <Lightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </main>
  );
}

function ResultCard({
  result,
  onOpen,
}: {
  result: TryOnResult;
  onOpen: (src: string) => void;
}) {
  return (
    <figure className="flex flex-col gap-1.5">
      {result.image ? (
        <button
          type="button"
          onClick={() => onOpen(result.image!)}
          className="group relative overflow-hidden rounded-xl"
          aria-label={`بزرگ‌نمایی ${shadeLabel(result.shade)}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.image}
            alt={shadeLabel(result.shade)}
            className="aspect-square w-full object-cover"
          />
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(10,8,6,.7)] p-1.5 text-gold-outline opacity-0 transition-opacity group-hover:opacity-100">
            <ExpandIcon />
          </span>
        </button>
      ) : result.error ? (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-red-500/25 bg-red-950/25 p-3 text-center text-[11px] text-red-200">
          {result.error}
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-[rgba(26,20,13,.7)]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[rgba(226,196,137,.25)] border-t-gold-icon" />
        </div>
      )}
      <figcaption className="flex items-center justify-center gap-1.5 text-center">
        <span
          aria-hidden
          className="h-2.5 w-2.5 flex-none rounded-full border border-[color:var(--line-ring)]"
          style={{ backgroundColor: result.shade.hexColor }}
        />
        <span className="truncate text-[11px] font-medium text-gold-title">
          {shadeLabel(result.shade)}
        </span>
        <span className="text-[10px] text-ink-faint" dir="ltr">
          {result.shade.shadeCode}
        </span>
      </figcaption>
    </figure>
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

/** Presets arrive ordered by family, so a sequential pass is enough to group. */
function groupByFamily(presets: PresetShade[]): Array<{ family: string; items: PresetShade[] }> {
  const groups: Array<{ family: string; items: PresetShade[] }> = [];
  for (const preset of presets) {
    const last = groups[groups.length - 1];
    if (last && last.family === preset.family) last.items.push(preset);
    else groups.push({ family: preset.family, items: [preset] });
  }
  return groups;
}

function ShadeGroup({
  title,
  count,
  presets,
  isSelected,
  selectionIndex,
  onToggle,
}: {
  title: string;
  count: number;
  presets: PresetShade[];
  isSelected: (code: string) => boolean;
  selectionIndex: (code: string) => number;
  onToggle: (preset: PresetShade) => void;
}) {
  if (presets.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-baseline gap-2 text-xs font-medium text-ink-sub">
        <span>{title}</span>
        <span className="text-[10px] text-ink-faint">{toFaDigits(count)} رنگ</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        {presets.map((preset) => {
          const on = isSelected(preset.shadeCode);
          const order = selectionIndex(preset.shadeCode);
          return (
            <button
              key={preset.shadeCode}
              onClick={() => onToggle(preset)}
              aria-pressed={on}
              title={`${shadeLabel(preset)} — ${preset.shadeCode}`}
              className={`relative flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors ${
                on
                  ? "border-gold-icon bg-[rgba(226,196,137,.14)]"
                  : "border-[color:var(--line-panel)] hover:bg-[rgba(226,196,137,.1)]"
              }`}
            >
              <span
                aria-hidden
                className={`absolute top-2 left-2 h-2 w-2 rounded-full ${
                  preset.path === "local" ? "bg-emerald-400" : "bg-sky-400"
                }`}
              />
              {on && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-icon text-[10px] font-bold text-cta-ink">
                  {toFaDigits(order + 1)}
                </span>
              )}
              <span
                className="h-10 w-10 rounded-full border-2 border-[color:var(--line-ring)]"
                style={{ backgroundColor: preset.hexColor }}
              />
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-gold-title">
                {shadeLabel(preset)}
              </span>
              <span className="text-[10px] text-ink-faint" dir="ltr">
                {preset.shadeCode}
              </span>
            </button>
          );
        })}
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

function ExpandIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
    </svg>
  );
}
