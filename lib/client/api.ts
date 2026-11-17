// Browser-side calls to the app's own server.
import type { CatalogLine } from "@/app/api/catalog/route";

export type { CatalogLine, CatalogShade } from "@/app/api/catalog/route";
export type GalleryInfo = { name: string; city: string } | null;

let sessionReady: Promise<GalleryInfo> | null = null;

// Opens (or keeps alive) the visit's session. Every event waits for this once.
export function ensureSession(): Promise<GalleryInfo> {
  sessionReady ??= fetch("/api/session", { cache: "no-store" })
    .then((r) => r.json() as Promise<{ gallery: GalleryInfo }>)
    .then((d) => d.gallery)
    .catch(() => {
      sessionReady = null;
      return null;
    });
  return sessionReady;
}

type EventType = "BRAND_SELECTED" | "PHOTO_READY" | "SHADE_SELECTED" | "TRYON_STARTED" | "TRYON_SUCCEEDED" | "TRYON_FAILED" | "RESULT_DOWNLOADED";

// Reports what happened. Never throws: statistics must not get in the customer's way.
// It carries no photo and nothing personal.
export function track(type: EventType, about: { lineKey?: string; shadeCode?: string; status?: string } = {}): void {
  const body = JSON.stringify({ eventId: crypto.randomUUID(), type, ...about });
  const send = () => fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  void ensureSession()
    .then(send)
    .then((r) => {
      if (r.status !== 409) return;
      sessionReady = null; // the browser id was lost: open the session again and resend once
      return ensureSession().then(send);
    })
    .catch(() => undefined);
}

export async function loadCatalog(): Promise<CatalogLine[]> {
  const r = await fetch("/api/catalog");
  if (!r.ok) throw new Error("catalog");
  return ((await r.json()) as { lines: CatalogLine[] }).lines;
}

export type TryOnFailure =
  | "offline" | "daily_limit" | "not_configured" | "no_image" | "image_too_large" | "bad_image" | "failed";

// One preview from the image service. The caller has the customer's consent before calling this.
export async function tryOnAi(photo: Blob, lineKey: string, shadeCode: string): Promise<{ ok: true; image: string } | { ok: false; reason: TryOnFailure }> {
  await ensureSession();
  const form = new FormData();
  form.set("image", photo, "photo.jpg");
  form.set("lineKey", lineKey);
  form.set("shadeCode", shadeCode);
  form.set("consent", "yes");
  let r: Response;
  try {
    r = await fetch("/api/tryon", { method: "POST", body: form });
  } catch {
    return { ok: false, reason: "offline" };
  }
  const data = (await r.json().catch(() => ({}))) as { image?: string; error?: string };
  if (r.ok && data.image) return { ok: true, image: data.image };
  const known: TryOnFailure[] = ["daily_limit", "not_configured", "no_image", "image_too_large", "bad_image"];
  return { ok: false, reason: known.find((k) => k === data.error) ?? "failed" };
}
