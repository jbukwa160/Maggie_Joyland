"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle, MessageCircleHeart, Send, X } from "lucide-react";
import { useI18n } from "../I18nProvider";

type Msg = { id: number; sender: "visitor" | "admin"; body: string; createdAt: number };
type Texts = { title: string; greeting: string; offlineText: string; quickQuestions: string[]; askContact: boolean; shopName: string };

const SEEN_KEY = "mj_chat_seen";
const CONTACT_LATER_KEY = "mj_chat_contact_later";

function readNumber(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}
function writeValue(key: string, v: string | number) {
  try {
    localStorage.setItem(key, String(v));
  } catch {}
}

/** Plain text with clickable links. */
function MessageText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+|\/(?:en\/)?product\/[^\s]+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^(https?:\/\/|\/)/.test(p) && i % 2 === 1 ? (
          <a key={i} href={p} className="break-all font-bold underline underline-offset-2" {...(p.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {p.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ChatWidget({ texts }: { texts: Texts }) {
  const { dict, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [online, setOnline] = useState(false);
  const [started, setStarted] = useState(false);
  const [hasContact, setHasContact] = useState(true);
  const [contactLater, setContactLater] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const lastId = messages.length ? messages[messages.length - 1].id : 0;

  const poll = useCallback(async (after: number) => {
    try {
      const res = await fetch(`/api/chat?after=${after}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.enabled) return;
      setOnline(!!data.online);
      setStarted(!!data.started);
      setHasContact(!!data.hasContact);
      if (data.messages?.length) setMessages((prev) => [...prev, ...data.messages.filter((m: Msg) => !prev.some((p) => p.id === m.id))]);
    } catch {
      // offline – try again on the next tick
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore "ask later" choice from storage
    setContactLater(readNumber(CONTACT_LATER_KEY) > 0);
    poll(0);
  }, [poll]);

  // Poll faster while the chat is open, slowly (for the unread badge) while it is closed.
  useEffect(() => {
    if (!started && !open) return;
    const t = setInterval(() => poll(lastId), open ? 6000 : 30000);
    return () => clearInterval(t);
  }, [open, started, lastId, poll]);

  useEffect(() => {
    const seen = readNumber(SEEN_KEY);
    if (open) {
      if (lastId) writeValue(SEEN_KEY, lastId);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- everything is read while the panel is open
      setUnread(0);
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    } else {
      setUnread(messages.filter((m) => m.sender === "admin" && m.id > seen).length);
    }
  }, [open, messages, lastId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, page: pathname, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(res.status === 429 ? "rate" : "error");
      setMessages((prev) => [...prev, data.message]);
      setStarted(true);
      setInput("");
      // A new message brings the contact question back.
      setContactLater(false);
      writeValue(CONTACT_LATER_KEY, 0);
    } catch (e) {
      setError((e as Error).message === "rate" ? dict.chat.tooMany : dict.chat.error);
    } finally {
      setSending(false);
    }
  };

  const saveContact = async (form: FormData) => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "contact", name: form.get("name"), contact: form.get("contact") }),
    });
    if (res.ok) {
      setHasContact(true);
      setContactSaved(true);
    }
  };

  const showContact = texts.askContact && started && !hasContact && !contactLater && messages.some((m) => m.sender === "visitor");

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 grid size-13 place-items-center rounded-full bg-accent-500 text-white shadow-soft ring-4 ring-surface transition hover:scale-105 hover:bg-accent-600 sm:bottom-5 sm:right-5"
          aria-label={dict.chat.open}
        >
          <MessageCircleHeart className="size-6" />
          {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-ink px-1 text-xs font-extrabold leading-6 text-white">{unread}</span>}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label={texts.title}
          className="fixed inset-0 z-[55] flex flex-col bg-cream sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(36rem,calc(100dvh-3rem))] sm:w-[23rem] sm:overflow-hidden sm:rounded-[2rem] sm:shadow-2xl sm:ring-1 sm:ring-primary-200"
        >
          <header className="flex items-center gap-3 bg-accent-500 px-4 py-3 text-white">
            <span className="grid size-10 place-items-center rounded-full bg-white/20">
              <MessageCircleHeart className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg leading-tight">{texts.title}</p>
              <p className="flex items-center gap-1.5 text-xs font-bold opacity-90">
                <span className={`size-2 rounded-full ${online ? "bg-mint" : "bg-white/50"}`} />
                {online ? dict.chat.online : dict.chat.offline}
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-white/15" aria-label={dict.chat.close}>
              <X className="size-5" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-dots px-4 py-4" aria-live="polite">
            <Bubble from="admin" name={texts.shopName}>
              {texts.greeting}
              {!online && <span className="mt-1 block text-xs opacity-75">{texts.offlineText}</span>}
            </Bubble>
            {messages.map((m) => (
              <Bubble key={m.id} from={m.sender} name={m.sender === "admin" ? texts.shopName : undefined}>
                <MessageText text={m.body} />
              </Bubble>
            ))}
            {!started && texts.quickQuestions.length > 0 && (
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                {texts.quickQuestions.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} disabled={sending} className="rounded-full border-2 border-accent-300 bg-surface px-3 py-1.5 text-left text-sm font-bold text-accent-700 hover:bg-accent-50">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {showContact && (
              <form
                action={saveContact}
                className="space-y-2 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-primary-100"
              >
                <p className="text-sm font-bold">{dict.chat.contactTitle}</p>
                <input name="name" placeholder={dict.chat.namePlaceholder} className="h-10 w-full rounded-xl border border-primary-200 px-3 text-sm focus:border-accent-400 focus:outline-none" />
                <input name="contact" required minLength={5} placeholder={dict.chat.contactPlaceholder} className="h-10 w-full rounded-xl border border-primary-200 px-3 text-sm focus:border-accent-400 focus:outline-none" />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-full bg-accent-500 py-2 text-sm font-extrabold text-white hover:bg-accent-600">
                    {dict.chat.contactSave}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setContactLater(true);
                      writeValue(CONTACT_LATER_KEY, 1);
                    }}
                    className="rounded-full px-3 py-2 text-sm font-bold text-ink-soft hover:bg-primary-50"
                  >
                    {dict.chat.notNow}
                  </button>
                </div>
              </form>
            )}
            {contactSaved && <p className="text-center text-sm font-bold text-mint-600">{dict.chat.contactThanks}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-primary-100 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {error && <p className="mb-2 text-sm font-bold text-danger">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                maxLength={2000}
                placeholder={dict.chat.placeholder}
                aria-label={dict.chat.placeholder}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-primary-200 px-3 py-2.5 text-base focus:border-accent-400 focus:outline-none sm:text-sm"
              />
              <button type="submit" disabled={sending || !input.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50" aria-label={dict.chat.send}>
                {sending ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

function Bubble({ from, name, children }: { from: "visitor" | "admin"; name?: string; children: React.ReactNode }) {
  const mine = from === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${mine ? "rounded-br-md bg-accent-500 text-white" : "rounded-bl-md bg-surface text-ink ring-1 ring-primary-100"}`}>
        {name && <span className="mb-0.5 block text-xs font-extrabold text-accent-600">{name}</span>}
        {children}
      </div>
    </div>
  );
}
