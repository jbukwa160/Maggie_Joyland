import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/shop/account/AuthShell";
import { LoginForm } from "@/components/shop/account/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/login">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).account.login, robots: { index: false } } : {};
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/account/login">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect(localePath(locale, "/account"));
  const dict = getDictionary(locale);
  return (
    <AuthShell title={dict.account.login} text={dict.account.loginText}>
      <LoginForm next={typeof next === "string" ? next : ""} />
    </AuthShell>
  );
}
