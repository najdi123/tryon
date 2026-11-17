// Browser-only: reads the customer's photo, checks it, and shrinks it. The photo stays in the
// page's memory; it is sent nowhere until the customer agrees.
import { prepareHair, type PreparedHair } from "@/lib/hair-recolor";

export type PhotoProblem = "not_image" | "unreadable" | "too_small" | "too_dark" | "no_hair";

export type ReadyPhoto = {
  id: string; // previews belong to the photo they were made from
  blob: Blob; // JPEG, longest side at most 1280
  dataUrl: string;
  width: number;
  height: number;
  prepared: PreparedHair | null; // null when the on-device model could not load
};

const MAX_SIDE = 1280;
const MIN_SIDE = 400;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

export async function readPhoto(file: File): Promise<{ ok: true; photo: ReadyPhoto } | { ok: false; problem: PhotoProblem }> {
  // Some phones give no type at all: then decoding decides.
  if (file.type !== "" && !file.type.startsWith("image/")) return { ok: false, problem: "not_image" };
  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return { ok: false, problem: "unreadable" };
  }
  if (Math.min(img.naturalWidth, img.naturalHeight) < MIN_SIDE) return { ok: false, problem: "too_small" };
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { ok: false, problem: "unreadable" };
  ctx.drawImage(img, 0, 0, width, height);

  // Too dark to judge a colour on. Judged by the brightest tenth of the picture, not the average:
  // a lit face among dark hair, dark clothes and a dark wall is a good photo.
  const px = ctx.getImageData(0, 0, width, height).data;
  const hist = new Uint32Array(256);
  let n = 0;
  for (let i = 0; i < px.length; i += 4 * 97) {
    hist[Math.round(0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2])] += 1;
    n += 1;
  }
  let seen = 0;
  let p90 = 255;
  for (let v = 255; v >= 0; v--) {
    seen += hist[v];
    if (seen >= n * 0.1) { p90 = v; break; }
  }
  if (p90 < 60) return { ok: false, problem: "too_dark" };

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) return { ok: false, problem: "unreadable" };

  // The on-device model gets 20 seconds; without it the photo is still accepted.
  let prepared: PreparedHair | null = null;
  try {
    prepared = await Promise.race([
      prepareHair(new File([blob], "photo.jpg", { type: "image/jpeg" })),
      new Promise<null>((res) => setTimeout(() => res(null), 20_000)),
    ]);
  } catch {
    prepared = null;
  }
  // Refused only when almost no hair shows: a fringe under a scarf is enough to preview on.
  if (prepared && prepared.hairPixelCount / (width * height) < 0.005) return { ok: false, problem: "no_hair" };
  return { ok: true, photo: { id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`, blob, dataUrl, width, height, prepared } };
}
