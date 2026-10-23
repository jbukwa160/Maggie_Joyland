// DilonSoft Custom API, protocol v1: the shapes this shop sends to DilonSoft (and to MCP clients).
//
// DilonSoft has no code for this shop. It connects with the address and an API key, pulls orders,
// pushes stock and confirms shipments through the channel endpoints, and draws its admin panel from
// the manifest below: every section, column, field and action the panel shows is described here by
// the shop. A copy of these types lives in DilonSoft (frontend/src/lib/site-admin/protocol.ts) and
// the contract is written up in its docs/CUSTOM-API.md. Change all three together.
//
// Money is always an integer number of cents. Dates are ISO 8601 strings. Labels are { bg, en }.

export const PROTOCOL = "dilonsoft-custom-api";
export const PROTOCOL_VERSION = 1;

export type Text = { bg: string; en: string };
export type Tone = "neutral" | "ok" | "warn" | "bad" | "wait" | "paused";

// ─── Channel: GET / ────────────────────────────────────────────────────────────

export type Capability = "orders" | "products" | "stock" | "shipments" | "cancellations" | "admin" | "mcp";

export type SiteInfo = {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  site: { name: string; url: string; admin_url: string; currency: string; locales: string[] };
  capabilities: Capability[];
  /** The admin the key acts as (its e-mail), so the person connecting can recognise it. */
  acting_as: string;
};

// ─── Channel: orders and products ──────────────────────────────────────────────

export type ChannelOrderItem = {
  line_id: string;
  product_id: string | null;
  sku: string;
  ean: string;
  name: string;
  quantity: number;
  /** Cents, VAT included. */
  unit_price: number;
};

export type ChannelOrder = {
  id: string;
  number: string;
  status: string;
  created_at: string;
  updated_at: string;
  shipped_at: string | null;
  cancelled: boolean;
  currency: string;
  /** Cents, VAT included. */
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  payment: { method: string; paid: boolean; cod_amount: number | null };
  customer: { name: string; email: string; phone: string };
  delivery: {
    type: "address" | "office" | "locker";
    carrier: string;
    office_id: string;
    office_name: string;
    address: string;
    city: string;
    postcode: string;
    country: string;
  };
  items: ChannelOrderItem[];
  tracking_number: string;
  notes: string;
};

export type ChannelProduct = {
  id: string;
  sku: string;
  ean: string;
  name: string;
  /** Cents, VAT included: the price a buyer pays today. */
  price: number;
  currency: string;
  /** What can be sold now (stock minus reserved). */
  stock: number;
  active: boolean;
  url: string;
  image: string;
};

// ─── Admin manifest: GET /admin ────────────────────────────────────────────────

export type Option = { value: string; label: Text; tone?: Tone };

/** Show a field or action only while another value is one of `in`. A field reads the form's values
 *  (in a repeater: the item's); an action's dialog field also reads the record's values. */
export type When = { field: string; in: (string | number | boolean)[] };

export type FieldType =
  | "text"
  | "textarea"
  | "markdown"
  | "number"
  | "integer"
  | "money"
  | "percent"
  | "select"
  | "multiselect"
  | "boolean"
  | "date"
  | "datetime"
  | "color"
  | "image"
  | "images"
  | "reference"
  | "references"
  | "repeater"
  | "list"
  | "email"
  | "url"
  | "password"
  | "info";

export type FieldSpec = {
  key: string;
  type: FieldType;
  label: Text;
  help?: Text;
  placeholder?: string;
  required?: boolean;
  readonly?: boolean;
  /** Layout hint: how much of a row the field takes on a wide screen. */
  width?: "full" | "half" | "third";
  /** select / multiselect. */
  options?: Option[];
  /** reference / references, or a select whose options are dynamic: GET /admin/lookup/{lookup}. */
  lookup?: string;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  max_length?: number;
  /** repeater: the fields of one item. */
  fields?: FieldSpec[];
  /** repeater: which item field names the item in its header. */
  item_label?: string;
  max_items?: number;
  when?: When;
  /** Only on the create form. */
  create_only?: boolean;
  /** Starting value. An action's input field otherwise starts with the record's value of the same key. */
  default?: unknown;
};

export type FormSpec = {
  /** Either tabs or one list of fields. */
  tabs?: { key: string; title: Text; fields: FieldSpec[] }[];
  fields?: FieldSpec[];
  /** Tabbed forms only: each tab has its own save button and saves only its own fields. */
  save_per_tab?: boolean;
};

export type ColumnType = "text" | "number" | "money" | "date" | "datetime" | "boolean" | "badge" | "image" | "link" | "tags";

export type ColumnSpec = {
  key: string;
  label: Text;
  type: ColumnType;
  /** badge: label and tone per value. */
  options?: Option[];
  /** Edit the value in the row: runs the row action with { value }. Only on rows that carry the key. */
  edit?: { action: string; type: "money" | "integer" | "text" };
  /** Switch a boolean in the row: runs the row action with { value }. Only on rows that carry the key. */
  toggle?: string;
  align?: "left" | "right";
  /** A second line under the value, read from this key of the row. */
  sub?: string;
};

