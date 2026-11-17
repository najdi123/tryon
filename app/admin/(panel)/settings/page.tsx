import { NewUserForm, RetentionForm, UserActions } from "@/components/admin/Forms";
import { A } from "@/components/admin/copy";
import { Card, PageHead, Shell } from "@/components/admin/Shell";
import { requireAdmin } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { faMoment } from "@/lib/reports/filters";

export const dynamic = "force-dynamic";
export const metadata = { title: "تنظیمات | پنل آینه‌رنگ", robots: { index: false } };

export default async function Settings() {
  const user = await requireAdmin();
  const [users, log, retention] = await Promise.all([
    db.adminUser.findMany({ orderBy: { createdAt: "asc" } }),
    db.changeLog.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { adminUser: { select: { displayName: true } } } }),
    db.setting.findUnique({ where: { key: "retention.eventDays" } }),
  ]);

  return (
    <Shell user={user} current="settings">
      <PageHead title={A.settingsTitle} />

      <Card title={A.usersTitle}>
        <div className="a-scroll">
          <table className="a-table">
            <thead><tr><th>{A.displayName}</th><th>{A.username}</th><th>{A.role}</th><th>{A.status}</th><th /></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-bold">{u.displayName}</td>
                  <td dir="ltr" className="text-end">{u.username}</td>
                  <td>{A.roles[u.role]}</td>
                  <td>{u.active ? A.active : A.inactive}</td>
                  <td><UserActions id={u.id} active={u.active} role={u.role} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[var(--a-line)] px-4 py-4">
          <h3 className="mb-3 font-bold">{A.newUser}</h3>
          <NewUserForm />
        </div>
      </Card>

      <Card title={A.policyTitle}>
        <ul className="flex list-disc flex-col gap-1.5 px-9 pb-4 text-sm text-[var(--a-ink-2)]">
          {A.policy.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <div className="border-t border-[var(--a-line)] px-4 py-4">
          <RetentionForm days={Number(retention?.value ?? 365)} />
          <p className="mt-2 text-xs text-[var(--a-ink-3)]">{A.retentionHelp}</p>
        </div>
      </Card>

      <Card title={A.logTitle}>
        {log.length === 0 ? <p className="px-4 pb-5 text-sm text-[var(--a-ink-3)]">{A.logEmpty}</p> : (
          <div className="a-scroll">
            <table className="a-table">
              <thead><tr><th>{A.logWhen}</th><th>{A.logWho}</th><th>{A.logWhat}</th></tr></thead>
              <tbody>
                {log.map((l) => (
                  <tr key={l.id}>
                    <td className="n whitespace-nowrap">{faMoment(l.createdAt)}</td>
                    <td className="whitespace-nowrap">{l.adminUser.displayName}</td>
                    <td>{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
