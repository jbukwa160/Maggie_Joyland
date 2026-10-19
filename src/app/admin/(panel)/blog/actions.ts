"use server";

import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { blogPosts, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { failure, success, type ActionState } from "@/lib/admin/action-state";
import { dateTime, str, zImageUrl, zodErrors } from "@/lib/admin/form";
import { saveBlogPost, uniqueBlogSlug } from "@/lib/admin/blog";
import { revalidateAdmin, revalidateShop } from "@/lib/admin/revalidate";

const schema = z.object({
  titleBg: z.string().min(1, "Въведете заглавие.").max(200, "Заглавието е твърде дълго."),
  titleEn: z.string().max(200, "Заглавието е твърде дълго."),
  excerptBg: z.string().max(600, "Резюмето е твърде дълго."),
  excerptEn: z.string().max(600, "Резюмето е твърде дълго."),
  bodyBg: z.string().max(200_000, "Текстът е твърде дълъг."),
  bodyEn: z.string().max(200_000, "Текстът е твърде дълъг."),
  cover: zImageUrl,
  coverColor: z.enum(["pink", "lilac", "cream", "mint", "gold"]),
  topic: z.string().max(60, "Темата е твърде дълга."),
  slug: z.string().max(100).regex(/^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Само малки латински букви, цифри и тирета."),
  metaTitleBg: z.string().max(120),
  metaTitleEn: z.string().max(120),
  metaDescriptionBg: z.string().max(320),
  metaDescriptionEn: z.string().max(320),
  publishMode: z.enum(["draft", "now", "schedule"]),
});

function refresh(id?: number) {
  revalidateAdmin("/admin/blog");
  if (id) revalidateAdmin(`/admin/blog/${id}`);
  revalidateShop();
}

export async function saveBlogAction(id: number | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = schema.safeParse({
    titleBg: str(fd, "titleBg"),
    titleEn: str(fd, "titleEn"),
    excerptBg: str(fd, "excerptBg"),
    excerptEn: str(fd, "excerptEn"),
    bodyBg: str(fd, "bodyBg"),
    bodyEn: str(fd, "bodyEn"),
    cover: str(fd, "cover"),
    coverColor: str(fd, "coverColor") || "pink",
    topic: str(fd, "topic"),
    slug: str(fd, "slug").toLowerCase(),
    metaTitleBg: str(fd, "metaTitleBg"),
    metaTitleEn: str(fd, "metaTitleEn"),
    metaDescriptionBg: str(fd, "metaDescriptionBg"),
    metaDescriptionEn: str(fd, "metaDescriptionEn"),
    publishMode: str(fd, "publishMode") || "draft",
  });
  if (!parsed.success) return failure("Проверете маркираните полета.", zodErrors(parsed.error));
  const { publishMode, ...d } = parsed.data;

  const existing = id ? db.select().from(blogPosts).where(eq(blogPosts.id, id)).get() : undefined;
  if (id && !existing) return failure("Статията не е намерена.");

  let slug = d.slug;
  if (slug) {
    const taken = db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(id ? and(eq(blogPosts.slug, slug), ne(blogPosts.id, id)) : eq(blogPosts.slug, slug))
      .get();
    if (taken) return failure("Проверете маркираните полета.", { slug: "Друга статия вече използва този адрес." });
  } else {
    slug = uniqueBlogSlug(d.titleBg, id);
  }

  const now = new Date();
  let published = false;
  let publishedAt = existing?.publishedAt ?? null;
  if (publishMode === "now") {
    published = true;
    // Keep the original date when an already published article is edited.
    if (!publishedAt || publishedAt > now || !existing?.published) publishedAt = now;
  } else if (publishMode === "schedule") {
    const at = dateTime(fd, "publishAt");
    if (!at) return failure("Изберете дата и час на публикуване.", { publishAt: "Изберете дата и час." });
    if (at <= now) return failure("Датата за насрочване трябва да е в бъдещето.", { publishAt: "Изберете бъдещ момент." });
    published = true;
    publishedAt = at;
  }

  const postId = saveBlogPost(id, { ...d, slug, published, publishedAt });
  refresh(postId);
  if (!id) redirect(`/admin/blog/${postId}?flash=created`);
  return success(publishMode === "draft" ? "Черновата е запазена." : publishMode === "schedule" ? "Статията е насрочена." : "Статията е публикувана.");
}

export async function deleteBlogAction(id: number) {
  await requireAdmin();
  db.delete(blogPosts).where(eq(blogPosts.id, id)).run();
  refresh();
  redirect("/admin/blog?flash=deleted");
}
