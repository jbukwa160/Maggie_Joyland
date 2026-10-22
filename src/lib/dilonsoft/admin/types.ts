import "server-only";
import type { NextRequest } from "next/server";
import type {
  ActionResponse,
  ActionSpec,
  DashboardResponse,
  DashboardSection,
  FormResponse,
  FormSection,
  ListResponse,
  LookupResponse,
  RecordResponse,
  TableSection,
  Text,
} from "../protocol";

// How one admin section is implemented on this side: its manifest entry (`spec`) and the handlers
// the dispatcher (app/api/dilonsoft/v1/admin) and the MCP tools call.

export const t = (bg: string, en: string): Text => ({ bg, en });

export type ListQuery = { q: string; page: number; perPage: number; sort: string; filters: Record<string, string> };

export type UploadedFile = { name: string; type: string; bytes: Uint8Array };

export type ActionCall = {
  /** Row / record actions. */
  id?: string;
  /** Bulk actions: the selected rows, or every row matching `query` when `all` is set. */
  ids: string[];
  all: boolean;
  query: ListQuery;
  input: Record<string, unknown>;
  file?: UploadedFile;
  request: NextRequest;
};

export type ActionHandler = (call: ActionCall) => Promise<ActionResponse | Response>;

/** GET /admin/lookup/{name}?q=&value=: options of a select, search behind a picker, suggestions of a
 *  link field. `values` asks for the labels of values already chosen. */
export type Lookup = (q: string, values: string[]) => LookupResponse | Promise<LookupResponse>;

export type TableSectionDef = {
  spec: TableSection;
  list(query: ListQuery, request: NextRequest): Promise<ListResponse>;
  get?(id: string, request: NextRequest): Promise<RecordResponse>;
  /** Values the create form starts with. */
  defaults?(): Promise<Record<string, unknown>>;
  create?(values: Record<string, unknown>): Promise<ActionResponse>;
  update?(id: string, values: Record<string, unknown>): Promise<ActionResponse>;
  remove?(id: string): Promise<ActionResponse>;
  actions?: Record<string, ActionHandler>;
  /** Lookups this section's fields and filters use (merged into GET /admin/lookup). */
  lookups?: Record<string, Lookup>;
};

export type DashboardSectionDef = {
  spec: DashboardSection;
  load(request: NextRequest): Promise<DashboardResponse>;
};

export type FormSectionDef = {
  spec: FormSection;
  load(request: NextRequest): Promise<FormResponse>;
  /** `tab`: save only that tab's fields (forms with save_per_tab). */
  save(values: Record<string, unknown>, tab: string | null): Promise<ActionResponse>;
  actions?: Record<string, ActionHandler>;
  lookups?: Record<string, Lookup>;
};

export type SectionDef = TableSectionDef | DashboardSectionDef | FormSectionDef;

export const isTable = (s: SectionDef): s is TableSectionDef => s.spec.kind === "table";
export const isForm = (s: SectionDef): s is FormSectionDef => s.spec.kind === "form";
export const isDashboard = (s: SectionDef): s is DashboardSectionDef => s.spec.kind === "dashboard";

/** The actions a section implements (none for a dashboard). */
export function actionsOf(s: SectionDef): { specs: ActionSpec[]; handlers: Record<string, ActionHandler> } {
  if (isDashboard(s)) return { specs: [], handlers: {} };
  return { specs: s.spec.actions ?? [], handlers: s.actions ?? {} };
}

export function paginate<T>(items: T[], query: ListQuery): { slice: T[]; total: number } {
  const start = (query.page - 1) * query.perPage;
  return { slice: items.slice(start, start + query.perPage), total: items.length };
}
