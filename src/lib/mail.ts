import "server-only";
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { db, orderItems, orders } from "@/db";
import { getDictionary } from "@/i18n/dictionaries";
import { formatPrice } from "./format";
import { getSettings } from "./settings";
import { CARRIER_NAMES } from "./shipping/types";

// Order e-mails are sent only when SMTP is configured in .env.local:
//   SMTP_HOST, SMTP_PORT (465 = SSL), SMTP_USER, SMTP_PASS, SMTP_FROM ("Maggie Joyland <shop@...>"),
//   ORDER_NOTIFY_EMAIL (where new-order notifications go; defaults to the contact e-mail from the settings).

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendOrderEmails(orderId: number) {
  const mailer = transport();
  if (!mailer) return;
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return;
  const items = db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).all();
  const settings = await getSettings();
  const locale = order.locale === "en" ? "en" : "bg";
  const dict = getDictionary(locale);
  const from = process.env.SMTP_FROM ?? `${settings.general.siteName} <${settings.general.contactEmail}>`;
  const brand = settings.theme.accent;

  const rows = items
    .map((i) => `<tr><td style="padding:6px 0">${esc(i.name)} × ${i.quantity}</td><td style="padding:6px 0;text-align:right">${formatPrice(i.lineTotal, locale)}</td></tr>`)
    .join("");
  const delivery = `${CARRIER_NAMES[order.carrier]} – ${esc(order.officeName || `${order.city}, ${order.address}`)}`;
  const bank = order.paymentMethod === "bank" ? `<p style="white-space:pre-line;background:#fff4f6;padding:12px;border-radius:12px"><b>${dict.success.bankTitle}</b>\n${esc(locale === "en" ? settings.shipping.bankDetailsEn : settings.shipping.bankDetailsBg)}</p>` : "";
  const html = `<div style="font-family:Arial,sans-serif;color:#4a3340;max-width:560px;margin:auto">
  <h2 style="color:${brand}">${esc(settings.general.siteName)}</h2>
  <h3>${dict.success.title}</h3>
  <p>${esc(dict.success.text.replace("{number}", order.number))}</p>
  <table style="width:100%;border-collapse:collapse">${rows}
  <tr><td style="padding:6px 0;border-top:1px solid #eee">${dict.cart.shipping}</td><td style="padding:6px 0;border-top:1px solid #eee;text-align:right">${formatPrice(order.shippingPrice, locale)}</td></tr>
  ${order.discount ? `<tr><td>${dict.cart.discount}</td><td style="text-align:right">-${formatPrice(order.discount, locale)}</td></tr>` : ""}
  <tr><td style="padding:6px 0"><b>${dict.cart.total}</b></td><td style="padding:6px 0;text-align:right"><b>${formatPrice(order.total, locale)}</b></td></tr></table>
  <p>${dict.account.deliveryTo}: ${delivery}</p>${bank}</div>`;

  await mailer.sendMail({ from, to: order.email, subject: `${settings.general.siteName} – ${dict.account.order} ${order.number}`, html });
  const notify = process.env.ORDER_NOTIFY_EMAIL || settings.general.contactEmail;
  if (notify) {
    await mailer.sendMail({
      from,
      to: notify,
      subject: `Нова поръчка ${order.number} – ${formatPrice(order.total, "bg")}`,
      html: `<p>Нова поръчка <b>${order.number}</b> от ${esc(order.firstName)} ${esc(order.lastName)} (${esc(order.phone)}, ${esc(order.email)}).</p>${html}`,
    });
  }
}
