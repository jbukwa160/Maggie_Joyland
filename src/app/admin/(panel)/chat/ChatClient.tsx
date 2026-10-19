"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Package, Send } from "lucide-react";
import type { SiteSettings } from "@/lib/settings-defaults";
import { fmtDate } from "@/lib/admin/dates";
import { BilingualField } from "@/components/admin/BilingualField";
import { Dialog } from "@/components/admin/Dialog";
import { ProductSearchBox } from "@/components/admin/ProductSearch";
import { FormError, SaveBar, useAdminForm } from "@/components/admin/forms";
import { useToast } from "@/components/admin/Toast";
import { Button, Card, Field, Textarea, Toggle, cn } from "@/components/admin/ui";
import { replyAction, saveChatSettingsAction } from "./actions";

type Message = { id: number; sender: "visitor" | "admin"; body: string; createdAt: number };

/** Linkify plain URLs in a chat message. */
function Body({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer" className="break-all underline">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Messages of one conversation + reply box. New messages are fetched every 5 s while open. */
export function ChatThread({ conversationId, initial, closed }: { conversationId: number; initial: Message[]; closed: boolean }) {
  const toast = useToast();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const [sending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/admin/chat/thread?id=${conversationId}&after=${lastId}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { messages: Message[] };
        if (data.messages.length && !stop) setMessages((cur) => [...cur, ...data.messages.filter((m) => !cur.some((c) => c.id === m.id))]);
      } catch {
        // Network hiccup – try again on the next tick.
      }
    };
    const timer = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [conversationId, lastId]);

  const send = () => {
    const body = text.trim();
    if (!body) return;
    start(async () => {
      const res = await replyAction(conversationId, body);
      if (!res.ok) return toast(res.error, "error");
      setMessages((cur) => (cur.some((c) => c.id === res.message.id) ? cur : [...cur, res.message]));
      setText("");
    });
  };

  const insertProduct = (slug: string, name: string) => {
    const url = `${window.location.origin}/product/${slug}`;
    const ta = areaRef.current;
    const pos = ta?.selectionStart ?? text.length;
    const piece = `${text && !/\s$/.test(text.slice(0, pos)) ? " " : ""}${name}: ${url} `;
    setText(text.slice(0, pos) + piece + text.slice(pos));
    setPicking(false);
    requestAnimationFrame(() => ta?.focus());
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-[18rem] flex-1 space-y-3 overflow-y-auto bg-cream/50 p-4 lg:max-h-[60vh]">
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.sender === "admin" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line shadow-sm",
                m.sender === "admin" ? "rounded-br-md bg-accent-500 text-surface" : "rounded-bl-md bg-surface text-ink",
              )}
            >
              <Body text={m.body} />
              <p className={cn("mt-1 text-[10px]", m.sender === "admin" ? "text-surface/80" : "text-ink-muted")}>{fmtDate(m.createdAt, true)}</p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="border-t border-primary-100 p-3">
        {closed && <p className="mb-2 text-xs text-ink-muted">Разговорът е затворен. Ако отговорите, той ще се отвори отново.</p>}
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={3}
          maxLength={2000}
          placeholder="Напишете отговор… (Enter изпраща, Shift+Enter – нов ред)"
          className="block w-full resize-y rounded-xl border border-ink-faint bg-surface px-3 py-2 text-sm text-ink focus:border-accent-400 focus:ring-2 focus:ring-accent-100 focus:outline-none"
          aria-label="Отговор"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={Package} onClick={() => setPicking(true)}>
            Връзка към продукт
          </Button>
          <Button onClick={send} disabled={sending || !text.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Изпрати
          </Button>
        </div>
      </div>
      <Dialog open={picking} onClose={() => setPicking(false)} title="Изпрати връзка към продукт">
        <ProductSearchBox autoFocus actionLabel="Вмъкни" onPick={(p) => insertProduct(p.slug, p.name)} />
      </Dialog>
    </div>
  );
}

export function ChatSettingsForm({ chat }: { chat: SiteSettings["chat"] }) {
  const { state, pending, onSubmit, errors } = useAdminForm(saveChatSettingsAction);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <Card title="Чат в сайта">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
            <Toggle name="enabled" defaultChecked={chat.enabled} label="Чатът е включен" description="Балонче в долния ъгъл на сайта." />
            <Toggle name="askContact" defaultChecked={chat.askContact} label="Питай за телефон или имейл" description="След първото съобщение, за да можете да отговорите и по-късно." />
          </div>
          <BilingualField label="Заглавие" nameBg="titleBg" nameEn="titleEn" defaultBg={chat.titleBg} defaultEn={chat.titleEn} required error={errors.titleBg} />
          <BilingualField label="Поздрав" nameBg="greetingBg" nameEn="greetingEn" defaultBg={chat.greetingBg} defaultEn={chat.greetingEn} multiline rows={2} mode="side" />
          <BilingualField
            label="Текст, когато никой не е на линия"
            nameBg="offlineTextBg"
            nameEn="offlineTextEn"
            defaultBg={chat.offlineTextBg}
            defaultEn={chat.offlineTextEn}
            multiline
            rows={2}
            mode="side"
            hint="„На линия“ сте, докато някоя страница от админ панела е отворена."
          />
        </div>
      </Card>
      <Card title="Бързи въпроси" description="Бутони, които посетителят може да натисне вместо да пише. По един въпрос на ред.">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Български" htmlFor="quickQuestionsBg" error={errors.quickQuestionsBg}>
            <Textarea id="quickQuestionsBg" name="quickQuestionsBg" rows={5} defaultValue={chat.quickQuestionsBg.join("\n")} />
          </Field>
          <Field label="English" htmlFor="quickQuestionsEn" error={errors.quickQuestionsEn}>
            <Textarea id="quickQuestionsEn" name="quickQuestionsEn" rows={5} defaultValue={chat.quickQuestionsEn.join("\n")} />
          </Field>
        </div>
      </Card>
      <FormError state={state} />
      <SaveBar pending={pending} />
    </form>
  );
}
