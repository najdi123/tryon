import Link from "next/link";
import type { StaffUser } from "@/lib/admin/auth";
import { logout } from "@/lib/admin/actions";
import { UNKNOWN, faDay, faMoment, filtersQuery, type Filters } from "@/lib/reports/filters";
import { faNum } from "@/lib/reports/rank";
import { A } from "./copy";

type IconName = "chart" | "store" | "palette" | "book" | "gear";
const PATHS: Record<IconName, string> = {
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  store: "M3 9l1.5-5h15L21 9M4 9v11h16V9M3 9h18M9 20v-6h6v6",
  palette: "M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-.5-1.5 0-2.5 2-.5 3.5-.5A3.5 3.5 0 0 0 21 12a9 9 0 0 0-9-9ZM7.5 12h.01M9.5 8h.01M14.5 8h.01",
  book: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h11",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8 3-2 .7-.6 1.5 1 1.9-1.5 1.5-1.9-1-1.5.6L13 20h-2l-.7-2-1.5-.6-1.9 1-1.5-1.5 1-1.9L5.8 12.7 4 12l.7-2 1.5-.6L5.3 7.5l1.5-1.5 1.9 1 1.5-.6L11 4h2l.7 2 1.5.6 1.9-1 1.5 1.5-1 1.9.6 1.5L20 12Z",
};

function Icon({ name }: { name: IconName }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}

export type Section = "overview" | "galleries" | "shades" | "catalog" | "settings";

