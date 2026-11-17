import { deltaE, hexToLab, labToHex, type Lab } from "./lab";

// The rules for what happens to a preview the image service made, decided by measuring it.
// Numbers come from the 17 November 2026 tests (PLAN.md): the chosen model lands within about 4
// of the colour it is sent on most shades and about 25 too dark on reds.
export const ACCEPT_WITHIN = 10; // close enough: shown as it came
export const NUDGE_WITHIN = 30; // further than this is a miss, not something to correct
export const UNCHANGED_WITHIN = 5; // the hair still measures as it did before
// The correction is deliberately small. On the first build it moved the hair all the way to the
// shade's colour: the result looked painted, and wherever the catalogue's colour was itself
// approximate it made the picture worse. So it now goes half way, within tight limits, and
// leaves the picture's own shading alone.
export const NUDGE_SHARE = 0.5;
export const NUDGE_SCALE_MIN = 0.88;
export const NUDGE_SCALE_MAX = 1.18;
export const NUDGE_CHROMA_MAX = 7; // per colour axis
export const COMPENSATE_MAX = 25; // how far a retry may move the colour it asks for, per axis

export type Verdict =
  | { kind: "accept"; distance: number }
  | { kind: "nudge"; distance: number; scaleL: number; da: number; db: number }
  | { kind: "retry"; distance: number; reason: "unchanged" | "far"; compensate: Lab };

// measured: the lit body of the hair in the preview. before: the same in the customer's photo.
export function judge(measured: Lab, targetHex: string, before: Lab): Verdict {
  const target = hexToLab(targetHex);
  const distance = deltaE(measured, target);
  const clamp = (v: number) => Math.max(-COMPENSATE_MAX, Math.min(COMPENSATE_MAX, v));
  // Ask again for a colour moved the opposite way to the miss.
  const compensate: Lab = [clamp(target[0] - measured[0]), clamp(target[1] - measured[1]), clamp(target[2] - measured[2])];
  if (distance <= ACCEPT_WITHIN) return { kind: "accept", distance };
  if (deltaE(measured, before) < UNCHANGED_WITHIN && deltaE(target, before) > 3 * UNCHANGED_WITHIN) {
    return { kind: "retry", distance, reason: "unchanged", compensate };
  }
  if (distance > NUDGE_WITHIN) return { kind: "retry", distance, reason: "far", compensate };
  const lim = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const wantScale = target[0] / Math.max(measured[0], 1);
  return {
    kind: "nudge",
    distance,
    scaleL: lim(1 + (wantScale - 1) * NUDGE_SHARE, NUDGE_SCALE_MIN, NUDGE_SCALE_MAX),
    da: lim((target[1] - measured[1]) * NUDGE_SHARE, -NUDGE_CHROMA_MAX, NUDGE_CHROMA_MAX),
    db: lim((target[2] - measured[2]) * NUDGE_SHARE, -NUDGE_CHROMA_MAX, NUDGE_CHROMA_MAX),
  };
}

// The colour a retry asks the image service for: the shade's own colour moved by the bounded miss.
export function compensatedHex(targetHex: string, compensate: Lab): string {
  const t = hexToLab(targetHex);
  const c = (v: number) => Math.max(-COMPENSATE_MAX, Math.min(COMPENSATE_MAX, v));
  return labToHex([Math.max(0, Math.min(100, t[0] + c(compensate[0]))), t[1] + c(compensate[1]), t[2] + c(compensate[2])]);
}
