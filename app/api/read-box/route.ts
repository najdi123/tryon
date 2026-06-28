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
  "hexColor": "#a8431f",
  "colorDescription": "warm medium brown with red undertones, glossy finish, suitable for adding richness and shine to brunette hair",
  "confidence": "high|medium|low"
}

The colorDescription should be detailed enough for a photorealistic hair color application (mention warmth, depth, shine, undertones).
If you cannot extract something with high confidence, use your best estimate and set confidence accordingly.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const image = form.get("image");
  if (!(image instanceof File)) {
    return Response.json({ error: "No image file provided." }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
    return Response.json({ error: "Image must be JPEG, PNG, or WebP." }, { status: 400 });
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
  };

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "Could not reach Gemini." }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error("Gemini error", upstream.status, text);
    return Response.json({ error: "Gemini rejected the request." }, { status: 502 });
  }

  const data = await upstream.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  let parsed: { shadeCode?: string; shadeName?: string; hexColor?: string; confidence?: string,colorDescription?:string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Failed to parse Gemini response:", text);
    return Response.json(
      { error: "Could not parse color info from the image. Try a clearer box photo." },
      { status: 422 },
    );
  }

  const usage = data?.usageMetadata ?? {};
  return Response.json({
    shadeCode: parsed.shadeCode ?? "?",
    shadeName: parsed.shadeName ?? "Unknown",
    hexColor: parsed.hexColor ?? "#888888",
    colorDescription: parsed.colorDescription ?? `${parsed.shadeName} hair color`,
    confidence: parsed.confidence ?? "low",
    usage: {
      inputTokens: usage.promptTokenCount ?? 0,
      outputTokens: usage.candidatesTokenCount ?? 0,
    },
  });
}