// The frame of every panel page: the plum side bar with the sections the role may open.
export function Shell({ user, current, children }: { user: StaffUser; current: Section; children: React.ReactNode }) {
  const items: Array<{ key: Section; href: string; icon: IconName; adminOnly?: boolean }> = [
    { key: "overview", href: "/admin", icon: "chart" },
    { key: "galleries", href: "/admin/galleries", icon: "store" },
    { key: "shades", href: "/admin/shades", icon: "palette" },
    { key: "catalog", href: "/admin/catalog", icon: "book", adminOnly: true },
    { key: "settings", href: "/admin/settings", icon: "gear", adminOnly: true },
  ];
  return (
    <div className="admin flex flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 bg-[var(--plum)] px-4 py-5 text-white lg:min-h-dvh lg:w-64">
        <div className="text-center">
          <p className="text-2xl font-bold">{A.company}</p>
          <p dir="ltr" className="text-sm text-[var(--gold-soft)]">{A.companyEn}</p>
          <p className="mt-3 border-t border-white/20 pt-3 text-base font-bold">{A.panel}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label={A.panel}>
          {items.filter((i) => !i.adminOnly || user.role === "ADMIN").map((i) => (
            <Link
              key={i.key}
              href={i.href}
              aria-current={i.key === current ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-lg px-3 text-[15px] font-medium ${i.key === current ? "bg-[var(--gold-fill)] text-white" : "text-white/90 hover:bg-white/10"}`}
            >
              <Icon name={i.icon} />
              {A.nav[i.key]}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-white/20 pt-3 text-sm">
          <span>{user.displayName} <span className="text-[var(--gold-soft)]">({A.roles[user.role]})</span></span>
          <form action={logout}><button type="submit" className="min-h-11 rounded-lg px-3 font-bold hover:bg-white/10">{A.logout}</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

export function PageHead({ title, filters, now, children }: { title: string; filters?: Filters; now?: Date; children?: React.ReactNode }) {
  return (
    <header className="mb-5 border-b border-[var(--gold-fill)] pb-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-[var(--a-ink)] sm:text-3xl">{title}</h1>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
      {filters && now && (
        <p className="mt-2 text-sm text-[var(--a-ink-2)]">
          {A.rangeLine(faDay(filters.from), faDay(filters.to))} · {A.updated(faMoment(now))}
        </p>
      )}
      {filters?.sample && <p role="status" className="mt-2 rounded-lg bg-[var(--gold-soft)] px-3 py-2 text-sm font-bold">{A.sampleMode}</p>}
    </header>
  );
}

type Options = { provinces: string[]; galleries: Array<{ id: string; name: string }>; lines: Array<{ key: string; nameFa: string }> };

// A plain form: applying it loads the page with the filters in its address, so every card,
// table and export on the page reads the same filters.
export function FilterBar({ action, f, options }: { action: string; f: Filters; options: Options }) {
  return (
    <form action={action} method="get" className="a-card mb-5 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
      <div>
        <label className="a-label" htmlFor="f-range">{A.f.range}</label>
        <select id="f-range" name="range" defaultValue={f.preset} className="a-input">
          <option value="today">{A.f.today}</option>
          <option value="7">{A.f.d7}</option>
          <option value="30">{A.f.d30}</option>
          <option value="90">{A.f.d90}</option>
          <option value="custom">{A.f.custom}</option>
        </select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="date" name="from" defaultValue={f.from} aria-label={A.f.from} dir="ltr" className="a-input" />
          <input type="date" name="to" defaultValue={f.to} aria-label={A.f.to} dir="ltr" className="a-input" />
        </div>
      </div>
      <div>
        <label className="a-label" htmlFor="f-prov">{A.f.province}</label>
        <select id="f-prov" name="province" defaultValue={f.province ?? ""} className="a-input">
          <option value="">{A.f.allProvinces}</option>
          {options.provinces.map((p) => <option key={p} value={p}>{p}</option>)}
          {!f.sample && <option value={UNKNOWN}>{A.f.unknownProvince}</option>}
        </select>
      </div>
      <div>
        <label className="a-label" htmlFor="f-gal">{A.f.gallery}</label>
        <select id="f-gal" name="gallery" defaultValue={f.galleryId ?? ""} className="a-input">
          <option value="">{A.f.allGalleries}</option>
          {options.galleries.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          {!f.sample && <option value={UNKNOWN}>{A.f.unknownGallery}</option>}
        </select>
      </div>
      <div>
        <label className="a-label" htmlFor="f-line">{A.f.line}</label>
        <select id="f-line" name="line" defaultValue={f.lineKey ?? ""} className="a-input">
          <option value="">{A.f.allLines}</option>
          {options.lines.map((l) => <option key={l.key} value={l.key}>{l.nameFa}</option>)}
        </select>
        <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="sample" value="1" defaultChecked={f.sample} className="size-5" />
          {A.f.sample}
        </label>
      </div>
      <div className="flex items-start gap-2 pt-[26px]">
        <button type="submit" className="a-btn a-btn-gold">{A.f.apply}</button>
        <Link href={action} className="a-btn a-btn-line">{A.f.clear}</Link>
      </div>
    </form>
  );
}

export function Stat({ label, value, unit, help }: { label: string; value: string; unit?: string; help?: string }) {
  return (
    <div className="a-card p-4" title={help}>
      <p className="text-sm font-bold text-[var(--a-ink-2)]">{label}</p>
      <p className="num mt-1 text-3xl font-bold text-[var(--plum)]">{value}</p>
      {unit && <p className="text-xs text-[var(--a-ink-3)]">{unit}</p>}
    </div>
  );
}

export function Card({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="a-card mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-lg font-bold">{title}</h2>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </section>
  );
}

export const Empty = () => <p className="px-4 pb-5 text-sm text-[var(--a-ink-3)]">{A.empty}</p>;

export function ExcelLink({ report, f }: { report: "provinces" | "galleries" | "shades"; f: Filters }) {
  // A file download: a plain link, not a client-side navigation.
  return <a href={`/admin/export?${filtersQuery(f, { report })}`} className="a-btn a-btn-line">{A.excel}</a>;
}

export const provinceLabel = (p: string) => (p === UNKNOWN ? A.f.unknownProvince : p);
export { faNum };
