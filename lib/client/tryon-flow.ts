// Browser-only: one image-service preview from request to verdict.
//   make the picture -> measure the hair colour -> show it, correct it, or ask once more.
// Every picture the service makes is one paid attempt; at most two are made for one preview.
import { sendVerdict, tryOnAi, type TryOnFailure } from "./api";
import { applyNudge, hairBody, previewPixels } from "./nudge";
import type { ReadyPhoto } from "./photo";
import { judge } from "@/lib/colour/judge";
import type { Lab } from "@/lib/colour/lab";

export type FlowResult = { ok: true; image: string } | { ok: false; reason: TryOnFailure | "colour_off" };

export async function aiPreview(photo: ReadyPhoto, lineKey: string, shade: { code: string; hex: string }): Promise<FlowResult> {
  const prep = photo.prepared;
  const before = prep ? hairBody(prep.basePixels, prep.mask) : null;
  let compensate: Lab | undefined;
  for (const attempt of [1, 2] as const) {
    const r = await tryOnAi(photo.blob, lineKey, shade.code, compensate);
    if (!r.ok) return r;
    // Without the on-device mask the colour cannot be measured: the picture is shown unchecked.
    if (!prep || !before) {
      sendVerdict(r.attemptId, "unchecked");
      return { ok: true, image: r.image };
    }
    try {
      const pixels = await previewPixels(r.image, prep);
      const measured = hairBody(pixels.data, prep.mask);
      if (!measured) {
        sendVerdict(r.attemptId, "unchecked");
        return { ok: true, image: r.image };
      }
      const v = judge(measured, shade.hex, before);
      if (v.kind === "accept") {
        sendVerdict(r.attemptId, "accepted");
        return { ok: true, image: r.image };
      }
      if (v.kind === "nudge") {
        const image = applyNudge(pixels, prep, v);
        sendVerdict(r.attemptId, "nudged");
        return { ok: true, image };
      }
      sendVerdict(r.attemptId, attempt === 1 ? "retry" : "rejected"); // not a success either way
      if (attempt === 2) return { ok: false, reason: "colour_off" };
      compensate = v.compensate;
    } catch {
      sendVerdict(r.attemptId, "unchecked"); // measuring failed: the picture itself is fine to show
      return { ok: true, image: r.image };
    }
  }
  return { ok: false, reason: "colour_off" };
}
