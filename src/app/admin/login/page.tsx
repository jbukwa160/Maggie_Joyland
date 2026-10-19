import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/admin") && !next.startsWith("/admin/login") ? next : "/admin";
  const user = await getCurrentUser();
  if (user?.role === "admin") redirect(nextPath);

  return (
    <main className="bg-dots flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="font-display text-3xl text-accent-600">Maggie Joyland</p>
          <p className="mt-1 text-xs font-bold tracking-[0.25em] text-ink-muted uppercase">Админ панел</p>
        </div>
        <div className="rounded-3xl border border-primary-100 bg-surface p-6 shadow-card sm:p-8">
          <h1 className="mb-1 text-xl font-extrabold text-ink">Добре дошли!</h1>
          <p className="mb-6 text-sm text-ink-muted">Влезте с администраторския си профил.</p>
          <LoginForm next={nextPath} />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link href="/" className="font-semibold text-ink-muted hover:text-accent-600">
            ← Обратно към магазина
          </Link>
        </p>
      </div>
    </main>
  );
}
