"use client";

import { useActionState } from "react";
import { createUser, login, saveGallery, saveRetention, saveShade, updateUser, type FormState } from "@/lib/admin/actions";
import { A } from "./copy";

const START: FormState = {};

function Note({ state, messages = A.errors }: { state: FormState; messages?: Record<string, string> }) {
  if (state.error) return <p role="alert" className="text-sm text-[var(--a-danger)]">{messages[state.error] ?? A.errors.required}</p>;
  if (state.ok) return <p role="status" className="text-sm text-[var(--a-ok)]">{A.saved}</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, START);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="a-label" htmlFor="username">{A.username}</label>
        <input id="username" name="username" dir="ltr" autoComplete="username" required className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="password">{A.password}</label>
        <input id="password" name="password" type="password" dir="ltr" autoComplete="current-password" required className="a-input" />
      </div>
      <Note state={state} messages={{ wrong: A.loginWrong, blocked: A.loginBlocked }} />
      <button type="submit" disabled={pending} className="a-btn a-btn-plum">{A.login}</button>
    </form>
  );
}

type GalleryValues = { id: string; publicId: string; name: string; province: string; city: string; status: "ACTIVE" | "INACTIVE" };

export function GalleryForm({ gallery }: { gallery?: GalleryValues }) {
  const [state, action, pending] = useActionState(saveGallery, START);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="id" value={gallery?.id ?? ""} />
      <div>
        <label className="a-label" htmlFor="g-name">{A.galleryName}</label>
        <input id="g-name" name="name" defaultValue={gallery?.name} required maxLength={80} className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="g-pid">{A.galleryPublicId}</label>
        <input id="g-pid" name="publicId" dir="ltr" defaultValue={gallery?.publicId} required maxLength={20} className="a-input" />
        <p className="mt-1 text-xs text-[var(--a-ink-3)]">{A.galleryPublicIdHelp}</p>
      </div>
      <div>
        <label className="a-label" htmlFor="g-prov">{A.f.province}</label>
        <input id="g-prov" name="province" defaultValue={gallery?.province} required maxLength={40} className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="g-city">{A.city}</label>
        <input id="g-city" name="city" defaultValue={gallery?.city} required maxLength={40} className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="g-status">{A.status}</label>
        <select id="g-status" name="status" defaultValue={gallery?.status ?? "ACTIVE"} className="a-input">
          <option value="ACTIVE">{A.active}</option>
          <option value="INACTIVE">{A.inactive}</option>
        </select>
        <p className="mt-1 text-xs text-[var(--a-ink-3)]">{A.deactivateHelp}</p>
      </div>
      <div className="flex items-end gap-3">
        <button type="submit" disabled={pending} className="a-btn a-btn-gold">{A.save}</button>
        <Note state={state} />
      </div>
    </form>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState(createUser, START);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <div>
        <label className="a-label" htmlFor="u-name">{A.displayName}</label>
        <input id="u-name" name="displayName" required maxLength={60} className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="u-user">{A.username}</label>
        <input id="u-user" name="username" dir="ltr" required maxLength={30} autoComplete="off" className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="u-pass">{A.password}</label>
        <input id="u-pass" name="password" type="password" dir="ltr" required minLength={10} autoComplete="new-password" className="a-input" />
      </div>
      <div>
        <label className="a-label" htmlFor="u-role">{A.role}</label>
        <select id="u-role" name="role" defaultValue="VIEWER" className="a-input">
          <option value="VIEWER">{A.roles.VIEWER}</option>
          <option value="ADMIN">{A.roles.ADMIN}</option>
        </select>
      </div>
      <div className="flex flex-col justify-end gap-1">
        <button type="submit" disabled={pending} className="a-btn a-btn-gold">{A.newUser}</button>
        <Note state={state} />
      </div>
    </form>
  );
}

export function UserActions({ id, active, role }: { id: string; active: boolean; role: "ADMIN" | "VIEWER" }) {
  const [state, action, pending] = useActionState(updateUser, START);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input name="password" type="password" dir="ltr" minLength={10} placeholder={A.newPassword} autoComplete="new-password" aria-label={A.newPassword} className="a-input max-w-44" />
      <button type="submit" name="intent" value="password" disabled={pending} className="a-btn a-btn-line">{A.resetPassword}</button>
      <button type="submit" name="intent" value="role" disabled={pending} formNoValidate className="a-btn a-btn-line">
        {role === "ADMIN" ? A.roles.VIEWER : A.roles.ADMIN}
      </button>
      <button type="submit" name="intent" value="toggle" disabled={pending} formNoValidate className="a-btn a-btn-line">
        {active ? A.deactivate : A.activate}
      </button>
      <Note state={state} />
    </form>
  );
}

type ShadeValues = { id: string; code: string; nameFa: string; nameEn: string; hex: string; active: boolean; nameChecked: boolean; tryOn: boolean };

export function ShadeRow({ shade }: { shade: ShadeValues }) {
  const [state, action, pending] = useActionState(saveShade, START);
  return (
    <tr>
      <td className="n" dir="ltr">{shade.code}</td>
      <td colSpan={5}>
        <form action={action} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={shade.id} />
          <input name="nameFa" defaultValue={shade.nameFa} required maxLength={60} aria-label={A.shadeName} className="a-input max-w-64" />
          <span dir="ltr" className="min-w-40 text-xs text-[var(--a-ink-3)]">{shade.nameEn}</span>
          <input name="hex" type="color" defaultValue={shade.hex} aria-label={A.swatch} className="h-11 w-14 rounded-lg border border-[var(--a-line)] bg-white" />
          <label className="flex min-h-11 items-center gap-1.5 text-sm"><input type="checkbox" name="nameChecked" defaultChecked={shade.nameChecked} className="size-5" />{A.checked}</label>
          <label className="flex min-h-11 items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={shade.active} className="size-5" />{A.active}</label>
          {!shade.tryOn && <span className="rounded-full bg-[var(--gold-soft)] px-2.5 py-1 text-xs">{A.notTryOn}</span>}
          <button type="submit" disabled={pending} className="a-btn a-btn-line">{A.save}</button>
          <Note state={state} />
        </form>
      </td>
    </tr>
  );
}

export function RetentionForm({ days }: { days: number }) {
  const [state, action, pending] = useActionState(saveRetention, START);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="a-label" htmlFor="ret">{A.retention}</label>
        <input id="ret" name="days" type="number" min={30} max={3650} defaultValue={days} dir="ltr" className="a-input max-w-32" />
      </div>
      <button type="submit" disabled={pending} className="a-btn a-btn-line">{A.save}</button>
      <Note state={state} />
    </form>
  );
}
