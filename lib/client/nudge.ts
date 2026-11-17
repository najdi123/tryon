// Browser-only: measures the hair colour in a preview and, when asked, moves it to the shade's
// colour. Plain arithmetic on pixels, on the customer's own phone: nothing is uploaded again and
// no second AI is involved. Only hair pixels move; the edge is feathered so no seam shows.
import type { PreparedHair } from "@/lib/hair-recolor";
import { labToRgb, rgbToLab, type Lab } from "@/lib/colour/lab";

const HAIR = 1; // the hair category in the on-device mask

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

// The preview drawn at the photo's own size, so the phone's hair mask lines up with it.
export async function previewPixels(dataUrl: string, prep: PreparedHair): Promise<ImageData> {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = prep.width;
  canvas.height = prep.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, prep.width, prep.height);
  return ctx.getImageData(0, 0, prep.width, prep.height);
}

// The lit body of the hair: the median colour of hair pixels between the 45th and 85th
// percentile of lightness. Root shadow and glare are left out, as on a printed swatch.
export function hairBody(px: Uint8ClampedArray, mask: Uint8Array): Lab | null {
  const step = Math.max(1, Math.floor(mask.length / 60_000)); // a sample is enough to measure
  const labs: Lab[] = [];
  for (let i = 0; i < mask.length; i += step) {
    if (mask[i] === HAIR) labs.push(rgbToLab(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]));
  }
  if (labs.length < 200) return null;
  const byL = labs.map((l) => l[0]).sort((a, b) => a - b);
  const lo = byL[Math.floor(byL.length * 0.45)];
  const hi = byL[Math.floor(byL.length * 0.85)];
  const body = labs.filter((l) => l[0] >= lo && l[0] <= hi);
  const median = (k: 0 | 1 | 2) => {
    const v = body.map((l) => l[k]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };
  return [median(0), median(1), median(2)];
}

// A soft version of the hair mask (0 to 1), blurred by a few pixels in both directions.
function feather(mask: Uint8Array, w: number, h: number): Float32Array {
  const r = Math.max(2, Math.round(Math.min(w, h) * 0.006));
  const src = new Float32Array(mask.length);
  for (let i = 0; i < mask.length; i++) src[i] = mask[i] === HAIR ? 1 : 0;
  const tmp = new Float32Array(mask.length);
  const pass = (from: Float32Array, to: Float32Array, len: number, lines: number, at: (line: number, k: number) => number) => {
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += from[at(line, Math.max(0, Math.min(len - 1, k)))];
      for (let k = 0; k < len; k++) {
        to[at(line, k)] = sum / (2 * r + 1);
        sum += from[at(line, Math.min(len - 1, k + r + 1))] - from[at(line, Math.max(0, k - r))];
      }
    }
  };
  pass(src, tmp, w, h, (y, x) => y * w + x);
  pass(tmp, src, h, w, (x, y) => y * w + x);
  return src;
}

// Moves the hair's colour: lightness is scaled (shine and shadow keep their relation), the two
// colour axes are shifted. Returns a JPEG data URL at the photo's size.
export function applyNudge(image: ImageData, prep: PreparedHair, n: { scaleL: number; da: number; db: number }): string {
  const { width: w, height: h } = prep;
  const px = image.data;
  const alpha = feather(prep.mask, w, h);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i];
    if (a < 0.01) continue;
    const p = i * 4;
    const [L, A, B] = rgbToLab(px[p], px[p + 1], px[p + 2]);
    const [r, g, b] = labToRgb([Math.min(100, L * n.scaleL), A + n.da, B + n.db]);
    px[p] = px[p] + (r - px[p]) * a;
    px[p + 1] = px[p + 1] + (g - px[p + 1]) * a;
    px[p + 2] = px[p + 2] + (b - px[p + 2]) * a;
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.92);
}
