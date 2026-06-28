// Browser-only module — uses MediaPipe Tasks Vision for hair segmentation
// and Canvas 2D API for pixel-level HSL recolor.
// Import only from "use client" code; never from server components or API routes.

import type { ImageSegmenter as ImageSegmenterType } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite";

// Category index for hair in the selfie_multiclass_256x256 model
const HAIR_IDX = 1;

// Module-level singleton so we only load WASM + model once per session
let _seg: ImageSegmenterType | null = null;
let _loading: Promise<ImageSegmenterType> | null = null;

export async function loadSegmenter(): Promise<ImageSegmenterType> {
  if (_seg) return _seg;
  if (_loading) return _loading;
  _loading = (async () => {
    const { ImageSegmenter, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const vision = await FilesetResolver.forVisionTasks(WASM_URL);
    const seg = await ImageSegmenter.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_URL },
      outputCategoryMask: true,
      outputConfidenceMasks: false,
      runningMode: "IMAGE",
    });
    _seg = seg;
    return seg;
  })();
  return _loading;
}

// ── Color utilities ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(f(h + 1 / 3) * 255),
    Math.round(f(h) * 255),
    Math.round(f(h - 1 / 3) * 255),
  ];
}

function loadImageEl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// Nearest-neighbour upsample — maps a (srcW×srcH) mask to (dstW×dstH)
function scaleMask(
  src: Uint8Array,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): Uint8Array {
  const dst = new Uint8Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      dst[y * dstW + x] = src[sy * srcW + sx];
    }
  }
  return dst;
}

// ── Public API ───────────────────────────────────────────────────────────────

export type RecolorResult = {
  dataUrl: string;
  avgHairLightness: number; // 0–1, used to decide if Gemini is needed
  hairPixelCount: number;   // 0 means no hair detected → fall back to Gemini
};

export async function recolorHair(file: File, targetHex: string): Promise<RecolorResult> {
  const [segmenter, img] = await Promise.all([loadSegmenter(), loadImageEl(file)]);

  const W = img.naturalWidth;
  const H = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  const segResult = segmenter.segment(canvas);
  const rawMask = segResult.categoryMask?.getAsUint8Array();
  const maskW = segResult.categoryMask?.width ?? 256;
  const maskH = segResult.categoryMask?.height ?? 256;
  // Free GPU/WASM memory immediately
  if (segResult.close) segResult.close();

  if (!rawMask) throw new Error("Segmentation returned no mask.");

  const mask =
    maskW === W && maskH === H
      ? rawMask
      : scaleMask(rawMask, maskW, maskH, W, H);

  const imageData = ctx.getImageData(0, 0, W, H);
  const px = imageData.data;

  const [tR, tG, tB] = hexToRgb(targetHex);
  const [tH, tS, tL] = rgbToHsl(tR, tG, tB);

  // Pass 1 — measure average lightness of hair pixels for proportional shift
  let lSum = 0;
  let hairCount = 0;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== HAIR_IDX) continue;
    const [, , l] = rgbToHsl(px[i * 4] / 255, px[i * 4 + 1] / 255, px[i * 4 + 2] / 255);
    lSum += l;
    hairCount++;
  }
  const avgL = hairCount > 0 ? lSum / hairCount : 0.3;
  const lDelta = tL - avgL;

  // Pass 2 — recolor each hair pixel
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] !== HAIR_IDX) continue;
    const pi = i * 4;
    const [, srcS, srcL] = rgbToHsl(px[pi] / 255, px[pi + 1] / 255, px[pi + 2] / 255);

    // Shift hue fully to target; blend saturation; shift lightness proportionally
    // keeping per-pixel variation (highlights/shadows) intact.
    const newS = srcS * 0.3 + tS * 0.7;
    const newL = Math.max(0.03, Math.min(0.96, srcL + lDelta * 0.7));
    const [nr, ng, nb] = hslToRgb(tH, newS, newL);
    px[pi] = nr;
    px[pi + 1] = ng;
    px[pi + 2] = nb;
  }

  ctx.putImageData(imageData, 0, 0);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.92),
    avgHairLightness: avgL,
    hairPixelCount: hairCount,
  };
}

// Returns true when the target shade requires significant lightening (bleaching),
// which canvas recolor can't realistically simulate — Gemini handles it better.
export function needsGemini(avgHairLightness: number, targetHex: string): boolean {
  const [tR, tG, tB] = hexToRgb(targetHex);
  const [, , tL] = rgbToHsl(tR, tG, tB);
  return tL - avgHairLightness > 0.27;
}
