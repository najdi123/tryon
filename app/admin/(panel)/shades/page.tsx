import { A } from "@/components/admin/copy";
import { Card, Empty, ExcelLink, FilterBar, PageHead, Shell } from "@/components/admin/Shell";
import { requireStaff } from "@/lib/admin/auth";
import { parseFilters } from "@/lib/reports/filters";
import { byShade, filterOptions, summary } from "@/lib/reports/queries";
import { faNum, faPercent, rankWithTies, share } from "@/lib/reports/rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "گزارش رنگ‌ها | پنل آینه‌رنگ", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// Popularity is measured by successful try-ons. Selections are shown beside them, never added.
export default async function Shades({ searchParams }: Props) {
  const user = await requireStaff();
  const now = new Date();
  const f = parseFilters(await searchParams, now);
  const [shades, s, options] = await Promise.all([byShade(f, now), summary(f, now), filterOptions(f)]);
  const rows = rankWithTies(shades, (x) => x.successes);

  return (
    <Shell user={user} current="shades">
      <PageHead title={A.shadesReportTitle} filters={f} now={now} />
      <FilterBar action="/admin/shades" f={f} options={options} />
      <Card title={A.shadesReportTitle} actions={<ExcelLink report="shades" f={f} />}>
        {rows.length === 0 ? <Empty /> : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr><th>{A.rank}</th><th>{A.line}</th><th>{A.code}</th><th>{A.shadeName}</th><th>{A.m.selections}</th><th>{A.m.successes}</th><th>{A.share}</th></tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.shadeId}>
                    <td className="n">{faNum(x.rank)}</td>
                    <td>{x.lineFa}</td>
                    <td dir="ltr" className="n text-end font-bold">{x.code}</td>
                    <td>{x.nameFa}</td>
                    <td className="n">{faNum(x.selections)}</td>
                    <td className="n">{faNum(x.successes)}</td>
                    <td className="n">{faPercent(share(x.successes, s.successes))}</td>
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
