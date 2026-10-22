"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  BadgePercent,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Factory,
  FileText,
  FolderTree,
  Gift,
  Image as ImageIcon,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Newspaper,
  Package,
  PanelTop,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Ticket,
  Upload,
  UserCircle,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { NAV_COOKIE } from "@/lib/admin/nav";
import { useToast } from "./Toast";
import { cn } from "./ui";

type NavItem = { href: string; label: string; icon: LucideIcon; badge?: number; badgeTone?: "pink" | "warning" };

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl py-2 text-sm font-bold transition-colors",
        collapsed ? "justify-center px-2" : "px-3",
        active ? "bg-primary-100 text-accent-700" : "text-ink-soft hover:bg-primary-50 hover:text-ink",
      )}
    >
      <Icon className={cn("h-4.5 w-4.5 shrink-0", active ? "text-accent-500" : "text-ink-muted")} aria-hidden />
      <span className={cn("flex-1", collapsed && "sr-only")}>{item.label}</span>
      {!!item.badge && (
        <span
          className={cn(
            "rounded-full text-[11px] font-extrabold tabular-nums",
            collapsed ? "absolute -top-0.5 -right-0.5 min-w-5 px-1 py-px text-center" : "px-2 py-0.5",
            item.badgeTone === "warning" ? "bg-warning-50 text-warning" : "bg-accent-500 text-surface",
          )}
        >
          {item.badge > 999 ? "999+" : item.badge}
        </span>
      )}
    </Link>
  );
}

