import Link from "next/link";
import { notFound } from "next/navigation";
import { LogOut, MapPin, Package, UserRound } from "lucide-react";
import { isLocale, localePath } from "@/i18n/config";
import { fill, getDictionary } from "@/i18n/dictionaries";
import { requireUser } from "@/lib/auth";
import { logout } from "@/lib/actions/account";

export default async function AccountLayout({ children, params }: LayoutProps<"/[locale]/account">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const user = await requireUser(localePath(locale, "/account/login"));
  const dict = getDictionary(locale);
  const links = [
    { href: "/account", label: dict.account.orders, icon: Package },
    { href: "/account/profile", label: dict.account.profile, icon: UserRound },
    { href: "/account/addresses", label: dict.account.addresses, icon: MapPin },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="font-script text-2xl text-accent-500">{dict.account.title}</p>
      <h1 className="font-display text-4xl sm:text-5xl">{fill(dict.account.hello, { name: user.firstName || user.email })}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[15rem_1fr]">
        <nav className="flex gap-2 overflow-x-auto lg:flex-col" aria-label={dict.account.title}>
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={localePath(locale, href)} className="flex shrink-0 items-center gap-3 rounded-2xl bg-surface px-4 py-3 font-bold ring-1 ring-primary-100 hover:ring-accent-300">
              <Icon className="size-5 text-accent-500" /> {label}
            </Link>
          ))}
          <form action={logout}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="flex w-full shrink-0 items-center gap-3 rounded-2xl px-4 py-3 font-bold text-ink-soft hover:bg-primary-50">
              <LogOut className="size-5" /> {dict.account.logout}
            </button>
          </form>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
