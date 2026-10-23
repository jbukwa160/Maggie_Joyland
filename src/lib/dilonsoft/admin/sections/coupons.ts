import "server-only";
import { desc, eq } from "drizzle-orm";
import { coupons, db, type Coupon } from "@/db";
import { formatPrice } from "@/lib/format";
import { fmtDate, now } from "@/lib/admin/dates";
import { deleteCouponAction, saveCouponAction, toggleCouponAction } from "@/app/admin/(panel)/coupons/actions";
import type { ActionResponse, FieldSpec } from "../../protocol";
import { bool, form, intId, iso, localDateTime, money, run, str } from "../../bridge";
import { ApiError } from "../../http";
import { paginate, t, type TableSectionDef } from "../types";
import { options } from "../util";

// Admin → Кодове за отстъпка: the list with its status and on/off switch, and create / edit / delete
// through the shop's coupon actions. The discount is a whole percent or an amount in cents, so the
// form has one field for each (`percent`, `amount`) where the shop's form has one `value` box.

type Status = "off" | "upcoming" | "expired" | "exhausted" | "active";

const STATUS_OPTIONS = options<Status>(
  { off: "Изключен", upcoming: "Предстои", expired: "Изтекъл", exhausted: "Изчерпан", active: "Активен" },
  { off: "Off", upcoming: "Upcoming", expired: "Expired", exhausted: "Used up", active: "Active" },
  { off: "neutral", upcoming: "lilac", expired: "warning", exhausted: "warning", active: "success" },
);

/** The coupons page's status badge. */
function couponStatus(c: Coupon, at: Date): Status {
  if (!c.isActive) return "off";
  if (c.startsAt && c.startsAt > at) return "upcoming";
  if (c.endsAt && c.endsAt < at) return "expired";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "exhausted";
  return "active";
}

const discount = (c: Coupon) => (c.type === "percent" ? `${c.value}%` : formatPrice(c.value));

const FIELDS: FieldSpec[] = [
  {
    key: "code",
    type: "text",
    label: t("Код", "Code"),
    required: true,
    max_length: 40,
    placeholder: "LYATO20",
    help: t("Клиентът го въвежда в количката. Главни латински букви и цифри.", "The customer types it in the cart. Capital Latin letters and digits."),
  },
  {
    key: "type",
    type: "select",
    label: t("Вид отстъпка", "Discount type"),
    required: true,
    width: "half",
    options: [
      { value: "percent", label: t("Процент (%)", "Percent (%)") },
      { value: "fixed", label: t("Сума (€)", "Amount (€)") },
    ],
  },
  { key: "percent", type: "percent", label: t("Отстъпка (%)", "Discount (%)"), min: 1, max: 90, step: 1, placeholder: "10", width: "half", when: { field: "type", in: ["percent"] } },
  { key: "amount", type: "money", label: t("Отстъпка (€)", "Discount (€)"), placeholder: "5.00", width: "half", when: { field: "type", in: ["fixed"] } },
  { key: "minSubtotal", type: "money", label: t("Минимална сума на поръчката (€)", "Minimum order amount (€)"), help: t("0 или празно = без минимум", "0 or empty = no minimum"), width: "half" },
  { key: "usageLimit", type: "integer", label: t("Максимален брой използвания", "Maximum number of uses"), help: t("Празно = неограничено", "Empty = unlimited"), min: 1, width: "half" },
  { key: "isActive", type: "boolean", label: t("Активен", "Active") },
  { key: "startsAt", type: "datetime", label: t("Валиден от", "Valid from"), help: t("По желание", "Optional"), width: "half" },
  { key: "endsAt", type: "datetime", label: t("Валиден до", "Valid until"), help: t("По желание", "Optional"), width: "half" },
  { key: "resetUsage", type: "boolean", label: t("Нулирай брояча при запазване", "Reset the counter on save"), when: { field: "has_usage", in: [true] } },
];

function couponValues(c: Coupon) {
  return {
    code: c.code,
    type: c.type,
    percent: c.type === "percent" ? c.value : null,
    amount: c.type === "fixed" ? c.value : null,
    minSubtotal: c.minSubtotal || null,
    usageLimit: c.usageLimit,
    isActive: c.isActive,
    startsAt: iso(c.startsAt),
    endsAt: iso(c.endsAt),
    resetUsage: false,
    has_usage: c.usedCount > 0,
  };
}

/** The FormData saveCouponAction reads. */
function couponForm(v: Record<string, unknown>) {
  const fixed = str(v, "type") === "fixed";
  return form({
    code: str(v, "code"),
    type: fixed ? "fixed" : "percent",
    value: fixed ? money(v.amount) : str(v, "percent"),
    minSubtotal: money(v.minSubtotal),
    usageLimit: str(v, "usageLimit"),
    startsAt: localDateTime(v.startsAt),
    endsAt: localDateTime(v.endsAt),
    isActive: bool(v, "isActive"),
    resetUsage: bool(v, "resetUsage"),
  });
}

