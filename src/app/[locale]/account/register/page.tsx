import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale, localePath } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/components/shop/account/AuthShell";
import { RegisterForm } from "@/components/shop/account/AuthForms";

export async function generateMetadata({ params }: PageProps<"/[locale]/account/register">): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDictionary(locale).account.register, robots: { index: false } } : {};
}

export default async function RegisterPage({ params, searchParams }: PageProps<"/[locale]/account/register">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const next = (await searchParams).next;
  if (await getCurrentUser()) redirect(localePath(locale, "/account"));
  const dict = getDictionary(locale);
  return (
    <AuthShell title={dict.account.register} text={dict.account.registerText}>
      <RegisterForm next={typeof next === "string" ? next : ""} />
    </AuthShell>
  );
}
