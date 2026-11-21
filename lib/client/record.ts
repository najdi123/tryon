// Browser-only, development only: sends the before and after pictures of a try-on to the server
// for review, when the server says recording is on. Never throws and never waits on the customer.
import { flags } from "./api";
import type { ReadyPhoto } from "./photo";

const beforeSent = new Set<string>();

async function asJpeg(dataUrl: string): Promise<Blob | null> {
  const blob = await (await fetch(dataUrl)).blob();
  if (blob.type === "image/jpeg") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
  return new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
}

export type RecordOutcome = "shown" | "accepted" | "nudged" | "raw" | "unchecked" | "retry" | "rejected";

export function recordTryOn(photo: ReadyPhoto, lineKey: string, shadeCode: string, engine: "local" | "ai", outcome: RecordOutcome, afterDataUrl: string): void {
  if (!flags.recording) return;
  void (async () => {
    try {
      const after = await asJpeg(afterDataUrl);
      if (!after) return;
      const send = (withBefore: boolean) => {
        const form = new FormData();
        form.set("photoId", photo.id);
        form.set("lineKey", lineKey);
        form.set("shadeCode", shadeCode);
        form.set("engine", engine);
        form.set("outcome", outcome);
        form.set("after", after, "after.jpg");
        if (withBefore) form.set("before", photo.blob, "before.jpg");
        return fetch("/api/tryon/record", { method: "POST", body: form });
      };
      const first = !beforeSent.has(photo.id);
      beforeSent.add(photo.id); // set before the request: two results at once send it once
      const r = await send(first);
      if (r.status === 409) await send(true); // the server has no before picture for this photo
    } catch {
      // Recording must never get in the customer's way.
    }
  })();
}
