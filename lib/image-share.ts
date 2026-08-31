// Browser-only helpers for getting a result image out of the app.

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = /:(.*?);/.exec(header)?.[1] ?? "image/jpeg";
  if (!header.includes("base64")) {
    return new Blob([decodeURIComponent(body)], { type: mime });
  }
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Safe, readable filename for a shade code like "10/01". */
export function imageFileName(shadeCode: string): string {
  const slug = shadeCode.replace(/[^0-9a-zA-Z]+/g, "-").replace(/^-|-$/g, "");
  return `hair-color-${slug || "result"}.jpg`;
}

export function saveImage(dataUrl: string, filename: string): void {
  const blob = dataUrlToBlob(dataUrl);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — Safari needs the URL alive through the click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ShareOutcome = "shared" | "cancelled" | "unsupported";

/**
 * Native share sheet when the browser supports sharing files (iOS Safari,
 * Android Chrome, over HTTPS). Callers fall back to saveImage otherwise.
 */
export async function shareImage(
  dataUrl: string,
  filename: string,
  text: string,
): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) {
    return "unsupported";
  }
  const file = new File([dataUrlToBlob(dataUrl)], filename, { type: "image/jpeg" });
  if (!navigator.canShare({ files: [file] })) return "unsupported";
  try {
    await navigator.share({ files: [file], text });
    return "shared";
  } catch (err) {
    // The user dismissing the sheet rejects with AbortError — not a failure.
    if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    return "unsupported";
  }
}
