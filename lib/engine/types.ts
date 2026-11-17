// The picture engine sits behind this interface so it can be swapped without touching the app.
// An engine changes the hair colour only: never the face, the skin or the background.

export type RecolorRequest = {
  image: { mimeType: string; base64: string };
  shade: { nameEn: string; hex: string; description: string | null };
};

export type RecolorResult =
  | { ok: true; imageDataUrl: string }
  | { ok: false; reason: "not_configured" | "unreachable" | "rejected" | "no_image" };

export interface HairEngine {
  readonly name: string;
  recolor(req: RecolorRequest): Promise<RecolorResult>;
}
