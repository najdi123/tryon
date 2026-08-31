"use client";

import type { Brand } from "@/lib/shades";

// Brand photography. The design handoff ships these as empty image slots — drop
// real files into public/brand/ and point these at them (2x: desktop columns
// ~860×1800, pack shots transparent PNG). Until then a soft gradient stands in.
const ASSETS: Record<
  "modelBianca" | "modelOyster" | "packBianca" | "packOyster",
  string | null
> = {
  modelBianca: null,
  modelOyster: null,
  packBianca: null,
  packOyster: null,
};

type Props = {
  /** Enter the try-on flow, optionally pre-filtered to one brand's catalog. */
  onStart: (brand?: Brand) => void;
};

export default function Landing({ onStart }: Props) {
  const steps = [
    { n: "۱", title: "انتخاب رنگ", body: "از بین طیف رنگ‌های بیانکا و اویستر", icon: <BottleIcon /> },
    { n: "۲", title: "عکس خودت", body: "عکس خودت رو آپلود کن", icon: <PortraitIcon /> },
    { n: "۳", title: "مشاهده نتیجه", body: "نتیجه رنگ مو روی عکس شما", icon: <SparkleHeadIcon /> },
  ];

  const features = [
    {
      title: "مناسب برای شما",
      body: "پیدا کردن رنگی که با چهره و استایل شما هماهنگ است",
      bodyShort: "هماهنگ با چهره و استایل شما",
      icon: <PersonHeartIcon />,
    },
    {
      title: "کیفیت حرفه‌ای",
      body: "با فرمولاسیون‌های حرفه‌ای و ماندگار",
      bodyShort: "فرمولاسیون حرفه‌ای و ماندگار",
      icon: <BottleIcon small />,
    },
    {
      title: "طیف کامل رنگ‌ها",
      body: "دسترسی به تمام رنگ‌های بیانکا و اویستر",
      bodyShort: "تمام رنگ‌های بیانکا و اویستر",
      icon: <DropletIcon />,
    },
    {
      title: "تکنولوژی هوش مصنوعی",
      titleShort: "هوش مصنوعی",
      body: "شبیه‌سازی دقیق و طبیعی رنگ مو روی عکس شما",
      bodyShort: "شبیه‌سازی دقیق روی عکس شما",
      icon: <AiRingIcon />,
    },
  ];

  return (
    <div className="stage relative flex min-h-screen flex-1 flex-col overflow-hidden">
      {/* Desktop: model columns fading toward the centre. Bianca (dark) leads in RTL. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[430px] lg:block [mask-image:linear-gradient(to_left,transparent_0%,#000_42%)]">
        <ModelPhoto src={ASSETS.modelBianca} alt="مدل موی تیره بیانکا" tone="dark" />
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[430px] lg:block [mask-image:linear-gradient(to_right,transparent_0%,#000_42%)]">
        <ModelPhoto src={ASSETS.modelOyster} alt="مدل موی روشن اویستر" tone="light" />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden lg:block"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 45%, rgba(10,8,6,.82) 0%, rgba(10,8,6,.55) 55%, rgba(10,8,6,0) 100%)",
        }}
      />

      <header className="relative flex items-center justify-between px-5 pb-2 pt-6 text-[13px] text-gold-bar lg:px-[34px] lg:py-[22px] lg:text-[15px]">
        <button type="button" className="flex items-center gap-2 transition-colors hover:text-gold-outline">
          <HelpIcon />
          <span>راهنما</span>
        </button>
        <button type="button" className="flex items-center gap-2 transition-colors hover:text-gold-outline">
          <GlobeIcon />
          <span>فارسی</span>
          <ChevronDownIcon />
        </button>
      </header>

      <div className="relative flex flex-1 flex-col items-center gap-4 pb-40 lg:gap-[26px] lg:pb-0">
        <BrandLockup />

        <div className="flex flex-col items-center gap-1.5 px-6 text-center lg:px-0">
          <h1 className="text-[26px] font-semibold leading-[1.4] text-ink-headline lg:text-[44px] lg:leading-[1.35]">
            رنگ موی جدیدت رو
          </h1>
          <p className="gold-text text-[30px] font-bold leading-[1.3] lg:text-[52px] lg:leading-[1.25]">
            قبل از رنگ کردن ببین!
          </p>
          <p className="mt-2 text-sm leading-[1.8] text-ink-sub lg:mt-2.5 lg:text-[17px]">
            با تست مجازی رنگ مو، بهترین انتخاب رو برای خودت پیدا کن.
          </p>
        </div>

        {/* Mobile: split photo band. */}
        <div className="relative mt-4 h-[260px] w-full flex-none lg:hidden">
          <div className="absolute inset-y-0 left-1/2 right-0 [mask-image:linear-gradient(to_left,transparent_6%,#000_60%)]">
            <ModelPhoto src={ASSETS.modelBianca} alt="مدل موی تیره" tone="dark" />
          </div>
          <div className="absolute inset-y-0 left-0 right-1/2 [mask-image:linear-gradient(to_right,transparent_6%,#000_60%)]">
            <ModelPhoto src={ASSETS.modelOyster} alt="مدل موی روشن" tone="light" />
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,8,6,.55) 0%, rgba(10,8,6,0) 30%, rgba(10,8,6,.9) 100%)",
            }}
          />
        </div>

        {/* Steps — stacked rows on mobile, one chevron-linked row on desktop. */}
        <ol className="panel mx-[18px] -mt-6 flex list-none flex-col gap-3.5 rounded-[20px] p-[18px] lg:mx-0 lg:mt-0 lg:flex-row lg:items-center lg:gap-[34px] lg:rounded-[22px] lg:px-10 lg:py-6">
          {steps.map((step, i) => (
            <li key={step.n} className="contents lg:flex lg:items-center lg:gap-[34px]">
              <div className="flex items-center gap-3.5 lg:w-[170px] lg:flex-col lg:gap-2.5 lg:text-center">
                <span className="grid h-[46px] w-[46px] flex-none place-items-center rounded-full border border-[color:var(--line-ring)] text-gold-icon lg:h-[70px] lg:w-[70px]">
                  {step.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gold-title lg:text-[15px]">
                    {step.n}. {step.title}
                  </p>
                  <p className="text-xs leading-[1.7] text-ink-body lg:text-[13px]">{step.body}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <>
                  <div className="h-px bg-[color:var(--line-divider)] lg:hidden" />
                  {/* Mirrored so it points RTL-forward (leftward). */}
                  <span aria-hidden className="hidden -scale-x-100 text-[#7d6b4f] lg:block">
                    <ChevronNextIcon />
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>

        {/* Desktop CTA — mobile gets the fixed bar at the bottom instead. */}
        <div className="mt-1 hidden flex-col items-center gap-3.5 lg:flex">
          <StartButton onClick={() => onStart()} size="lg" />
          <PrivacyNote />
        </div>

        {/* Mobile brand buttons. */}
        <div className="flex w-full gap-2.5 px-[18px] lg:hidden">
          <BrandPill brand="bianca" onClick={() => onStart("bianca")}>
            رنگ‌های بیانکا
          </BrandPill>
          <BrandPill brand="oyster" onClick={() => onStart("oyster")}>
            رنگ‌های اویستر
          </BrandPill>
        </div>

        {/* Mobile feature grid. */}
        <div className="grid w-full grid-cols-2 gap-2.5 px-[18px] lg:hidden">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-2xl border border-[color:var(--line-faint)] bg-[rgba(26,20,13,.7)] p-3.5"
            >
              <span className="text-gold-icon-dim">{f.icon}</span>
              <p className="text-[13px] font-semibold text-gold-title">{f.titleShort ?? f.title}</p>
              <p className="text-[11px] leading-[1.7] text-ink-muted">{f.bodyShort}</p>
            </div>
          ))}
        </div>

        <p className="px-[18px] pt-5 text-center text-[11px] text-ink-footer lg:hidden">
          © 2025 Ziba Rokh Qeshm. All Rights Reserved.
        </p>
      </div>

      {/* Desktop brand columns, layered over the model photos. */}
      <div className="pointer-events-none absolute bottom-[210px] right-[52px] hidden flex-col items-start gap-4 lg:flex">
        <div className="flex flex-col">
          <span className="gold-text-logo font-display text-[46px] font-medium">Bianca</span>
          <span className="text-[10px] tracking-[.28em] text-[#a08e70]">
            PROFESSIONAL HAIR COLOR
          </span>
        </div>
        <BrandPill brand="bianca" onClick={() => onStart("bianca")} className="pointer-events-auto">
          مشاهده رنگ‌های بیانکا
        </BrandPill>
      </div>
      <div className="pointer-events-none absolute bottom-[210px] left-[52px] hidden flex-col items-end gap-4 lg:flex">
        <div className="flex flex-col items-center">
          <span className="font-display text-[44px] font-medium text-oyster-ink">Oyster</span>
          <span className="-mt-[3px] text-[10px] tracking-[.4em] text-[#a09680]">COSMETICS</span>
        </div>
        <BrandPill brand="oyster" onClick={() => onStart("oyster")} className="pointer-events-auto">
          مشاهده رنگ‌های اویستر
        </BrandPill>
      </div>
      <PackShot src={ASSETS.packBianca} alt="پک بیانکا" side="right-[300px]" />
      <PackShot src={ASSETS.packOyster} alt="پک اویستر" side="left-[300px]" />

      {/* Desktop feature bar. */}
      <div
        className="absolute bottom-14 left-[120px] right-[120px] hidden grid-cols-4 gap-[18px] rounded-[20px] border border-[color:var(--line-faint)] px-[26px] py-5 lg:grid"
        style={{ background: "linear-gradient(180deg, rgba(30,23,15,.8), rgba(14,11,8,.8))" }}
      >
        {features.map((f) => (
          <div key={f.title} className="flex items-start gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full border border-[rgba(226,196,137,.28)] text-gold-icon-dim">
              {f.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gold-title">{f.title}</p>
              <p className="text-xs leading-[1.75] text-ink-muted">{f.body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="absolute bottom-4 left-0 right-0 hidden text-center text-xs text-ink-footer lg:block">
        © 2025 Ziba Rokh Qeshm. All Rights Reserved.
      </p>

      {/* Mobile fixed CTA bar. */}
      <div
        className="fixed bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-2.5 px-[18px] pb-6 pt-4 lg:hidden"
        style={{ background: "linear-gradient(180deg, rgba(10,8,6,0), rgba(10,8,6,.92) 40%)" }}
      >
        <StartButton onClick={() => onStart()} size="sm" />
        <PrivacyNote />
      </div>
    </div>
  );
}

function BrandLockup() {
  return (
    // dir=ltr, or the Latin names reverse to "Oyster & Bianca" inside the RTL page.
    <div dir="ltr" className="flex items-end justify-center gap-3 pt-2.5 lg:gap-[22px] lg:pt-3.5">
      <span className="gold-text-logo font-display text-[32px] font-medium lg:text-[52px]">
        Bianca
      </span>
      <span className="pb-1 font-display text-[22px] text-gold-amp lg:pb-[7px] lg:text-[34px]">
        &amp;
      </span>
      <span className="flex flex-col items-center pb-0.5 lg:pb-1">
        <span className="font-display text-[27px] font-medium text-oyster-ink lg:text-[44px]">
          Oyster
        </span>
        <span className="-mt-[3px] text-[8px] tracking-[.36em] text-[#9b8a6e] lg:-mt-1 lg:text-[11px] lg:tracking-[.42em]">
          COSMETICS
        </span>
      </span>
    </div>
  );
}

function StartButton({ onClick, size }: { onClick: () => void; size: "sm" | "lg" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        size === "lg"
          ? "cta flex items-center gap-3.5 rounded-2xl px-[54px] py-5 text-[21px] font-bold"
          : "cta flex w-full items-center justify-center gap-3 rounded-2xl py-[17px] text-[17px] font-bold"
      }
    >
      <CameraIcon size={size === "lg" ? 26 : 22} />
      <span>شروع تست رنگ مو</span>
    </button>
  );
}

function PrivacyNote() {
  return (
    <p className="flex items-center gap-2 text-[11px] text-ink-faint lg:text-[13px]">
      <ShieldIcon />
      <span>عکس شما محرمانه است و ذخیره نمی‌شود.</span>
    </p>
  );
}

function BrandPill({
  brand,
  onClick,
  className = "",
  children,
}: {
  brand: Brand;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const tone =
    brand === "bianca"
      ? "border-[rgba(226,196,137,.45)] bg-[rgba(30,22,14,.55)] text-gold-outline hover:bg-[rgba(226,196,137,.16)]"
      : "border-[rgba(226,226,226,.32)] bg-[rgba(28,28,28,.5)] text-oyster-ink-dim hover:bg-[rgba(255,255,255,.12)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full border px-6 py-3 text-[13px] transition-colors lg:flex-none lg:text-sm ${tone} ${className}`}
    >
      {children}
    </button>
  );
}

/** Real photo when supplied, otherwise a soft tonal stand-in. */
function ModelPhoto({
  src,
  alt,
  tone,
}: {
  src: string | null;
  alt: string;
  tone: "dark" | "light";
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-full w-full object-cover" />;
  }
  return (
    <div
      aria-hidden
      className="h-full w-full"
      style={{
        background:
          tone === "dark"
            ? "radial-gradient(70% 50% at 50% 30%, #3a2a1c 0%, #1b140e 60%, #0d0a07 100%)"
            : "radial-gradient(70% 50% at 50% 30%, #6b5a44 0%, #2a2219 60%, #0d0a07 100%)",
      }}
    />
  );
}

function PackShot({ src, alt, side }: { src: string | null; alt: string; side: string }) {
  if (!src) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`absolute bottom-[196px] hidden h-[210px] w-[130px] object-contain lg:block ${side}`}
    />
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────────
   Gold line glyphs standing in for the brand icon set (Lucide/Phosphor thin
   weight is the closest match if one gets adopted later). */

function Svg({
  size = 22,
  width = 1.2,
  children,
}: {
  size?: number;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function BottleIcon({ small }: { small?: boolean }) {
  return (
    <Svg size={small ? 20 : 24}>
      <rect x="7" y="7" width="10" height="14" rx="3" />
      <rect x="10" y="3" width="4" height="4" rx="1" />
      <path d="M9 12h6" />
    </Svg>
  );
}

function PortraitIcon() {
  return (
    <Svg size={24}>
      <circle cx="12" cy="11" r="6" />
      <path d="M4 21c2-4 5-5 8-5s6 1 8 5" />
    </Svg>
  );
}

function SparkleHeadIcon() {
  return (
    <Svg size={24}>
      <circle cx="11" cy="13" r="6" />
      <path d="M18.5 3.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" />
    </Svg>
  );
}

function PersonHeartIcon() {
  return (
    <Svg size={20}>
      <circle cx="11" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4-5 7-5" />
      <path d="M17 20l-2.2-2.2a1.6 1.6 0 012.2-2.2 1.6 1.6 0 012.2 2.2z" />
    </Svg>
  );
}

function DropletIcon() {
  return (
    <Svg size={20}>
      <path d="M12 3.5c3.2 4 5 6.4 5 8.9a5 5 0 11-10 0c0-2.5 1.8-4.9 5-8.9z" />
    </Svg>
  );
}

function AiRingIcon() {
  return (
    <Svg size={20}>
      <circle cx="12" cy="12" r="6.5" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </Svg>
  );
}

function CameraIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg size={size} width={1.5}>
      <rect x="2.5" y="6.5" width="19" height="14" rx="3" />
      <circle cx="12" cy="13.5" r="4" />
      <path d="M8.5 6.5l1.5-3h4l1.5 3" />
    </Svg>
  );
}

function ShieldIcon() {
  return (
    <Svg size={14} width={1.3}>
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z" />
    </Svg>
  );
}

function HelpIcon() {
  return (
    <Svg size={17} width={1.3}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
    </Svg>
  );
}

function GlobeIcon() {
  return (
    <Svg size={17} width={1.3}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18" />
    </Svg>
  );
}

function ChevronDownIcon() {
  return (
    <Svg size={12} width={1.6}>
      <path d="M5 9l7 7-7 7" />
    </Svg>
  );
}

function ChevronNextIcon() {
  return (
    <Svg size={16} width={1.6}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  );
}
