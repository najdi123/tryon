// Colour arithmetic shared by the browser and the server. CIE Lab (D65) is used because equal
// distances in it look roughly equally different to the eye, which RGB does not give.

export type Lab = [number, number, number];

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const gam = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
const fi = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);

export function rgbToLab(r: number, g: number, b: number): Lab {
  const [R, G, B] = [lin(r / 255), lin(g / 255), lin(b / 255)];
  const x = f((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047);
  const y = f(0.2126729 * R + 0.7151522 * G + 0.072175 * B);
  const z = f((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

export function labToRgb([L, a, b]: Lab): [number, number, number] {
  const y = (L + 16) / 116;
  const X = fi(y + a / 500) * 0.95047;
  const Y = fi(y);
  const Z = fi(y - b / 200) * 1.08883;
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(gam(v) * 255)));
  return [
    to(3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z),
    to(-0.969266 * X + 1.8760108 * Y + 0.041556 * Z),
    to(0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z),
  ];
}

export function hexToLab(hex: string): Lab {
  return rgbToLab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
}

export function labToHex(lab: Lab): string {
  return `#${labToRgb(lab).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// How different two colours look. Under about 3 is hard to see; over about 10 is plainly different.
export function deltaE(p: Lab, q: Lab): number {
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
}
