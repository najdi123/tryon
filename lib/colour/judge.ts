import { deltaE, hexToLab, labToHex, type Lab } from "./lab";

// The rules for what happens to a preview the image service made, decided by measuring it.
// Numbers come from the 17 November 2026 tests (PLAN.md): the chosen model lands within about 4
// of the colour it is sent on most shades and about 25 too dark on reds.
export const ACCEPT_WITHIN = 6; // close enough: shown as it came
export const NUDGE_WITHIN = 30; // further than this is a miss, not something to correct
export const UNCHANGED_WITHIN = 5; // the hair still measures as it did before
export const LIGHTNESS_SCALE_MIN = 0.6; // past these the correction itself would look fake
export const LIGHTNESS_SCALE_MAX = 1.6;
export const COMPENSATE_MAX = 25; // how far a retry may move the colour it asks for, per axis

export type Verdict =
  | { kind: "accept"; distance: number }
  | { kind: "nudge"; distance: number; scaleL: number; da: number; db: number }
  | { kind: "retry"; distance: number; reason: "unchanged" | "far" | "too_strong"; compensate: Lab };

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
  const scaleL = target[0] / Math.max(measured[0], 1);
  if (scaleL < LIGHTNESS_SCALE_MIN || scaleL > LIGHTNESS_SCALE_MAX) return { kind: "retry", distance, reason: "too_strong", compensate };
  return { kind: "nudge", distance, scaleL, da: target[1] - measured[1], db: target[2] - measured[2] };
}

// The colour a retry asks the image service for: the shade's own colour moved by the bounded miss.
export function compensatedHex(targetHex: string, compensate: Lab): string {
  const t = hexToLab(targetHex);
  const c = (v: number) => Math.max(-COMPENSATE_MAX, Math.min(COMPENSATE_MAX, v));
  return labToHex([Math.max(0, Math.min(100, t[0] + c(compensate[0]))), t[1] + c(compensate[1]), t[2] + c(compensate[2])]);
}
