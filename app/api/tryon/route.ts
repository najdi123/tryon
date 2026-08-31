import { NextRequest } from "next/server";

// Gemini image-editing model ("Nano Banana"). It returns an edited image inline.
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Only these reach the prompt — hairType arrives as client form data and is
// interpolated into the instruction, so it is matched against a known set
// rather than passed through.
const HAIR_TYPES = new Set(["straight", "wavy", "curly", "coily"]);

function buildPrompt(
  shadeName: string,
  hex: string,
  description?: string,
  hairType?: string,
  includeEyebrows?: boolean,
): string {
  const colorName = description ? `${shadeName} (${description})` : shadeName;
  const hairTypeClause = hairType
    ? `The person's hair is naturally ${hairType} — preserve this exact ${hairType} texture and pattern completely.`
    : "";
  // Eyebrows are deliberately explicit in BOTH directions. Left unstated, the
  // model decides for itself and the result varies between runs.
  const eyebrowClause = includeEyebrows
    ? [
        "Also recolor the eyebrows to match the new hair colour, in the same tone and depth,",
        "keeping their exact original shape, thickness, arch, and every individual brow hair in place.",
        "The eyebrows must still read as natural brows, not as painted or drawn-on shapes.",
      ].join(" ")
    : "Leave the eyebrows completely untouched — keep their original colour exactly as it is in the photograph.";

  return [
    `Using the provided photograph, recolor the hair to ${colorName}, approximately hex ${hex}.`,
    "Recolor the existing hair strands in place, keeping the same hairstyle, haircut, length,",
    "outline and silhouette, parting, texture, curl and wave pattern, volume, and the position of",
    "every individual strand exactly as they are in the original photograph.",
    hairTypeClause,
    eyebrowClause,
    // Must carve out the eyebrows when they are being recoloured, or this
    // sentence contradicts the instruction directly above it.
    includeEyebrows
      ? "Apart from the eyebrow colour, keep the face, facial features, expression, skin tone, pose, clothing, background, and lighting identical."
      : "Keep the face, facial features, expression, skin tone, pose, clothing, background, and lighting identical.",
    "Preserve the natural shading of the hair: keep the original highlights, shadows, shine and depth,",
    "recoloured into the new shade rather than flattened into one solid colour.",
    "The result must look like an ordinary unedited photograph of this person with this hair colour.",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "کلید GEMINI_API_KEY روی سرور تنظیم نشده است." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "داده ارسالی باید از نوع multipart form باشد." }, { status: 400 });
  }

  const image = form.get("image");
  const shadeName = String(form.get("shadeName") ?? "").trim();
  const hex = String(form.get("hex") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || undefined;
  const rawHairType = String(form.get("hairType") ?? "").trim().toLowerCase();
  const hairType = HAIR_TYPES.has(rawHairType) ? rawHairType : undefined;
  const includeEyebrows = String(form.get("eyebrows") ?? "") === "true";

  if (!(image instanceof File)) {
    return Response.json({ error: "هیچ تصویری ارسال نشد." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return Response.json({ error: "تصویر باید JPEG، PNG یا WebP باشد." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return Response.json({ error: "حجم تصویر بیشتر از ۸ مگابایت است." }, { status: 400 });
  }
  if (!shadeName || !hex) {
    return Response.json({ error: "رنگ مقصد مشخص نشده است." }, { status: 400 });
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(shadeName, hex, description, hairType, includeEyebrows) },
          { inlineData: { mimeType: image.type, data: base64 } },
        ],
      },
    ],
    // temperature 0 => most faithful to the input image (less creative re-rendering).
    generationConfig: { responseModalities: ["IMAGE"], temperature: 0 },
  };

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "ارتباط با سرویس تصویر برقرار نشد." }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error("Gemini error", upstream.status, text);
    return Response.json(
      { error: "سرویس تصویر درخواست را نپذیرفت.", status: upstream.status },
      { status: 502 },
    );
  }

  const data = await upstream.json();
  const parts: Array<{ inlineData?: { mimeType?: string; data?: string } }> =
    data?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data);

  if (!imgPart?.inlineData?.data) {
    // Common cause: the model refused or returned only text (e.g. safety block).
    console.error("No image in Gemini response", JSON.stringify(data).slice(0, 500));
    return Response.json(
      { error: "تصویری ساخته نشد. لطفاً عکس واضح‌تر و روبه‌رو بگیرید." },
      { status: 422 },
    );
  }

  const mime = imgPart.inlineData.mimeType ?? "image/png";
  const usage = data?.usageMetadata ?? {};
  return Response.json({
    image: `data:${mime};base64,${imgPart.inlineData.data}`,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    },
  });
}