/** Filters travel as ?f.<key>=<value>; a "boolean" filter sends "1" when on, a "date" one YYYY-MM-DD. */
export type FilterSpec = {
  key: string;
  label: Text;
  type: "select" | "boolean" | "text" | "date";
  options?: Option[];
  lookup?: string;
};

export type ActionSpec = {
  key: string;
  label: Text;
  /** row: in the list and on the record page; record: record page only; bulk: selected rows; section: the page header. */
  scope: "row" | "record" | "bulk" | "section";
  icon?: string;
  tone?: "default" | "danger";
  confirm?: Text;
  /** Fields asked for in a dialog before the action runs; sent as `input`. On a record they start
   *  with the record's value of the same key. */
  input?: FieldSpec[];
  /** The action takes a file: the body is the raw file, `input` goes in the query string. */
  upload?: { accept: string; label: Text };
  /** file: the answer is a download, not JSON. */
  result?: "message" | "file";
  when?: When;
  /** Not offered as a button: run by an inline edit or toggle column, a messages block's reply,
   *  or a preview's confirm. */
  hidden?: boolean;
};

type SectionBase = {
  key: string;
  title: Text;
  /** Lucide icon name in kebab-case ("shopping-bag"). Unknown names get a generic icon. */
  icon?: string;
  description?: Text;
  /** A counter from GET /admin/badges shown beside the menu entry. */
  badge?: string;
  /** Re-read the page this often while it is open (chat). */
  refresh_seconds?: number;
};

export type DashboardSection = SectionBase & { kind: "dashboard" };

export type TableSection = SectionBase & {
  kind: "table";
  columns: ColumnSpec[];
  filters?: FilterSpec[];
  /** Placeholder of the search box; absent = no search. */
  search?: Text;
  /** Quick filters shown as pills above the list. */
  presets?: { label: Text; filters: Record<string, string>; sort?: string }[];
  sort?: { options: Option[]; default: string };
  per_page?: number;
  /** Records can be created; a Text renames the button. */
  create?: boolean | Text;
  /** The edit (and create) form; absent = records are read-only. */
  form?: FormSpec;
  /** Rows open a record page (GET .../records/{id}). Filled in by the site from whether it has one. */
  records?: boolean;
  /** Records can be deleted; the Text is the confirmation question. */
  delete?: Text;
  /** Rows can be selected for bulk actions. */
  selectable?: boolean;
  actions?: ActionSpec[];
  empty?: Text;
};

export type FormSection = SectionBase & { kind: "form"; form: FormSpec; actions?: ActionSpec[] };

export type SectionSpec = DashboardSection | TableSection | FormSection;

export type AdminManifest = {
  protocol: typeof PROTOCOL;
  version: typeof PROTOCOL_VERSION;
  title: string;
  /** The currency of every money value (cents). */
  currency: string;
  /** Relative image paths (/uploads/x.webp) are resolved against this. */
  site_url: string;
  admin_url: string;
  groups: { title: Text | null; sections: SectionSpec[] }[];
};

// ─── Admin responses ───────────────────────────────────────────────────────────

export type Row = {
  id: string | number;
  values: Record<string, unknown>;
  tone?: Tone;
  /** Where the row opens when it is another section's record (a stock row is a product). */
  link?: LinkTarget;
};

export type ListResponse = { rows: Row[]; total: number; page: number; per_page: number; summary?: string };

export type LinkTarget = { section: string; id?: string | number; filters?: Record<string, string> };

export type Block =
  | {
      type: "fields";
      title?: Text;
      items: { label: Text; value: unknown; kind?: ColumnType; options?: Option[]; link?: LinkTarget }[];
    }
  | { type: "table"; title?: Text; columns: ColumnSpec[]; rows: Row[]; section?: string; empty?: Text }
  | { type: "timeline"; title?: Text; items: { at: string; title: string; text?: string; tone?: Tone }[] }
  | {
      type: "messages";
      title?: Text;
      items: { id: string | number; from: "them" | "us"; text: string; at: string }[];
      /** The record action that sends a reply; its input has one field, `body`. */
      reply?: string;
    }
  | {
      type: "stats";
      title?: Text;
      items: { label: Text; value: string; hint?: string; tone?: Tone; link?: LinkTarget }[];
    }
  | { type: "notice"; tone: Tone; text: string };

export type DashboardResponse = { blocks: Block[] };

export type RecordResponse = {
  id: string | number;
  title: string;
  subtitle?: string;
  /** Current values of the form fields (and anything `when` conditions read). */
  values: Record<string, unknown>;
  blocks?: Block[];
  /** Public page of the record on the shop, when it has one. */
  url?: string;
};

export type FormResponse = { values: Record<string, unknown>; blocks?: Block[] };

export type ActionResponse = {
  ok: boolean;
  message?: string;
  /** Field key -> message. */
  errors?: Record<string, string>;
  /** The record that was created. */
  id?: string | number;
  /** Shown before anything changes; `confirm` is the action that applies it. */
  preview?: { blocks: Block[]; confirm?: { action: string; label: Text; input: Record<string, unknown> } };
};

export type Badges = Record<string, number>;

export type LookupResponse = { items: { value: string; label: string; hint?: string; image?: string }[] };
