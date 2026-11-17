// Browser-only: the saved picture carries the brand and the shade code under the image.
import { COPY } from "@/components/ayeneh/copy";

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

export async function composeResult(resultDataUrl: string, label: { brand: string; code: string; nameFa: string }): Promise<string> {
  const img = await load(resultDataUrl);
  const w = img.naturalWidth;
  const band = Math.round(Math.max(96, w * 0.13));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = img.naturalHeight + band;
  const ctx = canvas.getContext("2d");
  if (!ctx) return resultDataUrl;
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, img.naturalHeight, w, band);
  const font = getComputedStyle(document.body).fontFamily;
  const pad = Math.round(w * 0.04);
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#14233a";
  ctx.font = `700 ${Math.round(band * 0.3)}px ${font}`;
  ctx.fillText(`${label.nameFa}  ·  ${label.code}`, w - pad, img.naturalHeight + band * 0.36, w - 2 * pad);
  ctx.fillStyle = "#4a5a70";
  ctx.font = `500 ${Math.round(band * 0.2)}px ${font}`;
  ctx.fillText(`${label.brand}  ·  ${COPY.appName}  ·  ${COPY.previewNote}`, w - pad, img.naturalHeight + band * 0.72, w - 2 * pad);
  return canvas.toDataURL("image/jpeg", 0.92);
}
