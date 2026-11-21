// The picture engine sits behind this interface so it can be swapped without touching the app.
// An engine changes the hair colour only: never the face, the skin or the background. The one
// exception is `retouch`, a test switch in the panel.

export type RecolorRequest = {
  image: { mimeType: string; base64: string };
  shade: { nameEn: string; hex: string; description: string | null };
  retouch?: boolean; // test: a light beauty retouch of the face as well
  signal: AbortSignal; // the customer left, or the time limit passed
};

export type RecolorResult =
  | { ok: true; imageDataUrl: string }
  | { ok: false; reason: "not_configured" | "unreachable" | "rejected" | "no_image" };

export interface HairEngine {
  readonly name: string;
  available(): boolean; // false: no real engine is connected, and the app says so
  recolor(req: RecolorRequest): Promise<RecolorResult>;
}
