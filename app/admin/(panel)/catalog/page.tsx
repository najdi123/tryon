import Link from "next/link";
import { ShadeRow } from "@/components/admin/Forms";
import { A } from "@/components/admin/copy";
import { Card, PageHead, Shell } from "@/components/admin/Shell";
import { setLineActive } from "@/lib/admin/actions";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { faNum } from "@/lib/reports/rank";

export const dynamic = "force-dynamic";
export const metadata = { title: "کاتالوگ | پنل آینه‌رنگ", robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

// One product line at a time: its shades grouped by colour family, each row its own small form.
export default async function Catalog({ searchParams }: Props) {
  const user = await requireAdmin();
  const params = await searchParams;
  const lines = await db.productLine.findMany({ orderBy: { sort: "asc" }, include: { _count: { select: { shades: true } } } });
  const line = lines.find((l) => l.key === params.line) ?? lines[0];
  const shades = line ? await db.shade.findMany({ where: { lineId: line.id }, orderBy: { sort: "asc" } }) : [];
  const families: Array<{ key: string; nameFa: string; rows: typeof shades }> = [];
  for (const s of shades) {
    const last = families[families.length - 1];
    if (last && last.key === s.familyKey) last.rows.push(s);
    else families.push({ key: s.familyKey, nameFa: s.familyFa, rows: [s] });
  }
  const unchecked = shades.filter((s) => !s.nameChecked).length;

  return (
    <Shell user={user} current="catalog">
      <PageHead title={A.catalogTitle} />
      <p className="mb-4 text-sm text-[var(--a-ink-2)]">{A.catalogHelp}</p>
      <nav className="mb-5 flex flex-wrap gap-2" aria-label={A.catalogTitle}>
        {lines.map((l) => (
          <Link key={l.key} href={`/admin/catalog?line=${l.key}`} aria-current={l.key === line?.key ? "page" : undefined}
            className={`a-btn ${l.key === line?.key ? "a-btn-plum" : "a-btn-line"}`}>
            {l.nameFa} <span className="num">({faNum(l._count.shades)})</span>
          </Link>
        ))}
      </nav>
      {line && (
        <>
          <form action={setLineActive} className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <input type="hidden" name="key" value={line.key} />
            <span>{A.lineActive}: <b>{line.active ? A.active : A.inactive}</b></span>
            <button type="submit" className="a-btn a-btn-line">{line.active ? A.deactivate : A.activate}</button>
            <span className="num text-[var(--a-ink-3)]">{A.unchecked}: {faNum(unchecked)}</span>
          </form>
          {families.map((fam) => (
            <Card key={fam.key} title={fam.nameFa}>
              <div className="a-scroll">
                <table className="a-table">
                  <tbody>
                    {fam.rows.map((s) => (
                      <ShadeRow key={s.id} shade={{
                        id: s.id, code: s.code, nameFa: s.nameFa, nameEn: s.nameEn, hex: s.hex ?? "#888888",
                        active: s.active, nameChecked: s.nameChecked, tryOn: s.tryOn,
                      }} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
    </Shell>
  );
}
