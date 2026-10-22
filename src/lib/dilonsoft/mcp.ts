import "server-only";
import { NextRequest } from "next/server";
import { getSettings } from "@/lib/settings";
import { ApiError } from "./http";
import { allLookups, allSections, badges } from "./admin/registry";
import { listQuery, runAction, section } from "./admin/dispatch";
import { actionsOf, isDashboard, isForm, isTable, type SectionDef } from "./admin/types";
import type { ActionResponse, FieldSpec, FormSpec } from "./protocol";

// MCP (Model Context Protocol) server for the shop: POST /api/mcp, JSON-RPC 2.0 over the stateless
// Streamable HTTP transport, authenticated with the same API key as DilonSoft. The tools are the
// admin panel's own sections and actions (admin/registry.ts), so an AI assistant can do exactly
// what the panel can - with the same validation - and nothing the panel cannot.

// Newest first. A client asking for a version not listed is answered with the newest one, as the
// specification asks ("SHOULD be the latest version supported by the server").
export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST = SUPPORTED_VERSIONS[0]!;

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
type JsonRpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const sectionKeys = () => allSections().map((s) => s.spec.key);

function fieldSummary(f: FieldSpec): Record<string, unknown> {
  return {
    key: f.key,
    type: f.type,
    label: f.label.bg,
    ...(f.required ? { required: true } : {}),
    ...(f.options ? { options: f.options.map((o) => o.value) } : {}),
    ...(f.lookup ? { lookup: f.lookup } : {}),
    ...(f.fields ? { fields: f.fields.map(fieldSummary) } : {}),
    ...(f.help ? { help: f.help.bg } : {}),
    ...(f.type === "money" ? { unit: "cents" } : {}),
  };
}

function formFields(form?: FormSpec): Record<string, unknown>[] {
  if (!form) return [];
  return [...(form.fields ?? []), ...(form.tabs ?? []).flatMap((t) => t.fields)].filter((f) => f.type !== "info").map(fieldSummary);
}

function describe(s: SectionDef, full: boolean): Record<string, unknown> {
  const spec = s.spec;
  const base: Record<string, unknown> = { key: spec.key, kind: spec.kind, title: spec.title.bg, ...(spec.description ? { description: spec.description.bg } : {}) };
  const { specs } = actionsOf(s);
  const actions = specs.map((a) => ({
    key: a.key,
    label: a.label.bg,
    scope: a.scope,
    ...(a.input ? { input: a.input.map(fieldSummary) } : {}),
    ...(a.upload ? { needs_file: true } : {}),
    ...(a.result === "file" ? { returns_file: true } : {}),
    ...(a.tone === "danger" ? { destructive: true } : {}),
  }));
  if (!full) return { ...base, actions: actions.map((a) => a.key) };
  if (isTable(s)) {
    return {
      ...base,
      columns: s.spec.columns.map((c) => ({ key: c.key, label: c.label.bg, type: c.type })),
      filters: (s.spec.filters ?? []).map((f) => ({ key: f.key, label: f.label.bg, type: f.type, ...(f.options ? { options: f.options.map((o) => o.value) } : {}), ...(f.lookup ? { lookup: f.lookup } : {}) })),
      ...(s.spec.sort ? { sort: s.spec.sort.options.map((o) => o.value) } : {}),
      can_create: Boolean(s.spec.create),
      can_delete: Boolean(s.spec.delete),
      fields: formFields(s.spec.form),
      actions,
    };
  }
  if (isForm(s)) return { ...base, tabs: (s.spec.form.tabs ?? []).map((t) => t.key), fields: formFields(s.spec.form), actions };
  return base;
}

const S = { type: "string" } as const;
const OBJ = { type: "object", additionalProperties: true } as const;

