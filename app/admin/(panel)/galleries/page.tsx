import Link from "next/link";
import { A } from "@/components/admin/copy";
import { Card, Empty, FilterBar, PageHead, Shell, provinceLabel } from "@/components/admin/Shell";
import { requireStaff } from "@/lib/admin/auth";
import { UNKNOWN, filtersQuery } from "@/lib/reports/filters";
import { foldSearch } from "@/lib/reports/rank";
import { byGallery, loadFilters } from "@/lib/reports/queries";
import { faDigits, faNum, rankWithTies } from "@/lib/reports/rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "گالری‌ها | پنل آینه‌رنگ", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Galleries({ searchParams }: Props) {
  const user = await requireStaff();
  const params = await searchParams;
  const now = new Date();
  const { f, options } = await loadFilters(params, now);
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 60) : "";
  const status = params.status === "ACTIVE" || params.status === "INACTIVE" ? params.status : "";
  const all = await byGallery(f, now);
  const needle = foldSearch(q);
  const rows = rankWithTies(
    all.filter((g) => (!needle || foldSearch(g.name).includes(needle) || foldSearch(g.publicId).includes(needle)) && (!status || (g.id !== UNKNOWN && g.status === status))),
    (g) => g.successes,
  );
  const extra: Record<string, string> = { ...(q ? { q } : {}), ...(status ? { status } : {}) };

  return (
    <Shell user={user} current="galleries">
      <PageHead title={A.galleriesTitle} filters={f} now={now}>
        {user.role === "ADMIN" && <Link href="/admin/galleries/new" className="a-btn a-btn-gold">{A.newGallery}</Link>}
      </PageHead>
      <FilterBar action="/admin/galleries" f={f} options={options} />

      <Card title={A.galleriesTitle} actions={<a href={`/admin/export?${filtersQuery(f, { report: "galleries", ...extra })}`} className="a-btn a-btn-line">{A.excel}</a>}>
        <form action="/admin/galleries" method="get" className="flex flex-wrap items-end gap-2 px-4 pb-4">
          {[...new URLSearchParams(filtersQuery(f))].map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <input name="q" defaultValue={q} placeholder={A.search} aria-label={A.search} className="a-input max-w-72" />
          <select name="status" defaultValue={status} aria-label={A.status} className="a-input max-w-44">
            <option value="">{A.allStatuses}</option>
            <option value="ACTIVE">{A.active}</option>
            <option value="INACTIVE">{A.inactive}</option>
          </select>
          <button type="submit" className="a-btn a-btn-line">{A.doSearch}</button>
        </form>
        {rows.length === 0 ? <Empty /> : (
          <div className="a-scroll">
            <table className="a-table">
              <thead>
                <tr>
                  <th>{A.rank}</th><th>{A.gallery}</th><th>{A.galleryId}</th><th>{A.f.province}</th><th>{A.status}</th>
                  <th>{A.m.qrEntries}</th><th>{A.m.sessions}</th><th>{A.m.successes}</th><th>{A.popular}</th><th />
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td className="n">{faNum(g.rank)}</td>
                    <td className="font-bold">{g.id === UNKNOWN ? A.f.unknownGallery : g.name}</td>
                    <td dir="ltr" className="text-end">{g.publicId || "—"}</td>
                    <td>{provinceLabel(g.province)}{g.city ? `، ${g.city}` : ""}</td>
                    <td>{g.id === UNKNOWN ? "—" : g.status === "ACTIVE" ? A.active : A.inactive}</td>
                    <td className="n">{faNum(g.qrEntries)}</td>
                    <td className="n">{faNum(g.sessions)}</td>
                    <td className="n">{faNum(g.successes)}</td>
                    <td>
                      {g.popular ? (
                        <span title={g.popular.tiedWith ? A.tied(faDigits(String(g.popular.tiedWith))) : undefined}>
                          <span dir="ltr">{g.popular.label}</span>{g.popular.tiedWith ? " *" : ""}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      {g.id !== UNKNOWN && (
                        <span className="flex gap-2">
                          <Link href={`/admin/galleries/${g.id}?${filtersQuery(f)}`} className="a-btn a-btn-line">{A.details}</Link>
                          {g.status === "ACTIVE" && <a href={`/admin/galleries/${g.id}/qr?format=png`} className="a-btn a-btn-line">{A.getQr}</a>}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ExcelNote />
    </Shell>
  );
}

function ExcelNote() {
  return <p className="text-sm text-[var(--a-ink-3)]">* {A.tiedNote} · {A.notSales}</p>;
}
