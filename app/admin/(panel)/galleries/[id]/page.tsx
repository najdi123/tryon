import { notFound } from "next/navigation";
import { GalleryForm } from "@/components/admin/Forms";
import { A } from "@/components/admin/copy";
import { Card, Empty, FilterBar, PageHead, Shell, Stat } from "@/components/admin/Shell";
import { renewQr } from "@/lib/admin/actions";
import { requireStaff } from "@/lib/admin/auth";
import { qrLink } from "@/lib/admin/qr";
import { db } from "@/lib/db";
import { addDays, faDayShort, parseFilters, type Filters } from "@/lib/reports/filters";
import { byDay, byLine, filterOptions, summary } from "@/lib/reports/queries";
import { faNum, faPercent, share } from "@/lib/reports/rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "جزئیات گالری | پنل آینه‌رنگ", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function GalleryDetail({ params, searchParams }: Props) {
  const user = await requireStaff();
  const { id } = await params;
  const gallery = await db.gallery.findUnique({ where: { id }, include: { tokens: { where: { active: true }, take: 1 } } });
  if (!gallery) notFound();
  const now = new Date();
  // This page is one gallery: its own id and its own sample flag replace those two filters.
  const f: Filters = { ...parseFilters(await searchParams, now), galleryId: id, province: null, sample: gallery.isSample };
  const [s, days, lines, options] = await Promise.all([summary(f, now), byDay(f, now), byLine(f, now), filterOptions(f)]);
  const token = gallery.tokens[0]?.token;
  const link = token ? await qrLink(token) : null;

  // Every day of the range, the empty ones too, up to 62 bars; longer ranges show their last 62 days.
  const span = Math.round((Date.parse(f.to) - Date.parse(f.from)) / 86_400_000) + 1;
  const first = span > 62 ? addDays(f.to, -61) : f.from;
  const byDate = new Map(days.map((d) => [d.day, d]));
  const series = Array.from({ length: Math.min(span, 62) }, (_, i) => {
    const day = addDays(first, i);
    return byDate.get(day) ?? { day, sessions: 0, qrEntries: 0, successes: 0 };
  });
  const peak = Math.max(1, ...series.map((d) => Math.max(d.qrEntries, d.successes)));

  return (
    <Shell user={user} current="galleries">
      <PageHead title={gallery.name} filters={f} now={now}>
        <span dir="ltr" className="rounded-full bg-[var(--gold-soft)] px-3 py-2 text-sm font-bold">{gallery.publicId}</span>
        <span className="rounded-full bg-[var(--gold-soft)] px-3 py-2 text-sm">{gallery.province}، {gallery.city}</span>
        <span className="rounded-full bg-[var(--gold-soft)] px-3 py-2 text-sm">{gallery.status === "ACTIVE" ? A.active : A.inactive}</span>
        {gallery.isSample && <span className="rounded-full bg-[var(--plum)] px-3 py-2 text-sm text-white">{A.sampleGallery}</span>}
      </PageHead>
      <FilterBar action={`/admin/galleries/${id}`} f={f} options={options} scoped />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={A.m.qrEntries} value={faNum(s.qrEntries)} unit={A.m.qrEntriesUnit} />
        <Stat label={A.m.sessions} value={faNum(s.sessions)} />
        <Stat label={A.m.successes} value={faNum(s.successes)} unit={A.m.successesUnit} />
        <Stat label={A.m.completion} value={faPercent(share(s.completedSessions, s.sessions))} unit={A.m.completionHelp} />
      </div>

      <Card title={A.trendTitle}>
        {s.sessions === 0 ? <Empty /> : (
          <div className="px-4 pb-4">
            <div className="a-scroll">
              <div className="flex h-44 items-end gap-1" style={{ minWidth: `${series.length * 14}px` }}>
                {series.map((d) => (
                  <div key={d.day} className="flex h-full flex-1 items-end justify-center gap-px" title={`${faDayShort(d.day)}: ${A.m.qrEntries} ${faNum(d.qrEntries)}، ${A.m.successes} ${faNum(d.successes)}`}>
                    <span className="w-1/2 rounded-t bg-[var(--gold-fill)]" style={{ height: `${(d.qrEntries / peak) * 100}%` }} />
                    <span className="w-1/2 rounded-t bg-[var(--plum-2)]" style={{ height: `${(d.successes / peak) * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--a-ink-2)]">
              <span className="num">{faDayShort(series[0].day)} تا {faDayShort(series[series.length - 1].day)}</span>
              <span className="flex gap-4">
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[var(--gold-fill)]" />{A.m.qrEntries}</span>
                <span className="flex items-center gap-1.5"><span className="size-3 rounded-sm bg-[var(--plum-2)]" />{A.m.successes}</span>
              </span>
            </div>
          </div>
        )}
      </Card>

      <div className="grid gap-x-5 xl:grid-cols-2">
        <Card title={A.lineShareTitle}>
          {lines.length === 0 ? <Empty /> : (
            <table className="a-table">
              <thead><tr><th>{A.line}</th><th>{A.m.successes}</th><th>{A.share}</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.lineKey}><td>{l.lineFa}</td><td className="n">{faNum(l.successes)}</td><td className="n">{faPercent(share(l.successes, s.successes))}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title={A.qrTitle}>
          <div className="flex flex-wrap items-start gap-4 px-4 pb-5">
            {link ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- a staff-only SVG made on request; not an optimizable asset */}
                <img src={`/admin/galleries/${id}/qr?inline=1`} alt={A.qrTitle} width={168} height={168} className="rounded-lg border border-[var(--a-line)] bg-white" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-sm text-[var(--a-ink-2)]">{A.qrHelp}</p>
                  <p dir="ltr" className="break-all rounded-lg bg-[var(--cream)] px-3 py-2 text-xs">{link}</p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/admin/galleries/${id}/qr?format=svg`} className="a-btn a-btn-plum">{A.qrSvg}</a>
                    <a href={`/admin/galleries/${id}/qr?format=png`} className="a-btn a-btn-line">{A.qrPng}</a>
                  </div>
                </div>
              </>
            ) : <p className="text-sm text-[var(--a-ink-2)]">{A.qrNone}</p>}
            {user.role === "ADMIN" && (
              <form action={renewQr} className="w-full border-t border-[var(--a-line)] pt-3">
                <input type="hidden" name="galleryId" value={id} />
                <p className="mb-2 text-sm text-[var(--a-ink-2)]">{A.qrNewHelp}</p>
                <button type="submit" className="a-btn a-btn-line">{A.qrNew}</button>
              </form>
            )}
          </div>
        </Card>
      </div>

      {user.role === "ADMIN" && (
        <Card title={A.editGallery}>
          <div className="px-4 pb-5">
            <GalleryForm gallery={{ id, publicId: gallery.publicId, name: gallery.name, province: gallery.province, city: gallery.city, status: gallery.status }} />
          </div>
        </Card>
      )}
    </Shell>
  );
}