function tools() {
  const keys = sectionKeys();
  const sectionProp = { type: "string", enum: keys, description: "Section key - see describe_admin." };
  const ro = { readOnlyHint: true, openWorldHint: false };
  return [
    {
      name: "shop_overview",
      title: "Shop overview",
      description: "The admin dashboard of the shop: today's and this month's orders and revenue, orders waiting for action, stock alerts, unconfirmed prices, unread chat. Start here.",
      inputSchema: { type: "object", properties: {} },
      annotations: ro,
    },
    {
      name: "describe_admin",
      title: "Describe the admin sections",
      description: `Lists the admin sections (${keys.join(", ")}) with their actions; with "section", the full description: list columns, filters, sort options, form fields (money is in cents) and actions with their inputs. Call it before creating, updating or running actions.`,
      inputSchema: { type: "object", properties: { section: sectionProp } },
      annotations: ro,
    },
    {
      name: "list_records",
      title: "List records",
      description: "One page of a list section (orders, products, customers, ...), with search, filters (keys from describe_admin) and sort.",
      inputSchema: {
        type: "object",
        properties: {
          section: sectionProp,
          q: { type: "string", description: "Search text." },
          filters: { type: "object", additionalProperties: { type: "string" }, description: "Filter key -> value." },
          sort: S,
          page: { type: "integer", minimum: 1 },
          per_page: { type: "integer", minimum: 1, maximum: 200 },
        },
        required: ["section"],
      },
      annotations: ro,
    },
    {
      name: "get_record",
      title: "Get one record",
      description: "One record of a list section: its current values and its detail blocks (order lines, history, ...).",
      inputSchema: { type: "object", properties: { section: sectionProp, id: { type: ["string", "integer"] } }, required: ["section", "id"] },
      annotations: ro,
    },
    {
      name: "create_record",
      title: "Create a record",
      description: "Creates a record (product, category, coupon, banner, page, article, ...). Fields you leave out keep their defaults. Money is in cents.",
      inputSchema: { type: "object", properties: { section: sectionProp, values: OBJ }, required: ["section", "values"] },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    {
      name: "update_record",
      title: "Update a record",
      description: "Changes the given fields of a record; the other fields keep their current values. Money is in cents.",
      inputSchema: { type: "object", properties: { section: sectionProp, id: { type: ["string", "integer"] }, values: OBJ }, required: ["section", "id", "values"] },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: "delete_record",
      title: "Delete a record",
      description: "Deletes a record. Cannot be undone.",
      inputSchema: { type: "object", properties: { section: sectionProp, id: { type: ["string", "integer"] } }, required: ["section", "id"] },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    {
      name: "get_form",
      title: "Read a settings form",
      description: "The current values of a form section (settings, menu, home page, ...).",
      inputSchema: { type: "object", properties: { section: sectionProp }, required: ["section"] },
      annotations: ro,
    },
    {
      name: "save_form",
      title: "Save a settings form",
      description: "Changes fields of a form section; the other fields keep their current values. For forms with tabs pass the tab key.",
      inputSchema: { type: "object", properties: { section: sectionProp, values: OBJ, tab: S }, required: ["section", "values"] },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    {
      name: "run_action",
      title: "Run an action",
      description:
        "Runs a section action (describe_admin lists them): on one record (id), on several (ids, or all=true with q/filters for every matching row), or on the whole section. Actions marked destructive change things that cannot be undone; create_waybill books a paid courier shipment.",
      inputSchema: {
        type: "object",
        properties: {
          section: sectionProp,
          action: S,
          id: { type: ["string", "integer"] },
          ids: { type: "array", items: { type: ["string", "integer"] } },
          all: { type: "boolean" },
          q: S,
          filters: { type: "object", additionalProperties: { type: "string" } },
          input: OBJ,
        },
        required: ["section", "action"],
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    {
      name: "lookup",
      title: "Look up options",
      description: `Options for select and picker fields and filters (their "lookup" name): ${Object.keys(allLookups()).join(", ")}. "products" searches by name, code or barcode.`,
      inputSchema: { type: "object", properties: { name: { type: "string", enum: Object.keys(allLookups()) }, q: S }, required: ["name"] },
      annotations: ro,
    },
  ];
}

function arg(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (v === undefined || v === null || v === "") throw new ApiError(400, `Липсва аргумент „${key}“.`);
  return String(v);
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** A request the admin dispatch understands, for actions that read their call from the URL. */
function internalRequest(request: NextRequest, path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(`/api/dilonsoft/v1/admin/${path}`, request.url), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

async function callTool(name: string, params: Record<string, unknown>, request: NextRequest): Promise<{ content: unknown[]; structuredContent?: unknown; isError?: boolean }> {
  const ok = (data: unknown) => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    ...(data && typeof data === "object" && !Array.isArray(data) ? { structuredContent: data } : {}),
  });
  const actionResult = (r: ActionResponse) => ({ ...ok(r), ...(r.ok ? {} : { isError: true }) });

  switch (name) {
    case "shop_overview": {
      const dash = section("dashboard");
      const settings = await getSettings();
      const data = isDashboard(dash) ? await dash.load(request) : { blocks: [] };
      return ok({ shop: settings.general.siteName, counters: badges(), ...data });
    }
    case "describe_admin": {
      if (params.section) return ok(describe(section(String(params.section)), true));
      return ok({ sections: allSections().map((s) => describe(s, false)), lookups: Object.keys(allLookups()) });
    }
    case "list_records": {
      const s = section(arg(params, "section"));
      if (!isTable(s)) throw new ApiError(400, "Това не е списък - ползвайте get_form или shop_overview.");
      const q = listQuery(s, { q: params.q, filters: obj(params.filters), sort: params.sort, page: params.page, per_page: params.per_page });
      return ok(await s.list(q, request));
    }
    case "get_record": {
      const s = section(arg(params, "section"));
      if (!isTable(s) || !s.get) throw new ApiError(400, "Записите в този раздел нямат отделна страница.");
      return ok(await s.get(arg(params, "id"), request));
    }
    case "create_record": {
      const s = section(arg(params, "section"));
      if (!isTable(s) || !s.create || !s.spec.create) throw new ApiError(400, "В този раздел не се създават записи.");
      const defaults = s.defaults ? await s.defaults() : {};
      return actionResult(await s.create({ ...defaults, ...obj(params.values) }));
    }
    case "update_record": {
      const s = section(arg(params, "section"));
      if (!isTable(s) || !s.update || !s.spec.form) throw new ApiError(400, "Записите в този раздел не се редактират.");
      const id = arg(params, "id");
      const current = s.get ? (await s.get(id, request)).values : {};
      return actionResult(await s.update(id, { ...current, ...obj(params.values) }));
    }
    case "delete_record": {
      const s = section(arg(params, "section"));
      if (!isTable(s) || !s.remove || !s.spec.delete) throw new ApiError(400, "Записите в този раздел не се изтриват.");
      return actionResult(await s.remove(arg(params, "id")));
    }
    case "get_form": {
      const s = section(arg(params, "section"));
      if (!isForm(s)) throw new ApiError(400, "Това не е форма.");
      return ok(await s.load(request));
    }
    case "save_form": {
      const s = section(arg(params, "section"));
      if (!isForm(s)) throw new ApiError(400, "Това не е форма.");
      const current = (await s.load(request)).values;
      return actionResult(await s.save({ ...current, ...obj(params.values) }, typeof params.tab === "string" ? params.tab : null));
    }
    case "run_action": {
      const key = arg(params, "section");
      const s = section(key);
      const action = arg(params, "action");
      const spec = actionsOf(s).specs.find((a) => a.key === action);
      if (!spec) throw new ApiError(404, `Няма действие „${action}“ в „${key}“.`);
      if (spec.upload) throw new ApiError(400, "Това действие качва файл - направете го от админ панела.");
      const recordScoped = spec.scope === "row" || spec.scope === "record";
      const id = recordScoped ? arg(params, "id") : undefined;
      const body = {
        input: obj(params.input),
        ids: Array.isArray(params.ids) ? params.ids.map(String) : [],
        all: params.all === true,
        query: { q: params.q ?? "", filters: obj(params.filters) },
      };
      const path = `sections/${encodeURIComponent(key)}/${id !== undefined ? `records/${encodeURIComponent(id)}/` : ""}actions/${encodeURIComponent(action)}`;
      const res = await runAction(internalRequest(request, path, body), s, action, id);
      const type = res.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const data = (await res.json()) as ActionResponse;
        return actionResult(data);
      }
      // A file: CSV comes back as text the assistant can read, anything else as an embedded resource.
      const bytes = new Uint8Array(await res.arrayBuffer());
      const filename = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "file";
      if (type.startsWith("text/") && bytes.length <= 512 * 1024) {
        return { content: [{ type: "text", text: `${filename}:\n${new TextDecoder().decode(bytes)}` }] };
      }
      if (bytes.length > 5 * 1024 * 1024) return { content: [{ type: "text", text: `${filename}: ${bytes.length} байта - твърде голям, изтеглете го от админ панела.` }] };
      return {
        content: [
          { type: "text", text: `${filename} (${type || "application/octet-stream"}, ${bytes.length} байта)` },
          { type: "resource", resource: { uri: `file:///${filename}`, mimeType: type || "application/octet-stream", blob: Buffer.from(bytes).toString("base64") } },
        ],
      };
    }
    case "lookup": {
      const name = arg(params, "name");
      const lookups = allLookups();
      if (!Object.hasOwn(lookups, name)) throw new ApiError(404, `Няма справка „${name}“.`);
      const lookup = lookups[name]!;
      return ok(await lookup(String(params.q ?? ""), []));
    }
    default:
      throw new McpError(-32602, `Unknown tool: ${name}`);
  }
}

class McpError extends Error {
  constructor(
    public code: number,
    message: string,
  ) {
    super(message);
  }
}

async function instructions() {
  const settings = await getSettings();
  return (
    `Админ панелът на онлайн магазина „${settings.general.siteName}“ (детски играчки, България; цени в евро, сумите в инструментите са в центове). ` +
    "Започнете с shop_overview и describe_admin. Поръчките, продуктите и клиентите са раздели-списъци (list_records / get_record), настройките - форми (get_form / save_form). " +
    "Действията (run_action) правят същото като бутоните в админ панела, със същите проверки; create_waybill създава платена товарителница при куриера."
  );
}

/** Answer one JSON-RPC message; null for a notification. */
export async function handleMessage(msg: JsonRpcRequest, request: NextRequest): Promise<JsonRpcResponse | null> {
  const id = msg.id ?? null;
  const isNotification = msg.id === undefined || msg.id === null;
  try {
    if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") throw new McpError(-32600, "Invalid Request");
    let result: unknown;
    switch (msg.method) {
      case "initialize": {
        const requested = String(msg.params?.protocolVersion ?? "");
        const settings = await getSettings();
        result = {
          protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : LATEST,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "maggie-joyland-admin", title: `${settings.general.siteName} - админ`, version: "1.0.0" },
          instructions: await instructions(),
        };
        break;
      }
      case "ping":
        result = {};
        break;
      case "tools/list":
        result = { tools: tools() };
        break;
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const args = obj(msg.params?.arguments);
        try {
          result = await callTool(name, args, request);
        } catch (e) {
          if (e instanceof McpError) throw e;
          // A refusal is a tool result the model can read and correct, not a protocol error.
          const message = e instanceof ApiError ? e.message : "Вътрешна грешка в магазина.";
          if (!(e instanceof ApiError)) console.error(`[mcp] ${name} failed:`, e);
          result = { content: [{ type: "text", text: message }], isError: true };
        }
        break;
      }
      case "resources/list":
        result = { resources: [] };
        break;
      case "prompts/list":
        result = { prompts: [] };
        break;
      default:
        if (msg.method.startsWith("notifications/")) return null;
        throw new McpError(-32601, `Method not found: ${msg.method}`);
    }
    return isNotification ? null : { jsonrpc: "2.0", id, result };
  } catch (e) {
    if (isNotification) return null;
    const code = e instanceof McpError ? e.code : -32603;
    const message = e instanceof Error ? e.message : "Internal error";
    if (!(e instanceof McpError)) console.error("[mcp] request failed:", e);
    return { jsonrpc: "2.0", id, error: { code, message } };
  }
}