export function AdminShell({
  user,
  newOrders,
  unconfirmed,
  chatUnread,
  initialCollapsed,
  logout,
  children,
}: {
  user: { name: string; email: string };
  newOrders: number;
  unconfirmed: number;
  chatUnread: number;
  initialCollapsed: boolean;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [unread, setUnread] = useState(chatUnread);
  const lastUnread = useRef(chatUnread);

  // Chat: keep the shop "online" and the unread count fresh while any admin page is open.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/admin/chat/poll", { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { unread: number };
        if (data.unread > lastUnread.current) toast("Ново съобщение в чата 💬", "info");
        lastUnread.current = data.unread;
        setUnread(data.unread);
      } catch {
        // Offline for a moment – the next poll will retry.
      }
    };
    poll();
    const timer = setInterval(poll, 15_000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [toast]);

  // "(2) Поръчки · Админ" – unread chat messages in the browser tab title.
  useEffect(() => {
    const apply = () => {
      const base = document.title.replace(/^\(\d+\)\s/, "");
      document.title = unread > 0 ? `(${unread}) ${base}` : base;
    };
    apply();
    const t = setTimeout(apply, 300); // after Next.js updates the title on navigation
    return () => clearTimeout(t);
  }, [unread, pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${NAV_COOKIE}=${next ? "collapsed" : "open"}; path=/admin; max-age=31536000; samesite=lax`;
  };

  const groups: { title?: string; items: NavItem[] }[] = [
    { items: [{ href: "/admin", label: "Табло", icon: LayoutDashboard }] },
    {
      title: "Продажби",
      items: [
        { href: "/admin/orders", label: "Поръчки", icon: ShoppingBag, badge: newOrders },
        { href: "/admin/chat", label: "Чат", icon: MessagesSquare, badge: unread },
        { href: "/admin/customers", label: "Клиенти", icon: Users },
        { href: "/admin/prices", label: "Цени и промоции", icon: Tags },
        { href: "/admin/sales", label: "Промоции", icon: BadgePercent },
        { href: "/admin/coupons", label: "Кодове за отстъпка", icon: Ticket },
        { href: "/admin/subscribers", label: "Абонати", icon: Mail },
      ],
    },
    {
      title: "Каталог",
      items: [
        { href: "/admin/products", label: "Продукти", icon: Package, badge: unconfirmed, badgeTone: "warning" },
        { href: "/admin/inventory", label: "Наличности", icon: Boxes },
        { href: "/admin/categories", label: "Категории", icon: FolderTree },
        { href: "/admin/characters", label: "Герои и колекции", icon: Sparkles },
        { href: "/admin/manufacturers", label: "Производители", icon: Factory },
        { href: "/admin/import", label: "Импорт", icon: Upload },
      ],
    },
    {
      title: "Съдържание",
      items: [
        { href: "/admin/menu", label: "Меню", icon: PanelTop },
        { href: "/admin/banners", label: "Банери", icon: ImageIcon },
        { href: "/admin/gifts", label: "Идеи за подаръци", icon: Gift },
        { href: "/admin/blog", label: "Блог", icon: Newspaper },
        { href: "/admin/pages", label: "Страници", icon: FileText },
      ],
    },
    {
      title: "Магазин",
      items: [
        { href: "/admin/settings", label: "Настройки", icon: Settings },
        { href: "/admin/profile", label: "Профил и админи", icon: UserCircle },
        { href: "/admin/api", label: "API и MCP", icon: KeyRound },
      ],
    },
  ];

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  const close = () => setOpen(false);

  const sidebar = (mini: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center justify-between pt-5 pb-4", mini ? "px-2" : "px-5")}>
        <Link href="/admin" onClick={close} className={cn("leading-tight", mini && "mx-auto")} title="Maggie Joyland · Админ">
          {mini ? (
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-100 font-display text-lg text-accent-600">M</span>
          ) : (
            <>
              <span className="block font-display text-xl text-accent-600">Maggie Joyland</span>
              <span className="text-xs font-bold tracking-[0.2em] text-ink-muted uppercase">Админ панел</span>
            </>
          )}
        </Link>
        <button type="button" onClick={close} className="rounded-lg p-1.5 text-ink-muted hover:bg-primary-50 lg:hidden" aria-label="Затвори менюто">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className={cn("pb-3", mini ? "px-2" : "px-3")}>
        <a
          href="/"
          target="_blank"
          rel="noopener"
          title="Към сайта"
          className="flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-bold text-accent-700 transition-colors hover:bg-primary-100"
        >
          <span className={cn(mini && "sr-only")}>Към сайта</span> <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
      <nav className={cn("flex-1 space-y-4 overflow-y-auto pb-4", mini ? "px-2" : "px-3")} aria-label="Админ меню">
        {groups.map((g, i) => (
          <div key={i}>
            {g.title &&
              (mini ? (
                <div className="mx-2 mb-2 border-t border-primary-100" aria-hidden />
              ) : (
                <p className="mb-1 px-3 text-[11px] font-extrabold tracking-[0.15em] text-ink-muted/80 uppercase">{g.title}</p>
              ))}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={mini} onNavigate={close} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-primary-100 p-3">
        <div className={cn("flex items-center gap-3 rounded-xl py-2", mini ? "flex-col px-0" : "px-2")}>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-100 font-extrabold text-secondary-600"
            title={mini ? user.email : undefined}
          >
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </span>
          {!mini && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{user.name || "Администратор"}</p>
              <p className="truncate text-xs text-ink-muted">{user.email}</p>
            </div>
          )}
          <form action={logout}>
            <button type="submit" className="rounded-lg p-2 text-ink-muted hover:bg-primary-50 hover:text-accent-600" title="Изход" aria-label="Изход">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="mt-1 hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-ink-muted hover:bg-primary-50 hover:text-ink lg:flex"
          aria-label={mini ? "Разгъни менюто" : "Свий менюто"}
          title={mini ? "Разгъни менюто" : "Свий менюто"}
        >
          {mini ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          {!mini && "Свий менюто"}
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn("min-h-dvh", collapsed ? "lg:pl-20" : "lg:pl-64")}>
      {/* Desktop sidebar (collapsible to icons) */}
      <aside className={cn("fixed inset-y-0 left-0 z-30 hidden border-r border-primary-100 bg-surface transition-[width] lg:block", collapsed ? "w-20" : "w-64")}>
        {sidebar(collapsed)}
      </aside>

      {/* Phone / tablet: top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-primary-100 bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
        <button type="button" onClick={() => setOpen(true)} className="relative rounded-lg p-1.5 text-ink hover:bg-primary-50" aria-label="Отвори менюто" aria-expanded={open}>
          <Menu className="h-6 w-6" />
          {unread + newOrders > 0 && <span className="absolute top-0.5 right-0.5 h-2.5 w-2.5 rounded-full bg-accent-500 ring-2 ring-surface" aria-hidden />}
        </button>
        <Link href="/admin" className="min-w-0 truncate font-display text-lg text-accent-600">
          Maggie Joyland <span className="font-sans text-xs font-bold text-ink-muted">· Админ</span>
        </Link>
        <span className="ml-auto flex shrink-0 gap-1.5">
          {unread > 0 && (
            <Link href="/admin/chat" className="flex items-center gap-1 rounded-full bg-secondary-100 px-2.5 py-0.5 text-xs font-extrabold text-secondary-600">
              <MessagesSquare className="h-3.5 w-3.5" /> {unread}
            </Link>
          )}
          {newOrders > 0 && (
            <Link href="/admin/orders?status=new" className="rounded-full bg-accent-500 px-2.5 py-0.5 text-xs font-extrabold text-surface">
              {newOrders} нови
            </Link>
          )}
        </span>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Меню">
          <button type="button" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={close} aria-label="Затвори менюто" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-soft">{sidebar(false)}</aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-7xl min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
