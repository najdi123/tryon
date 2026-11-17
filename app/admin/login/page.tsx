import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/Forms";
import { A } from "@/components/admin/copy";
import { currentStaff } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "ورود کارکنان | آینه‌رنگ", robots: { index: false } };

export default async function LoginPage() {
  if (await currentStaff()) redirect("/admin");
  return (
    <div className="admin grid place-items-center px-4">
      <div className="a-card w-full max-w-sm p-6">
        <p className="text-center text-xl font-bold text-[var(--plum)]">{A.company}</p>
        <p className="mb-5 text-center text-sm text-[var(--a-ink-2)]">{A.panel}</p>
        <h1 className="mb-4 text-lg font-bold">{A.loginTitle}</h1>
        <LoginForm />
      </div>
    </div>
  );
}
