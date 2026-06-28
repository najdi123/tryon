"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";

// Restrict to the 1D product-barcode formats we care about (plus QR), and try harder.
function makeReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  return new BrowserMultiFormatReader(hints);
}

type Hit = { text: string; format: string; source: "camera" | "image" };

export default function BarcodeTest() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scanning, setScanning] = useState(false);
  const [hit, setHit] = useState<Hit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  function startCamera() {
    setError(null);
    setHit(null);
    setScanning(true);
    const reader = makeReader();
    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, _err, controls) => {
        controlsRef.current = controls;
        if (result) {
          controls.stop();
          setScanning(false);
          setHit({
            text: result.getText(),
            format: BarcodeFormat[result.getBarcodeFormat()],
            source: "camera",
          });
        }
      })
      .catch(() => {
        setScanning(false);
        setError("Couldn't access the camera. Try the image-upload option below.");
      });
  }

  async function decodeImage(file: File) {
    setError(null);
    setHit(null);
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    try {
      const reader = makeReader();
      const result = await reader.decodeFromImageUrl(url);
      setHit({
        text: result.getText(),
        format: BarcodeFormat[result.getBarcodeFormat()],
        source: "image",
      });
    } catch {
      setError("No barcode could be read from that image. Try a sharper, straight-on, well-lit shot that fills the frame.");
    }
  }

  useEffect(() => () => stopCamera(), []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Barcode Reader Test</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Scan a product barcode with the camera, or upload a photo of one.
        </p>
      </header>

      {hit && (
        <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center dark:bg-emerald-950/40">
          <p className="text-xs uppercase tracking-wide text-emerald-600">
            Read via {hit.source}
          </p>
          <p className="mt-1 break-all font-mono text-2xl font-semibold text-emerald-800 dark:text-emerald-300">
            {hit.text}
          </p>
          <p className="mt-1 text-sm text-emerald-600">Format: {hit.format}</p>
        </div>
      )}

      {error && (
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/40">
          {error}
        </p>
      )}

      {/* Camera */}
      <section className="flex flex-col items-center gap-3">
        <div className="relative w-full overflow-hidden rounded-2xl bg-black">
          <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
        </div>
        {scanning ? (
          <button onClick={stopCamera} className="rounded-full border border-black/10 px-5 py-2 text-sm dark:border-white/15">
            Stop camera
          </button>
        ) : (
          <button onClick={startCamera} className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background">
            Start camera scan
          </button>
        )}
      </section>

      <div className="flex items-center gap-3 text-xs text-zinc-400">
        <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" /> OR <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Image upload */}
      <section className="flex flex-col gap-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-black/10 px-6 py-8 text-center dark:border-white/15">
          <span className="text-sm text-zinc-500">Upload a photo of a barcode</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) decodeImage(f);
            }}
          />
        </label>
        {imgUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgUrl} alt="uploaded barcode" className="max-h-56 self-center rounded-xl" />
        )}
      </section>
    </main>
  );
}
