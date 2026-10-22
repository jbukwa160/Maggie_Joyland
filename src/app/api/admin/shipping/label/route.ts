// Admin: the courier label (waybill) PDF of an order, shown inline in the browser. GET ?orderId=123
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, orders } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { courierErrorMessage, getCarrier } from "@/lib/shipping";

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return text("Unauthorized", 401);

  const orderId = Number.parseInt(request.nextUrl.searchParams.get("orderId") ?? "", 10);
  if (!Number.isInteger(orderId) || orderId <= 0) return text("Невалидна поръчка.", 400);
  const order = db.select().from(orders).where(eq(orders.id, orderId)).get();
  if (!order) return text("Поръчката не е намерена.", 404);
  if (!order.shipmentId && !order.trackingNumber) return text("Поръчката няма товарителница.", 404);
  // Shipped by DilonSoft (src/lib/dilonsoft/channel.ts): the label is on DilonSoft's courier account.
  if (order.shipmentData?.source === "dilonsoft") return text("Товарителницата е създадена от DilonSoft - етикетът е там.", 409);

  try {
    const pdf = await getCarrier(order.carrier).getLabelPdf(order);
    const filename = `label-${order.number.replace(/[^\w-]/g, "")}.pdf`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error(`[shipping] label for order ${order.number} failed:`, e);
    return text(`Етикетът не може да бъде изтеглен: ${courierErrorMessage(e)}`, 502);
  }
}
