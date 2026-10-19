import type { Metadata } from "next";
import { ne } from "drizzle-orm";
import { blogPosts, db } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { saveBlogAction } from "../actions";
import { BlogEditor } from "../BlogEditor";

export const metadata: Metadata = { title: "Нова статия" };

export default async function NewBlogPage() {
  await requireAdmin();
  const topics = db.selectDistinct({ t: blogPosts.topic }).from(blogPosts).where(ne(blogPosts.topic, "")).all().map((r) => r.t);
  return (
    <>
      <PageHeader title="Нова статия" back={{ href: "/admin/blog", label: "Блог" }} />
      <BlogEditor
        action={saveBlogAction.bind(null, null)}
        isNew
        status="draft"
        topics={topics}
        redirects={[]}
        initial={{
          titleBg: "",
          titleEn: "",
          excerptBg: "",
          excerptEn: "",
          bodyBg: "",
          bodyEn: "",
          cover: "",
          coverColor: "pink",
          topic: "",
          slug: "",
          metaTitleBg: "",
          metaTitleEn: "",
          metaDescriptionBg: "",
          metaDescriptionEn: "",
          publishMode: "draft",
          publishAt: "",
        }}
      />
    </>
  );
}
