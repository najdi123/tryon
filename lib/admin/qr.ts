import { headers } from "next/headers";

// The address a gallery's QR opens. A printed QR cannot be corrected, so in production the
// address must be set (PUBLIC_BASE_URL) and is never taken from the request: a panel opened on a
// test address or through a tunnel would otherwise print that address. Without the setting no QR
// is made (null). In development the request's own address is used.
export async function qrLink(token: string): Promise<string | null> {
  const fixed = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (fixed) return `${fixed}/q/${token}`;
  if (process.env.NODE_ENV === "production") return null;
  const h = await headers();
  const host = h.get("host") ?? "localhost";
  return `http://${host}/q/${token}`;
}
