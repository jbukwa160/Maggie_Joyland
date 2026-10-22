import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { User } from "@/db";

// The administrator an API request acts as. getCurrentUser() reads it before the session cookie, so
// the admin server actions (which all start with requireAdmin()) run unchanged for an API call and
// the API can reuse them instead of a second copy of every rule.
//
// On globalThis because Next.js may evaluate this module more than once (route handlers and server
// actions are bundled separately); two stores would mean the action never sees the API user.

export type ApiPrincipal = { user: User; keyId: string };

const g = globalThis as unknown as { __mjApiPrincipal?: AsyncLocalStorage<ApiPrincipal> };
const storage = (g.__mjApiPrincipal ??= new AsyncLocalStorage<ApiPrincipal>());

export function apiPrincipal(): ApiPrincipal | undefined {
  return storage.getStore();
}

export function runAsApi<T>(principal: ApiPrincipal, fn: () => Promise<T>): Promise<T> {
  return storage.run(principal, fn);
}
