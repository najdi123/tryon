"use client";

import { useCallback, useEffect, useState } from "react";
import { imageFileName, saveImage, shareImage } from "@/lib/image-share";

export type LightboxItem = {
  src: string;
  title: string;
  /** Shade code, or any short caption under the title. */
  caption?: string;
  /** Used for the download filename. */
  fileKey?: string;
};

type Props = {
  items: LightboxItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

export default function Lightbox({ items, index, onIndexChange, onClose }: Props) {
  const [toast, setToast] = useState<string | null>(null);
  const item = items[index];

  const go = useCallback(
    (delta: number) => {
      if (items.length < 2) return;
      onIndexChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  // Escape closes; arrows page through. RTL: ArrowLeft advances.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") go(1);
      else if (e.key === "ArrowRight") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  // Hold the page still behind the overlay.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!item) return null;

  const filename = imageFileName(item.fileKey ?? item.caption ?? item.title);

  function onSave() {
    saveImage(item.src, filename);
    setToast("تصویر ذخیره شد.");
  }

  async function onShare() {
    const outcome = await shareImage(item.src, filename, `${item.title} — تست مجازی رنگ مو`);
    if (outcome === "unsupported") {
      // No native share sheet here — saving is the useful equivalent.
      saveImage(item.src, filename);
      setToast("اشتراک‌گذاری در این مرورگر پشتیبانی نمی‌شود؛ تصویر ذخیره شد.");
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      className="fixed inset-0 z-50 flex flex-col bg-[rgba(6,5,4,.94)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex items-start justify-between gap-3 px-4 pt-5 pb-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gold-title">{item.title}</p>
          {item.caption && (
            <p className="text-xs text-ink-faint" dir="ltr">
              {item.caption}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-[color:var(--line-panel)] text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.14)]"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center px-4 pb-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.src}
          alt={item.title}
          className="max-h-full max-w-full rounded-2xl object-contain"
        />

        {items.length > 1 && (
          <>
            <NavButton side="right" label="قبلی" onClick={() => go(-1)} />
            <NavButton side="left" label="بعدی" onClick={() => go(1)} />
          </>
        )}
      </div>

      <div
        className="flex flex-col items-center gap-3 px-4 pb-7 pt-3"
        onClick={(e) => e.stopPropagation()}
      >
        {items.length > 1 && (
          <div className="flex items-center gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.src + i}
                type="button"
                aria-label={it.title}
                onClick={() => onIndexChange(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-gold-icon" : "w-1.5 bg-[rgba(226,196,137,.3)]"
                }`}
              />
            ))}
          </div>
        )}

        <div className="flex w-full max-w-sm gap-3">
          <button
            type="button"
            onClick={onShare}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-[color:var(--line-panel)] px-4 py-3 text-sm text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.14)]"
          >
            <ShareIcon />
            اشتراک‌گذاری
          </button>
          <button
            type="button"
            onClick={onSave}
            className="cta flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold"
          >
            <DownloadIcon />
            ذخیره تصویر
          </button>
        </div>

        <p aria-live="polite" className="min-h-4 text-center text-[11px] text-ink-faint">
          {toast}
        </p>
      </div>
    </div>
  );
}

function NavButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 -translate-y-1/2 ${
        side === "left" ? "left-2" : "right-2"
      } flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(20,16,12,.75)] text-gold-outline transition-colors hover:bg-[rgba(226,196,137,.2)]`}
    >
      <span className={side === "left" ? "" : "-scale-x-100"}>
        <ChevronIcon />
      </span>
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v13" />
      <path d="M8 12l4 4 4-4" />
      <path d="M5 21h14" />
    </svg>
  );
}
