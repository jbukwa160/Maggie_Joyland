import "server-only";
import type { NextRequest } from "next/server";
import { checkKey } from "./keys";
import { runAsApi, type ApiPrincipal } from "./context";

// The wrapper every DilonSoft API route runs through: the key, the admin it acts as, JSON errors.

/** A refusal with a status and a Bulgarian message, safe to show to the person in DilonSoft. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/** A file download (CSV export, waybill PDF). */
export function file(body: BodyInit, filename: string, contentType: string) {
  // RFC 5987: the Bulgarian part of a name must not reach a latin-1 header as raw bytes.
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(body, {
    headers: {
      ...NO_STORE,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

// One client running away (a sync loop gone wrong) must not starve the shop's own visitors of the
// single SQLite connection. Generous: DilonSoft's loops make a few requests a minute.
const LIMIT_PER_MINUTE = 600;
const g = globalThis as unknown as { __mjApiBuckets?: Map<string, { start: number; count: number }> };
const buckets = (g.__mjApiBuckets ??= new Map());

/** Count one request for this key; true once it is over the per-minute limit. */
export function overLimit(keyId: string): boolean {
  const now = Date.now();
  const b = buckets.get(keyId);
  if (!b || now - b.start > 60_000) {
    buckets.set(keyId, { start: now, count: 1 });
    return false;
  }
  b.count += 1;
  return b.count > LIMIT_PER_MINUTE;
}

type Handler<P> = (request: NextRequest, params: P, principal: ApiPrincipal) => Promise<unknown>;

/** Wrap a route handler: authenticate the key, run as its admin, turn errors into JSON. */
export function apiRoute<P = Record<string, never>>(handler: Handler<P>) {
  return async (request: NextRequest, context: { params: Promise<P> }) => {
    const check = checkKey(request.headers.get("authorization"));
    if (!check.ok) return json({ ok: false, error: check.error }, 401, { "WWW-Authenticate": 'Bearer realm="dilonsoft"' });
    if (overLimit(check.key.id)) return json({ ok: false, error: "Твърде много заявки. Опитайте след минута." }, 429, { "Retry-After": "60" });
    const principal: ApiPrincipal = { user: check.user, keyId: check.key.id };
    try {
      const params = (await context.params) ?? ({} as P);
      const result = await runAsApi(principal, () => handler(request, params, principal));
      return result instanceof Response ? result : json(result);
    } catch (e) {
      return errorResponse(e, request);
    }
  };
}

export function errorResponse(e: unknown, request?: Request) {
  if (e instanceof ApiError) return json({ ok: false, error: e.message, errors: e.errors }, e.status);
  if (e instanceof SyntaxError) return json({ ok: false, error: "Невалиден JSON в заявката." }, 400);
  console.error(`[dilonsoft-api] ${request?.method ?? ""} ${request ? new URL(request.url).pathname : ""} failed:`, e);
  return json({ ok: false, error: "Вътрешна грешка в магазина. Опитайте отново." }, 500);
}

/** The JSON body as an object ({} for an empty body). */
export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "Тялото на заявката трябва да е JSON обект.");
  return value as Record<string, unknown>;
}

/** The public address of the shop: SITE_URL, else the address this request came in on. */
export function siteUrl(request?: Request): string {
  const configured = (process.env.SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return request ? new URL(request.url).origin : "";
}
