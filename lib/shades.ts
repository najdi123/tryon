// Shade catalog shown on the picker step.
//
// `colorDescription` is fed verbatim into the Gemini prompt, so it stays in
// English; `nameFa` is what the UI renders.
//
// `path` decides how the recolor runs: dark targets can be done on-device with
// the MediaPipe segmenter, light ones need Gemini to simulate bleaching.
//
// NOTE: `brand` is a PLACEHOLDER split (dark → Bianca, light → Oyster) so the
// brand filter on the landing page has something to filter. Replace it with the
// real per-shade brand once the two catalogs are supplied.

export type ShadePath = "local" | "ai";
export type Brand = "bianca" | "oyster";

export type ShadeInfo = {
  shadeCode: string;
  shadeName: string;
  /** Persian display name. Absent for shades read off a box by Gemini. */
  nameFa?: string;
  hexColor: string;
  /** English, prompt-facing. */
  colorDescription: string;
  confidence: "high" | "medium" | "low";
};

export type PresetShade = ShadeInfo & { path: ShadePath; brand: Brand };

export const BRAND_LABEL: Record<Brand, string> = {
  bianca: "بیانکا",
  oyster: "اویستر",
};

export const PRESET_SHADES: PresetShade[] = [
  // Dark shades → local canvas recolor
  { shadeCode: "1/0",  shadeName: "Natural Black",       nameFa: "مشکی طبیعی",                hexColor: "#0D0905", colorDescription: "pure natural black, cool neutral undertones",                  confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "2/0",  shadeName: "Darkest Brown",       nameFa: "قهوه‌ای خیلی تیره",          hexColor: "#1A0E08", colorDescription: "near-black darkest brown, neutral cool undertones",            confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "3/0",  shadeName: "Dark Brown",          nameFa: "قهوه‌ای تیره",               hexColor: "#2C1A0E", colorDescription: "deep dark brown, cool undertones",                             confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "3/3",  shadeName: "Dark Golden Brown",   nameFa: "قهوه‌ای تیره طلایی",         hexColor: "#4A2A10", colorDescription: "dark brown with warm golden reflect",                          confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "3/66", shadeName: "Dark Intense Red",    nameFa: "قرمز پرقدرت تیره",           hexColor: "#6B1510", colorDescription: "dark brown with very intense red-violet reflect",              confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "4/0",  shadeName: "Medium Brown",        nameFa: "قهوه‌ای متوسط",              hexColor: "#5C3520", colorDescription: "neutral medium brown, natural finish",                         confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "4/4",  shadeName: "Medium Copper",       nameFa: "مسی متوسط",                  hexColor: "#8B4015", colorDescription: "medium brown with warm copper-orange reflect, vibrant",        confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "4/6",  shadeName: "Red Chestnut",        nameFa: "شاه‌بلوطی قرمز",             hexColor: "#8B3520", colorDescription: "warm medium brown with intense red undertones, glossy finish", confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "5/0",  shadeName: "Light Brown",         nameFa: "قهوه‌ای روشن",               hexColor: "#7A5030", colorDescription: "natural light brown, balanced warm-neutral tone",              confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "5/3",  shadeName: "Light Golden Brown",  nameFa: "قهوه‌ای روشن طلایی",         hexColor: "#8B6535", colorDescription: "light brown with warm golden and caramel tones",               confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "5/5",  shadeName: "Light Mahogany",      nameFa: "ماهاگونی روشن",              hexColor: "#7B3F30", colorDescription: "warm light brown with mahogany-red reflect",                   confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "6/0",  shadeName: "Dark Blonde",         nameFa: "بلوند تیره",                 hexColor: "#9A7540", colorDescription: "dark blonde, natural warm tone, subtle golden reflect",        confidence: "high", path: "local", brand: "bianca" },
  { shadeCode: "6/1",  shadeName: "Dark Ash Blonde",     nameFa: "بلوند تیره خاکستری",         hexColor: "#7A6A55", colorDescription: "dark blonde with cool ash undertones, matte finish",           confidence: "high", path: "local", brand: "bianca" },
  // Light shades → Gemini AI recolor
  { shadeCode: "7/0",  shadeName: "Medium Blonde",       nameFa: "بلوند متوسط",                hexColor: "#C8A040", colorDescription: "medium natural blonde, warm balanced tone",                    confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "7/1",  shadeName: "Medium Ash Blonde",   nameFa: "بلوند متوسط خاکستری",        hexColor: "#B8A870", colorDescription: "medium blonde with cool ash undertones, pearl effect",         confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "7/3",  shadeName: "Medium Gold Blonde",  nameFa: "بلوند متوسط طلایی",          hexColor: "#BF9040", colorDescription: "medium warm blonde with golden honey tones",                   confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "7/44", shadeName: "Medium Copper Blonde",nameFa: "بلوند متوسط مسی",            hexColor: "#C86830", colorDescription: "medium blonde with intense warm copper-orange reflect",        confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "8/0",  shadeName: "Light Blonde",        nameFa: "بلوند روشن",                 hexColor: "#D4B060", colorDescription: "light natural blonde, warm luminous tone",                     confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "8/1",  shadeName: "Light Ash Blonde",    nameFa: "بلوند روشن خاکستری",         hexColor: "#D0C085", colorDescription: "light blonde with cool ash undertones, sophisticated finish",  confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "8/3",  shadeName: "Light Gold Blonde",   nameFa: "بلوند روشن طلایی",           hexColor: "#D4A855", colorDescription: "light warm blonde with golden highlights, sun-kissed",         confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "9/1",  shadeName: "Very Light Ash",      nameFa: "بلوند خیلی روشن خاکستری",    hexColor: "#DDD0A0", colorDescription: "very light cool blonde, ash undertones, pearl finish",         confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "9/3",  shadeName: "Very Light Golden",   nameFa: "بلوند خیلی روشن طلایی",      hexColor: "#E2C87A", colorDescription: "very light warm blonde with golden shimmer",                   confidence: "high", path: "ai", brand: "oyster" },
  { shadeCode: "10/01",shadeName: "Platinum Blonde",     nameFa: "بلوند پلاتینی",              hexColor: "#EFE5CA", colorDescription: "lightest platinum blonde, icy cool tone, high-shine finish",   confidence: "high", path: "ai", brand: "oyster" },
];

/** What the UI should call a shade — Persian name when we have one. */
export function shadeLabel(shade: ShadeInfo): string {
  return shade.nameFa ?? shade.shadeName;
}
