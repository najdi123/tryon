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
  try {
    const body = JSON.stringify({ eventId: newId(), type, ...about });
    const send = () => fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
    // The event id makes a resend safe: the server stores the same id once.
    const attempt = (left: number): Promise<void> =>
      ensureSession()
        .then(send)
        .then((r) => {
          if (r.status === 409) {
            sessionReady = null; // the browser id was lost: open the session again and resend
            if (left > 0) return attempt(left - 1);
          } else if (r.status >= 500 && left > 0) {
            return new Promise<void>((res) => setTimeout(res, 2000)).then(() => attempt(left - 1));
          }
        })
        .catch(() => (left > 0 ? new Promise<void>((res) => setTimeout(res, 2000)).then(() => attempt(left - 1)) : undefined));
    void attempt(2);
  } catch {
    // Nothing here may stop the customer.
  }
}

// crypto.randomUUID is missing on older phones and on plain http.
export function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

export type Catalog = { lines: CatalogLine[]; aiAvailable: boolean };

export async function loadCatalog(): Promise<Catalog> {
  const r = await fetch("/api/catalog");
  if (!r.ok) throw new Error("catalog");
  return (await r.json()) as Catalog;
}

export type TryOnFailure =
  | "offline" | "daily_limit" | "busy" | "not_configured" | "no_image" | "image_too_large" | "bad_image" | "failed";

// One preview from the image service. The caller has the customer's consent before calling this.
export async function tryOnAi(photo: Blob, lineKey: string, shadeCode: string): Promise<{ ok: true; image: string } | { ok: false; reason: TryOnFailure }> {
  await ensureSession();
  const form = new FormData();
  form.set("image", photo, "photo.jpg");
  form.set("lineKey", lineKey);
  form.set("shadeCode", shadeCode);
  form.set("consent", "yes");
  form.set("attemptId", newId()); // one id per press: a resend can never count twice
  let r: Response;
  try {
    r = await fetch("/api/tryon", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    return { ok: false, reason: e instanceof DOMException && e.name === "TimeoutError" ? "failed" : "offline" };
  }
  const data = (await r.json().catch(() => ({}))) as { image?: string; error?: string };
  if (r.ok && data.image) return { ok: true, image: data.image };
  const known: TryOnFailure[] = ["daily_limit", "busy", "not_configured", "no_image", "image_too_large", "bad_image"];
  return { ok: false, reason: known.find((k) => k === data.error) ?? "failed" };
}
