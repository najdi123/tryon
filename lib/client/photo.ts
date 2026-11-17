// Browser-only: reads the customer's photo, checks it, and shrinks it. The photo stays in the
// page's memory; it is sent nowhere until the customer agrees.
import { prepareHair, type PreparedHair } from "@/lib/hair-recolor";

export type PhotoProblem = "not_image" | "unreadable" | "too_small" | "too_dark" | "no_hair";

export type ReadyPhoto = {
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
  if (!file.type.startsWith("image/")) return { ok: false, problem: "not_image" };
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

  // Too dark to judge a colour on: mean brightness of a sparse sample.
  const px = ctx.getImageData(0, 0, width, height).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 4 * 97) {
    sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    n += 1;
  }
  if (sum / n < 40) return { ok: false, problem: "too_dark" };

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) return { ok: false, problem: "unreadable" };

  let prepared: PreparedHair | null = null;
  try {
    prepared = await prepareHair(new File([blob], "photo.jpg", { type: "image/jpeg" }));
  } catch {
    prepared = null; // the on-device model is unavailable; the photo itself may be fine
  }
  if (prepared && prepared.hairPixelCount / (width * height) < 0.02) return { ok: false, problem: "no_hair" };
  return { ok: true, photo: { blob, dataUrl, width, height, prepared } };
}
