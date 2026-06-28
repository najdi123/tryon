// Hair color catalog + QR payload parser.
//
// The QR code on a product can encode the color in several ways; this module
// normalizes all of them into a single `HairShade` so the rest of the app does
// not care which format you ultimately print on the packaging:
//
//   1. A SKU that maps to an entry in CATALOG below  ->  "HC-103"
//   2. A raw hex color                               ->  "#8B4513"
//   3. A URL whose query has ?sku= or ?color=        ->  "https://shop.example/p?sku=HC-103"
//   4. Anything else is treated as a free-text shade name.

export type HairShade = {
  /** Stable id used in prompts/analytics. */
  id: string;
  /** Human-facing marketing name, e.g. "Chocolate Brown". */
  name: string;
  /** Hex swatch shown in the UI. */
  hex: string;
  /** Extra phrasing fed to the image model for a more faithful render. */
  description?: string;
};

// Edit this catalog to match your real product line.
export const CATALOG: Record<string, HairShade> = {
  "HC-101": { id: "HC-101", name: "Jet Black", hex: "#0b0b0d", description: "deep neutral black with a soft natural sheen" },
  "HC-102": { id: "HC-102", name: "Dark Brown", hex: "#3b2417", description: "rich dark brown, slightly warm" },
  "HC-103": { id: "HC-103", name: "Chocolate Brown", hex: "#5a3825", description: "warm medium chocolate brown" },
  "HC-104": { id: "HC-104", name: "Chestnut", hex: "#7b4a2b", description: "warm reddish chestnut brown" },
  "HC-105": { id: "HC-105", name: "Honey Blonde", hex: "#b07b3e", description: "warm golden honey blonde" },
  "HC-106": { id: "HC-106", name: "Ash Blonde", hex: "#b9a888", description: "cool, muted ash blonde with low warmth" },
  "HC-107": { id: "HC-107", name: "Platinum Blonde", hex: "#e6e0d0", description: "very light, almost white platinum blonde" },
  "HC-108": { id: "HC-108", name: "Burgundy", hex: "#5c1a2b", description: "deep red-violet burgundy" },
  "HC-109": { id: "HC-109", name: "Copper Red", hex: "#a8431f", description: "vivid warm copper red" },
};

const HEX_RE = /^#?[0-9a-fA-F]{6}$/;

function normalizeHex(value: string): string {
  return value.startsWith("#") ? value : `#${value}`;
}

/** Look up a SKU in the catalog (case-insensitive). */
function lookupSku(sku: string): HairShade | undefined {
  const key = Object.keys(CATALOG).find((k) => k.toLowerCase() === sku.toLowerCase());
  return key ? CATALOG[key] : undefined;
}

/**
 * Turn whatever was decoded from the QR into a HairShade.
 * Returns null if the payload can't be interpreted as a color.
 */
export function parseQrPayload(raw: string): HairShade | null {
  const value = raw.trim();
  if (!value) return null;

  // Case 3: a URL with sku/color query params.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const sku = url.searchParams.get("sku");
      if (sku) {
        const fromSku = lookupSku(sku);
        if (fromSku) return fromSku;
      }
      const color = url.searchParams.get("color");
      if (color && HEX_RE.test(color)) {
        return { id: normalizeHex(color), name: "Selected shade", hex: normalizeHex(color) };
      }
    } catch {
      // fall through to the other strategies
    }
  }

  // Case 1: direct SKU match.
  const fromSku = lookupSku(value);
  if (fromSku) return fromSku;

  // Case 2: raw hex.
  if (HEX_RE.test(value)) {
    return { id: normalizeHex(value), name: "Selected shade", hex: normalizeHex(value) };
  }

  // Case 4: treat as a free-text shade name (no reliable swatch).
  return { id: value, name: value, hex: "#888888" };
}
