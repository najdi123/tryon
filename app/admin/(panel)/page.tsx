import Link from "next/link";
import { A } from "@/components/admin/copy";
import { Card, Empty, ExcelLink, FilterBar, PageHead, Shell, Stat, provinceLabel } from "@/components/admin/Shell";
import { requireStaff } from "@/lib/admin/auth";
import { UNKNOWN, filtersQuery } from "@/lib/reports/filters";
import { byGallery, byProvince, byShade, loadFilters, summary } from "@/lib/reports/queries";
import { faNum, faPercent, rankWithTies, share } from "@/lib/reports/rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "نمای کلی | پنل آینه‌رنگ", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Overview({ searchParams }: Props) {
  const user = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const { f, options } = await loadFilters(params, now);
  const [s, provinces, galleries, shades] = await Promise.all([summary(f, now), byProvince(f, now), byGallery(f, now), byShade(f, now)]);
  const provinceRows = rankWithTies(provinces, (p) => p.successes);
  const topShades = rankWithTies(shades.filter((x) => x.successes > 0), (x) => x.successes).slice(0, 6);
  const topGalleries = rankWithTies(galleries, (g) => g.successes).slice(0, 8);
  const most = topShades[0]?.successes ?? 0;

  return (
    <Shell user={user} current="overview">
      <PageHead title={A.reportTitle} filters={f} now={now} />
      {params.denied && <p role="alert" className="mb-4 rounded-lg bg-[var(--gold-soft)] px-3 py-2 text-sm font-bold">{A.denied}</p>}
      <FilterBar action="/admin" f={f} options={options} />

      <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={A.m.activeGalleries} value={faNum(s.activeGalleries)} unit={A.m.activeGalleriesUnit} help={A.m.activeGalleriesHelp} />
        <Stat label={A.m.successes} value={faNum(s.successes)} unit={A.m.successesUnit} />
        <Stat label={A.m.visitors} value={faNum(s.visitors)} unit={A.m.visitorsUnit} help={A.m.visitorsHelp} />
        <Stat label={A.m.qrEntries} value={faNum(s.qrEntries)} unit={A.m.qrEntriesUnit} />
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label={A.m.sessions} value={faNum(s.sessions)} />
        <Stat label={A.m.selections} value={faNum(s.selections)} />
        <Stat label={A.m.completion} value={faPercent(share(s.completedSessions, s.sessions))} unit={A.m.completionHelp} />
      </div>

      {f.lineKey && <p className="mb-5 text-sm text-[var(--a-ink-2)]">{A.lineFilterNote}</p>}

      <div className="grid gap-x-5 xl:grid-cols-2">
        <Card title={A.provincesTitle} actions={<ExcelLink report="provinces" f={f} />}>
          {provinceRows.length === 0 ? <Empty /> : (
            <div className="a-scroll">
              <table className="a-table">
                <thead><tr><th>{A.rank}</th><th>{A.f.province}</th><th>{A.m.activeGalleries}</th><th>{A.m.qrEntries}</th><th>{A.m.successes}</th></tr></thead>
                <tbody>
                  {provinceRows.map((p) => (
                    <tr key={p.province}>
                      <td className="n">{faNum(p.rank)}</td>
                      <td>
                        <Link href={`/admin/galleries?${filtersQuery({ ...f, province: p.province, galleryId: null })}`} className="inline-flex min-h-11 items-center font-bold underline">
                          {provinceLabel(p.province)}
                        </Link>
                      </td>
                      <td className="n">{faNum(p.activeGalleries)}</td>
                      <td className="n">{faNum(p.qrEntries)}</td>
                      <td className="n">{faNum(p.successes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={A.shadesTitle} actions={<Link href={`/admin/shades?${filtersQuery(f)}`} className="a-btn a-btn-line">{A.details}</Link>}>
          {topShades.length === 0 ? <Empty /> : (
            <ul className="flex flex-col gap-3 px-4 pb-5">
              {topShades.map((x) => (
                <li key={x.shadeId} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 text-sm">
                  <span dir="ltr" className="text-end font-bold">{x.lineEn} {x.code}</span>
                  <span className="h-7 overflow-hidden rounded bg-[var(--gold-soft)]">
                    <span className="block h-full rounded bg-[var(--plum-2)]" style={{ width: `${Math.max(4, (x.successes / most) * 100)}%` }} />
                  </span>
                  <span className="num whitespace-nowrap">{faNum(x.successes)} · {faPercent(share(x.successes, s.successes))}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title={A.galleriesTitle}
        actions={<><Link href={`/admin/galleries?${filtersQuery(f)}`} className="a-btn a-btn-plum">{A.seeAll}</Link><ExcelLink report="galleries" f={f} /></>}
      >
        {topGalleries.length === 0 ? <Empty /> : (
          <div className="a-scroll">
            <table className="a-table">
              <thead><tr><th>{A.gallery}</th><th>{A.f.province}</th><th>{A.m.qrEntries}</th><th>{A.m.sessions}</th><th>{A.m.successes}</th><th>{A.popular}</th></tr></thead>
              <tbody>
                {topGalleries.map((g) => (
                  <tr key={g.id}>
                    <td className="font-bold">
                      {g.id === UNKNOWN ? A.f.unknownGallery : <Link href={`/admin/galleries/${g.id}?${filtersQuery(f)}`} className="inline-flex min-h-11 items-center underline">{g.name}</Link>}
                    </td>
                    <td>{provinceLabel(g.province)}</td>
                    <td className="n">{faNum(g.qrEntries)}</td>
                    <td className="n">{faNum(g.sessions)}</td>
                    <td className="n">{faNum(g.successes)}</td>
                    <td dir="ltr" className="text-end">{g.popular ? `${g.popular.label}${g.popular.tiedWith ? " *" : ""}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-sm text-[var(--a-ink-3)]">{A.notSales}</p>
    </Shell>
  );
}
