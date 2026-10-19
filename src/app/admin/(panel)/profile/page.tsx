import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { ShieldOff } from "lucide-react";
import { db, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { fmtDate } from "@/lib/admin/dates";
import { ActionButton } from "@/components/admin/forms";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { setUserRoleAction } from "../customers/actions";
import { CreateAdminForm, PasswordForm, ProfileForm } from "./ProfileForms";

export const metadata: Metadata = { title: "Профил и администратори" };

export default async function ProfilePage() {
  const me = await requireAdmin();
  const admins = db.select().from(users).where(eq(users.role, "admin")).orderBy(asc(users.createdAt)).all();
  return (
    <>
      <PageHeader title="Профил и администратори" description={`Влезли сте като ${me.email}.`} />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Моят профил">
            <ProfileForm initial={{ firstName: me.firstName, lastName: me.lastName, phone: me.phone }} />
          </Card>
          <Card title="Смяна на парола">
            <PasswordForm />
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Администратори" description="Хората с достъп до този панел." bodyClassName="p-0">
            <ul className="divide-y divide-primary-50">
              {admins.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 font-extrabold text-secondary-600">
                    {(a.firstName || a.email).slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/customers/${a.id}`} className="font-bold text-ink hover:text-accent-600">
                      {`${a.firstName} ${a.lastName}`.trim() || a.email}
                    </Link>
                    <p className="truncate text-xs text-ink-muted">
                      {a.email} · от {fmtDate(a.createdAt)}
                    </p>
                  </div>
                  {a.id === me.id ? (
                    <Badge tone="pink">Вие</Badge>
                  ) : (
                    <ActionButton
                      action={setUserRoleAction.bind(null, a.id, "customer")}
                      size="sm"
                      variant="ghost"
                      icon={<ShieldOff className="h-4 w-4" aria-hidden />}
                      confirm={`${a.email} няма да има достъп до админ панела. Продължаване?`}
                    >
                      Премахни достъпа
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Нов администратор">
            <CreateAdminForm />
          </Card>
        </div>
      </div>
    </>
  );
}
