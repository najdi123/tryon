import { NextRequest } from "next/server";

// Gemini image-editing model ("Nano Banana"). It returns an edited image inline.
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function buildPrompt(shadeName: string, hex: string, description?: string): string {
  const colorDetail = description || `a rich, dimensional ${shadeName.toLowerCase()} with natural shine`;
  return [
    // Identity lock
    "Photorealistic portrait edit of the exact same person with identical face and facial features.",
    "Preserve the subject's identity, expression, pose, skin texture, makeup, and outfit completely.",
    "",
    // Hairstyle lock (critical to prevent AI redesign)
    "Change ONLY the hair color. Keep the exact same hairstyle, hair length, cut, texture, volume, part, and styling unchanged.",
    "Maintain original hair flow, strand pattern, wave pattern (or straightness), curl structure, and silhouette.",
    "Do not alter hair thickness, density, or any structural elements.",
    "",
    // Color instruction with detail
    `Recolor the hair to ${colorDetail} (hex ${hex}).`,
    "Apply the color with realistic dimensional tones, natural darker roots, subtle highlights,",
    "and a glossy healthy shine that matches the original hair's luster.",
    "Account for how the dye would actually look over the person's current hair color and texture.",
    "",
    // Preserve everything else
    "Preserve background, lighting, camera angle, and all other elements exactly.",
    "",
    // Quality/realism boosters
    "Ultra-photorealistic, sharp strand detail, natural scalp shadow, salon-quality finish.",
    "Do NOT change face, hairstyle, hair length, texture, volume, expression, or pose under any circumstances.",
  ].join(" ");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing GEMINI_API_KEY. Add it to .env.local." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data." }, { status: 400 });
  }

  const image = form.get("image");
  const shadeName = String(form.get("shadeName") ?? "").trim();
  const hex = String(form.get("hex") ?? "").trim();
  const description = String(form.get("description") ?? "").trim() || undefined;

  if (!(image instanceof File)) {
    return Response.json({ error: "No image file provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(image.type)) {
    return Response.json({ error: "Image must be JPEG, PNG or WebP." }, { status: 400 });
  }
  if (image.size > MAX_BYTES) {
    return Response.json({ error: "Image is larger than 8 MB." }, { status: 400 });
  }
  if (!shadeName || !hex) {
    return Response.json({ error: "Missing target color." }, { status: 400 });
  }

  const base64 = Buffer.from(await image.arrayBuffer()).toString("base64");

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildPrompt(shadeName, hex, description) },
          { inlineData: { mimeType: image.type, data: base64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE"] },
  };

  let upstream: Response;
  try {
    upstream = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch {
    return Response.json({ error: "Could not reach the image service." }, { status: 502 });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error("Gemini error", upstream.status, text);
    return Response.json(
      { error: "The image service rejected the request.", status: upstream.status },
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
      { error: "No image was generated. Try a clearer, front-facing photo." },
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
