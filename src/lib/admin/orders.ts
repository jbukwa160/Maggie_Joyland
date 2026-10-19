import "server-only";
import { and, eq, gte, lte, or, sql, type SQL } from "drizzle-orm";
import { carriers, orderStatuses, orders, type CarrierId, type OrderStatus } from "@/db";
import { fromDateTimeInput } from "./dates";
import { escapeLike } from "./products";

type Params = Record<string, string | string[] | undefined>;

export type OrderFilters = {
  q: string;
  status: OrderStatus | "";
  carrier: CarrierId | "";
  payment: "cod" | "bank" | "";
  paymentStatus: "pending" | "paid" | "refunded" | "";
  from: string;
  to: string;
  page: number;
};

const one = (sp: Params, k: string) => {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v ?? "").trim();
};

export function parseOrderFilters(sp: Params): OrderFilters {
  const status = one(sp, "status");
  const carrier = one(sp, "carrier");
  const payment = one(sp, "payment");
  const paymentStatus = one(sp, "paymentStatus");
  return {
    q: one(sp, "q").slice(0, 100),
    status: (orderStatuses as readonly string[]).includes(status) ? (status as OrderStatus) : "",
    carrier: (carriers as readonly string[]).includes(carrier) ? (carrier as CarrierId) : "",
    payment: payment === "cod" || payment === "bank" ? payment : "",
    paymentStatus: paymentStatus === "pending" || paymentStatus === "paid" || paymentStatus === "refunded" ? paymentStatus : "",
    from: /^\d{4}-\d{2}-\d{2}$/.test(one(sp, "from")) ? one(sp, "from") : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(one(sp, "to")) ? one(sp, "to") : "",
    page: Math.max(1, Math.floor(Number(one(sp, "page")) || 1)),
  };
}

/** Case variants for Cyrillic text (SQLite LIKE is only case-insensitive for ASCII). */
function variants(s: string): string[] {
  const lower = s.toLowerCase();
  const cap = lower.charAt(0).toUpperCase() + lower.slice(1);
  return [...new Set([s, lower, cap, s.toUpperCase()])];
}

export function orderConditions(f: OrderFilters, opts: { ignoreStatus?: boolean } = {}): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (f.q) {
    const q = f.q.replace(/^№|^#/, "").trim();
    const digits = q.replace(/[^\d+]/g, "");
    const parts: SQL[] = [];
    for (const v of variants(q)) {
      const pattern = `%${escapeLike(v)}%`;
      parts.push(
        sql`${orders.number} LIKE ${pattern} ESCAPE '\\'`,
        sql`${orders.email} LIKE ${pattern} ESCAPE '\\'`,
        sql`(${orders.firstName} || ' ' || ${orders.lastName}) LIKE ${pattern} ESCAPE '\\'`,
      );
    }
    if (digits.length >= 4) {
      // Phone numbers are typed in many formats – compare digits only.
      const tail = digits.replace(/^\+?359/, "").replace(/^0/, "");
      parts.push(sql`replace(replace(replace(replace(${orders.phone}, ' ', ''), '-', ''), '(', ''), ')', '') LIKE ${`%${escapeLike(tail)}%`} ESCAPE '\\'`);
    }
    conds.push(or(...parts));
  }
  if (f.status && !opts.ignoreStatus) conds.push(eq(orders.status, f.status));
  if (f.carrier) conds.push(eq(orders.carrier, f.carrier));
  if (f.payment) conds.push(eq(orders.paymentMethod, f.payment));
  if (f.paymentStatus) conds.push(eq(orders.paymentStatus, f.paymentStatus));
  const from = fromDateTimeInput(f.from);
  const to = fromDateTimeInput(f.to, true);
  if (from) conds.push(gte(orders.createdAt, from));
  if (to) conds.push(lte(orders.createdAt, to));
  const list = conds.filter((c): c is SQL => !!c);
  return list.length ? and(...list) : undefined;
}

