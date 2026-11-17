import type { HairEngine, RecolorRequest, RecolorResult } from "./types";

// The image model. Chosen on the 17 November 2026 tests (PLAN.md): of three models it landed
// closest to the colour it was sent, repeated itself, and was the fastest and cheapest.
const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-lite-image";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function prompt(shade: RecolorRequest["shade"]): string {
  const colour = shade.description ? `${shade.nameEn} (${shade.description})` : shade.nameEn;
  return [
    `Using the provided photograph, recolor the hair to ${colour}, approximately hex ${shade.hex}.`,
    "Apply one uniform colour from roots to ends. Recolor the existing hair strands in place, keeping the same",
    "hairstyle, haircut, length, outline and silhouette, parting, texture, curl and wave pattern, volume, and the",
    "position of every individual strand exactly as they are in the original photograph.",
    "Leave the eyebrows completely untouched: keep their original colour exactly as it is in the photograph.",
    "Keep the face, facial features, expression, skin tone, pose, clothing, background, and lighting identical.",
    "Preserve the natural shading of the hair: keep the original highlights, shadows, shine and depth,",
    "recoloured into the new shade rather than flattened into one solid colour.",
    "The result must look like an ordinary unedited photograph of this person with this hair colour.",
  ].join(" ");
}

type Part = { inlineData?: { mimeType?: string; data?: string } };

export const geminiEngine: HairEngine = {
  name: `gemini:${MODEL}`,
  available: () => Boolean(process.env.GEMINI_API_KEY),
  async recolor(req: RecolorRequest): Promise<RecolorResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { ok: false, reason: "not_configured" };
    let upstream: Response;
    try {
      upstream = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt(req.shade) }, { inlineData: { mimeType: req.image.mimeType, data: req.image.base64 } }] }],
          // temperature 0: the most faithful to the photo.
          generationConfig: { responseModalities: ["IMAGE"], temperature: 0 },
        }),
        signal: req.signal,
      });
    } catch {
      return { ok: false, reason: "unreachable" };
    }
    if (!upstream.ok) {
      // The status alone tells quota (429), a bad key (400/403) and an outage apart. No body is logged.
      console.error(`[engine] gemini answered ${upstream.status}`);
      return { ok: false, reason: "rejected" };
    }
    let data: { candidates?: Array<{ content?: { parts?: Part[] } }> };
    try {
      data = (await upstream.json()) as typeof data;
    } catch {
      return { ok: false, reason: "unreachable" }; // cut off mid-answer
    }
    const part = (data.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) return { ok: false, reason: "no_image" }; // refused, or text only
    return { ok: true, imageDataUrl: `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}` };
  },
};
