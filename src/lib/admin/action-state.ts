// Shape returned by admin server actions (safe to import from client components).
export type ActionState = {
  ok: boolean;
  message?: string;
  /** Field name -> Bulgarian error message. */
  errors?: Record<string, string>;
  /** Changes on every result so identical consecutive results are still noticed. */
  ts?: number;
} | null;

export function success(message?: string): NonNullable<ActionState> {
  return { ok: true, message, ts: Date.now() };
}

export function failure(message: string, errors?: Record<string, string>): NonNullable<ActionState> {
  return { ok: false, message, errors, ts: Date.now() };
}