/** The action reports the discount as `value`; on this form it is `percent` or `amount`. */
function onDiscountField(res: ActionResponse, v: Record<string, unknown>): ActionResponse {
  if (!res.errors?.value) return res;
  const { value, ...rest } = res.errors;
  return { ...res, errors: { ...rest, [str(v, "type") === "fixed" ? "amount" : "percent"]: value } };
}

function load(id: string | undefined): Coupon {
  const c = db.select().from(coupons).where(eq(coupons.id, intId(id))).get();
  if (!c) throw new ApiError(404, "Кодът не е намерен.");
  return c;
}

export const couponsSection: TableSectionDef = {
  spec: {
    key: "coupons",
    kind: "table",
    title: t("Кодове за отстъпка", "Discount codes"),
    icon: "ticket",
    description: t("Промо кодове, които клиентите въвеждат в количката – процент или фиксирана сума.", "Promo codes customers enter in the cart: a percentage or a fixed amount."),
    columns: [
      { key: "code", label: t("Код", "Code"), type: "text" },
      { key: "discount", label: t("Отстъпка", "Discount"), type: "text", align: "right" },
      { key: "minSubtotal", label: t("Мин. сума", "Min. amount"), type: "money", align: "right" },
      { key: "period", label: t("Период", "Period"), type: "text" },
      { key: "used", label: t("Използван", "Used"), type: "text", align: "right" },
      { key: "status", label: t("Статус", "Status"), type: "badge", options: STATUS_OPTIONS },
      { key: "isActive", label: t("Активен", "Active"), type: "boolean", toggle: "toggle_active" },
    ],
    per_page: 50,
    create: t("Нов код", "New code"),
    form: { fields: FIELDS },
    delete: t("Изтриване на кода?", "Delete the code?"),
    empty: t("Още няма кодове за отстъпка. Създайте код, напр. MAGGIE10 за 10% отстъпка.", "No discount codes yet. Create one, e.g. MAGGIE10 for 10% off."),
    actions: [{ key: "toggle_active", label: t("Активен", "Active"), scope: "row", hidden: true, input: [{ key: "value", type: "boolean", label: t("Активен", "Active") }] }],
  },

  async list(query) {
    const at = now();
    const all = db.select().from(coupons).orderBy(desc(coupons.isActive), desc(coupons.createdAt)).all();
    const { slice, total } = paginate(all, query);
    return {
      rows: slice.map((c) => ({
        id: c.id,
        values: {
          code: c.code,
          discount: discount(c),
          minSubtotal: c.minSubtotal || null,
          period: c.startsAt || c.endsAt ? `${c.startsAt ? fmtDate(c.startsAt) : "веднага"} → ${c.endsAt ? fmtDate(c.endsAt) : "без край"}` : "Без ограничение",
          used: c.usageLimit != null ? `${c.usedCount} / ${c.usageLimit}` : String(c.usedCount),
          status: couponStatus(c, at),
          isActive: c.isActive,
        },
      })),
      total,
      page: query.page,
      per_page: query.perPage,
    };
  },

  async get(id) {
    const c = load(id);
    const status = couponStatus(c, now());
    return {
      id: c.id,
      title: c.code,
      subtitle: `${discount(c)} отстъпка${c.minSubtotal ? ` над ${formatPrice(c.minSubtotal)}` : ""}`,
      values: couponValues(c),
      blocks: [
        {
          type: "fields",
          title: t("Използване", "Usage"),
          items: [
            { label: t("Статус", "Status"), value: status, kind: "badge", options: STATUS_OPTIONS },
            { label: t("Използван", "Used"), value: `${c.usedCount} ${c.usedCount === 1 ? "път" : "пъти"}${c.usageLimit != null ? ` от ${c.usageLimit}` : ""}` },
            { label: t("Създаден", "Created"), value: iso(c.createdAt), kind: "datetime" },
          ],
        },
      ],
    };
  },

  async defaults() {
    return {
      code: "",
      type: "percent",
      percent: null,
      amount: null,
      minSubtotal: null,
      usageLimit: null,
      isActive: true,
      startsAt: null,
      endsAt: null,
      resetUsage: false,
    };
  },

  async create(values) {
    const res = await run(() => saveCouponAction(null, null, couponForm(values)), { idFromRedirect: /\/admin\/coupons\/(\d+)/, okMessage: "Кодът е създаден." });
    return onDiscountField(res, values);
  },

  async update(id, values) {
    const c = load(id);
    return onDiscountField(await run(() => saveCouponAction(c.id, null, couponForm(values))), values);
  },

  async remove(id) {
    const c = load(id);
    return run(() => deleteCouponAction(c.id), { okMessage: "Кодът е изтрит." });
  },

  actions: {
    toggle_active: async ({ id, input }) => {
      const c = load(id);
      return run(() => toggleCouponAction(c.id, bool(input, "value")));
    },
  },
};
