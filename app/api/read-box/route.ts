import { NextRequest } from "next/server";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const PROMPT = `You are analyzing a hair dye product box photo to extract professional hair color information.

Look for:
1. The shade code (format: number/number like "4/6", "7/43", etc.)
2. The shade name in English (e.g. "Red Chestnut", "Ash Blonde")
3. The visible color swatch or reference on the box
4. Color characteristics: undertone (warm/cool/neutral), depth, any special effects (glossy, matte, etc.)

Respond with ONLY a JSON object with NO markdown or extra text:
{
  "shadeCode": "4/6",
  "shadeName": "Red Chestnut",
  "nameFa": "شاه‌بلوطی قرمز",
  "hexColor": "#a8431f",
  "colorDescription": "warm medium brown with red undertones, glossy finish, suitable for adding richness and shine to brunette hair",
  "confidence": "high|medium|low"
}

"nameFa" is the shade name in Persian (Farsi) — this is what the user sees, so it must be natural Persian, not a transliteration.
"hexColor" MUST be a 6-digit hex colour in the form #rrggbb.
The colorDescription must stay in ENGLISH — it is fed to an image model — and be detailed enough for a
photorealistic hair color application (mention warmth, depth, shine, undertones).
If you cannot extract something with high confidence, use your best estimate and set confidence accordingly.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "کلید GEMINI_API_KEY تنظیم نشده است." }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "داده ارسالی باید از نوع multipart form باشد." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "هیچ تصویری ارسال نشد." }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return Response.json({ error: "تصویر باید JPEG، PNG یا WebP باشد." }, { status: 400 });
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType: image.type, data: base64 } },
        ],
      },
    ],
    // Ask for JSON directly rather than trusting the prompt's "no markdown",
    // and keep extraction deterministic.
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  };

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "ارتباط با سرویس برقرار نشد." }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error("Gemini error", upstream.status, text);
    return Response.json({ error: "سرویس درخواست را نپذیرفت." }, { status: 502 });
  }

  const data = await upstream.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: {
    shadeCode?: string;
    shadeName?: string;
    nameFa?: string;
    hexColor?: string;
    confidence?: string;
    colorDescription?: string;
  } = {};
  try {
    // Tolerate a ```json fence even with responseMimeType set — a fenced reply
    // used to fail the whole scan.
    parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    console.error("Failed to parse Gemini response:", text);
    return Response.json(
      { error: "اطلاعات رنگ از تصویر خوانده نشد. لطفاً عکس واضح‌تری از جعبه بگیرید." },
      { status: 422 },
    );
  }

  // The hex drives both the swatch and the on-device recolor maths, where a
  // malformed value would silently produce NaN pixels.
  const hexColor = /^#[0-9a-fA-F]{6}$/.test(parsed.hexColor ?? "")
    ? parsed.hexColor!
    : "#888888";
  const shadeName = parsed.shadeName?.trim() || "Unknown shade";
  const confidence = ["high", "medium", "low"].includes(parsed.confidence ?? "")
    ? parsed.confidence!
    : "low";

  const usage = data?.usageMetadata ?? {};
  return Response.json({
    shadeCode: parsed.shadeCode?.trim() || "?",
    shadeName,
    nameFa: parsed.nameFa?.trim() || undefined,
    hexColor,
    colorDescription: parsed.colorDescription?.trim() || `${shadeName} hair color`,
    confidence,
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    },
  });
}
