import { NextRequest } from "next/server";

// Gemini image-editing model ("Nano Banana"). It returns an edited image inline.
const MODEL = "gemini-2.5-flash-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB upload cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function buildPrompt(shadeName: string, hex: string, description?: string): string {
  const detail = description ? ` The target shade is described as: ${description}.` : "";
  return [
    `Edit this photo so the person's hair is dyed the hair color "${shadeName}" (approx hex ${hex}).${detail}`,
    "Change ONLY the hair color. Keep the exact same face, identity, skin tone, facial features,",
    "expression, pose, hairstyle, hair length, background and lighting completely unchanged.",
    "Apply the color realistically: follow the natural flow of the hair with believable highlights,",
    "shadows and shine, and account for how dye would look over the person's current natural hair color.",
    "The result must look like a natural, photorealistic photograph, not a cartoon or a flat color fill.",
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
  return Response.json({ image: `data:${mime};base64,${imgPart.inlineData.data}` });
}
