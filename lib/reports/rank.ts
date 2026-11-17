// Small pure helpers the tables share.

// Competition ranking: equal values share a rank and the next rank skips (1, 1, 3).
export function rankWithTies<T>(rows: T[], value: (r: T) => number): Array<T & { rank: number }> {
  const sorted = [...rows].sort((a, b) => value(b) - value(a));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || value(r) !== value(sorted[i - 1])) rank = i + 1;
    return { ...r, rank };
  });
}

// A part of a whole as a percentage with one decimal; null when the whole is zero (shown as a dash).
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

const FA = "۰۱۲۳۴۵۶۷۸۹";
const digits = (s: string) => s.replace(/\d/g, (d) => FA[Number(d)]);

export const faNum = (n: number) => digits(n.toLocaleString("en-US")).replace(/,/g, "٬");
export const faPercent = (p: number | null) => (p === null ? "—" : `${digits(p.toFixed(1)).replace(".", "٫")}٪`);
export const faDigits = digits;

// Search text made comparable: Persian and Arabic digits to Latin, the two forms of ی and ک made
// one, the half-space dropped, lower case. The screen and the file use the same folding.
export function foldSearch(v: string): string {
  return v
    .replace(/[۰-۹]/g, (d) => String(FA.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, "")
    .trim().toLowerCase();
}
