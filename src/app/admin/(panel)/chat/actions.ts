"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { adminReply, deleteConversation, setConversationStatus, type ChatMessageView } from "@/lib/chat";
import { saveSettingsSection } from "@/lib/settings";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { bool, str, zodErrors } from "@/lib/admin/form";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

export async function replyAction(conversationId: number, body: string): Promise<{ ok: true; message: ChatMessageView } | { ok: false; error: string }> {
  await requireAdmin();
  if (!body.trim()) return { ok: false, error: "Напишете съобщение." };
  if (body.length > 2000) return { ok: false, error: "Съобщението е твърде дълго (до 2000 символа)." };
  const msg = adminReply(conversationId, body);
  if (!msg) return { ok: false, error: "Разговорът не е намерен." };
  revalidateAdmin("/admin/chat");
  return { ok: true, message: msg };
}

export async function setChatStatusAction(conversationId: number, status: "open" | "closed"): Promise<ActionState> {
  await requireAdmin();
  setConversationStatus(conversationId, status === "closed" ? "closed" : "open");
  revalidateAdmin("/admin/chat");
  return success(status === "closed" ? "Разговорът е затворен." : "Разговорът е отворен отново.");
}

export async function deleteChatAction(conversationId: number) {
  await requireAdmin();
  deleteConversation(conversationId);
  revalidateAdmin("/admin/chat");
  redirect("/admin/chat?flash=deleted");
}

const lines = (raw: string) =>
  raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

export async function saveChatSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const text = (max: number) => z.string().max(max, "Текстът е твърде дълъг.");
  const parsed = z
    .object({
      enabled: z.boolean(),
      titleBg: z.string().min(1, "Въведете заглавие.").max(80),
      titleEn: text(80),
      greetingBg: text(500),
      greetingEn: text(500),
      offlineTextBg: text(500),
      offlineTextEn: text(500),
      quickQuestionsBg: z.array(z.string().max(120, "Въпросът е твърде дълъг.")).max(8, "Най-много 8 бързи въпроса."),
      quickQuestionsEn: z.array(z.string().max(120, "Въпросът е твърде дълъг.")).max(8, "Най-много 8 бързи въпроса."),
      askContact: z.boolean(),
    })
    .safeParse({
      enabled: bool(fd, "enabled"),
      titleBg: str(fd, "titleBg"),
      titleEn: str(fd, "titleEn"),
      greetingBg: str(fd, "greetingBg"),
      greetingEn: str(fd, "greetingEn"),
      offlineTextBg: str(fd, "offlineTextBg"),
      offlineTextEn: str(fd, "offlineTextEn"),
      quickQuestionsBg: lines(str(fd, "quickQuestionsBg")),
      quickQuestionsEn: lines(str(fd, "quickQuestionsEn")),
      askContact: bool(fd, "askContact"),
    });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  await saveSettingsSection("chat", parsed.data);
  revalidateAdmin("/admin/chat");
  revalidateShop();
  return success("Настройките на чата са запазени.");
}
