"use client";

import { startTransition, useActionState, useTransition, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";
import type { ActionState } from "@/lib/admin/action-state";
import { Button, type ButtonSize, type ButtonVariant } from "./ui";
import { useToast } from "./Toast";

/**
 * Wraps a server action for an admin form: pending state, field errors and a toast with the result.
 * Uses onSubmit (instead of <form action>) so React does not reset the fields after saving.
 */
export function useAdminForm<S extends ActionState = ActionState>(
  action: (prev: S, formData: FormData) => Promise<S>,
  options?: { onSuccess?: (state: NonNullable<S>) => void },
) {
  const toast = useToast();
  const run = async (prev: Awaited<S>, formData: FormData): Promise<S> => {
    const result = await action(prev as S, formData);
    if (result?.message) toast(result.message, result.ok ? "success" : "error");
    if (result?.ok) options?.onSuccess?.(result as NonNullable<S>);
    return result;
  };
  const [state, dispatch, pending] = useActionState<S, FormData>(run, null as Awaited<S>);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(e.currentTarget, submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement ? submitter : null);
    startTransition(() => dispatch(formData));
  };

  const errors = state && !state.ok ? state.errors ?? {} : {};
  return { state, pending, onSubmit, errors };
}

/** Submit button that shows a spinner while its form's action runs. */
export function SubmitButton({
  children = "Запази",
  pending: pendingProp,
  variant = "primary",
  size = "md",
  icon = true,
  className,
  ...rest
}: ComponentProps<"button"> & { pending?: boolean; variant?: ButtonVariant; size?: ButtonSize; icon?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending || rest.disabled} className={className} {...rest}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon ? <Save className="h-4 w-4" aria-hidden /> : null}
      {children}
    </Button>
  );
}

/** Submit button that asks for confirmation first. Works inside plain server-action forms. */
export function ConfirmButton({
  message = "Сигурни ли сте?",
  children,
  variant = "danger",
  size = "md",
  className,
  icon,
  ...rest
}: ComponentProps<"button"> & { message?: string; variant?: ButtonVariant; size?: ButtonSize; icon?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}

/**
 * Button that runs a server action directly (no form) and toasts the result.
 * `confirm` asks before running.
 */
export function ActionButton({
  action,
  confirm,
  children,
  variant = "secondary",
  size = "md",
  icon,
  className,
  title,
  disabled,
  onDone,
}: {
  action: () => Promise<ActionState | void>;
  confirm?: string;
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icon element, e.g. <Trash2 className="h-4 w-4" /> (an element, so server components can pass it). */
  icon?: ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
  onDone?: (result: ActionState | void) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      title={title}
      aria-label={title}
      disabled={pending || disabled}
      onClick={() => {
        if (confirm && !window.confirm(confirm)) return;
        start(async () => {
          try {
            const result = await action();
            if (result?.message) toast(result.message, result.ok ? "success" : "error");
            onDone?.(result);
          } catch (e) {
            if (isRedirectError(e)) throw e;
            toast("Нещо се обърка. Опитайте отново.", "error");
          }
        });
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </Button>
  );
}

function isRedirectError(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/** General (non-field) error message of a form. */
export function FormError({ state }: { state: ActionState }) {
  if (!state || state.ok || !state.message) return null;
  return (
    <p role="alert" className="rounded-xl border border-danger/30 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger">
      {state.message}
    </p>
  );
}

/** Sticky save bar shown at the bottom of long edit forms. */
export function SaveBar({ pending, children, label = "Запази промените" }: { pending: boolean; children?: ReactNode; label?: string }) {
  return (
    <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-primary-100 bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      {children}
      <SubmitButton pending={pending}>{label}</SubmitButton>
    </div>
  );
}
