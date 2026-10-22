// The admin half of the DilonSoft Custom API (src/lib/dilonsoft/protocol.ts), behind one route:
//
//   GET    /admin                                         the manifest: groups, sections, fields, actions
//   GET    /admin/badges                                  menu counters
//   GET    /admin/lookup/{name}?q=&value=                 options / search for select and picker fields
//   POST   /admin/uploads?filename=                       an image (raw body) -> { url }
//   GET    /admin/sections/{key}                          dashboard blocks | list (?q, page, per_page, sort, f.<filter>) | form values
//   POST   /admin/sections/{key}                          create a record { values }
//   PATCH  /admin/sections/{key}                          save a form section { values, tab }
//   GET    /admin/sections/{key}/new                      values the create form starts with
//   POST   /admin/sections/{key}/actions/{action}         bulk / section action { ids, all, query, input } (or a raw file)
//   GET    /admin/sections/{key}/records/{id}             one record
//   PATCH  /admin/sections/{key}/records/{id}             save it { values }
//   DELETE /admin/sections/{key}/records/{id}             delete it
//   POST   /admin/sections/{key}/records/{id}/actions/{action}   { input } (or a raw file)
import "server-only";
import type { NextRequest } from "next/server";
import { uploadImageAction } from "@/app/admin/actions";
import { ApiError, json, readJson } from "../http";
import { allLookups, badges, findSection, manifest } from "./registry";
import { actionsOf, isDashboard, isForm, isTable, type ActionCall, type ListQuery, type SectionDef, type TableSectionDef } from "./types";
import type { ActionResponse } from "../protocol";

const MAX_UPLOAD = 20 * 1024 * 1024;

export function section(key: string): SectionDef {
  const s = findSection(key);
  if (!s) throw new ApiError(404, `Няма раздел „${key}“.`);
  return s;
}

function table(s: SectionDef): TableSectionDef {
  if (!isTable(s)) throw new ApiError(400, `„${s.spec.key}“ не е списък.`);
  return s;
}

/** The list position and filters, from the query string (?q, page, per_page, sort, f.<key>) or from a JSON body. */
export function listQuery(s: SectionDef, source: URLSearchParams | Record<string, unknown>): ListQuery {
  const get = (k: string) => String((source instanceof URLSearchParams ? source.get(k) : source[k]) ?? "");
  const filters: Record<string, string> = {};
  if (source instanceof URLSearchParams) {
    for (const [k, v] of source) if (k.startsWith("f.") && v !== "") filters[k.slice(2)] = v.slice(0, 200);
  } else if (source.filters && typeof source.filters === "object") {
    for (const [k, v] of Object.entries(source.filters as Record<string, unknown>)) if (v !== "" && v != null) filters[k] = String(v).slice(0, 200);
  }
  const spec = isTable(s) ? s.spec : null;
  return {
    q: get("q").slice(0, 200),
    page: Math.max(1, Math.floor(Number(get("page")) || 1)),
    perPage: Math.min(200, Math.max(1, Number(get("per_page")) || spec?.per_page || 50)),
    sort: get("sort") || spec?.sort?.default || "",
    filters,
  };
}

function answer(result: ActionResponse | Response) {
  if (result instanceof Response) return result;
  return json(result, result.ok ? 200 : 422);
}

export async function runAction(request: NextRequest, s: SectionDef, actionKey: string, id?: string): Promise<Response> {
  const { specs, handlers } = actionsOf(s);
  const spec = specs.find((a) => a.key === actionKey);
  const handler = handlers[actionKey];
  if (!spec || !handler) throw new ApiError(404, `Няма действие „${actionKey}“.`);
  const recordScoped = spec.scope === "row" || spec.scope === "record";
  if (recordScoped !== (id !== undefined)) throw new ApiError(400, `Действието „${actionKey}“ е за ${recordScoped ? "един запис" : "целия раздел"}.`);

  const sp = request.nextUrl.searchParams;
  const call: ActionCall = { id, ids: [], all: false, query: listQuery(s, sp), input: {}, request };
  if (spec.upload) {
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD) throw new ApiError(413, "Файлът е по-голям от 20 MB.");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length) throw new ApiError(400, "Не е изпратен файл.");
    if (bytes.length > MAX_UPLOAD) throw new ApiError(413, "Файлът е по-голям от 20 MB.");
    call.file = { name: (sp.get("filename") ?? "file").slice(0, 200), type: request.headers.get("content-type") ?? "application/octet-stream", bytes };
    for (const [k, v] of sp) if (k.startsWith("i.")) call.input[k.slice(2)] = v;
  } else {
    const body = await readJson(request);
    call.input = body.input && typeof body.input === "object" ? (body.input as Record<string, unknown>) : {};
    call.ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, 20000) : [];
    call.all = body.all === true;
    if (body.query && typeof body.query === "object") call.query = listQuery(s, body.query as Record<string, unknown>);
  }
  return answer(await handler(call));
}

