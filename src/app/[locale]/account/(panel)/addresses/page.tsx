import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Trash2 } from "lucide-react";
import { addresses, db } from "@/db";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { deleteAddress } from "@/lib/actions/account";
import { AddressForm } from "@/components/shop/account/ProfileForms";

export default async function AddressesPage({ params }: PageProps<"/[locale]/account/addresses">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(localePath(locale, "/account/login"));
  const dict = getDictionary(locale);
  const list = db.select().from(addresses).where(eq(addresses.userId, user.id)).orderBy(desc(addresses.id)).all();
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl">{dict.account.addresses}</h2>
      {list.length === 0 ? (
        <p className="text-ink-soft">{dict.account.noAddresses}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 rounded-[1.5rem] bg-surface p-4 ring-1 ring-primary-100">
              <div>
                <p className="font-bold">
                  {a.firstName} {a.lastName} {a.phone && <span className="font-semibold text-ink-muted">· {a.phone}</span>}
                </p>
                <p className="text-ink-soft">
                  {a.city} {a.postcode}
                  <br />
                  {a.address}
                </p>
              </div>
              <form action={deleteAddress}>
                <input type="hidden" name="id" value={a.id} />
                <button type="submit" className="p-1 text-ink-muted hover:text-danger" aria-label={dict.account.delete}>
                  <Trash2 className="size-5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <AddressForm />
    </div>
  );
}
