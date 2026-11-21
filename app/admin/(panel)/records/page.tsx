import Link from "next/link";
import { A } from "@/components/admin/copy";
import { Card, PageHead, Shell } from "@/components/admin/Shell";
import { requireAdmin } from "@/lib/admin/auth";
import { recordDays, recordingOn, recordsOfDay } from "@/lib/records";

export const dynamic = "force-dynamic";
export const metadata = { title: "عکس‌های آزمایشی | پنل آینه‌رنگ", robots: { index: false } };

const MAX_PHOTOS = 60; // a page of large pictures

// Development only: the before and after pictures kept for review (lib/records.ts). Admins only.
export default async function Records({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const user = await requireAdmin();
  const days = await recordDays();
  const asked = (await searchParams).day;
  const day = days.find((d) => d === asked) ?? days[0] ?? null;
  const photos = day ? (await recordsOfDay(day)).slice(0, MAX_PHOTOS) : [];
  const src = (photoId: string, name: string) => `/admin/records/file?day=${day}&photo=${photoId}&name=${encodeURIComponent(name)}`;

  return (
    <Shell user={user} current="records">
      <PageHead title={A.recordsTitle} />
      <p className="mb-3 text-sm text-[var(--a-ink-2)]">{recordingOn() ? A.recordingOn : A.recordingOff}</p>
      {days.length === 0 ? <p className="text-sm text-[var(--a-ink-3)]">{A.recordsNone}</p> : (
        <>
          <nav className="mb-4 flex flex-wrap gap-2">
            {days.slice(0, 30).map((d) => (
              <Link key={d} href={`/admin/records?day=${d}`} dir="ltr" className={`a-btn ${d === day ? "a-btn-gold" : "a-btn-line"} n`}>{d}</Link>
            ))}
          </nav>
          <p className="mb-3 text-xs text-[var(--a-ink-3)]">{A.recordsHelp}</p>
          {photos.length === 0 && <p className="text-sm text-[var(--a-ink-3)]">{A.recordsEmpty}</p>}
          {photos.map((p) => (
            <Card key={p.photoId} title={`${p.photoId} · ${p.afters.length}`}>
              <div className="flex gap-3 overflow-x-auto px-4 pb-4">
                <figure className="w-56 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a staff-only file route, not a public asset */}
                  <img src={src(p.photoId, "before.jpg")} alt={A.recordsBefore} loading="lazy" className="w-full rounded-lg" />
                  <figcaption className="mt-1 text-sm font-bold">{A.recordsBefore}</figcaption>
                </figure>
                {p.afters.map((a) => (
                  <figure key={a.name} className="w-56 shrink-0">
                    <a href={src(p.photoId, a.name)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a staff-only file route, not a public asset */}
                      <img src={src(p.photoId, a.name)} alt={`${a.lineKey} ${a.code}`} loading="lazy" className="w-full rounded-lg" />
                    </a>
                    <figcaption className="mt-1 text-xs leading-5 text-[var(--a-ink-2)]">
                      <span dir="ltr" className="n block font-bold text-[var(--a-ink)]">{a.lineKey} · {a.code} · {a.time}</span>
                      {A.recordEngine[a.engine] ?? a.engine} · {A.recordOutcome[a.outcome] ?? a.outcome}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}
    </Shell>
  );
}
