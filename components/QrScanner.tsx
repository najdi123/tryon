"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

type Props = {
  onResult: (text: string) => void;
  onCancel?: () => void;
};

export default function QrScanner({ onResult, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, controls) => {
        controlsRef.current = controls;
        if (cancelled) return;
        if (result) {
          controls.stop();
          onResult(result.getText());
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't access the camera. Enter the product code manually below.");
        }
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onResult]);

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {!error && (
        <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-white/70" />
        </div>
      )}

      {error && <p className="text-sm text-amber-600">{error}</p>}

      <form
        className="flex w-full max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) onResult(manual.trim());
        }}
      >
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Enter code or #hex"
          className="flex-1 rounded-full border border-black/10 px-4 py-2 text-sm dark:border-white/15 dark:bg-zinc-900"
        />
        <button
          type="submit"
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background"
        >
          Use
        </button>
      </form>

      {onCancel && (
        <button onClick={onCancel} className="text-sm text-zinc-500 underline">
          Cancel
        </button>
      )}
    </div>
  );
}
