// Procedural "lock of hair" swatch, modelled on the Perlacolor fold-out chart.
//
// Everything is derived from the shade's hex: the fibres, the specular band
// and the edge shading are strokes and gradients inside one SVG, so there are
// no image assets and the swatch scales from 12px to full screen. Rendering is
// deterministic per (hex, seed) so a shade never redraws differently.
//
// Framework-free on purpose: the React wrapper lives in components/HairLock.tsx
// and this file can be transpiled and dropped into a plain HTML preview.

export const LOCK_W = 100;
export const LOCK_H = 130;
export const LOCK_VIEWBOX = `0 0 ${LOCK_W} ${LOCK_H}`;

// ── Geometry ─────────────────────────────────────────────────────────────
// The tress is built from a centreline that bends toward the lower left and a
// half-width profile: a round crown, fullest a third of the way down, tapering
// into a curled tail. The outline and every fibre are sampled from the same
// two functions, so the fibres hug the silhouette and converge at the tail
// the way real hair does when a lock is twisted to a point.

const TOP = 3;
const BOTTOM = LOCK_H - 3;
const HALF_MAX = 46;
const CROWN = 0.36; // fraction of the height at which the lock is widest
const BEND = 9; // how far left the tail drifts

function centreX(t: number): number {
  return 50 - BEND * Math.pow(t, 2.2);
}

function halfWidth(t: number): number {
  if (t < CROWN) {
    const u = (CROWN - t) / CROWN;
    return HALF_MAX * Math.sqrt(Math.max(0, 1 - u * u));
  }
  const u = (t - CROWN) / (1 - CROWN);
  // Slightly convex taper with a blunt, rounded tip.
  return HALF_MAX * Math.pow(1 - u, 1.1) * (1 - 0.05 * u) + 4 * Math.sqrt(Math.max(0, 1 - Math.pow(u, 6)));
}

const yAt = (t: number) => TOP + t * (BOTTOM - TOP);

function outline(): string {
  const f = (n: number) => n.toFixed(1);
  const right: string[] = [];
  const left: string[] = [];
  const steps = 26;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = centreX(t);
    const hw = halfWidth(t);
    right.push(`${f(cx + hw)} ${f(yAt(t))}`);
    left.push(`${f(cx - hw)} ${f(yAt(t))}`);
  }
  return "M" + right.join(" L") + " L" + left.reverse().join(" L") + " Z";
}

/** Silhouette of a tress folded at the top and hanging, twisted into a tail
 *  that curls to the lower left. Fibres are clipped to this; the solid fill
 *  underneath is drawn slightly smaller so the edge is fibre tips, not a line. */
export const LOCK_PATH = outline();

export type Strand = {
  d: string;
  stroke: string;
  width: number;
  opacity: number;
};

export type LockModel = {
  base: string;
  /** Darker base for the outer edges and the tip. */
  shadow: string;
  /** Tinted specular colour: black hair gets a blue-black sheen, copper a warm one. */
  sheen: string;
  /** Body fibres, drawn over the base fill. */
  strands: Strand[];
  /** Bright fibres, drawn only inside the specular band via a mask. */
  highlights: Strand[];
  /** Overall strength of the specular band. */
  sheenAlpha: number;
};

export function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l * 100];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h: number;
  if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (mx === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hsl = (h: number, s: number, l: number) =>
  `hsl(${h.toFixed(0)} ${clamp(s, 0, 100).toFixed(0)}% ${clamp(l, 0, 100).toFixed(0)}%)`;

/** Tiny LCG seeded from a string, so the same shade always draws the same lock. */
function seeded(seed: string): () => number {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Quadratic through the midpoints, so fibres stay smooth when drawn large. */
function smooth(pts: Array<[number, number]>): string {
  const f = (n: number) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
  }
  const last = pts[pts.length - 1];
  return d + ` L${f(last[0])} ${f(last[1])}`;
}

/** One fibre: sits at a fixed fraction u of the lock's width. It follows the
 *  silhouette only partly, so fibres run nearly parallel, overhang the taper
 *  (the clip trims them) and leave a wispy edge and tail rather than all
 *  meeting at one point. */
function fibre(rnd: () => number, u: number): string {
  const follow = 0.45 + rnd() * 0.25;
  const wave = 0.5 + rnd() * 1.6;
  const phase = rnd() * Math.PI * 2;
  const freq = 0.03 + rnd() * 0.03;
  const pts: Array<[number, number]> = [];
  for (let y = -6; y <= LOCK_H + 6; y += 9) {
    const t = clamp((y - TOP) / (BOTTOM - TOP), 0, 1);
    const spread = halfWidth(t) * follow + HALF_MAX * (1 - follow) * (1 - t * 0.25);
    const x = centreX(t) + u * spread + Math.sin(y * freq + phase) * wave * (1 - t * 0.5);
    pts.push([x, y]);
  }
  return smooth(pts);
}

export function buildLock(hex: string, seed = hex, count = 72): LockModel {
  const [h, s, l] = hexToHsl(hex);
  const rnd = seeded(seed);

  // Fibre contrast grows as the shade darkens (a black lock has no room below
  // it) and flips at the pale end (platinum has no room above).
  const dark = l < 24;
  const pale = l > 68;
  const swing = clamp(22 - l * 0.14, 7, 22);
  const bias = dark ? 0.45 : pale ? -0.6 : -0.1;

  const strands: Strand[] = [];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1;
    const d = clamp(((rnd() * 2 - 1) + bias) * swing, -swing * 1.6, swing * 1.6);
    strands.push({
      d: fibre(rnd, u),
      stroke: hsl(h + (rnd() - 0.5) * 5, s * (0.85 + rnd() * 0.35), l + d),
      width: 0.6 + rnd() * 1.4,
      opacity: 0.5 + rnd() * 0.5,
    });
  }

  // Specular streaks: thin, bright, tinted by the shade. The mask in the
  // renderer confines them to the band across the crown.
  const sheenL = dark ? Math.max(l + 40, 40) : pale ? 97 : clamp(l + 34, 62, 95);
  const sheen = hsl(h, dark ? Math.min(s + 10, 45) : s * 0.9, sheenL);
  const highlights: Strand[] = [];
  const hiCount = Math.max(10, Math.round(count * 0.6));
  for (let i = 0; i < hiCount; i++) {
    highlights.push({
      d: fibre(rnd, rnd() * 1.9 - 0.95),
      stroke: hsl(h + (rnd() - 0.5) * 4, s * 0.8, sheenL + (rnd() - 0.5) * 8),
      width: 0.5 + rnd() * 1.3,
      opacity: 0.5 + rnd() * 0.5,
    });
  }

  return {
    base: hex,
    shadow: hsl(h, s * 1.05, l * (dark ? 0.6 : 0.68)),
    sheen,
    strands,
    highlights,
    sheenAlpha: pale ? 0.85 : 1,
  };
}
