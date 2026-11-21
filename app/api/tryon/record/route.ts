import { NextResponse, type NextRequest } from "next/server";
import { hasVisitor } from "@/lib/analytics/http";
import { isBotUserAgent } from "@/lib/analytics/rules";
import { recordingOn, saveRecord, validMeta, type RecordMeta } from "@/lib/records";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

// Development only (RECORD_TRYONS=1): the phone sends the before and after pictures of a try-on
// for the team to review. See lib/records.ts for what this means for the customer's privacy.
export async function POST(req: NextRequest) {
  if (!recordingOn()) return new NextResponse(null, { status: 404 });
  if (isBotUserAgent(req.headers.get("user-agent")) || !hasVisitor(req)) return new NextResponse(null, { status: 204 });
  if (Number(req.headers.get("content-length") ?? 0) > 2 * MAX_BYTES + 100 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const meta = {
    photoId: String(form.get("photoId") ?? ""),
    lineKey: String(form.get("lineKey") ?? ""),
    shadeCode: String(form.get("shadeCode") ?? ""),
    engine: String(form.get("engine") ?? ""),
    outcome: String(form.get("outcome") ?? ""),
  } as RecordMeta;
  const after = form.get("after");
  const before = form.get("before");
  const jpeg = (f: FormDataEntryValue | null): f is File => f instanceof File && f.type === "image/jpeg" && f.size > 0 && f.size <= MAX_BYTES;
  if (!validMeta(meta) || !jpeg(after) || (before !== null && !jpeg(before))) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  try {
    const result = await saveRecord(
      meta,
      Buffer.from(await after.arrayBuffer()),
      before ? Buffer.from(await before.arrayBuffer()) : null,
      new Date(),
    );
    return NextResponse.json({ result }, { status: result === "need_before" ? 409 : 200 });
  } catch (e) {
    console.error(`[record] ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
