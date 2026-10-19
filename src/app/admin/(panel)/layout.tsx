import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db, orders, products } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { unreadAdminCount } from "@/lib/chat";
import { NAV_COOKIE } from "@/lib/admin/nav";
import { AdminShell } from "@/components/admin/Sidebar";
import { ToastProvider } from "@/components/admin/Toast";
import { logoutAction } from "../actions";

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const newOrders = db.select({ n: sql<number>`count(*)` }).from(orders).where(eq(orders.status, "new")).get()?.n ?? 0;
  const unconfirmed = db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.priceConfirmed, false)).get()?.n ?? 0;
  const collapsed = (await cookies()).get(NAV_COOKIE)?.value === "collapsed";
  const name = `${user.firstName} ${user.lastName}`.trim();
  return (
    <ToastProvider>
      <AdminShell
        user={{ name, email: user.email }}
        newOrders={newOrders}
        unconfirmed={unconfirmed}
        chatUnread={unreadAdminCount()}
        initialCollapsed={collapsed}
        logout={logoutAction}
      >
        {children}
      </AdminShell>
    </ToastProvider>
  );
}