/** Answer one admin request; `path` is what follows /admin. */
export async function handleAdmin(request: NextRequest, path: string[]): Promise<unknown> {
  const method = request.method;
  const [head, key, third, fourth, fifth, sixth] = path;

  if (!head) {
    if (method !== "GET") throw new ApiError(405, "Само GET.");
    return manifest(request);
  }

  if (head === "badges" && method === "GET" && path.length === 1) return badges();

  if (head === "lookup" && method === "GET" && key && path.length === 2) {
    const lookups = allLookups();
    if (!Object.hasOwn(lookups, key)) throw new ApiError(404, `Няма справка „${key}“.`);
    const lookup = lookups[key]!;
    const sp = request.nextUrl.searchParams;
    return lookup((sp.get("q") ?? "").slice(0, 100), sp.getAll("value").slice(0, 500));
  }

  if (head === "uploads" && method === "POST" && path.length === 1) {
    if (Number(request.headers.get("content-length")) > MAX_UPLOAD) throw new ApiError(413, "Файлът е по-голям от 20 MB.");
    const bytes = await request.arrayBuffer();
    if (!bytes.byteLength) throw new ApiError(400, "Не е изпратен файл.");
    const name = (request.nextUrl.searchParams.get("filename") ?? "image").slice(0, 200);
    const fd = new FormData();
    fd.set("file", new File([bytes], name, { type: request.headers.get("content-type") ?? "" }));
    const res = await uploadImageAction(fd);
    if (!res.ok) throw new ApiError(422, res.error);
    return { ok: true, url: res.url };
  }

  if (head !== "sections" || !key) throw new ApiError(404, "Няма такъв адрес.");
  const s = section(key);

  // /sections/{key}
  if (path.length === 2) {
    if (method === "GET") {
      if (isDashboard(s) || isForm(s)) return s.load(request);
      return table(s).list(listQuery(s, request.nextUrl.searchParams), request);
    }
    if (method === "POST") {
      const t = table(s);
      if (!t.create || !t.spec.create) throw new ApiError(405, "В този раздел не се създават записи.");
      const body = await readJson(request);
      return answer(await t.create((body.values as Record<string, unknown>) ?? {}));
    }
    if (method === "PATCH" && isForm(s)) {
      const body = await readJson(request);
      return answer(await s.save((body.values as Record<string, unknown>) ?? {}, typeof body.tab === "string" ? body.tab : null));
    }
    throw new ApiError(405, "Методът не е позволен.");
  }

  // /sections/{key}/new
  if (third === "new" && path.length === 3 && method === "GET") {
    const t = table(s);
    if (!t.defaults) throw new ApiError(405, "В този раздел не се създават записи.");
    return { values: await t.defaults() };
  }

  // /sections/{key}/actions/{action}
  if (third === "actions" && fourth && path.length === 4 && method === "POST") return runAction(request, s, fourth);

  // /sections/{key}/records/{id}[/actions/{action}]
  if (third === "records" && fourth) {
    const id = fourth;
    if (path.length === 6 && fifth === "actions" && sixth && method === "POST") return runAction(request, s, sixth, id);
    if (path.length === 4) {
      const t = table(s);
      if (method === "GET") {
        if (!t.get) throw new ApiError(405, "Записите в този раздел нямат отделна страница.");
        return t.get(id, request);
      }
      if (method === "PATCH") {
        if (!t.update || !t.spec.form) throw new ApiError(405, "Записите в този раздел не се редактират.");
        const body = await readJson(request);
        return answer(await t.update(id, (body.values as Record<string, unknown>) ?? {}));
      }
      if (method === "DELETE") {
        if (!t.remove || !t.spec.delete) throw new ApiError(405, "Записите в този раздел не се изтриват.");
        return answer(await t.remove(id));
      }
    }
  }
  throw new ApiError(404, "Няма такъв адрес.");
}
