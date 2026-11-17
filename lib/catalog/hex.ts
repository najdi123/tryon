// Approximate swatch colours, built from the shade's level and tone. They are a stand-in until
// the colours are measured from the printed charts; the panel can correct any of them.

const LEVEL: Record<number, string> = {
  1: "#1a1614", 2: "#241c19", 3: "#2e211b", 4: "#3f2c22", 5: "#54392a", 6: "#6e4e37",
  7: "#8c6a48", 8: "#a98758", 9: "#c9a973", 10: "#dcc391", 11: "#e9d7ae", 12: "#f1e6c8",
};

// tone → [tint colour, how much of it]
const TONE: Record<string, [string, number]> = {
  none: ["#000000", 0],
  ash: ["#8c8a86", 0.35], smoky: ["#857c78", 0.35], matt: ["#7d7a5a", 0.3], violet: ["#5b2f8a", 0.55],
  golden: ["#c9973a", 0.35], goldenStrong: ["#cf9a2e", 0.5], sand: ["#c8b48a", 0.3], copper: ["#b5562a", 0.5],
  copperStrong: ["#c8571f", 0.65], mahogany: ["#6e2a35", 0.5], red: ["#a01f2a", 0.55], redStrong: ["#b51c2b", 0.75],
  cocoa: ["#6a5145", 0.35], tobacco: ["#7a5230", 0.35], nacre: ["#c9bfc4", 0.35], honey: ["#c98b3c", 0.4],
  cinnamon: ["#a8683a", 0.4], nescafe: ["#7b5a45", 0.35], chocolate: ["#5a3a2c", 0.4], beige: ["#c2ad92", 0.35],
  caramel: ["#b9793f", 0.4], pearl: ["#b8a9b0", 0.4], hemp: ["#a58a5e", 0.35], cappuccino: ["#8b6b55", 0.35],
};

const BIANCA_FAMILY_TONE: Record<string, string> = {
  natural: "none", "intense-natural": "none", smoky: "smoky", ash: "ash", golden: "golden", matt: "matt",
  honey: "honey", tobacco: "tobacco", copper: "copper", mahogany: "mahogany", violet: "violet", red: "red",
  cinnamon: "cinnamon", nescafe: "nescafe", chocolate: "chocolate", beige: "beige", caramel: "caramel",
  pearl: "pearl", hemp: "hemp", cappuccino: "cappuccino", sandy: "sand",
};

const OYSTER_REFLECT_TONE: Record<string, string> = {
  "0": "none", "00": "none", "1": "ash", "11": "matt", "2": "violet", "3": "golden", "33": "goldenStrong",
  "31": "sand", "4": "copper", "44": "copperStrong", "5": "mahogany", "6": "red", "66": "redStrong",
  "7": "cocoa", "8": "tobacco", "9": "nacre",
};

// Shades whose colour does not follow from level and tone (read off the chart photos by eye).
const EXPLICIT: Record<string, string> = {
  "bianca:1.1": "#14161c", "bianca:6.08": "#6b1f2e", "bianca:7.83": "#5a4a44", "bianca:8.51": "#d9a07c",
  "bianca:9.56": "#d9a9a0", "bianca:601": "#efe9df", "bianca:602": "#e3d2c4", "bianca:603": "#c9a98c",
  "bianca:604": "#a8875f", "bianca:605": "#3b2a28", "bianca:606": "#7d86a3", "bianca:607": "#9a8a86",
  "bianca:608": "#c9cdd1", "bianca:609": "#d3a3b8", "bianca:9.35": "#ecc4b0", "bianca:12.03": "#cdbfe0",
  "bianca:12.05": "#e3b98a", "bianca:12.06": "#e2d6cd", "bianca:S6": "#1f4fc4", "bianca:S7": "#f0a6c4",
  "bianca:S8": "#c9b7e0", "bianca:11.00": "#e8d9a8", "bianca:11.10": "#dcd8d2", "bianca:11.31": "#e0d5c4",
  "bianca:11.56": "#dcc3bd", "bianca:11.61": "#dad5d6", "bianca:11.90": "#cfcabf", "bianca:90.32": "#e6d7a3",
  "bianca:6.4": "#6e3322", "bianca:6.43": "#d9641e", "bianca:8.44": "#7a3520", "bianca:5.62": "#a3202e",
  "bianca:6.64": "#a6242c", "bianca:7.66": "#c01f33",
  "oyster-perlacolor:1/1": "#12141a",
};

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function shadeLevel(code: string): number | null {
  const m = /^(\d{1,2})(?:[./]|$)/.exec(code);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 12 ? n : null;
}

export function shadeHex(lineKey: string, familyKey: string, code: string): string | null {
  const explicit = EXPLICIT[`${lineKey}:${code}`];
  if (explicit) return explicit;
  const level = shadeLevel(code);
  if (level === null) return null;
  const toneKey = lineKey === "bianca" ? BIANCA_FAMILY_TONE[familyKey] : OYSTER_REFLECT_TONE[code.split("/")[1] ?? ""];
  if (!toneKey) return null;
  const [tint, amount] = TONE[toneKey];
  // A tint shows more on light hair than on dark.
  return mix(LEVEL[level], tint, amount * (0.6 + level * 0.04));
}
