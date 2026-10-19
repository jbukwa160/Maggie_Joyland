// Admin UI primitives. No hooks here, so they work in both server and client components.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from "lucide-react";
import type { Tone } from "@/lib/admin/labels";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ─── Buttons ─────────────────────────────────────────────────────────────── */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "soft";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent-500 text-surface shadow-soft hover:bg-accent-600 active:bg-accent-700",
  secondary: "border border-primary-200 bg-surface text-ink hover:border-primary-300 hover:bg-primary-50",
  ghost: "text-ink-soft hover:bg-primary-50 hover:text-ink",
  danger: "bg-danger text-surface hover:opacity-90",
  soft: "bg-primary-100 text-accent-700 hover:bg-primary-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-lg px-3 text-xs",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2 rounded-xl px-6 text-base",
  icon: "h-9 w-9 rounded-xl",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon };

export function Button({ variant = "primary", size = "md", icon: Icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />}
      {children}
    </button>
  );
}

type LinkButtonProps = ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; icon?: LucideIcon };

export function LinkButton({ variant = "secondary", size = "md", icon: Icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {Icon && <Icon className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden />}
      {children}
    </Link>
  );
}

/* ─── Layout blocks ───────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-accent-600">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-2xl text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("min-w-0 rounded-2xl border border-primary-100 bg-surface shadow-card", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-primary-100 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-base font-extrabold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

const toneClasses: Record<Tone, string> = {
  neutral: "bg-cream-dark text-ink-soft",
  pink: "bg-primary-100 text-accent-700",
  lilac: "bg-secondary-100 text-secondary-600",
  success: "bg-mint-100 text-mint-600",
  warning: "bg-warning-50 text-warning",
  danger: "bg-danger-50 text-danger",
  gold: "bg-gold-100 text-gold-600",
};

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap", toneClasses[tone], className)}>
      {children}
    </span>
  );
}

const noticeIcons: Record<"info" | "success" | "warning" | "danger", LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
};
const noticeClasses = {
  info: "border-secondary-200 bg-secondary-50 text-ink",
  success: "border-mint bg-mint-100 text-ink",
  warning: "border-gold-300 bg-warning-50 text-ink",
  danger: "border-danger/30 bg-danger-50 text-ink",
};
const noticeIconClasses = { info: "text-secondary-500", success: "text-mint-600", warning: "text-warning", danger: "text-danger" };

export function Notice({
  tone = "info",
  title,
  children,
  actions,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const Icon = noticeIcons[tone];
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", noticeClasses[tone], className)}>
      <Icon className={cn("h-5 w-5 shrink-0", noticeIconClasses[tone])} aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-extrabold">{title}</p>}
        {children && <div className="text-ink-soft">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon?: LucideIcon; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary-200 bg-primary-50/40 px-6 py-12 text-center">
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-accent-500">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      )}
      <p className="font-extrabold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-ink-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "pink",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="flex h-full min-w-0 items-start gap-3 rounded-2xl border border-primary-100 bg-surface p-4 shadow-card transition-colors hover:border-primary-200">
      {Icon && (
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClasses[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-bold tracking-wide break-words hyphens-auto text-ink-muted uppercase">{label}</p>
        <p className="mt-0.5 text-xl font-extrabold [overflow-wrap:anywhere] text-ink tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0 rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ─── Form controls ───────────────────────────────────────────────────────── */

export const inputClass =
  "block w-full rounded-xl border border-ink-faint bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted/70 transition-colors focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none disabled:bg-cream-dark disabled:text-ink-muted aria-[invalid=true]:border-danger";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(inputClass, "h-10", className)} {...rest} />;
}

export function Textarea({ className, rows = 4, ...rest }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(inputClass, "min-h-20 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={cn(inputClass, "h-10 cursor-pointer pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
  required,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-bold text-ink">
          {label}
          {required && <span className="ml-0.5 text-accent-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs font-semibold text-danger" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-ink-muted">{hint}</p>
      )}
    </div>
  );
}

/** Switch styled checkbox. Submits "on" when checked, like a normal checkbox. */
export function Toggle({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onChange,
  disabled,
  className,
  id,
  value,
  form,
}: {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
  value?: string;
  form?: string;
}) {
  return (
    <label className={cn("group inline-flex cursor-pointer items-start gap-3 select-none", disabled && "cursor-not-allowed opacity-60", className)}>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          id={id}
          name={name}
          value={value}
          form={form}
          className="peer sr-only"
          defaultChecked={defaultChecked}
          checked={checked}
          disabled={disabled}
          onChange={onChange ? (e) => onChange(e.currentTarget.checked) : undefined}
        />
        <span className="h-6 w-11 rounded-full bg-ink-faint transition-colors peer-checked:bg-accent-500 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-300 peer-focus-visible:ring-offset-2" />
        <span className="pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-bold text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function Checkbox({ className, label, ...rest }: ComponentProps<"input"> & { label?: ReactNode }) {
  const box = (
    <input
      type="checkbox"
      className={cn("h-4 w-4 cursor-pointer rounded border-ink-faint accent-accent-500 focus-visible:ring-2 focus-visible:ring-accent-300", !label && className)}
      {...rest}
    />
  );
  if (!label) return box;
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-sm text-ink", className)}>
      {box}
      {label}
    </label>
  );
}

/* ─── Tables ──────────────────────────────────────────────────────────────── */

export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full max-w-full relative overflow-x-auto rounded-2xl border border-primary-100 bg-surface shadow-card", className)}>
      <table className="w-full min-w-max border-collapse text-sm">{children}</table>
    </div>
  );
}

export const thClass = "border-b border-primary-100 bg-primary-50/60 px-3 py-2.5 text-left text-xs font-extrabold tracking-wide text-ink-muted uppercase";
export const tdClass = "border-b border-primary-50 px-3 py-2.5 align-middle";
export const trClass = "transition-colors hover:bg-cream/70";

/* ─── Misc ────────────────────────────────────────────────────────────────── */

/** Product / banner thumbnail. Plain <img> because most images are external hotlinks. */
export function Thumb({ src, alt = "", size = 44, className }: { src?: string | null; alt?: string; size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary-100 bg-cream", className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-ink-faint">—</span>
      )}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <code className="rounded bg-cream-dark px-1.5 py-0.5 font-mono text-xs text-ink">{children}</code>;
}
