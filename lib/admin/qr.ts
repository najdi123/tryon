import { headers } from "next/headers";

// The address a gallery's QR opens. PUBLIC_BASE_URL fixes it; otherwise it is the address the
// panel itself was opened on, as the proxy reports it.
export async function qrLink(token: string): Promise<string> {
  const fixed = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
  if (fixed) return `${fixed}/q/${token}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}/q/${token}`;
}
