import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { Ban, MessageCircle, MessagesSquare, RotateCcw, Settings2, Trash2 } from "lucide-react";
import { db, users } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { adminThread, listConversations } from "@/lib/chat";
import { getSettings } from "@/lib/settings";
import { fmtDate } from "@/lib/admin/dates";
import { hrefWith } from "@/components/admin/Pagination";
import { describeUserAgent } from "@/lib/admin/user-agent";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { FilterBar } from "@/components/admin/FilterBar";
import { ActionButton, ConfirmButton } from "@/components/admin/forms";
import { Tabs } from "@/components/admin/Tabs";
import { FlashToast } from "@/components/admin/Toast";
import { Badge, Card, EmptyState, PageHeader, cn } from "@/components/admin/ui";
import { deleteChatAction, setChatStatusAction } from "./actions";
import { ChatSettingsForm, ChatThread } from "./ChatClient";

export const metadata: Metadata = { title: "Чат" };

export default async function ChatPage({ searchParams }: PageProps<"/admin/chat">) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === "settings" ? "settings" : "inbox";
  const status = sp.status === "closed" || sp.status === "all" ? sp.status : "open";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const selectedId = Number(sp.c) || 0;

  const tabs = (
    <Tabs
      active={tab}
      items={[
        { key: "inbox", label: "Разговори", href: "/admin/chat", icon: MessagesSquare },
        { key: "settings", label: "Настройки на чата", href: "/admin/chat?tab=settings", icon: Settings2 },
      ]}
    />
  );

  if (tab === "settings") {
    const { chat } = await getSettings();
    return (
      <>
        <PageHeader title="Чат" description="Отговаряйте на въпросите на посетителите в реално време." />
        {tabs}
        <ChatSettingsForm key={JSON.stringify(chat)} chat={chat} />
      </>
    );
  }

  const list = listConversations({ status, q });
  const thread = selectedId ? adminThread(selectedId) : null;
  const conv = thread?.conversation;
  const account = conv?.userId ? db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, conv.userId)).get() : undefined;
  const base = { status: status === "open" ? undefined : status, q: q || undefined };

  return (
    <>
      <FlashToast messages={{ deleted: "Разговорът е изтрит." }} />
      <AutoRefresh seconds={15} />
      <PageHeader title="Чат" description="Отговаряйте на въпросите на посетителите. Докато админ панелът е отворен, сайтът показва, че сте на линия." />
      {tabs}
      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className={cn("flex min-w-0 flex-col gap-3", conv && "hidden lg:flex")}>
          <div className="flex gap-1 rounded-xl bg-cream-dark p-1">
            {(
              [
                ["open", "Отворени"],
                ["closed", "Затворени"],
                ["all", "Всички"],
              ] as const
            ).map(([k, label]) => (
              <Link
                key={k}
                href={hrefWith("/admin/chat", { q: q || undefined }, { status: k === "open" ? null : k })}
                className={cn("flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-extrabold", status === k ? "bg-surface text-accent-700 shadow-sm" : "text-ink-muted")}
              >
                {label}
              </Link>
            ))}
          </div>
          <FilterBar basePath="/admin/chat" keep={status !== "open" ? { status } : undefined} search={q} searchPlaceholder="Име, контакт или текст…" hasFilters={!!q} className="mb-0" />
          {list.length ? (
            <ul className="flex flex-col gap-2">
              {list.map(({ conversation: c, lastMessage }) => (
                <li key={c.id}>
                  <Link
                    href={hrefWith("/admin/chat", base, { c: c.id })}
                    className={cn(
                      "block rounded-2xl border bg-surface p-3 transition-colors hover:border-primary-300",
                      c.id === selectedId ? "border-accent-400 ring-2 ring-accent-100" : "border-primary-100",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-bold text-ink">{c.name || c.contact || `Посетител #${c.id}`}</span>
                      {c.unreadAdmin > 0 && <Badge tone="pink">{c.unreadAdmin} нови</Badge>}
                      {c.status === "closed" && <Badge>затворен</Badge>}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{lastMessage}</p>
                    <p className="mt-1 text-[11px] text-ink-muted">{fmtDate(c.lastMessageAt, true)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={MessageCircle} title={q ? "Няма разговори по това търсене" : status === "open" ? "Няма отворени разговори" : "Няма разговори"} />
          )}
        </div>

        <div className={cn("min-w-0", !conv && "hidden lg:block")}>
          {conv && thread ? (
            <Card bodyClassName="p-0">
              <div className="flex flex-col">
                <div className="flex flex-col gap-3 border-b border-primary-100 p-4 sm:flex-row sm:items-start">
                  <div className="min-w-0 flex-1">
                    <Link href={hrefWith("/admin/chat", base, {})} className="mb-1 inline-block text-sm font-semibold text-ink-muted hover:text-accent-600 lg:hidden">
                      ← Всички разговори
                    </Link>
                    <p className="text-lg font-extrabold text-ink">{conv.name || `Посетител #${conv.id}`}</p>
                    <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs text-ink-soft sm:grid-cols-2">
                      <div>
                        <dt className="inline text-ink-muted">Контакт: </dt>
                        <dd className="inline break-all">
                          {conv.contact ? (
                            /@/.test(conv.contact) ? (
                              <a href={`mailto:${conv.contact}`} className="text-accent-600 underline">
                                {conv.contact}
                              </a>
                            ) : (
                              <a href={`tel:${conv.contact.replace(/\s/g, "")}`} className="text-accent-600 underline">
                                {conv.contact}
                              </a>
                            )
                          ) : (
                            "не е оставен"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-ink-muted">Страница: </dt>
                        <dd className="inline break-all">
                          {/^(https?:\/\/|\/)/i.test(conv.page) ? (
                            <a href={conv.page} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">
                              {conv.page}
                            </a>
                          ) : (
                            conv.page || "—"
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-ink-muted">Устройство: </dt>
                        <dd className="inline">{describeUserAgent(conv.userAgent)}</dd>
                      </div>
                      <div>
                        <dt className="inline text-ink-muted">IP: </dt>
                        <dd className="inline font-mono">{conv.ip || "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-ink-muted">Език: </dt>
                        <dd className="inline">{conv.locale === "en" ? "английски" : "български"}</dd>
                      </div>
                      <div>
                        <dt className="inline text-ink-muted">Започнат: </dt>
                        <dd className="inline">{fmtDate(conv.createdAt, true)}</dd>
                      </div>
                      {account && (
                        <div className="sm:col-span-2">
                          <dt className="inline text-ink-muted">Профил: </dt>
                          <dd className="inline">
                            <Link href={`/admin/customers/${account.id}`} className="text-accent-600 underline">
                              {account.email}
                            </Link>
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conv.status === "open" ? (
                      <ActionButton action={setChatStatusAction.bind(null, conv.id, "closed")} size="sm" icon={<Ban className="h-4 w-4" aria-hidden />}>
                        Затвори
                      </ActionButton>
                    ) : (
                      <ActionButton action={setChatStatusAction.bind(null, conv.id, "open")} size="sm" icon={<RotateCcw className="h-4 w-4" aria-hidden />}>
                        Отвори отново
                      </ActionButton>
                    )}
                    <form action={deleteChatAction.bind(null, conv.id)}>
                      <ConfirmButton size="sm" variant="ghost" className="text-danger" icon={<Trash2 className="h-4 w-4" aria-hidden />} message="Изтриване на разговора завинаги?">
                        Изтрий
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
                <ChatThread key={conv.id} conversationId={conv.id} initial={thread.messages} closed={conv.status === "closed"} />
              </div>
            </Card>
          ) : (
            <EmptyState icon={MessagesSquare} title="Изберете разговор" text="Новите съобщения се появяват автоматично." />
          )}
        </div>
      </div>
    </>
  );
}
